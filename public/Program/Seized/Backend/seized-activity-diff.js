const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function normalizeValue(value) {
  return String(value == null ? '' : value)
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(EASTERN_ARABIC_DIGITS.indexOf(digit)))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function recordFingerprint(record, columns) {
  const source = record && typeof record === 'object' ? record : {};
  return columns.map((column) => `${column}:${normalizeValue(source[column])}`).join('\u001f');
}

function takeBucketEntry(buckets, key) {
  if (!key) return null;
  const bucket = buckets.get(key);
  if (!bucket || !bucket.length) return null;
  const entry = bucket.shift();
  if (!bucket.length) buckets.delete(key);
  return entry;
}

function addBucketEntry(buckets, key, entry) {
  if (!key) return;
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(entry);
}

export function buildSeizedActivityItems(currentRecords, nextRecords, options = {}) {
  const columns = Array.isArray(options.columns) ? options.columns.filter(Boolean) : [];
  const identityColumns = Array.isArray(options.identityColumns)
    ? options.identityColumns.filter((column) => columns.includes(column))
    : [];
  if (!columns.length) return [];

  const currentEntries = (Array.isArray(currentRecords) ? currentRecords : []).map((record, index) => ({
    record,
    index,
    fullKey: recordFingerprint(record, columns),
    identityKey: recordFingerprint(record, identityColumns),
    matched: false
  }));
  const exactBuckets = new Map();
  currentEntries.forEach((entry) => addBucketEntry(exactBuckets, entry.fullKey, entry));

  const unmatchedNext = [];
  (Array.isArray(nextRecords) ? nextRecords : []).forEach((record, index) => {
    const fullKey = recordFingerprint(record, columns);
    const exact = takeBucketEntry(exactBuckets, fullKey);
    if (exact) {
      exact.matched = true;
      return;
    }
    unmatchedNext.push({
      record,
      index,
      fullKey,
      identityKey: recordFingerprint(record, identityColumns)
    });
  });

  const identityBuckets = new Map();
  currentEntries
    .filter((entry) => !entry.matched)
    .forEach((entry) => addBucketEntry(identityBuckets, entry.identityKey, entry));

  return unmatchedNext.map((entry) => {
    const before = takeBucketEntry(identityBuckets, entry.identityKey);
    if (before) {
      before.matched = true;
      return { action: 'edit', before: before.record, record: entry.record, index: entry.index };
    }
    return { action: 'add', record: entry.record, index: entry.index };
  });
}