const fs = require('fs');
const path = require('path');

const { dataSubdir, ensureDirSync } = require('../../General/backend/platform-paths');

const TEXT_DIR = dataSubdir('Report', 'text');
const FILE_SEPARATOR = '_';

function toEnglishDigits(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

function sanitizeFilePart(value, fallback) {
  const text = toEnglishDigits(value)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
}

function getDecisionTextFileName(row) {
  const decisionNumber = sanitizeFilePart(row && row.decisionNumber, '0');
  const name = sanitizeFilePart(row && row.name, 'بدون اسم');
  return `${decisionNumber}${FILE_SEPARATOR}${name}.txt`;
}

function safeTextFilePath(fileName) {
  const cleanName = path.basename(String(fileName || ''));
  if (!cleanName || !/\.txt$/i.test(cleanName)) {
    throw new Error('Invalid text index filename');
  }
  const filePath = path.resolve(TEXT_DIR, cleanName);
  const textRoot = path.resolve(TEXT_DIR);
  if (filePath !== textRoot && !filePath.startsWith(`${textRoot}${path.sep}`)) {
    throw new Error('Invalid text index path');
  }
  return filePath;
}

function getDecisionTextFilePath(row) {
  return safeTextFilePath(getDecisionTextFileName(row));
}

function readDecisionText(row) {
  const filePath = getDecisionTextFilePath(row);
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8');
}

function removeDecisionTextFile(fileName) {
  if (!fileName) return false;
  const filePath = safeTextFilePath(fileName);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

function writeDecisionText(row, text, options = {}) {
  ensureDirSync(TEXT_DIR);
  const fileName = getDecisionTextFileName(row);
  const filePath = getDecisionTextFilePath(row);
  const normalizedText = String(text || '').replace(/\r\n?/g, '\n').trim();
  const previousFileName = options.previousFileName ? path.basename(String(options.previousFileName)) : '';

  if (!normalizedText) {
    removeDecisionTextFile(fileName);
    if (previousFileName && previousFileName !== fileName) removeDecisionTextFile(previousFileName);
    return { fileName, filePath, text: '' };
  }

  fs.writeFileSync(filePath, normalizedText, 'utf8');
  if (previousFileName && previousFileName !== fileName) {
    removeDecisionTextFile(previousFileName);
  }
  return { fileName, filePath, text: normalizedText };
}

function normalizeSearchValue(value) {
  return toEnglishDigits(value)
    .replace(/\uFEFF/g, '')
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[هة]/g, 'ه')
    .replace(/[^0-9a-z\u0600-\u06FF]+/gi, '')
    .trim()
    .toLowerCase();
}

function getQueryParts(query) {
  const raw = String(query || '');
  const parts = raw.split('-')
    .map((part) => normalizeSearchValue(part))
    .filter(Boolean);
  return parts.length ? parts : [normalizeSearchValue(raw)].filter(Boolean);
}

function textMatchesQuery(text, query) {
  const rawQuery = String(query || '');
  const parts = getQueryParts(query);
  if (!parts.length) return true;
  if (rawQuery.includes('-') && parts.length > 1) {
    return String(text || '').split(/\n+/).some((line) => {
      const lineText = normalizeSearchValue(line);
      return parts.every((part) => lineText.includes(part));
    });
  }
  const haystack = normalizeSearchValue(text);
  return parts.every((part) => haystack.includes(part));
}

module.exports = {
  TEXT_DIR,
  getDecisionTextFileName,
  getDecisionTextFilePath,
  readDecisionText,
  writeDecisionText,
  removeDecisionTextFile,
  normalizeSearchValue,
  textMatchesQuery,
};
