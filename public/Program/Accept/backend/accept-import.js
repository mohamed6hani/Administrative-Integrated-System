'use strict';

/**
 * Pure helpers for importing acceptance records from an .xlsx workbook.
 *
 * The route layer turns a workbook into a matrix of raw cell values and hands it
 * here; everything below is side-effect free so it can be unit tested.
 *
 * Header matching is deliberately forgiving: sheets produced by other offices
 * rarely use the exact wording this app uses, so headers are matched by a
 * synonym list first, then by containment, then by edit distance.
 */

const IMPORT_FIELDS = ['rank', 'specialization', 'name', 'workplace', 'incomingDate', 'residence', 'licenseType', 'weaponType'];

// Fields a row must be able to fill for the sheet to be considered usable.
const REQUIRED_FIELDS = ['name'];

// Fields an existing record may be updated from. The name is the identity used
// to find that record, so it is never rewritten by an import.
const UPDATABLE_FIELDS = ['rank', 'workplace', 'incomingDate', 'residence', 'licenseType', 'weaponType'];

const FIELD_SYNONYMS = Object.freeze({
  rank: ['الرتبة', 'رتبة', 'الرتب', 'الدرجة', 'درجة', 'الرتبة والتخصص', 'rank', 'grade'],
  specialization: ['التخصص', 'تخصص', 'التخصص الوظيفي', 'الحالة', 'specialization', 'speciality', 'specialty'],
  name: ['الاسم', 'اسم', 'الاسم بالكامل', 'الاسم رباعي', 'اسم الضابط', 'اسم المرشح', 'الاسم كامل', 'name', 'full name', 'officer name'],
  workplace: ['جهة العمل', 'مكان العمل', 'الجهة', 'جهة', 'القطاع', 'الادارة', 'الوحدة', 'workplace', 'work place', 'department', 'unit'],
  incomingDate: ['تاريخ الوارد', 'تاريخ الورود', 'تاريخ الطلب', 'تاريخ ورود', 'التاريخ', 'تاريخ', 'incoming date', 'date', 'received date'],
  residence: ['محل الاقامة', 'محل الاقامه', 'محل السكن', 'الاقامة', 'السكن', 'العنوان', 'residence', 'address', 'home town'],
  licenseType: [
    'نوع الموافقة شئون الضباط', 'نوع الموافقة', 'نوع الموافقه', 'الموافقة', 'موافقة شئون الضباط',
    'نوع الترخيص', 'نوع الرخصة', 'نوع الرخصه', 'الترخيص', 'الرخصة', 'نوع التصريح',
    'approval type', 'license type', 'licence type', 'license'
  ],
  weaponType: ['نوع السلاح', 'نوع سلاح', 'السلاح', 'بيان السلاح', 'وصف السلاح', 'weapon type', 'weapon']
});

const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function toEnglishDigits(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06F0));
}

/** Strip the Arabic noise that stops two identical words from comparing equal. */
function normalizeArabic(value) {
  return toEnglishDigits(value)
    .replace(/[\u064B-\u0652\u0640]/g, '') // diacritics + tatweel
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '') // bidi / zero width
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase();
}

/** Comparison key for header cells: letters and digits only. */
function normalizeHeaderText(value) {
  return normalizeArabic(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Comparison key for record values (used for duplicate detection). */
function normalizeMatchText(value) {
  return normalizeArabic(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

function similarity(a, b) {
  const longest = Math.max(a.length, b.length);
  if (!longest) return 0;
  return 1 - levenshtein(a, b) / longest;
}

/**
 * Resolve one header cell to a record field.
 * Returns { field, score } or null when nothing plausible matches.
 */
function matchHeaderField(headerText) {
  const normalized = normalizeHeaderText(headerText);
  if (!normalized) return null;

  let best = null;
  for (const field of IMPORT_FIELDS) {
    for (const synonym of FIELD_SYNONYMS[field]) {
      const target = normalizeHeaderText(synonym);
      if (!target) continue;

      if (normalized === target) {
        return { field, score: 1 };
      }

      if (target.length >= 3 && (normalized.includes(target) || target.includes(normalized))) {
        const score = 0.9 - Math.abs(normalized.length - target.length) / 100;
        if (!best || score > best.score) best = { field, score };
        continue;
      }

      const ratio = similarity(normalized, target);
      if (ratio >= 0.75 && (!best || ratio > best.score)) {
        best = { field, score: ratio };
      }
    }
  }
  return best;
}

function rowAt(matrix, rowIndex) {
  const row = Array.isArray(matrix) ? matrix[rowIndex] : null;
  return Array.isArray(row) ? row : [];
}

/**
 * Describe one candidate header row: which column feeds which field, and which
 * header cells are left over. Shared by automatic detection and by the manual
 * mapping the user picks in the confirmation dialog.
 */
function buildDetection(headerRow, headerRowIndex, mapping) {
  const matchedFields = [];
  const headerLabels = {};
  const unmatchedHeaders = [];

  headerRow.forEach((cell, columnIndex) => {
    const text = cellToText(cell);
    const field = mapping.get(columnIndex);
    if (field) {
      matchedFields.push(field);
      headerLabels[field] = text;
      return;
    }
    if (text) unmatchedHeaders.push(text);
  });

  return { headerRowIndex, mapping, matchedFields, unmatchedHeaders, headerLabels };
}

/**
 * Find the header row in the first rows of a sheet. Sheets exported by this app
 * put a merged title on row 1 and the real header further down, so the row with
 * the most recognised headers wins rather than simply the first row.
 */
function detectHeaderMapping(matrix, options = {}) {
  const scanLimit = Math.min(Array.isArray(matrix) ? matrix.length : 0, options.scanLimit || 25);
  let best = null;

  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const row = rowAt(matrix, rowIndex);
    const mapping = new Map();
    const claimed = new Map();

    row.forEach((cell, columnIndex) => {
      const text = cellToText(cell);
      if (!text) return;
      const match = matchHeaderField(text);
      if (!match) return;

      const previous = claimed.get(match.field);
      if (previous && previous.score >= match.score) return;
      if (previous) mapping.delete(previous.columnIndex);

      claimed.set(match.field, { columnIndex, score: match.score, text });
      mapping.set(columnIndex, match.field);
    });

    const hasRequired = REQUIRED_FIELDS.every((field) => claimed.has(field));
    if (!hasRequired) continue;

    if (!best || claimed.size > best.matchedFields.length) {
      best = buildDetection(row, rowIndex, mapping);
    }
  }

  return best;
}

/**
 * Last resort when no header row is recognised: the densest row of text in the
 * first rows of the sheet. Nothing is mapped — the user picks the columns by
 * hand — but it gives the dialog a header row to show.
 */
function guessHeaderRowIndex(matrix, options = {}) {
  const scanLimit = Math.min(Array.isArray(matrix) ? matrix.length : 0, options.scanLimit || 25);
  let bestIndex = -1;
  let bestCount = 0;

  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const count = rowAt(matrix, rowIndex).filter((cell) => cellToText(cell)).length;
    if (count > bestCount) {
      bestCount = count;
      bestIndex = rowIndex;
    }
  }

  return bestCount >= 2 ? bestIndex : -1;
}

/**
 * Re-point columns at the fields the user chose in the confirmation dialog.
 *
 * Overrides are keyed by column index; an empty field means "ignore this
 * column". A field can only be fed by one column, so claiming it for a new
 * column releases the column that held it before.
 */
function applyMappingOverrides(matrix, detection, overrides) {
  if (!detection) return null;
  const mapping = new Map(detection.mapping);

  toOverrideEntries(overrides).forEach(({ columnIndex, field }) => {
    if (!Number.isInteger(columnIndex) || columnIndex < 0) return;
    mapping.delete(columnIndex);
    if (!field || !IMPORT_FIELDS.includes(field)) return;
    Array.from(mapping.entries()).forEach(([otherIndex, otherField]) => {
      if (otherField === field) mapping.delete(otherIndex);
    });
    mapping.set(columnIndex, field);
  });

  return buildDetection(rowAt(matrix, detection.headerRowIndex), detection.headerRowIndex, mapping);
}

/** Accepts either { "2": "name" } or [{ columnIndex: 2, field: 'name' }]. */
function toOverrideEntries(overrides) {
  if (!overrides) return [];
  const list = Array.isArray(overrides)
    ? overrides.map((entry) => ({ columnIndex: Number(entry?.columnIndex), field: entry?.field }))
    : Object.keys(overrides).map((key) => ({ columnIndex: Number(key), field: overrides[key] }));

  return list
    .filter((entry) => Number.isFinite(entry.columnIndex))
    .map((entry) => ({
      columnIndex: Math.trunc(entry.columnIndex),
      field: entry.field === null || entry.field === undefined ? '' : String(entry.field)
    }));
}

/**
 * Every column of the header row, mapped or not, with a value from the sheet as
 * proof of what it holds. This is what the dialog turns into a row of pickers.
 */
function describeFileColumns(matrix, detection) {
  if (!detection) return [];
  const headerRow = rowAt(matrix, detection.headerRowIndex);
  const width = Math.max(
    headerRow.length,
    ...Array.from(detection.mapping.keys()).map((index) => index + 1),
    0
  );

  const columns = [];
  for (let columnIndex = 0; columnIndex < width; columnIndex += 1) {
    const header = cellToText(headerRow[columnIndex]);
    const field = detection.mapping.get(columnIndex) || '';
    const sample = findColumnSample(matrix, detection.headerRowIndex, columnIndex);
    if (!header && !field && !sample) continue; // an empty spacer column
    columns.push({ index: columnIndex, letter: columnIndexToLetter(columnIndex), header, field, sample });
  }
  return columns;
}

/** First value under a header, so the user can see what the column really holds. */
function findColumnSample(matrix, headerRowIndex, columnIndex, options = {}) {
  const limit = Math.min(Array.isArray(matrix) ? matrix.length : 0, headerRowIndex + 1 + (options.scanLimit || 40));
  for (let rowIndex = headerRowIndex + 1; rowIndex < limit; rowIndex += 1) {
    const text = cellToText(rowAt(matrix, rowIndex)[columnIndex]);
    if (text) return text;
  }
  return '';
}

/** 0-based column index -> spreadsheet column letter (0 -> A, 26 -> AA). */
function columnIndexToLetter(index) {
  if (!Number.isInteger(index) || index < 0) return '';
  let remaining = index + 1;
  let letters = '';
  while (remaining > 0) {
    const modulo = (remaining - 1) % 26;
    letters = String.fromCharCode(65 + modulo) + letters;
    remaining = Math.floor((remaining - modulo) / 26);
  }
  return letters;
}

/** exceljs cell values come in several shapes; flatten them to plain text. */
function cellToText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatIsoDate(value);
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part?.text ?? '').join('').trim();
    }
    if (value.text !== undefined) return String(value.text).trim();
    if (value.result !== undefined) return cellToText(value.result);
    if (value.hyperlink !== undefined) return String(value.hyperlink).trim();
    if (value.error !== undefined) return '';
  }
  return String(value).trim();
}

function formatIsoDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isoFromParts(year, month, day) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    return null;
  }
  return formatIsoDate(utc);
}

/**
 * Accepts real dates, Excel serial numbers and the text formats used around the
 * office (day-first, as the app's own date editor writes them).
 */
function parseImportedDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatIsoDate(value);

  if (typeof value === 'object' && !Array.isArray(value)) {
    if (value.result !== undefined) return parseImportedDate(value.result);
    if (value.text !== undefined) return parseImportedDate(value.text);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 0 || value > 2958465) return null; // outside Excel's 1900 date system
    const epoch = Date.UTC(1899, 11, 30);
    return formatIsoDate(new Date(epoch + Math.round(value) * 86400000));
  }

  const text = toEnglishDigits(cellToText(value)).trim();
  if (!text) return null;
  if (ISO_DATE_RE.test(text)) return text;

  const numeric = text.match(/^(\d{1,4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,4})$/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const third = Number(numeric[3]);

    if (numeric[1].length === 4) {
      return isoFromParts(first, second, third); // yyyy/mm/dd
    }
    if (numeric[3].length === 4 || third > 31) {
      // Day-first unless that is impossible (then treat as month-first).
      return first > 12 || second <= 12
        ? isoFromParts(third, second, first)
        : isoFromParts(third, first, second);
    }
  }

  if (/^\d{8}$/.test(text)) {
    return isoFromParts(Number(text.slice(0, 4)), Number(text.slice(4, 6)), Number(text.slice(6, 8)));
  }

  return null;
}

/**
 * Read data rows below the header row into records.
 * `rowNumber` is 1-based to match what the user sees in Excel.
 */
function extractRecords(matrix, detection) {
  const rows = [];
  if (!detection) return rows;
  const startIndex = detection.headerRowIndex + 1;

  for (let rowIndex = startIndex; rowIndex < matrix.length; rowIndex += 1) {
    const row = Array.isArray(matrix[rowIndex]) ? matrix[rowIndex] : [];
    const record = {
      rank: '', specialization: '', name: '', workplace: '',
      incomingDate: null, residence: '', licenseType: '', weaponType: ''
    };
    let hasValue = false;

    detection.mapping.forEach((field, columnIndex) => {
      const raw = row[columnIndex];
      if (field === 'incomingDate') {
        const iso = parseImportedDate(raw);
        if (iso) {
          record.incomingDate = iso;
          hasValue = true;
        }
        return;
      }
      const text = cellToText(raw);
      if (text) {
        record[field] = text;
        hasValue = true;
      }
    });

    if (!hasValue) continue;
    rows.push({ ...record, rowNumber: rowIndex + 1 });
  }

  return rows;
}

/**
 * Combined rank text, so a sheet that splits "الرتبة" and "التخصص" into two
 * columns lands in the single rank field the app stores.
 */
function composeRankText(record) {
  const rank = normalizeMatchText(record?.rank) ? String(record.rank).trim() : '';
  const specialization = String(record?.specialization ?? '').trim();
  if (!specialization) return rank;
  if (!rank) return specialization;
  if (normalizeMatchText(rank).includes(normalizeMatchText(specialization))) return rank;
  return `${rank} ${specialization}`.trim();
}

/** Identity of a person inside the app: the normalized full name. */
function buildNameKey(record) {
  return normalizeMatchText(record?.name);
}

/** Value an imported row would write into one field of an existing record. */
function readImportedField(record, field) {
  if (field === 'rank') return composeRankText(record);
  const value = record?.[field];
  return value === null || value === undefined ? '' : String(value).trim();
}

/**
 * What an imported row would actually change in the record already stored.
 *
 * Only fields the file fills are considered: a column the sheet does not have —
 * or leaves blank — must never wipe a value the app already holds.
 */
function buildFieldChanges(importedRecord, existingRecord) {
  const changes = {};
  UPDATABLE_FIELDS.forEach((field) => {
    const next = readImportedField(importedRecord, field);
    if (!next) return;
    const current = readImportedField(existingRecord, field);
    if (normalizeMatchText(next) === normalizeMatchText(current)) return;
    changes[field] = next;
  });
  return changes;
}

/**
 * Split imported rows into what should be added and what already exists.
 *
 * A row counts as "already in the app" when its name matches an existing
 * record — the app treats a repeated name as the same person, so only genuinely
 * new names are added. Rows sharing a name but carrying different details are
 * reported separately, with the exact fields they would change, so the caller
 * can show them and let the user decide whether to overwrite.
 */
function diffAgainstExisting(importedRecords, existingRecords) {
  const existingByName = new Map();

  (Array.isArray(existingRecords) ? existingRecords : []).forEach((record) => {
    const nameKey = buildNameKey(record);
    if (nameKey && !existingByName.has(nameKey)) {
      existingByName.set(nameKey, record);
    }
  });

  const newRecords = [];
  const identical = [];
  const changed = [];
  const invalid = [];
  const seenInFile = new Map();

  (Array.isArray(importedRecords) ? importedRecords : []).forEach((record) => {
    const nameKey = buildNameKey(record);
    if (!nameKey) {
      invalid.push(record);
      return;
    }

    const existing = existingByName.get(nameKey);
    if (existing) {
      const changes = buildFieldChanges(record, existing);
      if (Object.keys(changes).length) {
        changed.push({ imported: record, existing, changes });
      } else {
        identical.push({ imported: record, existing });
      }
      return;
    }

    const earlier = seenInFile.get(nameKey);
    if (earlier) {
      identical.push({ imported: record, existing: earlier });
      return;
    }

    seenInFile.set(nameKey, record);
    newRecords.push({
      rank: composeRankText(record),
      name: String(record.name || '').trim(),
      workplace: String(record.workplace || '').trim(),
      incomingDate: record.incomingDate || null,
      residence: String(record.residence || '').trim(),
      licenseType: String(record.licenseType || '').trim(),
      weaponType: String(record.weaponType || '').trim(),
      rowNumber: record.rowNumber
    });
  });

  return { newRecords, identical, changed, invalid };
}

module.exports = {
  IMPORT_FIELDS,
  REQUIRED_FIELDS,
  UPDATABLE_FIELDS,
  FIELD_SYNONYMS,
  toEnglishDigits,
  normalizeHeaderText,
  normalizeMatchText,
  matchHeaderField,
  detectHeaderMapping,
  guessHeaderRowIndex,
  applyMappingOverrides,
  describeFileColumns,
  columnIndexToLetter,
  cellToText,
  parseImportedDate,
  extractRecords,
  composeRankText,
  buildNameKey,
  buildFieldChanges,
  diffAgainstExisting
};
