const fs = require('fs');
const path = require('path');

const textCache = new Map();
const parsedCache = new Map();

function resolveKey(filePath) {
  return path.resolve(filePath);
}

function getFileSignature(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  return {
    key: `${stat.size}:${Math.floor(stat.mtimeMs)}`,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    updatedAt: new Date(stat.mtimeMs).toISOString()
  };
}

function readTextCached(filePath, encoding = 'utf8') {
  const signature = getFileSignature(filePath);
  if (!signature) return null;
  const key = resolveKey(filePath);
  const cached = textCache.get(key);
  if (cached && cached.signature === signature.key && cached.encoding === encoding) {
    return cached.text;
  }
  const text = fs.readFileSync(filePath, encoding);
  textCache.set(key, { signature: signature.key, encoding, text });
  return text;
}

function readParsedCached(filePath, parser, cacheKey = 'default') {
  if (typeof parser !== 'function') {
    throw new TypeError('readParsedCached requires a parser function');
  }
  const signature = getFileSignature(filePath);
  if (!signature) return null;
  const key = `${resolveKey(filePath)}::${cacheKey}`;
  const cached = parsedCache.get(key);
  if (cached && cached.signature === signature.key) return cached.value;
  const text = readTextCached(filePath);
  const value = parser(text == null ? '' : text);
  parsedCache.set(key, { signature: signature.key, value });
  return value;
}

function cloneJsonValue(value) {
  if (value == null || typeof value !== 'object') return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (_) {}
  }
  return JSON.parse(JSON.stringify(value));
}

function readJsonCached(filePath, fallback = null, options = {}) {
  const value = readParsedCached(filePath, (text) => {
    if (!String(text || '').trim()) return fallback;
    return JSON.parse(text);
  }, 'json');
  const resolved = value == null ? fallback : value;
  return options.clone === false ? resolved : cloneJsonValue(resolved);
}

function countCsvDataRows(text) {
  return Math.max(
    0,
    String(text || '')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .length - 1
  );
}

function getFileVersionPayload(filePath, options = {}) {
  const signature = getFileSignature(filePath);
  if (!signature) {
    return {
      ok: false,
      version: null,
      updatedAt: null,
      size: 0,
      totalRows: 0,
      rowsPreview: [],
      message: 'File not found'
    };
  }

  let totalRows = 0;
  let rowsPreview = [];
  try {
    if (typeof options.rowsProvider === 'function') {
      const rows = options.rowsProvider();
      if (Array.isArray(rows)) {
        totalRows = rows.length;
        rowsPreview = rows.slice(0, options.previewLimit || 25);
      }
    } else if (options.kind === 'json-array') {
      const rows = readJsonCached(filePath, [], { clone: false });
      if (Array.isArray(rows)) {
        totalRows = rows.length;
        rowsPreview = rows.slice(0, options.previewLimit || 25);
      }
    } else if (options.kind === 'csv') {
      const text = readTextCached(filePath) || '';
      totalRows = countCsvDataRows(text);
    }
  } catch (_) {}

  return {
    ok: true,
    version: signature.key,
    updatedAt: signature.updatedAt,
    size: signature.size,
    totalRows,
    rowsPreview
  };
}

function clearFileCache(filePath) {
  const resolved = resolveKey(filePath);
  textCache.delete(resolved);
  for (const key of Array.from(parsedCache.keys())) {
    if (key.startsWith(`${resolved}::`)) parsedCache.delete(key);
  }
}

function writeTextFileCached(filePath, text, encoding = 'utf8') {
  fs.writeFileSync(filePath, text, encoding);
  clearFileCache(filePath);
}

function writeJsonFileCached(filePath, value, spacing = 2) {
  writeTextFileCached(filePath, JSON.stringify(value, null, spacing), 'utf8');
}

module.exports = {
  clearFileCache,
  countCsvDataRows,
  getFileSignature,
  getFileVersionPayload,
  cloneJsonValue,
  readJsonCached,
  readParsedCached,
  readTextCached,
  writeJsonFileCached,
  writeTextFileCached
};
