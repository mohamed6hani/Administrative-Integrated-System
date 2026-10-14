const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const initSqlJs = require('sql.js');
const {
  PROGRAM_ROOT,
  appDataDir,
  dataSubdir,
  dataFile
} = require('./platform-paths');
const {
  resolveSectorLabel,
  resolveStationName
} = require('./reference-data-store');
const {
  createStorageService
} = require('../../Storage/backend/storage-service');
const {
  readDecisionText
} = require('../../Report/backend/text-index-store');
const {
  createWeaponsSqlStore
} = require('../../Weapons/backend/sql-store');

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const DIACRITICS_RE = /[\u064B-\u065F\u0670\u0640]/g;

const PROGRAM_LABELS = {
  weapons: 'برنامج الرخص الملغاة',
  renewal: 'برنامج الملفات التي لم ترد',
  report: 'برنامج القرارات',
  accept: 'موافقة شؤون الضباط',
  request: 'برنامج طلبات ترخيص اول مرة',
  seized: 'برنامج الأحراز',
  storage: 'التخزين الموحد',
  company: 'إدارة شركات الحراسة'
};

const REPORT_DATASETS = [
  { key: 'civilians', label: 'مدنيين', file: 'decisions.csv', photoDir: 'photoC' },
  { key: 'police', label: 'شرطة', file: 'decision2.csv', photoDir: 'photoP' },
  { key: 'military', label: 'قوات مسلحة', file: 'decision3.csv', photoDir: 'photoA' }
];
const GLOBAL_SEARCH_REFERENCE_SECRET = crypto.randomBytes(32);
const INTERNAL_ATTACHMENTS_KEY = '__globalSearchAttachments';
const PREVIEW_IMAGE_EXTENSIONS = new Set(['.bmp', '.gif', '.heic', '.jpeg', '.jpg', '.png', '.tif', '.tiff', '.webp']);
const MIME_TYPES = {
  '.bmp': 'image/bmp',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};
let globalSearchWeaponsStore = null;

const RENEWAL_DISPLAY_COLUMNS = [
  { key: 'licenseNumber', label: 'رقم الرخصة', aliases: ['رقم الرخصة'] },
  { key: 'licenseType', label: 'نوع الرخصة', aliases: ['نوع الرخصة'] },
  { key: 'name', label: 'الاسم', aliases: ['الاســـــــم', 'الاسم'] },
  { key: 'station', label: 'القسم', aliases: ['القسم'] },
  { key: 'sector', label: 'القطاع', aliases: ['قطاع', 'القطاع'] },
  { key: 'renewal', label: 'التجديد', aliases: ['التجديد', 'تجديد', 'Renewal', 'renewal', 'تم التجديد'] },
  { key: 'notes', label: 'ملاحظات', aliases: ['ملاحظـــات', 'ملاحظات'], kind: 'notes' }
];
const REPORT_DISPLAY_COLUMNS = [
  { key: 'decisionNumber', label: 'رقم القرار', aliases: ['رقم القرار'] },
  { key: 'decisionDate', label: 'تاريخ القرار', aliases: ['تاريخ القرار'] },
  { key: 'name', label: 'الاسم', aliases: ['الاسم'] },
  { key: 'job', label: 'الوظيفة', aliases: ['الوظيفة'] },
  { key: 'licenseType', label: 'نوع الترخيص', aliases: ['نوع الترخيص'] },
  { key: 'weaponType', label: 'نوع السلاح', aliases: ['نوع السلاح'] },
  { key: 'purpose', label: 'الغرض', aliases: ['الغرض'] },
  { key: 'sector', label: 'القطاع', aliases: ['القطاع'] },
  { key: 'station', label: 'قسم الشرطة', aliases: ['قسم الشرطة', 'القسم'] },
  { key: 'decisionManager', label: 'مدير الامن', aliases: ['قرار مدير الامن', 'القرار'] },
  { key: 'decisionPublic', label: 'امن العام', aliases: ['قرار امن العام'] },
  { key: 'recommendation', label: 'توصية', aliases: ['توصية'], kind: 'notes' }
];
const SEIZED_DISPLAY_COLUMNS = [
  'الفئة', 'رقم الحرز', 'رقم الرخصة', 'نوع الرخصة', 'القسم', 'الاسم', 'النوع', 'الماركة',
  'العيار', 'الرقم', 'سبب الالغاء', 'تاريخ الايداع', 'تاريخ الانتهاء', 'مالك الحرز', 'نوع الحرز', 'ملاحظات'
].map((label) => ({ key: label === 'ملاحظات' ? 'notes' : label, label, aliases: [label], kind: label === 'ملاحظات' ? 'notes' : '' }));

function toEnglishDigits(value) {
  return String(value || '').replace(/[٠-٩۰-۹]/g, (digit) => {
    const arabicIndex = ARABIC_DIGITS.indexOf(digit);
    if (arabicIndex >= 0) return String(arabicIndex);
    const easternIndex = EASTERN_ARABIC_DIGITS.indexOf(digit);
    return easternIndex >= 0 ? String(easternIndex) : digit;
  });
}

function normalizeSearchText(value) {
  return toEnglishDigits(value)
    .replace(DIACRITICS_RE, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeContiguousSearchText(value) {
  return normalizeSearchText(value)
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^0-9a-z\u0600-\u06FF]+/gi, '');
}
function safeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\r|\n/g, ' ').trim();
}

function collectSearchableScalarValues(value, options = {}, depth = 0, seen = new Set()) {
  const maxDepth = Number.isFinite(Number(options.maxDepth))
    ? Math.max(0, Number(options.maxDepth))
    : 4;
  if (value === null || value === undefined || depth > maxDepth) return [];

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean' || valueType === 'bigint') {
    const text = safeText(value);
    return text ? [text] : [];
  }
  if (valueType !== 'object' || seen.has(value)) return [];

  seen.add(value);
  const entries = Array.isArray(value)
    ? value.map((item) => ['', item])
    : Object.entries(value).filter(([key]) => !String(key).startsWith('__globalSearch'));
  return entries.flatMap(([, item]) => (
    collectSearchableScalarValues(item, options, depth + 1, seen)
  ));
}

function extractReportYear(value) {
  const normalized = toEnglishDigits(value);
  const match = normalized.match(/(19|20)\d{2}/);
  return match ? match[0] : '';
}

function getReportDecisionIdentity(record, recordIndex, counters = {}) {
  const explicitDecisionNumber = safeText(record && (
    record['رقم القرار'] ?? record.id ?? record.decisionNumber
  ));
  const year = extractReportYear(record && (
    record['تاريخ القرار'] ?? record.date ?? record.decisionDate
  ));
  const bucket = year || '__no_year__';
  counters[bucket] = (Number(counters[bucket]) || 0) + 1;
  const decisionNumber = explicitDecisionNumber || String(counters[bucket] || Number(recordIndex) + 1);
  const baseDigits = toEnglishDigits(decisionNumber).replace(/[^0-9]/g, '');
  const base = baseDigits || String(Number(recordIndex) + 1);
  const attachmentId = year ? `${base}_${year.slice(-2)}` : base;
  const name = safeText(record && (record['الاسم'] ?? record.name));
  return { decisionNumber, attachmentId, name };
}

function setInternalRecordValue(record, key, value) {
  if (!record || typeof record !== 'object') return record;
  Object.defineProperty(record, key, {
    value,
    configurable: true,
    enumerable: false,
    writable: true
  });
  return record;
}

function getAttachmentMimeType(fileName, providedMimeType = '') {
  const provided = safeText(providedMimeType).toLowerCase();
  if (provided && provided !== 'application/octet-stream') return provided;
  return MIME_TYPES[path.extname(String(fileName || '')).toLowerCase()] || 'application/octet-stream';
}

function getAttachmentPreviewKind(fileName, mimeType = '') {
  const normalizedMime = getAttachmentMimeType(fileName, mimeType);
  const extension = path.extname(String(fileName || '')).toLowerCase();
  if (normalizedMime.startsWith('image/') || PREVIEW_IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (normalizedMime === 'application/pdf' || extension === '.pdf') return 'pdf';
  return 'download';
}

function createInternalAttachment(name, absolutePath, mimeType = '') {
  const displayName = safeText(name || path.basename(String(absolutePath || '')));
  const resolvedPath = absolutePath ? path.resolve(String(absolutePath)) : '';
  if (!displayName || !resolvedPath) return null;
  return {
    name: displayName,
    absolutePath: resolvedPath,
    mimeType: getAttachmentMimeType(displayName, mimeType)
  };
}

function setRecordAttachments(record, attachments) {
  const normalized = (Array.isArray(attachments) ? attachments : []).filter(Boolean);
  setInternalRecordValue(record, INTERNAL_ATTACHMENTS_KEY, normalized);
  return normalized;
}

function getRecordAttachments(record) {
  return Array.isArray(record && record[INTERNAL_ATTACHMENTS_KEY])
    ? record[INTERNAL_ATTACHMENTS_KEY].filter(Boolean)
    : [];
}

function readDisplayField(record, aliases) {
  return firstField(record, Array.isArray(aliases) ? aliases : []);
}

function createDisplayColumns(record, definitions) {
  return (Array.isArray(definitions) ? definitions : []).map((definition) => ({
    key: safeText(definition.key || definition.label),
    label: safeText(definition.label || definition.key),
    value: readDisplayField(record, definition.aliases || [definition.label || definition.key]),
    kind: safeText(definition.kind)
  }));
}

function getWeaponEntries(record) {
  return (Array.isArray(record && record.__globalSearchWeaponEntries)
    ? record.__globalSearchWeaponEntries
    : [])
    .map((entry) => ({
      name: safeText(entry && entry.name),
      withdrawn: Boolean(entry && entry.withdrawn),
      depositNumber: safeText(entry && entry.depositNumber),
      depositDate: safeText(entry && entry.depositDate)
    }))
    .filter((entry) => entry.name);
}

function getWeaponsStatus(entries, fallback = '') {
  if (!entries.length) return { code: 'empty', label: safeText(fallback) || 'لا توجد بيانات' };
  const withdrawnCount = entries.filter((entry) => entry.withdrawn).length;
  if (withdrawnCount === entries.length) return { code: 'withdrawn', label: 'تم سحب جميع الأسلحة' };
  if (withdrawnCount === 0) return { code: 'not-withdrawn', label: 'لم يتم سحب أي سلاح' };
  return { code: 'partial', label: `سحب جزئي (${withdrawnCount}/${entries.length})` };
}

function buildGlobalSearchDisplayRecord(set, record, recordIndex = 0) {
  const programKey = safeText(set && set.key).toLowerCase();
  if (programKey === 'weapons') {
    const entries = getWeaponEntries(record);
    return {
      variant: 'weapons',
      columns: createDisplayColumns(record, set && set.displayColumns),
      weapons: entries,
      status: getWeaponsStatus(entries, readDisplayField(record, ['حالة السحب']))
    };
  }
  if (programKey === 'renewal') {
    return { variant: 'renewal', columns: createDisplayColumns(record, RENEWAL_DISPLAY_COLUMNS) };
  }
  if (programKey === 'report') {
    const identity = record && record.__globalSearchReportIdentity
      ? record.__globalSearchReportIdentity
      : getReportDecisionIdentity(record, recordIndex, Object.create(null));
    const columns = createDisplayColumns(record, REPORT_DISPLAY_COLUMNS);
    const decisionColumn = columns.find((column) => column.key === 'decisionNumber');
    if (decisionColumn && !decisionColumn.value) decisionColumn.value = safeText(identity.decisionNumber);
    const text = String(record && record.__globalSearchExtraText || '').trim();
    return {
      variant: 'report',
      columns,
      textIndex: {
        text,
        lineCount: text ? text.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).length : 0
      }
    };
  }
  if (programKey === 'seized') {
    return { variant: 'seized', columns: createDisplayColumns(record, SEIZED_DISPLAY_COLUMNS) };
  }
  if (programKey === 'request') {
    return {
      variant: 'request',
      summary: {
        name: readDisplayField(record, ['name', 'requesterName']),
        applicationDate: readDisplayField(record, ['applicationDate', 'date']),
        sector: readDisplayField(record, ['sector']),
        station: readDisplayField(record, ['station']),
        weapon: readDisplayField(record, ['weaponData']),
        notes: readDisplayField(record, ['notes', 'ملاحظات'])
      }
    };
  }
  if (programKey === 'accept') {
    return {
      variant: 'accept',
      columns: createDisplayColumns(record, [
        { key: 'rank', label: 'الرتبة', aliases: ['rank', 'الرتبة'] },
        { key: 'name', label: 'الاسم', aliases: ['name', 'الاسم'] },
        { key: 'workplace', label: 'جهة العمل', aliases: ['workplace', 'جهة العمل'] },
        { key: 'date', label: 'التاريخ', aliases: ['date', 'approvalDate'] },
        { key: 'residence', label: 'محل الإقامة', aliases: ['residence'] }
      ])
    };
  }
  if (programKey === 'storage') {
    return {
      variant: 'storage',
      columns: createDisplayColumns(record, [
        { key: 'title', label: 'العنوان', aliases: ['title'] },
        { key: 'fileName', label: 'اسم الملف', aliases: ['originalName'] },
        { key: 'description', label: 'الوصف', aliases: ['description'], kind: 'notes' },
        { key: 'uploadedBy', label: 'رفع بواسطة', aliases: ['uploadedByDisplay', 'uploadedBy'] }
      ])
    };
  }
  if (programKey === 'company') {
    return {
      variant: 'company',
      columns: createDisplayColumns(record, [
        { key: 'name', label: 'اسم الشركة', aliases: ['company_name'] },
        { key: 'license', label: 'رقم الترخيص', aliases: ['license_number'] },
        { key: 'sector', label: 'القطاع', aliases: ['sector'] },
        { key: 'station', label: 'القسم', aliases: ['station'] },
        { key: 'notes', label: 'ملاحظات', aliases: ['notes'], kind: 'notes' }
      ])
    };
  }
  return {
    variant: 'generic',
    columns: createDisplayColumns(record, [
      { key: 'name', label: 'الاسم', aliases: (set && set.fields && set.fields.name) || ['name'] },
      { key: 'license', label: 'رقم الرخصة', aliases: (set && set.fields && set.fields.licenseNumber) || [] },
      { key: 'sector', label: 'القطاع', aliases: (set && set.fields && set.fields.sector) || [] },
      { key: 'station', label: 'القسم', aliases: (set && set.fields && set.fields.station) || [] }
    ])
  };
}

function normalizeStoredAttachmentList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => safeText(entry)).filter(Boolean);
  }
  const raw = safeText(value);
  if (!raw) return [];
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeStoredAttachmentList(parsed);
    } catch (_) {}
  }
  return raw.split('|').map((entry) => entry.trim()).filter(Boolean);
}

function safeAttachmentInDirectory(directoryPath, fileName, displayName = '') {
  const safeName = path.basename(String(fileName || '').trim());
  if (!safeName || safeName !== String(fileName || '').trim()) return null;
  const root = path.resolve(directoryPath);
  const filePath = path.resolve(root, safeName);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) return null;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  return createInternalAttachment(displayName || safeName, filePath);
}

function listReportRecordAttachments(directoryPath, attachmentId) {
  const id = String(attachmentId || '').replace(/[^0-9_]/g, '');
  if (!id || !fs.existsSync(directoryPath)) return [];
  const expression = id.includes('_')
    ? new RegExp(`^row-${id}([a-z])?\\.(jpg|jpeg|png|webp|pdf)$`, 'i')
    : new RegExp(`^row-${id}(?:_\\d+)?([a-z])?\\.(jpg|jpeg|png|webp|pdf)$`, 'i');
  try {
    return fs.readdirSync(directoryPath)
      .filter((fileName) => expression.test(String(fileName || '')))
      .sort((left, right) => left.localeCompare(right, 'ar'))
      .map((fileName) => safeAttachmentInDirectory(directoryPath, fileName))
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function stableRecordFingerprint(set, record, recordIndex) {
  const fields = set && set.fields ? set.fields : {};
  const identity = [
    safeText(set && set.key),
    safeText(set && (set.datasetKey || (set.extraParams && set.extraParams.dataset))),
    String(recordIndex),
    firstField(record, fields.id),
    firstField(record, fields.name),
    firstField(record, fields.licenseNumber)
  ];
  return crypto.createHash('sha256').update(JSON.stringify(identity)).digest('base64url').slice(0, 24);
}

function signGlobalSearchReference(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', GLOBAL_SEARCH_REFERENCE_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

function readGlobalSearchReference(reference) {
  const [encoded, signature, extra] = String(reference || '').split('.');
  if (!encoded || !signature || extra) return null;
  const expected = crypto
    .createHmac('sha256', GLOBAL_SEARCH_REFERENCE_SECRET)
    .update(encoded)
    .digest();
  let actual = null;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch (_) {
    return null;
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return payload && typeof payload === 'object' ? payload : null;
  } catch (_) {
    return null;
  }
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < String(line || '').length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvText(text) {
  const clean = String(text || '').replace(/^\ufeff/, '').trim();
  if (!clean) return [];
  const lines = clean.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(safeText);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce((record, header, index) => {
      if (header) record[header] = safeText(cells[index]);
      return record;
    }, {});
  });
}

function readCsvFile(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return [];
    return parseCsvText(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.warn('Global search CSV read failed:', filePath, error && error.message);
    return [];
  }
}

function readJsonArray(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Global search JSON read failed:', filePath, error && error.message);
    return [];
  }
}

function firstField(record, keys) {
  const source = record && typeof record === 'object' ? record : {};
  for (const key of keys || []) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = safeText(source[key]);
      if (value) return value;
    }
  }
  return '';
}

function formatSectorValue(value) {
  const text = safeText(value);
  if (!text) return '';
  return resolveSectorLabel(text) || text;
}

function formatStationValue(value, sectorValue = '') {
  const text = safeText(value);
  if (!text) return '';
  return resolveStationName(text, sectorValue) || text;
}

function recordMatchesQuery(record, fields, normalizedQuery, options = {}) {
  if (!normalizedQuery) return false;
  const searchableValues = [
    ...collectSearchableScalarValues(record),
    safeText(record && record.__globalSearchExtraText)
  ].filter(Boolean);
  if (options.requireContiguousPhrase) {
    const contiguousQuery = normalizeContiguousSearchText(normalizedQuery);
    return Boolean(contiguousQuery) && searchableValues.some((value) => (
      normalizeContiguousSearchText(value).includes(contiguousQuery)
    ));
  }
  const haystack = normalizeSearchText(searchableValues.join(' '));
  if (!haystack) return false;
  if (haystack.includes(normalizedQuery)) return true;
  return normalizedQuery.split(/\s+/).filter(Boolean).every((part) => haystack.includes(part));
}

function createInspectUrl(basePath, record, fields, extraParams = {}) {
  const params = new URLSearchParams();
  const name = firstField(record, fields.name);
  const license = firstField(record, fields.licenseNumber);
  const sector = firstField(record, fields.sector);
  const station = firstField(record, fields.station);
  const id = firstField(record, fields.id);

  if (name) params.set('name', name);
  if (license) params.set('license', license);
  if (sector) params.set('sector', sector);
  if (station) params.set('station', station);
  if (id) params.set('id', id);
  Object.entries(extraParams || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      params.set(key, String(value).trim());
    }
  });

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function isAllowedRecord(record, fields, access = {}) {
  if (!access || access.unrestrictedSectors) return true;
  const allowedSectors = access.allowedSectors instanceof Set ? access.allowedSectors : null;
  const stationAccess = access.stationAccess && typeof access.stationAccess === 'object' ? access.stationAccess : {};
  if (!allowedSectors) return true;
  if (allowedSectors.size === 0) return false;

  const rawSector = firstField(record, fields.sector);
  const sector = formatSectorValue(rawSector);
  const rawStation = firstField(record, fields.station);
  const station = formatStationValue(rawStation, sector || rawSector);
  if (!sector || !allowedSectors.has(sector)) return false;

  const stations = stationAccess[sector] || stationAccess[rawSector];
  if (!Array.isArray(stations) || stations.length === 0) return true;
  return !station || stations.includes(station) || stations.includes(rawStation);
}

function collectMatchingRecords(query, recordSets, options = {}) {
  const normalizedQuery = normalizeSearchText(query);
  const allowedApps = options.allowedApps instanceof Set ? options.allowedApps : null;
  const access = options.access || {};
  const limit = Number.isFinite(Number(options.limit)) ? Math.max(1, Number(options.limit)) : 150;
  const results = [];

  for (const set of Array.isArray(recordSets) ? recordSets : []) {
    if (!set || !set.key || (allowedApps && !allowedApps.has(set.key))) continue;
    const fields = set.fields || {};
    const records = Array.isArray(set.records) ? set.records : [];
    for (let recordIndex = 0; recordIndex < records.length; recordIndex += 1) {
      const record = records[recordIndex];
      if (!recordMatchesQuery(record, fields, normalizedQuery, {
        requireContiguousPhrase: set.key === 'report'
      })) continue;
      if (!set.skipSectorAccess && !isAllowedRecord(record, fields, access)) continue;
      const rawSector = firstField(record, fields.sector);
      const rawStation = firstField(record, fields.station);
      const sector = formatSectorValue(rawSector);
      const station = formatStationValue(rawStation, sector || rawSector);

      const attachments = getRecordAttachments(record);
      const attachmentCount = attachments.length;
      const attachmentRef = attachmentCount
        ? signGlobalSearchReference({
            programKey: set.key,
            datasetKey: set.datasetKey || (set.extraParams && set.extraParams.dataset) || '',
            recordIndex,
            fingerprint: stableRecordFingerprint(set, record, recordIndex)
          })
        : '';

      results.push({
        programKey: set.key,
        programName: set.label || PROGRAM_LABELS[set.key] || set.key,
        dataset: set.datasetLabel || '',
        datasetKey: set.datasetKey || (set.extraParams && set.extraParams.dataset) || '',
        recordNumber: firstField(record, fields.id),
        name: firstField(record, fields.name),
        licenseNumber: firstField(record, fields.licenseNumber),
        sector,
        station,
        attachmentCount,
        attachmentRef,
        display: buildGlobalSearchDisplayRecord(set, record, recordIndex),
        inspectUrl: createInspectUrl(set.inspectPath, record, fields, set.extraParams)
      });
      if (results.length >= limit) return results;
    }
  }

  return results;
}

function buildJsonRecordSet({ key, label, inspectPath, filePath, fields }) {
  return {
    key,
    label: label || PROGRAM_LABELS[key],
    inspectPath,
    fields,
    records: readJsonArray(filePath)
  };
}

function buildCsvRecordSet({ key, label, inspectPath, filePath, fields, datasetLabel, extraParams }) {
  return {
    key,
    label: label || PROGRAM_LABELS[key],
    inspectPath,
    fields,
    datasetLabel,
    datasetKey: extraParams && extraParams.dataset ? String(extraParams.dataset) : '',
    extraParams,
    records: readCsvFile(filePath)
  };
}

function getWeaponRecordIdFromState(entry) {
  const match = String(entry && entry.recordKey || '').match(/(?:^|\|)id=(\d+)(?:\||$)/);
  return match ? match[1] : '';
}

function buildWeaponsRecordSetFromProjection(projection = {}, stateEntries = []) {
  const headers = Array.isArray(projection.headers) ? projection.headers.map(safeText) : [];
  const rows = Array.isArray(projection.rows) ? projection.rows : [];
  const metadata = Array.isArray(projection.meta) ? projection.meta : [];
  const stateById = new Map();
  const stateByRowIndex = new Map();
  (Array.isArray(stateEntries) ? stateEntries : []).forEach((entry) => {
    const recordId = getWeaponRecordIdFromState(entry);
    if (recordId) stateById.set(recordId, entry);
    const legacyMatch = String(entry && (entry.legacyRecordKey || entry.recordKey) || '').match(/(?:^|\|)idx=(\d+)(?:\||$)/);
    if (legacyMatch) stateByRowIndex.set(Number(legacyMatch[1]), entry);
  });

  const records = rows.map((row, index) => {
    const values = Array.isArray(row) ? row : [];
    const record = headers.reduce((output, header, columnIndex) => {
      if (header) output[header] = safeText(values[columnIndex]);
      return output;
    }, {});
    const meta = metadata[index] || {};
    const recordId = safeText(meta.id || index + 1);
    const rowIndex = Number.isInteger(Number(meta.rowIndex)) ? Number(meta.rowIndex) : index;
    record.id = recordId;
    const state = stateById.get(recordId) || stateByRowIndex.get(rowIndex) || {};
    setInternalRecordValue(record, '__globalSearchWeaponEntries', Array.isArray(state.weapons) ? state.weapons : []);
    return record;
  });

  return {
    key: 'weapons',
    label: PROGRAM_LABELS.weapons,
    inspectPath: '/weapons/sheet.html',
    displayColumns: headers.map((header, index) => ({
      key: `column-${index}`,
      label: header,
      aliases: [header],
      kind: header === 'ملاحظات' ? 'notes' : ''
    })),
    fields: {
      id: ['id', 'م'],
      name: ['الاسم'],
      licenseNumber: ['رقم', 'رقم القيد', 'رقم الرخصة'],
      sector: ['القطاع'],
      station: ['القسم', 'القسم التابع', 'جهة الترخيص الحالية']
    },
    records
  };
}

function readWeaponsRecordSet(weaponsBase) {
  const legacyCsvPath = path.join(weaponsBase, 'Data', 'slah.csv');
  const csvPath = dataFile('Weapons', 'slah.csv', [legacyCsvPath]);
  const weaponsDataDir = appDataDir('Weapons', { legacyDirs: [path.join(weaponsBase, 'Data')] });
  const dbPath = path.join(weaponsDataDir, 'weapons.sqlite');
  try {
    if (!globalSearchWeaponsStore) {
      globalSearchWeaponsStore = createWeaponsSqlStore({ dbPath, csvPath });
    }
    return buildWeaponsRecordSetFromProjection(
      globalSearchWeaponsStore.getRecords(),
      globalSearchWeaponsStore.getWeaponStateEntries()
    );
  } catch (error) {
    console.warn('Global search Weapons SQL read failed:', error && error.message);
    return buildCsvRecordSet({
      key: 'weapons',
      inspectPath: '/weapons/sheet.html',
      filePath: csvPath,
      fields: {
        id: ['id', 'م'],
        name: ['الاسم'],
        licenseNumber: ['رقم', 'رقم القيد', 'رقم الرخصة'],
        sector: ['القطاع'],
        station: ['القسم', 'القسم التابع', 'جهة الترخيص الحالية']
      }
    });
  }
}

function readSqlRows(db, sql, parameters = []) {
  let statement = null;
  try {
    statement = db.prepare(sql);
    if (parameters.length) statement.bind(parameters);
    const rows = [];
    while (statement.step()) rows.push(statement.getAsObject());
    return rows;
  } catch (_) {
    return [];
  } finally {
    try { if (statement) statement.free(); } catch (_) {}
  }
}

async function readCompanyRecords() {
  const dataDir = appDataDir('Company', {
    legacyDirs: [path.join(PROGRAM_ROOT, 'Company', 'Data')]
  });
  const dbPath = path.join(dataDir, 'Database.db');
  if (!fs.existsSync(dbPath)) return [];

  let db = null;
  try {
    const SQL = await initSqlJs();
    db = new SQL.Database(fs.readFileSync(dbPath));
    const records = readSqlRows(db, 'SELECT * FROM companies ORDER BY id ASC');
    const attachmentsByCompany = new Map();
    const seenByCompany = new Map();
    const addAttachment = (companyId, directoryPath, fileName, displayName = '', mimeType = '') => {
      const normalizedCompanyId = String(companyId || '').trim();
      if (!normalizedCompanyId) return;
      const attachment = safeAttachmentInDirectory(directoryPath, fileName, displayName);
      if (!attachment) return;
      if (mimeType) attachment.mimeType = getAttachmentMimeType(attachment.name, mimeType);
      if (!attachmentsByCompany.has(normalizedCompanyId)) attachmentsByCompany.set(normalizedCompanyId, []);
      if (!seenByCompany.has(normalizedCompanyId)) seenByCompany.set(normalizedCompanyId, new Set());
      const seen = seenByCompany.get(normalizedCompanyId);
      const fingerprint = attachment.absolutePath.toLowerCase();
      if (seen.has(fingerprint)) return;
      seen.add(fingerprint);
      attachmentsByCompany.get(normalizedCompanyId).push(attachment);
    };

    const basicDirectories = {
      company_image: path.join(dataDir, 'CompaniesUploads'),
      licensed_uniform: path.join(dataDir, 'ScannedUpload'),
      license_image: path.join(dataDir, 'ScannedLisence'),
      company_logo: path.join(dataDir, 'CompaniesLogo'),
      gps_image: path.join(dataDir, 'CompaniesGPS')
    };
    readSqlRows(db, `
      SELECT company_id, attachment_type, file_path, original_name
      FROM company_basic_attachments
      ORDER BY company_id ASC, attachment_type ASC, sort_order ASC, id ASC
    `).forEach((row) => {
      const directoryPath = basicDirectories[String(row.attachment_type || '')];
      if (directoryPath) {
        addAttachment(row.company_id, directoryPath, row.file_path, row.original_name || row.file_path);
      }
    });

    readSqlRows(db, `
      SELECT company_id, car_image
      FROM company_cars
      WHERE COALESCE(car_image, '') <> ''
      ORDER BY company_id ASC, id ASC
    `).forEach((row) => {
      addAttachment(row.company_id, path.join(dataDir, 'CompaniesCars'), row.car_image, row.car_image);
    });

    readSqlRows(db, `
      SELECT inspections.company_id, inspection_files.file_path, inspection_files.original_name
      FROM inspection_files
      JOIN inspections ON inspections.id = inspection_files.inspection_id
      ORDER BY inspections.company_id ASC, inspection_files.id ASC
    `).forEach((row) => {
      addAttachment(
        row.company_id,
        path.join(dataDir, 'CompaniesInspection'),
        row.file_path,
        row.original_name || row.file_path
      );
    });

    records.forEach((record) => {
      const companyId = String(record.id || '').trim();
      Object.entries(basicDirectories).forEach(([column, directoryPath]) => {
        const fileName = safeText(record[column]);
        if (fileName) addAttachment(companyId, directoryPath, fileName, fileName);
      });
      setRecordAttachments(record, attachmentsByCompany.get(companyId) || []);
    });
    return records;
  } catch (error) {
    console.warn('Global search company read failed:', error && error.message);
    return [];
  } finally {
    try { if (db) db.close(); } catch (_) {}
  }
}

async function readStorageRecords(user) {
  if (!user || !user.username) return [];
  const dataDir = appDataDir('Storage', {
    legacyDirs: [path.join(PROGRAM_ROOT, 'Storage', 'Data')]
  });
  const dbPath = path.join(dataDir, 'Storage.db');
  if (!fs.existsSync(dbPath)) return [];

  const service = createStorageService({ dataDir });
  try {
    await service.initialize();
    const result = await service.listFiles({ user, scope: 'visible', status: 'active' });
    const records = Array.isArray(result.files) ? result.files : [];
    records.forEach((record) => {
      const attachment = record && record.absolutePath && fs.existsSync(record.absolutePath)
        ? createInternalAttachment(record.originalName || record.title, record.absolutePath, record.mimeType)
        : null;
      setRecordAttachments(record, attachment ? [attachment] : []);
      delete record.absolutePath;
    });
    return records;
  } catch (error) {
    console.warn('Global search storage read failed:', error && error.message);
    return [];
  } finally {
    try { service.close(); } catch (_) {}
  }
}

async function buildPlatformRecordSets(options = {}) {
  const weaponsBase = path.join(PROGRAM_ROOT, 'Weapons');
  const renewalBase = path.join(PROGRAM_ROOT, 'Renewal');
  const reportBase = path.join(PROGRAM_ROOT, 'Report');
  const requestBase = path.join(PROGRAM_ROOT, 'Request');
  const acceptBase = path.join(PROGRAM_ROOT, 'Accept');
  const seizedBase = path.join(PROGRAM_ROOT, 'Seized');

  const sets = [
    readWeaponsRecordSet(weaponsBase),
    buildCsvRecordSet({
      key: 'renewal',
      inspectPath: '/renewal/sheet.html',
      filePath: dataFile('Renewal', 'tagdeed.csv', [path.join(renewalBase, 'data', 'tagdeed.csv')]),
      fields: {
        id: ['id', 'م'],
        name: ['الاســـــــم', 'الاسم'],
        licenseNumber: ['رقم الرخصة', 'التجديد'],
        sector: ['قطاع', 'القطاع'],
        station: ['القسم'],
        extraSearch: ['ملاحظـــات', 'ملاحظات']
      }
    }),
    buildJsonRecordSet({
      key: 'request',
      inspectPath: '/request/index.html',
      filePath: dataFile('Request', 'requests.json', [path.join(requestBase, 'data', 'requests.json')]),
      fields: {
        id: ['id'],
        name: ['name', 'requesterName'],
        licenseNumber: ['licenseNumber', 'purchasePermit'],
        sector: ['sector'],
        station: ['station'],
        extraSearch: ['nationalId', 'job', 'weaponData']
      }
    }),
    buildJsonRecordSet({
      key: 'accept',
      inspectPath: '/accept/index.html',
      filePath: dataFile('Accept', 'Acceptances.json', [path.join(acceptBase, 'data', 'Acceptances.json')]),
      fields: {
        id: ['id'],
        name: ['name', 'الاسم'],
        licenseNumber: ['licenseNumber', 'رقم الرخصة'],
        sector: ['sector', 'القطاع'],
        station: ['station', 'القسم'],
        extraSearch: ['workplace', 'جهة العمل', 'rank', 'الرتبة']
      }
    }),
    buildCsvRecordSet({
      key: 'seized',
      inspectPath: '/seized/index.html',
      filePath: dataFile('Seized', 'SeizedWeapons.csv', [path.join(seizedBase, 'Data', 'SeizedWeapons.csv')]),
      fields: {
        id: ['record_number', 'رقم الحرز'],
        name: ['name', 'الاسم'],
        licenseNumber: ['license_number', 'رقم الرخصة'],
        sector: ['sector', 'القطاع'],
        station: ['station', 'القسم', 'القسم التابع'],
        extraSearch: ['serial_number', 'الرقم', 'weapon_type', 'النوع']
      }
    })
  ];

  const renewalPhotoDir = dataSubdir('Renewal', 'photo', {
    legacyDirs: [path.join(renewalBase, 'data', 'photo')]
  });
  const renewalSet = sets.find((set) => set && set.key === 'renewal');
  if (renewalSet) {
    renewalSet.records.forEach((record) => {
      const files = normalizeStoredAttachmentList(firstField(record, ['صورة']));
      setRecordAttachments(record, files
        .map((fileName) => safeAttachmentInDirectory(renewalPhotoDir, fileName))
        .filter(Boolean));
    });
  }

  const reportDataDir = appDataDir('Report', { legacyDirs: [path.join(reportBase, 'data')] });
  REPORT_DATASETS.forEach((dataset) => {
    const reportSet = buildCsvRecordSet({
      key: 'report',
      label: PROGRAM_LABELS.report,
      inspectPath: '/report/index.html',
      filePath: path.join(reportDataDir, dataset.file),
      datasetLabel: dataset.label,
      extraParams: { dataset: dataset.key },
      fields: {
        id: ['رقم القرار'],
        name: ['الاسم'],
        licenseNumber: ['رقم الرخصة', 'رقم الترخيص'],
        sector: ['القطاع'],
        station: ['قسم الشرطة', 'القسم'],
        extraSearch: ['الوظيفة', 'نوع السلاح', 'الغرض']
      }
    });
    const decisionCounters = Object.create(null);
    reportSet.records.forEach((record, recordIndex) => {
      const identity = getReportDecisionIdentity(record, recordIndex, decisionCounters);
      let textIndex = '';
      try {
        textIndex = readDecisionText({
          decisionNumber: identity.decisionNumber,
          name: identity.name
        });
      } catch (_) {
        textIndex = '';
      }
      setInternalRecordValue(record, '__globalSearchReportIdentity', identity);
      setInternalRecordValue(record, '__globalSearchExtraText', textIndex);
      setRecordAttachments(
        record,
        listReportRecordAttachments(path.join(reportDataDir, dataset.photoDir), identity.attachmentId)
      );
    });
    sets.push(reportSet);
  });

  sets.push({
    key: 'storage',
    label: PROGRAM_LABELS.storage,
    inspectPath: '/storage/index.html',
    skipSectorAccess: true,
    records: await readStorageRecords(options.user),
    fields: {
      id: ['id'],
      name: ['title', 'originalName'],
      licenseNumber: ['id'],
      sector: [],
      station: [],
      extraSearch: ['originalName', 'description', 'uploadedByDisplay', 'uploadedBy', 'tags']
    }
  });

  sets.push({
    key: 'company',
    label: PROGRAM_LABELS.company,
    inspectPath: '/company/index.html',
    records: await readCompanyRecords(),
    fields: {
      id: ['id'],
      name: ['company_name'],
      licenseNumber: ['license_number'],
      sector: ['sector'],
      station: ['station'],
      extraSearch: ['notes']
    }
  });

  return sets;
}

function createGlobalSearchError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function resolveGlobalSearchRecordReference(reference, options = {}) {
  const payload = readGlobalSearchReference(reference);
  if (!payload) throw createGlobalSearchError('مرجع المرفقات غير صالح أو انتهت صلاحيته.', 400);

  const programKey = safeText(payload.programKey).toLowerCase();
  const datasetKey = safeText(payload.datasetKey).toLowerCase();
  const recordIndex = Number(payload.recordIndex);
  const allowedApps = options.allowedApps instanceof Set ? options.allowedApps : null;
  if (!programKey || !Number.isInteger(recordIndex) || recordIndex < 0) {
    throw createGlobalSearchError('مرجع المرفقات غير صالح.', 400);
  }
  if (allowedApps && !allowedApps.has(programKey)) {
    throw createGlobalSearchError('صلاحية هذا البرنامج مغلقة.', 403);
  }

  const sets = await buildPlatformRecordSets(options);
  const recordSet = sets.find((set) => {
    if (!set || String(set.key || '').toLowerCase() !== programKey) return false;
    const setDataset = safeText(set.datasetKey || (set.extraParams && set.extraParams.dataset)).toLowerCase();
    return setDataset === datasetKey;
  });
  if (!recordSet || !Array.isArray(recordSet.records) || !recordSet.records[recordIndex]) {
    throw createGlobalSearchError('السجل المطلوب غير موجود.', 404);
  }

  const record = recordSet.records[recordIndex];
  if (stableRecordFingerprint(recordSet, record, recordIndex) !== safeText(payload.fingerprint)) {
    throw createGlobalSearchError('تم تحديث السجل. أعد تنفيذ البحث.', 409);
  }
  if (!recordSet.skipSectorAccess && !isAllowedRecord(record, recordSet.fields || {}, options.access || {})) {
    throw createGlobalSearchError('صلاحيات غير كافية لعرض هذا السجل.', 403);
  }

  return { recordSet, record, recordIndex };
}

async function listGlobalSearchAttachments(reference, options = {}) {
  const { record } = await resolveGlobalSearchRecordReference(reference, options);
  return getRecordAttachments(record).map((attachment, index) => {
    if (
      !attachment
      || !attachment.absolutePath
      || !fs.existsSync(attachment.absolutePath)
      || !fs.statSync(attachment.absolutePath).isFile()
    ) {
      return null;
    }
    return {
      id: String(index),
      name: safeText(attachment.name || path.basename(attachment.absolutePath)),
      mimeType: getAttachmentMimeType(attachment.name, attachment.mimeType),
      previewKind: getAttachmentPreviewKind(attachment.name, attachment.mimeType)
    };
  }).filter(Boolean);
}

async function resolveGlobalSearchAttachment(reference, attachmentId, options = {}) {
  const { record } = await resolveGlobalSearchRecordReference(reference, options);
  const index = Number(attachmentId);
  const attachments = getRecordAttachments(record);
  if (!Number.isInteger(index) || index < 0 || !attachments[index]) {
    throw createGlobalSearchError('المرفق المطلوب غير موجود.', 404);
  }
  const attachment = attachments[index];
  if (
    !attachment.absolutePath
    || !fs.existsSync(attachment.absolutePath)
    || !fs.statSync(attachment.absolutePath).isFile()
  ) {
    throw createGlobalSearchError('المرفق المطلوب غير موجود.', 404);
  }
  return {
    id: String(index),
    name: safeText(attachment.name || path.basename(attachment.absolutePath)),
    absolutePath: path.resolve(attachment.absolutePath),
    mimeType: getAttachmentMimeType(attachment.name, attachment.mimeType),
    previewKind: getAttachmentPreviewKind(attachment.name, attachment.mimeType)
  };
}

async function searchPlatformRecords(query, options = {}) {
  const sets = await buildPlatformRecordSets(options);
  const results = collectMatchingRecords(query, sets, options);
  return {
    success: true,
    query: safeText(query),
    count: results.length,
    results
  };
}

module.exports = {
  buildGlobalSearchDisplayRecord,
  buildPlatformRecordSets,
  buildWeaponsRecordSetFromProjection,
  collectSearchableScalarValues,
  collectMatchingRecords,
  getReportDecisionIdentity,
  listGlobalSearchAttachments,
  normalizeSearchText,
  parseCsvLine,
  parseCsvText,
  resolveGlobalSearchAttachment,
  searchPlatformRecords
};
