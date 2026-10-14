const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const SQL_COLUMNS = [
  { key: 'license_number', label: 'رقم', aliases: ['رقم', 'رقم القيد', 'license', 'license number'] },
  { key: 'license_type', label: 'نوع الرخصة', aliases: ['نوع الرخصة', 'نوع الترخيص', 'license type'] },
  { key: 'name', label: 'الاسم', aliases: ['الاسم', 'اسم', 'name'] },
  { key: 'address', label: 'العنوان', aliases: ['العنوان', 'address'] },
  { key: 'weapon_details', label: 'بيانات السلاح', aliases: ['بيانات السلاح', 'بيان السلاح', 'السلاح', 'weapon'] },
  { key: 'cancel_decision_date', label: 'تاريخ قرار الالغاء', aliases: ['تاريخ قرار الالغاء', 'تاريخ قرار اللغاء', 'تاريخ قرار الإلغاء'] },
  { key: 'cancel_reason', label: 'سبب الالغاء', aliases: ['سبب الالغاء', 'سبب الإلغاء'] },
  { key: 'station', label: 'القسم التابع', aliases: ['القسم التابع', 'القسم'] },
  { key: 'sector', label: 'القطاع', aliases: ['القطاع', 'نوع القاطع', 'sector'] },
  { key: 'pieces_count', label: 'عدد القطع', aliases: ['عدد القطع', 'عدد الاسلحة', 'عدد الأسلحة'] },
  { key: 'deposit_number', label: 'رقم الايداع', aliases: ['رقم الايداع', 'رقم الإيداع'] },
  { key: 'deposit_date', label: 'تاريخ الايداع', aliases: ['تاريخ الايداع', 'تاريخ الإيداع'] },
  { key: 'notes', label: 'ملاحظات', aliases: ['ملاحظات', 'ملاحظة', 'notes'] },
  { key: 'withdraw_status', label: 'حالة السحب', aliases: ['حالة السحب', 'status'] }
];

const SQL_FIELD_KEYS = SQL_COLUMNS.map((column) => column.key);
const DEFAULT_HEADERS = SQL_COLUMNS.map((column) => column.label);
const WITHDRAW_TAG_RE = /\s*\(\s*(?:ال)?مسحوب\s*\)\s*/g;
const WEAPON_SEPARATOR_RE = /\s*\+\s*/;
const EXPLICIT_DEPOSIT_SEPARATOR_RE = /[ \t]*\|[ \t]*|[ \t]*\+[ \t]*|\r?\n/;
const EXPLICIT_DEPOSIT_SEPARATOR_DETECT_RE = /[|+\r\n]/;
const DEPOSIT_DIGIT_CLASS = '0-9\\u0660-\\u0669\\u06F0-\\u06F9';
const DEPOSIT_LETTER_CLASS = 'A-Za-z\\u0621-\\u064A';
const DEPOSIT_STRONG_TOKEN_RE = new RegExp(`[${DEPOSIT_DIGIT_CLASS}]{1,6}\\s*[/\\\\]\\s*[${DEPOSIT_LETTER_CLASS}]+`, 'g');
const DEPOSIT_LOOSE_TOKEN_RE = new RegExp(`[${DEPOSIT_DIGIT_CLASS}]{1,6}\\s*(?:[/\\\\]\\s*[${DEPOSIT_LETTER_CLASS}]+|[${DEPOSIT_LETTER_CLASS}]+)?`, 'g');
const DEPOSIT_DATE_TOKEN_RE = new RegExp(`[${DEPOSIT_DIGIT_CLASS}]{1,4}\\s*[/\\-]\\s*[${DEPOSIT_DIGIT_CLASS}]{1,2}\\s*[/\\-]\\s*[${DEPOSIT_DIGIT_CLASS}]{1,4}`, 'g');
const TRAILING_WAW_TOKEN_RE = new RegExp(`^[${DEPOSIT_DIGIT_CLASS}]+\\u0648$`);
const LEADING_DIGIT_RE = new RegExp(`^[${DEPOSIT_DIGIT_CLASS}]`);

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeHeaderValue(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/[⇅↑↓↕⇧▼▲]/g, '')
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeWeaponKey(value) {
  return String(value || '')
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06F0))
    .replace(WITHDRAW_TAG_RE, ' ')
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeIdentityName(value) {
  return String(value || '')
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeIdentityLicense(value) {
  return String(value || '')
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06F0))
    .replace(/[^0-9a-zA-Z]/g, '')
    .toLowerCase();
}

function stripWithdrawTag(value) {
  return String(value || '')
    .replace(WITHDRAW_TAG_RE, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s*\+\s*/g, ' + ')
    .replace(/(\+\s*){2,}/g, ' + ')
    .replace(/^(\s*\+\s*)+/, '')
    .replace(/(\s*\+\s*)+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function splitWeaponSegments(value) {
  return String(value || '')
    .split(WEAPON_SEPARATOR_RE)
    .map((part) => String(part || '').trim())
    .filter(Boolean);
}

function splitExplicitDepositField(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  if (!EXPLICIT_DEPOSIT_SEPARATOR_DETECT_RE.test(text)) return [text];
  return text.split(EXPLICIT_DEPOSIT_SEPARATOR_RE).map((part) => String(part || '').trim());
}

function normalizeDepositNumberToken(raw, nextChar = '') {
  let token = String(raw || '')
    .trim()
    .replace(/\s*([/\\])\s*/g, '$1')
    .replace(/\s+/g, '');
  if (TRAILING_WAW_TOKEN_RE.test(token) && LEADING_DIGIT_RE.test(String(nextChar || ''))) {
    token = token.slice(0, -1);
  }
  return token;
}

function collectDepositTokenMatches(text, regex) {
  const matches = [];
  regex.lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const nextChar = text.charAt(match.index + raw.length);
    const token = normalizeDepositNumberToken(raw, nextChar);
    if (token) matches.push({ raw, index: match.index, token });
  }
  return matches;
}

function residueWithoutTokenMatches(text, matches) {
  let residue = '';
  let cursor = 0;
  matches.forEach((match) => {
    residue += text.slice(cursor, match.index);
    cursor = match.index + String(match.raw || '').length;
  });
  residue += text.slice(cursor);
  return residue.replace(/[,\s،;؛+|/\\\-–—]+/g, '').trim();
}

function extractDepositNumberTokens(text) {
  const source = String(text || '').trim();
  if (!source) return [];
  const strongMatches = collectDepositTokenMatches(source, DEPOSIT_STRONG_TOKEN_RE);
  if (strongMatches.length > 1) return strongMatches.map((match) => match.token);

  const looseMatches = collectDepositTokenMatches(source, DEPOSIT_LOOSE_TOKEN_RE);
  if (looseMatches.length <= 1) return [];
  if (residueWithoutTokenMatches(source, looseMatches)) return [];
  return looseMatches.map((match) => match.token);
}

function splitDepositNumberField(value) {
  const explicitParts = splitExplicitDepositField(value);
  if (explicitParts.length !== 1) return explicitParts;
  const text = explicitParts[0] || '';
  const tokens = extractDepositNumberTokens(text);
  return tokens.length > 1 ? tokens : explicitParts;
}

function splitDepositDateField(value) {
  const explicitParts = splitExplicitDepositField(value);
  if (explicitParts.length !== 1) return explicitParts;
  const text = explicitParts[0] || '';
  DEPOSIT_DATE_TOKEN_RE.lastIndex = 0;
  const tokens = [];
  let match;
  while ((match = DEPOSIT_DATE_TOKEN_RE.exec(text)) !== null) {
    tokens.push(String(match[0] || '').replace(/\s*([/-])\s*/g, '$1').trim());
  }
  return tokens.length > 1 ? tokens : explicitParts;
}

function getPerWeaponFieldValue(parts, index) {
  const list = Array.isArray(parts) ? parts : [];
  if (index < 0 || index >= list.length) return '';
  return list[index] || '';
}

function joinPerWeaponFieldValues(values) {
  const list = (Array.isArray(values) ? values : []).map((value) => String(value || '').trim());
  let end = list.length;
  while (end > 0 && !list[end - 1]) end--;
  return list.slice(0, end).join(' + ');
}

function statusMeansFullWithdrawal(value) {
  return String(value || '').trim().replace(/\s+/g, ' ') === 'مسحوب';
}

function statusMeansNotWithdrawn(value) {
  const text = String(value || '').trim();
  return text.includes('غير مسحوب') || text.includes('لم يتم');
}

function deriveWithdrawStatusFromEntries(entries) {
  const list = (Array.isArray(entries) ? entries : []).filter((entry) => String(entry && entry.name || '').trim());
  if (!list.length) return '';
  const withdrawnCount = list.filter((entry) => !!entry.withdrawn).length;
  if (withdrawnCount === list.length) return 'مسحوب';
  if (withdrawnCount > 0) return 'مسحوب جزئي';
  return '';
}

function createPublicError(statusCode, message, code = '') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.publicMessage = message;
  if (code) error.code = code;
  return error;
}

function parseWeaponEntriesForStorage(weaponDetails, withdrawStatus, previousByName = null) {
  const segments = splitWeaponSegments(weaponDetails);
  const source = segments.length ? segments : (stripWithdrawTag(weaponDetails) ? [String(weaponDetails || '')] : []);
  const fullWithdrawal = statusMeansFullWithdrawal(withdrawStatus);
  const forceNotWithdrawn = statusMeansNotWithdrawn(withdrawStatus);

  return source.map((segment, index) => {
    const raw = String(segment || '').trim();
    const name = stripWithdrawTag(raw);
    if (!name) return null;
    const key = normalizeWeaponKey(name);
    const explicitWithdrawn = WITHDRAW_TAG_RE.test(raw);
    WITHDRAW_TAG_RE.lastIndex = 0;
    let withdrawn = explicitWithdrawn || fullWithdrawal;
    if (forceNotWithdrawn) withdrawn = false;
    if (!explicitWithdrawn && !fullWithdrawal && !forceNotWithdrawn && previousByName && previousByName.has(key)) {
      withdrawn = !!previousByName.get(key);
    }
    return { index, name, withdrawn };
  }).filter(Boolean);
}

function cleanWeaponDetailsText(weaponDetails) {
  const entries = parseWeaponEntriesForStorage(weaponDetails, '');
  if (entries.length) return entries.map((entry) => entry.name).join(' + ');
  return stripWithdrawTag(weaponDetails);
}

function formatWeaponDetailsForProjection(entries, fallback, options = {}) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return stripWithdrawTag(fallback);
  return list.map((entry) => {
    const name = String(entry && entry.name || '').trim();
    if (!name) return '';
    return entry.withdrawn ? `${name} (مسحوب)` : name;
  }).filter(Boolean).join(' + ');
}

function parseCsvText(csvText) {
  const input = String(csvText || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  let sawAny = false;

  const pushCell = () => {
    row.push(cell.trim());
    cell = '';
  };
  const pushRow = () => {
    pushCell();
    if (row.some((value) => String(value || '').trim() !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    sawAny = true;

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"' && cell.trim() === '') {
      inQuotes = true;
      continue;
    }
    if (ch === ',' || ch === ';' || ch === '\t') {
      pushCell();
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && input[i + 1] === '\n') i += 1;
      pushRow();
      continue;
    }
    cell += ch;
  }

  if (sawAny && (cell.length || row.length)) pushRow();

  if (!rows.length) return { headers: [], rows: [] };
  return {
    headers: rows[0].map((header) => String(header || '').replace(/^\uFEFF/, '').trim()),
    rows: rows.slice(1)
  };
}

function stringifyCsv(headers, rows) {
  const escapeCell = (value) => {
    const text = value == null ? '' : String(value).replace(/\r?\n/g, ' ');
    if (text === '') return '';
    if (/[",;\t\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const lines = [];
  lines.push((headers && headers.length ? headers : DEFAULT_HEADERS).map(escapeCell).join(','));
  for (const row of Array.isArray(rows) ? rows : []) {
    lines.push((Array.isArray(row) ? row : []).map(escapeCell).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}`;
}

function buildSuggestedMapping(headers) {
  const normalizedHeaders = (Array.isArray(headers) ? headers : []).map(normalizeHeaderValue);
  const mapping = {};
  const usedIndexes = new Set();

  SQL_COLUMNS.forEach((column) => {
    const candidates = [column.label, ...(column.aliases || [])].map(normalizeHeaderValue).filter(Boolean);
    let found = -1;
    for (const candidate of candidates) {
      found = normalizedHeaders.findIndex((header, index) => !usedIndexes.has(index) && header === candidate);
      if (found !== -1) break;
    }
    if (found === -1) {
      for (const candidate of candidates) {
        if (candidate.length < 4) continue;
        found = normalizedHeaders.findIndex((header, index) => {
          if (usedIndexes.has(index) || !header || header.length < 4) return false;
          return header.includes(candidate);
        });
        if (found !== -1) break;
      }
    }
    if (found !== -1) {
      mapping[column.key] = found;
      usedIndexes.add(found);
    }
  });

  return mapping;
}

function resolveMapping(headers, mapping) {
  if (!mapping || typeof mapping !== 'object') return buildSuggestedMapping(headers);
  const resolved = {};
  const headerList = Array.isArray(headers) ? headers : [];
  const normalizedHeaders = headerList.map(normalizeHeaderValue);

  SQL_COLUMNS.forEach((column) => {
    const raw = mapping[column.key];
    if (raw == null || raw === '' || raw === -1 || raw === '-1') return;
    let index = Number.isInteger(raw) ? raw : Number(String(raw));
    if (!Number.isInteger(index)) {
      const normalized = normalizeHeaderValue(raw);
      index = normalizedHeaders.findIndex((header) => header === normalized);
    }
    if (Number.isInteger(index) && index >= 0 && index < headerList.length) {
      resolved[column.key] = index;
    }
  });

  return resolved;
}

function recordFromRow(row, headers, mapping) {
  const safeRow = Array.isArray(row) ? row : [];
  const record = {};
  const usedIndexes = new Set();
  SQL_COLUMNS.forEach((column) => {
    const index = mapping[column.key];
    usedIndexes.add(index);
    record[column.key] = Number.isInteger(index) && index >= 0
      ? String(safeRow[index] ?? '').trim()
      : '';
  });

  const extra = {};
  (Array.isArray(headers) ? headers : []).forEach((header, index) => {
    const cleanHeader = String(header || '').trim();
    if (!cleanHeader || usedIndexes.has(index)) return;
    const value = String(safeRow[index] ?? '').trim();
    if (value) extra[cleanHeader] = value;
  });
  record.extra_json = JSON.stringify(extra);
  return record;
}

function recordFromObject(rowObject) {
  const source = rowObject && typeof rowObject === 'object' ? rowObject : {};
  const normalizedEntries = new Map(
    Object.keys(source).map((key) => [normalizeHeaderValue(key), source[key]])
  );
  const record = {};
  SQL_COLUMNS.forEach((column) => {
    const candidates = [column.label, ...(column.aliases || []), column.key].map(normalizeHeaderValue);
    let value = '';
    for (const candidate of candidates) {
      if (normalizedEntries.has(candidate)) {
        value = normalizedEntries.get(candidate);
        break;
      }
    }
    record[column.key] = String(value ?? '').trim();
  });
  record.extra_json = '{}';
  return record;
}

function createWeaponsSqlStore({ dbPath, csvPath, clearCsvCache } = {}) {
  if (!dbPath) throw new Error('dbPath is required');
  if (!csvPath) throw new Error('csvPath is required');

  let db = null;

  function getDb() {
    if (db) return db;
    ensureDirSync(path.dirname(dbPath));
    db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA busy_timeout = 5000');
    db.exec('PRAGMA foreign_keys = ON');
    ensureSchema();
    migrateDepositColumns();
    // No implicit legacy CSV import in the public demo.
    repairExistingWeaponDepositRows();
    return db;
  }

  function migrateDepositColumns() {
    try { db.exec("ALTER TABLE weapons_record_weapons ADD COLUMN deposit_number TEXT DEFAULT ''"); } catch (_) {}
    try { db.exec("ALTER TABLE weapons_record_weapons ADD COLUMN deposit_date TEXT DEFAULT ''"); } catch (_) {}

    const undeposited = Number(db.prepare(`
      SELECT COUNT(*) AS count
      FROM weapons_record_weapons w
      JOIN weapons_records r ON r.id = w.record_id
      WHERE COALESCE(w.deposit_number, '') = ''
        AND COALESCE(w.deposit_date, '') = ''
        AND (COALESCE(r.deposit_number, '') != '' OR COALESCE(r.deposit_date, '') != '')
    `).get().count) || 0;
    if (undeposited === 0) return;

    const records = db.prepare(`
      SELECT id, deposit_number, deposit_date
      FROM weapons_records
      WHERE COALESCE(deposit_number, '') != '' OR COALESCE(deposit_date, '') != ''
      ORDER BY row_order ASC
    `).all();
    const selectWeapons = db.prepare(`
      SELECT weapon_index FROM weapons_record_weapons
      WHERE record_id = ?
      ORDER BY weapon_index ASC
    `);
    const updateWeapon = db.prepare(`
      UPDATE weapons_record_weapons
      SET deposit_number = ?, deposit_date = ?, updated_at = ?
      WHERE record_id = ? AND weapon_index = ?
    `);
    const now = Date.now();
    db.exec('BEGIN IMMEDIATE');
    try {
      records.forEach((record) => {
        const depositNumbers = splitDepositNumberField(record.deposit_number);
        const depositDates = splitDepositDateField(record.deposit_date);
        if (!depositNumbers.length && !depositDates.length) return;
        const weapons = selectWeapons.all(record.id);
        weapons.forEach((weapon) => {
          const idx = Number(weapon.weapon_index);
          const depositNum = getPerWeaponFieldValue(depositNumbers, idx);
          const depositDate = getPerWeaponFieldValue(depositDates, idx);
          updateWeapon.run(depositNum, depositDate, now, record.id, idx);
        });
      });
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function ensureSchema() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS weapons_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        row_order INTEGER NOT NULL,
        license_number TEXT DEFAULT '',
        license_type TEXT DEFAULT '',
        name TEXT DEFAULT '',
        address TEXT DEFAULT '',
        weapon_details TEXT DEFAULT '',
        cancel_decision_date TEXT DEFAULT '',
        cancel_reason TEXT DEFAULT '',
        station TEXT DEFAULT '',
        sector TEXT DEFAULT '',
        pieces_count TEXT DEFAULT '',
        deposit_number TEXT DEFAULT '',
        deposit_date TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        withdraw_status TEXT DEFAULT '',
        extra_json TEXT DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_weapons_records_license_name
        ON weapons_records(license_number, name);
      CREATE INDEX IF NOT EXISTS idx_weapons_records_station_sector
        ON weapons_records(station, sector);
      CREATE TABLE IF NOT EXISTS weapons_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS weapons_record_weapons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        weapon_index INTEGER NOT NULL,
        name TEXT NOT NULL,
        withdrawn INTEGER NOT NULL DEFAULT 0,
        deposit_number TEXT DEFAULT '',
        deposit_date TEXT DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(record_id) REFERENCES weapons_records(id) ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_weapons_record_weapons_record_index
        ON weapons_record_weapons(record_id, weapon_index);
      CREATE TABLE IF NOT EXISTS weapons_import_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        imported_at TEXT NOT NULL,
        source_rows INTEGER NOT NULL,
        imported_rows INTEGER NOT NULL,
        mapping_json TEXT NOT NULL,
        backup_csv_path TEXT DEFAULT ''
      );
    `);
  }

  function migrateCsvIfNeeded() {
    const count = Number(db.prepare('SELECT COUNT(*) AS count FROM weapons_records').get().count) || 0;
    if (count > 0) {
      backfillWeaponRowsIfNeeded();
      return;
    }
    if (fs.existsSync(csvPath)) {
      const csvText = fs.readFileSync(csvPath, 'utf8');
      const parsed = parseCsvText(csvText);
      if (parsed.headers.length) {
        const mapping = buildSuggestedMapping(parsed.headers);
        replaceParsedRows(parsed.headers, parsed.rows, mapping, { skipMirror: true });
        syncCsvMirror();
        return;
      }
    }
    syncCsvMirror();
  }

  function backfillWeaponRowsIfNeeded() {
    const weaponCount = Number(db.prepare('SELECT COUNT(*) AS count FROM weapons_record_weapons').get().count) || 0;
    if (weaponCount > 0) return;
    const records = db.prepare('SELECT id, weapon_details, withdraw_status, deposit_number, deposit_date FROM weapons_records ORDER BY row_order ASC, id ASC').all();
    const insertWeapon = db.prepare(`
      INSERT INTO weapons_record_weapons(record_id, weapon_index, name, withdrawn, deposit_number, deposit_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = Date.now();
    db.exec('BEGIN IMMEDIATE');
    try {
      records.forEach((record) => {
        const entries = parseWeaponEntriesForStorage(record.weapon_details, record.withdraw_status);
        const depositNumbers = splitDepositNumberField(record.deposit_number);
        const depositDates = splitDepositDateField(record.deposit_date);
        entries.forEach((entry) => {
          const depositNum = getPerWeaponFieldValue(depositNumbers, entry.index);
          const depositDate = getPerWeaponFieldValue(depositDates, entry.index);
          insertWeapon.run(record.id, entry.index, entry.name, entry.withdrawn ? 1 : 0, depositNum, depositDate, now, now);
        });
      });
      db.exec('COMMIT');
      syncCsvMirror();
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function loadExistingWeaponStateMap(database) {
    const rows = database.prepare(`
      SELECT r.row_order, w.name, w.withdrawn
      FROM weapons_record_weapons w
      JOIN weapons_records r ON r.id = w.record_id
      ORDER BY r.row_order ASC, w.weapon_index ASC
    `).all();
    const byRowOrder = new Map();
    rows.forEach((row) => {
      const rowOrder = Number(row.row_order);
      const key = normalizeWeaponKey(row.name);
      if (!Number.isInteger(rowOrder) || !key) return;
      if (!byRowOrder.has(rowOrder)) byRowOrder.set(rowOrder, new Map());
      byRowOrder.get(rowOrder).set(key, !!row.withdrawn);
    });
    return byRowOrder;
  }

  function insertWeaponEntries(database, recordId, record, rowOrder, previousStateByRowOrder, now) {
    const previousByName = previousStateByRowOrder instanceof Map
      ? previousStateByRowOrder.get(rowOrder)
      : null;
    const weaponDetailsSource = Object.prototype.hasOwnProperty.call(record, '_weapon_details_source')
      ? record._weapon_details_source
      : record.weapon_details;
    const entries = parseWeaponEntriesForStorage(weaponDetailsSource, record.withdraw_status, previousByName);
    if (!entries.length) return;
    const depositNumbers = splitDepositNumberField(record.deposit_number);
    const depositDates = splitDepositDateField(record.deposit_date);
    const insertWeapon = database.prepare(`
      INSERT INTO weapons_record_weapons(record_id, weapon_index, name, withdrawn, deposit_number, deposit_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    entries.forEach((entry) => {
      const depositNum = getPerWeaponFieldValue(depositNumbers, entry.index);
      const depositDate = getPerWeaponFieldValue(depositDates, entry.index);
      insertWeapon.run(recordId, entry.index, entry.name, entry.withdrawn ? 1 : 0, depositNum, depositDate, now, now);
    });
  }

  function loadWeaponRowsByRecordId(database) {
    const weaponRows = database.prepare(`
      SELECT record_id, weapon_index, name, withdrawn, deposit_number, deposit_date
      FROM weapons_record_weapons
      ORDER BY record_id ASC, weapon_index ASC
    `).all();
    const byRecordId = new Map();
    weaponRows.forEach((row) => {
      const recordId = Number(row.record_id);
      if (!byRecordId.has(recordId)) byRecordId.set(recordId, []);
      byRecordId.get(recordId).push({
        index: Number(row.weapon_index) || 0,
        name: String(row.name || '').trim(),
        withdrawn: !!row.withdrawn,
        depositNumber: String(row.deposit_number || '').trim(),
        depositDate: String(row.deposit_date || '').trim()
      });
    });
    return byRecordId;
  }

  function getRecordByRowIndex(database, rowIndex) {
    const numericIndex = Number(rowIndex);
    if (!Number.isInteger(numericIndex) || numericIndex < 0) {
      throw createPublicError(400, 'رقم السجل غير صحيح', 'bad-row-index');
    }
    const rowOrder = numericIndex + 1;
    const record = database.prepare(`
      SELECT id, row_order, updated_at, ${SQL_FIELD_KEYS.join(', ')}
      FROM weapons_records
      WHERE row_order = ?
      ORDER BY id ASC
      LIMIT 1
    `).get(rowOrder);
    if (!record) {
      throw createPublicError(404, 'تعذر العثور على السجل المطلوب', 'record-not-found');
    }
    return record;
  }

  function getRecordById(database, recordId) {
    const numericId = Number(recordId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw createPublicError(400, 'رقم السجل غير صحيح', 'bad-record-id');
    }
    const record = database.prepare(`
      SELECT id, row_order, updated_at, ${SQL_FIELD_KEYS.join(', ')}
      FROM weapons_records
      WHERE id = ?
      LIMIT 1
    `).get(numericId);
    if (!record) {
      throw createPublicError(404, 'تعذر العثور على السجل المطلوب', 'record-not-found');
    }
    return record;
  }

  function getRecordForWeaponMutation(database, options = {}) {
    const recordId = Number(options.recordId);
    if (Number.isInteger(recordId) && recordId > 0) {
      return getRecordById(database, recordId);
    }
    return getRecordByRowIndex(database, options.rowIndex);
  }

  function assertRecordIdentity(record, options = {}) {
    const license = String(options.license || '').trim();
    const name = String(options.name || '').trim();
    const rowLicense = String(record.license_number || '').trim();
    const rowName = String(record.name || '').trim();
    if (license && rowLicense && normalizeIdentityLicense(license) !== normalizeIdentityLicense(rowLicense)) {
      throw createPublicError(409, 'تم تعديل السجل. حدّث الصفحة وحاول مرة أخرى.', 'record-conflict');
    }
    if (name && rowName && normalizeIdentityName(name) !== normalizeIdentityName(rowName)) {
      throw createPublicError(409, 'تم تعديل السجل. حدّث الصفحة وحاول مرة أخرى.', 'record-conflict');
    }
  }

  function normalizeExpectedUpdatedAt(value) {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function assertRecordVersion(record, expectedUpdatedAt) {
    const expected = normalizeExpectedUpdatedAt(expectedUpdatedAt);
    if (expected == null) return;
    const actual = Number(record && record.updated_at) || 0;
    if (actual !== expected) {
      throw createPublicError(409, 'تم تعديل هذا السجل بواسطة مستخدم آخر. حدّث البيانات ثم حاول مرة أخرى.', 'record-conflict');
    }
  }

  function repairExistingWeaponDepositRows() {
    const rows = db.prepare(`
      SELECT
        r.id AS record_id,
        r.deposit_number AS record_deposit_number,
        r.deposit_date AS record_deposit_date,
        w.weapon_index,
        w.deposit_number AS weapon_deposit_number,
        w.deposit_date AS weapon_deposit_date
      FROM weapons_records r
      JOIN weapons_record_weapons w ON w.record_id = r.id
      WHERE COALESCE(r.deposit_number, '') != ''
      ORDER BY r.id ASC, w.weapon_index ASC, w.id ASC
    `).all();
    const byRecord = new Map();
    rows.forEach((row) => {
      const id = Number(row.record_id);
      if (!byRecord.has(id)) {
        byRecord.set(id, {
          id,
          depositNumber: String(row.record_deposit_number || '').trim(),
          depositDate: String(row.record_deposit_date || '').trim(),
          weapons: []
        });
      }
      byRecord.get(id).weapons.push({
        index: Number(row.weapon_index) || 0,
        depositNumber: String(row.weapon_deposit_number || '').trim(),
        depositDate: String(row.weapon_deposit_date || '').trim()
      });
    });

    const updates = [];
    byRecord.forEach((record) => {
      if (record.weapons.length <= 1) return;
      const numberParts = splitDepositNumberField(record.depositNumber);
      if (numberParts.length <= 1) return;

      const currentNumbers = Array.from(new Set(
        record.weapons.map((weapon) => weapon.depositNumber).filter(Boolean)
      ));
      if (currentNumbers.length > 1) return;
      if (currentNumbers.length === 1 && currentNumbers[0] !== record.depositNumber) return;

      const dateParts = splitDepositDateField(record.depositDate);
      const shouldRepairDates = dateParts.length > 1;
      const nextWeapons = record.weapons.map((weapon) => {
        const idx = Number(weapon.index) || 0;
        return {
          index: idx,
          depositNumber: getPerWeaponFieldValue(numberParts, idx),
          depositDate: shouldRepairDates
            ? getPerWeaponFieldValue(dateParts, idx)
            : weapon.depositDate
        };
      });
      updates.push({
        recordId: record.id,
        weapons: nextWeapons,
        depositNumber: joinPerWeaponFieldValues(nextWeapons.map((weapon) => weapon.depositNumber)),
        depositDate: shouldRepairDates
          ? joinPerWeaponFieldValues(nextWeapons.map((weapon) => weapon.depositDate))
          : record.depositDate
      });
    });

    if (!updates.length) return;
    const now = Date.now();
    const updateWeapon = db.prepare(`
      UPDATE weapons_record_weapons
      SET deposit_number = ?, deposit_date = ?, updated_at = ?
      WHERE record_id = ? AND weapon_index = ?
    `);
    const updateRecord = db.prepare(`
      UPDATE weapons_records
      SET deposit_number = ?, deposit_date = ?, updated_at = ?
      WHERE id = ?
    `);
    db.exec('BEGIN IMMEDIATE');
    try {
      updates.forEach((record) => {
        record.weapons.forEach((weapon) => {
          updateWeapon.run(weapon.depositNumber, weapon.depositDate, now, record.recordId, weapon.index);
        });
        updateRecord.run(record.depositNumber, record.depositDate, now, record.recordId);
      });
      db.prepare('INSERT OR REPLACE INTO weapons_meta(key, value) VALUES (?, ?)').run('updated_at', String(now));
      db.exec('COMMIT');
      syncCsvMirror();
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function loadWeaponEntriesForRecord(database, record) {
    const rows = database.prepare(`
      SELECT weapon_index, name, withdrawn, deposit_number, deposit_date
      FROM weapons_record_weapons
      WHERE record_id = ?
      ORDER BY weapon_index ASC, id ASC
    `).all(record.id);
    if (rows.length) {
      return rows.map((row, index) => ({
        index,
        name: String(row.name || '').trim(),
        withdrawn: !!row.withdrawn,
        depositNumber: String(row.deposit_number || '').trim(),
        depositDate: String(row.deposit_date || '').trim()
      })).filter((entry) => entry.name);
    }
    const depositNumbers = splitDepositNumberField(record.deposit_number);
    const depositDates = splitDepositDateField(record.deposit_date);
    return parseWeaponEntriesForStorage(record.weapon_details, record.withdraw_status).map((entry, index) => ({
      index,
      name: entry.name,
      withdrawn: !!entry.withdrawn,
      depositNumber: getPerWeaponFieldValue(depositNumbers, index),
      depositDate: getPerWeaponFieldValue(depositDates, index)
    }));
  }

  function normalizeWeaponEntries(entries) {
    return (Array.isArray(entries) ? entries : [])
      .map((entry) => ({
        name: stripWithdrawTag(entry && entry.name),
        withdrawn: !!(entry && entry.withdrawn),
        depositNumber: String((entry && entry.depositNumber) || '').trim(),
        depositDate: String((entry && entry.depositDate) || '').trim()
      }))
      .filter((entry) => hasMeaningfulWeaponName(entry.name))
      .map((entry, index) => ({ ...entry, index }));
  }

  function hasMeaningfulWeaponName(name) {
    return !!String(name || '')
      .replace(/[()\[\]{}（）]/g, ' ')
      .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
      .replace(/\s+/g, '')
      .trim();
  }

  function resolveWeaponEntryIndex(entries, options = {}) {
    const weaponIndex = Number(options.weaponIndex);
    if (Number.isInteger(weaponIndex) && weaponIndex >= 0 && weaponIndex < entries.length) {
      return weaponIndex;
    }
    const targetKey = normalizeWeaponKey(options.weaponName);
    if (targetKey) {
      let index = entries.findIndex((entry) => normalizeWeaponKey(entry.name) === targetKey);
      if (index !== -1) return index;
      index = entries.findIndex((entry) => {
        const key = normalizeWeaponKey(entry.name);
        return key && (key.includes(targetKey) || targetKey.includes(key));
      });
      if (index !== -1) return index;
    }
    if (entries.length === 1) return 0;
    return -1;
  }

  function persistWeaponEntriesForRecord(database, record, entries, now = Date.now()) {
    const normalizedEntries = normalizeWeaponEntries(entries);
    const weaponDetails = normalizedEntries.map((entry) => entry.name).join(' + ');
    const statusValue = deriveWithdrawStatusFromEntries(normalizedEntries);
    const depositNumber = joinPerWeaponFieldValues(normalizedEntries.map((entry) => entry.depositNumber));
    const depositDate = joinPerWeaponFieldValues(normalizedEntries.map((entry) => entry.depositDate));
    const deleteWeapons = database.prepare('DELETE FROM weapons_record_weapons WHERE record_id = ?');
    const insertWeapon = database.prepare(`
      INSERT INTO weapons_record_weapons(record_id, weapon_index, name, withdrawn, deposit_number, deposit_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    deleteWeapons.run(record.id);
    normalizedEntries.forEach((entry, index) => {
      insertWeapon.run(record.id, index, entry.name, entry.withdrawn ? 1 : 0, entry.depositNumber || '', entry.depositDate || '', now, now);
    });
    database.prepare(`
      UPDATE weapons_records
      SET weapon_details = ?, withdraw_status = ?, deposit_number = ?, deposit_date = ?, updated_at = ?
      WHERE id = ?
    `).run(weaponDetails, statusValue, depositNumber, depositDate, now, record.id);
    database.prepare('INSERT OR REPLACE INTO weapons_meta(key, value) VALUES (?, ?)').run('updated_at', String(now));
    return buildWeaponMutationResponse(record, normalizedEntries, weaponDetails, statusValue, null, now);
  }

  function buildWeaponMutationResponse(record, entries, weaponDetails, statusValue, mirror = null, updatedAt = null) {
    const list = normalizeWeaponEntries(entries);
    return {
      recordId: Number(record.id) || null,
      rowIndex: Math.max(0, (Number(record.row_order) || 1) - 1),
      rowOrder: Number(record.row_order) || null,
      updatedAt: normalizeExpectedUpdatedAt(updatedAt) || normalizeExpectedUpdatedAt(record.updated_at) || null,
      weaponDetails,
      statusValue,
      totalWeapons: list.length,
      withdrawnCount: list.filter((entry) => entry.withdrawn).length,
      entries: list.map((entry, index) => ({
        index,
        name: entry.name,
        withdrawn: !!entry.withdrawn,
        depositNumber: entry.depositNumber || '',
        depositDate: entry.depositDate || ''
      })),
      mirror
    };
  }

  function mutateRecordWeapons(options, mutator) {
    const database = getDb();
    const now = Date.now();
    database.exec('BEGIN IMMEDIATE');
    try {
      const record = getRecordForWeaponMutation(database, options);
      assertRecordIdentity(record, options);
      assertRecordVersion(record, options.expectedUpdatedAt);
      const entries = normalizeWeaponEntries(loadWeaponEntriesForRecord(database, record));
      const nextEntries = mutator(entries, record);
      const result = persistWeaponEntriesForRecord(database, record, nextEntries, now);
      database.exec('COMMIT');
      const mirror = syncCsvMirror();
      return { ...result, mirror };
    } catch (error) {
      try { database.exec('ROLLBACK'); } catch (_) {}
      throw error;
    }
  }

  function setWeaponWithdrawal(options = {}) {
    const desiredWithdrawn = !!options.withdrawn;
    return mutateRecordWeapons(options, (entries) => {
      if (!entries.length) {
        throw createPublicError(400, 'لا توجد بيانات للسلاح في هذا السجل', 'no-weapons');
      }
      const index = resolveWeaponEntryIndex(entries, options);
      if (index === -1) {
        throw createPublicError(404, 'تعذر مطابقة اسم السلاح', 'weapon-not-found');
      }
      return entries.map((entry, entryIndex) => (
        entryIndex === index ? { ...entry, withdrawn: desiredWithdrawn } : entry
      ));
    });
  }

  function addWeaponToRecord(options = {}) {
    const cleanName = stripWithdrawTag(options.weaponName || options.newWeaponName || '');
    if (!hasMeaningfulWeaponName(cleanName)) {
      throw createPublicError(400, 'اسم السلاح المدخل غير صالح', 'bad-weapon-name');
    }
    return mutateRecordWeapons(options, (entries) => [
      ...entries,
      { name: cleanName, withdrawn: false }
    ]);
  }

  function editWeaponInRecord(options = {}) {
    const cleanName = stripWithdrawTag(options.newWeaponName || options.weaponName || '');
    if (!hasMeaningfulWeaponName(cleanName)) {
      throw createPublicError(400, 'اسم السلاح المدخل غير صالح', 'bad-weapon-name');
    }
    return mutateRecordWeapons(options, (entries) => {
      const index = resolveWeaponEntryIndex(entries, options);
      if (index === -1) {
        throw createPublicError(404, 'تعذر العثور على السلاح المطلوب', 'weapon-not-found');
      }
      return entries.map((entry, entryIndex) => (
        entryIndex === index ? { ...entry, name: cleanName } : entry
      ));
    });
  }

  function deleteWeaponFromRecord(options = {}) {
    return mutateRecordWeapons(options, (entries) => {
      const index = resolveWeaponEntryIndex(entries, options);
      if (index === -1) {
        throw createPublicError(404, 'تعذر العثور على السلاح المطلوب', 'weapon-not-found');
      }
      return entries.filter((_, entryIndex) => entryIndex !== index);
    });
  }

  function backupCurrentCsv(label = 'before-import') {
    const csvText = getCsvText();
    const backupDir = path.join(path.dirname(csvPath), 'import-backups');
    ensureDirSync(backupDir);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeLabel = String(label || 'backup').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 40);
    const backupPath = path.join(backupDir, `${safeLabel}-${stamp}.csv`);
    fs.writeFileSync(backupPath, csvText, 'utf8');
    return backupPath;
  }

  function deleteLegacyCsvFile() {
    try {
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    } catch (error) {
      console.warn('Could not remove legacy slah.csv (it may be open in Excel):', error && error.message);
    }
  }

  function syncCsvMirror() {
    // SQL is the sole source of truth — no live CSV mirror is written.
    deleteLegacyCsvFile();
    if (typeof clearCsvCache === 'function') clearCsvCache(csvPath);
    return { ok: true, skipped: true };
  }

  function replaceParsedRows(headers, rows, mapping, options = {}) {
    const database = getDb();
    const now = Date.now();
    const resolvedMapping = resolveMapping(headers, mapping);
    const previousStateByRowOrder = options.preserveExistingWeaponState === false
      ? null
      : loadExistingWeaponStateMap(database);
    const records = (Array.isArray(rows) ? rows : []).map((row) => {
      const record = recordFromRow(row, headers, resolvedMapping);
      record._weapon_details_source = record.weapon_details;
      record.weapon_details = cleanWeaponDetailsText(record.weapon_details);
      return record;
    });
    const insertSql = `
      INSERT INTO weapons_records (
        row_order, ${SQL_FIELD_KEYS.join(', ')}, extra_json, created_at, updated_at
      ) VALUES (
        ?, ${SQL_FIELD_KEYS.map(() => '?').join(', ')}, ?, ?, ?
      )
    `;
    const insert = database.prepare(insertSql);

    database.exec('BEGIN IMMEDIATE');
    try {
      database.exec('DELETE FROM weapons_records');
      records.forEach((record, index) => {
        const rowOrder = index + 1;
        insert.run(
          rowOrder,
          ...SQL_FIELD_KEYS.map((key) => record[key] || ''),
          record.extra_json || '{}',
          now,
          now
        );
        const recordId = Number(database.prepare('SELECT last_insert_rowid() AS id').get().id);
        insertWeaponEntries(database, recordId, record, rowOrder, previousStateByRowOrder, now);
      });
      database.prepare('INSERT OR REPLACE INTO weapons_meta(key, value) VALUES (?, ?)').run('updated_at', String(now));
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }

    const mirror = options.skipMirror ? { ok: true } : syncCsvMirror();
    return { importedRows: records.length, mapping: resolvedMapping, mirror };
  }

  function replaceFromCsvText(csvText, options = {}) {
    const parsed = parseCsvText(csvText);
    if (!parsed.headers.length) throw new Error('CSV has no header row');
    const backupPath = options.backup ? backupCurrentCsv(options.backupLabel || 'before-import') : '';
    const result = replaceParsedRows(parsed.headers, parsed.rows, options.mapping, options);
    if (options.logImport) {
      const database = getDb();
      database.prepare(`
        INSERT INTO weapons_import_history(imported_at, source_rows, imported_rows, mapping_json, backup_csv_path)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        new Date().toISOString(),
        parsed.rows.length,
        result.importedRows,
        JSON.stringify(result.mapping || {}),
        backupPath
      );
    }
    return { ...result, sourceRows: parsed.rows.length, backupPath };
  }

  function replaceFromRows(headers, rows, options = {}) {
    const headerList = Array.isArray(headers) && headers.length ? headers : DEFAULT_HEADERS;
    const mapping = buildSuggestedMapping(headerList);
    return replaceParsedRows(headerList, rows, mapping, options);
  }

  function appendRecordObject(rowObject) {
    const database = getDb();
    const now = Date.now();
    const record = recordFromObject(rowObject);
    record._weapon_details_source = record.weapon_details;
    record.weapon_details = cleanWeaponDetailsText(record.weapon_details);
    const nextOrder = Number(database.prepare('SELECT COALESCE(MAX(row_order), 0) + 1 AS nextOrder FROM weapons_records').get().nextOrder) || 1;
    database.prepare(`
      INSERT INTO weapons_records (
        row_order, ${SQL_FIELD_KEYS.join(', ')}, extra_json, created_at, updated_at
      ) VALUES (
        ?, ${SQL_FIELD_KEYS.map(() => '?').join(', ')}, ?, ?, ?
      )
    `).run(
      nextOrder,
      ...SQL_FIELD_KEYS.map((key) => record[key] || ''),
      record.extra_json || '{}',
      now,
      now
    );
    const recordId = Number(database.prepare('SELECT last_insert_rowid() AS id').get().id);
    insertWeaponEntries(database, recordId, record, nextOrder, null, now);
    database.prepare('INSERT OR REPLACE INTO weapons_meta(key, value) VALUES (?, ?)').run('updated_at', String(now));
    const mirror = syncCsvMirror();
    return { recordId, rowOrder: nextOrder, updatedAt: now, mirror };
  }

  const UPDATE_SKIP_KEYS = new Set(['weapon_details', 'withdraw_status']);
  const UPDATE_FIELD_KEYS = SQL_FIELD_KEYS.filter((key) => !UPDATE_SKIP_KEYS.has(key));

  function findRecordByIdentity(database, name, license) {
    const normName = normalizeIdentityName(name);
    const normLicense = normalizeIdentityLicense(license);
    if (!normName && !normLicense) return null;
    const allRecords = database.prepare('SELECT id, row_order, updated_at, name, license_number FROM weapons_records').all();
    return allRecords.find((r) => {
      const rName = normalizeIdentityName(r.name);
      const rLic = normalizeIdentityLicense(r.license_number);
      if (normName && normLicense) return rName === normName && rLic === normLicense;
      if (normName) return rName === normName;
      return rLic === normLicense;
    }) || null;
  }

  function updateRecord(rowObject) {
    const database = getDb();
    const record = recordFromObject(rowObject);
    const requestedId = Number(rowObject && rowObject.__recordId);
    const match = Number.isInteger(requestedId) && requestedId > 0
      ? database.prepare('SELECT id, row_order, updated_at, name, license_number FROM weapons_records WHERE id = ?').get(requestedId)
      : findRecordByIdentity(database, record.name, record.license_number);
    if (!match) {
      throw createPublicError(404, `لم يُعثر على السجل: ${record.name || ''} / ${record.license_number || ''}`, 'not-found');
    }
    assertRecordVersion(match, rowObject && rowObject.__updatedAt);
    const now = Date.now();
    database.prepare(
      `UPDATE weapons_records SET ${UPDATE_FIELD_KEYS.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`
    ).run(...UPDATE_FIELD_KEYS.map((k) => record[k] || ''), now, match.id);

    const depositNumbers = splitDepositNumberField(record.deposit_number);
    const depositDates = splitDepositDateField(record.deposit_date);
    const weapons = database.prepare(
      'SELECT weapon_index FROM weapons_record_weapons WHERE record_id = ? ORDER BY weapon_index ASC'
    ).all(match.id);
    if (weapons.length) {
      const updateWeapon = database.prepare(
        'UPDATE weapons_record_weapons SET deposit_number = ?, deposit_date = ?, updated_at = ? WHERE record_id = ? AND weapon_index = ?'
      );
      weapons.forEach((weapon) => {
        const idx = Number(weapon.weapon_index);
        const depositNum = getPerWeaponFieldValue(depositNumbers, idx);
        const depositDate = getPerWeaponFieldValue(depositDates, idx);
        updateWeapon.run(depositNum, depositDate, now, match.id, idx);
      });
    }

    database.prepare('INSERT OR REPLACE INTO weapons_meta(key, value) VALUES (?, ?)').run('updated_at', String(now));
    const mirror = syncCsvMirror();
    return { id: match.id, rowOrder: match.row_order, updatedAt: now, mirror };
  }

  function deleteRecords(identities) {
    if (!Array.isArray(identities) || !identities.length) return { deleted: 0 };
    const database = getDb();
    const idsToDelete = [];
    for (const ident of identities) {
      const requestedId = Number(ident && (ident.id ?? ident.recordId ?? ident.__recordId));
      if (Number.isInteger(requestedId) && requestedId > 0) {
        idsToDelete.push(requestedId);
        continue;
      }
      const match = findRecordByIdentity(database, ident && ident.name, ident && ident.license);
      if (match) idsToDelete.push(match.id);
    }
    if (!idsToDelete.length) return { deleted: 0 };
    const now = Date.now();
    database.exec('BEGIN IMMEDIATE');
    try {
      const stmt = database.prepare('DELETE FROM weapons_records WHERE id = ?');
      for (const id of idsToDelete) stmt.run(id);
      database.prepare('INSERT OR REPLACE INTO weapons_meta(key, value) VALUES (?, ?)').run('updated_at', String(now));
      database.exec('COMMIT');
    } catch (error) {
      try { database.exec('ROLLBACK'); } catch (_) {}
      throw error;
    }
    const mirror = syncCsvMirror();
    return { deleted: idsToDelete.length, mirror };
  }

  function getRecords(options = {}) {
    const database = getDb();
    const rows = database.prepare(`SELECT id, row_order, updated_at, ${SQL_FIELD_KEYS.join(', ')} FROM weapons_records ORDER BY row_order ASC, id ASC`).all();
    const weaponsByRecordId = loadWeaponRowsByRecordId(database);
    const filterMode = options.withdrawnFilter === 'withdrawn' || options.withdrawnFilter === 'not_withdrawn'
      ? options.withdrawnFilter
      : null;
    const projected = [];
    rows.forEach((row) => {
      const allEntries = weaponsByRecordId.get(Number(row.id)) || [];
      let entries = allEntries;
      if (filterMode === 'withdrawn') entries = allEntries.filter((entry) => entry.withdrawn);
      else if (filterMode === 'not_withdrawn') entries = allEntries.filter((entry) => !entry.withdrawn);
      if (filterMode && !entries.length) return;
      const joinPerWeaponProjectionField = (key, fallback) => {
        const values = entries.map((entry) => String(entry && entry[key] || '').trim());
        if (values.some(Boolean)) {
          let end = values.length;
          while (end > 0 && !values[end - 1]) end--;
          return values.slice(0, end).join(' + ');
        }
        return fallback == null ? '' : String(fallback);
      };
      const values = SQL_FIELD_KEYS.map((key) => {
        if (key === 'weapon_details') {
          return formatWeaponDetailsForProjection(entries, row.weapon_details, options);
        }
        if (key === 'withdraw_status') {
          return allEntries.length ? deriveWithdrawStatusFromEntries(allEntries) : (row[key] == null ? '' : String(row[key]));
        }
        if (key === 'deposit_number') {
          return joinPerWeaponProjectionField('depositNumber', row[key]);
        }
        if (key === 'deposit_date') {
          return joinPerWeaponProjectionField('depositDate', row[key]);
        }
        return row[key] == null ? '' : String(row[key]);
      });
      projected.push({
        row: values,
        meta: {
          id: Number(row.id) || null,
          rowOrder: Number(row.row_order) || null,
          rowIndex: Math.max(0, (Number(row.row_order) || 1) - 1),
          updatedAt: Number(row.updated_at) || 0
        }
      });
    });
    return {
      headers: DEFAULT_HEADERS.slice(),
      rows: projected.map((item) => item.row),
      meta: projected.map((item) => item.meta)
    };
  }

  function getRows(options = {}) {
    return getRecords(options).rows;
  }

  function findDuplicateRecordObject(rowObject) {
    const database = getDb();
    const record = recordFromObject(rowObject);
    const match = findRecordByIdentity(database, record.name, record.license_number);
    if (!match) return null;
    const records = getRecords();
    const metaIndex = (records.meta || []).findIndex((item) => Number(item && item.id) === Number(match.id));
    const row = metaIndex >= 0 ? records.rows[metaIndex] : null;
    if (!row) return null;
    const existingRow = {};
    DEFAULT_HEADERS.forEach((header, index) => {
      existingRow[header] = row[index] == null ? '' : String(row[index]);
    });
    return {
      headers: DEFAULT_HEADERS.slice(),
      row: existingRow,
      meta: records.meta[metaIndex] || null
    };
  }

  function getCsvText(options = {}) {
    return stringifyCsv(DEFAULT_HEADERS, getRows(options));
  }

  function getStats() {
    const database = getDb();
    const row = database.prepare(`
      SELECT
        COUNT(*) AS totalRows,
        COALESCE(MAX(updated_at), 0) AS updatedAtMs
      FROM weapons_records
    `).get();
    const updatedAtMs = Number(row.updatedAtMs) || 0;
    const totalRows = Number(row.totalRows) || 0;
    return {
      ok: true,
      version: `${totalRows}:${updatedAtMs}`,
      updatedAt: updatedAtMs ? new Date(updatedAtMs).toISOString() : null,
      size: 0,
      totalRows,
      headers: DEFAULT_HEADERS.slice()
    };
  }

  function previewImport(csvText, mapping) {
    const parsed = parseCsvText(csvText);
    if (!parsed.headers.length) {
      return {
        headers: [],
        totalRows: 0,
        sampleRows: [],
        suggestedMapping: {},
        mappedPreview: []
      };
    }
    const resolvedMapping = resolveMapping(parsed.headers, mapping || buildSuggestedMapping(parsed.headers));
    const sampleRows = parsed.rows.slice(0, 8);
    return {
      headers: parsed.headers,
      totalRows: parsed.rows.length,
      sampleRows,
      suggestedMapping: resolvedMapping,
      mappedPreview: sampleRows.map((row) => {
        const record = recordFromRow(row, parsed.headers, resolvedMapping);
        return Object.fromEntries(SQL_COLUMNS.map((column) => [column.key, record[column.key] || '']));
      })
    };
  }

  function getSchema() {
    return {
      columns: SQL_COLUMNS.map((column) => ({
        key: column.key,
        label: column.label,
        aliases: (column.aliases || []).slice(),
        required: column.key === 'license_number' || column.key === 'name'
      })),
      headers: DEFAULT_HEADERS.slice()
    };
  }

  function getWeaponStateEntries() {
    const database = getDb();
    const records = database.prepare(`
      SELECT id, row_order, license_number, name
      FROM weapons_records
      ORDER BY row_order ASC, id ASC
    `).all();
    const weaponsByRecordId = loadWeaponRowsByRecordId(database);
    return records.map((record) => {
      const rowIndex = Math.max(0, (Number(record.row_order) || 1) - 1);
      const recordId = Number(record.id) || null;
      return {
        recordKey: recordId ? `rec|v4|id=${recordId}` : `rec|v3|idx=${rowIndex}`,
        legacyRecordKey: `rec|v3|idx=${rowIndex}`,
        name: String(record.name || '').trim(),
        license: String(record.license_number || '').trim(),
        weapons: (weaponsByRecordId.get(Number(record.id)) || []).map((weapon) => ({
          name: weapon.name,
          withdrawn: !!weapon.withdrawn,
          depositNumber: weapon.depositNumber || '',
          depositDate: weapon.depositDate || ''
        })),
        updatedAt: Date.now()
      };
    }).filter((entry) => entry.weapons.length || entry.name || entry.license);
  }

  return {
    ensureInitialized: getDb,
    getSchema,
    getHeaders: () => DEFAULT_HEADERS.slice(),
    parseCsvText,
    stringifyCsv,
    buildSuggestedMapping,
    previewImport,
    replaceFromCsvText,
    replaceFromRows,
    appendRecordObject,
    updateRecord,
    deleteRecords,
    setWeaponWithdrawal,
    addWeaponToRecord,
    editWeaponInRecord,
    deleteWeaponFromRecord,
    getRecords,
    getRows,
    getCsvText,
    getStats,
    findDuplicateRecordObject,
    getWeaponStateEntries,
    syncCsvMirror,
    backupCurrentCsv
  };
}

module.exports = {
  SQL_COLUMNS,
  DEFAULT_HEADERS,
  createWeaponsSqlStore,
  parseCsvText,
  stringifyCsv,
  buildSuggestedMapping
};
