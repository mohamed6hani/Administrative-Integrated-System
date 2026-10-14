'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const { DATA_ROOT } = require('../../General/backend/platform-paths');

let _db = null;
let _ftsReady = false;

function normalizeOcrText(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/\uFEFF/g, '')
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[هة]/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function ensureColumn(db, tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((column) => column.name === columnName)) return;
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function ensureFts(db) {
  try {
    const existing = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='ocr_results_fts'").get();
    if (existing?.sql && /content\s*=/.test(existing.sql)) {
      db.exec('DROP TABLE IF EXISTS ocr_results_fts');
    }
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS ocr_results_fts
      USING fts5(ocrId UNINDEXED, normalizedText);
    `);
    _ftsReady = true;
  } catch {
    _ftsReady = false;
  }
}

function syncFtsRow(db, id, normalizedText, scanStatus) {
  if (!_ftsReady) return;
  try {
    db.prepare('DELETE FROM ocr_results_fts WHERE ocrId = ?').run(String(id));
    if (scanStatus === 'completed' && normalizedText) {
      db.prepare('INSERT INTO ocr_results_fts(ocrId, normalizedText) VALUES (?, ?)').run(String(id), normalizedText);
    }
  } catch {
    _ftsReady = false;
  }
}

function buildFtsQuery(query) {
  const normalized = normalizeOcrText(query);
  if (!normalized) return '';
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `${token.replace(/"/g, '""')}*`)
    .join(' AND ');
}

function getDb() {
  if (_db) return _db;
  const dbDir = path.join(DATA_ROOT, 'Report');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  _db = new DatabaseSync(path.join(dbDir, 'ocr.db'));
  _db.exec(`
    CREATE TABLE IF NOT EXISTS ocr_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year TEXT NOT NULL DEFAULT '',
      decisionNumber TEXT NOT NULL DEFAULT '',
      letterCounter TEXT NOT NULL DEFAULT '',
      uploadFileKey TEXT NOT NULL DEFAULT '',
      attachmentId TEXT NOT NULL DEFAULT '',
      originalFileName TEXT NOT NULL DEFAULT '',
      filePath TEXT NOT NULL DEFAULT '',
      fileHash TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      pageNumber INTEGER NOT NULL DEFAULT 1,
      extractedText TEXT NOT NULL DEFAULT '',
      normalizedText TEXT NOT NULL DEFAULT '',
      cachePath TEXT NOT NULL DEFAULT '',
      confidence REAL,
      ocrEngine TEXT NOT NULL DEFAULT 'qari',
      scanStatus TEXT NOT NULL DEFAULT 'pending',
      errorMessage TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_ocr_key_page
      ON ocr_results(uploadFileKey, pageNumber);
    CREATE INDEX IF NOT EXISTS idx_ocr_decision
      ON ocr_results(decisionNumber, category);
    CREATE INDEX IF NOT EXISTS idx_ocr_year
      ON ocr_results(year);
    CREATE INDEX IF NOT EXISTS idx_ocr_status
      ON ocr_results(scanStatus);
  `);
  ensureColumn(_db, 'ocr_results', 'normalizedText', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(_db, 'ocr_results', 'ocrEngine', "TEXT NOT NULL DEFAULT 'qari'");
  ensureFts(_db);
  return _db;
}

function upsertOcrPage(row) {
  const db = getDb();
  const normalizedText = normalizeOcrText(row.extractedText ?? '');
  const scanStatus = row.scanStatus ?? 'completed';
  db.prepare(`
    INSERT INTO ocr_results
      (year, decisionNumber, letterCounter, uploadFileKey, attachmentId,
       originalFileName, filePath, fileHash, category, pageNumber,
       extractedText, normalizedText, cachePath, confidence, ocrEngine, scanStatus, errorMessage, updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(uploadFileKey, pageNumber) DO UPDATE SET
      year=excluded.year, decisionNumber=excluded.decisionNumber,
      letterCounter=excluded.letterCounter, attachmentId=excluded.attachmentId,
      originalFileName=excluded.originalFileName, filePath=excluded.filePath,
      fileHash=excluded.fileHash, category=excluded.category,
      extractedText=excluded.extractedText, normalizedText=excluded.normalizedText,
      cachePath=excluded.cachePath, confidence=excluded.confidence,
      ocrEngine=excluded.ocrEngine, scanStatus=excluded.scanStatus,
      errorMessage=excluded.errorMessage, updatedAt=datetime('now')
  `).run(
    row.year ?? '',
    row.decisionNumber ?? '',
    row.letterCounter ?? '',
    row.uploadFileKey ?? '',
    row.attachmentId ?? '',
    row.originalFileName ?? '',
    row.filePath ?? '',
    row.fileHash ?? '',
    row.category ?? '',
    row.pageNumber ?? 1,
    row.extractedText ?? '',
    normalizedText,
    row.cachePath ?? '',
    row.confidence ?? null,
    row.ocrEngine ?? 'qari',
    scanStatus,
    row.errorMessage ?? null,
  );
  const saved = db.prepare('SELECT id FROM ocr_results WHERE uploadFileKey = ? AND pageNumber = ?')
    .get(row.uploadFileKey ?? '', row.pageNumber ?? 1);
  if (saved?.id) syncFtsRow(db, saved.id, normalizedText, scanStatus);
}

function deleteByFileKey(uploadFileKey) {
  const db = getDb();
  if (_ftsReady) {
    const rows = db.prepare('SELECT id FROM ocr_results WHERE uploadFileKey = ?').all(uploadFileKey);
    for (const row of rows) syncFtsRow(db, row.id, '', 'deleted');
  }
  db.prepare('DELETE FROM ocr_results WHERE uploadFileKey = ?').run(uploadFileKey);
}

// Returns { fileHash, scanStatus } for the first page of uploadFileKey, or null
function getCachedEntry(uploadFileKey) {
  return getDb().prepare(
    'SELECT fileHash, scanStatus FROM ocr_results WHERE uploadFileKey = ? ORDER BY pageNumber LIMIT 1'
  ).get(uploadFileKey) ?? null;
}

function getByDecision(decisionNumber, category) {
  const db = getDb();
  if (category) {
    return db.prepare(
      `SELECT * FROM ocr_results
       WHERE decisionNumber = ? AND category = ?
       ORDER BY letterCounter, pageNumber`
    ).all(decisionNumber, category);
  }
  return db.prepare(
    `SELECT * FROM ocr_results
     WHERE decisionNumber = ?
     ORDER BY category, letterCounter, pageNumber`
  ).all(decisionNumber);
}

function searchOcr({ query, decisionNumber, category, year, limit = 100 }) {
  const db = getDb();
  const conditions = ["scanStatus = 'completed'"];
  const params = [];
  if (decisionNumber) { conditions.push('decisionNumber = ?'); params.push(String(decisionNumber)); }
  if (category) { conditions.push('category = ?'); params.push(category); }
  if (year) { conditions.push('year = ?'); params.push(String(year)); }
  const where = `WHERE ${conditions.join(' AND ')}`;

  if (query && _ftsReady) {
    const ftsQuery = buildFtsQuery(query);
    if (ftsQuery) {
      return db.prepare(
        `SELECT r.id, r.year, r.decisionNumber, r.letterCounter, r.uploadFileKey,
                r.attachmentId, r.originalFileName, r.category, r.pageNumber,
                r.extractedText, r.scanStatus
         FROM ocr_results_fts f
         JOIN ocr_results r ON r.id = CAST(f.ocrId AS INTEGER)
         ${where} AND f.normalizedText MATCH ?
         ORDER BY r.decisionNumber, r.letterCounter, r.pageNumber
         LIMIT ?`
      ).all(...params, ftsQuery, limit);
    }
  }

  if (query) {
    conditions.push('normalizedText LIKE ?');
    params.push(`%${normalizeOcrText(query)}%`);
  }
  const fallbackWhere = `WHERE ${conditions.join(' AND ')}`;
  return db.prepare(
    `SELECT id, year, decisionNumber, letterCounter, uploadFileKey,
            attachmentId, originalFileName, category, pageNumber,
            extractedText, scanStatus
     FROM ocr_results ${fallbackWhere}
     ORDER BY decisionNumber, letterCounter, pageNumber
     LIMIT ?`
  ).all(...params, limit);
}

function getStats() {
  return getDb().prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN scanStatus='completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN scanStatus='failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN scanStatus='pending' THEN 1 ELSE 0 END) as pending,
      COUNT(DISTINCT decisionNumber) as decisions,
      COUNT(DISTINCT uploadFileKey) as files
    FROM ocr_results
  `).get();
}

// Returns a Set of decisionNumbers that have at least one completed page
function getScannedDecisionSet(category) {
  const q = category
    ? `SELECT DISTINCT decisionNumber FROM ocr_results WHERE scanStatus='completed' AND category=?`
    : `SELECT DISTINCT decisionNumber FROM ocr_results WHERE scanStatus='completed'`;
  const rows = getDb().prepare(q).all(...(category ? [category] : []));
  return new Set(rows.map(r => String(r.decisionNumber)));
}

module.exports = { getDb, upsertOcrPage, deleteByFileKey, getCachedEntry, getByDecision, searchOcr, getStats, getScannedDecisionSet, normalizeOcrText };
