const express = require('express');
const path = require('path');
const fs = require('fs');
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
const deleteApproval = require('../../General/backend/delete-approval-store');
const { logRecordActivity } = require('../../General/backend/activity-record-audit');
const { canEditRenewalDocuments } = require('../../General/backend/renewal-document-edit-permission');

const router = express.Router();

const RENEWAL_BASE_DIR = path.join(__dirname, '..');
const LEGACY_DATA_DIR = path.join(RENEWAL_BASE_DIR, 'data');
const DATA_DIR = appDataDir('Renewal', { legacyDirs: [LEGACY_DATA_DIR] });
const PHOTO_DIR = dataSubdir('Renewal', 'photo', {
  legacyDirs: [path.join(LEGACY_DATA_DIR, 'photo')]
});
const OLD_PHOTO_DIR = dataSubdir('Renewal', 'old_photos', {
  legacyDirs: [path.join(LEGACY_DATA_DIR, 'old_photos')]
});
const TMP_DIR = dataSubdir('Renewal', 'tmp', {
  legacyDirs: [path.join(RENEWAL_BASE_DIR, 'tmp')]
});
const CSV_PATH = dataFile('Renewal', 'tagdeed.csv', [
  path.join(LEGACY_DATA_DIR, 'tagdeed.csv')
]);
const UNDO_PATH = path.join(TMP_DIR, 'undo.json');

const RENEWAL_CSV_HEADERS = [
  'رقم الرخصة',
  'نوع الرخصة',
  'الاســـــــم',
  'قطاع',
  'القسم',
  'التجديد',
  'ملاحظـــات',
  'صورة',
  'اجراءات'
];
const RENEWAL_UNDO_HEADERS = RENEWAL_CSV_HEADERS.slice();

const APPEND_HEADERS = [
  'رقم',
  'الاسم',
  'الرقم القومي',
  'العنوان',
  'رقم الرخصة',
  'تاريخ انتهاء الصلاحية',
  'نوع التجديد',
  'الحالة',
  'ملاحظات',
  'تاريخ التجديد',
  'رقم الهاتف',
  'الايميل'
];

const NAME_HEADER_SIGNATURES = new Set(['الاسم', 'اسم', 'الاسمرباعي', 'الاسمكامل', 'الاسمالثلاثي']);
const NUMERIC_FIELDS = new Set(['رقم الرخصة', 'التجديد']);
const SAFE_UPLOAD_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.tif',
  '.tiff',
  '.heic',
  '.txt',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx'
]);
const MIME_EXTENSION_MAP = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/tiff': '.tif',
  'image/heic': '.heic',
  'text/plain': '.txt',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
};
const EXTENSION_MIME_MAP = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.heic': 'image/heic',
  '.txt': 'text/plain; charset=utf-8',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};
const ARABIC_TO_ENGLISH_DIGITS = {
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

function getFileVersionPayload(filePath) {
  return getCachedFileVersionPayload(filePath, { kind: 'csv' });
}

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const CSV_WRITE_RETRY_LIMIT = 12;
const CSV_WRITE_RETRY_DELAY_MS = 60;
const CSV_WRITE_LOCK_CODES = new Set(['EBUSY', 'EPERM', 'EACCES']);

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Writes the CSV through a temp file + rename so a crash, a concurrent save or an
// Excel window holding the file open can never leave tagdeed.csv truncated.
// Mirrors stagePhotoReplacement() below, which already does this for attachments.
function writeCsvFileAtomic(filePath, contents) {
  ensureDirSync(path.dirname(filePath));
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`
  );

  const handle = fs.openSync(tempPath, 'wx');
  try {
    fs.writeFileSync(handle, contents, 'utf8');
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }

  let lastError = null;
  for (let attempt = 0; attempt < CSV_WRITE_RETRY_LIMIT; attempt += 1) {
    try {
      fs.renameSync(tempPath, filePath);
      clearFileCache(filePath);
      return;
    } catch (error) {
      lastError = error;
      if (!CSV_WRITE_LOCK_CODES.has(error?.code)) break;
      sleepSync(CSV_WRITE_RETRY_DELAY_MS);
    }
  }

  try { fs.unlinkSync(tempPath); } catch (_) {}
  if (CSV_WRITE_LOCK_CODES.has(lastError?.code)) {
    const error = new Error('لا يمكن الحفظ لأن ملف السجلات مفتوح الآن (مثلاً في Excel). أغلق الملف ثم أعد المحاولة.');
    error.status = 423;
    error.code = 'csv-locked';
    throw error;
  }
  throw lastError;
}

function normalizeNameKey(value) {
  return String(value || '')
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeHeaderSignature(label) {
  return String(label || '')
    .replace(/^[^\u0621-\u064a0-9A-Za-z]+/, '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function getNameColumnIndices(headers) {
  if (!Array.isArray(headers)) return [];
  const indices = [];
  headers.forEach((header, index) => {
    if (NAME_HEADER_SIGNATURES.has(normalizeHeaderSignature(header))) {
      indices.push(index);
    }
  });
  return indices;
}

function matrixContainsNameKey(matrix, nameKey) {
  if (!Array.isArray(matrix) || matrix.length < 2 || !nameKey) return null;
  const headers = matrix[0] || [];
  const nameIndices = getNameColumnIndices(headers);
  if (!nameIndices.length) return null;

  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex];
    if (!Array.isArray(row)) continue;
    for (const index of nameIndices) {
      if (index >= row.length) continue;
      if (normalizeNameKey(row[index]) === nameKey) {
        return { name: row[index], rowIndex };
      }
    }
  }

  return null;
}

function parseCsvMatrix(text) {
  const cleaned = String(text || '').replace(/\r/g, '');
  const lines = cleaned.split('\n').filter((line) => line.trim().length);
  if (!lines.length) return [];

  const separatorPattern = /,(?=(?:[^"]*"[^"]*")*[^"]*$)|;|\t/;
  const unquote = (value) => String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/^"|"$/g, '')
    .replace(/""/g, '"');

  return lines.map((line) => line.split(separatorPattern).map(unquote));
}

function escapeCsv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function mergeRenewalHeaders(headers) {
  const merged = Array.isArray(headers) ? headers.slice() : [];
  const seen = new Set(merged.map((header) => normalizeHeaderKey(header)));
  for (const requiredHeader of RENEWAL_CSV_HEADERS) {
    const signature = normalizeHeaderKey(requiredHeader);
    if (seen.has(signature)) continue;
    merged.push(requiredHeader);
    seen.add(signature);
  }
  return merged.length ? merged : RENEWAL_CSV_HEADERS.slice();
}

function serializeCsv(headers, rows) {
  const lines = [];
  lines.push(headers.map(escapeCsv).join(','));
  rows.forEach((row) => {
    const padded = headers.map((_, index) => escapeCsv(row[index] ?? ''));
    lines.push(padded.join(','));
  });
  return `\uFEFF${lines.join('\r\n')}`;
}

function normalizeNumericValue(value) {
  return String(value || '').replace(/[٠-٩]/g, (digit) => ARABIC_TO_ENGLISH_DIGITS[digit] || digit).trim();
}

function normalizeHeaderKey(key) {
  return String(key || '')
    .replace(/\uFEFF/g, '')
    .replace(/[\u0640]/g, '')
    .trim();
}

function extractFieldValue(source, targetHeader) {
  if (!source || typeof source !== 'object') return '';

  if (targetHeader in source && source[targetHeader] != null) {
    const raw = source[targetHeader];
    return NUMERIC_FIELDS.has(targetHeader) ? normalizeNumericValue(raw) : String(raw).trim();
  }

  const bomKey = `\uFEFF${targetHeader}`;
  if (bomKey in source && source[bomKey] != null) {
    const raw = source[bomKey];
    return NUMERIC_FIELDS.has(targetHeader) ? normalizeNumericValue(raw) : String(raw).trim();
  }

  const signature = normalizeHeaderKey(targetHeader);
  for (const key of Object.keys(source)) {
    if (normalizeHeaderKey(key) === signature) {
      const raw = source[key];
      return NUMERIC_FIELDS.has(targetHeader) ? normalizeNumericValue(raw) : String(raw || '').trim();
    }
  }

  return '';
}

function buildNormalizedRenewalRecord(input) {
  const normalized = {};
  RENEWAL_UNDO_HEADERS.forEach((header) => {
    normalized[header] = extractFieldValue(input, header);
  });
  return normalized;
}

function loadUndoRecords() {
  try {
    if (!fs.existsSync(UNDO_PATH)) return [];
    const text = fs.readFileSync(UNDO_PATH, 'utf8');
    const parsed = JSON.parse(text || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('renewal undo load failed:', error?.message || error);
    return [];
  }
}

function saveUndoRecords(records) {
  ensureDirSync(TMP_DIR);
  fs.writeFileSync(UNDO_PATH, JSON.stringify(records, null, 2), 'utf8');
}

function buildCsvFromJsonRows(data) {
  const discoveredHeaders = Array.from(
    data.reduce((set, row) => {
      Object.keys(row || {}).forEach((header) => set.add(header));
      return set;
    }, new Set())
  );
  const headers = mergeRenewalHeaders(discoveredHeaders);
  const rows = data.map((row) => headers.map((header) => row && row[header] != null ? row[header] : ''));
  return serializeCsv(headers, rows);
}

function saveRenewalCsvContent(csvContent) {
  ensureDirSync(DATA_DIR);
  writeCsvFileAtomic(CSV_PATH, csvContent);
  const recordCount = Math.max(0, String(csvContent).split(/\r?\n/).filter(Boolean).length - 1);
  return {
    ok: true,
    success: true,
    message: 'تم حفظ البيانات بنجاح',
    recordCount
  };
}

function appendRenewalRecord(row) {
  const safeRow = row && typeof row === 'object' ? row : {};
  const incomingName = safeRow['الاسم'] || safeRow['الاســـــــم'] || safeRow['اسم'] || '';
  const incomingNameKey = normalizeNameKey(incomingName);

  if (incomingNameKey && fs.existsSync(CSV_PATH)) {
    const csvText = readTextCached(CSV_PATH) || '';
    const matrix = parseCsvMatrix(csvText);
    const match = matrixContainsNameKey(matrix, incomingNameKey);
    if (match) {
      const messageName = incomingName || match.name || '';
      const error = new Error(messageName ? `السجل موجود مسبقًا بنفس الاسم: ${messageName}` : 'السجل موجود مسبقًا بنفس الاسم.');
      error.status = 409;
      error.code = 'duplicate-name';
      error.nameValue = messageName;
      throw error;
    }
  }

  const rowData = APPEND_HEADERS.map((header) => String(safeRow[header] || ''));
  const csvRow = rowData.map(escapeCsv).join(',');

  ensureDirSync(DATA_DIR);
  if (!fs.existsSync(CSV_PATH)) {
    fs.writeFileSync(CSV_PATH, `\uFEFF${APPEND_HEADERS.map(escapeCsv).join(',')}\n`, 'utf8');
  }

  fs.appendFileSync(CSV_PATH, `${csvRow}\n`, 'utf8');
  clearFileCache(CSV_PATH);
  return { ok: true, success: true, message: 'Row added successfully' };
}

function normalizeRenewalFingerprintValue(value) {
  return normalizeNumericValue(String(value || ''))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function renewalRecordFingerprint(record) {
  const normalized = buildNormalizedRenewalRecord(record || {});
  return RENEWAL_UNDO_HEADERS
    .map((header) => `${header}:${normalizeRenewalFingerprintValue(normalized[header])}`)
    .join('\u001f');
}

function readRenewalCsvRecords() {
  if (!fs.existsSync(CSV_PATH)) {
    return { headers: RENEWAL_CSV_HEADERS.slice(), records: [] };
  }
  const csvText = readTextCached(CSV_PATH) || '';
  const matrix = parseCsvMatrix(csvText);
  if (!Array.isArray(matrix) || !matrix.length) {
    return { headers: RENEWAL_CSV_HEADERS.slice(), records: [] };
  }
  const sourceHeaders = matrix[0] ? matrix[0].slice() : [];
  const headers = mergeRenewalHeaders(sourceHeaders);
  const records = matrix.slice(1).map((row) => {
    const record = {};
    sourceHeaders.forEach((header, index) => {
      record[header] = row[index] ?? '';
    });
    return buildNormalizedRenewalRecord(record);
  });
  return { headers, records };
}

function appendRenewalUndoRecords(records) {
  const existing = loadUndoRecords();
  let nextId = existing.reduce((max, item) => Math.max(max, Number(item?.id) || 0), 0);
  const timestamp = new Date().toISOString();
  const appended = records.map((record) => {
    const normalizedRecord = buildNormalizedRenewalRecord(record);
    nextId += 1;
    return {
      id: nextId,
      deletedAt: timestamp,
      name: extractFieldValue(normalizedRecord, 'الاســـــــم'),
      licenseNumber: extractFieldValue(normalizedRecord, 'رقم الرخصة'),
      sector: extractFieldValue(normalizedRecord, 'قطاع'),
      station: extractFieldValue(normalizedRecord, 'القسم'),
      record: normalizedRecord
    };
  });
  const undoRecords = existing.concat(appended);
  saveUndoRecords(undoRecords);
  return undoRecords;
}

function deleteRenewalRecords(records) {
  const targets = (Array.isArray(records) ? records : [])
    .map((entry) => buildNormalizedRenewalRecord(entry && typeof entry === 'object' ? (entry.record || entry) : {}));
  const targetFingerprints = new Set(targets.map(renewalRecordFingerprint).filter(Boolean));
  if (!targetFingerprints.size) {
    const error = new Error('لم يتم تحديد سجلات للحذف.');
    error.status = 400;
    throw error;
  }

  const { headers, records: currentRecords } = readRenewalCsvRecords();
  const deleted = [];
  const remaining = [];
  currentRecords.forEach((record) => {
    if (targetFingerprints.has(renewalRecordFingerprint(record))) {
      deleted.push(record);
    } else {
      remaining.push(record);
    }
  });

  if (!deleted.length) {
    const error = new Error('تعذر العثور على السجلات المحددة.');
    error.status = 404;
    throw error;
  }

  ensureDirSync(DATA_DIR);
  const rows = remaining.map((record) => headers.map((header) => extractFieldValue(record, header)));
  writeCsvFileAtomic(CSV_PATH, serializeCsv(headers, rows));
  const undoRecords = appendRenewalUndoRecords(deleted);
  return { ok: true, deletedCount: deleted.length, deleted, undoRecords };
}

// ---------------------------------------------------------------------------
// Row-level (delta) saving.
//
// The legacy POST /save-csv overwrites tagdeed.csv with whatever the client
// uploaded, so whenever two users saved the second upload silently reverted the
// first one's work. /save-rows instead receives only the rows a user actually
// touched and replays them onto whatever is on disk *at save time*, so
// concurrent saves merge instead of cancelling each other out.
// ---------------------------------------------------------------------------

const RENEWAL_IDENTITY_HEADERS = ['رقم الرخصة', 'الاســـــــم'];

function readRenewalCsvRawRecords() {
  if (!fs.existsSync(CSV_PATH)) {
    return { headers: RENEWAL_CSV_HEADERS.slice(), records: [] };
  }
  const matrix = parseCsvMatrix(readTextCached(CSV_PATH) || '');
  if (!Array.isArray(matrix) || !matrix.length) {
    return { headers: RENEWAL_CSV_HEADERS.slice(), records: [] };
  }
  const sourceHeaders = matrix[0] ? matrix[0].slice() : [];
  const headers = mergeRenewalHeaders(sourceHeaders);
  // Keep the original column keys so columns we do not know about survive a save.
  const records = matrix.slice(1).map((row) => {
    const record = {};
    sourceHeaders.forEach((header, index) => {
      record[header] = row[index] ?? '';
    });
    return record;
  });
  return { headers, records };
}

function setRenewalFieldValue(record, targetHeader, value) {
  if (targetHeader in record) {
    record[targetHeader] = value;
    return;
  }
  const bomKey = `﻿${targetHeader}`;
  if (bomKey in record) {
    record[bomKey] = value;
    return;
  }
  const signature = normalizeHeaderKey(targetHeader);
  for (const key of Object.keys(record)) {
    if (normalizeHeaderKey(key) === signature) {
      record[key] = value;
      return;
    }
  }
  record[targetHeader] = value;
}

function renewalRowIdentityKey(record) {
  const parts = RENEWAL_IDENTITY_HEADERS
    .map((header) => normalizeRenewalFingerprintValue(extractFieldValue(record, header)))
    .filter(Boolean);
  return parts.length ? parts.join('') : '';
}

// Finds the on-disk row a client-side row refers to. Full fingerprint first, then
// license+name identity (so a row still matches after someone else edited another
// of its columns). The positional fallback is only trusted for rows that carry no
// identity at all, so an edit can never land on a different person's record.
function locateRenewalRow(records, target, hintIndex, usedIndexes) {
  const targetFingerprint = renewalRecordFingerprint(target);
  for (let index = 0; index < records.length; index += 1) {
    if (usedIndexes.has(index)) continue;
    if (renewalRecordFingerprint(records[index]) === targetFingerprint) return index;
  }

  const identity = renewalRowIdentityKey(target);
  if (identity) {
    for (let index = 0; index < records.length; index += 1) {
      if (usedIndexes.has(index)) continue;
      if (renewalRowIdentityKey(records[index]) === identity) return index;
    }
    return -1;
  }

  if (Number.isInteger(hintIndex) && hintIndex >= 0 && hintIndex < records.length
    && !usedIndexes.has(hintIndex) && !renewalRowIdentityKey(records[hintIndex])) {
    return hintIndex;
  }
  return -1;
}

function describeRenewalRow(record) {
  return {
    name: extractFieldValue(record, 'الاســـــــم'),
    license: extractFieldValue(record, 'رقم الرخصة')
  };
}

function applyRenewalRowChanges(payload) {
  const edits = Array.isArray(payload?.edits) ? payload.edits : [];
  const additions = Array.isArray(payload?.additions) ? payload.additions : [];
  const removals = Array.isArray(payload?.removals) ? payload.removals : [];

  if (!edits.length && !additions.length && !removals.length) {
    const error = new Error('لا توجد تغييرات للحفظ.');
    error.status = 400;
    throw error;
  }

  const { headers, records } = readRenewalCsvRawRecords();
  const working = records.slice();
  const usedIndexes = new Set();
  const conflicts = [];
  const appliedEdits = [];
  const appliedAdditions = [];
  const removedRecords = [];

  edits.forEach((edit) => {
    const before = buildNormalizedRenewalRecord(edit?.before || {});
    const after = buildNormalizedRenewalRecord(edit?.after || {});
    const changedHeaders = RENEWAL_UNDO_HEADERS.filter((header) => (
      normalizeRenewalFingerprintValue(before[header]) !== normalizeRenewalFingerprintValue(after[header])
    ));
    if (!changedHeaders.length) return;

    const index = locateRenewalRow(working, before, edit?.index, usedIndexes);
    if (index === -1) {
      // Either another user removed the row, or this is a retry and our own edit
      // already landed. Only the first case is a real conflict.
      if (locateRenewalRow(working, after, edit?.index, usedIndexes) !== -1) return;
      conflicts.push(Object.assign({ type: 'missing-row' }, describeRenewalRow(before)));
      return;
    }
    usedIndexes.add(index);

    const current = working[index];
    const merged = Object.assign({}, current);
    const rejectedHeaders = [];
    changedHeaders.forEach((header) => {
      const diskValue = normalizeRenewalFingerprintValue(extractFieldValue(current, header));
      const baseValue = normalizeRenewalFingerprintValue(before[header]);
      const nextValue = normalizeRenewalFingerprintValue(after[header]);
      // Untouched by anyone else, or already holding our value -> safe to write.
      if (diskValue !== baseValue && diskValue !== nextValue) {
        rejectedHeaders.push(header);
        return;
      }
      setRenewalFieldValue(merged, header, after[header]);
    });

    if (rejectedHeaders.length) {
      conflicts.push(Object.assign({ type: 'cell-conflict', fields: rejectedHeaders }, describeRenewalRow(current)));
    }
    if (rejectedHeaders.length === changedHeaders.length) return;

    working[index] = merged;
    appliedEdits.push({
      before: buildNormalizedRenewalRecord(current),
      after: buildNormalizedRenewalRecord(merged)
    });
  });

  removals.forEach((entry) => {
    const target = buildNormalizedRenewalRecord(entry?.record || entry || {});
    const index = locateRenewalRow(working, target, entry?.index, usedIndexes);
    if (index === -1) return;
    usedIndexes.add(index);
    removedRecords.push(buildNormalizedRenewalRecord(working[index]));
    working[index] = null;
  });

  additions.forEach((entry) => {
    const record = buildNormalizedRenewalRecord(entry?.record || entry || {});
    const nameKey = normalizeNameKey(extractFieldValue(record, 'الاســـــــم'));
    if (nameKey) {
      const duplicate = working.some((existing) => (
        existing && normalizeNameKey(extractFieldValue(existing, 'الاســـــــم')) === nameKey
      ));
      if (duplicate) {
        conflicts.push(Object.assign({ type: 'duplicate-name' }, describeRenewalRow(record)));
        return;
      }
    }
    working.push(record);
    appliedAdditions.push(record);
  });

  const finalRecords = working.filter(Boolean);
  const changedCount = appliedEdits.length + appliedAdditions.length + removedRecords.length;

  if (changedCount) {
    ensureDirSync(DATA_DIR);
    const rows = finalRecords.map((record) => headers.map((header) => extractFieldValue(record, header)));
    writeCsvFileAtomic(CSV_PATH, serializeCsv(headers, rows));
  }

  return {
    ok: true,
    success: true,
    message: changedCount ? 'تم حفظ البيانات بنجاح' : 'لا توجد تغييرات جديدة للحفظ',
    appliedEdits,
    appliedAdditions,
    removedRecords,
    updatedCount: appliedEdits.length,
    addedCount: appliedAdditions.length,
    removedCount: removedRecords.length,
    conflicts,
    recordCount: finalRecords.length
  };
}

deleteApproval.registerDeleteApprovalExecutor('renewal.delete-records', (operation) => (
  deleteRenewalRecords(operation?.records || [])
));

deleteApproval.registerDeleteApprovalExecutor('renewal.add-record', (operation) => (
  appendRenewalRecord(operation?.record || {})
));

deleteApproval.registerDeleteApprovalExecutor('renewal.edit-records', (operation) => (
  saveRenewalCsvContent(String(operation?.csvContent || ''))
));

// Replaying the delta (rather than a stale whole-file snapshot) means an approval
// that sits in the queue for a while no longer reverts everything saved meanwhile.
deleteApproval.registerDeleteApprovalExecutor('renewal.edit-rows', (operation) => (
  applyRenewalRowChanges(operation?.changes || {})
));

function sanitizePhotoToken(value, fallback = 'unknown') {
  const cleaned = String(value || '')
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .replace(/^_+|_+$/g, '')
    .replace(/\.+$/g, '')
    .trim();
  return cleaned || fallback;
}

function normalizeStoredPhotoList(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => path.basename(String(entry || '').trim()))
      .filter(Boolean);
  }

  const raw = String(value || '').trim();
  if (!raw) return [];

  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => path.basename(String(entry || '').trim()))
          .filter(Boolean);
      }
    } catch (_) {
      // Ignore legacy malformed JSON values and fall back to the pipe format.
    }
  }

  return raw
    .split('|')
    .map((entry) => path.basename(String(entry || '').trim()))
    .filter(Boolean);
}

function serializeStoredPhotoList(files) {
  return Array.from(new Set(normalizeStoredPhotoList(files))).join('|');
}

function getSafePhotoExtension(filename, mimeType) {
  const nameExtension = path.extname(String(filename || '')).toLowerCase();
  const mimeExtension = MIME_EXTENSION_MAP[String(mimeType || '').toLowerCase()] || '';
  const extension = SAFE_UPLOAD_EXTENSIONS.has(nameExtension)
    ? nameExtension
    : SAFE_UPLOAD_EXTENSIONS.has(mimeExtension)
      ? mimeExtension
      : '';

  return extension;
}

function getPhotoMimeType(filename) {
  return EXTENSION_MIME_MAP[path.extname(String(filename || '')).toLowerCase()] || 'application/octet-stream';
}

function normalizeReplaceExtension(extension) {
  const normalized = String(extension || '').trim().toLowerCase();
  return normalized === '.jpeg' ? '.jpg' : normalized;
}

function bufferMatchesPhotoExtension(buffer, extension) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return false;
  const normalized = normalizeReplaceExtension(extension);
  if (normalized === '.pdf') {
    const header = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('latin1');
    const trailer = buffer.subarray(Math.max(0, buffer.length - 2048)).toString('latin1');
    return header.includes('%PDF-') && trailer.includes('%%EOF');
  }
  if (normalized === '.jpg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (normalized === '.png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (normalized === '.webp') return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (normalized === '.gif') return buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.subarray(0, 6).toString('ascii'));
  if (normalized === '.bmp') return buffer.length >= 2 && buffer.subarray(0, 2).toString('ascii') === 'BM';
  return false;
}

function buildRenewalDeleteApprovalAttachments(records) {
  const out = [];
  (Array.isArray(records) ? records : []).forEach((record, recordIndex) => {
    const recordName = extractFieldValue(record, 'الاســـــــم') || extractFieldValue(record, 'الاسم') || '';
    const licenseNumber = extractFieldValue(record, 'رقم الرخصة') || '';
    const label = [recordName, licenseNumber].filter(Boolean).join(' - ') || `سجل ${recordIndex + 1}`;
    normalizeStoredPhotoList(extractFieldValue(record, 'صورة')).forEach((filename) => {
      out.push({
        programKey: 'renewal',
        label,
        filename,
        mimeType: getPhotoMimeType(filename),
        url: `/api/renewal/photos/file/${encodeURIComponent(filename)}`
      });
    });
  });
  return out;
}

function extractPhotoDocumentNumber(filename) {
  const match = path.basename(String(filename || '')).match(/_(\d+)(?=\.[^.]+$)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function buildPhotoFilename(record, documentNumber, extension) {
  const licenseNumber = sanitizePhotoToken(
    normalizeNumericValue(record?.licenseNumber || record?.['رقم الرخصة'] || ''),
    'بدون_رقم'
  );
  const stationName = sanitizePhotoToken(record?.stationName || record?.['القسم'] || '', 'بدون_قسم');
  const personName = sanitizePhotoToken(
    record?.personName || record?.['الاســـــــم'] || record?.['الاسم'] || '',
    'بدون_اسم'
  );

  return `${licenseNumber}_${stationName}_${personName}_${documentNumber}${extension}`;
}

function buildPhotoPrefix(record) {
  const licenseNumber = sanitizePhotoToken(
    normalizeNumericValue(record?.licenseNumber || record?.['رقم الرخصة'] || ''),
    'بدون_رقم'
  );
  const stationName = sanitizePhotoToken(record?.stationName || record?.['القسم'] || '', 'بدون_قسم');
  const personName = sanitizePhotoToken(
    record?.personName || record?.['الاســـــــم'] || record?.['الاسم'] || '',
    'بدون_اسم'
  );
  return `${licenseNumber}_${stationName}_${personName}_`;
}

function getNextPhotoDocumentNumber(record, existingFiles) {
  let maxNumber = 0;
  for (const filename of normalizeStoredPhotoList(existingFiles)) {
    const extracted = extractPhotoDocumentNumber(filename);
    if (Number.isInteger(extracted) && extracted > maxNumber) {
      maxNumber = extracted;
    }
  }

  const prefix = buildPhotoPrefix(record);
  for (const directory of [PHOTO_DIR, OLD_PHOTO_DIR]) {
    if (fs.existsSync(directory)) {
      for (const filename of fs.readdirSync(directory)) {
        if (!filename.startsWith(prefix)) continue;
        const extracted = extractPhotoDocumentNumber(filename);
        if (Number.isInteger(extracted) && extracted > maxNumber) {
          maxNumber = extracted;
        }
      }
    }
  }

  return maxNumber + 1;
}

function decodeBase64FileContent(value) {
  const raw = String(value || '').trim();
  const cleaned = raw.replace(/^data:[^;]+;base64,/, '');
  return Buffer.from(cleaned, 'base64');
}

function resolveStoredPhotoFilePath(directory, filename) {
  const safeName = path.basename(String(filename || '').trim());
  if (!safeName) return null;
  const directoryPath = path.resolve(directory);
  const filePath = path.resolve(directoryPath, safeName);
  if (path.dirname(filePath) !== directoryPath) {
    return null;
  }
  return { safeName, filePath };
}

function resolvePhotoFilePath(filename) {
  return resolveStoredPhotoFilePath(PHOTO_DIR, filename);
}

function resolveOldPhotoFilePath(filename) {
  return resolveStoredPhotoFilePath(OLD_PHOTO_DIR, filename);
}

function isRegularFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (_) {
    return false;
  }
}

function removeFileQuietly(filePath) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch (_) {
    // Best effort cleanup for staging files and failed archive attempts.
  }
}

function stagePhotoReplacement(targetPath, buffer) {
  ensureDirSync(path.dirname(targetPath));
  let lastError = null;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const nonce = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}-${attempt}`;
    const tempPath = path.join(path.dirname(targetPath), `.renewal-${nonce}.tmp`);
    try {
      const descriptor = fs.openSync(tempPath, 'wx');
      try {
        fs.writeFileSync(descriptor, buffer);
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
      return tempPath;
    } catch (error) {
      lastError = error;
      removeFileQuietly(tempPath);
      if (error?.code !== 'EEXIST') throw error;
    }
  }

  throw lastError || new Error('تعذر تجهيز ملف الاستبدال المؤقت.');
}

function archivePhotoIfMissing(resolvedPhoto) {
  const archived = resolveOldPhotoFilePath(resolvedPhoto?.safeName);
  if (!archived) {
    throw new Error('تعذر تحديد مسار نسخة المستند الأصلية.');
  }

  ensureDirSync(OLD_PHOTO_DIR);
  if (fs.existsSync(archived.filePath)) {
    if (!isRegularFile(archived.filePath)) {
      throw new Error('مسار نسخة المستند الأصلية غير صالح.');
    }
    return { ...archived, created: false };
  }

  try {
    fs.copyFileSync(
      resolvedPhoto.filePath,
      archived.filePath,
      fs.constants.COPYFILE_EXCL
    );
    return { ...archived, created: true };
  } catch (error) {
    if (error?.code === 'EEXIST' && isRegularFile(archived.filePath)) {
      return { ...archived, created: false };
    }
    throw error;
  }
}

function cleanupRenewalTmpFiles() {
  if (!fs.existsSync(TMP_DIR)) {
    return { existed: false, deletedCount: 0 };
  }

  let deletedCount = 0;
  for (const name of fs.readdirSync(TMP_DIR)) {
    const filePath = path.join(TMP_DIR, name);
    try {
      fs.unlinkSync(filePath);
      deletedCount += 1;
    } catch (error) {
      console.warn(`⚠️ Could not delete ${name}:`, error.message);
    }
  }

  return { existed: true, deletedCount };
}

function sendCleanupResponse(res, payload) {
  const { existed, deletedCount } = payload;
  const message = existed
    ? `تم حذف ${deletedCount} ملف من مجلد الملفات المؤقتة`
    : 'مجلد الملفات المؤقتة غير موجود';

  return res.json({
    ok: true,
    success: true,
    deleted: deletedCount,
    deletedCount,
    message
  });
}

router.get('/csv-version', (req, res) => {
  try {
    return res.json(getFileVersionPayload(CSV_PATH));
  } catch (error) {
    console.error('Error reading CSV version:', error);
    return res.status(error.message.includes('not found') ? 503 : 500).json({ ok: false, version: null, updatedAt: null, size: 0, message: 'Error reading CSV version' });
  }
});

router.get('/csv-data', (req, res) => {
  try {
    if (!fs.existsSync(CSV_PATH)) {
      return res.json({ ok: false, message: 'CSV file not found' });
    }

    const csvText = readTextCached(CSV_PATH) || '';
    return res.json({ ok: true, csvText });
  } catch (error) {
    console.error('Error reading CSV:', error);
    return res.status(error.message.includes('not found') ? 503 : 500).json({ ok: false, message: 'Error reading CSV file' });
  }
});

router.post(
  '/photos/upload',
  express.json({ limit: '200mb', type: ['application/json', 'application/vnd.renewal-upload+json'] }),
  (req, res) => {
    const record = req.body && typeof req.body.record === 'object' ? req.body.record : {};
    const incomingFiles = Array.isArray(req.body?.files) ? req.body.files : [];
    const existingFiles = normalizeStoredPhotoList(req.body?.existingFiles);

    if (!incomingFiles.length) {
      return res.status(400).json({ ok: false, message: 'لم يتم اختيار ملفات للرفع.' });
    }

    const licenseNumber = normalizeNumericValue(record?.licenseNumber || record?.['رقم الرخصة'] || '');
    const stationName = String(record?.stationName || record?.['القسم'] || '').trim();
    const personName = String(record?.personName || record?.['الاســـــــم'] || record?.['الاسم'] || '').trim();
    if (!licenseNumber || !stationName || !personName) {
      return res.status(400).json({
        ok: false,
        message: 'لا يمكن رفع المستندات قبل إدخال رقم الرخصة والقسم والاسم.'
      });
    }

    let preparedFiles = [];
    try {
      preparedFiles = incomingFiles.map((entry, index) => {
        const originalName = path.basename(String(entry?.name || `document_${index + 1}`));
        const extension = getSafePhotoExtension(originalName, entry?.type);
        if (!extension) {
          throw new Error(`صيغة الملف غير مدعومة: ${originalName}`);
        }

        const buffer = decodeBase64FileContent(entry?.contentBase64);
        if (!buffer.length) {
          throw new Error(`الملف فارغ أو تالف: ${originalName}`);
        }

        return { originalName, extension, buffer };
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        message: error?.message || 'تعذر تجهيز الملفات المختارة.'
      });
    }

    ensureDirSync(PHOTO_DIR);

    const writtenFiles = [];
    let nextDocumentNumber = getNextPhotoDocumentNumber(record, existingFiles);

    try {
      for (const prepared of preparedFiles) {
        let filename = buildPhotoFilename(record, nextDocumentNumber, prepared.extension);
        while (fs.existsSync(path.join(PHOTO_DIR, filename))) {
          nextDocumentNumber += 1;
          filename = buildPhotoFilename(record, nextDocumentNumber, prepared.extension);
        }

        fs.writeFileSync(path.join(PHOTO_DIR, filename), prepared.buffer);
        writtenFiles.push(filename);
        nextDocumentNumber += 1;
      }
    } catch (error) {
      for (const filename of writtenFiles) {
        try {
          fs.unlinkSync(path.join(PHOTO_DIR, filename));
        } catch (_) {
          // Best effort rollback for partially written files.
        }
      }

      return res.status(error.message.includes('not found') ? 503 : 500).json({
        ok: false,
        message: `تعذر حفظ الملفات: ${error.message}`
      });
    }

    const allFiles = existingFiles.concat(writtenFiles);
    return res.json({
      ok: true,
      addedFiles: writtenFiles,
      files: allFiles,
      value: serializeStoredPhotoList(allFiles)
    });
  }
);

router.get('/photos/file/:filename', (req, res) => {
  const resolved = resolvePhotoFilePath(req.params.filename);
  if (!resolved) {
    return res.status(400).json({ ok: false, message: 'اسم الملف غير صالح.' });
  }

  if (!fs.existsSync(resolved.filePath)) {
    return res.status(404).json({ ok: false, message: 'الملف غير موجود.' });
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.type(getPhotoMimeType(resolved.safeName));
  return res.sendFile(resolved.filePath);
});

router.get('/photos/old/file/:filename', (req, res) => {
  const resolved = resolveOldPhotoFilePath(req.params.filename);
  if (!resolved) {
    return res.status(400).json({ ok: false, message: 'اسم الملف غير صالح.' });
  }

  if (!isRegularFile(resolved.filePath)) {
    return res.status(404).json({ ok: false, message: 'النسخة القديمة غير موجودة.' });
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.type(getPhotoMimeType(resolved.safeName));
  return res.sendFile(resolved.filePath);
});

router.post(
  '/photos/restore',
  express.json({ limit: '1mb' }),
  (req, res) => {
    if (!canEditRenewalDocuments(req.portalUser)) {
      return res.status(403).json({
        ok: false,
        message: 'غير مصرح لك بتعديل مستندات التجديد.'
      });
    }

    const current = resolvePhotoFilePath(req.body?.filename);
    const archived = resolveOldPhotoFilePath(req.body?.filename);
    if (!current || !archived) {
      return res.status(400).json({ ok: false, message: 'اسم الملف غير صالح.' });
    }

    if (!isRegularFile(archived.filePath)) {
      return res.status(404).json({ ok: false, message: 'النسخة القديمة غير موجودة.' });
    }

    if (fs.existsSync(current.filePath) && !isRegularFile(current.filePath)) {
      return res.status(409).json({ ok: false, message: 'مسار الملف الحالي غير صالح.' });
    }

    try {
      ensureDirSync(PHOTO_DIR);
      fs.renameSync(archived.filePath, current.filePath);
      const stats = fs.statSync(current.filePath);
      return res.json({
        ok: true,
        filename: current.safeName,
        mimeType: getPhotoMimeType(current.safeName),
        size: stats.size,
        oldAvailable: false
      });
    } catch (error) {
      return res.status(error?.code === 'ENOENT' ? 404 : 500).json({
        ok: false,
        message: `تعذر استرجاع النسخة القديمة: ${error.message}`
      });
    }
  }
);

router.post('/photos/delete', (req, res) => {
  const files = normalizeStoredPhotoList(req.body?.files);
  if (!files.length) {
    return res.status(400).json({ ok: false, message: 'لم يتم تحديد ملفات للحذف.' });
  }

  const deletedFiles = [];
  const missingFiles = [];
  const deletedOldFiles = [];

  for (const filename of files) {
    const resolved = resolvePhotoFilePath(filename);
    if (!resolved) {
      continue;
    }

    if (!fs.existsSync(resolved.filePath)) {
      missingFiles.push(resolved.safeName);
    } else {
      fs.unlinkSync(resolved.filePath);
      deletedFiles.push(resolved.safeName);
    }

    const archived = resolveOldPhotoFilePath(resolved.safeName);
    if (archived && fs.existsSync(archived.filePath)) {
      fs.unlinkSync(archived.filePath);
      deletedOldFiles.push(archived.safeName);
    }
  }

  return res.json({
    ok: true,
    deletedFiles,
    missingFiles,
    deletedOldFiles
  });
});

router.post('/save-csv', (req, res) => {
  try {
    let csvContent = '';
    const beforeRecords = readRenewalCsvRecords().records || [];
    const contentType = String(req.headers['content-type'] || '').toLowerCase();

    if (contentType.includes('application/json')) {
      const data = req.body && Array.isArray(req.body.data) ? req.body.data : null;
      if (!data || !data.length) {
        return res.status(400).json({
          ok: false,
          success: false,
          error: 'بيانات غير صحيحة. يُتوقع مصفوفة من السجلات.'
        });
      }
      csvContent = buildCsvFromJsonRows(data);
    } else {
      csvContent = req.body;
      if (!csvContent || typeof csvContent !== 'string') {
        return res.status(400).json({
          ok: false,
          success: false,
          error: 'محتوى CSV غير صحيح.'
        });
      }
    }

    const submittedMatrix = parseCsvMatrix(csvContent);
    const submittedHeaders = Array.isArray(submittedMatrix?.[0]) ? submittedMatrix[0] : [];
    const submittedRecords = (Array.isArray(submittedMatrix) ? submittedMatrix.slice(1) : []).map((row) => {
      const record = {};
      submittedHeaders.forEach((header, index) => { record[header] = row[index] ?? ''; });
      return buildNormalizedRenewalRecord(record);
    });
    const activityItems = submittedRecords.map((record, index) => {
      const before = beforeRecords[index];
      if (!before) return { action: 'add', record, index };
      if (renewalRecordFingerprint(before) !== renewalRecordFingerprint(record)) return { action: 'edit', before, record, index };
      return null;
    }).filter(Boolean);
    const recordCount = Math.max(0, String(csvContent).split(/\r?\n/).filter(Boolean).length - 1);
    const currentRecordCount = (() => {
      try {
        return readRenewalCsvRecords().currentRecords?.length || readRenewalCsvRecords().records?.length || 0;
      } catch (_) {
        return 0;
      }
    })();
    const action = recordCount > currentRecordCount ? 'add' : 'edit';
    if (deleteApproval.isActionApprovalRequired(req, { programKey: 'renewal', action })) {
      const approval = deleteApproval.createDeleteApprovalRequest(req, {
        action,
        programKey: 'renewal',
        programName: 'برنامج الملفات التي لم ترد',
        recordLabel: `${recordCount} سجلات`,
        recordSnapshot: activityItems.length === 1
          ? (activityItems[0].before ? { before: activityItems[0].before, after: activityItems[0].record } : activityItems[0].record)
          : { records: activityItems.map((item) => item.before ? { before: item.before, after: item.record } : item.record) },
        operation: {
          type: 'renewal.edit-records',
          action,
          csvContent
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

    const result = saveRenewalCsvContent(csvContent);
    submittedRecords.forEach((record, index) => {
      const before = beforeRecords[index];
      if (!before) {
        logRecordActivity(req, {
          action: 'add',
          programKey: 'renewal',
          programName: 'برنامج الملفات التي لم ترد',
          recordId: extractFieldValue(record, 'رقم الرخصة') || index + 1,
          record
        });
      } else if (renewalRecordFingerprint(before) !== renewalRecordFingerprint(record)) {
        logRecordActivity(req, {
          action: 'edit',
          programKey: 'renewal',
          programName: 'برنامج الملفات التي لم ترد',
          recordId: extractFieldValue(record, 'رقم الرخصة') || index + 1,
          before,
          after: record
        });
      }
    });
    return res.json(result);
  } catch (error) {
    console.error('Save renewal data error:', error);
    return res.status(error.message.includes('not found') ? 503 : 500).json({
      ok: false,
      success: false,
      error: `فشل في حفظ البيانات: ${error.message}`
    });
  }
});

router.post('/save-rows', (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const edits = Array.isArray(body.edits) ? body.edits : [];
    const additions = Array.isArray(body.additions) ? body.additions : [];
    const removals = Array.isArray(body.removals) ? body.removals : [];

    if (!edits.length && !additions.length && !removals.length) {
      return res.status(400).json({
        ok: false,
        success: false,
        error: 'لا توجد تغييرات للحفظ.'
      });
    }

    const action = additions.length && !edits.length ? 'add' : 'edit';
    if (deleteApproval.isActionApprovalRequired(req, { programKey: 'renewal', action })) {
      const changeCount = edits.length + additions.length + removals.length;
      const single = edits.length === 1 && !additions.length && !removals.length
        ? { before: buildNormalizedRenewalRecord(edits[0].before || {}), after: buildNormalizedRenewalRecord(edits[0].after || {}) }
        : null;
      const approval = deleteApproval.createDeleteApprovalRequest(req, {
        action,
        programKey: 'renewal',
        programName: 'برنامج الملفات التي لم ترد',
        recordLabel: `${changeCount} سجلات`,
        recordSnapshot: single || {
          records: edits
            .map((edit) => ({ before: buildNormalizedRenewalRecord(edit.before || {}), after: buildNormalizedRenewalRecord(edit.after || {}) }))
            .concat(additions.map((entry) => buildNormalizedRenewalRecord(entry?.record || entry || {})))
        },
        operation: {
          type: 'renewal.edit-rows',
          action,
          changes: { edits, additions, removals }
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

    const result = applyRenewalRowChanges({ edits, additions, removals });

    result.appliedEdits.forEach((entry) => {
      logRecordActivity(req, {
        action: 'edit',
        programKey: 'renewal',
        programName: 'برنامج الملفات التي لم ترد',
        recordId: extractFieldValue(entry.after, 'رقم الرخصة') || extractFieldValue(entry.after, 'الاســـــــم'),
        before: entry.before,
        after: entry.after
      });
    });
    result.appliedAdditions.forEach((record) => {
      logRecordActivity(req, {
        action: 'add',
        programKey: 'renewal',
        programName: 'برنامج الملفات التي لم ترد',
        recordId: extractFieldValue(record, 'رقم الرخصة') || extractFieldValue(record, 'الاســـــــم'),
        record
      });
    });

    return res.json(Object.assign({}, result, { version: getFileVersionPayload(CSV_PATH).version }));
  } catch (error) {
    console.error('Save renewal rows error:', error);
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      ok: false,
      success: false,
      code: error?.code || undefined,
      error: status === 500 ? `فشل في حفظ البيانات: ${error.message}` : error.message
    });
  }
});

router.post('/append-csv', (req, res) => {
  try {
    const row = req.body || {};
    const incomingName = row['الاسم'] || row['الاســـــــم'] || row['اسم'] || '';
    const incomingNameKey = normalizeNameKey(incomingName);

    if (incomingNameKey && fs.existsSync(CSV_PATH)) {
      try {
        const csvText = readTextCached(CSV_PATH) || '';
        const matrix = parseCsvMatrix(csvText);
        const match = matrixContainsNameKey(matrix, incomingNameKey);
        if (match) {
          const messageName = incomingName || match.name || '';
          return res.status(409).json({
            ok: false,
            code: 'duplicate-name',
            name: messageName,
            message: messageName ? `السجل موجود مسبقًا بنفس الاسم: ${messageName}` : 'السجل موجود مسبقًا بنفس الاسم.'
          });
        }
      } catch (error) {
        console.warn('renewal duplicate check skipped:', error?.message || error);
      }
    }

    if (deleteApproval.isActionApprovalRequired(req, { programKey: 'renewal', action: 'add' })) {
      const approval = deleteApproval.createDeleteApprovalRequest(req, {
        action: 'add',
        programKey: 'renewal',
        programName: 'برنامج الملفات التي لم ترد',
        recordId: row['رقم الرخصة'] || row['الاســـــــم'] || row['الاسم'] || '',
        recordLabel: row['الاســـــــم'] || row['الاسم'] || row['رقم الرخصة'] || 'سجل جديد',
        recordSnapshot: row,
        attachments: buildRenewalDeleteApprovalAttachments([buildNormalizedRenewalRecord(row)]),
        operation: {
          type: 'renewal.add-record',
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

    const result = appendRenewalRecord(row);
    logRecordActivity(req, {
      action: 'add',
      programKey: 'renewal',
      programName: 'برنامج الملفات التي لم ترد',
      recordId: row['رقم الرخصة'] || row['الاســـــــم'] || row['الاسم'] || '',
      record: row
    });
    return res.json(result);
  } catch (error) {
    console.error('Error appending to CSV:', error);
    if (error && error.code === 'duplicate-name') {
      return res.status(409).json({
        ok: false,
        code: 'duplicate-name',
        name: error.nameValue || '',
        message: error.message
      });
    }
    return res.status(Number(error?.status) || 500).json({ ok: false, message: error.message || 'Error adding row to CSV' });
  }
});

router.post('/cleanup-temp', (req, res) => {
  try {
    return sendCleanupResponse(res, cleanupRenewalTmpFiles());
  } catch (error) {
    console.error('Cleanup error:', error);
    return res.status(error.message.includes('not found') ? 503 : 500).json({
      ok: false,
      success: false,
      error: `فشل في تنظيف مجلد الملفات المؤقتة: ${error.message}`
    });
  }
});

router.post('/cleanup-tmp', (req, res) => {
  try {
    return sendCleanupResponse(res, cleanupRenewalTmpFiles());
  } catch (error) {
    console.error('Cleanup error:', error);
    return res.status(error.message.includes('not found') ? 503 : 500).json({
      ok: false,
      success: false,
      error: `فشل في تنظيف مجلد الملفات المؤقتة: ${error.message}`
    });
  }
});

router.get('/temp-count', (req, res) => {
  try {
    if (!fs.existsSync(TMP_DIR)) {
      return res.json({ ok: true, count: 0 });
    }

    let count = 0;
    for (const name of fs.readdirSync(TMP_DIR)) {
      if (/\.(xlsx|csv)$/i.test(name)) count += 1;
    }
    return res.json({ ok: true, count });
  } catch (error) {
    console.error('Error counting temp files:', error);
    return res.status(error.message.includes('not found') ? 503 : 500).json({ ok: false, message: 'Error counting temporary files' });
  }
});

router.post('/delete-records', (req, res) => {
  try {
    const incoming = req.body && typeof req.body === 'object' ? req.body.records : null;
    const records = Array.isArray(incoming) ? incoming : [];
    if (!records.length) {
      return res.status(400).json({ ok: false, message: 'لم يتم تحديد سجلات للحذف.' });
    }

    const normalized = records.map((entry) => buildNormalizedRenewalRecord(entry && typeof entry === 'object' ? (entry.record || entry) : {}));
    if (deleteApproval.isDeleteApprovalRequired(req)) {
      const approval = deleteApproval.createDeleteApprovalRequest(req, {
        action: 'delete',
        programKey: 'renewal',
        programName: 'برنامج الملفات التي لم ترد',
        recordId: normalized.map((record) => extractFieldValue(record, 'رقم الرخصة') || extractFieldValue(record, 'الاســـــــم')).filter(Boolean).join(','),
        recordLabel: normalized.length === 1
          ? (extractFieldValue(normalized[0], 'الاســـــــم') || extractFieldValue(normalized[0], 'رقم الرخصة') || 'سجل تجديد')
          : `${normalized.length} سجلات`,
        recordSnapshot: normalized.length === 1 ? normalized[0] : { records: normalized },
        attachments: buildRenewalDeleteApprovalAttachments(normalized),
        operation: {
          type: 'renewal.delete-records',
          action: 'delete',
          records: normalized
        },
        items: normalized.map((record, index) => ({
          recordId: extractFieldValue(record, 'رقم الرخصة') || extractFieldValue(record, 'الاســـــــم') || String(index + 1),
          recordLabel: extractFieldValue(record, 'الاســـــــم') || extractFieldValue(record, 'رقم الرخصة') || `سجل ${index + 1}`,
          recordSnapshot: record,
          attachments: buildRenewalDeleteApprovalAttachments([record]),
          operation: {
            type: 'renewal.delete-records',
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

    const result = deleteRenewalRecords(normalized);
    normalized.forEach((record, index) => {
      logRecordActivity(req, {
        action: 'delete',
        programKey: 'renewal',
        programName: 'برنامج الملفات التي لم ترد',
        recordId: extractFieldValue(record, 'رقم الرخصة') || index + 1,
        record
      });
    });
    return res.json(result);
  } catch (error) {
    console.error('Error deleting renewal records:', error);
    return res.status(Number(error?.status) || 500).json({
      ok: false,
      message: error.message || 'تعذر حذف السجلات المحددة.'
    });
  }
});

router.get('/undo', (req, res) => {
  try {
    return res.json({ ok: true, undoRecords: loadUndoRecords() });
  } catch (error) {
    console.error('Error loading undo records:', error);
    return res.status(error.message.includes('not found') ? 503 : 500).json({ ok: false, message: 'تعذر تحميل سجلات الاسترجاع.' });
  }
});

router.post('/undo/store', (req, res) => {
  try {
    const incoming = req.body && typeof req.body === 'object' ? req.body.records : null;
    if (!Array.isArray(incoming) || !incoming.length) {
      return res.json({ ok: true, undoRecords: loadUndoRecords() });
    }

    const existing = loadUndoRecords();
    let nextId = existing.reduce((max, item) => Math.max(max, Number(item?.id) || 0), 0);
    const timestamp = new Date().toISOString();
    const appended = [];

    for (const entry of incoming) {
      const rawRecord = entry && typeof entry === 'object' ? (entry.record || entry) : {};
      const normalizedRecord = buildNormalizedRenewalRecord(rawRecord);
      nextId += 1;
      appended.push({
        id: nextId,
        deletedAt: timestamp,
        name: extractFieldValue(normalizedRecord, 'الاســـــــم'),
        licenseNumber: extractFieldValue(normalizedRecord, 'رقم الرخصة'),
        sector: extractFieldValue(normalizedRecord, 'قطاع'),
        station: extractFieldValue(normalizedRecord, 'القسم'),
        record: normalizedRecord
      });
    }

    const undoRecords = existing.concat(appended);
    saveUndoRecords(undoRecords);
    return res.json({ ok: true, undoRecords });
  } catch (error) {
    console.error('Error storing undo records:', error);
    return res.status(error.message.includes('not found') ? 503 : 500).json({ ok: false, message: 'تعذر حفظ نسخة الاسترجاع.' });
  }
});

router.post('/undo/restore', (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : [];

    if (!ids.length) {
      return res.status(400).json({ ok: false, message: 'لم يتم تحديد سجلات للاسترجاع.' });
    }

    const undoRecords = loadUndoRecords();
    if (!undoRecords.length) {
      return res.status(404).json({ ok: false, message: 'لا توجد سجلات محذوفة للاسترجاع.' });
    }

    const idSet = new Set(ids);
    const selected = [];
    const remaining = [];

    for (const record of undoRecords) {
      if (record && idSet.has(Number(record.id))) {
        selected.push(record);
      } else {
        remaining.push(record);
      }
    }

    if (!selected.length) {
      return res.status(404).json({ ok: false, message: 'تعذر العثور على السجلات المحددة.' });
    }

    let headers = [];
    let existingRows = [];
    if (fs.existsSync(CSV_PATH)) {
      const csvText = readTextCached(CSV_PATH) || '';
      const matrix = parseCsvMatrix(csvText);
      if (Array.isArray(matrix) && matrix.length) {
        const sourceHeaders = matrix[0] ? matrix[0].slice() : [];
        headers = mergeRenewalHeaders(sourceHeaders);
        if (matrix.length > 1) {
          existingRows = matrix.slice(1).map((row) => {
            const sourceRecord = {};
            sourceHeaders.forEach((header, index) => {
              sourceRecord[header] = row[index] ?? '';
            });
            return headers.map((header) => sourceRecord[header] ?? '');
          });
        }
      }
    }

    if (!headers.length) {
      headers = RENEWAL_CSV_HEADERS.slice();
    }

    const candidateMatrix = [headers.slice(), ...existingRows.map((row) => row.slice())];
    const appendedRows = [];

    for (const entry of selected) {
      const source = entry && typeof entry === 'object' ? entry.record : {};
      const normalized = buildNormalizedRenewalRecord(source || {});
      const nameValue = extractFieldValue(normalized, 'الاســـــــم');
      const nameKey = normalizeNameKey(nameValue);

      if (nameKey) {
        const conflict = matrixContainsNameKey(candidateMatrix, nameKey);
        if (conflict) {
          const conflictName = conflict.name || nameValue || '';
          return res.status(409).json({
            ok: false,
            code: 'duplicate-name',
            name: conflictName,
            message: conflictName ? `يوجد سجل محفوظ بنفس الاسم: ${conflictName}` : 'يوجد سجل محفوظ بنفس الاسم.'
          });
        }
      }

      const newRow = headers.map((header) => extractFieldValue(normalized, header));
      candidateMatrix.push(newRow);
      appendedRows.push(newRow);
    }

    ensureDirSync(DATA_DIR);
    fs.writeFileSync(CSV_PATH, serializeCsv(headers, candidateMatrix.slice(1)), 'utf8');
    clearFileCache(CSV_PATH);
    saveUndoRecords(remaining);

    return res.json({
      ok: true,
      restoredCount: appendedRows.length,
      undoRecords: remaining
    });
  } catch (error) {
    console.error('Error restoring undo records:', error);
    return res.status(error.message.includes('not found') ? 503 : 500).json({ ok: false, message: 'تعذر استرجاع السجلات المحذوفة.' });
  }
});

router.post(
  '/photos/replace',
  express.json({ limit: '200mb', type: ['application/json', 'application/vnd.renewal-upload+json'] }),
  (req, res) => {
    if (!canEditRenewalDocuments(req.portalUser)) {
      return res.status(403).json({
        ok: false,
        message: 'غير مصرح لك بتعديل مستندات التجديد.'
      });
    }
    const resolved = resolvePhotoFilePath(req.body?.filename);
    const incomingFile = req.body && typeof req.body.file === 'object' ? req.body.file : null;

    if (!resolved) {
      return res.status(400).json({ ok: false, message: 'اسم الملف غير صالح.' });
    }

    if (!isRegularFile(resolved.filePath)) {
      return res.status(404).json({ ok: false, message: 'الملف غير موجود.' });
    }

    const SAFE_UPLOAD_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.pdf', '.webp', '.bmp', '.gif']);
    const targetExtension = path.extname(resolved.safeName).toLowerCase();
    if (!SAFE_UPLOAD_EXTENSIONS.has(targetExtension)) {
      return res.status(400).json({ ok: false, message: 'صيغة الملف الحالية غير مدعومة.' });
    }

    const originalName = path.basename(String(incomingFile?.name || resolved.safeName));
    const incomingExtension = getSafePhotoExtension(originalName, incomingFile?.type);
    if (!incomingFile || !incomingExtension) {
      return res.status(400).json({ ok: false, message: 'صيغة الملف المعدل غير مدعومة.' });
    }
    const declaredMimeExtension = MIME_EXTENSION_MAP[String(incomingFile.type || '').toLowerCase()] || '';
    if (
      normalizeReplaceExtension(incomingExtension) !== normalizeReplaceExtension(targetExtension)
      || (declaredMimeExtension && normalizeReplaceExtension(declaredMimeExtension) !== normalizeReplaceExtension(targetExtension))
    ) {
      return res.status(400).json({ ok: false, message: 'صيغة الملف المعدل لا تطابق صيغة المستند الأصلي.' });
    }

    let buffer;
    try {
      buffer = decodeBase64FileContent(incomingFile.contentBase64);
    } catch (_) {
      buffer = Buffer.alloc(0);
    }

    if (!buffer.length) {
      return res.status(400).json({ ok: false, message: 'الملف المعدل فارغ أو تالف.' });
    }
    if (!bufferMatchesPhotoExtension(buffer, targetExtension)) {
      return res.status(400).json({ ok: false, message: 'محتوى الملف المعدل غير صالح أو لا يطابق صيغته.' });
    }

    let stagedPath = null;
    let archived = null;
    let replacementCommitted = false;
    try {
      stagedPath = stagePhotoReplacement(resolved.filePath, buffer);
      archived = archivePhotoIfMissing(resolved);
      fs.renameSync(stagedPath, resolved.filePath);
      stagedPath = null;
      replacementCommitted = true;
      return res.json({
        ok: true,
        filename: resolved.safeName,
        mimeType: getPhotoMimeType(resolved.safeName),
        size: buffer.length,
        oldAvailable: true,
        archivedOriginal: archived.created
      });
    } catch (error) {
      if (archived?.created && !replacementCommitted) {
        removeFileQuietly(archived.filePath);
      }
      return res.status(error.message.includes('not found') ? 503 : 500).json({
        ok: false,
        message: `تعذر حفظ الملف المعدل: ${error.message}`
      });
    } finally {
      removeFileQuietly(stagedPath);
    }
  }
);

module.exports = router;
