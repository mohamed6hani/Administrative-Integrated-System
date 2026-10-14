const fs = require('fs');
const path = require('path');
const {
  clearFileCache,
  getFileVersionPayload: getCachedFileVersionPayload,
  readParsedCached
} = require('../../General/backend/file-data-cache');
const {
  appDataDir,
  dataSubdir
} = require('../../General/backend/platform-paths');
const {
  getSectorKeyToLabelMap,
  getSectorLabelToKeyMap,
  resolveSectorKey,
  resolveSectorLabel,
  detectSectorKeyFromStation
} = require('../../General/backend/reference-data-store');
const {
  getDecisionTextFileName,
  readDecisionText,
  writeDecisionText
} = require('./text-index-store');
const {
  getReportSettings,
  saveReportSettings,
  isOcrEnabled
} = require('./report-settings-store');
const deleteApproval = require('../../General/backend/delete-approval-store');
const { logRecordActivity } = require('../../General/backend/activity-record-audit');

module.exports = function(_express) {
  const express = _express || require('express');
  const router = express.Router();

  const ROOT = path.join(__dirname, '..');
  const LEGACY_DATA_DIR = path.join(ROOT, 'data');
  const DATA_DIR = appDataDir('Report', { legacyDirs: [LEGACY_DATA_DIR] });
  const TMP_DIR = dataSubdir('Report', 'tmp', {
    legacyDirs: [path.join(ROOT, 'tmp')]
  });

  const DATASET_CONFIG = {
    civilians: { key: 'civilians', csvFile: 'decisions.csv', photoDirName: 'photoC', downloadName: 'decisions.csv', splitDecision: true },
    police: { key: 'police', csvFile: 'decision2.csv', photoDirName: 'photoP', downloadName: 'decision2.csv', splitDecision: true },
    military: { key: 'military', csvFile: 'decision3.csv', photoDirName: 'photoA', downloadName: 'decision3.csv', splitDecision: true },
  };
  const DEFAULT_DATASET_KEY = 'civilians';
  const SPLIT_DECISION_DATASETS = new Set(Object.values(DATASET_CONFIG).filter((d) => d.splitDecision).map((d) => d.key));
  const HEADERS_SINGLE_DECISION = [
    'رقم القرار','تاريخ القرار','الاسم','الوظيفة','نوع الترخيص','نوع السلاح','الغرض','القطاع','قسم الشرطة','القرار','توصية'
  ];
  const HEADERS_SPLIT_DECISION = [
    'رقم القرار','تاريخ القرار','الاسم','الوظيفة','نوع الترخيص','نوع السلاح','الغرض','القطاع','قسم الشرطة','قرار مدير الامن','قرار امن العام','توصية'
  ];

  const SECTOR_CODE_TO_LABEL = {
    east: 'شرق',
    west: 'غرب',
    south: 'جنوب',
    north: 'شمال',
    sectorfive: 'القطاع التجريبي الخامس',
    police_unit: 'وحده الشرطة',
    army_unit: 'وحده قوات مسلحة',
  };
  const SECTOR_LABEL_TO_CODE = Object.fromEntries(Object.entries(SECTOR_CODE_TO_LABEL).map(([code, label]) => [label, code]));
  const STATION_SECTORS = {
    east: ['مكتب تجريبي 01','مكتب تجريبي 02','مكتب تجريبي 03','مكتب تجريبي 04','مكتب تجريبي 05','مكتب تجريبي 06','مكتب تجريبي 07','مكتب تجريبي 08','مكتب تجريبي 09','مكتب تجريبي 10'],
    west: ['مكتب تجريبي 11','مكتب تجريبي 12','مكتب تجريبي 13','مكتب تجريبي 14','مكتب تجريبي 15','مكتب تجريبي 16','مكتب تجريبي 17','مكتب تجريبي 18','مكتب تجريبي 19'],
    south: ['مكتب تجريبي 20','مكتب تجريبي 21','مكتب تجريبي 22','مكتب تجريبي 23','مكتب تجريبي 24','مكتب تجريبي 25','مكتب تجريبي 26','مكتب تجريبي 27','مكتب تجريبي 28','مكتب تجريبي 29','مكتب تجريبي 30'],
    north: ['مكتب تجريبي 31','مكتب تجريبي 32','مكتب تجريبي 33','مكتب تجريبي 34','مكتب تجريبي 35','مكتب تجريبي 36','مكتب تجريبي 37','مكتب تجريبي 38','مكتب تجريبي 39','مكتب تجريبي 40'],
    sectorfive: ['مكتب تجريبي 41','مكتب تجريبي 42','مكتب تجريبي 43','مكتب تجريبي 44','مكتب تجريبي 45'],
    police_unit: [],
    army_unit: [],
  };

  function resolveDatasetKey(rawKey) {
    const key = String(rawKey || '').trim().toLowerCase();
    if (key && DATASET_CONFIG[key]) return key;
    return DEFAULT_DATASET_KEY;
  }

  function getSharedSectorKeyToLabelMap() {
    try {
      return getSectorKeyToLabelMap();
    } catch {
      return {};
    }
  }

  function getSharedSectorLabelToKeyMap() {
    try {
      return getSectorLabelToKeyMap();
    } catch {
      return {};
    }
  }

  function resolveReportSectorKey(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw === 'police_unit' || raw === 'army_unit') return raw;
    if (SECTOR_CODE_TO_LABEL[raw]) return raw;
    if (SECTOR_LABEL_TO_CODE[raw]) return SECTOR_LABEL_TO_CODE[raw];

    const sharedKeyToLabel = getSharedSectorKeyToLabelMap();
    const sharedLabelToKey = getSharedSectorLabelToKeyMap();
    if (sharedKeyToLabel[raw]) {
      return SECTOR_LABEL_TO_CODE[sharedKeyToLabel[raw]] || raw;
    }
    if (sharedLabelToKey[raw]) {
      return SECTOR_LABEL_TO_CODE[raw] || sharedLabelToKey[raw];
    }

    try {
      const label = resolveSectorLabel(raw);
      if (label) return SECTOR_LABEL_TO_CODE[label] || sharedLabelToKey[label] || raw;
    } catch {}

    try {
      const sharedKey = resolveSectorKey(raw);
      if (sharedKey) {
        const label = sharedKeyToLabel[sharedKey];
        return label ? (SECTOR_LABEL_TO_CODE[label] || sharedKey) : sharedKey;
      }
    } catch {}

    return raw;
  }

  function resolveReportSectorLabel(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (SECTOR_CODE_TO_LABEL[raw]) return SECTOR_CODE_TO_LABEL[raw];
    if (SECTOR_LABEL_TO_CODE[raw]) return raw;

    const sharedKeyToLabel = getSharedSectorKeyToLabelMap();
    if (sharedKeyToLabel[raw]) return sharedKeyToLabel[raw];

    try {
      const label = resolveSectorLabel(raw);
      if (label) return label;
    } catch {}

    return raw;
  }

  function getDatasetContext(rawKey) {
    const key = resolveDatasetKey(rawKey);
    const base = DATASET_CONFIG[key] || DATASET_CONFIG[DEFAULT_DATASET_KEY];
    const csvPath = path.join(DATA_DIR, base.csvFile);
    const photoDirPath = path.join(DATA_DIR, base.photoDirName);
    return {
      key,
      csvPath,
      photoDirPath,
      photoDirName: base.photoDirName,
      downloadName: base.downloadName || base.csvFile,
      photoUrlBase: `/report/${base.photoDirName}`,
      splitDecision: !!base.splitDecision,
    };
  }

  function datasetHasSplitDecision(ctxOrKey) {
    if (!ctxOrKey) return false;
    if (typeof ctxOrKey === 'string') return SPLIT_DECISION_DATASETS.has(ctxOrKey);
    if (ctxOrKey && typeof ctxOrKey === 'object' && ctxOrKey.key) {
      return SPLIT_DECISION_DATASETS.has(ctxOrKey.key) || !!ctxOrKey.splitDecision;
    }
    return false;
  }

  function getHeadersForDataset(key) {
    return datasetHasSplitDecision(key) ? HEADERS_SPLIT_DECISION : HEADERS_SINGLE_DECISION;
  }

  function getLegacyPhotoDirName(key) {
    if (key === 'civilians') return 'photos';
    if (key === 'police') return 'photo2';
    if (key === 'military') return 'photo3';
    return null;
  }

  function migrateLegacyPhotoDir(ctx) {
    const legacyName = getLegacyPhotoDirName(ctx.key);
    if (!legacyName) return;
    const legacyPath = path.join(DATA_DIR, legacyName);
    if (!fs.existsSync(legacyPath)) return;
    if (!fs.existsSync(ctx.photoDirPath)) {
      try {
        fs.renameSync(legacyPath, ctx.photoDirPath);
        return;
      } catch {}
    }
    try {
      const legacyFiles = fs.readdirSync(legacyPath);
      if (!legacyFiles.length) return;
      const currentFiles = fs.existsSync(ctx.photoDirPath) ? fs.readdirSync(ctx.photoDirPath) : [];
      const currentSet = new Set(currentFiles);
      legacyFiles.forEach((name) => {
        if (currentSet.has(name)) return;
        try {
          fs.renameSync(path.join(legacyPath, name), path.join(ctx.photoDirPath, name));
        } catch {}
      });
    } catch {}
  }

  function ensureDatasetResources(ctx) {
    if (!ctx) ctx = getDatasetContext(DEFAULT_DATASET_KEY);
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
    migrateLegacyPhotoDir(ctx);
    if (!fs.existsSync(ctx.photoDirPath)) fs.mkdirSync(ctx.photoDirPath, { recursive: true });
    if (!fs.existsSync(ctx.csvPath)) {
      const csvText = stringifyCSV(getHeadersForDataset(ctx.key), []);
      fs.writeFileSync(ctx.csvPath, csvText, 'utf8');
    }
    return ctx;
  }

  function getFileVersionPayload(filePath) {
    return getCachedFileVersionPayload(filePath, { kind: 'csv' });
  }

  function inferSectorFromStation(station){
    const name = String(station || '').trim();
    if (!name) return '';
    try {
      const sharedKey = detectSectorKeyFromStation(name);
      if (sharedKey) return resolveReportSectorKey(sharedKey);
    } catch {}
    for (const [code, list] of Object.entries(STATION_SECTORS)){
      if (list.includes(name)) return code;
    }
    return '';
  }

  function parseCSV(text){
    const txt = String(text || '');
    const lines = txt.replace(/\r/g,'').split('\n').filter(l=>l.trim().length);
    if (!lines.length) return [];
    const SEP_RE = /,(?=(?:[^"]*"[^\"]*")*[^\"]*$)|;|\t/;
    const unq = s => String(s||'').replace(/^\uFEFF/, '').replace(/^\s*"|"\s*$/g,'').replace(/""/g,'"');
    return lines.map(l => l.split(SEP_RE).map(unq));
  }

  function stringifyCSV(headers, rows){
    const hdr = Array.isArray(headers) ? headers : [];
    const lines = [];
    lines.push(hdr.map(h => `"${String(h).replace(/"/g,'""')}"`).join(','));
    for (const r of (rows || [])){
      const cells = (r || []).map(c => `"${String(c==null ? '' : c).replace(/"/g,'""')}"`);
      lines.push(cells.join(','));
    }
    return '\uFEFF' + lines.join('\n');
  }

  function readCsvToJson(ctx) {
    const context = ensureDatasetResources(ctx);
    return readParsedCached(context.csvPath, (text) => parseCsvTextToJson(text, context), `report-${context.key}`) || [];
  }

  function parseCsvTextToJson(text, context) {
    const matrix = parseCSV(text).filter(r => r.length > 0 && r.some(c => c !== ''));
    if (matrix.length === 0) return [];
    const header = matrix[0];
    const dataRows = matrix.slice(1);
    const out = [];

    const splitDecision = datasetHasSplitDecision(context);

    const idx = {};
    idx['رقم القرار'] = header.indexOf('رقم القرار');
    idx['تاريخ القرار'] = header.indexOf('تاريخ القرار');
    idx['الاسم'] = header.indexOf('الاسم');
    idx['الوظيفة'] = header.indexOf('الوظيفة');
    idx['نوع الترخيص'] = header.indexOf('نوع الترخيص');
    idx['نوع السلاح'] = header.indexOf('نوع السلاح');
    idx['الغرض'] = header.indexOf('الغرض');
    idx['القطاع'] = header.indexOf('القطاع');
    idx['قسم الشرطة'] = header.indexOf('قسم الشرطة');
    idx['القرار'] = header.indexOf('القرار');
    idx['قرار مدير الامن'] = header.indexOf('قرار مدير الامن');
    idx['قرار امن العام'] = header.indexOf('قرار امن العام');
    idx['توصية'] = header.indexOf('توصية');

    for (const r of dataRows) {
      if (r.every(c => c === '')) continue;
      const police = idx['قسم الشرطة'] !== -1 ? (r[idx['قسم الشرطة']] || '') : '';
      const rawSector = idx['القطاع'] !== -1 ? (r[idx['القطاع']] || '') : '';
      const sector = rawSector ? resolveReportSectorKey(rawSector) : inferSectorFromStation(police);
      const decisionSingle = idx['القرار'] !== -1 ? (r[idx['القرار']] || '') : '';
      const decisionManager = idx['قرار مدير الامن'] !== -1 ? (r[idx['قرار مدير الامن']] || '') : '';
      const decisionPublic = idx['قرار امن العام'] !== -1 ? (r[idx['قرار امن العام']] || '') : '';
      const recommendation = idx['توصية'] !== -1 ? (r[idx['توصية']] || '') : '';
      out.push({
        id: idx['رقم القرار'] !== -1 ? (r[idx['رقم القرار']] || '') : '',
        date: idx['تاريخ القرار'] !== -1 ? (r[idx['تاريخ القرار']] || '') : '',
        name: idx['الاسم'] !== -1 ? (r[idx['الاسم']] || '') : '',
        job: idx['الوظيفة'] !== -1 ? (r[idx['الوظيفة']] || '') : '',
        license: idx['نوع الترخيص'] !== -1 ? (r[idx['نوع الترخيص']] || '') : '',
        weapon: idx['نوع السلاح'] !== -1 ? (r[idx['نوع السلاح']] || '') : '',
        purpose: idx['الغرض'] !== -1 ? (r[idx['الغرض']] || '') : '',
        sector,
        police,
        decision: splitDecision ? (decisionManager || decisionPublic || decisionSingle) : decisionSingle,
        decisionManager: splitDecision ? (decisionManager || decisionSingle) : decisionManager,
        decisionPublic: splitDecision ? decisionPublic : '',
        recommendation,
      });
    }
    return out;
  }

  function writeJsonToCsv(rows, ctx, options = {}) {
    const context = ensureDatasetResources(ctx);
    const normalized = Array.isArray(rows) ? rows : [];
    const splitDecision = datasetHasSplitDecision(context);
    const useCustomDecisionNumber = !!options.useCustomDecisionNumber;

    const extractYear = (value) => {
      const raw = String(value || '').trim();
      if (!raw) return null;
      const english = raw
        .replace(/[٠-٩]/g, (d) => ({ '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' }[d] || d));

      const m1 = english.match(/^(\d{4})\s*[\/\-]/);
      if (m1) return m1[1];

      const m2 = english.match(/[\/\-]\s*(\d{4})$/);
      if (m2) return m2[1];

      const m3 = english.match(/^(\d{8})$/);
      if (m3) {
        const eight = m3[1];
        const head = eight.slice(0, 4);
        if (/^(19|20)\d{2}$/.test(head)) return head;
        const yearTail = eight.slice(4, 8);
        if (/^(19|20)\d{2}$/.test(yearTail)) return yearTail;
        return yearTail;
      }

      const m4 = english.match(/(19|20)\d{2}/);
      return m4 ? m4[0] : null;
    };

    const counters = Object.create(null);
    const csvRows = normalized.map((row) => {
      const police = row.police ?? '';
      const sectorCode = resolveReportSectorKey(row.sector || inferSectorFromStation(police));
      const sectorLabel = sectorCode ? resolveReportSectorLabel(sectorCode) : '';

      const year = extractYear(row && row.date);
      const bucket = year || '__no_year__';
      counters[bucket] = (counters[bucket] || 0) + 1;
      const computedId = String(counters[bucket]);
      const customId = useCustomDecisionNumber ? String(row && row.id || '').trim() : '';
      const finalId = customId || computedId;

      const base = [
        finalId,
        row.date ?? '',
        row.name ?? '',
        row.job ?? '',
        row.license ?? '',
        row.weapon ?? '',
        row.purpose ?? '',
        sectorLabel,
        police,
      ];

      if (splitDecision) {
        base.push(row.decisionManager ?? '', row.decisionPublic ?? '', row.recommendation ?? '');
      } else {
        base.push(row.decision ?? '', row.recommendation ?? '');
      }
      return base;
    });
    const csvText = stringifyCSV(getHeadersForDataset(context.key), csvRows);
    fs.writeFileSync(context.csvPath, csvText, 'utf8');
    clearFileCache(context.csvPath);
  }

  function toEnglishDigits(value) {
    return String(value || '')
      .replace(/[٠-٩]/g, (d) => ({ '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' }[d] || d))
      .replace(/[۰-۹]/g, (d) => ({ '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' }[d] || d));
  }

  function extractYearFromReportDate(value) {
    const raw = toEnglishDigits(value).trim();
    if (!raw) return '';
    const direct = raw.match(/(19|20)\d{2}/);
    if (direct) return direct[0];
    const compact = raw.match(/\d{8}/);
    if (compact) {
      const text = compact[0];
      const head = text.slice(0, 4);
      const tail = text.slice(4);
      if (/^(19|20)\d{2}$/.test(head)) return head;
      if (/^(19|20)\d{2}$/.test(tail)) return tail;
    }
    return '';
  }

  function getReportRecordId(record, fallbackIndex = 0) {
    const raw = record?.id ?? record?.['رقم القرار'] ?? record?.decisionNumber ?? record?.recordId ?? '';
    const cleaned = toEnglishDigits(raw).replace(/[^0-9]/g, '');
    return cleaned || String(Number(fallbackIndex) + 1);
  }

  function getReportAttachmentLookupIds(record, fallbackIndex = 0) {
    const base = getReportRecordId(record, fallbackIndex);
    const year = extractYearFromReportDate(record?.date ?? record?.['تاريخ القرار'] ?? '');
    const values = [];
    if (base && year) values.push(`${base}_${String(year).slice(-2)}`);
    if (base) values.push(base);
    return Array.from(new Set(values));
  }

  function getReportAttachmentMimeType(filename) {
    const ext = path.extname(String(filename || '')).toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    return 'application/octet-stream';
  }

  function listReportDeleteApprovalAttachments(record, ctx, fallbackIndex = 0) {
    const context = ensureDatasetResources(ctx);
    if (!fs.existsSync(context.photoDirPath)) return [];
    const ids = getReportAttachmentLookupIds(record, fallbackIndex)
      .map((id) => String(id || '').replace(/[^0-9_]/g, ''))
      .filter(Boolean);
    if (!ids.length) return [];
    const names = new Set();
    fs.readdirSync(context.photoDirPath).forEach((name) => {
      const fileName = String(name || '');
      if (!/\.(jpg|jpeg|png|webp|pdf)$/i.test(fileName)) return;
      if (ids.some((id) => new RegExp(`^row-${id}([a-z])?\\.(jpg|jpeg|png|webp|pdf)$`, 'i').test(fileName))) {
        names.add(fileName);
      }
    });
    const label = String(record?.name || record?.['الاسم'] || record?.id || record?.['رقم القرار'] || 'سجل قرار').trim();
    return Array.from(names).sort().map((filename) => ({
      programKey: 'report',
      label,
      filename,
      mimeType: getReportAttachmentMimeType(filename),
      url: `${context.photoUrlBase}/${encodeURIComponent(filename)}`
    }));
  }

  function buildReportApprovalSnapshot(record) {
    const sectorValue = record?.sector ?? record?.['القطاع'] ?? '';
    return {
      'رقم القرار': String(record?.id ?? record?.['رقم القرار'] ?? '').trim(),
      'تاريخ القرار': String(record?.date ?? record?.['تاريخ القرار'] ?? '').trim(),
      'الاسم': String(record?.name ?? record?.['الاسم'] ?? '').trim(),
      'الوظيفة': String(record?.job ?? record?.['الوظيفة'] ?? '').trim(),
      'نوع الترخيص': String(record?.license ?? record?.['نوع الترخيص'] ?? '').trim(),
      'نوع السلاح': String(record?.weapon ?? record?.['نوع السلاح'] ?? '').trim(),
      'الغرض': String(record?.purpose ?? record?.['الغرض'] ?? '').trim(),
      'القطاع': resolveReportSectorLabel(sectorValue),
      'قسم الشرطة': String(record?.police ?? record?.['قسم الشرطة'] ?? '').trim(),
      'قرار مدير الامن': String(record?.decisionManager ?? record?.['قرار مدير الامن'] ?? record?.decision ?? record?.['القرار'] ?? '').trim(),
      'قرار امن العام': String(record?.decisionPublic ?? record?.['قرار امن العام'] ?? '').trim(),
      'توصية': String(record?.recommendation ?? record?.['توصية'] ?? '').trim()
    };
  }

  function firstReportValue(...values) {
    for (const value of values) {
      if (value != null && String(value).trim()) return String(value).trim();
    }
    return '';
  }

  function normalizeReportDeleteRecord(record) {
    const source = record && typeof record === 'object' ? record : {};
    const decisionValue = firstReportValue(
      source.decision,
      source['القرار'],
      source.decisionManager,
      source['قرار مدير الامن'],
      source.decisionPublic,
      source['قرار امن العام']
    );
    const decisionManagerValue = firstReportValue(
      source.decisionManager,
      source['قرار مدير الامن'],
      source.decision,
      source['القرار']
    );
    return {
      id: String(source.id ?? source['رقم القرار'] ?? '').trim(),
      date: String(source.date ?? source['تاريخ القرار'] ?? '').trim(),
      name: String(source.name ?? source['الاسم'] ?? '').trim(),
      job: String(source.job ?? source['الوظيفة'] ?? '').trim(),
      license: String(source.license ?? source['نوع الترخيص'] ?? '').trim(),
      weapon: String(source.weapon ?? source['نوع السلاح'] ?? '').trim(),
      purpose: String(source.purpose ?? source['الغرض'] ?? '').trim(),
      sector: resolveReportSectorKey(source.sector ?? source['القطاع'] ?? ''),
      police: String(source.police ?? source['قسم الشرطة'] ?? '').trim(),
      decision: decisionValue,
      decisionManager: decisionManagerValue,
      decisionPublic: String(source.decisionPublic ?? source['قرار امن العام'] ?? '').trim(),
      recommendation: String(source.recommendation ?? source['توصية'] ?? '').trim()
    };
  }

  function reportRecordFingerprint(record) {
    const normalized = normalizeReportDeleteRecord(record);
    return JSON.stringify([
      normalized.id,
      normalized.date,
      normalized.name,
      normalized.job,
      normalized.license,
      normalized.weapon,
      normalized.purpose,
      normalized.sector,
      normalized.police,
      normalized.decision,
      normalized.decisionManager,
      normalized.decisionPublic,
      normalized.recommendation
    ]);
  }

  function getReportDatasetLabel(key) {
    const normalized = resolveDatasetKey(key);
    if (normalized === 'police') return 'شرطة';
    if (normalized === 'military') return 'قوات مسلحة';
    return 'مدنيين';
  }

  function countReportRowsByFingerprint(records) {
    const counts = new Map();
    (Array.isArray(records) ? records : []).forEach((record) => {
      const key = reportRecordFingerprint(record);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }

  function buildReportApprovalRowsWithDecisionNumbers(records, options = {}) {
    const useCustomDecisionNumber = !!options.useCustomDecisionNumber;
    const counters = Object.create(null);
    return (Array.isArray(records) ? records : []).map((record) => {
      const normalized = normalizeReportDeleteRecord(record);
      const year = extractYearFromReportDate(normalized.date);
      const bucket = year || '__no_year__';
      counters[bucket] = (counters[bucket] || 0) + 1;
      const computedId = String(counters[bucket]);
      const customId = useCustomDecisionNumber ? String(normalized.id || '').trim() : '';
      return {
        ...normalized,
        id: customId || computedId
      };
    });
  }

  function getReportSaveApprovalRows(action, currentRows, nextRows, options = {}) {
    const normalizedNextRows = buildReportApprovalRowsWithDecisionNumbers(nextRows, options);
    if (!normalizedNextRows.length) return [];

    const currentCounts = countReportRowsByFingerprint(currentRows);
    const changedRows = [];
    normalizedNextRows.forEach((row) => {
      const key = reportRecordFingerprint(row);
      const remaining = currentCounts.get(key) || 0;
      if (remaining > 0) {
        currentCounts.set(key, remaining - 1);
        return;
      }
      changedRows.push(row);
    });

    if (changedRows.length) return changedRows;
    if (action === 'add') {
      const delta = Math.max(0, normalizedNextRows.length - (Array.isArray(currentRows) ? currentRows.length : 0));
      if (delta > 0) return normalizedNextRows.slice(-delta);
    }
    return normalizedNextRows.slice(-1);
  }

  function buildReportSaveApprovalSnapshot(approvalRows, ctx, totalRowCount) {
    const snapshots = (Array.isArray(approvalRows) ? approvalRows : [])
      .map((record) => buildReportApprovalSnapshot(record));
    if (snapshots.length === 1) return snapshots[0];
    if (snapshots.length > 1) return { records: snapshots };
    return {
      'مصدر البيانات': getReportDatasetLabel(ctx && ctx.key),
      'عدد السجلات': String(totalRowCount || 0)
    };
  }

  function buildReportSaveApprovalLabel(approvalRows, totalRowCount) {
    const rowsForLabel = Array.isArray(approvalRows) ? approvalRows : [];
    if (rowsForLabel.length === 1) {
      const row = rowsForLabel[0] || {};
      const recordId = getReportRecordId(row, 0);
      return row.name || (recordId ? `قرار رقم ${recordId}` : 'سجل');
    }
    if (rowsForLabel.length > 1) return `${rowsForLabel.length} سجلات`;
    return `${totalRowCount || 0} سجلات`;
  }

  function deleteReportRecords(operation = {}) {
    const ctx = getDatasetContext(operation.dataset);
    const targets = (Array.isArray(operation.records) ? operation.records : [])
      .map((record) => normalizeReportDeleteRecord(record));
    if (!targets.length) {
      const error = new Error('لم يتم تحديد سجلات للحذف.');
      error.status = 400;
      throw error;
    }

    const targetCounts = new Map();
    targets.forEach((record) => {
      const key = reportRecordFingerprint(record);
      targetCounts.set(key, (targetCounts.get(key) || 0) + 1);
    });

    const currentRows = readCsvToJson(ctx).map((record) => normalizeReportDeleteRecord(record));
    const deleted = [];
    const remaining = [];
    currentRows.forEach((record) => {
      const key = reportRecordFingerprint(record);
      const count = targetCounts.get(key) || 0;
      if (count > 0) {
        deleted.push(record);
        targetCounts.set(key, count - 1);
        return;
      }
      remaining.push(record);
    });

    if (!deleted.length) {
      const error = new Error('تعذر العثور على السجلات المحددة.');
      error.status = 404;
      throw error;
    }

    writeJsonToCsv(remaining, ctx, { useCustomDecisionNumber: true });
    return { ok: true, success: true, dataset: ctx.key, rows: remaining, deleted, deletedCount: deleted.length };
  }

  deleteApproval.registerDeleteApprovalExecutor('report.delete-records', (operation) => (
    deleteReportRecords(operation)
  ));

  function saveReportRows(operation = {}) {
    const ctx = getDatasetContext(operation.dataset);
    const rows = Array.isArray(operation.rows) ? operation.rows : [];
    writeJsonToCsv(rows, ctx, { useCustomDecisionNumber: !!operation.useCustomDecisionNumber });
    return { ok: true, success: true, action: operation.action || 'edit', dataset: ctx.key, rowCount: rows.length };
  }

  deleteApproval.registerDeleteApprovalExecutor('report.save-records', (operation) => (
    saveReportRows(operation)
  ));

  // Routes
  router.get('/data-version', (req, res) => {
    try {
      const ctx = ensureDatasetResources(getDatasetContext(req.query.dataset));
      return res.json({ ...getFileVersionPayload(ctx.csvPath), dataset: ctx.key });
    } catch (e) {
      return res.status(500).json({ ok:false, version: null, updatedAt: null, size: 0, error: e.message });
    }
  });

  router.get('/data', (req, res) => {
    try {
      const ctx = getDatasetContext(req.query.dataset);
      const rows = readCsvToJson(ctx);
      res.json({ rows, ok: true, dataset: ctx.key });
    } catch (e) {
      res.status(500).json({ ok:false, error: e.message });
    }
  });
  router.post('/data', express.json({limit:'10mb'}), (req, res) => {
    try {
      const parsed = req.body;
      if (!parsed || !Array.isArray(parsed.rows)) {
        return res.status(400).json({ ok:false, error:'Invalid payload' });
      }

      const ctx = getDatasetContext(req.query.dataset);
      const currentRows = readCsvToJson(ctx);
      const action = parsed.action === 'add' || parsed.rows.length > currentRows.length ? 'add' : 'edit';
      const normalizedNextRows = buildReportApprovalRowsWithDecisionNumbers(parsed.rows, {
        useCustomDecisionNumber: !!parsed.useCustomDecisionNumber
      });
      const activityItems = normalizedNextRows.map((record, index) => {
        const before = currentRows[index] ? normalizeReportDeleteRecord(currentRows[index]) : null;
        if (!before) return { action: 'add', record, index };
        if (reportRecordFingerprint(before) !== reportRecordFingerprint(record)) return { action: 'edit', before, record, index };
        return null;
      }).filter(Boolean);
      if (deleteApproval.isActionApprovalRequired(req, { programKey: 'report', action })) {
        const approvalRows = getReportSaveApprovalRows(action, currentRows, parsed.rows, {
          useCustomDecisionNumber: !!parsed.useCustomDecisionNumber
        });
        const recordIds = approvalRows
          .map((record, index) => getReportRecordId(record, index))
          .filter(Boolean)
          .join(',');
        const approval = deleteApproval.createDeleteApprovalRequest(req, {
          action,
          programKey: 'report',
          programName: 'برنامج القرارات',
          recordId: recordIds,
          recordLabel: buildReportSaveApprovalLabel(approvalRows, parsed.rows.length),
          recordSnapshot: activityItems.length === 1
            ? (activityItems[0].before ? { before: activityItems[0].before, after: activityItems[0].record } : activityItems[0].record)
            : { records: activityItems.map((item) => item.before ? { before: item.before, after: item.record } : item.record) },
          operation: {
            type: 'report.save-records',
            action,
            dataset: ctx.key,
            rows: parsed.rows,
            useCustomDecisionNumber: !!parsed.useCustomDecisionNumber
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
      writeJsonToCsv(parsed.rows, ctx, { useCustomDecisionNumber: !!parsed.useCustomDecisionNumber });
      const activityRows = buildReportApprovalRowsWithDecisionNumbers(parsed.rows, {
        useCustomDecisionNumber: !!parsed.useCustomDecisionNumber
      });
      activityRows.forEach((record, index) => {
        const before = currentRows[index];
        const recordId = getReportRecordId(record, index);
        if (!before) {
          logRecordActivity(req, {
            action: 'add',
            programKey: 'report',
            programName: 'برنامج القرارات',
            recordId,
            record
          });
        } else if (reportRecordFingerprint(before) !== reportRecordFingerprint(record)) {
          logRecordActivity(req, {
            action: 'edit',
            programKey: 'report',
            programName: 'برنامج القرارات',
            recordId,
            before: normalizeReportDeleteRecord(before),
            after: record
          });
        }
      });
      return res.json({ ok: true, dataset: ctx.key });
    } catch (e) {
      res.status(500).json({ ok:false, error: e.message });
    }
  });
  router.post('/delete-records', express.json({limit:'2mb'}), (req, res) => {
    try {
      const ctx = getDatasetContext(req.query.dataset || req.body?.dataset);
      const records = (Array.isArray(req.body?.records) ? req.body.records : [])
        .map((record) => normalizeReportDeleteRecord(record));
      if (!records.length) {
        return res.status(400).json({ ok:false, success:false, message:'لم يتم تحديد سجلات للحذف.' });
      }

      if (deleteApproval.isDeleteApprovalRequired(req)) {
        const items = records.map((record, index) => {
          const recordId = getReportRecordId(record, index);
          const attachments = listReportDeleteApprovalAttachments(record, ctx, index);
          return {
            recordId,
            recordLabel: record.name || `قرار رقم ${recordId}`,
            recordSnapshot: buildReportApprovalSnapshot(record),
            attachments,
            operation: {
              type: 'report.delete-records',
              action: 'delete',
              dataset: ctx.key,
              records: [record]
            }
          };
        });
        const approval = deleteApproval.createDeleteApprovalRequest(req, {
          programKey: 'report',
          programName: 'برنامج القرارات',
          action: 'delete',
          recordId: records.map((record, index) => getReportRecordId(record, index)).filter(Boolean).join(','),
          recordLabel: records.length === 1
            ? (records[0].name || `قرار رقم ${getReportRecordId(records[0], 0)}`)
            : `${records.length} سجلات`,
          recordSnapshot: records.length === 1
            ? buildReportApprovalSnapshot(records[0])
            : { records: records.map((record) => buildReportApprovalSnapshot(record)) },
          attachments: items.flatMap((item) => item.attachments || []),
          operation: {
            type: 'report.delete-records',
            action: 'delete',
            dataset: ctx.key,
            records
          },
          items
        });
        return res.status(202).json({
          ok: true,
          success: true,
          approvalRequired: true,
          message: deleteApproval.getApprovalRequiredMessage('delete'),
          request: approval.request
        });
      }

      const result = deleteReportRecords({ dataset: ctx.key, records });
      result.deleted.forEach((record, index) => {
        logRecordActivity(req, {
          action: 'delete',
          programKey: 'report',
          programName: 'برنامج القرارات',
          recordId: getReportRecordId(record, index),
          record
        });
      });
      return res.json(result);
    } catch (e) {
      const status = Number(e?.status) || 500;
      return res.status(status).json({
        ok:false,
        success:false,
        message: e.message || 'تعذر حذف السجلات المحددة.'
      });
    }
  });
  router.get('/text-index', (req, res) => {
    try {
      const ctx = getDatasetContext(req.query.dataset);
      const rows = readCsvToJson(ctx);
      const counters = Object.create(null);
      const getTextDecisionNumber = (row) => {
        const explicit = String(row && row.id || '').trim();
        if (explicit) return explicit;
        const year = (() => {
          const raw = String(row && row.date || '').trim()
            .replace(/[٠-٩]/g, (d) => ({ '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' }[d] || d));
          const match = raw.match(/(19|20)\d{2}/);
          return match ? match[0] : '__no_year__';
        })();
        counters[year] = (counters[year] || 0) + 1;
        return String(counters[year]);
      };
      const entries = rows.map((row) => {
        const decisionNumber = getTextDecisionNumber(row);
        const name = String(row && row.name || '').trim();
        const textRow = { decisionNumber, name };
        const text = readDecisionText(textRow);
        return {
          decisionNumber,
          name,
          fileName: getDecisionTextFileName(textRow),
          text,
        };
      }).filter((entry) => entry.text);
      res.json({ ok: true, entries, dataset: ctx.key });
    } catch (e) {
      res.status(500).json({ ok:false, error: e.message });
    }
  });
  router.post('/text-index', express.json({limit:'2mb'}), (req, res) => {
    try {
      const decisionNumber = String(req.body && req.body.decisionNumber || '').trim();
      const name = String(req.body && req.body.name || '').trim();
      const text = String(req.body && req.body.text || '');
      const previousFileName = String(req.body && req.body.previousFileName || '').trim();
      if (!decisionNumber) return res.status(400).json({ ok:false, error:'decisionNumber required' });
      const saved = writeDecisionText({ decisionNumber, name }, text, { previousFileName });
      res.json({ ok: true, fileName: saved.fileName, text: saved.text });
    } catch (e) {
      res.status(500).json({ ok:false, error: e.message });
    }
  });
  router.get('/download', (req, res) => {
    try {
      const ctx = ensureDatasetResources(getDatasetContext(req.query.dataset));
      res.setHeader('Content-Type','text/csv; charset=utf-8');
      res.setHeader('Content-Disposition',`attachment; filename="${ctx.downloadName}"`);
      fs.createReadStream(ctx.csvPath).pipe(res);
    } catch (e) {
      res.status(500).end('Error');
    }
  });

  // Photo API: multiple attachments per row stored flat as row-<id><suffix>.<ext>
  // Uses dataset-specific folder (photos/photo2/photo3) based on ?dataset=
  router.get('/photo/:id', (req, res) => {
    try {
      const ctx = ensureDatasetResources(getDatasetContext(req.query.dataset));
      const id = String(req.params.id||'').replace(/[^0-9_]/g,'');
      if(!id) return res.json({ files:[], count:0 });
      if (!fs.existsSync(ctx.photoDirPath)) return res.json({ files:[], count:0 });
      const baseId = id.includes('_') ? null : id;
      const re = baseId
        ? new RegExp(`^row-${baseId}(?:_\\d+)?([a-z])?\\.(jpg|jpeg|png|webp|pdf)$`, 'i')
        : new RegExp(`^row-${id}([a-z])?\\.(jpg|jpeg|png|webp|pdf)$`, 'i');
      const files = fs.readdirSync(ctx.photoDirPath)
        .filter((name) => re.test(String(name || '')))
        .map((name) => ({ name, url:`${ctx.photoUrlBase}/${encodeURIComponent(name)}` }));
      res.json({ files, count: files.length });
    } catch (e) { res.status(500).json({ ok:false, error:e.message }); }
  });
  router.delete('/photo/:id', (req, res) => {
    try {
      const ctx = ensureDatasetResources(getDatasetContext(req.query.dataset));
      const id = String(req.params.id||'').replace(/[^0-9_]/g,'');
      if(!id) return res.json({ ok:true, files:[], count:0 });
      const baseId = id.includes('_') ? null : id;
      const re = baseId
        ? new RegExp(`^row-${baseId}(?:_\\d+)?([a-z])?\\.(jpg|jpeg|png|webp|pdf)$`, 'i')
        : new RegExp(`^row-${id}([a-z])?\\.(jpg|jpeg|png|webp|pdf)$`, 'i');
      const sanitizeFileName = (name) => {
        const trimmed = path.basename(String(name || '')).replace(/[<>:"/\\|?*]/g, '').replace(/[\u0000-\u001F]/g, '').trim();
        return trimmed || '';
      };
      const listRowFiles = () => {
        if (!fs.existsSync(ctx.photoDirPath)) return [];
        return fs.readdirSync(ctx.photoDirPath)
          .filter((name) => re.test(String(name || '')))
          .map((name) => ({ name, url:`${ctx.photoUrlBase}/${encodeURIComponent(name)}` }));
      };
      const rawName = sanitizeFileName(req.query.filename || '');
      if (rawName){
        if (!re.test(rawName)) return res.status(400).json({ ok:false, error:'Invalid filename' });
        const target = path.join(ctx.photoDirPath, rawName);
        const resolvedDir = path.resolve(ctx.photoDirPath);
        const resolvedTarget = path.resolve(target);
        if (resolvedTarget.startsWith(resolvedDir) && fs.existsSync(resolvedTarget)) {
          try { fs.unlinkSync(resolvedTarget); } catch {}
        }
      } else {
        const files = listRowFiles();
        files.forEach((f)=>{ try{ fs.unlinkSync(path.join(ctx.photoDirPath, f.name)); }catch{} });
      }
      const files = listRowFiles();
      res.json({ ok:true, files, count: files.length });
    } catch(e){ res.status(500).json({ ok:false, error:e.message }); }
  });
  router.post('/photo/:id', express.json({limit:'15mb'}), (req, res) => {
    try {
      const ctx = ensureDatasetResources(getDatasetContext(req.query.dataset));
      const id = String(req.params.id||'').replace(/[^0-9_]/g,'');
      if(!id) return res.status(400).json({ ok:false, error:'Invalid id' });
      const variants=['jpg','jpeg','png','webp','pdf'];
      const parsed = req.body || {};
      const mime = String(parsed.mime||'');
      const data = String(parsed.data||'');
      const allowed = /^(image\/|application\/pdf$)/i;
      if (!allowed.test(mime) || !data) return res.status(400).json({ ok:false, error:'Invalid image payload' });
      const lowerMime = mime.toLowerCase();
      const extMap = { 'image/jpeg':'jpg','image/jpg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf' };
      const ext = extMap[lowerMime] || (lowerMime === 'application/pdf' ? 'pdf' : 'png');
      const listRowFiles = () => {
        if (!fs.existsSync(ctx.photoDirPath)) return [];
        const baseId = id.includes('_') ? null : id;
        const re = baseId
          ? new RegExp(`^row-${baseId}(?:_\\d+)?([a-z])?\\.(jpg|jpeg|png|webp|pdf)$`, 'i')
          : new RegExp(`^row-${id}([a-z])?\\.(jpg|jpeg|png|webp|pdf)$`, 'i');
        return fs.readdirSync(ctx.photoDirPath)
          .filter((name) => re.test(String(name || '')))
          .map((name) => ({ name, url:`${ctx.photoUrlBase}/${encodeURIComponent(name)}` }));
      };
      const nextSuffix = () => {
        const existingNames = listRowFiles().map((f) => f.name);
        const hasBase = existingNames.some((n) => new RegExp(`^row-${id}(?:_\\d+)?\\.(jpg|jpeg|png|webp|pdf)$`, 'i').test(n));
        if (!hasBase) return '';
        const used = new Set(
          existingNames
            .map((n) => (n.match(new RegExp(`^row-${id}(?:_\\d+)?([a-z])\\.(jpg|jpeg|png|webp|pdf)$`, 'i')) || [])[1])
            .filter(Boolean)
            .map((s) => String(s).toLowerCase())
        );
        for (let i = 0; i < 26; i++){
          const letter = String.fromCharCode('a'.charCodeAt(0) + i);
          if (!used.has(letter)) return letter;
        }
        return `x${Date.now()}`;
      };
      const suffix = nextSuffix();
      const finalName = `row-${id}${suffix}.${ext}`;
      const filePath = path.join(ctx.photoDirPath, finalName);
      const resolvedDir = path.resolve(ctx.photoDirPath);
      const resolvedFile = path.resolve(filePath);
      if (!resolvedFile.startsWith(resolvedDir)) return res.status(400).json({ ok:false, error:'Invalid filename' });
      fs.writeFileSync(resolvedFile, Buffer.from(data,'base64'));
      const files = listRowFiles();
      res.json({ ok:true, file:{ name: finalName, url:`${ctx.photoUrlBase}/${encodeURIComponent(finalName)}` }, files, count: files.length });
    } catch(e){ res.status(500).json({ ok:false, error:e.message }); }
  });

  router.post('/photo-move', express.json({limit:'1mb'}), (req, res) => {
    try {
      const ctx = ensureDatasetResources(getDatasetContext(req.query.dataset));
      const fromId = String(req.body?.fromId || '').replace(/[^0-9_]/g, '');
      const toId = String(req.body?.toId || '').replace(/[^0-9_]/g, '');
      if (!fromId || !toId || fromId === toId) return res.json({ ok:true, moved:0 });
      if (!fs.existsSync(ctx.photoDirPath)) return res.json({ ok:true, moved:0 });

      const baseFrom = fromId.includes('_') ? fromId.split('_')[0] : fromId;
      const reFrom = new RegExp(`^row-(?:${fromId}|${baseFrom})(?:_\d+)?([a-z])?\.(jpg|jpeg|png|webp|pdf)$`, 'i');
      const reTo = new RegExp(`^row-${toId}(?:_\d+)?([a-z])?\.(jpg|jpeg|png|webp|pdf)$`, 'i');

      const existingTo = new Set(
        fs.readdirSync(ctx.photoDirPath).filter((name) => reTo.test(String(name || '')))
      );

      const listFrom = fs.readdirSync(ctx.photoDirPath)
        .filter((name) => reFrom.test(String(name || '')))
        .sort();

      let moved = 0;
      const nextSuffix = () => {
        const hasBase = Array.from(existingTo).some((n) => new RegExp(`^row-${toId}(?:_\d+)?\.(jpg|jpeg|png|webp|pdf)$`, 'i').test(n));
        if (!hasBase) return '';
        const used = new Set(
          Array.from(existingTo)
            .map((n) => (n.match(new RegExp(`^row-${toId}(?:_\d+)?([a-z])\.(jpg|jpeg|png|webp|pdf)$`, 'i')) || [])[1])
            .filter(Boolean)
            .map((s) => String(s).toLowerCase())
        );
        for (let i = 0; i < 26; i++) {
          const letter = String.fromCharCode('a'.charCodeAt(0) + i);
          if (!used.has(letter)) return letter;
        }
        return `x${Date.now()}`;
      };

      for (const name of listFrom) {
        const match = String(name).match(new RegExp(`^row-(?:${fromId}|${baseFrom})(.*)\.(jpg|jpeg|png|webp|pdf)$`, 'i'));
        const tail = match ? match[1] || '' : '';
        const ext = match ? match[2] : (name.match(/\.(jpg|jpeg|png|webp|pdf)$/i) || [])[1] || 'png';
        let targetName = `row-${toId}${tail}.${ext}`;
        const fromPath = path.join(ctx.photoDirPath, name);
        let toPath = path.join(ctx.photoDirPath, targetName);
        if (fs.existsSync(toPath)) {
          const suffix = nextSuffix();
          targetName = `row-${toId}${tail}${suffix}.${ext}`;
          toPath = path.join(ctx.photoDirPath, targetName);
        }
        try {
          fs.renameSync(fromPath, toPath);
          existingTo.add(targetName);
          moved += 1;
        } catch {}
      }

      return res.json({ ok:true, moved });
    } catch (e) {
      res.status(500).json({ ok:false, error: e.message });
    }
  });

  router.post('/photo-tag', express.json({limit:'1mb'}), (req, res) => {
    try {
      const ctx = ensureDatasetResources(getDatasetContext(req.query.dataset));
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const tagRaw = String(req.body?.tag || '_25').trim();
      const tag = tagRaw.replace(/[^0-9_]/g, '') || '_25';
      if (!ids.length) return res.json({ ok:true, moved:0 });
      if (!fs.existsSync(ctx.photoDirPath)) return res.json({ ok:true, moved:0 });

      let moved = 0;
      ids.forEach((rawId) => {
        const id = String(rawId || '').replace(/[^0-9_]/g, '');
        if (!id) return;
        const baseId = id.includes('_') ? null : id;
        const re = baseId
          ? new RegExp(`^row-${baseId}(?:_\\d+)?([a-z])?\\.(jpg|jpeg|png|webp|pdf)$`, 'i')
          : new RegExp(`^row-${id}([a-z])?\\.(jpg|jpeg|png|webp|pdf)$`, 'i');
        const files = fs.readdirSync(ctx.photoDirPath).filter((name) => re.test(String(name || '')));
        files.forEach((name) => {
          const match = String(name).match(/^(row-[0-9_]+)(?:_\d+)?([a-z])?\.(jpg|jpeg|png|webp|pdf)$/i);
          if (!match) return;
          const base = match[1];
          const suffix = match[2] || '';
          const ext = match[3];
          const targetName = `${base}${tag}${suffix}.${ext}`;
          const fromPath = path.join(ctx.photoDirPath, name);
          const toPath = path.join(ctx.photoDirPath, targetName);
          try {
            if (!fs.existsSync(toPath)) {
              fs.renameSync(fromPath, toPath);
              moved += 1;
            }
          } catch {}
        });
      });

      res.json({ ok:true, moved });
    } catch (e) {
      res.status(500).json({ ok:false, error: e.message });
    }
  });

  // Cleanup tmp
  router.post('/cleanup-tmp', (req, res) => {
    try { if (!fs.existsSync(TMP_DIR)) return res.json({ ok:true, deleted:0 }); let deleted = 0; for (const name of fs.readdirSync(TMP_DIR)) { if (!/\.(xlsx|csv)$/i.test(name)) continue; try{ fs.unlinkSync(path.join(TMP_DIR,name)); deleted++; }catch{} } res.json({ ok:true, deleted }); } catch(e){ res.status(500).json({ ok:false, error:e.message }); }
  });

  router.get('/settings', (req, res) => {
    try {
      res.json({ ok: true, settings: getReportSettings() });
    } catch (e) {
      res.status(500).json({ ok:false, error:e.message });
    }
  });

  router.post('/settings', express.json({limit:'256kb'}), (req, res) => {
    try {
      const settings = saveReportSettings(req.body && req.body.settings ? req.body.settings : req.body);
      res.json({ ok: true, settings });
    } catch (e) {
      res.status(500).json({ ok:false, error:e.message });
    }
  });

  function requireOcrEnabled(req, res) {
    if (isOcrEnabled()) return true;
    res.status(404).json({ ok: false, error: 'OCR disabled' });
    return false;
  }

  // ── OCR Routes ──────────────────────────────────────────────────
  // POST /ocr/scan — start background OCR scan of all (or selected) attachments
  router.post('/ocr/scan', (req, res) => {
    try {
      if (!requireOcrEnabled(req, res)) return;
      const { startScan } = require('./ocr-scanner');
      const { rowIds, category: filterCategory } = req.body || {};
      const filterIds = Array.isArray(rowIds) && rowIds.length > 0
        ? new Set(rowIds.map(String))
        : null;
      const targetCategory = filterCategory && DATASET_CONFIG[filterCategory]
        ? filterCategory
        : null;

      const datasets = Object.entries(DATASET_CONFIG).map(([key]) => {
        const ctx = getDatasetContext(key);
        let csvRows = [];
        try { csvRows = readCsvToJson(ctx); } catch {}
        if (targetCategory && key !== targetCategory) return null;
        if (filterIds) csvRows = csvRows.filter(r => filterIds.has(String(r.id || '')));
        return { category: key, photoDirPath: ctx.photoDirPath, csvRows, filterIds: filterIds || undefined, forceRescan: !!filterIds };
      }).filter(Boolean);

      const result = startScan(datasets);
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /ocr/check — which of the given rowIds are already scanned
  router.post('/ocr/check', (req, res) => {
    try {
      if (!requireOcrEnabled(req, res)) return;
      const { getScannedDecisionSet } = require('./ocr-db');
      const { rowIds, category } = req.body || {};
      const ids = Array.isArray(rowIds) ? rowIds.map(String) : [];
      const scanned = getScannedDecisionSet(category || undefined);
      const result = ids.map(id => ({ id, scanned: scanned.has(id) }));
      res.json({ ok: true, result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // GET /ocr/status — poll scan progress
  router.get('/ocr/status', (req, res) => {
    try {
      if (!requireOcrEnabled(req, res)) return;
      const { getProgress } = require('./ocr-scanner');
      res.json({ ok: true, progress: getProgress() });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // GET /ocr/results?decisionNumber=&category= — OCR rows for a decision
  router.get('/ocr/results', (req, res) => {
    try {
      if (!requireOcrEnabled(req, res)) return;
      const { getByDecision } = require('./ocr-db');
      const decisionNumber = String(req.query.decisionNumber || '').trim();
      const category = String(req.query.category || '').trim();
      if (!decisionNumber) return res.status(400).json({ ok: false, error: 'decisionNumber required' });
      const rows = getByDecision(decisionNumber, category || undefined);
      res.json({ ok: true, rows });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // GET /ocr/search?query=&decisionNumber=&category=&year= — full-text search
  router.get('/ocr/search', (req, res) => {
    try {
      if (!requireOcrEnabled(req, res)) return;
      const { searchOcr } = require('./ocr-db');
      const query = String(req.query.query || '').trim();
      const decisionNumber = String(req.query.decisionNumber || '').trim();
      const category = String(req.query.category || '').trim();
      const year = String(req.query.year || '').trim();
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
      if (!query && !decisionNumber) return res.status(400).json({ ok: false, error: 'query or decisionNumber required' });
      const rows = searchOcr({ query: query || undefined, decisionNumber: decisionNumber || undefined, category: category || undefined, year: year || undefined, limit });

      // Attach snippet (first 200 chars of matched text)
      const results = rows.map(r => ({
        ...r,
        snippet: r.extractedText
          ? (query ? highlightSnippet(r.extractedText, query) : r.extractedText.slice(0, 200))
          : '',
        extractedText: undefined,
      }));
      res.json({ ok: true, results });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // DELETE /ocr/entry?key= — remove one file's OCR from DB + cache files (allows re-scan)
  router.delete('/ocr/entry', (req, res) => {
    try {
      if (!requireOcrEnabled(req, res)) return;
      const { deleteByFileKey, getDb } = require('./ocr-db');
      const uploadFileKey = String(req.query.key || '').trim();
      if (!uploadFileKey) return res.status(400).json({ ok: false, error: 'key required' });
      const pages = getDb().prepare('SELECT cachePath FROM ocr_results WHERE uploadFileKey = ?').all(uploadFileKey);
      for (const { cachePath } of pages) {
        if (cachePath) try { fs.unlinkSync(cachePath); } catch {}
      }
      deleteByFileKey(uploadFileKey);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // GET /ocr/stats — aggregate counts
  router.get('/ocr/stats', (req, res) => {
    try {
      if (!requireOcrEnabled(req, res)) return;
      const { getStats } = require('./ocr-db');
      res.json({ ok: true, stats: getStats() });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  function highlightSnippet(text, query) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text.slice(0, 200);
    const start = Math.max(0, idx - 60);
    const end = Math.min(text.length, idx + query.length + 140);
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }
  return router;
};
