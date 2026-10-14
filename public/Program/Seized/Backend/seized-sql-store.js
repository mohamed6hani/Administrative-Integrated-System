import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const SQL_COLUMNS = [
  { key: 'category',       label: 'الفئة',          csvKey: 'الفئة',          aliases: ['الفئة'] },
  { key: 'record_number',  label: 'رقم الحرز',      csvKey: 'رقم الحرز',      aliases: ['رقم الحرز'], required: true },
  { key: 'license_number', label: 'رقم الرخصة',     csvKey: 'رقم الرخصة',     aliases: ['رقم الرخصة'] },
  { key: 'license_type',   label: 'نوع الرخصة',     csvKey: 'نوع الرخصة',     aliases: ['نوع الرخصة'] },
  { key: 'station',        label: 'القسم',           csvKey: 'القسم',          aliases: ['القسم', 'القسم التابع'] },
  { key: 'name',           label: 'الاسم',           csvKey: 'الاسم',          aliases: ['الاسم'] },
  { key: 'weapon_type',    label: 'النوع',           csvKey: 'النوع',          aliases: ['النوع'] },
  { key: 'brand',          label: 'الماركة',         csvKey: 'الماركة',        aliases: ['الماركة'] },
  { key: 'caliber',        label: 'العيار',          csvKey: 'العيار',         aliases: ['العيار'] },
  { key: 'serial_number',  label: 'الرقم',           csvKey: 'الرقم',          aliases: ['الرقم'] },
  { key: 'cancel_reason',  label: 'سبب الالغاء',    csvKey: 'سبب الالغاء',    aliases: ['سبب الالغاء', 'سبب الإلغاء'] },
  { key: 'deposit_date',   label: 'تاريخ الايداع',  csvKey: 'تاريخ الايداع',  aliases: ['تاريخ الايداع', 'تاريخ الإيداع'] },
  { key: 'expiry_date',    label: 'تاريخ الانتهاء', csvKey: 'تاريخ الانتهاء', aliases: ['تاريخ الانتهاء'] },
  { key: 'record_owner',   label: 'مالك الحرز',     csvKey: 'مالك الحرز',     aliases: ['مالك الحرز'] },
  { key: 'seize_type',     label: 'نوع الحرز',      csvKey: 'نوع الحرز',      aliases: ['نوع الحرز'] },
  { key: 'notes',          label: 'ملاحظات',        csvKey: 'ملاحظات',        aliases: ['ملاحظات'] },
];

function normalizeHeader(value) {
  return String(value || '')
    .replace(/^﻿/, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ـ‌-‏]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseCsvText(csvText) {
  const input = String(csvText || '').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  let sawAny = false;

  const pushCell = () => { row.push(cell.trim()); cell = ''; };
  const pushRow = () => {
    pushCell();
    if (row.some(v => String(v || '').trim())) rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    sawAny = true;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else { cell += ch; }
      continue;
    }
    if (ch === '"' && cell.trim() === '') { inQuotes = true; continue; }
    if (ch === ',' || ch === ';' || ch === '\t') { pushCell(); continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      pushRow();
      continue;
    }
    cell += ch;
  }
  if (sawAny && (cell.length || row.length)) pushRow();
  if (!rows.length) return { headers: [], rows: [] };
  return {
    headers: rows[0].map(h => String(h || '').replace(/^﻿/, '').trim()),
    rows: rows.slice(1)
  };
}

function buildSuggestedMapping(headers) {
  const normalized = headers.map(normalizeHeader);
  const mapping = {};
  const used = new Set();
  SQL_COLUMNS.forEach(col => {
    const candidates = [col.label, ...(col.aliases || [])].map(normalizeHeader).filter(Boolean);
    let found = -1;
    for (const cand of candidates) {
      found = normalized.findIndex((h, i) => !used.has(i) && h === cand);
      if (found !== -1) break;
    }
    if (found === -1) {
      for (const cand of candidates) {
        if (cand.length < 3) continue;
        found = normalized.findIndex((h, i) => !used.has(i) && h && h.includes(cand));
        if (found !== -1) break;
      }
    }
    if (found !== -1) { mapping[col.key] = found; used.add(found); }
  });
  return mapping;
}

function resolveMapping(headers, mappingOverride) {
  if (!mappingOverride || typeof mappingOverride !== 'object') return buildSuggestedMapping(headers);
  const resolved = {};
  SQL_COLUMNS.forEach(col => {
    const raw = mappingOverride[col.key];
    if (raw == null || raw === '' || raw === -1 || raw === '-1') return;
    const idx = Number.isInteger(raw) ? raw : parseInt(String(raw), 10);
    if (Number.isInteger(idx) && idx >= 0 && idx < headers.length) resolved[col.key] = idx;
  });
  return Object.keys(resolved).length ? resolved : buildSuggestedMapping(headers);
}

function rowToRecord(csvRow, mapping) {
  const record = {};
  SQL_COLUMNS.forEach(col => {
    const idx = mapping[col.key];
    record[col.key] = (Number.isInteger(idx) && idx >= 0) ? String(csvRow[idx] ?? '').trim() : '';
  });
  return record;
}

function sqlRowToArabic(row) {
  const record = {};
  SQL_COLUMNS.forEach(col => { record[col.csvKey] = String(row[col.key] ?? ''); });
  return record;
}

function arabicToSqlRecord(arabicRecord) {
  const record = {};
  SQL_COLUMNS.forEach(col => { record[col.key] = String(arabicRecord[col.csvKey] ?? '').trim(); });
  return record;
}

export function createSeizedSqlStore(dbPath) {
  let db = null;

  function open() {
    if (db) return db;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode=WAL');
    const colDefs = SQL_COLUMNS.map(c => `${c.key} TEXT`).join(', ');
    db.exec(`CREATE TABLE IF NOT EXISTS seized_records (id INTEGER PRIMARY KEY AUTOINCREMENT, ${colDefs})`);
    return db;
  }

  function getAll() {
    const database = open();
    return database.prepare('SELECT * FROM seized_records ORDER BY id').all().map(sqlRowToArabic);
  }

  function getCount() {
    const database = open();
    const row = database.prepare('SELECT COUNT(*) AS cnt FROM seized_records').get();
    return Number(row?.cnt ?? 0);
  }

  function hasData() {
    try { return getCount() > 0; } catch { return false; }
  }

  function replaceAll(arabicRecords) {
    const database = open();
    const cols = SQL_COLUMNS.map(c => c.key).join(', ');
    const placeholders = SQL_COLUMNS.map(() => '?').join(', ');
    const insertStmt = database.prepare(`INSERT INTO seized_records (${cols}) VALUES (${placeholders})`);
    const clearStmt = database.prepare('DELETE FROM seized_records');
    database.exec('BEGIN');
    try {
      clearStmt.run();
      for (const rec of arabicRecords) {
        const r = arabicToSqlRecord(rec);
        insertStmt.run(...SQL_COLUMNS.map(c => r[c.key] ?? ''));
      }
      database.exec('COMMIT');
    } catch (err) {
      try { database.exec('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }
  }

  function getSchema() {
    return {
      columns: SQL_COLUMNS.map(c => ({ key: c.key, label: c.label, required: c.required || false }))
    };
  }

  function getStats() {
    try { return { totalRows: getCount() }; } catch { return { totalRows: 0 }; }
  }

  function previewImport(csvText, mappingOverride = null) {
    const { headers, rows } = parseCsvText(csvText);
    const suggestedMapping = buildSuggestedMapping(headers);
    const mapping = resolveMapping(headers, mappingOverride);
    const mappedPreview = rows.slice(0, 5).map(row => rowToRecord(row, mapping));
    return { headers, totalRows: rows.length, suggestedMapping, mappedPreview };
  }

  function replaceFromCsvText(csvText, options = {}) {
    const { mapping: mappingOverride = null, backup = false } = options;
    const { headers, rows } = parseCsvText(csvText);
    const mapping = resolveMapping(headers, mappingOverride);
    const arabicRecords = rows
      .map(row => {
        const r = rowToRecord(row, mapping);
        const arabic = {};
        SQL_COLUMNS.forEach(c => { arabic[c.csvKey] = r[c.key]; });
        return arabic;
      })
      .filter(r => SQL_COLUMNS.some(c => String(r[c.csvKey] || '').trim()));

    let backupPath = null;
    if (backup && fs.existsSync(dbPath)) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      backupPath = dbPath.replace(/\.db$/, '') + `_backup_${ts}.db`;
      try { fs.copyFileSync(dbPath, backupPath); } catch { backupPath = null; }
    }

    replaceAll(arabicRecords);
    return { importedRows: arabicRecords.length, sourceRows: rows.length, backupPath };
  }

  function close() {
    if (db) { try { db.close(); } catch { /* ignore */ } db = null; }
  }

  return { getAll, hasData, replaceAll, getSchema, getStats, previewImport, replaceFromCsvText, close };
}
