const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { disabledDesktopAutomation: exec } = require('../../General/backend/demo-desktop-automation');
const acceptImport = require('./accept-import');
const {
  clearFileCache,
  getFileVersionPayload: getCachedFileVersionPayload,
  readJsonCached
} = require('../../General/backend/file-data-cache');
const {
  appDataDir,
  dataSubdir,
  dataFile
} = require('../../General/backend/platform-paths');
const deleteApproval = require('../../General/backend/delete-approval-store');
const { logRecordActivity } = require('../../General/backend/activity-record-audit');

const router = express.Router();

const ACCEPT_ROOT = path.join(__dirname, '..');
const LEGACY_ACCEPT_DATA_DIR = path.join(ACCEPT_ROOT, 'data');
const DATA_DIR = appDataDir('Accept', { legacyDirs: [LEGACY_ACCEPT_DATA_DIR] });
const DATA_FILE = dataFile('Accept', 'Acceptances.json', [
  path.join(LEGACY_ACCEPT_DATA_DIR, 'Acceptances.json')
]);
const LEGACY_DATA_FILE = dataFile('Accept', 'acceptance.json', [
  path.join(LEGACY_ACCEPT_DATA_DIR, 'acceptance.json')
]);
const TMP_DIR = dataSubdir('Accept', 'tmp', {
  legacyDirs: [path.join(ACCEPT_ROOT, 'tmp')]
});
const UNDO_FILE = path.join(TMP_DIR, 'undo.json');
const CHOICES_FILE = dataFile('Accept', 'choices.json', [
  path.join(LEGACY_ACCEPT_DATA_DIR, 'choices.json')
]);

const SORTABLE_COLUMNS = new Set(['rank', 'name', 'workplace', 'incomingDate', 'residence', 'licenseType', 'weaponType']);
const DEFAULT_SORT_CHOICES = {
  column: 'incomingDate',
  direction: 'desc'
};

const FIELD_MAP_AR = {
  rank: 'الرتبة',
  name: 'الاسم',
  workplace: 'جهة العمل',
  incomingDate: 'تاريخ الوارد',
  residence: 'محل الاقامه',
  licenseType: 'نوع الترخيص',
  weaponType: 'نوع السلاح'
};

let ExcelJS = null;

const ALT_ID_KEYS = ['id', 'ID', 'Id', 'identifier', 'المعرف'];

const SAMPLE_RECORDS = [
  {
    "id": 1,
    "rank": "موظف تجريبي",
    "name": "سجل تجريبي 01",
    "workplace": "الإدارة التجريبية",
    "incomingDate": "2026-01-01",
    "residence": "مدينة تجريبية",
    "licenseType": "اخرى",
    "weaponType": "DEMO-ASSET-001"
  },
  {
    "id": 2,
    "rank": "موظف تجريبي",
    "name": "سجل تجريبي 02",
    "workplace": "الإدارة التجريبية",
    "incomingDate": "2026-01-02",
    "residence": "مدينة تجريبية",
    "licenseType": "اخرى",
    "weaponType": "DEMO-ASSET-002"
  },
  {
    "id": 3,
    "rank": "موظف تجريبي",
    "name": "سجل تجريبي 03",
    "workplace": "الإدارة التجريبية",
    "incomingDate": "2026-01-03",
    "residence": "مدينة تجريبية",
    "licenseType": "اخرى",
    "weaponType": "DEMO-ASSET-003"
  }
];

const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureDataFile() {
  ensureDir(DATA_DIR);
  if (fs.existsSync(DATA_FILE)) return;

  // Public demo never loads a legacy acceptance file.
  const seed = convertToArabicRecords(SAMPLE_RECORDS);
  fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), 'utf8');
  clearFileCache(DATA_FILE);
}

function normalizeSortChoice(choice = {}) {
  const normalized = { ...DEFAULT_SORT_CHOICES };
  if (choice && SORTABLE_COLUMNS.has(choice.column)) {
    normalized.column = choice.column;
  }
  if (choice && (choice.direction === 'asc' || choice.direction === 'desc')) {
    normalized.direction = choice.direction;
  }
  return normalized;
}

function loadSortChoicesFile() {
  ensureDir(DATA_DIR);
  if (!fs.existsSync(CHOICES_FILE)) {
    fs.writeFileSync(CHOICES_FILE, JSON.stringify(DEFAULT_SORT_CHOICES, null, 2), 'utf8');
    return { ...DEFAULT_SORT_CHOICES };
  }
  try {
    const raw = fs.readFileSync(CHOICES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeSortChoice(parsed);
  } catch (error) {
    console.warn('Failed to read choices.json, resetting to defaults:', error.message);
    fs.writeFileSync(CHOICES_FILE, JSON.stringify(DEFAULT_SORT_CHOICES, null, 2), 'utf8');
    return { ...DEFAULT_SORT_CHOICES };
  }
}

function saveSortChoicesFile(choice) {
  const normalized = normalizeSortChoice(choice);
  ensureDir(DATA_DIR);
  fs.writeFileSync(CHOICES_FILE, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

function safeText(value) {
  return String(value ?? '').trim();
}

function normalizeNameKey(value) {
  const base = safeText(value)
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  return base;
}

function normalizeDate(value) {
  const candidate = safeText(value);
  if (!candidate) return null;
  if (!ISO_DATE_RE.test(candidate)) return null;
  const [year, month, day] = candidate.split('-').map((part) => Number(part));
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;
}

function formatDateDisplay(iso) {
  if (!iso || !ISO_DATE_RE.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateYyyyMmDd(iso) {
  if (!iso || !ISO_DATE_RE.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${y}/${m}/${d}`;
}

async function ensureExcelJS() {
  if (ExcelJS) return ExcelJS;
  try {
    ExcelJS = require('exceljs');
    return ExcelJS;
  } catch (error) {
    throw new Error('ExcelJS not installed. Please run npm install exceljs');
  }
}

function pickField(rawRecord, englishKey) {
  if (!rawRecord || typeof rawRecord !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(rawRecord, englishKey)) {
    return rawRecord[englishKey];
  }
  const arabicKey = FIELD_MAP_AR[englishKey];
  if (arabicKey && Object.prototype.hasOwnProperty.call(rawRecord, arabicKey)) {
    return rawRecord[arabicKey];
  }
  return undefined;
}

function extractNumericId(rawRecord) {
  if (!rawRecord || typeof rawRecord !== 'object') return NaN;
  for (const key of ALT_ID_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(rawRecord, key)) continue;
    const numeric = Number(rawRecord[key]);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }
  return NaN;
}

function convertToArabicRecords(records) {
  if (!Array.isArray(records)) return [];
  return records.map((record) => ({
    id: record.id,
    [FIELD_MAP_AR.rank]: safeText(record.rank),
    [FIELD_MAP_AR.name]: safeText(record.name),
    [FIELD_MAP_AR.workplace]: safeText(record.workplace),
    [FIELD_MAP_AR.incomingDate]: record.incomingDate ? safeText(record.incomingDate) : '',
    [FIELD_MAP_AR.residence]: safeText(record.residence),
    [FIELD_MAP_AR.licenseType]: safeText(record.licenseType),
    [FIELD_MAP_AR.weaponType]: safeText(record.weaponType)
  }));
}

function normalizeRecords(rawRecords) {
  if (!Array.isArray(rawRecords)) return [];
  const usedIds = new Set();
  let maxId = rawRecords.reduce((acc, item) => {
    const num = extractNumericId(item);
    return Number.isFinite(num) && num > acc ? num : acc;
  }, 0);

  return rawRecords.map((item, index) => {
    const rawRank = pickField(item, 'rank');
    const rawName = pickField(item, 'name');
    const rawWorkplace = pickField(item, 'workplace');
    const rawDate = pickField(item, 'incomingDate');
    const rawResidence = pickField(item, 'residence');
    const rawLicenseType = pickField(item, 'licenseType');
    const rawWeaponType = pickField(item, 'weaponType');

    let numericId = extractNumericId(item);
    if (!Number.isFinite(numericId) || usedIds.has(numericId)) {
      maxId += 1;
      numericId = maxId || index + 1;
    }
    usedIds.add(numericId);

    return {
      id: numericId,
      rank: safeText(rawRank),
      name: safeText(rawName),
      workplace: safeText(rawWorkplace),
      incomingDate: normalizeDate(rawDate),
      residence: safeText(rawResidence),
      licenseType: safeText(rawLicenseType),
      weaponType: safeText(rawWeaponType)
    };
  });
}

function findDuplicateNameRecord(records) {
  if (!Array.isArray(records)) return null;
  const seen = new Map();
  for (const record of records) {
    const key = normalizeNameKey(record?.name);
    if (!key) continue;
    if (seen.has(key)) {
      return { duplicate: record, original: seen.get(key), key };
    }
    seen.set(key, record);
  }
  return null;
}

function loadRecords() {
  ensureDataFile();
  try {
    const parsed = readJsonCached(DATA_FILE, []);
    if (Array.isArray(parsed)) {
      return normalizeRecords(parsed);
    }
  } catch (error) {
    console.warn('Failed to load acceptance records, resetting to sample data:', error.message);
  }

  if (fs.existsSync(LEGACY_DATA_FILE)) {
    try {
      const legacyRaw = fs.readFileSync(LEGACY_DATA_FILE, 'utf8');
      const legacyParsed = JSON.parse(legacyRaw);
      const normalized = normalizeRecords(legacyParsed);
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(convertToArabicRecords(normalized), null, 2),
        'utf8'
      );
      clearFileCache(DATA_FILE);
      return normalized;
    } catch (error) {
      console.warn('Failed to load legacy acceptance.json:', error.message);
    }
  }

  const fallback = normalizeRecords(SAMPLE_RECORDS);
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(convertToArabicRecords(fallback), null, 2),
      'utf8'
    );
    clearFileCache(DATA_FILE);
  } catch (error) {
    console.error('Failed to reset acceptance data file:', error.message);
  }
  return fallback.map((record) => ({ ...record }));
}

function persistRecords(records) {
  const normalized = normalizeRecords(records);
  ensureDir(DATA_DIR);
  ensureDir(path.dirname(LEGACY_DATA_FILE));
  const arabicRecords = convertToArabicRecords(normalized);
  fs.writeFileSync(DATA_FILE, JSON.stringify(arabicRecords, null, 2), 'utf8');
  fs.writeFileSync(LEGACY_DATA_FILE, JSON.stringify(normalized, null, 2), 'utf8');
  clearFileCache(DATA_FILE);
  clearFileCache(LEGACY_DATA_FILE);
  return normalized;
}

function loadUndoRecords() {
  ensureDir(TMP_DIR);
  if (!fs.existsSync(UNDO_FILE)) return [];
  try {
    const raw = fs.readFileSync(UNDO_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const normalized = normalizeRecords([item])[0] || null;
          if (!normalized) return null;
          return { ...normalized, deletedAt: item.deletedAt || null };
        })
        .filter(Boolean);
    }
  } catch (error) {
    console.warn('Failed to parse undo.json:', error.message);
  }
  return [];
}

function saveUndoRecords(records) {
  ensureDir(TMP_DIR);
  fs.writeFileSync(UNDO_FILE, JSON.stringify(records, null, 2), 'utf8');
}

function createRouteError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeDeleteIdSet(ids) {
  return new Set(
    Array.isArray(ids)
      ? ids
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
      : []
  );
}

function deleteAcceptanceRecordsByIds(ids) {
  const idSet = normalizeDeleteIdSet(ids);

  if (!idSet.size) {
    throw createRouteError(400, 'لم يتم تحديد أي سجلات للحذف');
  }

  const currentRecords = loadRecords();
  const deletedRecords = currentRecords.filter((record) => idSet.has(record.id));
  if (!deletedRecords.length) {
    throw createRouteError(404, 'تعذر العثور على السجلات المطلوب حذفها');
  }

  const remainingRecords = currentRecords.filter((record) => !idSet.has(record.id));
  const persisted = persistRecords(remainingRecords);

  const existingUndo = loadUndoRecords();
  const timestamp = new Date().toISOString();
  const updatedUndo = existingUndo.concat(
    deletedRecords.map((record) => ({ ...record, deletedAt: timestamp }))
  );
  saveUndoRecords(updatedUndo);

  return {
    success: true,
    records: persisted,
    deleted: deletedRecords,
    undoRecords: updatedUndo,
    deletedCount: deletedRecords.length
  };
}

deleteApproval.registerDeleteApprovalExecutor('accept.delete-records', (operation) => (
  deleteAcceptanceRecordsByIds(operation?.ids || [])
));

deleteApproval.registerDeleteApprovalExecutor('accept.save-records', (operation) => {
  const records = normalizeRecords(Array.isArray(operation?.records) ? operation.records : []);
  const saved = persistRecords(records);
  return {
    success: true,
    ok: true,
    action: operation?.action || 'edit',
    records: saved,
    count: saved.length
  };
});

function clearTmpDirectory() {
  ensureDir(TMP_DIR);
  const entries = fs.readdirSync(TMP_DIR, { withFileTypes: true });
  entries.forEach((entry) => {
    const entryPath = path.join(TMP_DIR, entry.name);
    try {
      if (entry.isDirectory()) {
        fs.rmSync(entryPath, { recursive: true, force: true });
      } else {
        fs.rmSync(entryPath, { force: true });
      }
    } catch (error) {
      console.warn('Failed to remove tmp entry:', entryPath, error.message);
      throw error;
    }
  });
}

function getFileVersionPayload(filePath) {
  return getCachedFileVersionPayload(filePath, {
    rowsProvider: () => normalizeRecords(readJsonCached(filePath, [], { clone: false }))
  });
}

router.get('/records/version', (req, res) => {
  try {
    ensureDataFile();
    return res.json(getFileVersionPayload(DATA_FILE));
  } catch (error) {
    console.error('Error reading acceptance records version:', error);
    return res.status(500).json({ ok: false, version: null, updatedAt: null, size: 0, message: 'تعذر قراءة نسخة السجلات الحالية' });
  }
});

router.get('/records', (req, res) => {
  try {
    const records = loadRecords();
    const stats = fs.existsSync(DATA_FILE) ? fs.statSync(DATA_FILE) : null;
    res.json({
      success: true,
      records,
      count: records.length,
      updatedAt: stats ? stats.mtime.toISOString() : null
    });
  } catch (error) {
    console.error('Error reading acceptance records:', error);
    res.status(500).json({ success: false, message: 'تعذر قراءة السجلات الحالية' });
  }
});

router.post('/records', (req, res) => {
  try {
    const { records: rawRecords } = req.body || {};
    if (!Array.isArray(rawRecords)) {
      return res.status(400).json({ success: false, message: 'صيغة البيانات غير صحيحة' });
    }

    const normalized = normalizeRecords(rawRecords);
    const currentRecords = loadRecords();
    const action = normalized.length > currentRecords.length ? 'add' : 'edit';
    const activityItems = normalized.map((record, index) => {
      const before = currentRecords[index];
      if (!before) return { action: 'add', record, index };
      if (JSON.stringify(before) !== JSON.stringify(record)) return { action: 'edit', before, record, index };
      return null;
    }).filter(Boolean);
    if (deleteApproval.isActionApprovalRequired(req, { programKey: 'accept', action })) {
      const approval = deleteApproval.createDeleteApprovalRequest(req, {
        action,
        programKey: 'accept',
        programName: 'موافقة شؤون الضباط',
        recordLabel: `${normalized.length} سجلات`,
        recordSnapshot: activityItems.length === 1
          ? (activityItems[0].before ? { before: activityItems[0].before, after: activityItems[0].record } : activityItems[0].record)
          : { records: activityItems.map((item) => item.before ? { before: item.before, after: item.record } : item.record) },

        operation: {
          type: 'accept.save-records',
          action,
          records: normalized
        }
      });
      return res.status(202).json({
        success: true,
        ok: true,
        approvalRequired: true,
        message: deleteApproval.getApprovalRequiredMessage(action),
        request: approval.request
      });
    }

    const records = persistRecords(normalized);
    records.forEach((record, index) => {
      const before = currentRecords[index];
      if (!before) {
        logRecordActivity(req, {
          action: 'add',
          programKey: 'accept',
          programName: 'موافقة شؤون الضباط',
          recordId: record.id || index + 1,
          record
        });
      } else if (JSON.stringify(before) !== JSON.stringify(record)) {
        logRecordActivity(req, {
          action: 'edit',
          programKey: 'accept',
          programName: 'موافقة شؤون الضباط',
          recordId: record.id || index + 1,
          before,
          after: record
        });
      }
    });
    const stats = fs.statSync(DATA_FILE);

    res.json({
      success: true,
      records,
      savedAt: stats.mtime.toISOString(),
      count: records.length
    });
  } catch (error) {
    console.error('Error saving acceptance records:', error);
    res.status(500).json({ success: false, message: 'تعذر حفظ السجلات' });
  }
});

router.post('/records/delete', (req, res) => {
  try {
    const { ids } = req.body || {};
    const idSet = normalizeDeleteIdSet(ids);
    if (!idSet.size) {
      return res.status(400).json({ success: false, message: 'لم يتم تحديد أي سجلات للحذف' });
    }

    if (deleteApproval.isDeleteApprovalRequired(req)) {
      const currentRecords = loadRecords();
      const deletedRecords = currentRecords.filter((record) => idSet.has(record.id));
      if (!deletedRecords.length) {
        return res.status(404).json({ success: false, message: 'تعذر العثور على السجلات المطلوب حذفها' });
      }
      const approval = deleteApproval.createDeleteApprovalRequest(req, {
        programKey: 'accept',
        programName: 'موافقة شؤون الضباط',
        action: 'delete',
        recordId: Array.from(idSet).join(','),
        recordLabel: deletedRecords.length === 1
          ? (deletedRecords[0].name || `سجل رقم ${deletedRecords[0].id}`)
          : `${deletedRecords.length} سجلات`,
        recordSnapshot: deletedRecords.length === 1 ? deletedRecords[0] : { records: deletedRecords },
        operation: {
          type: 'accept.delete-records',
          action: 'delete',
          ids: Array.from(idSet)
        },
        items: deletedRecords.map((record) => ({
          recordId: String(record.id || ''),
          recordLabel: record.name || `سجل رقم ${record.id || ''}`.trim(),
          recordSnapshot: record,
          operation: {
            type: 'accept.delete-records',
            action: 'delete',
            ids: [record.id]
          }
        }))
      });
      return res.status(202).json({
        success: true,
        approvalRequired: true,
        message: deleteApproval.getApprovalRequiredMessage('delete'),
        request: approval.request
      });
    }

    const result = deleteAcceptanceRecordsByIds(ids);
    result.deleted.forEach((record, index) => {
      logRecordActivity(req, {
        action: 'delete',
        programKey: 'accept',
        programName: 'موافقة شؤون الضباط',
        recordId: record.id || index + 1,
        record
      });
    });
    res.json(result);
  } catch (error) {
    console.error('Error deleting acceptance records:', error);
    res.status(Number(error?.status) || 500).json({ success: false, message: error.message || 'تعذر حذف السجلات المحددة' });
  }
});

router.get('/records/deleted', (req, res) => {
  try {
    const undoRecords = loadUndoRecords();
    res.json({ success: true, records: undoRecords, count: undoRecords.length });
  } catch (error) {
    console.error('Error reading deleted acceptance records:', error);
    res.status(500).json({ success: false, message: 'تعذر قراءة السجلات المحذوفة' });
  }
});

router.post('/records/restore', (req, res) => {
  try {
    const { ids } = req.body || {};
    const idSet = new Set(
      Array.isArray(ids)
        ? ids
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value > 0)
        : []
    );

    if (!idSet.size) {
      return res.status(400).json({ success: false, message: 'لم يتم تحديد أي سجلات للاسترجاع' });
    }

    const undoRecords = loadUndoRecords();
    if (!undoRecords.length) {
      return res.status(404).json({ success: false, message: 'لا توجد سجلات محذوفة للاسترجاع' });
    }

    const toRestore = [];
    const remainingUndo = [];

    undoRecords.forEach((record) => {
      if (idSet.has(record.id)) {
        const { deletedAt, ...rest } = record;
        toRestore.push(rest);
      } else {
        remainingUndo.push(record);
      }
    });

    if (!toRestore.length) {
      return res.status(404).json({ success: false, message: 'تعذر العثور على السجلات المحددة للاسترجاع' });
    }

    const currentRecords = loadRecords();
    const existingIds = new Set(currentRecords.map((record) => record.id));
    const mergedRecords = currentRecords.slice();

    toRestore.forEach((record) => {
      if (!existingIds.has(record.id)) {
        mergedRecords.push(record);
      }
    });

    const persisted = persistRecords(mergedRecords);
    saveUndoRecords(remainingUndo);

    res.json({
      success: true,
      records: persisted,
      restored: toRestore,
      undoRecords: remainingUndo,
      restoredCount: toRestore.length
    });
  } catch (error) {
    console.error('Error restoring acceptance records:', error);
    res.status(500).json({ success: false, message: 'تعذر استرجاع السجلات المحددة' });
  }
});

const MAX_IMPORT_BYTES = 15 * 1024 * 1024;
const MAX_IMPORT_ROWS = 20000;

const IMPORT_FIELD_LABELS = Object.freeze({
  rank: 'الرتبة',
  specialization: 'التخصص',
  name: 'الاسم',
  workplace: 'جهة العمل',
  incomingDate: 'تاريخ الوارد',
  residence: 'محل الإقامة',
  licenseType: 'نوع الموافقة شئون الضباط',
  weaponType: 'نوع السلاح'
});

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (/\.xlsx$/i.test(String(file?.originalname || ''))) {
      cb(null, true);
      return;
    }
    cb(createRouteError(400, 'يجب اختيار ملف Excel بصيغة xlsx'));
  }
});

function receiveImportFile(req, res, next) {
  importUpload.single('file')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'حجم الملف كبير جداً (الحد الأقصى 15 ميجابايت)'
      : error.message || 'تعذر رفع الملف';
    res.status(Number(error.status) || 400).json({ success: false, message });
  });
}

/** Turn the first populated worksheet into a 0-based matrix of raw cell values. */
async function readWorkbookMatrix(buffer) {
  const Excel = await ensureExcelJS();
  const workbook = new Excel.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets.find((sheet) => sheet && sheet.rowCount > 0)
    || workbook.worksheets[0]
    || null;
  if (!worksheet) return null;

  const matrix = [];
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber > MAX_IMPORT_ROWS) return;
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    matrix[rowNumber - 1] = values;
  });
  for (let index = 0; index < matrix.length; index += 1) {
    if (!Array.isArray(matrix[index])) matrix[index] = [];
  }

  return { worksheet, matrix };
}

/** The column choices offered in the dialog's pickers. */
const IMPORT_FIELD_CHOICES = acceptImport.IMPORT_FIELDS.map((field) => ({
  field,
  label: IMPORT_FIELD_LABELS[field] || field
}));

/** Read the mapping the user picked in the dialog: { "<columnIndex>": "<field>" }. */
function parseMappingOverrides(raw) {
  if (!raw) return null;
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch (error) {
      return null;
    }
  }
  return value && typeof value === 'object' ? value : null;
}

/**
 * Read an .xlsx file and report what it would change in the app.
 *
 * Nothing is written here: the client applies the returned rows and saves them
 * through POST /records, so approvals and activity logging stay on one path.
 * The dialog calls this again with `mapping` whenever the user re-points a
 * column, so the counts it shows always match the mapping on screen.
 */
router.post('/import/preview', receiveImportFile, async (req, res) => {
  try {
    if (!req.file || !req.file.buffer || !req.file.buffer.length) {
      return res.status(400).json({ success: false, message: 'لم يتم استلام أي ملف' });
    }

    let parsed = null;
    try {
      parsed = await readWorkbookMatrix(req.file.buffer);
    } catch (error) {
      console.warn('Failed to read imported workbook:', error.message);
      return res.status(422).json({ success: false, message: 'تعذر قراءة الملف. تأكد أنه ملف Excel صالح بصيغة xlsx' });
    }

    if (!parsed || !parsed.matrix.length) {
      return res.status(422).json({ success: false, message: 'الملف لا يحتوي على أي بيانات' });
    }

    let detection = acceptImport.detectHeaderMapping(parsed.matrix);
    if (!detection) {
      // Nothing recognised: still open the dialog on the likeliest header row so
      // the user can map the columns by hand.
      const guessedRow = acceptImport.guessHeaderRowIndex(parsed.matrix);
      if (guessedRow < 0) {
        return res.status(422).json({
          success: false,
          message: 'تعذر التعرف على أعمدة الملف. تأكد أن الملف يحتوي على صف عناوين وبيانات أسفله.'
        });
      }
      detection = acceptImport.applyMappingOverrides(
        parsed.matrix,
        { headerRowIndex: guessedRow, mapping: new Map() },
        null
      );
    }

    const overrides = parseMappingOverrides(req.body && req.body.mapping);
    if (overrides) {
      detection = acceptImport.applyMappingOverrides(parsed.matrix, detection, overrides);
    }

    const fileColumns = acceptImport.describeFileColumns(parsed.matrix, detection).map((column) => ({
      ...column,
      label: column.field ? IMPORT_FIELD_LABELS[column.field] || column.field : ''
    }));

    const hasName = detection.matchedFields.includes('name');
    const importedRows = hasName ? acceptImport.extractRecords(parsed.matrix, detection) : [];
    const existingRecords = hasName ? loadRecords() : [];
    const diff = acceptImport.diffAgainstExisting(importedRows, existingRecords);

    const missingFields = acceptImport.UPDATABLE_FIELDS
      .filter((field) => !detection.matchedFields.includes(field))
      .map((field) => IMPORT_FIELD_LABELS[field] || field);

    return res.json({
      success: true,
      fileName: req.file.originalname || '',
      sheetName: parsed.worksheet.name || '',
      headerRow: detection.headerRowIndex + 1,
      fields: IMPORT_FIELD_CHOICES,
      fileColumns,
      mappedFields: detection.matchedFields,
      missingColumns: missingFields,
      // Without a name column there is nothing to match people on, so the
      // dialog stays open on the pickers instead of reporting empty results.
      blockingMessage: hasName ? '' : 'اختر العمود الذي يحتوي على الاسم حتى يمكن مطابقة السجلات.',
      totalRows: importedRows.length,
      newRecords: diff.newRecords,
      newCount: diff.newRecords.length,
      identicalCount: diff.identical.length,
      changedCount: diff.changed.length,
      invalidCount: diff.invalid.length,
      updates: diff.changed.map((entry) => ({
        id: entry.existing.id,
        rowNumber: entry.imported.rowNumber,
        name: entry.existing.name,
        changes: entry.changes,
        current: {
          rank: acceptImport.composeRankText(entry.existing),
          workplace: entry.existing.workplace,
          incomingDate: entry.existing.incomingDate,
          residence: entry.existing.residence,
          licenseType: entry.existing.licenseType,
          weaponType: entry.existing.weaponType
        }
      }))
    });
  } catch (error) {
    console.error('Error previewing acceptance import:', error);
    return res.status(500).json({ success: false, message: 'تعذر تحليل ملف الاستيراد' });
  }
});

router.get('/sort-choices', (req, res) => {
  try {
    const choice = loadSortChoicesFile();
    res.json({ success: true, choice });
  } catch (error) {
    console.error('Error reading sort choices:', error);
    res.status(500).json({ success: false, message: 'تعذر قراءة اختيارات الفرز' });
  }
});

router.post('/sort-choices', (req, res) => {
  try {
    const saved = saveSortChoicesFile(req.body || {});
    res.json({ success: true, choice: saved });
  } catch (error) {
    console.error('Error saving sort choices:', error);
    res.status(500).json({ success: false, message: 'تعذر حفظ اختيارات الفرز' });
  }
});

router.post('/export', async (req, res) => {
  try {
    const Excel = await ensureExcelJS();
    const { records: rawRecords } = req.body || {};
    if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
      return res.status(400).json({ success: false, message: 'لا توجد سجلات للطباعة' });
    }

    const records = normalizeRecords(rawRecords);
    ensureDir(TMP_DIR);

    const workbook = new Excel.Workbook();
    workbook.creator = 'Accept Program';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('موافقة شئون الضباط', {
      views: [{ rightToLeft: true }]
    });

    worksheet.pageSetup = {
      paperSize: 1,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true
    };

    const headers = [
      { key: 'rank', label: 'الرتبة', width: 16 },
      { key: 'name', label: 'الاسم', width: 30 },
      { key: 'workplace', label: 'جهة العمل', width: 32 },
      { key: 'incomingDate', label: 'تاريخ الوارد', width: 18 },
      { key: 'residence', label: 'محل الإقامة', width: 22 },
      { key: 'licenseType', label: 'نوع الموافقة شئون الضباط', width: 26 },
      { key: 'weaponType', label: 'نوع السلاح', width: 24 }
    ];

    worksheet.properties.defaultRowHeight = 20;

    const columnToLetter = (colIndex) => {
      let dividend = colIndex;
      let columnName = '';
      while (dividend > 0) {
        const modulo = (dividend - 1) % 26;
        columnName = String.fromCharCode(65 + modulo) + columnName;
        dividend = Math.floor((dividend - modulo) / 26);
      }
      return columnName;
    };

    const lastColumn = columnToLetter(headers.length);
    worksheet.mergeCells(`A1:${lastColumn}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'موافقة شئون الضباط';
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.font = { name: 'Segoe UI', size: 18, bold: true, color: { argb: 'FF0F172A' } };
    worksheet.getRow(1).height = 28;
    worksheet.getRow(2).height = 10;

    const tableRows = records.map((record) => [
      record.rank || '',
      record.name || '',
      record.workplace || '',
      formatDateYyyyMmDd(record.incomingDate),
      record.residence || '',
      record.licenseType || '',
      record.weaponType || ''
    ]);

    const tableRef = 'A3';
    const tableName = `AcceptanceTable_${Date.now()}`;
    worksheet.addTable({
      name: tableName,
      ref: tableRef,
      headerRow: true,
      totalsRow: false,
      style: {
        theme: 'TableStyleMedium15',
        showRowStripes: true
      },
      columns: headers.map((col) => ({ name: col.label })),
      rows: tableRows
    });

    headers.forEach((col, index) => {
      const column = worksheet.getColumn(index + 1);
      column.width = col.width;
      column.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    const headerRow = worksheet.getRow(3);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Segoe UI' };
    headerRow.eachCell((cell) => {
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    for (let rowIndex = 3; rowIndex < 3 + tableRows.length; rowIndex += 1) {
      const dataRow = worksheet.getRow(rowIndex);
      dataRow.height = 20;
      dataRow.eachCell((cell) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });
    }

    const spacerRowNumber = 3 + tableRows.length + 1;
    const spacerRow = worksheet.getRow(spacerRowNumber);
    spacerRow.height = 6;

    const totalRowNumber = spacerRowNumber + 1;
    const totalRow = worksheet.getRow(totalRowNumber);
    totalRow.getCell(1).value = `الاجمالي: ${tableRows.length}`;
    totalRow.getCell(1).font = { bold: true, color: { argb: 'FF0F172A' }, name: 'Segoe UI', size: 12 };
    totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    totalRow.height = 24;
    worksheet.mergeCells(`A${totalRowNumber}:${lastColumn}${totalRowNumber}`);

    const timestamp = new Date();
    const safeStamp = `${timestamp.getFullYear()}${String(timestamp.getMonth() + 1).padStart(2, '0')}${String(timestamp.getDate()).padStart(2, '0')}_${String(timestamp.getHours()).padStart(2, '0')}${String(timestamp.getMinutes()).padStart(2, '0')}${String(timestamp.getSeconds()).padStart(2, '0')}`;
    const fileName = `accept-export-${safeStamp}.xlsx`;
    const filePath = path.join(TMP_DIR, fileName);

    await workbook.xlsx.writeFile(filePath);

    triggerExcelPrintWorkflow(filePath).catch((error) => {
      console.error('Failed to trigger Excel print workflow:', error);
    });

    res.json({
      success: true,
      fileName,
      message: 'تم إنشاء ملف الطباعة وسيتم فتحه في Excel خلال لحظات.'
    });
  } catch (error) {
    console.error('Error exporting acceptance records:', error);
    res.status(500).json({ success: false, message: 'تعذر إنشاء ملف الطباعة' });
  }
});

router.get('/export/file/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;
    if (!fileName || typeof fileName !== 'string') {
      return res.status(400).json({ success: false, message: 'اسم الملف غير صالح' });
    }

    const sanitized = path.basename(fileName);
    const filePath = path.join(TMP_DIR, sanitized);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'الملف غير موجود' });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving export file:', error);
    res.status(500).json({ success: false, message: 'تعذر تحميل ملف الطباعة' });
  }
});

function triggerExcelPrintWorkflow(filePath) {
  return new Promise((resolve, reject) => {
    if (!filePath) {
      resolve(false);
      return;
    }

    const launchCommand = `start "" "${filePath}"`;
    exec(launchCommand, (launchError) => {
      if (launchError) {
        return reject(launchError);
      }

      let completed = false;

      const finish = (value) => {
        if (!completed) {
          completed = true;
          resolve(value);
        }
      };

      const attemptSendKeys = (index) => {
        if (completed) return;

        if (index === 0) {
          // Try the direct .NET SendKeys method
          setTimeout(() => {
            exec(
              `powershell -WindowStyle Hidden -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^p')"`,
              (error) => {
                if (error) {
                  console.warn('SendKeys method 1 failed:', error.message);
                  attemptSendKeys(1);
                } else {
                  finish(true);
                }
              }
            );
          }, 3000);
        } else if (index === 1) {
          // Try using a VBScript fallback
          setTimeout(() => {
            try {
              ensureDir(TMP_DIR);
              const vbsPath = path.join(TMP_DIR, 'accept-print-trigger.vbs');
              const vbScript = [
                'On Error Resume Next',
                'Set objExcel = GetObject(, "Excel.Application")',
                'If Not objExcel Is Nothing Then',
                '  objExcel.Application.SendKeys "^p"',
                'Else',
                '  WScript.Echo "Excel application not found"',
                'End If'
              ].join('\r\n');
              fs.writeFileSync(vbsPath, vbScript, 'utf8');
              exec(`wscript "${vbsPath}"`, (scriptError) => {
                try {
                  fs.unlinkSync(vbsPath);
                } catch (_) {}
                if (scriptError) {
                  console.warn('VBScript method failed:', scriptError.message);
                  attemptSendKeys(2);
                } else {
                  finish(true);
                }
              });
            } catch (fileError) {
              console.warn('Failed preparing VBScript for print:', fileError.message);
              attemptSendKeys(2);
            }
          }, 2200);
        } else {
          // 🧠 Improved PowerShell fallback — ensures Excel is focused before ^P
          setTimeout(() => {
            exec(
              `powershell -WindowStyle Hidden -Command `
              + `"$ws=New-Object -ComObject WScript.Shell; `
              + `Start-Sleep -Milliseconds 1200; `
              + `$ws.AppActivate('Excel') | Out-Null; `
              + `Start-Sleep -Milliseconds 150; `
              + `$ws.SendKeys('{ESC}'); `
              + `Start-Sleep -Milliseconds 120; `
              + `$ws.SendKeys('^p')"`
              , (error) => {
                if (error) {
                  console.warn('Alternate SendKeys method failed:', error.message);
                  finish(false);
                } else {
                  finish(true);
                }
              }
            );
          }, 1800);
        }
      };

      attemptSendKeys(0);
    });
  });
}


router.post('/tmp/clear', (req, res) => {
  try {
    clearTmpDirectory();
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing Accept tmp directory:', error);
    res.status(500).json({ success: false, message: 'تعذر مسح الملفات المؤقتة' });
  }
});

module.exports = router;
