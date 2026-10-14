(function initAdministrativeSharedReferenceData(global) {
  if (!global || global.AdministrativeSharedReferenceData) {
    return;
  }

  const FALLBACK_DATA = {
    version: 1,
    updatedAt: '2026-04-11T00:00:00.000Z',
    sectors: [
      { key: 'east', label: 'شرق', stations: ['مكتب تجريبي 01', 'مكتب تجريبي 02', 'مكتب تجريبي 03', 'مكتب تجريبي 04', 'مكتب تجريبي 05', 'مكتب تجريبي 06', 'مكتب تجريبي 07', 'مكتب تجريبي 08', 'مكتب تجريبي 09', 'مكتب تجريبي 10'] },
      { key: 'west', label: 'غرب', stations: ['مكتب تجريبي 11', 'مكتب تجريبي 12', 'مكتب تجريبي 13', 'مكتب تجريبي 14', 'مكتب تجريبي 15', 'مكتب تجريبي 16', 'مكتب تجريبي 17', 'مكتب تجريبي 18', 'مكتب تجريبي 19'] },
      { key: 'south', label: 'جنوب', stations: ['مكتب تجريبي 20', 'مكتب تجريبي 21', 'مكتب تجريبي 22', 'مكتب تجريبي 23', 'مكتب تجريبي 24', 'مكتب تجريبي 25', 'مكتب تجريبي 26', 'مكتب تجريبي 27', 'مكتب تجريبي 28', 'مكتب تجريبي 29', 'مكتب تجريبي 30'] },
      { key: 'north', label: 'شمال', stations: ['مكتب تجريبي 31', 'مكتب تجريبي 32', 'مكتب تجريبي 33', 'مكتب تجريبي 34', 'مكتب تجريبي 35', 'مكتب تجريبي 36', 'مكتب تجريبي 37', 'مكتب تجريبي 38', 'مكتب تجريبي 39', 'مكتب تجريبي 40'] },
      { key: 'sectorfive', label: 'القطاع التجريبي الخامس', 'stations': ['مكتب تجريبي 41', 'مكتب تجريبي 42', 'مكتب تجريبي 43', 'مكتب تجريبي 44', 'مكتب تجريبي 45'] }
    ],
    licenseTypes: {
      weapons: [
        { name: 'اخطار', aliases: ['أخطار', 'إخطار', 'اخطار شرطة', 'أخطار شرطة'] },
        { name: 'دفاع', aliases: ['دفاع نفس', 'دفاع عن النفس'] },
        { name: 'حراسه', aliases: ['حراسة'] },
        { name: 'صيد', aliases: [] },
        { name: 'اعفاء هيئات قضائية', aliases: [] },
        { name: 'رماه دوليين', aliases: [] },
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
        { name: 'صيد', aliases: [] },
        { name: 'اعفاء هيئات قضائية', aliases: [] },
        { name: 'رماه دوليين', aliases: [] },
        { name: 'مخابرات', aliases: ['مخابرات عامه', 'مخابرات عامة'] },
        { name: 'رقابة ادارية', aliases: ['رقابة إدارية'] },
        { name: 'دفاع طالما بالعمل', aliases: ['دفاع طالما في عمله', 'دفاع طالمه في عمله'] },
        { name: 'اعفاء دبلوماسين', aliases: ['إعفاء دبلوماسيين', 'اعفاء دبلوماسيين'] },
        { name: 'إعفاء شرطة', aliases: ['اعفاء شرطة'] },
        { name: 'إعفاء قوات مسلحة', aliases: ['اعفاء قوات مسلحة'] },
        { name: 'إتجار', aliases: ['اتجار'] }
      ],
      request: [
        { name: 'ترخيص جديد', aliases: [] },
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

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function toLatinDigits(value) {
    return String(value || '')
      .replace(/[\u0660-\u0669]/g, function convertArabicDigits(char) { return String(char.charCodeAt(0) - 0x0660); })
      .replace(/[\u06F0-\u06F9]/g, function convertPersianDigits(char) { return String(char.charCodeAt(0) - 0x06F0); });
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
      .map(function trimOptionalLetter(token) {
        return token.length >= 4 ? token.replace(/ي$/u, '') : token;
      })
      .join(' ')
      .trim();
    if (loosened) variants.add(loosened);
    const keys = new Set();
    variants.forEach(function pushVariant(variant) {
      const key = variant.replace(/[^\p{L}\p{N}]+/gu, '');
      if (key) keys.add(key);
    });
    return keys;
  }

  function generateFrankoKey(value, fallback) {
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
      } else if (/[a-z0-9]/.test(char)) {
        result += char;
      }
    }
    return result.replace(/[^a-z0-9]+/g, '');
  }

  function uniqueStrings(list, excluded) {
    const seen = new Set((Array.isArray(excluded) ? excluded : []).map(function mapExcluded(value) {
      return normalizeMatchKey(value);
    }).filter(Boolean));
    const result = [];
    (Array.isArray(list) ? list : []).forEach(function pushValue(value) {
      const text = normalizeDisplayText(value);
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
    const candidate = entry.name != null ? entry.name : (entry.label != null ? entry.label : entry.value);
    return typeof candidate === 'string' || typeof candidate === 'number' ? candidate : '';
  }

  function hasCorruptedStationEntries(list) {
    const items = Array.isArray(list) ? list : [];
    if (!items.length) return false;
    return items.some(function isCorrupted(item) {
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
    const rawName = getStationSourceValue(entry);
    if (isCorruptedStationValue(rawName)) {
      return { name: '', aliases: [] };
    }
    const name = normalizeDisplayText(rawName);
    return {
      name: name,
      aliases: uniqueStrings(entry && entry.aliases, [name])
    };
  }

  function normalizeStationEntries(list) {
    const result = [];
    const indexByKey = new Map();
    (Array.isArray(list) ? list : []).forEach(function pushEntry(item) {
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

  function normalizeLicenseTypeEntries(list) {
    const result = [];
    const indexByKey = new Map();
    (Array.isArray(list) ? list : []).forEach(function pushEntry(entry) {
      var normalized;
      if (typeof entry === 'string') {
        normalized = { name: normalizeDisplayText(entry), aliases: [] };
      } else {
        var name = normalizeDisplayText(entry && entry.name);
        normalized = {
          name: name,
          aliases: uniqueStrings(entry && entry.aliases, [name])
        };
      }
      var key = normalizeMatchKey(normalized.name);
      if (!normalized.name || !key) return;
      if (indexByKey.has(key)) {
        var existing = result[indexByKey.get(key)];
        existing.aliases = uniqueStrings((existing.aliases || []).concat(normalized.aliases || []), [existing.name]);
        return;
      }
      indexByKey.set(key, result.length);
      result.push(normalized);
    });
    return result;
  }

  function buildUnifiedLicenseTypes(licenseTypes) {
    const source = licenseTypes && typeof licenseTypes === 'object' ? licenseTypes : {};
    const scopeNames = new Set(['shared', 'weapons', 'renewal', 'request']);
    Object.keys(source).forEach(function addScope(scope) {
      const normalizedScope = normalizeDisplayText(scope).toLowerCase();
      if (normalizedScope) scopeNames.add(normalizedScope);
    });

    const mergedEntries = [];
    const indexByKey = new Map();
    const mergeValues = function mergeValues(values) {
      normalizeLicenseTypeEntries(values).forEach(function pushEntry(entry) {
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
      Object.values(FALLBACK_DATA.licenseTypes || {}).forEach(mergeValues);
    }

    return Object.fromEntries(Array.from(scopeNames).map(function mapScope(scope) {
      return [scope, deepClone(mergedEntries)];
    }));
  }

  function sanitizeData(input) {
    const source = input && typeof input === 'object' ? input : {};
    const sectors = Array.isArray(source.sectors) && source.sectors.length ? source.sectors : FALLBACK_DATA.sectors;
    const rawLicenseTypes = source.licenseTypes && typeof source.licenseTypes === 'object'
      ? source.licenseTypes
      : FALLBACK_DATA.licenseTypes;

    return {
      version: 1,
      updatedAt: source.updatedAt || FALLBACK_DATA.updatedAt,
      sectors: sectors.map(function normalizeSector(entry, index) {
        const fallback = FALLBACK_DATA.sectors[index] || {};
        const label = normalizeDisplayText(entry && entry.label || fallback.label);
        const rawStations = Array.isArray(entry && entry.stations) ? entry.stations : [];
        const normalizedStations = normalizeStationEntries(rawStations);
        return {
          key: normalizeDisplayText(entry && entry.key || generateFrankoKey(label, fallback.key) || fallback.key),
          label: label,
          aliases: uniqueStrings(entry && entry.aliases, [entry && entry.key, label]),
          stations: normalizedStations.length || !hasCorruptedStationEntries(rawStations)
            ? normalizedStations
            : normalizeStationEntries(fallback.stations)
        };
      }).filter(function onlyValid(entry) { return entry.key && entry.label; }),
      licenseTypes: buildUnifiedLicenseTypes(rawLicenseTypes)
    };
  }

  let snapshot = sanitizeData(global.__ADMINISTRATIVE_SHARED_REFERENCE_DATA__ || FALLBACK_DATA);

  function sectorAliasKeys(entry) {
    const keys = new Set();
    const values = [entry && entry.label, entry && entry.key].concat(Array.isArray(entry && entry.aliases) ? entry.aliases : []);
    values.forEach(function pushValue(rawValue) {
      const value = normalizeDisplayText(rawValue);
      if (!value) return;
      keys.add(normalizeMatchKey(value));
      if (/[\u0600-\u06ff]/u.test(value)) {
        keys.add(normalizeMatchKey('قطاع ' + value));
        if (!value.startsWith('ال')) {
          keys.add(normalizeMatchKey('ال' + value));
          keys.add(normalizeMatchKey('قطاع ال' + value));
        } else {
          keys.add(normalizeMatchKey(value.replace(/^ال/u, '')));
        }
      }
    });
    return keys;
  }

  function stationAliasKeys(stationEntry) {
    const values = [getStationDisplayName(stationEntry)].concat(Array.isArray(stationEntry && stationEntry.aliases) ? stationEntry.aliases : []);
    const keys = new Set();
    values.forEach(function pushValue(rawValue) {
      const display = normalizeDisplayText(rawValue);
      if (!display) return;
      const variants = new Set([display]);
      variants.add(display.replace(/^مدينة\s+/u, '').trim());
      variants.add(display.replace(/^قسم\s+/u, '').trim());
      variants.add(display.replace(/^مركز\s+/u, '').trim());
      variants.add(display.replace(/^شرطة\s+/u, '').trim());
      Array.from(variants).forEach(function addArticleVariant(value) {
        if (!value) return;
        variants.add(value.replace(/^ال/u, '').trim());
      });
      variants.forEach(function pushVariant(value) {
        buildFlexibleArabicMatchKeys(value).forEach(function addMatchKey(matchKey) {
          keys.add(matchKey);
        });
      });
    });
    return keys;
  }

  function licenseTypeAliasKeys(entry) {
    const keys = new Set();
    [entry && entry.name].concat(Array.isArray(entry && entry.aliases) ? entry.aliases : []).forEach(function pushValue(value) {
      const matchKey = normalizeMatchKey(value);
      if (matchKey) keys.add(matchKey);
    });
    return keys;
  }

  function getSectorEntries() {
    return deepClone(snapshot.sectors);
  }

  function getLicenseTypeEntries(scope) {
    const requestedScope = normalizeDisplayText(scope || 'weapons').toLowerCase();
    const exact = snapshot.licenseTypes[requestedScope];
    if (Array.isArray(exact) && exact.length) return deepClone(exact);
    if (Array.isArray(snapshot.licenseTypes.shared)) return deepClone(snapshot.licenseTypes.shared);
    return Array.isArray(snapshot.licenseTypes.weapons) ? deepClone(snapshot.licenseTypes.weapons) : [];
  }

  function resolveSectorEntry(value) {
    const matchKey = normalizeMatchKey(value);
    if (!matchKey) return null;
    return snapshot.sectors.find(function findSector(entry) {
      return sectorAliasKeys(entry).has(matchKey);
    }) || null;
  }

  function resolveSectorKey(value) {
    const entry = resolveSectorEntry(value);
    return entry ? entry.key : '';
  }

  function resolveSectorLabel(value) {
    const entry = resolveSectorEntry(value);
    return entry ? entry.label : '';
  }

  function getSectorChoices(mode) {
    const resolvedMode = mode === 'key' ? 'key' : 'label';
    return snapshot.sectors.map(function mapSector(entry) {
      return {
        key: entry.key,
        value: resolvedMode === 'key' ? entry.key : entry.label,
        label: entry.label
      };
    });
  }

  function getSectorKeyToLabelMap() {
    return Object.fromEntries(snapshot.sectors.map(function mapEntry(entry) { return [entry.key, entry.label]; }));
  }

  function getSectorLabelToKeyMap() {
    return Object.fromEntries(snapshot.sectors.map(function mapEntry(entry) { return [entry.label, entry.key]; }));
  }

  function getSectorStationsMap(mode) {
    const resolvedMode = mode === 'label' ? 'label' : 'key';
    return Object.fromEntries(snapshot.sectors.map(function mapEntry(entry) {
      return [
        resolvedMode === 'label' ? entry.label : entry.key,
        (Array.isArray(entry.stations) ? entry.stations : []).map(getStationDisplayName).filter(Boolean)
      ];
    }));
  }

  function getStationsForSector(sectorValue) {
    const entry = resolveSectorEntry(sectorValue);
    return entry && Array.isArray(entry.stations) ? entry.stations.map(getStationDisplayName).filter(Boolean) : [];
  }

  function resolveStationName(value, sectorValue) {
    const matchKey = normalizeMatchKey(value);
    const display = normalizeDisplayText(value);
    if (!matchKey) return '';
    const sectorEntry = sectorValue ? resolveSectorEntry(sectorValue) : null;
    const sectorList = sectorEntry ? [sectorEntry] : snapshot.sectors;
    const matches = [];
    sectorList.forEach(function searchSector(entry) {
      (Array.isArray(entry.stations) ? entry.stations : []).forEach(function searchStation(station) {
        if (stationAliasKeys(station).has(matchKey)) {
          matches.push({ sector: entry, station: getStationDisplayName(station) });
        }
      });
    });
    if (!matches.length) return display;
    if (!sectorEntry) {
      const uniqueStations = Array.from(new Set(matches.map(function mapStation(item) { return item.station; })));
      if (uniqueStations.length === 1) return uniqueStations[0];
    }
    return matches[0].station;
  }

  function detectSectorEntryFromStation(value) {
    const matchKey = normalizeMatchKey(value);
    if (!matchKey) return null;
    return snapshot.sectors.find(function findSector(entry) {
      return (Array.isArray(entry.stations) ? entry.stations : []).some(function findStation(station) {
        return stationAliasKeys(station).has(matchKey);
      });
    }) || null;
  }

  function detectSectorKeyFromStation(value) {
    const entry = detectSectorEntryFromStation(value);
    return entry ? entry.key : '';
  }

  function detectSectorLabelFromStation(value) {
    const entry = detectSectorEntryFromStation(value);
    return entry ? entry.label : '';
  }

  function getLicenseTypes(scope) {
    return getLicenseTypeEntries(scope).map(function mapEntry(entry) { return entry.name; });
  }

  function resolveLicenseType(value, scope) {
    const matchKey = normalizeMatchKey(value);
    const display = normalizeDisplayText(value);
    if (!matchKey) return '';
    const entries = getLicenseTypeEntries(scope);
    const entry = entries.find(function findEntry(item) {
      return licenseTypeAliasKeys(item).has(matchKey);
    });
    return entry ? entry.name : display;
  }

  function getSnapshot() {
    return deepClone(snapshot);
  }

  function setSnapshot(nextValue) {
    snapshot = sanitizeData(nextValue);
    try {
      global.dispatchEvent(new CustomEvent('reference-data:updated', { detail: { snapshot: getSnapshot() } }));
    } catch (_) {}
    return getSnapshot();
  }

  async function refresh() {
    try {
      const response = await fetch('/api/reference-data', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('reference-data fetch failed');
      const payload = await response.json();
      if (payload && payload.data) {
        setSnapshot(payload.data);
      }
    } catch (_) {}
    return getSnapshot();
  }

  global.AdministrativeSharedReferenceData = {
    getSnapshot: getSnapshot,
    setSnapshot: setSnapshot,
    refresh: refresh,
    normalizeDisplayText: normalizeDisplayText,
    normalizeArabicForMatch: normalizeArabicForMatch,
    normalizeMatchKey: normalizeMatchKey,
    generateFrankoKey: generateFrankoKey,
    getSectorEntries: getSectorEntries,
    getSectorChoices: getSectorChoices,
    getSectorKeyToLabelMap: getSectorKeyToLabelMap,
    getSectorLabelToKeyMap: getSectorLabelToKeyMap,
    getSectorStationsMap: getSectorStationsMap,
    getStationsForSector: getStationsForSector,
    resolveSectorKey: resolveSectorKey,
    resolveSectorLabel: resolveSectorLabel,
    resolveStationName: resolveStationName,
    detectSectorKeyFromStation: detectSectorKeyFromStation,
    detectSectorLabelFromStation: detectSectorLabelFromStation,
    getLicenseTypeEntries: getLicenseTypeEntries,
    getLicenseTypes: getLicenseTypes,
    resolveLicenseType: resolveLicenseType
  };
})(typeof window !== 'undefined' ? window : globalThis);
