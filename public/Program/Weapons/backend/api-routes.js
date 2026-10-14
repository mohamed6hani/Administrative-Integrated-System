const express = require('express');
const path = require('path');
const fs = require('fs');
const { disabledDesktopAutomation: exec } = require('../../General/backend/demo-desktop-automation');
const {
  resolveStationName: resolveReferenceStationName,
  normalizeArabicForMatch: normalizeArabicTextForMatch
} = require('../../General/backend/reference-data-store');
const {
  clearFileCache,
  getFileVersionPayload: getCachedFileVersionPayload,
  readTextCached
} = require('../../General/backend/file-data-cache');
const {
  appDataDir,
  dataSubdir,
  dataFile
} = require('../../General/backend/platform-paths');
const {
  createWeaponsSqlStore
} = require('./sql-store');
const deleteApproval = require('../../General/backend/delete-approval-store');
const { logRecordActivity } = require('../../General/backend/activity-record-audit');

const router = express.Router();

// Base paths for weapons program
const WEAPONS_BASE = path.join(__dirname, '..');
const FRONTEND_PATH = path.join(WEAPONS_BASE, 'frontend');
const LEGACY_DATA_PATH = path.join(WEAPONS_BASE, 'Data');
const DATA_PATH = appDataDir('Weapons', { legacyDirs: [LEGACY_DATA_PATH] });
const CSV_PATH = dataFile('Weapons', 'slah.csv', [
  path.join(LEGACY_DATA_PATH, 'slah.csv')
]);
const SQL_DB_PATH = path.join(DATA_PATH, 'weapons.sqlite');
const TMP_PATH = dataSubdir('Weapons', 'tmp');
const MODEL_TMP_DIR = dataSubdir('Weapons', 'model-tmp', {
  legacyDirs: [path.join(FRONTEND_PATH, 'modules', 'model', 'tmp')]
});
const MODEL_NOTES_LOG_FILE = path.join(MODEL_TMP_DIR, 'notes-scan-log.json');

const weaponsSqlStore = createWeaponsSqlStore({
  dbPath: SQL_DB_PATH,
  csvPath: CSV_PATH,
  clearCsvCache: clearFileCache
});
weaponsSqlStore.ensureInitialized();

deleteApproval.registerDeleteApprovalExecutor('weapons.delete-records', (operation) => {
  const rows = Array.isArray(operation?.rows) ? operation.rows : [];
  const result = weaponsSqlStore.deleteRecords(rows);
  return { deleted: result.deleted, mirror: result.mirror || null };
});

deleteApproval.registerDeleteApprovalExecutor('weapons.add-record', (operation) => {
  const row = operation && typeof operation.record === 'object' ? operation.record : {};
  const result = weaponsSqlStore.appendRecordObject(row);
  return {
    ok: true,
    success: true,
    action: 'add',
    recordId: result.recordId,
    rowOrder: result.rowOrder,
    updatedAt: result.updatedAt,
    mirror: result.mirror || null
  };
});

deleteApproval.registerDeleteApprovalExecutor('weapons.edit-records', (operation) => {
  const rows = Array.isArray(operation?.rows) ? operation.rows : [];
  const updatedRows = [];
  rows.forEach((row) => {
    const result = weaponsSqlStore.updateRecord(row);
    updatedRows.push({
      recordId: result.id,
      rowOrder: result.rowOrder,
      updatedAt: result.updatedAt
    });
  });
  return {
    ok: true,
    success: true,
    action: 'edit',
    updated: updatedRows.length,
    updatedRows
  };
});

function getWeaponsCsvText(options = {}) {
  return weaponsSqlStore.getCsvText(options);
}

function normalizeWeaponsApprovalValue(value) {
  return String(value == null ? '' : value).trim();
}

function getWeaponsApprovalRowId(row) {
  if (!row || typeof row !== 'object') return '';
  return normalizeWeaponsApprovalValue(row.__recordId ?? row.id ?? row.recordId);
}

function getWeaponsApprovalRowLicense(row) {
  if (!row || typeof row !== 'object') return '';
  return normalizeWeaponsApprovalValue(row['رقم'] ?? row['رقم القيد'] ?? row.license ?? row.licenseNumber);
}

function getWeaponsApprovalRowName(row) {
  if (!row || typeof row !== 'object') return '';
  return normalizeWeaponsApprovalValue(row['الاسم'] ?? row.name);
}

function getWeaponsApprovalRowIdentityKey(row) {
  const name = normalizeName(getWeaponsApprovalRowName(row));
  const license = normalizeLicenseNumber(getWeaponsApprovalRowLicense(row));
  return name || license ? `${name}::${license}` : '';
}

function getWeaponsApprovalRecordLabel(row, fallback) {
  return getWeaponsApprovalRowName(row) || getWeaponsApprovalRowLicense(row) || fallback || 'سجل';
}

function materializeWeaponsApprovalSnapshots() {
  const records = weaponsSqlStore.getRecords();
  const headers = Array.isArray(records?.headers) ? records.headers : [];
  const rows = Array.isArray(records?.rows) ? records.rows : [];
  const meta = Array.isArray(records?.meta) ? records.meta : [];
  return rows.map((row, rowIndex) => {
    const snapshot = {};
    headers.forEach((header, index) => {
      const key = normalizeWeaponsApprovalValue(header);
      if (!key) return;
      snapshot[key] = row && row[index] != null ? String(row[index]) : '';
    });
    const rowMeta = meta[rowIndex] || {};
    if (rowMeta.id != null) snapshot.__recordId = rowMeta.id;
    if (rowMeta.rowOrder != null) snapshot.__rowOrder = rowMeta.rowOrder;
    if (rowMeta.updatedAt != null) snapshot.__updatedAt = rowMeta.updatedAt;
    return snapshot;
  });
}

function buildWeaponsApprovalRows(rows) {
  const requestedRows = Array.isArray(rows) ? rows : [];
  const snapshots = materializeWeaponsApprovalSnapshots();
  const byId = new Map();
  const byIdentity = new Map();
  snapshots.forEach((snapshot) => {
    const id = getWeaponsApprovalRowId(snapshot);
    if (id && !byId.has(id)) byId.set(id, snapshot);
    const identityKey = getWeaponsApprovalRowIdentityKey(snapshot);
    if (identityKey && !byIdentity.has(identityKey)) byIdentity.set(identityKey, snapshot);
  });

  return requestedRows.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const id = getWeaponsApprovalRowId(row);
    if (id && byId.has(id)) return byId.get(id);
    const identityKey = getWeaponsApprovalRowIdentityKey(row);
    if (identityKey && byIdentity.has(identityKey)) return byIdentity.get(identityKey);
    return row;
  });
}
function resolveWithdrawnFilterParam(value) {
  if (value === 'withdrawn' || value === 'got') return 'withdrawn';
  if (value === 'not_withdrawn' || value === 'not') return 'not_withdrawn';
  return null;
}

function normalizeName(input) {
  return String(input || '')
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeLicenseNumber(input) {
  return toLatinDigits(String(input || ''))
    .replace(/[^0-9a-zA-Z]/g, '')
    .toLowerCase();
}

function normalizeWeaponData(input) {
  const value = toLatinDigits(String(input || ''));
  return normalizeName(value);
}

function toLatinDigits(input) {
  const str = String(input || '');
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0x0660 && code <= 0x0669) {
      out += String(code - 0x0660);
    } else if (code >= 0x06F0 && code <= 0x06F9) {
      out += String(code - 0x06F0);
    } else {
      out += str[i];
    }
  }
  return out;
}

function normalizeWithdrawKeyPart(value) {
  return toLatinDigits(String(value ?? '')).trim().replace(/\s+/g, ' ');
}

function buildLegacyWithdrawKey(name, license) {
  const normName = normalizeWithdrawKeyPart(name);
  const normLicense = normalizeWithdrawKeyPart(license);
  if (!normName && !normLicense) return '';
  return `${normName}::${normLicense}`;
}

function isStableWithdrawRecordKey(recordKey) {
  return /^rec\|v4\|id=\d+$/.test(String(recordKey || '').trim());
}

function weaponStateIdentityMatches(entry, name, license) {
  const normName = normalizeWithdrawKeyPart(name);
  const normLicense = normalizeWithdrawKeyPart(license);
  if (!normName && !normLicense) return true;
  if (!entry || typeof entry !== 'object') return false;
  if (normName && normalizeWithdrawKeyPart(entry.name) !== normName) return false;
  if (normLicense && normalizeWithdrawKeyPart(entry.license) !== normLicense) return false;
  return true;
}

function findWeaponsEntryByRecordKey(list, recordKey, { name, license, allowIdentityMismatch = false } = {}) {
  const trimmedRecordKey = typeof recordKey === 'string' ? recordKey.trim() : '';
  if (!trimmedRecordKey) return { entry: null, index: -1 };
  const recordIdx = list.findIndex(e => String(e && e.recordKey || '').trim() === trimmedRecordKey);
  if (recordIdx === -1) return { entry: null, index: -1 };
  const entry = list[recordIdx];
  if (allowIdentityMismatch || weaponStateIdentityMatches(entry, name, license)) {
    return { entry, index: recordIdx };
  }
  return { entry: null, index: -1 };
}

function findWeaponsEntriesByLegacy(list, name, license) {
  const legacyKey = buildLegacyWithdrawKey(name, license);
  if (!legacyKey) return [];
  const matches = [];
  list.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    if (buildLegacyWithdrawKey(entry.name, entry.license) === legacyKey) {
      matches.push({ entry, index });
    }
  });
  return matches;
}

function findWeaponsEntry(list, { recordKey, name, license }) {
  const trimmedRecordKey = typeof recordKey === 'string' ? recordKey.trim() : '';
  const trimmedName = String(name || '').trim();
  const trimmedLicense = String(license || '').trim();

  const legacyMatches = findWeaponsEntriesByLegacy(list, trimmedName, trimmedLicense);
  if (!legacyMatches.length) {
    if (trimmedRecordKey) {
      const byRecord = findWeaponsEntryByRecordKey(list, trimmedRecordKey, {
        name: trimmedName,
        license: trimmedLicense,
        allowIdentityMismatch: isStableWithdrawRecordKey(trimmedRecordKey)
      });
      if (byRecord.entry) return byRecord;
    }
    return { entry: null, index: -1 };
  }

  if (legacyMatches.length === 1) {
    return legacyMatches[0];
  }

  if (trimmedRecordKey) {
    const specific = legacyMatches.find(({ entry }) => String(entry && entry.recordKey || '').trim() === trimmedRecordKey);
    if (specific) return specific;
    const noKeyMatches = legacyMatches.filter(({ entry }) => !String(entry && entry.recordKey || '').trim());
    if (noKeyMatches.length === 1) return noKeyMatches[0];
    return { entry: null, index: -1 };
  }

  return { entry: null, index: -1 };
}

function prepareWeaponsEntry(entry, { recordKey, name, license }) {
  if (!entry || typeof entry !== 'object') return entry;
  if (!Array.isArray(entry.weapons)) entry.weapons = [];
  const trimmedRecordKey = typeof recordKey === 'string' ? recordKey.trim() : '';
  if (trimmedRecordKey && entry.recordKey !== trimmedRecordKey) entry.recordKey = trimmedRecordKey;
  const trimmedName = String(name || '').trim();
  const trimmedLicense = String(license || '').trim();
  if (trimmedName) entry.name = trimmedName;
  if (trimmedLicense) entry.license = trimmedLicense;
  return entry;
}

function ensureWeaponsEntry(list, { recordKey, persistedRecordKey, name, license }) {
  const trimmedRecordKey = typeof recordKey === 'string' ? recordKey.trim() : '';
  const trimmedPersistedKey = typeof persistedRecordKey === 'string' ? persistedRecordKey.trim() : '';
  const trimmedName = String(name || '').trim();
  const trimmedLicense = String(license || '').trim();
  if (!trimmedName || !trimmedLicense) {
    return { entry: null, index: -1 };
  }

  if (trimmedRecordKey) {
    let byRecord = findWeaponsEntry(list, { recordKey: trimmedRecordKey, name: trimmedName, license: trimmedLicense });
    if (byRecord.entry) {
      prepareWeaponsEntry(byRecord.entry, { recordKey: trimmedRecordKey, name: trimmedName, license: trimmedLicense });
      return byRecord;
    }

    if (trimmedPersistedKey) {
      byRecord = findWeaponsEntry(list, { recordKey: trimmedPersistedKey, name: trimmedName, license: trimmedLicense });
      if (byRecord.entry) {
        prepareWeaponsEntry(byRecord.entry, { recordKey: trimmedRecordKey, name: trimmedName, license: trimmedLicense });
        return byRecord;
      }
    }

    const legacyMatches = findWeaponsEntriesByLegacy(list, trimmedName, trimmedLicense);
    if (legacyMatches.length) {
      const preferred = legacyMatches.find(({ entry }) => String((entry && entry.recordKey) || '').trim() === trimmedPersistedKey)
        || (legacyMatches.length === 1 ? legacyMatches[0] : null);
      if (preferred) {
        prepareWeaponsEntry(preferred.entry, { recordKey: trimmedRecordKey, name: trimmedName, license: trimmedLicense });
        return preferred;
      }
    }

    const newEntry = { name: trimmedName, license: trimmedLicense, weapons: [], recordKey: trimmedRecordKey };
    list.push(newEntry);
    return { entry: newEntry, index: list.length - 1 };
  }

  if (trimmedPersistedKey) {
    const byRecord = findWeaponsEntry(list, { recordKey: trimmedPersistedKey, name: trimmedName, license: trimmedLicense });
    if (byRecord.entry) {
      prepareWeaponsEntry(byRecord.entry, { recordKey: trimmedPersistedKey, name: trimmedName, license: trimmedLicense });
      return byRecord;
    }

    const legacyMatches = findWeaponsEntriesByLegacy(list, trimmedName, trimmedLicense);
    if (legacyMatches.length) {
      const preferred = legacyMatches.length === 1 ? legacyMatches[0] : null;
      if (preferred) {
        prepareWeaponsEntry(preferred.entry, { recordKey: trimmedPersistedKey, name: trimmedName, license: trimmedLicense });
        return preferred;
      }
    }

    const newEntry = { name: trimmedName, license: trimmedLicense, weapons: [], recordKey: trimmedPersistedKey };
    list.push(newEntry);
    return { entry: newEntry, index: list.length - 1 };
  }

  const legacyMatch = findWeaponsEntry(list, { recordKey: '', name: trimmedName, license: trimmedLicense });
  if (legacyMatch.entry) {
    prepareWeaponsEntry(legacyMatch.entry, { recordKey: '', name: trimmedName, license: trimmedLicense });
    return legacyMatch;
  }

  const newEntry = { name: trimmedName, license: trimmedLicense, weapons: [] };
  list.push(newEntry);
  return { entry: newEntry, index: list.length - 1 };
}

// Helper function to ensure directory exists
function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function appendModelNotesLog(entry) {
  try {
    ensureDirSync(MODEL_TMP_DIR);
    let existing = [];
    if (fs.existsSync(MODEL_NOTES_LOG_FILE)) {
      try {
        existing = JSON.parse(fs.readFileSync(MODEL_NOTES_LOG_FILE, 'utf8'));
        if (!Array.isArray(existing)) existing = [];
      } catch (_) {
        existing = [];
      }
    }
    existing.unshift(entry);
    if (existing.length > MODEL_NOTES_MAX_ENTRIES) {
      existing = existing.slice(0, MODEL_NOTES_MAX_ENTRIES);
    }
    fs.writeFileSync(MODEL_NOTES_LOG_FILE, JSON.stringify(existing, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn('[model-notes] append failed', err);
    return false;
  }
}

const MODEL_NOTES_MAX_ENTRIES = 40;
const UNDO_FILE = path.join(TMP_PATH, 'undo.json');
const LEGACY_UNDO_FILE = path.join(TMP_PATH, 'deleted_rows.json');
const WEAPONS_DEBUG = process.env.WEAPONS_DEBUG === '1';

function getFileVersionPayload(filePath) {
  if (filePath === CSV_PATH) {
    try {
      const mirror = weaponsSqlStore.syncCsvMirror();
      const payload = weaponsSqlStore.getStats();
      if (mirror && mirror.ok === false && mirror.fallback) {
        payload.message = 'SQL data is current; CSV mirror could not be replaced and a pending copy was written.';
        payload.mirrorFallback = mirror.fallback;
      }
      return payload;
    } catch (error) {
      console.warn('Weapons SQL version payload failed, falling back to CSV file signature:', error && error.message);
    }
  }
  return getCachedFileVersionPayload(filePath, { kind: 'csv' });
}

function clampString(value, maxLength) {
  const str = value == null ? '' : String(value);
  if (!maxLength || str.length <= maxLength) return str;
  return str.slice(0, maxLength);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function migrateLegacyUndoFile() {
  // No legacy undo files are inspected or migrated by the public demo.
}

function resolveUndoFile() {
  ensureDirSync(TMP_PATH);
  migrateLegacyUndoFile();
  return UNDO_FILE;
}

function resetUndoFile() {
  try {
    const target = resolveUndoFile();
    fs.writeFileSync(target, '[]', 'utf8');
    if (fs.existsSync(LEGACY_UNDO_FILE)) {
      try { fs.unlinkSync(LEGACY_UNDO_FILE); } catch (_) {}
    }
    return true;
  } catch (error) {
    console.warn('Weapons undo reset failed:', error);
    return false;
  }
}
const SETTING_PATH = dataSubdir('Weapons', 'setting', {
  legacyDirs: [path.join(WEAPONS_BASE, 'setting')]
});
const WEAPONS_STATE_FILE = path.join(TMP_PATH, 'weaponsState.json');
let _weaponsStateCache = null;

function normalizeWeaponStatePieces(input) {
  const digits = toLatinDigits(String(input ?? '')).replace(/[^0-9]/g, '');
  if (!digits) return null;
  const parsed = parseInt(digits, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeWeaponStateWeapon(input) {
  if (!input) return null;
  const name = typeof input === 'string'
    ? input.trim()
    : String(input.name || input.weapon || '').trim();
  if (!name) return null;
  const weapon = { name };
  if (typeof input === 'object') {
    const pieces = normalizeWeaponStatePieces(input.pieces ?? input.count);
    if (pieces != null) weapon.pieces = pieces;
    if (Object.prototype.hasOwnProperty.call(input, 'withdrawn')) {
      weapon.withdrawn = !!input.withdrawn;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'depositNumber')) {
      weapon.depositNumber = String(input.depositNumber || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(input, 'depositDate')) {
      weapon.depositDate = String(input.depositDate || '').trim();
    }
  }
  return weapon;
}

function normalizeWeaponStateEntry(input) {
  if (!input || typeof input !== 'object') return null;
  const entry = {
    name: String(input.name || '').trim(),
    license: String(input.license || '').trim(),
    weapons: (Array.isArray(input.weapons) ? input.weapons : [])
      .map(normalizeWeaponStateWeapon)
      .filter(Boolean)
  };
  const recordKey = typeof input.recordKey === 'string' ? input.recordKey.trim() : '';
  if (recordKey) entry.recordKey = recordKey;
  const updatedAt = Number(input.updatedAt);
  if (Number.isFinite(updatedAt) && updatedAt > 0) entry.updatedAt = updatedAt;
  return entry;
}

function loadWeaponsStateData() {
  if (_weaponsStateCache) return _weaponsStateCache;
  try {
    ensureDirSync(path.dirname(WEAPONS_STATE_FILE));
    if (WEAPONS_DEBUG) {
      console.log('[weapons] loadWeaponsStateData ->', WEAPONS_STATE_FILE);
    }
    if (!fs.existsSync(WEAPONS_STATE_FILE)) {
      if (WEAPONS_DEBUG) {
        console.log('[weapons] state file does not exist yet');
      }
      _weaponsStateCache = [];
      return _weaponsStateCache;
    }
    const txt = fs.readFileSync(WEAPONS_STATE_FILE, 'utf8');
    if (WEAPONS_DEBUG) {
      console.log('[weapons] state file size:', Buffer.byteLength(String(txt || ''), 'utf8'));
    }
    const parsed = JSON.parse(txt || '[]');
    _weaponsStateCache = (Array.isArray(parsed) ? parsed : []).map(normalizeWeaponStateEntry).filter(Boolean);
    return _weaponsStateCache;
  } catch (e) { console.warn('loadWeaponsStateData error', e); return []; }
}

function saveWeaponsStateData(data) {
  try {
    ensureDirSync(path.dirname(WEAPONS_STATE_FILE));
    const normalized = (Array.isArray(data) ? data : []).map(normalizeWeaponStateEntry).filter(Boolean);
    const payload = JSON.stringify(normalized, null, 2);
    if (WEAPONS_DEBUG) {
      console.log('[weapons] saveWeaponsStateData ->', WEAPONS_STATE_FILE, 'bytes=', Buffer.byteLength(payload, 'utf8'));
    }
    fs.writeFileSync(WEAPONS_STATE_FILE, payload, 'utf8');
    _weaponsStateCache = normalized;
    if (WEAPONS_DEBUG) {
      try {
        const stat = fs.statSync(WEAPONS_STATE_FILE);
        console.log('[weapons] wrote file, size on disk=', stat.size);
      } catch (_) {}
    }
    return true;
  } catch (e) { console.error('saveWeaponsStateData error', e); return false; }
}

// Debug endpoint: returns diagnostic info about weaponsState.json
router.get('/weapon-state/debug', (req, res) => {
  if (!WEAPONS_DEBUG) {
    return res.status(404).json({ ok: false, message: 'debug disabled' });
  }
  try {
    ensureDirSync(path.dirname(WEAPONS_STATE_FILE));
    const exists = fs.existsSync(WEAPONS_STATE_FILE);
    let size = null, content = null;
    if (exists) {
      try { const stat = fs.statSync(WEAPONS_STATE_FILE); size = stat.size; } catch(_){}
      try { content = fs.readFileSync(WEAPONS_STATE_FILE, 'utf8'); } catch(_) { content = null; }
    }
    // Return truncated content to avoid large responses
    const truncated = (typeof content === 'string' && content.length > 2000) ? content.slice(0,2000) + '... (truncated)' : content;
    return res.json({ ok: true, path: WEAPONS_STATE_FILE, exists, size, content: truncated });
  } catch (e) { console.error('weapon-state/debug error', e); return res.status(500).json({ ok:false, message: 'debug failed' }); }
});

// Load CSV data
router.get('/csv-version', (req, res) => {
  try {
    return res.json(getFileVersionPayload(CSV_PATH));
  } catch (error) {
    console.error('Error reading CSV version:', error);
    return res.status(500).json({ ok: false, version: null, updatedAt: null, size: 0, message: 'Error reading CSV version' });
  }
});

router.get('/csv-data', (req, res) => {
  try {
    const withdrawnFilter = resolveWithdrawnFilterParam(req.query.filter);
    const csvText = getWeaponsCsvText(withdrawnFilter ? { withdrawnFilter } : {});
    res.json({ ok: true, csvText });
  } catch (error) {
    console.error('Error reading SQL-backed CSV:', error);
    res.status(500).json({ ok: false, message: 'Error reading records' });
  }
});

router.get('/records', (req, res) => {
  try {
    const withdrawnFilter = resolveWithdrawnFilterParam(req.query.filter);
    const records = weaponsSqlStore.getRecords(withdrawnFilter ? { withdrawnFilter } : {});
    const stats = weaponsSqlStore.getStats();
    return res.json({
      ok: true,
      headers: records.headers,
      rows: records.rows,
      meta: records.meta,
      version: stats.version,
      updatedAt: stats.updatedAt,
      totalRows: stats.totalRows
    });
  } catch (error) {
    console.error('Error reading SQL records:', error);
    return res.status(500).json({ ok: false, message: 'Error reading records' });
  }
});

router.get('/csv-raw', (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.type('text/csv; charset=utf-8');
    const withdrawnFilter = resolveWithdrawnFilterParam(req.query.filter);
    return res.send(getWeaponsCsvText(withdrawnFilter ? { withdrawnFilter } : {}));
  } catch (error) {
    console.error('Error reading SQL-backed CSV raw:', error);
    return res.status(500).type('text/plain; charset=utf-8').send('Error reading records');
  }
});

router.get('/import/schema', (req, res) => {
  try {
    return res.json({
      ok: true,
      schema: weaponsSqlStore.getSchema(),
      stats: weaponsSqlStore.getStats()
    });
  } catch (error) {
    console.error('weapons import schema error:', error);
    return res.status(500).json({ ok: false, message: 'failed to load import schema' });
  }
});

router.post('/import/preview', (req, res) => {
  try {
    const body = (typeof req.body === 'object' && req.body) ? req.body : {};
    const csvText = typeof body.csvText === 'string' ? body.csvText : String(req.body || '');
    if (!csvText.trim()) {
      return res.status(400).json({ ok: false, message: 'CSV text is required' });
    }
    const preview = weaponsSqlStore.previewImport(csvText, body.mapping || null);
    return res.json({
      ok: true,
      schema: weaponsSqlStore.getSchema(),
      preview
    });
  } catch (error) {
    console.error('weapons import preview error:', error);
    return res.status(500).json({ ok: false, message: 'failed to preview import' });
  }
});

router.post('/import/replace', (req, res) => {
  try {
    const body = (typeof req.body === 'object' && req.body) ? req.body : {};
    const csvText = typeof body.csvText === 'string' ? body.csvText : '';
    const mapping = body.mapping && typeof body.mapping === 'object' ? body.mapping : {};
    const confirmed = body.confirm === true || body.confirm === 'replace';
    if (!confirmed) {
      return res.status(400).json({ ok: false, message: 'replace confirmation is required' });
    }
    if (!csvText.trim()) {
      return res.status(400).json({ ok: false, message: 'CSV text is required' });
    }
    const missingRequired = weaponsSqlStore.getSchema().columns
      .filter((column) => column.required && (mapping[column.key] == null || mapping[column.key] === '' || mapping[column.key] === '-1'))
      .map((column) => column.label);
    if (missingRequired.length) {
      return res.status(400).json({
        ok: false,
        message: 'required mappings missing',
        missingRequired
      });
    }
    const result = weaponsSqlStore.replaceFromCsvText(csvText, {
      mapping,
      backup: true,
      backupLabel: 'before-sql-import',
      logImport: true,
      preserveExistingWeaponState: false
    });
    return res.json({
      ok: true,
      message: `تم استيراد ${result.importedRows} سجل إلى في قاعده البيانات`,
      importedRows: result.importedRows,
      sourceRows: result.sourceRows,
      backupPath: result.backupPath,
      mirror: result.mirror,
      stats: weaponsSqlStore.getStats()
    });
  } catch (error) {
    console.error('weapons import replace error:', error);
    return res.status(500).json({ ok: false, message: 'failed to replace records from import' });
  }
});

router.post('/model-notes-log', (req, res) => {
  try {
    const body = (typeof req.body === 'object' && req.body) ? req.body : {};
    const rawHints = Array.isArray(body.hints) ? body.hints : [];
    const sanitizedHints = rawHints.slice(0, 50).map((hint) => {
      const safe = hint && typeof hint === 'object' ? hint : {};
      const row = typeof safe.row === 'number' ? safe.row : null;
      const score = typeof safe.score === 'number' ? safe.score : undefined;
      return {
        digits: clampString(safe.digits, 32),
        raw: clampString(safe.raw, 160),
        row,
        score,
        status: clampString(safe.status, 32)
      };
    });
    const entry = {
      storedAt: new Date().toISOString(),
      generatedAt: Number(body.generatedAt) || Date.now(),
      hintCount: typeof body.hintCount === 'number' ? body.hintCount : sanitizedHints.length,
      sampleSize: sanitizedHints.length,
      hints: sanitizedHints,
      meta: {
        version: 1,
        note: 'AI notes detector snapshot'
      }
    };
    const ok = appendModelNotesLog(entry);
    if (!ok) {
      return res.status(500).json({ ok: false, message: 'failed to persist log' });
    }
    res.json({ ok: true, stored: sanitizedHints.length });
  } catch (error) {
    console.error('model-notes-log failed:', error);
    res.status(500).json({ ok: false, message: 'failed to store model log' });
  }
});

// Update only changed rows (targeted SQL update — no full CSV rewrite)
router.post('/update-records', (req, res) => {
  try {
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || !rows.length) {
      return res.json({ ok: true, updated: 0, message: 'لا توجد صفوف للحفظ' });
    }
    const beforeRows = buildWeaponsApprovalRows(rows);
    if (deleteApproval.isActionApprovalRequired(req, { programKey: 'weapons', action: 'edit' })) {
      const approval = deleteApproval.createDeleteApprovalRequest(req, {
        action: 'edit',
        programKey: 'weapons',
        programName: 'برنامج الرخص الملغاة',
        recordId: rows.map((row) => row?.id || row?.recordId || row?.license || row?.name || '').filter(Boolean).join(','),
        recordLabel: rows.length === 1
          ? (rows[0]?.name || rows[0]?.license || `سجل رقم ${rows[0]?.id || ''}`.trim())
          : `${rows.length} سجلات`,
        recordSnapshot: rows.length === 1
          ? { before: beforeRows[0] || {}, after: rows[0] }
          : { records: rows.map((row, index) => ({ before: beforeRows[index] || {}, after: row })) },
        operation: {
          type: 'weapons.edit-records',
          action: 'edit',
          rows
        },
        items: rows.map((row, index) => ({
          action: 'edit',
          recordId: row?.id || row?.recordId || row?.license || row?.name || String(index + 1),
          recordLabel: row?.name || row?.license || `سجل ${index + 1}`,
          recordSnapshot: { before: beforeRows[index] || {}, after: row },
          operation: {
            type: 'weapons.edit-records',
            action: 'edit',
            rows: [row]
          }
        }))
      });
      return res.status(202).json({
        ok: true,
        success: true,
        approvalRequired: true,
        message: deleteApproval.getApprovalRequiredMessage('edit'),
        request: approval.request
      });
    }
    let updated = 0;
    const errors = [];
    const conflicts = [];
    const updatedRows = [];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      try {
        const result = weaponsSqlStore.updateRecord(row);
        updated++;
        updatedRows.push({
          recordId: result.id,
          rowOrder: result.rowOrder,
          updatedAt: result.updatedAt
        });
        logRecordActivity(req, {
          action: 'edit',
          programKey: 'weapons',
          programName: 'برنامج الرخص الملغاة',
          recordId: result.id,
          before: beforeRows[rowIndex] || {},
          after: row
        });
      } catch (err) {
        const message = err && err.message ? err.message : String(err);
        if (err && err.code === 'record-conflict') {
          conflicts.push({ message });
        } else {
          errors.push(message);
        }
      }
    }
    if (conflicts.length) {
      return res.status(409).json({
        ok: false,
        code: 'record-conflict',
        updated,
        updatedRows,
        conflicts,
        errors,
        message: 'تم تعديل سجل واحد أو أكثر بواسطة مستخدم آخر. حدّث البيانات ثم حاول مرة أخرى.'
      });
    }
    if (updated === 0 && errors.length) {
      return res.status(400).json({ ok: false, message: errors[0], errors });
    }
    const message = errors.length
      ? `✔️ تم حفظ ${updated} سجل، فشل ${errors.length}`
      : `✔️ تم حفظ ${updated} سجل بنجاح في قاعده البيانات`;
    return res.json({ ok: true, updated, updatedRows, errors, message });
  } catch (error) {
    console.error('update-records error:', error);
    return res.status(500).json({ ok: false, message: 'تعذر تحديث السجلات' });
  }
});

// Delete a list of records by identity (name + license)
router.post('/delete-records', (req, res) => {
  try {
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || !rows.length) {
      return res.json({ ok: true, deleted: 0, message: 'لا توجد صفوف للحذف' });
    }
    const approvalRows = buildWeaponsApprovalRows(rows);
    if (deleteApproval.isDeleteApprovalRequired(req)) {
      const approval = deleteApproval.createDeleteApprovalRequest(req, {
        action: 'delete',
        programKey: 'weapons',
        programName: 'برنامج الرخص الملغاة',
        recordId: approvalRows.map((row) => getWeaponsApprovalRowId(row) || getWeaponsApprovalRowLicense(row) || getWeaponsApprovalRowName(row)).filter(Boolean).join(','),
        recordLabel: approvalRows.length === 1
          ? getWeaponsApprovalRecordLabel(approvalRows[0], `سجل رقم ${getWeaponsApprovalRowId(approvalRows[0]) || ''}`.trim())
          : `${approvalRows.length} سجلات`,
        recordSnapshot: approvalRows.length === 1 ? approvalRows[0] : { records: approvalRows },
        operation: {
          type: 'weapons.delete-records',
          action: 'delete',
          rows: approvalRows
        },
        items: rows.map((row, index) => ({
          recordId: getWeaponsApprovalRowId(approvalRows[index] || row) || getWeaponsApprovalRowLicense(approvalRows[index] || row) || getWeaponsApprovalRowName(approvalRows[index] || row) || String(index + 1),
          recordLabel: getWeaponsApprovalRecordLabel(approvalRows[index] || row, `سجل ${index + 1}`),
          recordSnapshot: approvalRows[index] || row,
          operation: {
            type: 'weapons.delete-records',
            action: 'delete',
            rows: [approvalRows[index] || row]
          }
        }))
      });
      return res.status(202).json({
        ok: true,
        success: true,
        approvalRequired: true,
        message: deleteApproval.getApprovalRequiredMessage('delete'),
        request: approval.request
      });
    }
    const result = weaponsSqlStore.deleteRecords(rows);
    approvalRows.slice(0, result.deleted).forEach((record, index) => {
      logRecordActivity(req, {
        action: 'delete',
        programKey: 'weapons',
        programName: 'برنامج الرخص الملغاة',
        recordId: getWeaponsApprovalRowId(record) || index + 1,
        record
      });
    });
    return res.json({ ok: true, deleted: result.deleted, message: `تم حذف ${result.deleted} سجل` });
  } catch (error) {
    console.error('delete-records error:', error);
    return res.status(500).json({ ok: false, message: 'تعذر حذف السجلات' });
  }
});

// Append new row to CSV
router.post('/append-csv', (req, res) => {
  try {
    const row = req.body || {};
    const forceAppend = !!row.__forceAppend;
    if (Object.prototype.hasOwnProperty.call(row, '__forceAppend')) {
      delete row.__forceAppend;
    }
    if (WEAPONS_DEBUG) {
      console.log('append-csv payload keys:', Object.keys(row || {}));
    }

    const incomingNameKey = normalizeName(row['الاسم']);
    const incomingLicenseRaw = (() => {
      const primary = row['رقم'];
      if (primary != null && String(primary).trim() !== '') return primary;
      return row['رقم القيد'];
    })();
    const incomingLicenseKey = normalizeLicenseNumber(incomingLicenseRaw);
    const requireDuplicateCheck = !forceAppend && incomingNameKey && incomingLicenseKey;
    if (requireDuplicateCheck) {
      try {
        const duplicate = weaponsSqlStore.findDuplicateRecordObject(row);
        if (duplicate && duplicate.row) {
          return res.status(409).json({
            ok: false,
            code: 'duplicate-name',
            message: '⚠️ هذا السجل مضاف بالفعل بنفس الاسم ورقم القيد.',
            headers: duplicate.headers,
            existingRow: duplicate.row
          });
        }
      } catch (err) {
        console.warn('append duplicate check skipped:', err?.message || err);
      }
    }

    if (deleteApproval.isActionApprovalRequired(req, { programKey: 'weapons', action: 'add' })) {
      const approval = deleteApproval.createDeleteApprovalRequest(req, {
        action: 'add',
        programKey: 'weapons',
        programName: 'برنامج الرخص الملغاة',
        recordId: row['رقم'] || row['رقم القيد'] || row['الاسم'] || '',
        recordLabel: row['الاسم'] || row['رقم'] || row['رقم القيد'] || 'سجل جديد',
        recordSnapshot: row,
        operation: {
          type: 'weapons.add-record',
          action: 'add',
          record: row
        }
      });
      return res.status(202).json({
        ok: true,
        success: true,
        approvalRequired: true,
        message: deleteApproval.getApprovalRequiredMessage('add'),
        request: approval.request
      });
    }

    const result = weaponsSqlStore.appendRecordObject(row);
    logRecordActivity(req, {
      action: 'add',
      programKey: 'weapons',
      programName: 'برنامج الرخص الملغاة',
      recordId: result.recordId,
      record: row
    });

    res.json({
      ok: true,
      message: 'Row added successfully',
      recordId: result.recordId,
      rowOrder: result.rowOrder,
      updatedAt: result.updatedAt,
      mirror: result.mirror
    });
  } catch (error) {
    if (error && error.code === 'EBUSY') {
      console.error('CSV append failed because file is locked:', error);
      return res.status(423).json({
        ok: false,
        code: 'csv-locked',
        message: 'لا يمكن الحفظ لأن ملف السجلات مفتوح الآن (مثلاً في Excel). أغلق الملف ثم أعد المحاولة.'
      });
    }
    console.error('Error appending to CSV:', error);
    res.status(500).json({ ok: false, message: 'Error adding row to CSV' });
  }
});

// Cleanup temporary files
router.post('/cleanup-temp', (req, res) => {
  try {
    ensureDirSync(TMP_PATH);
    let deleted = 0;
    if (fs.existsSync(TMP_PATH)) {
      for (const name of fs.readdirSync(TMP_PATH)) {
        if (!/\.(xlsx|csv)$/i.test(name)) continue;
        const full = path.join(TMP_PATH, name);
        try {
          fs.unlinkSync(full);
          deleted++;
        } catch (_) {}
      }
    }
    const undoCleared = resetUndoFile();
    res.json({ ok: true, deleted, undoCleared });
  } catch (error) {
    console.error('Error cleaning temp files:', error);
    res.status(500).json({ ok: false, message: 'Error cleaning temporary files' });
  }
});

// Count temporary files
router.get('/temp-count', (req, res) => {
  try {
    if (!fs.existsSync(TMP_PATH)) return res.json({ ok: true, count: 0 });
    
    let count = 0;
    for (const name of fs.readdirSync(TMP_PATH)) {
      if (/\.(xlsx|csv)$/i.test(name)) count++;
    }
    res.json({ ok: true, count });
  } catch (error) {
    console.error('Error counting temp files:', error);
    res.status(500).json({ ok: false, message: 'Error counting temporary files' });
  }
});

// Print preset routes
router.get('/print-preset', (req, res) => {
  try {
    ensureDirSync(SETTING_PATH);
    const presetPath = path.join(SETTING_PATH, 'print-preset.json');
    
    if (!fs.existsSync(presetPath)) {
      return res.json({ ok: true, preset: {} });
    }
    
    const presetText = fs.readFileSync(presetPath, 'utf8');
    const preset = JSON.parse(presetText);
    res.json({ ok: true, preset });
  } catch (error) {
    console.error('Error reading print preset:', error);
    res.status(500).json({ ok: false, message: 'Error reading print preset' });
  }
});

router.post('/print-preset', (req, res) => {
  try {
    ensureDirSync(SETTING_PATH);
    const preset = req.body || {};
    const presetPath = path.join(SETTING_PATH, 'print-preset.json');
    
    fs.writeFileSync(presetPath, JSON.stringify(preset, null, 2), 'utf8');
    res.json({ ok: true, message: 'Print preset saved' });
  } catch (error) {
    console.error('Error saving print preset:', error);
    res.status(500).json({ ok: false, message: 'Error saving print preset' });
  }
});

// ================= Additional Endpoints for Printing/Temp Files =================

// Helpers for Windows file opening
function openFileWindows(filePath, cb) {
  const cmd = `cmd.exe /d /s /c start "" "${String(filePath).replace(/"/g, '""')}"`;
  exec(cmd, { windowsHide: true }, (err) => {
    if (!err) return cb && cb(null);
    const quoted = `'${String(filePath).replace(/'/g, "''")}'`;
    const psCmd = `powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "Start-Process -Verb Open -FilePath ${quoted}"`;
    exec(psCmd, { windowsHide: true }, (err2) => cb && cb(err2 || err));
  });
}

function openCsvPreferExcel(filePath, cb) {
  const safe = String(filePath).replace(/"/g, '""');
  const cmd = `cmd.exe /d /s /c start "" "excel" "${safe}"`;
  exec(cmd, { windowsHide: true }, (err) => {
    if (!err) return cb && cb(null);
    const psCmd = `powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'excel' -ArgumentList @('\'${String(filePath).replace(/'/g, "''")}\'')"`;
    exec(psCmd, { windowsHide: true }, (err2) => {
      if (!err2) return cb && cb(null);
      openFileWindows(filePath, cb);
    });
  });
}

function openXlsxSmart(filePath, cb) {
  const psPath = String(filePath).replace(/'/g, "''");
  const psCmd = `powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'excel' -ArgumentList @('\\'${psPath}\\')"`;
  exec(psCmd, { windowsHide: true }, (err1) => {
    if (!err1) return cb && cb(null);
    const safe = String(filePath).replace(/"/g, '""');
    const cmdExcel = `cmd.exe /d /s /c start "" "excel" "${safe}"`;
    exec(cmdExcel, { windowsHide: true }, (err2) => {
      if (!err2) return cb && cb(null);
      openFileWindows(filePath, cb);
    });
  });
}

// CSV parse for server-side
function parseCsvServer(csvText) {
  const lines = String(csvText || '').split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return { headers: [], rows: [] };
  const SEP_RE = /,(?=(?:[^"]*"[^"]*")*[^"]*$)|;|\t/;
  const unq = s => String(s).replace(/^\uFEFF?\s*["']?|["']\s*$/g,'').replace(/""/g,'"');
  const parsed = lines.map(l => l.split(SEP_RE).map(unq));
  const headers = parsed[0] || [];
  const rows = parsed.slice(1);
  return { headers, rows };
}

const WITHDRAW_TAG_RE = /\s*\(\s*(?:ال)?مسحوب\s*\)\s*/g;

function normalizeWeaponTextServer(value) {
  return normalizeWeaponData(String(value || '').replace(WITHDRAW_TAG_RE, ' '));
}

function findColumnIndex(headers, ...aliases) {
  if (!Array.isArray(headers) || !headers.length) return -1;
  for (const alias of aliases) {
    const idx = headers.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function stringifyCsvServer(headers, rows) {
  const escapeCell = (value) => {
    const text = value == null ? '' : String(value);
    if (text === '') return '';
    if (/[",\n\r]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  };
  const lines = [];
  if (Array.isArray(headers) && headers.length) {
    lines.push(headers.map(escapeCell).join(','));
  }
  for (const row of rows) {
    const safeRow = Array.isArray(row) ? row : [];
    lines.push(safeRow.map(escapeCell).join(','));
  }
  return lines.join('\n');
}

function persistCsvRows(headers, rows) {
  const result = weaponsSqlStore.replaceFromRows(headers, rows);
  if (result && result.mirror && result.mirror.ok === false) {
    console.warn('SQL persisted but CSV mirror could not be replaced:', result.mirror.error && result.mirror.error.message);
  }
}

function sendWeaponSqlMutation(res, result) {
  return res.json({
    ok: true,
    recordId: result.recordId || null,
    rowIndex: result.rowIndex,
    rowOrder: result.rowOrder || null,
    updatedAt: result.updatedAt || null,
    weaponDetails: result.weaponDetails || '',
    statusValue: result.statusValue || '',
    totalWeapons: Math.max(0, Number(result.totalWeapons) || 0),
    withdrawnCount: Math.max(0, Number(result.withdrawnCount) || 0),
    entries: Array.isArray(result.entries) ? result.entries : [],
    mirror: result.mirror || null
  });
}

function handleWeaponSqlMutationError(res, error, fallbackMessage, logLabel) {
  const status = Number(error && error.statusCode) || 500;
  if (status >= 500) {
    console.error(logLabel, error);
  }
  return res.status(status).json({
    ok: false,
    code: error && error.code ? error.code : undefined,
    message: (error && error.publicMessage) || fallbackMessage
  });
}

function resolveWeaponMutationTarget(body) {
  const recordId = Number(body && (body.recordId ?? body.id ?? body.__recordId));
  const rowIndex = Number.isInteger(body && body.rowIndex) ? body.rowIndex : null;
  const hasRecordId = Number.isInteger(recordId) && recordId > 0;
  const hasRowIndex = rowIndex != null && rowIndex >= 0;
  return {
    ok: hasRecordId || hasRowIndex,
    recordId: hasRecordId ? recordId : null,
    rowIndex: hasRowIndex ? rowIndex : null
  };
}

function buildStationLooseMatchKey(value) {
  const normalized = normalizeArabicTextForMatch(String(value ?? ''));
  if (!normalized) return '';
  const loosened = normalized
    .split(/\s+/)
    .map((token) => (token.length >= 4 ? token.replace(/ي$/u, '') : token))
    .join(' ')
    .trim();
  return (loosened || normalized).replace(/[^\p{L}\p{N}]+/gu, '');
}

function resolveCanonicalStationName(value, sectorValue = '') {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const resolved = resolveReferenceStationName(raw, sectorValue);
  return String(resolved || raw).trim();
}

function normalizeStationValue(value, sectorValue = '') {
  const canonical = resolveCanonicalStationName(value, sectorValue);
  return buildStationLooseMatchKey(canonical || value);
}

function computeStationGrouping(headers, rows) {
  const empty = { serials: [], top: [], bottom: [] };
  if (!Array.isArray(headers) || !Array.isArray(rows) || !rows.length) return empty;
  const normalizedHeaders = headers.map((h) => typeof h === 'string'
    ? h.replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '').trim()
    : h);
  let stationIdx = normalizedHeaders.findIndex((h) => h === 'القسم');
  if (stationIdx === -1) stationIdx = normalizedHeaders.findIndex((h) => h === 'القسم التابع');
  const sectorIdx = normalizedHeaders.findIndex((h) => h === 'القطاع');
  if (stationIdx === -1) {
    return {
      serials: rows.map((_, i) => i + 1),
      top: new Array(rows.length).fill(false),
      bottom: rows.map((_, i) => i === rows.length - 1)
    };
  }

  const serials = new Array(rows.length);
  const top = new Array(rows.length).fill(false);
  const bottom = new Array(rows.length).fill(false);
  let prevStation = null;
  let counter = 0;
  for (let i = 0; i < rows.length; i++) {
    const station = normalizeStationValue(rows[i]?.[stationIdx], sectorIdx !== -1 ? rows[i]?.[sectorIdx] : '');
    if (i === 0 || station !== prevStation) {
      counter = 1;
      if (i !== 0) top[i] = true;
      prevStation = station;
    } else {
      counter += 1;
    }
    serials[i] = counter;
  }

  for (let i = 0; i < rows.length; i++) {
    const current = normalizeStationValue(rows[i]?.[stationIdx], sectorIdx !== -1 ? rows[i]?.[sectorIdx] : '');
    const next = i + 1 < rows.length
      ? normalizeStationValue(rows[i + 1]?.[stationIdx], sectorIdx !== -1 ? rows[i + 1]?.[sectorIdx] : '')
      : null;
    if (i === rows.length - 1 || current !== next) bottom[i] = true;
  }

  return { serials, top, bottom };
}

function normalizeHeaderName(header) {
  return String(header || '')
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
    .trim();
}

function findHeaderIndexLoose(headers, ...names) {
  if (!Array.isArray(headers) || !headers.length) return -1;
  const normalizedTargets = names
    .map((name) => normalizeHeaderName(name))
    .filter((name) => !!name);
  if (!normalizedTargets.length) return -1;
  const targetSet = new Set(normalizedTargets);
  for (let i = 0; i < headers.length; i++) {
    const headerName = normalizeHeaderName(headers[i]);
    if (targetSet.has(headerName)) return i;
  }
  return -1;
}

function joinMultilineValues(values, fallback = '') {
  if (!Array.isArray(values) || !values.length) return fallback;
  const cleaned = values
    .map((value) => (value == null ? '' : String(value).trim()))
    .filter((text) => text.length);
  if (cleaned.length) return cleaned.join('\n');
  return fallback;
}

function collapseRowsByWeapons(headers, rows, recordStatuses, perRowWeaponStatusLabels) {
  const weaponIdx = findHeaderIndexLoose(headers, 'بيانات السلاح', 'بيان السلاح', 'السلاح');
  const statusIdx = findHeaderIndexLoose(headers, 'حالة السحب');
  const hasWeaponCol = weaponIdx !== -1;
  const hasStatusCol = statusIdx !== -1;
  const canCollapse = hasWeaponCol || hasStatusCol;
  const trackWeaponStatuses = Array.isArray(perRowWeaponStatusLabels);
  if (!canCollapse) {
    return {
      rows: Array.isArray(rows) ? rows.slice() : [],
      recordStatuses: Array.isArray(recordStatuses) ? recordStatuses.slice() : null,
      recordWeaponStatuses: trackWeaponStatuses
        ? perRowWeaponStatusLabels.map((arr) => Array.isArray(arr) ? arr.slice() : [])
        : null
    };
  }
  const resultRows = [];
  const collapsedStatuses = Array.isArray(recordStatuses) ? [] : null;
  const collapsedWeaponStatuses = trackWeaponStatuses ? [] : null;
  const skipColumns = new Set();
  if (hasWeaponCol) skipColumns.add(weaponIdx);
  if (hasStatusCol) skipColumns.add(statusIdx);
  const groupMap = new Map();
  const safeRows = Array.isArray(rows) ? rows : [];
  for (let rowIdx = 0; rowIdx < safeRows.length; rowIdx++) {
    const row = Array.isArray(safeRows[rowIdx]) ? safeRows[rowIdx] : [];
    const keyParts = [];
    for (let ci = 0; ci < headers.length; ci++) {
      if (skipColumns.has(ci)) continue;
      const cell = row[ci];
      keyParts.push(cell == null ? '' : String(cell));
    }
    const key = keyParts.join('\u0001');
    let group = groupMap.get(key);
    if (!group) {
      const baseRow = row.slice();
      if (hasWeaponCol) baseRow[weaponIdx] = '';
      if (hasStatusCol) baseRow[statusIdx] = '';
      group = {
        row: baseRow,
        weapons: [],
        statusColumnValues: [],
        metaStatuses: [],
        weaponStatuses: trackWeaponStatuses ? [] : null,
        firstWeapon: hasWeaponCol ? (row[weaponIdx] ?? '') : '',
        firstStatus: hasStatusCol ? (row[statusIdx] ?? '') : ''
      };
      groupMap.set(key, group);
      resultRows.push(group);
    }
    if (hasWeaponCol) group.weapons.push(row[weaponIdx]);
    if (hasStatusCol) group.statusColumnValues.push(row[statusIdx]);
    if (collapsedStatuses) group.metaStatuses.push(recordStatuses[rowIdx]);
    if (trackWeaponStatuses && group.weaponStatuses) {
      const arr = perRowWeaponStatusLabels[rowIdx];
      if (Array.isArray(arr)) {
        for (const label of arr) group.weaponStatuses.push(label);
      }
    }
  }

  const outRows = resultRows.map((group) => {
    if (hasWeaponCol) {
      const fallback = group.firstWeapon == null ? '' : String(group.firstWeapon);
      group.row[weaponIdx] = joinMultilineValues(group.weapons, fallback);
    }
    if (hasStatusCol) {
      const fallback = group.firstStatus == null ? '' : String(group.firstStatus);
      group.row[statusIdx] = joinMultilineValues(group.statusColumnValues, fallback);
    }
    if (collapsedStatuses) {
      // Deduplicate record-level statuses if they are identical across merged rows
      const uniqueMeta = Array.from(new Set(group.metaStatuses.map(s => String(s || '').trim()).filter(Boolean)));
      collapsedStatuses.push(uniqueMeta.length === 1 ? uniqueMeta[0] : joinMultilineValues(group.metaStatuses, ''));
    }
    if (collapsedWeaponStatuses) {
      // Final safeguard: if the list was somehow duplicated (frontend bug), we deduplicate it 
      // but only if it matches the number of weapons we actually have.
      // However, the cleanest fix is in the frontend.
      collapsedWeaponStatuses.push(group.weaponStatuses ? group.weaponStatuses.slice() : []);
    }
    return group.row;
  });

  return {
    rows: outRows,
    recordStatuses: collapsedStatuses,
    recordWeaponStatuses: collapsedWeaponStatuses
  };
}

function deepMerge(a, b) {
  if (!a) return b || {};
  if (!b) return Array.isArray(a) ? a.slice() : { ...a };
  const out = Array.isArray(a) ? a.slice() : { ...a };
  for (const k of Object.keys(b)) {
    const av = a[k], bv = b[k];
    out[k] = (av && bv && typeof av === 'object' && typeof bv === 'object' && !Array.isArray(av) && !Array.isArray(bv)) ? deepMerge(av, bv) : bv;
  }
  return out;
}

function loadPrintPreset() {
  try {
    const file = path.join(SETTING_PATH, 'print-preset.json');
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return null; }
}

function toPositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function detectStatusCodeFromLabel(label) {
  const text = String(label || '').trim();
  if (!text) return 'unknown';
  if (text.includes('جزئي')) return 'partial';
  if (text.includes('غير مسحوب') || text.includes('لم يتم')) return 'not';
  if (text.includes('مسحوب') || text.includes('تم السحب')) return 'got';
  return 'unknown';
}

function countWeaponsFromRow(row, piecesIdx, weaponIdx) {
  const safeRow = Array.isArray(row) ? row : [];
  if (piecesIdx !== -1) {
    const pieceCount = toPositiveInt(String(safeRow[piecesIdx] ?? '').replace(/[^0-9]/g, ''));
    if (pieceCount > 0) return pieceCount;
  }
  if (weaponIdx !== -1) {
    const raw = safeRow[weaponIdx];
    const text = raw == null ? '' : String(raw).trim();
    if (!text) return 0;
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length);
    return lines.length || 1;
  }
  return 0;
}

function computeExportFooterTotals(headers, rows, recordStatuses, statusValue, exportMeta) {
  const totalRecords = Array.isArray(rows) ? rows.length : 0;
  const metaTotals = exportMeta && typeof exportMeta.totals === 'object' ? exportMeta.totals : null;
  if (metaTotals) {
    return {
      totalRecords,
      totalWeapons: Math.max(0, Number(metaTotals.weaponsTotal) || 0),
      withdrawnWeapons: Math.max(0, Number(metaTotals.withdrawnWeapons) || 0),
      notWithdrawnWeapons: Math.max(0, Number(metaTotals.notWithdrawnWeapons) || 0)
    };
  }

  const weaponIdx = findHeaderIndexLoose(headers, 'بيانات السلاح', 'بيان السلاح', 'السلاح');
  const piecesIdx = findHeaderIndexLoose(headers, 'عدد القطع');
  let totalWeapons = 0;
  let withdrawnWeapons = 0;
  let notWithdrawnWeapons = 0;

  for (let i = 0; i < totalRecords; i++) {
    const row = Array.isArray(rows[i]) ? rows[i] : [];
    const weaponCount = countWeaponsFromRow(row, piecesIdx, weaponIdx);
    totalWeapons += weaponCount;

    if (statusValue === 'got') {
      withdrawnWeapons += weaponCount;
      continue;
    }
    if (statusValue === 'not') {
      notWithdrawnWeapons += weaponCount;
      continue;
    }

    const rawStatus = Array.isArray(recordStatuses) ? recordStatuses[i] : '';
    const statusLines = String(rawStatus || '')
      .split(/\r?\n/)
      .map((line) => detectStatusCodeFromLabel(line))
      .filter((code) => code !== 'unknown');

    if (!statusLines.length) {
      notWithdrawnWeapons += weaponCount;
      continue;
    }

    const gotCount = statusLines.filter((code) => code === 'got').length;
    const partialCount = statusLines.filter((code) => code === 'partial').length;
    const weightedGot = gotCount + (partialCount * 0.5);
    const ratio = weightedGot <= 0 ? 0 : Math.min(1, weightedGot / statusLines.length);
    const withdrawnPart = Math.round(weaponCount * ratio);
    withdrawnWeapons += withdrawnPart;
    notWithdrawnWeapons += Math.max(0, weaponCount - withdrawnPart);
  }

  return { totalRecords, totalWeapons, withdrawnWeapons, notWithdrawnWeapons };
}

function normalizeStationFooterSummaryName(value, sectorValue = '') {
  const trimmed = resolveCanonicalStationName(value, sectorValue);
  return trimmed || 'بدون قسم';
}

function normalizeOverallSummaryLabel(value) {
  const trimmed = String(value || '').trim();
  return trimmed || 'الاجمالي العام';
}

function sanitizeStationFooterSummaries(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      station: normalizeStationFooterSummaryName(item?.station),
      totalRecords: Math.max(0, Number(item?.totalRecords) || 0),
      totalWeapons: Math.max(0, Number(item?.totalWeapons) || 0),
      withdrawnWeapons: Math.max(0, Number(item?.withdrawnWeapons) || 0),
      notWithdrawnWeapons: Math.max(0, Number(item?.notWithdrawnWeapons) || 0)
    }))
    .sort((left, right) => left.station.localeCompare(right.station, 'ar', { sensitivity: 'base' }));
}

function computeStationFooterSummaries(headers, rows, recordStatuses, statusValue) {
  const stationIdx = findHeaderIndexLoose(headers, 'القسم', 'القسم التابع');
  if (stationIdx === -1 || !Array.isArray(rows) || !rows.length) return [];

  const sectorIdx = findHeaderIndexLoose(headers, 'القطاع');
  const weaponIdx = findHeaderIndexLoose(headers, 'بيانات السلاح', 'بيان السلاح', 'السلاح');
  const piecesIdx = findHeaderIndexLoose(headers, 'عدد القطع');
  const buckets = new Map();

  for (let i = 0; i < rows.length; i++) {
    const row = Array.isArray(rows[i]) ? rows[i] : [];
    const station = normalizeStationFooterSummaryName(row[stationIdx], sectorIdx !== -1 ? row[sectorIdx] : '');
    if (!buckets.has(station)) {
      buckets.set(station, {
        station,
        totalRecords: 0,
        totalWeapons: 0,
        withdrawnWeapons: 0,
        notWithdrawnWeapons: 0
      });
    }

    const bucket = buckets.get(station);
    const weaponCount = countWeaponsFromRow(row, piecesIdx, weaponIdx);
    bucket.totalRecords += 1;
    bucket.totalWeapons += weaponCount;

    if (statusValue === 'got') {
      bucket.withdrawnWeapons += weaponCount;
      continue;
    }
    if (statusValue === 'not') {
      bucket.notWithdrawnWeapons += weaponCount;
      continue;
    }

    const rawStatus = Array.isArray(recordStatuses) ? recordStatuses[i] : '';
    const statusLines = String(rawStatus || '')
      .split(/\r?\n/)
      .map((line) => detectStatusCodeFromLabel(line))
      .filter((code) => code !== 'unknown');

    if (!statusLines.length) {
      bucket.notWithdrawnWeapons += weaponCount;
      continue;
    }

    const gotCount = statusLines.filter((code) => code === 'got').length;
    const partialCount = statusLines.filter((code) => code === 'partial').length;
    const weightedGot = gotCount + (partialCount * 0.5);
    const ratio = weightedGot <= 0 ? 0 : Math.min(1, weightedGot / statusLines.length);
    const withdrawnPart = Math.round(weaponCount * ratio);
    bucket.withdrawnWeapons += withdrawnPart;
    bucket.notWithdrawnWeapons += Math.max(0, weaponCount - withdrawnPart);
  }

  return Array.from(buckets.values()).sort((left, right) => left.station.localeCompare(right.station, 'ar', { sensitivity: 'base' }));
}

function buildStationFooterColumns(statusValue) {
  const columns = [
    { key: 'station', label: 'القسم' },
    { key: 'totalRecords', label: 'اجمالي الرخص' },
    { key: 'totalWeapons', label: 'اجمالي عدد الاسلحة' }
  ];
  if (statusValue === 'got') {
    columns.push({ key: 'withdrawnWeapons', label: 'اجمالي الاسلحة المسحوبة' });
  } else if (statusValue === 'not') {
    columns.push({ key: 'notWithdrawnWeapons', label: 'اجمالي الاسلحة الغير مسحوبة' });
  } else {
    columns.push({ key: 'withdrawnWeapons', label: 'اجمالي الاسلحة المسحوبة' });
    columns.push({ key: 'notWithdrawnWeapons', label: 'اجمالي الاسلحة الغير مسحوبة' });
  }
  return columns;
}

function buildStationFooterColumnWeights(summaryColumnCount) {
  if (summaryColumnCount === 5) return [4, 2, 3, 2.5, 2.5];
  if (summaryColumnCount === 4) return [4, 2, 4, 4];
  if (summaryColumnCount === 3) return [5, 2, 5];
  return new Array(Math.max(0, summaryColumnCount)).fill(1);
}

function buildStationFooterColumnRanges(totalColumns, summaryColumnCount) {
  const safeTotalColumns = Math.max(1, Number(totalColumns) || 1);
  const safeSummaryColumns = Math.max(1, Number(summaryColumnCount) || 1);
  if (safeSummaryColumns === 1) return [[1, safeTotalColumns]];

  const weights = buildStationFooterColumnWeights(safeSummaryColumns);
  const sum = weights.reduce((acc, value) => acc + value, 0) || safeSummaryColumns;
  const base = weights.map((value) => Math.max(1, Math.floor((value / sum) * safeTotalColumns)));
  let allocated = base.reduce((acc, value) => acc + value, 0);

  while (allocated > safeTotalColumns) {
    let changed = false;
    for (let i = 0; i < base.length && allocated > safeTotalColumns; i++) {
      if (base[i] > 1) {
        base[i] -= 1;
        allocated -= 1;
        changed = true;
      }
    }
    if (!changed) break;
  }
  while (allocated < safeTotalColumns) {
    let targetIndex = 0;
    let targetValue = -Infinity;
    for (let i = 0; i < weights.length; i++) {
      if (weights[i] > targetValue) {
        targetValue = weights[i];
        targetIndex = i;
      }
    }
    base[targetIndex] += 1;
    allocated += 1;
  }

  const ranges = [];
  let cursor = 1;
  for (let i = 0; i < base.length; i++) {
    const span = Math.max(1, base[i]);
    const start = cursor;
    const end = Math.min(safeTotalColumns, cursor + span - 1);
    ranges.push([start, end]);
    cursor = end + 1;
  }
  if (ranges.length) {
    ranges[ranges.length - 1][1] = safeTotalColumns;
  }
  return ranges;
}

async function writeTempXlsxFromCsv(csvText, opts = {}) {
  let ExcelJS;
  try { ExcelJS = require('exceljs'); } catch (e) { throw new Error('exceljs not installed'); }
  try {
    const preset = loadPrintPreset();
    if (preset) opts = deepMerge(preset, opts || {});
  } catch {}
  const parsed = parseCsvServer(csvText);
  const headers = parsed.headers || [];
  if (!headers.length) throw new Error('no headers');
  let rows = Array.isArray(parsed.rows) ? parsed.rows : [];
  const exportMeta = (opts && typeof opts.exportMeta === 'object' && opts.exportMeta) || {};
  const statusValue = typeof exportMeta.statusValue === 'string' ? exportMeta.statusValue.trim() : '';
  const statusLabel = typeof exportMeta.statusLabel === 'string' ? exportMeta.statusLabel.trim() : '';
  const selectedStationTitle = typeof exportMeta.selectedStationTitle === 'string' ? exportMeta.selectedStationTitle.trim() : '';
  const tableTitleRaw = typeof exportMeta.tableTitle === 'string' ? exportMeta.tableTitle.trim() : '';
  const statusColumnHeaderRaw = typeof exportMeta.statusColumnHeader === 'string' ? exportMeta.statusColumnHeader.trim() : '';
  let recordStatuses = null;
  if (Array.isArray(exportMeta.recordStatusLabels) && exportMeta.recordStatusLabels.length === rows.length) {
    recordStatuses = exportMeta.recordStatusLabels.map((value) => {
      const trimmed = (value == null) ? '' : String(value).trim();
      return trimmed || 'غير مسحوب';
    });
  }
  let perRowWeaponStatusLabels = null;
  if (Array.isArray(exportMeta.recordWeaponStatusLabels) && exportMeta.recordWeaponStatusLabels.length === rows.length) {
    perRowWeaponStatusLabels = exportMeta.recordWeaponStatusLabels.map((arr) => {
      if (!Array.isArray(arr)) return [];
      return arr.map((label) => {
        const trimmed = (label == null) ? '' : String(label).trim();
        return trimmed || 'غير مسحوب';
      });
    });
  }
  const collapseResult = collapseRowsByWeapons(headers, rows, recordStatuses, perRowWeaponStatusLabels);
  rows = collapseResult.rows;
  if (Array.isArray(recordStatuses)) {
    recordStatuses = Array.isArray(collapseResult.recordStatuses)
      ? collapseResult.recordStatuses
      : rows.map(() => 'غير مسحوب');
  }
  const collapsedWeaponStatusLabels = Array.isArray(collapseResult.recordWeaponStatuses)
    ? collapseResult.recordWeaponStatuses
    : null;
  const grouping = computeStationGrouping(headers, rows);
  const serialsByStation = Array.isArray(grouping.serials) && grouping.serials.length === rows.length
    ? grouping.serials
    : rows.map((_, i) => i + 1);
  const statusHeaderName = (statusColumnHeaderRaw || 'حالة السحب').trim();
  const existingStatusHeaderIndex = headers.findIndex((value) => String(value || '').trim() === statusHeaderName);
  const hasStatusHeaderInCsv = existingStatusHeaderIndex !== -1;
  const includeStatusColumn = statusValue === 'both'
    && Array.isArray(recordStatuses)
    && recordStatuses.length === rows.length
    && !hasStatusHeaderInCsv;
  const statusColumnHeader = includeStatusColumn ? statusHeaderName : null;
  let tableTitle = '';
  if (statusValue === 'got' || statusValue === 'not') {
    tableTitle = tableTitleRaw || (selectedStationTitle && statusLabel ? `${selectedStationTitle} - ${statusLabel}` : '') || statusLabel || selectedStationTitle || '';
  } else if (selectedStationTitle) {
    tableTitle = tableTitleRaw || selectedStationTitle;
  }
  tableTitle = tableTitle && tableTitle.trim() ? tableTitle.trim() : '';
  const tableStartRow = tableTitle ? 2 : 1;

  ensureDirSync(TMP_PATH);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fname = `filtered-${stamp}.xlsx`;
  const fpath = path.join(TMP_PATH, fname);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Filtered');
  const rtl = (opts && typeof opts.rtl === 'boolean') ? !!opts.rtl : true;
  ws.views = [{ rightToLeft: rtl, zoomScale: 100, zoomScaleNormal: 100 }];

  const outHeaders = ['م', ...headers];
  if (includeStatusColumn && statusColumnHeader) outHeaders.push(statusColumnHeader);

  const colWidths = Array.isArray(opts && opts.columnWidths) ? opts.columnWidths : [];
  const preferredSplitWidthForHeader = (header) => {
    const name = normalizeHeaderName(header);
    if (name === 'بيانات السلاح' || name === 'بيان السلاح' || name === 'السلاح') return 46;
    if (name === 'رقم الايداع' || name === 'رقم الإيداع') return 14;
    if (name === 'تاريخ الايداع' || name === 'تاريخ الإيداع') return 28;
    if (name === 'حالة السحب') return 21;
    if (name === 'ملاحظات' || name === 'ملاحظة') return 51;
    return null;
  };
  const splitLineTrimForHeader = (header) => {
    const name = normalizeHeaderName(header);
    if (name === 'بيانات السلاح' || name === 'بيان السلاح' || name === 'السلاح') return 7;
    if (name === 'رقم الايداع' || name === 'رقم الإيداع') return 2;
    if (name === 'تاريخ الايداع' || name === 'تاريخ الإيداع') return 4;
    return 0;
  };
  const getSep = (colIdx, offset = 0) => {
    const header = outHeaders[colIdx];
    const preferredWidth = preferredSplitWidthForHeader(header);
    const w = typeof preferredWidth === 'number'
      ? preferredWidth
      : (typeof colWidths[colIdx] === 'number' ? colWidths[colIdx] : 20);
    // Aim for ~70% of the column width to ensure it doesn't wrap even with padding
    const count = Math.max(5, Math.min(60, Math.floor(w * 0.7) + offset - splitLineTrimForHeader(header)));
    return '\n' + '─'.repeat(count) + '\n';
  };

  // Index of the weapons column in the data rows (0-based, before the serial prefix)
  const weaponColForExcel = findHeaderIndexLoose(headers, 'بيانات السلاح', 'بيان السلاح', 'السلاح');
  const depositNumColForExcel = findHeaderIndexLoose(headers, 'رقم الايداع', 'رقم الإيداع');
  const depositDateColForExcel = findHeaderIndexLoose(headers, 'تاريخ الايداع', 'تاريخ الإيداع');
  const statusColForExcel = findHeaderIndexLoose(headers, 'حالة السحب');

  // Weapons cells use ' + ' or newline as the join token
  const splitWeaponCell = (text) => text.split(/[ \t]*\+[ \t]*|\r?\n/).map((s) => s.trim()).filter(Boolean);
  const strongDepositTokenRe = /[0-9\u0660-\u0669\u06F0-\u06F9]{1,6}\s*[/\\]\s*[A-Za-z\u0621-\u064A]+/g;
  const looseDepositTokenRe = /[0-9\u0660-\u0669\u06F0-\u06F9]{1,6}\s*(?:[/\\]\s*[A-Za-z\u0621-\u064A]+|[A-Za-z\u0621-\u064A]+)?/g;
  const depositDateTokenRe = /[0-9\u0660-\u0669\u06F0-\u06F9]{1,4}\s*[/-]\s*[0-9\u0660-\u0669\u06F0-\u06F9]{1,2}\s*[/-]\s*[0-9\u0660-\u0669\u06F0-\u06F9]{1,4}/g;
  const normalizeDepositToken = (raw, nextChar = '') => {
    let token = String(raw || '').trim().replace(/\s*([/\\])\s*/g, '$1').replace(/\s+/g, '');
    if (/^[0-9\u0660-\u0669\u06F0-\u06F9]+\u0648$/.test(token) && /^[0-9\u0660-\u0669\u06F0-\u06F9]/.test(String(nextChar || ''))) {
      token = token.slice(0, -1);
    }
    return token;
  };
  const collectDepositMatches = (text, regex) => {
    const matches = [];
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const raw = match[0];
      const token = normalizeDepositToken(raw, text.charAt(match.index + raw.length));
      if (token) matches.push({ raw, index: match.index, token });
    }
    return matches;
  };
  const residueWithoutMatches = (text, matches) => {
    let residue = '';
    let cursor = 0;
    matches.forEach((match) => {
      residue += text.slice(cursor, match.index);
      cursor = match.index + String(match.raw || '').length;
    });
    residue += text.slice(cursor);
    return residue.replace(/[,\s،;؛+|/\\\-–—]+/g, '').trim();
  };
  const extractDepositNumberParts = (text) => {
    const source = String(text || '').trim();
    if (!source) return [];
    const strongMatches = collectDepositMatches(source, strongDepositTokenRe);
    if (strongMatches.length > 1) return strongMatches.map((match) => match.token);
    const looseMatches = collectDepositMatches(source, looseDepositTokenRe);
    if (looseMatches.length <= 1) return [];
    if (residueWithoutMatches(source, looseMatches)) return [];
    return looseMatches.map((match) => match.token);
  };
  const extractDepositDateParts = (text) => {
    const parts = [];
    depositDateTokenRe.lastIndex = 0;
    let match;
    while ((match = depositDateTokenRe.exec(String(text || ''))) !== null) {
      parts.push(String(match[0] || '').replace(/\s*([/-])\s*/g, '$1').trim());
    }
    return parts;
  };
  const splitExplicitPerWeaponFieldCell = (text) => {
    const value = String(text || '').trim();
    if (!value) return [];
    if (!/[|+\r\n]/.test(value)) return [value];
    return value.split(/[ \t]*\|[ \t]*|[ \t]*\+[ \t]*|\r?\n/).map((s) => s.trim()).filter(Boolean);
  };
  const splitDepositNumberCell = (text) => {
    const parts = splitExplicitPerWeaponFieldCell(text);
    if (parts.length !== 1) return parts;
    const tokens = extractDepositNumberParts(parts[0]);
    return tokens.length > 1 ? tokens : parts;
  };
  const splitDepositDateCell = (text) => {
    const parts = splitExplicitPerWeaponFieldCell(text);
    if (parts.length !== 1) return parts;
    const tokens = extractDepositDateParts(parts[0]);
    return tokens.length > 1 ? tokens : parts;
  };

  const outRows = rows.map((r, i) => {
    const safeR = Array.isArray(r) ? r : [];
    const perWeapon = collapsedWeaponStatusLabels?.[i];

    const mapped = safeR.map((cell, ci) => {
      if (cell == null) return cell;
      // Split multi-weapon cells (joined by ' + ' or existing newlines) and add a visual divider
      if (ci === weaponColForExcel) {
        const text = String(cell).trim();
        if (text) {
          const parts = splitWeaponCell(text);
          if (parts.length > 1) return parts.join(getSep(ci + 1));
        }
        return cell;
      }
      // Split multi-value weapon fields with the same divider so each weapon's data aligns visually
      if (ci === depositNumColForExcel || ci === depositDateColForExcel) {
        const text = String(cell).trim();
        if (text) {
          const parts = ci === depositNumColForExcel
            ? splitDepositNumberCell(text)
            : splitDepositDateCell(text);
          if (parts.length > 1) return parts.join(getSep(ci + 1));
        }
        return cell;
      }
      // Split multi-status cells (if present in CSV) with the same divider
      if (ci === statusColForExcel) {
        const weaponCellVal = String(safeR[weaponColForExcel] || '').trim();
        const weaponCount = splitWeaponCell(weaponCellVal).length;

        // If we have detailed weapon statuses from the app, use them!
        // We use them if we have multiple statuses, OR if we have only 1 status but multiple weapons
        // (to ensure consistent vertical alignment).
        if (Array.isArray(perWeapon) && perWeapon.length > 0) {
          if (perWeapon.length > 1 || weaponCount > 1) {
            return perWeapon.join(getSep(ci + 1, -3));
          }
        }
        const text = String(cell).trim();
        if (text) {
          const parts = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
          // If we have multiple lines but they are all the same record-level status, 
          // and we have individual weapon info available elsewhere, this fallback might be redundant.
          // However, if we have multiple DIFFERENT parts, we should join them.
          if (parts.length > 1) {
            // Deduplicate if all parts are the same and we have individual weapon info above?
            // For now, just join them with the separator.
            return parts.join(getSep(ci + 1, -3));
          }
        }
        return cell;
      }
      return cell;
    });
    const row = [serialsByStation[i] ?? (i + 1), ...mapped];
    if (includeStatusColumn) {
      const overallStatus = recordStatuses?.[i] ?? '';
      // Join per-weapon status labels with dashes if multiple weapons exist
      if (Array.isArray(perWeapon) && perWeapon.length > 1) {
        row.push(perWeapon.join(getSep(outHeaders.length - 1, -3)));
      } else {
        row.push(overallStatus);
      }
    }
    return row;
  });
  const tableRef = `A${tableStartRow}`;
  ws.addTable({ name: 'FilteredTable', ref: tableRef, headerRow: true, totalsRow: false,
    style: { theme: (opts && opts.tableStyle) || 'TableStyleMedium15', showRowStripes: true },
    columns: outHeaders.map(h => ({ name: h })), rows: outRows });

  const defaultFont = (opts && opts.font) ? { name: opts.font.name || 'Calibri', size: opts.font.size || 17 } : { name: 'Calibri', size: 17 };
  const colCount = outHeaders.length;
  const widths = Array.isArray(opts && opts.columnWidths) ? opts.columnWidths : null;
  for (let i = 1; i <= colCount; i++) {
    const col = ws.getColumn(i);
    if (widths && typeof widths[i-1] === 'number') col.width = widths[i-1];
    const align = (opts && opts.alignment) || {};
    col.alignment = { horizontal: align.horizontal || 'center', vertical: align.vertical || 'middle', wrapText: typeof align.wrapText === 'boolean' ? !!align.wrapText : true };
    col.font = defaultFont;
  }
  try {
    const statusHeaderCandidates = new Set([statusHeaderName, 'حالة السحب']);
    const weaponCandidates = new Set(['بيانات السلاح', 'بيان السلاح', 'السلاح']);
    const depNumCandidates = new Set(['رقم الايداع', 'رقم الإيداع']);
    const depDateCandidates = new Set(['تاريخ الايداع', 'تاريخ الإيداع']);
    const notesCandidates = new Set(['ملاحظات']);

    outHeaders.forEach((headerValue, headerIndex) => {
      const name = String(headerValue || '').trim();
      const col = ws.getColumn(headerIndex + 1);
      if (statusHeaderCandidates.has(name)) {
        col.width = 21;
      } else if (weaponCandidates.has(name)) {
        col.width = 46;
      } else if (depNumCandidates.has(name)) {
        col.width = 14;
      } else if (depDateCandidates.has(name)) {
        col.width = 28;
      } else if (notesCandidates.has(name)) {
        col.width = 51;
      }
    });
  } catch (_) {}
  // Ensure header row text is white
  try { const hdr = ws.getRow(tableStartRow); hdr.eachCell(c => { c.font = { ...(c.font||defaultFont), color: { argb: 'FFFFFFFF' } }; }); } catch {}

  if (tableTitle) {
    try {
      ws.mergeCells(1, 1, 1, colCount);
      const titleCell = ws.getCell(1, 1);
      titleCell.value = tableTitle;
  const titleFont = { ...(defaultFont || {}), bold: true };
  titleFont.size = (typeof titleFont.size === 'number') ? titleFont.size + 2 : 19;
      titleCell.font = titleFont;
      titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    } catch (_) {}
  }

  try {
    const ps = (opts && opts.pageSetup) || {};
    ws.pageSetup = { orientation: ps.orientation || 'landscape', paperSize: ps.papersize || 8, horizontalCentered: true, verticalCentered: false,
      margins: ps.margins || { left: 0.39, right: 0.39, top: 0.39, bottom: 0.39, header: 0.2, footer: 0.2 } };
    ws.pageSetup.fitToPage = true; ws.pageSetup.fitToWidth = (opts && opts.fitAllCols === false) ? undefined : 1; ws.pageSetup.fitToHeight = 0;
  } catch {}

  // Add totals/footer row below the generated table
  try {
    const lastRowNum = (ws.lastRow && ws.lastRow.number) ? ws.lastRow.number : (tableStartRow + (rows ? rows.length : 0));
    const footerStartRow = lastRowNum + 1; // no blank row gap
    const _thick = { style: 'thick', color: { argb: 'FF000000' } };
    const _thin  = { style: 'thin',  color: { argb: 'FF000000' } };
    const usePerStationFooter = exportMeta?.hasSelectedStation === false;
    const stationSummaries = usePerStationFooter
      ? (sanitizeStationFooterSummaries(exportMeta?.stationFooterSummaries).length
          ? sanitizeStationFooterSummaries(exportMeta?.stationFooterSummaries)
          : computeStationFooterSummaries(headers, rows, recordStatuses, statusValue))
      : [];

    if (usePerStationFooter && stationSummaries.length) {
      const columns = buildStationFooterColumns(statusValue);
      const summaryRanges = buildStationFooterColumnRanges(colCount, columns.length);
      const overallTotals = computeExportFooterTotals(headers, rows, recordStatuses, statusValue, exportMeta);
      const overallSummaryLabel = normalizeOverallSummaryLabel(exportMeta?.overallSummaryLabel);
      ws.mergeCells(footerStartRow, 1, footerStartRow, colCount);
      const titleCell = ws.getCell(footerStartRow, 1);
      titleCell.value = 'ملخص حسب القسم';
      titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      titleCell.font = { ...(defaultFont || {}), bold: true };
      titleCell.border = { top: _thick, bottom: _thin, left: _thick, right: _thick };

      const headerRowIdx = footerStartRow + 1;
      columns.forEach((column, index) => {
        const [startCol, endCol] = summaryRanges[index] || [index + 1, index + 1];
        if (endCol > startCol) ws.mergeCells(headerRowIdx, startCol, headerRowIdx, endCol);
        const cell = ws.getCell(headerRowIdx, startCol);
        cell.value = column.label;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.font = { ...(defaultFont || {}), bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } };
        cell.border = {
          top: _thin,
          bottom: _thin,
          left: startCol === 1 ? _thick : _thin,
          right: endCol === colCount ? _thick : _thin
        };
      });

      stationSummaries.forEach((summary, rowOffset) => {
        const rowIdx = headerRowIdx + 1 + rowOffset;
        columns.forEach((column, index) => {
          const [startCol, endCol] = summaryRanges[index] || [index + 1, index + 1];
          if (endCol > startCol) ws.mergeCells(rowIdx, startCol, rowIdx, endCol);
          const cell = ws.getCell(rowIdx, startCol);
          cell.value = column.key === 'station'
            ? normalizeStationFooterSummaryName(summary.station)
            : Math.max(0, Number(summary[column.key]) || 0);
          cell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
            wrapText: true
          };
          cell.font = { ...(defaultFont || {}), bold: true };
          cell.border = {
            top: _thin,
            bottom: rowOffset === stationSummaries.length - 1 ? _thick : _thin,
            left: startCol === 1 ? _thick : _thin,
            right: endCol === colCount ? _thick : _thin
          };
        });
      });

      const totalRowIdx = headerRowIdx + 1 + stationSummaries.length;
      columns.forEach((column, index) => {
        const [startCol, endCol] = summaryRanges[index] || [index + 1, index + 1];
        if (endCol > startCol) ws.mergeCells(totalRowIdx, startCol, totalRowIdx, endCol);
        const cell = ws.getCell(totalRowIdx, startCol);
        cell.value = column.key === 'station'
          ? overallSummaryLabel
          : Math.max(0, Number(overallTotals[column.key]) || 0);
        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true
        };
        cell.font = { ...(defaultFont || {}), bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        cell.border = {
          top: _thick,
          bottom: _thick,
          left: startCol === 1 ? _thick : _thin,
          right: endCol === colCount ? _thick : _thin
        };
      });
    } else {
      const totals = computeExportFooterTotals(headers, rows, recordStatuses, statusValue, exportMeta);
      const footerLines = [
        `الاجمالي (الرخص): ${totals.totalRecords}`,
        `اجمالي عدد الاسلحة: ${totals.totalWeapons}`
      ];
      if (statusValue === 'got') {
        footerLines.push(`اجمالي الاسلحة المسحوبة: ${totals.withdrawnWeapons}`);
      } else if (statusValue === 'not') {
        footerLines.push(`اجمالي الاسلحة الغير مسحوبة: ${totals.notWithdrawnWeapons}`);
      } else {
        footerLines.push(`اجمالي الاسلحة المسحوبة: ${totals.withdrawnWeapons}`);
        footerLines.push(`اجمالي الاسلحة الغير مسحوبة: ${totals.notWithdrawnWeapons}`);
      }
      for (let fi = 0; fi < footerLines.length; fi++) {
        const rowIdx = footerStartRow + fi;
        ws.mergeCells(rowIdx, 1, rowIdx, colCount);
        const cell = ws.getCell(rowIdx, 1);
        cell.value = footerLines[fi];
        cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: false };
        cell.font = { ...(defaultFont || {}), bold: true };
        cell.border = {
          top:    fi === 0 ? _thick : _thin,
          bottom: fi === footerLines.length - 1 ? _thick : _thin,
          left:   _thick,
          right:  _thick
        };
      }
    }
  } catch (e) {
    // non-fatal: if ExcelJS doesn't like merge/lastRow, continue without footer
    try { console.error('Failed to add totals footer to XLSX:', e && e.message || e); } catch (_) {}
  }

  // Apply thin grid borders across the table so Excel renders consistent cell outlines
  try {
    const thin = { style: 'thin', color: { argb: 'FF000000' } };
    const headerRowNumber = tableStartRow;
    const lastRowNumber = rows.length ? headerRowNumber + rows.length : headerRowNumber;
    for (let r = headerRowNumber; r <= lastRowNumber; r++) {
      const row = ws.getRow(r);
      row.eachCell((cell) => {
        const border = { ...(cell.border || {}) };
        if (!border.top) border.top = thin;
        if (!border.bottom) border.bottom = thin;
        if (!border.left) border.left = thin;
        if (!border.right) border.right = thin;
        cell.border = border;
      });
    }
  } catch (_) {}

  // Emphasise station group boundaries with thicker black borders
  try {
    const topFlags = Array.isArray(grouping.top) ? grouping.top : [];
    const bottomFlags = Array.isArray(grouping.bottom) ? grouping.bottom : [];
    if (rows.length) {
      const dataStartRow = tableStartRow + 1; // Header occupies tableStartRow
      for (let i = 0; i < rows.length; i++) {
        const applyTop = Boolean(topFlags[i]) || i === 0;
        const applyBottom = Boolean(bottomFlags[i]) && i !== rows.length - 1;
        if (!applyTop && !applyBottom) continue;
        const excelRow = ws.getRow(dataStartRow + i);
        excelRow.eachCell((cell) => {
          const border = { ...(cell.border || {}) };
          if (applyTop) border.top = { style: 'thick', color: { argb: 'FF000000' } };
          if (applyBottom) border.bottom = { style: 'thick', color: { argb: 'FF000000' } };
          cell.border = border;
        });
        excelRow.commit?.();

        // Also reinforce the boundary by setting the adjacent row border
        if (applyTop && i > 0) {
          const prevRow = ws.getRow(dataStartRow + i - 1);
          prevRow.eachCell((cell) => {
            const border = { ...(cell.border || {}) };
            border.bottom = { style: 'thick', color: { argb: 'FF000000' } };
            cell.border = border;
          });
          prevRow.commit?.();
        }
        if (applyBottom && i < rows.length - 1) {
          const nextRow = ws.getRow(dataStartRow + i + 1);
          nextRow.eachCell((cell) => {
            const border = { ...(cell.border || {}) };
            border.top = { style: 'thick', color: { argb: 'FF000000' } };
            cell.border = border;
          });
          nextRow.commit?.();
        }
      }
    }
  } catch (_) {}

  await wb.xlsx.writeFile(fpath);
  return { urlPath: `/weapons/tmp/${fname}`, localPath: fpath };
}

function writeTempCsvAndReturnUrl(csvText) {
  let txt = String(csvText || '');
  if (!txt.startsWith('\uFEFF')) txt = '\uFEFF' + txt;
  ensureDirSync(TMP_PATH);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fname = `filtered-${stamp}.csv`;
  const fpath = path.join(TMP_PATH, fname);
  fs.writeFileSync(fpath, txt, 'utf8');
  return { urlPath: `/weapons/tmp/${fname}`, localPath: fpath };
}

// Save TEMP CSV and return URL (and variants)
router.post('/save-temp-csv', (req, res) => {
  try { const { urlPath } = writeTempCsvAndReturnUrl(req.body ?? ''); res.setHeader('Location', urlPath); res.status(201).json({ ok: true, url: urlPath }); }
  catch (e) { res.status(500).json({ ok: false, message: 'server error' }); }
});
router.post('/temp-csv', (req, res) => { req.url = '/save-temp-csv'; router.handle(req, res); });
router.post('/upload-temp-csv', (req, res) => { req.url = '/save-temp-csv'; router.handle(req, res); });

// Open TEMP CSV in Excel
router.post('/open-temp-csv', (req, res) => {
  try {
    const { urlPath, localPath } = writeTempCsvAndReturnUrl(req.body ?? '');
    openCsvPreferExcel(localPath, (err) => {
      if (err) return res.status(500).json({ ok: false, message: 'failed to launch Excel' });
      res.setHeader('Location', urlPath); return res.status(201).json({ ok: true, url: urlPath });
    });
  } catch (e) { res.status(500).json({ ok: false, message: 'server error' }); }
});

// Save a styled XLSX to temp and return URL
router.post('/save-temp-xlsx', async (req, res) => {
  try { const { urlPath } = await writeTempXlsxFromCsv(req.body ?? ''); res.setHeader('Location', urlPath); return res.status(201).json({ ok: true, url: urlPath }); }
  catch (e) { const msg = String(e && e.message || e); if (/exceljs not installed/i.test(msg)) return res.status(501).json({ ok: false, message: 'exceljs not installed' }); return res.status(500).json({ ok: false, message: 'server error' }); }
});

// Save styled XLSX to temp and open in Excel
router.post('/open-temp-xlsx', async (req, res) => {
  try {
    const { urlPath, localPath } = await writeTempXlsxFromCsv(req.body ?? '');
    openXlsxSmart(localPath, (err) => {
      if (err) return res.status(500).json({ ok: false, message: 'failed to launch Excel' });
      res.setHeader('Location', urlPath); return res.status(201).json({ ok: true, url: urlPath });
    });
  } catch (e) { const msg = String(e && e.message || e); if (/exceljs not installed/i.test(msg)) return res.status(501).json({ ok: false, message: 'exceljs not installed' }); return res.status(500).json({ ok: false, message: 'server error' }); }
});

// JSON options variants
router.post('/save-temp-xlsx-opts', async (req, res) => {
  try { const body = (typeof req.body === 'object' && req.body) || {}; const { urlPath } = await writeTempXlsxFromCsv(body.csvText || '', body.options || {}); res.setHeader('Location', urlPath); return res.status(201).json({ ok: true, url: urlPath }); }
  catch (e) { const msg = String(e && e.message || e); if (/exceljs not installed/i.test(msg)) return res.status(501).json({ ok: false, message: 'exceljs not installed' }); return res.status(500).json({ ok: false, message: 'server error' }); }
});

router.post('/open-temp-xlsx-opts', async (req, res) => {
  try {
    const body = (typeof req.body === 'object' && req.body) || {};
    const { urlPath, localPath } = await writeTempXlsxFromCsv(body.csvText || '', body.options || {});
    openXlsxSmart(localPath, (err) => {
      if (err) return res.status(500).json({ ok: false, message: 'failed to launch Excel' });
      res.setHeader('Location', urlPath); return res.status(201).json({ ok: true, url: urlPath });
    });
  } catch (e) { const msg = String(e && e.message || e); if (/exceljs not installed/i.test(msg)) return res.status(501).json({ ok: false, message: 'exceljs not installed' }); return res.status(500).json({ ok: false, message: 'server error' }); }
});

// Open styled XLSX into Excel's Print preview
router.post('/open-temp-xlsx-opts-print', async (req, res) => {
  try {
    const body = (typeof req.body === 'object' && req.body) || {};
    const { urlPath, localPath } = await writeTempXlsxFromCsv(body.csvText || '', body.options || {});
    const fontName = (body.options && body.options.font && body.options.font.name) || 'Calibri';
    const fontSize = (body.options && body.options.font && body.options.font.size) || 17;
    const ps =
          "powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command " +
          '"$p=\'' + String(localPath).replace(/'/g, "''") + '\'; ' +
          "$fname='" + String(fontName).replace(/'/g, "''") + '\'; ' +
          "$fsize=" + (parseInt(fontSize,10) || 17) + "; " +
          "$xl = New-Object -ComObject Excel.Application; $xl.Visible=$true; $xl.DisplayAlerts=$false; " +
          // === Auto-close activation popup, but stop if not found ===
          // "Start-Job { " +
          // "  $wshell = New-Object -ComObject WScript.Shell; " +
          // "  $found = $false; " +
          // "  for($i=0; $i -lt 20; $i++){ " + // 20 * 500ms = 10 seconds max
          // "    Start-Sleep -Milliseconds 500; " +
          // "    if($wshell.AppActivate('Microsoft Office Activation Wizard')){ " +
          // "      $wshell.SendKeys('%{F4}'); " +
          // "      $found = $true; break; " +
          // "    } " +
          // "  } " +
          // "  if(-not $found){ Write-Host 'No activation window detected, watcher stopped.' } " +
          // "} | Out-Null; " +
          // === Continue Excel automation ===
          "$wb=$xl.Workbooks.Open($p); Start-Sleep -Milliseconds 1200; try{ $ws=$wb.Worksheets.Item(1); $ws.Activate() } catch { $ws=$wb.ActiveSheet }; " +
          // "try{ $xl.Application.SendKeys('{ESC}', $true) }catch{}; " +
          // "try{ $rng=$ws.UsedRange; if($rng){ $f=$rng.Font; if($f){ $f.Name=$fname; $f.Size=$fsize } } }catch{}; " +
          // "try{ $xl.ActiveWindow.View = -4154; $xl.ActiveWindow.Zoom = 100 }catch{}; " +
          // "try{ $xl.CommandBars.ExecuteMso('PrintPreviewAndPrint') }catch{}; " +
          '"';


    exec(ps, { windowsHide: true }, (err) => {
      if (err) return res.status(500).json({ ok: false, message: 'failed to launch Excel print UI' });
      res.setHeader('Location', urlPath); return res.status(201).json({ ok: true, url: urlPath });
    });
  } catch (e) { const msg = String(e && e.message || e); if (/exceljs not installed/i.test(msg)) return res.status(501).json({ ok: false, message: 'exceljs not installed' }); return res.status(500).json({ ok: false, message: 'server error' }); }
});

// ================= Recall/Undo Endpoints =================

// Get list of deleted rows
router.get('/recall-list', (req, res) => {
  try {
    const filePath = resolveUndoFile();
    if (!fs.existsSync(filePath)) {
      return res.json({ ok: true, rows: [] });
    }
    const data = fs.readFileSync(filePath, 'utf8');
    const rows = JSON.parse(data);
    res.json({ ok: true, rows: Array.isArray(rows) ? rows : [] });
  } catch (error) {
    console.error('Error reading recall list:', error);
    res.status(500).json({ ok: false, message: 'Error reading recall list' });
  }
});

// Recover deleted rows
router.post('/recall-recover', (req, res) => {
  try {
    const filePath = resolveUndoFile();
    const { rows, removeFromRecall } = req.body || {};
    if (!Array.isArray(rows) || !rows.length) {
      return res.json({ ok: false, message: 'No rows to recover' });
    }

    const current = weaponsSqlStore.getRecords();
    const recoveredRows = rows.map((row) => Array.isArray(row) ? row : []);
    weaponsSqlStore.replaceFromRows(current.headers, [...current.rows, ...recoveredRows]);
    
    // Remove recovered rows from recall list if requested
    if (removeFromRecall) {
      try {
        if (fs.existsSync(filePath)) {
          const recallData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const rowsSet = new Set(rows.map(r => JSON.stringify(r)));
          const remainingRows = recallData.filter(r => !rowsSet.has(JSON.stringify(r)));
          fs.writeFileSync(filePath, JSON.stringify(remainingRows, null, 2), 'utf8');
        }
      } catch (e) {
        console.error('Error updating recall list:', e);
      }
    }
    
    res.json({ ok: true, recovered: rows.length });
  } catch (error) {
    console.error('Error recovering rows:', error);
    res.status(500).json({ ok: false, message: 'Error recovering rows' });
  }
});

// Store deleted rows (called when deleting rows)
router.post('/store-deleted', (req, res) => {
  try {
    const filePath = resolveUndoFile();
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || !rows.length) {
      return res.json({ ok: true, message: 'No rows to store' });
    }
    
    let existingRows = [];
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, 'utf8');
        existingRows = JSON.parse(data);
      } catch (e) {
        console.error('Error reading existing recall file:', e);
      }
    }
    
    // Add new deleted rows to the beginning
    const updatedRows = [...rows, ...existingRows];
    
    // Keep only last 1000 deleted rows to prevent file from growing too large
    const limitedRows = updatedRows.slice(0, 1000);
    
    fs.writeFileSync(filePath, JSON.stringify(limitedRows, null, 2), 'utf8');
    res.json({ ok: true, stored: rows.length });
  } catch (error) {
    console.error('Error storing deleted rows:', error);
    res.status(500).json({ ok: false, message: 'Error storing deleted rows' });
  }
});

// --- Weapons state JSON API ---
router.get('/weapon-state', (req, res) => {
  try {
    const sqlList = weaponsSqlStore.getWeaponStateEntries();
    const sidecarList = loadWeaponsStateData();
    const sidecarByRecord = new Map();
    const sidecarByLegacy = new Map();
    sidecarList.forEach((entry) => {
      const normalized = normalizeWeaponStateEntry(entry);
      if (!normalized) return;
      if (normalized.recordKey) sidecarByRecord.set(normalized.recordKey, normalized);
      const legacy = buildLegacyWithdrawKey(normalized.name, normalized.license);
      if (legacy) {
        if (!sidecarByLegacy.has(legacy)) sidecarByLegacy.set(legacy, []);
        sidecarByLegacy.get(legacy).push(normalized);
      }
    });
    const list = sqlList.map((entry) => {
      const rawSqlEntry = entry && typeof entry === 'object' ? entry : {};
      const sqlEntry = normalizeWeaponStateEntry(entry);
      if (!sqlEntry) return null;
      const recordKeyCandidates = [
        sqlEntry.recordKey,
        typeof rawSqlEntry.legacyRecordKey === 'string' ? rawSqlEntry.legacyRecordKey.trim() : ''
      ].filter(Boolean);
      let sidecar = null;
      for (const key of recordKeyCandidates) {
        const candidate = sidecarByRecord.get(key);
        if (candidate && (isStableWithdrawRecordKey(key) || weaponStateIdentityMatches(candidate, sqlEntry.name, sqlEntry.license))) {
          sidecar = candidate;
          break;
        }
      }
      if (!sidecar) {
        const legacyBucket = sidecarByLegacy.get(buildLegacyWithdrawKey(sqlEntry.name, sqlEntry.license));
        if (Array.isArray(legacyBucket) && legacyBucket.length === 1) {
          sidecar = legacyBucket[0];
        }
      }
      if (!sidecar || !Array.isArray(sidecar.weapons)) return sqlEntry;
      const piecesByName = new Map();
      sidecar.weapons.forEach((weapon) => {
        const key = normalizeWeaponTextServer(weapon && weapon.name);
        if (key && weapon.pieces != null) piecesByName.set(key, weapon.pieces);
      });
      sqlEntry.weapons = sqlEntry.weapons.map((weapon) => {
        const next = { ...weapon };
        const key = normalizeWeaponTextServer(next.name);
        if (key && piecesByName.has(key)) next.pieces = piecesByName.get(key);
        return next;
      });
      return sqlEntry;
    }).filter(Boolean);
    return res.json({ ok: true, list });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'failed to load weapons state data' });
  }
});

router.post('/weapon-state/set', (req, res) => {
  try {
    const body = (typeof req.body === 'object' && req.body) ? req.body : {};
    const name = String(body.name || '').trim();
    const license = String(body.license || '').trim();
    const weapons = Array.isArray(body.weapons) ? body.weapons : [];
    const recordKey = typeof body.recordKey === 'string' ? body.recordKey.trim() : '';
    const persistedRecordKey = typeof body.persistedRecordKey === 'string' ? body.persistedRecordKey.trim() : '';
    if (!name || !license) return res.status(400).json({ ok: false, message: 'missing name or license' });

    const arr = loadWeaponsStateData();
    const { entry } = ensureWeaponsEntry(arr, { recordKey, persistedRecordKey, name, license });
    if (!entry) return res.status(400).json({ ok: false, message: 'failed to resolve entry' });
    entry.weapons = weapons.map(normalizeWeaponStateWeapon).filter(Boolean);
    entry.updatedAt = Date.now();
    saveWeaponsStateData(arr);
    return res.json({ ok: true, entry: normalizeWeaponStateEntry(entry) });
  } catch (e) {
    console.error('weapon-state/set error', e);
    return res.status(500).json({ ok: false, message: 'failed to set weapons state' });
  }
});

router.post('/weapon-state/update-weapon', (req, res) => {
  try {
    const body = (typeof req.body === 'object' && req.body) ? req.body : {};
    const name = String(body.name || '').trim();
    const license = String(body.license || '').trim();
    const weaponName = String(body.weaponName || body.weapon || '').trim();
    const recordKey = typeof body.recordKey === 'string' ? body.recordKey.trim() : '';
    const persistedRecordKey = typeof body.persistedRecordKey === 'string' ? body.persistedRecordKey.trim() : '';
    if (!name || !license || !weaponName) return res.status(400).json({ ok: false, message: 'missing fields' });

    const arr = loadWeaponsStateData();
    const { entry } = ensureWeaponsEntry(arr, { recordKey, persistedRecordKey, name, license });
    if (!entry) return res.status(400).json({ ok: false, message: 'failed to resolve entry' });

    const pieces = normalizeWeaponStatePieces(body.pieces ?? body.count);
    let weapon = entry.weapons.find(x => String(x.name || '').trim().toLowerCase() === weaponName.toLowerCase());
    if (!weapon) {
      weapon = { name: weaponName };
      entry.weapons.push(weapon);
    }
    if (pieces != null) weapon.pieces = pieces;
    entry.updatedAt = Date.now();
    saveWeaponsStateData(arr);
    return res.json({ ok: true, entry: normalizeWeaponStateEntry(entry) });
  } catch (e) {
    console.error('weapon-state/update-weapon error', e);
    return res.status(500).json({ ok: false, message: 'failed to update weapon state' });
  }
});

router.post('/weapon-state/remove-weapon', (req, res) => {
  try {
    const body = (typeof req.body === 'object' && req.body) ? req.body : {};
    const name = String(body.name || '').trim();
    const license = String(body.license || '').trim();
    const weaponName = String(body.weaponName || body.nameOfWeapon || '').trim();
    const recordKey = typeof body.recordKey === 'string' ? body.recordKey.trim() : '';
    const persistedRecordKey = typeof body.persistedRecordKey === 'string' ? body.persistedRecordKey.trim() : '';
    if (!name || !license || !weaponName) return res.status(400).json({ ok: false, message: 'missing fields' });

    const arr = loadWeaponsStateData();
    const lookupKeys = [];
    if (recordKey) lookupKeys.push(recordKey);
    if (persistedRecordKey && !lookupKeys.includes(persistedRecordKey)) lookupKeys.push(persistedRecordKey);
    let entry = null;
    let index = -1;
    for (const key of lookupKeys.length ? lookupKeys : ['']) {
      const result = findWeaponsEntry(arr, { recordKey: key, name, license });
      if (result && result.entry) {
        entry = result.entry;
        index = result.index;
        break;
      }
    }
    if (!entry && lookupKeys.length) {
      const result = findWeaponsEntry(arr, { recordKey: '', name, license });
      if (result && result.entry) {
        entry = result.entry;
        index = result.index;
      }
    }
    if (!entry || index === -1) return res.status(404).json({ ok: false, message: 'entry not found' });

    const beforeCount = Array.isArray(entry.weapons) ? entry.weapons.length : 0;
    entry.weapons = (entry.weapons || []).filter(w => String((w.name || '')).trim().toLowerCase() !== weaponName.toLowerCase());
    const afterCount = entry.weapons.length;
    if (afterCount === 0) {
      arr.splice(index, 1);
    } else {
      entry.updatedAt = Date.now();
    }
    saveWeaponsStateData(arr);
    return res.json({ ok: true, removed: beforeCount - afterCount, entry: afterCount === 0 ? null : normalizeWeaponStateEntry(entry) });
  } catch (e) {
    console.error('weapon-state/remove-weapon error', e);
    return res.status(500).json({ ok: false, message: 'failed to remove weapon state' });
  }
});

router.post('/toggle-withdrawn', (req, res) => {
  try {
    const body = (typeof req.body === 'object' && req.body) ? req.body : {};
    const target = resolveWeaponMutationTarget(body);
    const weaponName = String(body.weaponName || '').trim();
    const desiredStatus = body.desiredStatus === 'withdrawled' ? 'withdrawled' : 'notWithdrawled';
    const weaponIndex = Number.isInteger(body.weaponIndex) ? body.weaponIndex : null;
    const license = String(body.license || '').trim();
    const name = String(body.name || '').trim();
    if (!target.ok) {
      return res.status(400).json({ ok: false, message: 'رقم السجل غير صحيح' });
    }
    if (!weaponName) {
      return res.status(400).json({ ok: false, message: 'اسم السلاح مطلوب' });
    }
    const result = weaponsSqlStore.setWeaponWithdrawal({
      recordId: target.recordId,
      rowIndex: target.rowIndex,
      weaponIndex,
      weaponName,
      withdrawn: desiredStatus === 'withdrawled',
      name,
      license,
      expectedUpdatedAt: body.expectedUpdatedAt
    });
    return sendWeaponSqlMutation(res, result);
  } catch (error) {
    return handleWeaponSqlMutationError(res, error, 'تعذر تحديث حالة السلاح', 'weapons/toggle-withdrawn error');
  }
});

router.post('/add-weapon', (req, res) => {
  try {
    const body = (typeof req.body === 'object' && req.body) ? req.body : {};
    const target = resolveWeaponMutationTarget(body);
    const weaponName = String(body.weaponName || body.newWeaponName || '').trim();
    const license = String(body.license || '').trim();
    const name = String(body.name || '').trim();
    if (!target.ok) {
      return res.status(400).json({ ok: false, message: 'رقم السجل غير صحيح' });
    }
    if (!weaponName) {
      return res.status(400).json({ ok: false, message: 'اسم السلاح مطلوب' });
    }
    const result = weaponsSqlStore.addWeaponToRecord({
      recordId: target.recordId,
      rowIndex: target.rowIndex,
      weaponName,
      name,
      license,
      expectedUpdatedAt: body.expectedUpdatedAt
    });
    return sendWeaponSqlMutation(res, result);
  } catch (error) {
    return handleWeaponSqlMutationError(res, error, 'تعذر اضافة السلاح', 'weapons/add-weapon error');
  }
});

router.post('/edit-weapon', (req, res) => {
  try {
    const body = (typeof req.body === 'object' && req.body) ? req.body : {};
    const target = resolveWeaponMutationTarget(body);
    const weaponIndex = Number.isInteger(body.weaponIndex) ? body.weaponIndex : null;
    const newWeaponName = String(body.newWeaponName || body.weaponName || '').trim();
    const license = String(body.license || '').trim();
    const name = String(body.name || '').trim();
    if (!target.ok) {
      return res.status(400).json({ ok: false, message: 'رقم السجل غير صحيح' });
    }
    if (weaponIndex == null || weaponIndex < 0) {
      return res.status(400).json({ ok: false, message: 'المؤشر غير صحيح' });
    }
    if (!newWeaponName) {
      return res.status(400).json({ ok: false, message: 'اسم السلاح مطلوب' });
    }
    const result = weaponsSqlStore.editWeaponInRecord({
      recordId: target.recordId,
      rowIndex: target.rowIndex,
      weaponIndex,
      newWeaponName,
      name,
      license,
      expectedUpdatedAt: body.expectedUpdatedAt
    });
    return sendWeaponSqlMutation(res, result);
  } catch (error) {
    return handleWeaponSqlMutationError(res, error, 'تعذر تعديل السلاح', 'weapons/edit-weapon error');
  }
});

router.post('/delete-weapon', (req, res) => {
  try {
    const body = (typeof req.body === 'object' && req.body) ? req.body : {};
    const target = resolveWeaponMutationTarget(body);
    const weaponIndex = Number.isInteger(body.weaponIndex) ? body.weaponIndex : null;
    const weaponName = String(body.weaponName || '').trim();
    const license = String(body.license || '').trim();
    const name = String(body.name || '').trim();
    if (!target.ok) {
      return res.status(400).json({ ok: false, message: 'رقم السجل غير صحيح' });
    }
    if (weaponIndex == null || weaponIndex < 0) {
      return res.status(400).json({ ok: false, message: 'المؤشر غير صحيح' });
    }
    const result = weaponsSqlStore.deleteWeaponFromRecord({
      recordId: target.recordId,
      rowIndex: target.rowIndex,
      weaponIndex,
      weaponName,
      name,
      license,
      expectedUpdatedAt: body.expectedUpdatedAt
    });
    return sendWeaponSqlMutation(res, result);
  } catch (error) {
    return handleWeaponSqlMutationError(res, error, 'تعذر حذف السلاح', 'weapons/delete-weapon error');
  }
});

module.exports = router;
