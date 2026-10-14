const fs = require('fs');
const path = require('path');
const { appDataDir, dataFile } = require('./platform-paths');

let _referenceDataCache = null;

const LEGACY_DATA_DIR = path.join(__dirname, '..', 'Data');
const DATA_DIR = appDataDir('General', { legacyDirs: [LEGACY_DATA_DIR] });
const DATA_PATH = dataFile('General', 'reference-data.json', [
  path.join(LEGACY_DATA_DIR, 'reference-data.json')
]);

const DEFAULT_REFERENCE_DATA = {
  version: 1,
  updatedAt: '2026-04-11T00:00:00.000Z',
  sectors: [
    {
      key: 'east',
      label: 'شرق',
      stations: ['مكتب تجريبي 01', 'مكتب تجريبي 02', 'مكتب تجريبي 03', 'مكتب تجريبي 04', 'مكتب تجريبي 05', 'مكتب تجريبي 06', 'مكتب تجريبي 07', 'مكتب تجريبي 08', 'مكتب تجريبي 09', 'مكتب تجريبي 10']
    },
    {
      key: 'west',
      label: 'غرب',
      stations: ['مكتب تجريبي 11', 'مكتب تجريبي 12', 'مكتب تجريبي 13', 'مكتب تجريبي 14', 'مكتب تجريبي 15', 'مكتب تجريبي 16', 'مكتب تجريبي 17', 'مكتب تجريبي 18', 'مكتب تجريبي 19']
    },
    {
      key: 'south',
      label: 'جنوب',
      stations: ['مكتب تجريبي 20', 'مكتب تجريبي 21', 'مكتب تجريبي 22', 'مكتب تجريبي 23', 'مكتب تجريبي 24', 'مكتب تجريبي 25', 'مكتب تجريبي 26', 'مكتب تجريبي 27', 'مكتب تجريبي 28', 'مكتب تجريبي 29', 'مكتب تجريبي 30']
    },
    {
      key: 'north',
      label: 'شمال',
      stations: ['مكتب تجريبي 31', 'مكتب تجريبي 32', 'مكتب تجريبي 33', 'مكتب تجريبي 34', 'مكتب تجريبي 35', 'مكتب تجريبي 36', 'مكتب تجريبي 37', 'مكتب تجريبي 38', 'مكتب تجريبي 39', 'مكتب تجريبي 40']
    },
    {
      key: 'sectorfive',
      label: 'القطاع التجريبي الخامس',
      stations: ['مكتب تجريبي 41', 'مكتب تجريبي 42', 'مكتب تجريبي 43', 'مكتب تجريبي 44', 'مكتب تجريبي 45']
    }
  ],
  licenseTypes: {
    weapons: [
      { name: 'اخطار', aliases: ['أخطار', 'إخطار', 'اخطار شرطة', 'أخطار شرطة'] },
      { name: 'دفاع', aliases: ['دفاع نفس', 'دفاع عن النفس'] },
      { name: 'حراسه', aliases: ['حراسة'] },
      { name: 'صيد' },
      { name: 'اعفاء هيئات قضائية' },
      { name: 'رماه دوليين' },
      { name: 'مخابرات عامه', aliases: ['مخابرات', 'مخابرات عامة'] },
      { name: 'رقابة ادارية', aliases: ['رقابة إدارية'] },
      { name: 'دفاع طالما في عمله', aliases: ['دفاع طالما بالعمل', 'دفاع طالمه في عمله'] },
      { name: 'اعفاء دبلوماسين', aliases: ['إعفاء دبلوماسيين', 'اعفاء دبلوماسيين'] },
      { name: 'إعفاء شرطة', aliases: ['اعفاء شرطة'] },
      { name: 'إعفاء قوات مسلحة', aliases: ['اعفاء قوات مسلحة'] },
      { name: 'إتجار', aliases: ['اتجار'] }
    ],
    renewal: [
      { name: 'اخطار', aliases: ['أخطار', 'إخطار', 'اخطار شرطة', 'أخطار شرطة'] },
      { name: 'دفاع', aliases: ['دفاع نفس', 'دفاع عن النفس'] },
      { name: 'حراسة', aliases: ['حراسه'] },
      { name: 'صيد' },
      { name: 'اعفاء هيئات قضائية' },
      { name: 'رماه دوليين' },
      { name: 'مخابرات', aliases: ['مخابرات عامه', 'مخابرات عامة'] },
      { name: 'رقابة ادارية', aliases: ['رقابة إدارية'] },
      { name: 'دفاع طالما بالعمل', aliases: ['دفاع طالما في عمله', 'دفاع طالمه في عمله'] },
      { name: 'اعفاء دبلوماسين', aliases: ['إعفاء دبلوماسيين', 'اعفاء دبلوماسيين'] },
      { name: 'إعفاء شرطة', aliases: ['اعفاء شرطة'] },
      { name: 'إعفاء قوات مسلحة', aliases: ['اعفاء قوات مسلحة'] },
      { name: 'إتجار', aliases: ['اتجار'] }
    ],
    request: [
      { name: 'ترخيص جديد' },
      { name: 'ترخيص اضافة', aliases: ['ترخيص إضافة'] },
      { name: 'اعادة ترخيص', aliases: ['إعادة ترخيص'] },
      { name: 'أخرى', aliases: ['اخرى'] }
    ]
  }
};

const FRANKO_CHAR_MAP = {
  ا: 'a',
  ب: 'b',
  ت: 't',
  ث: 'th',
  ج: 'g',
  ح: '7',
  خ: '5',
  د: 'd',
  ذ: 'z',
  ر: 'r',
  ز: 'z',
  س: 's',
  ش: 'sh',
  ص: 's',
  ض: 'd',
  ط: 't',
  ظ: 'z',
  ع: '3',
  غ: '8',
  ف: 'f',
  ق: 'q',
  ك: 'k',
  ل: 'l',
  م: 'm',
  ن: 'n',
  ه: 'h',
  و: 'w',
  ي: 'y',
  ء: 'a'
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function toLatinDigits(value) {
  return String(value || '')
    .replace(/[\u0660-\u0669]/g, (char) => String(char.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (char) => String(char.charCodeAt(0) - 0x06F0));
}

function normalizeDisplayText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeArabicForMatch(value) {
  return toLatinDigits(String(value || ''))
    .replace(/\uFEFF/g, '')
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[هة]/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeMatchKey(value) {
  return normalizeArabicForMatch(value).replace(/[^\p{L}\p{N}]+/gu, '');
}

function buildFlexibleArabicMatchKeys(value) {
  const normalized = normalizeArabicForMatch(value);
  if (!normalized) return new Set();
  const variants = new Set([normalized]);
  const loosened = normalized
    .split(/\s+/)
    .map((token) => (token.length >= 4 ? token.replace(/ي$/u, '') : token))
    .join(' ')
    .trim();
  if (loosened) variants.add(loosened);
  const keys = new Set();
  variants.forEach((variant) => {
    const key = variant.replace(/[^\p{L}\p{N}]+/gu, '');
    if (key) keys.add(key);
  });
  return keys;
}

function generateFrankoKey(value, fallback = '') {
  const source = normalizeDisplayText(value || fallback);
  if (!source) return '';
  const normalized = toLatinDigits(source)
    .replace(/\uFEFF/g, '')
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase();

  let result = '';
  for (const char of normalized) {
    if (FRANKO_CHAR_MAP[char]) {
      result += FRANKO_CHAR_MAP[char];
      continue;
    }
    if (/[a-z0-9]/.test(char)) {
      result += char;
    }
  }
  return result.replace(/[^a-z0-9]+/g, '');
}

function normalizeSectorKey(value, fallback = '') {
  const raw = String(value || '').trim();
  if (raw) {
    const generated = generateFrankoKey(raw);
    if (generated) return generated;
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9_-]+/g, '');
    if (cleaned) return cleaned;
  }
  const fallbackRaw = String(fallback || '').trim();
  if (!fallbackRaw) return '';
  return generateFrankoKey(fallbackRaw) || fallbackRaw.toLowerCase().replace(/[^a-z0-9_-]+/g, '');
}

function uniqueStrings(list, excluded = []) {
  const result = [];
  const seen = new Set((Array.isArray(excluded) ? excluded : []).map((value) => normalizeMatchKey(value)).filter(Boolean));
  (Array.isArray(list) ? list : []).forEach((item) => {
    const text = normalizeDisplayText(item);
    const key = normalizeMatchKey(text);
    if (!text || !key || seen.has(key)) return;
    seen.add(key);
    result.push(text);
  });
  return result;
}

function getStationDisplayName(entry) {
  if (typeof entry === 'string') return normalizeDisplayText(entry);
  return normalizeDisplayText(entry && entry.name);
}

function isCorruptedStationValue(value) {
  const text = normalizeDisplayText(value);
  return !text || text === '[object Object]' || text === 'undefined' || text === 'null';
}

function getStationSourceValue(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const candidate = entry.name ?? entry.label ?? entry.value ?? '';
  return typeof candidate === 'string' || typeof candidate === 'number' ? candidate : '';
}

function hasCorruptedStationEntries(list) {
  const items = Array.isArray(list) ? list : [];
  if (!items.length) return false;
  return items.some((item) => {
    if (typeof item === 'string' || typeof item === 'number') {
      return isCorruptedStationValue(item);
    }
    if (!item || typeof item !== 'object') {
      return true;
    }
    return isCorruptedStationValue(getStationSourceValue(item));
  });
}

function normalizeStationEntry(entry) {
  if (typeof entry === 'string' || typeof entry === 'number') {
    return { name: normalizeDisplayText(entry), aliases: [] };
  }
  if (!entry || typeof entry !== 'object') {
    return { name: '', aliases: [] };
  }
  const rawName = getStationSourceValue(entry);
  if (isCorruptedStationValue(rawName)) {
    return { name: '', aliases: [] };
  }
  const name = normalizeDisplayText(rawName);
  return {
    name,
    aliases: uniqueStrings(entry.aliases, [name])
  };
}

function normalizeStationEntries(list) {
  const result = [];
  const indexByKey = new Map();
  (Array.isArray(list) ? list : []).forEach((item) => {
    const normalized = normalizeStationEntry(item);
    const key = normalizeMatchKey(normalized.name);
    if (!normalized.name || !key) return;
    if (indexByKey.has(key)) {
      const existing = result[indexByKey.get(key)];
      existing.aliases = uniqueStrings((existing.aliases || []).concat(normalized.aliases || []), [existing.name]);
      return;
    }
    indexByKey.set(key, result.length);
    result.push(normalized);
  });
  return result;
}

function normalizeLicenseTypeEntry(entry) {
  if (typeof entry === 'string') {
    return { name: normalizeDisplayText(entry), aliases: [] };
  }
  if (!entry || typeof entry !== 'object') {
    return { name: '', aliases: [] };
  }
  const name = normalizeDisplayText(entry.name);
  return {
    name,
    aliases: uniqueStrings(entry.aliases, [name])
  };
}

function normalizeLicenseTypeEntries(list) {
  const result = [];
  const indexByKey = new Map();
  (Array.isArray(list) ? list : []).forEach((entry) => {
    const normalized = normalizeLicenseTypeEntry(entry);
    const key = normalizeMatchKey(normalized.name);
    if (!normalized.name || !key) return;
    if (indexByKey.has(key)) {
      const existing = result[indexByKey.get(key)];
      existing.aliases = uniqueStrings((existing.aliases || []).concat(normalized.aliases || []), [existing.name]);
      return;
    }
    indexByKey.set(key, result.length);
    result.push(normalized);
  });
  return result;
}

function buildUnifiedLicenseTypes(licenseTypesInput) {
  const source = licenseTypesInput && typeof licenseTypesInput === 'object' ? licenseTypesInput : {};
  const scopeKeys = new Set(['shared', 'weapons', 'renewal', 'request']);
  Object.keys(source).forEach((scope) => {
    const scopeKey = normalizeSectorKey(scope, scope);
    if (scopeKey) scopeKeys.add(scopeKey);
  });

  const mergedEntries = [];
  const indexByKey = new Map();
  const mergeValues = (values) => {
    normalizeLicenseTypeEntries(values).forEach((entry) => {
      const key = normalizeMatchKey(entry.name);
      if (!key) return;
      if (indexByKey.has(key)) {
        const existing = mergedEntries[indexByKey.get(key)];
        existing.aliases = uniqueStrings((existing.aliases || []).concat(entry.aliases || []), [existing.name]);
        return;
      }
      indexByKey.set(key, mergedEntries.length);
      mergedEntries.push(entry);
    });
  };

  const sourceValues = Object.values(source);
  if (sourceValues.length) {
    sourceValues.forEach(mergeValues);
  } else {
    Object.values(DEFAULT_REFERENCE_DATA.licenseTypes || {}).forEach(mergeValues);
  }

  return Object.fromEntries(Array.from(scopeKeys).map((scope) => [scope, clone(mergedEntries)]));
}

function normalizeReferenceDataInput(input) {
  const base = input && typeof input === 'object' ? input : {};
  const sectorsInput = Array.isArray(base.sectors) && base.sectors.length
    ? base.sectors
    : DEFAULT_REFERENCE_DATA.sectors;
  const licenseTypesInput = base.licenseTypes && typeof base.licenseTypes === 'object'
    ? base.licenseTypes
    : DEFAULT_REFERENCE_DATA.licenseTypes;

  const sectors = [];
  const sectorSeen = new Set();
  sectorsInput.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const fallbackLabel = DEFAULT_REFERENCE_DATA.sectors[index] ? DEFAULT_REFERENCE_DATA.sectors[index].label : `قطاع ${index + 1}`;
    const label = normalizeDisplayText(entry.label || fallbackLabel);
    const fallbackKey = DEFAULT_REFERENCE_DATA.sectors[index] ? DEFAULT_REFERENCE_DATA.sectors[index].key : generateFrankoKey(label, `sector${index + 1}`);
    const key = normalizeSectorKey(entry.key || label, fallbackKey);
    if (!key || !label || sectorSeen.has(key)) return;
    sectorSeen.add(key);
    const fallbackStations = DEFAULT_REFERENCE_DATA.sectors[index] ? DEFAULT_REFERENCE_DATA.sectors[index].stations : [];
    const rawStations = Array.isArray(entry.stations) ? entry.stations : [];
    const normalizedStations = normalizeStationEntries(rawStations);
    sectors.push({
      key,
      label,
      aliases: uniqueStrings(entry.aliases, [key, label]),
      stations: normalizedStations.length || !hasCorruptedStationEntries(rawStations)
        ? normalizedStations
        : normalizeStationEntries(fallbackStations)
    });
  });

  const normalizedLicenseTypes = buildUnifiedLicenseTypes(licenseTypesInput);

  if (!sectors.length) {
    return normalizeReferenceDataInput(DEFAULT_REFERENCE_DATA);
  }

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    sectors,
    licenseTypes: normalizedLicenseTypes
  };
}

function writeReferenceData(data) {
  ensureDirSync(DATA_DIR);
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
  _referenceDataCache = null;
}

function ensureReferenceData() {
  if (_referenceDataCache) return _referenceDataCache;

  ensureDirSync(DATA_DIR);
  if (!fs.existsSync(DATA_PATH)) {
    const initial = normalizeReferenceDataInput(DEFAULT_REFERENCE_DATA);
    writeReferenceData(initial);
    _referenceDataCache = initial;
    return initial;
  }

  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const normalized = normalizeReferenceDataInput(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      writeReferenceData(normalized);
    }
    _referenceDataCache = normalized;
    return normalized;
  } catch (_) {
    const fallback = normalizeReferenceDataInput(DEFAULT_REFERENCE_DATA);
    writeReferenceData(fallback);
    _referenceDataCache = fallback;
    return fallback;
  }
}

function loadReferenceData() {
  return ensureReferenceData();
}

function saveReferenceData(input) {
  const normalized = normalizeReferenceDataInput(input);
  writeReferenceData(normalized);
  return normalized;
}

function generateSectorMatchKeys(entry) {
  const keys = new Set();
  const values = [entry && entry.label, entry && entry.key].concat(Array.isArray(entry && entry.aliases) ? entry.aliases : []);
  values.forEach((rawValue) => {
    const value = normalizeDisplayText(rawValue);
    if (!value) return;
    keys.add(normalizeMatchKey(value));
    if (/[\u0600-\u06ff]/u.test(value)) {
      keys.add(normalizeMatchKey(`قطاع ${value}`));
      if (!value.startsWith('ال')) {
        keys.add(normalizeMatchKey(`ال${value}`));
        keys.add(normalizeMatchKey(`قطاع ال${value}`));
      } else {
        keys.add(normalizeMatchKey(value.replace(/^ال/u, '')));
      }
    }
  });
  return keys;
}

function generateStationMatchKeys(stationEntry) {
  const keys = new Set();
  const values = [getStationDisplayName(stationEntry)].concat(Array.isArray(stationEntry && stationEntry.aliases) ? stationEntry.aliases : []);
  values.forEach((rawValue) => {
    const display = normalizeDisplayText(rawValue);
    if (!display) return;
    const variants = new Set([display]);
    variants.add(display.replace(/^مدينة\s+/u, '').trim());
    variants.add(display.replace(/^قسم\s+/u, '').trim());
    variants.add(display.replace(/^مركز\s+/u, '').trim());
    variants.add(display.replace(/^شرطة\s+/u, '').trim());
    Array.from(variants).forEach((variant) => {
      if (variant) variants.add(variant.replace(/^ال/u, '').trim());
    });
    variants.forEach((variant) => {
      buildFlexibleArabicMatchKeys(variant).forEach((matchKey) => keys.add(matchKey));
    });
  });
  return keys;
}

function generateLicenseTypeMatchKeys(entry) {
  const keys = new Set();
  const values = [entry && entry.name].concat(Array.isArray(entry && entry.aliases) ? entry.aliases : []);
  values.forEach((value) => {
    const matchKey = normalizeMatchKey(value);
    if (matchKey) keys.add(matchKey);
  });
  return keys;
}

function resolveSectorEntry(value, data = loadReferenceData()) {
  const matchKey = normalizeMatchKey(value);
  if (!matchKey) return null;
  return data.sectors.find((entry) => generateSectorMatchKeys(entry).has(matchKey)) || null;
}

function resolveSectorKey(value, data = loadReferenceData()) {
  const entry = resolveSectorEntry(value, data);
  return entry ? entry.key : '';
}

function resolveSectorLabel(value, data = loadReferenceData()) {
  const entry = resolveSectorEntry(value, data);
  return entry ? entry.label : '';
}

function resolveSectorStations(value, data = loadReferenceData()) {
  const entry = resolveSectorEntry(value, data);
  return entry && Array.isArray(entry.stations) ? entry.stations.map(getStationDisplayName).filter(Boolean) : [];
}

function resolveStationName(value, sectorValue = '', data = loadReferenceData()) {
  const matchKey = normalizeMatchKey(value);
  const display = normalizeDisplayText(value);
  if (!matchKey) return '';

  const sectorEntry = sectorValue ? resolveSectorEntry(sectorValue, data) : null;
  const sectorList = sectorEntry ? [sectorEntry] : data.sectors;
  const matches = [];

  sectorList.forEach((entry) => {
    (Array.isArray(entry.stations) ? entry.stations : []).forEach((station) => {
      if (generateStationMatchKeys(station).has(matchKey)) {
        matches.push({ sector: entry, station: getStationDisplayName(station) });
      }
    });
  });

  if (!matches.length) return display;
  if (!sectorEntry && matches.length > 1) {
    const uniqueStations = Array.from(new Set(matches.map((item) => item.station)));
    if (uniqueStations.length === 1) return uniqueStations[0];
  }
  return matches[0].station;
}

function detectSectorEntryFromStation(value, data = loadReferenceData()) {
  const matchKey = normalizeMatchKey(value);
  if (!matchKey) return null;
  return data.sectors.find((entry) => (Array.isArray(entry.stations) ? entry.stations : []).some((station) => generateStationMatchKeys(station).has(matchKey))) || null;
}

function detectSectorKeyFromStation(value, data = loadReferenceData()) {
  const entry = detectSectorEntryFromStation(value, data);
  return entry ? entry.key : '';
}

function detectSectorLabelFromStation(value, data = loadReferenceData()) {
  const entry = detectSectorEntryFromStation(value, data);
  return entry ? entry.label : '';
}

function getSectorChoicesByLabel(data = loadReferenceData()) {
  return data.sectors.map((entry) => ({ value: entry.label, label: entry.label, key: entry.key }));
}

function getSectorChoicesByKey(data = loadReferenceData()) {
  return data.sectors.map((entry) => ({ value: entry.key, label: entry.label, key: entry.key }));
}

function getSectorStationsByLabel(data = loadReferenceData()) {
  return Object.fromEntries(data.sectors.map((entry) => [entry.label, Array.isArray(entry.stations) ? entry.stations.map(getStationDisplayName).filter(Boolean) : []]));
}

function getSectorStationsByKey(data = loadReferenceData()) {
  return Object.fromEntries(data.sectors.map((entry) => [entry.key, Array.isArray(entry.stations) ? entry.stations.map(getStationDisplayName).filter(Boolean) : []]));
}

function getSectorKeyToLabelMap(data = loadReferenceData()) {
  return Object.fromEntries(data.sectors.map((entry) => [entry.key, entry.label]));
}

function getSectorLabelToKeyMap(data = loadReferenceData()) {
  return Object.fromEntries(data.sectors.map((entry) => [entry.label, entry.key]));
}

function getLicenseTypeEntries(scope = 'weapons', data = loadReferenceData()) {
  const requestedScope = normalizeSectorKey(scope, scope) || 'weapons';
  const exact = data.licenseTypes[requestedScope];
  if (Array.isArray(exact) && exact.length) return clone(exact);
  if (Array.isArray(data.licenseTypes.shared)) return clone(data.licenseTypes.shared);
  return Array.isArray(data.licenseTypes.weapons) ? clone(data.licenseTypes.weapons) : [];
}

function getLicenseTypes(scope = 'weapons', data = loadReferenceData()) {
  return getLicenseTypeEntries(scope, data).map((entry) => entry.name);
}

function resolveLicenseType(value, scope = 'weapons', data = loadReferenceData()) {
  const matchKey = normalizeMatchKey(value);
  const display = normalizeDisplayText(value);
  if (!matchKey) return '';
  const entries = getLicenseTypeEntries(scope, data);
  const matched = entries.find((entry) => generateLicenseTypeMatchKeys(entry).has(matchKey));
  return matched ? matched.name : display;
}

function sanitizeReferenceDataForClient(data = loadReferenceData()) {
  return {
    version: 1,
    updatedAt: data.updatedAt,
    sectors: data.sectors.map((entry) => ({
      key: entry.key,
      label: entry.label,
      aliases: Array.isArray(entry.aliases) ? entry.aliases.slice() : [],
      stations: (Array.isArray(entry.stations) ? entry.stations : []).map((station) => ({
        name: getStationDisplayName(station),
        aliases: Array.isArray(station && station.aliases) ? station.aliases.slice() : []
      }))
    })),
    licenseTypes: Object.fromEntries(
      Object.entries(data.licenseTypes || {}).map(([scope, entries]) => [
        scope,
        (Array.isArray(entries) ? entries : []).map((entry) => ({
          name: entry.name,
          aliases: Array.isArray(entry.aliases) ? entry.aliases.slice() : []
        }))
      ])
    )
  };
}

module.exports = {
  DATA_PATH,
  DEFAULT_REFERENCE_DATA,
  ensureReferenceData,
  loadReferenceData,
  saveReferenceData,
  sanitizeReferenceDataForClient,
  normalizeDisplayText,
  normalizeArabicForMatch,
  normalizeMatchKey,
  generateFrankoKey,
  resolveSectorEntry,
  resolveSectorKey,
  resolveSectorLabel,
  resolveSectorStations,
  resolveStationName,
  detectSectorKeyFromStation,
  detectSectorLabelFromStation,
  getSectorChoicesByLabel,
  getSectorChoicesByKey,
  getSectorStationsByLabel,
  getSectorStationsByKey,
  getSectorKeyToLabelMap,
  getSectorLabelToKeyMap,
  getLicenseTypeEntries,
  getLicenseTypes,
  resolveLicenseType
};
