import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fileDataCache from '../../General/backend/file-data-cache.js';
import platformPaths from '../../General/backend/platform-paths.js';
import deleteApproval from '../../General/backend/delete-approval-store.js';
import activityRecordAudit from '../../General/backend/activity-record-audit.js';
import { createSeizedSqlStore } from './seized-sql-store.js';
import { buildSeizedActivityItems } from './seized-activity-diff.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();
const { logRecordActivity } = activityRecordAudit;
const {
  clearFileCache,
  getFileVersionPayload: getCachedFileVersionPayload,
  readJsonCached,
  readParsedCached,
  readTextCached
} = fileDataCache;
const {
  appDataDir,
  dataSubdir,
  dataFile
} = platformPaths;

const LEGACY_DATA_DIR = path.join(__dirname, '..', 'Data');
const DATA_DIR = appDataDir('Seized', { legacyDirs: [LEGACY_DATA_DIR] });
const DATA_FILE = dataFile('Seized', 'SeizedWeapons.csv', [
  path.join(LEGACY_DATA_DIR, 'SeizedWeapons.csv')
]);
const COMPANIES_FILE = dataFile('Seized', 'companies.json', [
  path.join(LEGACY_DATA_DIR, 'companies.json')
]);
const COMPANIES_H_FILE = dataFile('Seized', 'companiesH.json', [
  path.join(LEGACY_DATA_DIR, 'companiesH.json')
]);
const COMPANIES_M_FILE = dataFile('Seized', 'companiesM.json', [
  path.join(LEGACY_DATA_DIR, 'companiesM.json')
]);
const TMP_DIR = dataSubdir('Seized', 'tmp', {
  legacyDirs: [path.join(LEGACY_DATA_DIR, 'tmp')]
});
const UNDO_FILE = path.join(TMP_DIR, 'undo.json');

let seizedSqlStore;
try {
  seizedSqlStore = createSeizedSqlStore(path.join(DATA_DIR, 'seized.db'));
} catch (err) {
  console.error('Failed to initialize Seized SQL store:', err);
  seizedSqlStore = null;
}

const columnOrder = [
  'م',
  'الفئة',
  'رقم الحرز',
  'رقم الرخصة',
  'نوع الرخصة',
  'القسم',
  'الاسم',
  'النوع',
  'الماركة',
  'العيار',
  'الرقم',
  'سبب الالغاء',
  'تاريخ الايداع',
  'تاريخ الانتهاء',
  'مالك الحرز',
  'نوع الحرز',
  'ملاحظات'
];

const dataColumns = columnOrder.filter((column) => column !== 'م');
const activityIdentityColumns = ['الفئة', 'رقم الحرز', 'رقم الرخصة', 'الرقم'];
const arabicDigitsMap = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9'
};
const arabicDigitRegex = /[٠-٩]/g;

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureDataFile() {
  ensureDirSync(DATA_DIR);
  if (!fs.existsSync(DATA_FILE)) {
    const header = columnOrder.join(',');
    fs.writeFileSync(DATA_FILE, `\ufeff${header}\n`, 'utf8');
  }
}

function getFileVersionPayload(filePath) {
  return getCachedFileVersionPayload(filePath, { rowsProvider: () => readRecords() });
}

function ensureUndoFile() {
  ensureDirSync(TMP_DIR);
  if (!fs.existsSync(UNDO_FILE)) {
    fs.writeFileSync(UNDO_FILE, '[]', 'utf8');
  }
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function normalizeCellValue(value) {
  return String(value ?? '')
    .replace(/^"+|"+$/g, '')
    .replace(/""/g, '"')
    .replace(arabicDigitRegex, (digit) => arabicDigitsMap[digit] ?? digit)
    .replace(/\r|\n/g, ' ')
    .trim();
}

function parseCsv(text) {
  const clean = String(text || '').replace(/^\ufeff/, '').trim();
  if (!clean) return [];
  const lines = clean.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];

  return lines.slice(1).map((line) => {
    const parts = parseCsvLine(line);
    const record = {};
    dataColumns.forEach((key, index) => {
      record[key] = normalizeCellValue(parts[index + 1] ?? parts[index] ?? '');
    });
    return record;
  });
}

function escapeCsv(value) {
  const normalized = normalizeCellValue(value);
  const needsQuote = /[",\n]/.test(normalized);
  const escaped = normalized.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function sanitizeRecord(record) {
  const sanitized = {};
  const source = record && typeof record === 'object' ? record : {};
  dataColumns.forEach((key) => {
    sanitized[key] = normalizeCellValue(source[key]);
  });
  return sanitized;
}

function toCsv(records) {
  const header = columnOrder.join(',');
  const rows = records.map((record, index) => {
    const sanitized = sanitizeRecord(record);
    const row = [String(index + 1)];
    dataColumns.forEach((key) => {
      row.push(escapeCsv(sanitized[key]));
    });
    return row.join(',');
  });
  return `\ufeff${[header, ...rows].join('\n')}`;
}

function readRecords() {
  ensureDataFile();
  return readParsedCached(DATA_FILE, parseCsv, 'seized-records') || [];
}

function writeRecords(records) {
  ensureDataFile();
  const csv = toCsv(Array.isArray(records) ? records : []);
  fs.writeFileSync(DATA_FILE, csv, 'utf8');
  clearFileCache(DATA_FILE);
}

function readUndoRecords() {
  ensureUndoFile();
  try {
    const parsed = readJsonCached(UNDO_FILE, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUndoRecords(records) {
  ensureUndoFile();
  fs.writeFileSync(UNDO_FILE, JSON.stringify(Array.isArray(records) ? records : [], null, 2), 'utf8');
  clearFileCache(UNDO_FILE);
}

function normalizeSeizedFingerprintValue(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (digit) => arabicDigitsMap[digit] || digit)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function seizedRecordFingerprint(record) {
  const sanitized = sanitizeRecord(record || {});
  return dataColumns
    .map((key) => `${key}:${normalizeSeizedFingerprintValue(sanitized[key])}`)
    .join('\u001f');
}

function deleteSeizedRecords(records) {
  const targets = (Array.isArray(records) ? records : []).map(sanitizeRecord);
  const targetFingerprints = new Set(targets.map(seizedRecordFingerprint).filter(Boolean));
  if (!targetFingerprints.size) {
    const error = new Error('لم يتم تحديد سجلات للحذف.');
    error.status = 400;
    throw error;
  }

  const currentRecords = seizedSqlStore?.hasData() ? seizedSqlStore.getAll() : readRecords();
  const deleted = [];
  const remaining = [];
  currentRecords.forEach((record) => {
    if (targetFingerprints.has(seizedRecordFingerprint(record))) {
      deleted.push(sanitizeRecord(record));
    } else {
      remaining.push(record);
    }
  });

  if (!deleted.length) {
    const error = new Error('تعذر العثور على السجلات المحددة.');
    error.status = 404;
    throw error;
  }

  const existingUndo = readUndoRecords();
  const timestamp = new Date().toISOString();
  const undoRecords = existingUndo.concat(deleted.map((record) => ({ ...record, deletedAt: timestamp })));
  writeUndoRecords(undoRecords);
  writeRecords(remaining);
  if (seizedSqlStore?.hasData()) {
    try { seizedSqlStore.replaceAll(remaining); } catch (sqlErr) { console.error('SQL sync error:', sqlErr); }
  }
  const versionPayload = getFileVersionPayload(DATA_FILE);
  return {
    ok: true,
    deletedCount: deleted.length,
    deleted,
    records: remaining,
    undoRecords,
    version: versionPayload.version,
    updatedAt: versionPayload.updatedAt
  };
}

deleteApproval.registerDeleteApprovalExecutor('seized.delete-records', (operation) => (
  deleteSeizedRecords(operation?.records || [])
));

deleteApproval.registerDeleteApprovalExecutor('seized.save-records', (operation) => {
  const records = Array.isArray(operation?.records) ? operation.records.map(sanitizeRecord) : [];
  writeRecords(records);
  if (seizedSqlStore?.hasData()) {
    try { seizedSqlStore.replaceAll(records); } catch (sqlErr) { console.error('SQL sync error:', sqlErr); }
  }
  const versionPayload = getFileVersionPayload(DATA_FILE);
  return {
    ok: true,
    success: true,
    action: operation?.action || 'edit',
    count: records.length,
    version: versionPayload.version,
    updatedAt: versionPayload.updatedAt
  };
});

function resolveCompaniesFile(kindRaw) {
  const kind = String(kindRaw || '').toUpperCase();
  if (kind === 'H') return COMPANIES_H_FILE;
  if (kind === 'M') return COMPANIES_M_FILE;
  return COMPANIES_FILE;
}

function readCompanies(filePath) {
  ensureDirSync(DATA_DIR);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '{}', 'utf8');
  }

  try {
    const parsed = readJsonCached(filePath, {});
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeCompanies(filePath, companies) {
  ensureDirSync(DATA_DIR);
  fs.writeFileSync(filePath, JSON.stringify(companies, null, 2), 'utf8');
  clearFileCache(filePath);
}

function getCompaniesKindLabel(kindRaw) {
  return String(kindRaw || '').toUpperCase() === 'M' ? 'شركات المصادرة' : 'شركات الحجز الاداري';
}

function getCompaniesList(kindRaw) {
  const filePath = resolveCompaniesFile(kindRaw);
  const companiesObj = readCompanies(filePath);
  const keys = Object.keys(companiesObj).map(Number).sort((left, right) => left - right);
  return keys.map((id) => ({ id, name: companiesObj[id] }));
}

router.get('/records/version', (req, res) => {
  try {
    ensureDataFile();
    return res.json(getFileVersionPayload(DATA_FILE));
  } catch (error) {
    console.error('Seized version read error:', error);
    return res.status(500).json({ ok: false, version: null, updatedAt: null, size: 0, error: 'Failed to read data version.' });
  }
});

router.get('/records', (req, res) => {
  try {
    let records;
    if (seizedSqlStore?.hasData()) {
      records = seizedSqlStore.getAll();
    } else {
      records = readRecords();
    }
    const versionPayload = getFileVersionPayload(DATA_FILE);
    res.json({ records, version: versionPayload.version, updatedAt: versionPayload.updatedAt, totalRows: records.length });
  } catch (error) {
    console.error('Seized read error:', error);
    try { res.json({ records: readRecords() }); } catch { res.status(500).json({ error: 'Failed to read data file.' }); }
  }
});

router.post('/records', (req, res) => {
  try {
    const records = req.body && Array.isArray(req.body.records) ? req.body.records : null;
    if (!records) {
      return res.status(400).json({ error: 'Payload must include records array.' });
    }

    const baseVersion = typeof req.body.baseVersion === 'string' ? req.body.baseVersion : '';
    const currentVersionPayload = getFileVersionPayload(DATA_FILE);
    if (baseVersion && currentVersionPayload.version && baseVersion !== currentVersionPayload.version) {
      return res.status(409).json({
        ok: false,
        code: 'records-version-conflict',
        error: 'Records changed on the server. Reload the latest records before saving.',
        currentVersion: currentVersionPayload.version,
        updatedAt: currentVersionPayload.updatedAt
      });
    }

    const currentRecords = seizedSqlStore?.hasData() ? seizedSqlStore.getAll() : readRecords();
    const action = records.length > currentRecords.length ? 'add' : 'edit';
    const normalizedCurrentRecords = currentRecords.map(sanitizeRecord);
    const normalizedRecords = records.map(sanitizeRecord);
    const activityItems = buildSeizedActivityItems(normalizedCurrentRecords, normalizedRecords, {
      columns: dataColumns,
      identityColumns: activityIdentityColumns
    });
    if (deleteApproval.isActionApprovalRequired(req, { programKey: 'seized', action })) {
      const normalized = normalizedRecords;
      const approval = deleteApproval.createDeleteApprovalRequest(req, {
        action,
        programKey: 'seized',
        programName: 'برنامج الأحراز',
        recordLabel: `${normalized.length} سجلات`,
        recordSnapshot: activityItems.length === 1
          ? (activityItems[0].before ? { before: activityItems[0].before, after: activityItems[0].record } : activityItems[0].record)
          : { records: activityItems.map((item) => item.before ? { before: item.before, after: item.record } : item.record) },
        operation: {
          type: 'seized.save-records',
          action,
          records: normalized
        }
      });
      return res.status(202).json({
        ok: true,
        success: true,
        approvalRequired: true,
        message: deleteApproval.getApprovalRequiredMessage(action),
        request: approval.request
      });
    }

    writeRecords(records);
    if (seizedSqlStore?.hasData()) {
      try { seizedSqlStore.replaceAll(records); } catch (sqlErr) { console.error('SQL sync error:', sqlErr); }
    }
    activityItems.forEach((item) => {
      const record = item.record;
      logRecordActivity(req, {
        action: item.action,
        programKey: 'seized',
        programName: 'برنامج الأحراز',
        recordId: record['رقم الحرز'] || record['رقم الرخصة'] || record['الرقم'] || item.index + 1,
        ...(item.action === 'edit'
          ? { before: item.before, after: record }
          : { record })
      });
    });
    const savedVersionPayload = getFileVersionPayload(DATA_FILE);
    return res.json({ ok: true, count: records.length, version: savedVersionPayload.version, updatedAt: savedVersionPayload.updatedAt });
  } catch (error) {
    console.error('Seized write error:', error);
    return res.status(500).json({ error: 'Failed to write data file.' });
  }
});

router.post('/records/delete-request', (req, res) => {
  try {
    const records = req.body && Array.isArray(req.body.records) ? req.body.records.map(sanitizeRecord) : [];
    if (!records.length) {
      return res.status(400).json({ ok: false, message: 'لم يتم تحديد سجلات للحذف.' });
    }

    if (deleteApproval.isDeleteApprovalRequired(req)) {
      const approval = deleteApproval.createDeleteApprovalRequest(req, {
        programKey: 'seized',
        programName: 'برنامج الأحراز',
        action: 'delete',
        recordId: records.map((record) => record['رقم الحرز'] || record['رقم الرخصة'] || record['الرقم'] || '').filter(Boolean).join(','),
        recordLabel: records.length === 1
          ? (records[0]['الاسم'] || records[0]['رقم الحرز'] || records[0]['رقم الرخصة'] || 'سجل حرز')
          : `${records.length} سجلات`,
        recordSnapshot: records.length === 1 ? records[0] : { records },
        operation: {
          type: 'seized.delete-records',
          action: 'delete',
          records
        },
        items: records.map((record, index) => ({
          recordId: record['رقم الحرز'] || record['رقم الرخصة'] || record['الرقم'] || String(index + 1),
          recordLabel: record['الاسم'] || record['رقم الحرز'] || record['رقم الرخصة'] || `سجل ${index + 1}`,
          recordSnapshot: record,
          operation: {
            type: 'seized.delete-records',
            action: 'delete',
            records: [record]
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

    const result = deleteSeizedRecords(records);
    result.deleted.forEach((record, index) => {
      logRecordActivity(req, {
        action: 'delete',
        programKey: 'seized',
        programName: 'برنامج الأحراز',
        recordId: record['رقم الحرز'] || record['رقم الرخصة'] || record['الرقم'] || index + 1,
        record
      });
    });
    return res.json(result);
  } catch (error) {
    console.error('Seized delete request error:', error);
    return res.status(Number(error?.status) || 500).json({
      ok: false,
      message: error.message || 'تعذر حذف السجلات المحددة.'
    });
  }
});

router.get('/undo', (req, res) => {
  try {
    res.json({ records: readUndoRecords() });
  } catch (error) {
    console.error('Seized undo read error:', error);
    res.status(500).json({ error: 'Failed to read undo file.' });
  }
});

router.post('/undo/add', (req, res) => {
  try {
    const records = req.body && Array.isArray(req.body.records) ? req.body.records : null;
    if (!records) {
      return res.status(400).json({ error: 'Payload must include records array.' });
    }

    const existing = readUndoRecords();
    const additions = records.map((record) => ({
      ...sanitizeRecord(record),
      deletedAt: new Date().toISOString()
    }));
    const updated = existing.concat(additions);
    writeUndoRecords(updated);
    return res.json({ ok: true, count: updated.length });
  } catch (error) {
    console.error('Seized undo add error:', error);
    return res.status(500).json({ error: 'Failed to add to undo file.' });
  }
});

router.post('/undo/restore', (req, res) => {
  try {
    const indices = req.body && Array.isArray(req.body.indices) ? req.body.indices : null;
    if (!indices) {
      return res.status(400).json({ error: 'Payload must include indices array.' });
    }

    const normalizedIndices = indices
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0);
    const indexSet = new Set(normalizedIndices);

    const undoRecords = readUndoRecords();
    const restored = normalizedIndices.map((index) => undoRecords[index]).filter(Boolean);
    const remaining = undoRecords.filter((_, index) => !indexSet.has(index));

    writeUndoRecords(remaining);
    return res.json({ ok: true, restored });
  } catch (error) {
    console.error('Seized undo restore error:', error);
    return res.status(500).json({ error: 'Failed to restore from undo file.' });
  }
});

router.post('/undo/clear', (req, res) => {
  try {
    writeUndoRecords([]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Seized undo clear error:', error);
    res.status(500).json({ error: 'Failed to clear undo file.' });
  }
});

router.get('/companies', (req, res) => {
  try {
    const companies = getCompaniesList(req.query.kind);
    res.json({ ok: true, companies });
  } catch (error) {
    console.error('Seized companies read error:', error);
    res.status(500).json({ error: 'Failed to read companies.' });
  }
});

router.get('/companies/export', async (req, res) => {
  try {
    const label = getCompaniesKindLabel(req.query.kind);
    const companies = getCompaniesList(req.query.kind);
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = ExcelJSModule.default || ExcelJSModule;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Seized Program';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(label, {
      views: [{ rightToLeft: true }]
    });
    worksheet.columns = [
      { header: '#', key: 'index', width: 12 },
      { header: 'اسم الشركة', key: 'name', width: 70 }
    ];
    companies.forEach((company, index) => {
      worksheet.addRow({ index: index + 1, name: company.name || '' });
    });

    worksheet.getRow(1).font = { bold: true, name: 'Tahoma', size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEFF6FF' }
    };
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { ...(cell.font || {}), name: 'Tahoma' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD9E2EC' } },
          left: { style: 'thin', color: { argb: 'FFD9E2EC' } },
          bottom: { style: 'thin', color: { argb: 'FFD9E2EC' } },
          right: { style: 'thin', color: { argb: 'FFD9E2EC' } }
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const encodedFilename = encodeURIComponent(`${label}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="companies.xlsx"; filename*=UTF-8''${encodedFilename}`);
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Seized companies export error:', error);
    return res.status(500).json({ error: 'Failed to export companies.' });
  }
});

router.post('/companies/add', (req, res) => {
  try {
    const name = String(req.body && req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Company name is required.' });
    }

    const filePath = resolveCompaniesFile(req.body && req.body.kind);
    const companies = readCompanies(filePath);
    const keys = Object.keys(companies).map(Number).filter((value) => Number.isFinite(value));
    const nextKey = keys.length ? Math.max(...keys) + 1 : 0;
    companies[nextKey] = name;
    writeCompanies(filePath, companies);
    return res.json({ ok: true, id: nextKey, name });
  } catch (error) {
    console.error('Seized company add error:', error);
    return res.status(500).json({ error: 'Failed to add company.' });
  }
});

router.post('/companies/remove', (req, res) => {
  try {
    const id = req.body ? req.body.id : undefined;
    if (id === undefined || id === null || id === '') {
      return res.status(400).json({ error: 'Company ID is required.' });
    }

    const filePath = resolveCompaniesFile(req.body && req.body.kind);
    const companies = readCompanies(filePath);
    if (Object.prototype.hasOwnProperty.call(companies, id)) {
      delete companies[id];
      writeCompanies(filePath, companies);
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error('Seized company remove error:', error);
    return res.status(500).json({ error: 'Failed to remove company.' });
  }
});

router.post('/shutdown', (req, res) => {
  try {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    ensureDirSync(TMP_DIR);
    res.json({ ok: true });
  } catch (error) {
    console.error('Seized cleanup error:', error);
    res.status(500).json({ error: 'Failed to clean temporary data.' });
  }
});

// ── CSV Import endpoints ──────────────────────────────────────────────────────

router.get('/import/schema', (req, res) => {
  try {
    if (!seizedSqlStore) return res.status(503).json({ ok: false, message: 'SQL store not available' });
    return res.json({ ok: true, schema: seizedSqlStore.getSchema(), stats: seizedSqlStore.getStats() });
  } catch (error) {
    console.error('Seized import schema error:', error);
    return res.status(500).json({ ok: false, message: 'failed to load import schema' });
  }
});

router.post('/import/preview', (req, res) => {
  try {
    if (!seizedSqlStore) return res.status(503).json({ ok: false, message: 'SQL store not available' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const csvText = typeof body.csvText === 'string' ? body.csvText : '';
    if (!csvText.trim()) return res.status(400).json({ ok: false, message: 'CSV text is required' });
    const preview = seizedSqlStore.previewImport(csvText, body.mapping || null);
    return res.json({ ok: true, schema: seizedSqlStore.getSchema(), preview });
  } catch (error) {
    console.error('Seized import preview error:', error);
    return res.status(500).json({ ok: false, message: 'failed to preview import' });
  }
});

router.post('/import/replace', (req, res) => {
  try {
    if (!seizedSqlStore) return res.status(503).json({ ok: false, message: 'SQL store not available' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const csvText = typeof body.csvText === 'string' ? body.csvText : '';
    const mapping = body.mapping && typeof body.mapping === 'object' ? body.mapping : {};
    const confirmed = body.confirm === true || body.confirm === 'replace';
    if (!confirmed) return res.status(400).json({ ok: false, message: 'replace confirmation is required' });
    if (!csvText.trim()) return res.status(400).json({ ok: false, message: 'CSV text is required' });

    const missingRequired = seizedSqlStore.getSchema().columns
      .filter(c => c.required && (mapping[c.key] == null || mapping[c.key] === '' || mapping[c.key] === '-1'))
      .map(c => c.label);
    if (missingRequired.length) {
      return res.status(400).json({ ok: false, message: 'required mappings missing', missingRequired });
    }

    const result = seizedSqlStore.replaceFromCsvText(csvText, { mapping, backup: true });

    // Mirror SQL data to CSV so both are in sync
    try {
      const allRecords = seizedSqlStore.getAll();
      writeRecords(allRecords);
    } catch (mirrorErr) {
      console.error('Failed to mirror SQL to CSV after import:', mirrorErr);
    }

    return res.json({
      ok: true,
      message: `تم استيراد ${result.importedRows} سجل إلى قاعدة البيانات`,
      importedRows: result.importedRows,
      sourceRows: result.sourceRows,
      stats: seizedSqlStore.getStats()
    });
  } catch (error) {
    console.error('Seized import replace error:', error);
    return res.status(500).json({ ok: false, message: 'failed to replace records from import' });
  }
});

export default router;
