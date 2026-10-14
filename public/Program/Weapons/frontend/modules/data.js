/**
 * Shared data constants for the Weapons frontend.
 * Data is sourced from the unified General reference-data store.
 */
(function initWeaponsDataModule() {
  if (window.WeaponsData && window.WeaponsData.__version === '2026-04-11') {
    return;
  }

  const SHARED_REFERENCE_DATA = window.AdministrativeSharedReferenceData || null;
  const FALLBACK_SECTOR_STATIONS = {
    east: ['مكتب تجريبي 01', 'مكتب تجريبي 02', 'مكتب تجريبي 03', 'مكتب تجريبي 04', 'مكتب تجريبي 05', 'مكتب تجريبي 06', 'مكتب تجريبي 07', 'مكتب تجريبي 08', 'مكتب تجريبي 09', 'مكتب تجريبي 10'],
    west: ['مكتب تجريبي 11', 'مكتب تجريبي 12', 'مكتب تجريبي 13', 'مكتب تجريبي 14', 'مكتب تجريبي 15', 'مكتب تجريبي 16', 'مكتب تجريبي 17', 'مكتب تجريبي 18', 'مكتب تجريبي 19'],
    south: ['مكتب تجريبي 20', 'مكتب تجريبي 21', 'مكتب تجريبي 22', 'مكتب تجريبي 23', 'مكتب تجريبي 24', 'مكتب تجريبي 25', 'مكتب تجريبي 26', 'مكتب تجريبي 27', 'مكتب تجريبي 28', 'مكتب تجريبي 29', 'مكتب تجريبي 30'],
    north: ['مكتب تجريبي 31', 'مكتب تجريبي 32', 'مكتب تجريبي 33', 'مكتب تجريبي 34', 'مكتب تجريبي 35', 'مكتب تجريبي 36', 'مكتب تجريبي 37', 'مكتب تجريبي 38', 'مكتب تجريبي 39', 'مكتب تجريبي 40'],
    sectorfive: ['مكتب تجريبي 41', 'مكتب تجريبي 42', 'مكتب تجريبي 43', 'مكتب تجريبي 44', 'مكتب تجريبي 45']
  };
  const FALLBACK_LICENSE_TYPES = [
    'اخطار',
    'دفاع',
    'حراسه',
    'صيد',
    'اعفاء هيئات قضائية',
    'رماه دوليين',
    'مخابرات عامه',
    'رقابة ادارية',
    'دفاع طالما في عمله',
    'اعفاء دبلوماسين',
    'إعفاء شرطة',
    'إعفاء قوات مسلحة',
    'إتجار'
  ];
  const FALLBACK_SECTOR_KEY_TO_LABEL = {
    east: 'شرق',
    west: 'غرب',
    south: 'جنوب',
    north: 'شمال',
    sectorfive: 'القطاع التجريبي الخامس'
  };

  const stationAllKeywordList = [
    'all',
    'كل',
    'الكل',
    'جميع الأقسام',
    'جميع الاقسام',
    'كافة الأقسام',
    'كافة الاقسام'
  ];
  const stationAllKeywords = new Set(stationAllKeywordList);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readSharedSnapshot() {
    return SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getSnapshot === 'function'
      ? SHARED_REFERENCE_DATA.getSnapshot()
      : null;
  }

  function buildDataSnapshot() {
    const sharedSnapshot = readSharedSnapshot();
    const sectorStations = SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getSectorStationsMap === 'function'
      ? SHARED_REFERENCE_DATA.getSectorStationsMap('key')
      : clone(FALLBACK_SECTOR_STATIONS);
    const sectorKeyToLabel = SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getSectorKeyToLabelMap === 'function'
      ? SHARED_REFERENCE_DATA.getSectorKeyToLabelMap()
      : { ...FALLBACK_SECTOR_KEY_TO_LABEL };
    const sectorLabelToKey = SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getSectorLabelToKeyMap === 'function'
      ? SHARED_REFERENCE_DATA.getSectorLabelToKeyMap()
      : Object.fromEntries(Object.entries(sectorKeyToLabel).map(([key, label]) => [label, key]));
    const licenseTypes = SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getLicenseTypes === 'function'
      ? SHARED_REFERENCE_DATA.getLicenseTypes('weapons')
      : FALLBACK_LICENSE_TYPES.slice();

    return {
      raw: sharedSnapshot,
      sectorStations,
      sectorKeyToLabel,
      sectorLabelToKey,
      allSectorKeys: Object.keys(sectorKeyToLabel),
      licenseTypes: Array.isArray(licenseTypes) && licenseTypes.length ? licenseTypes.slice() : FALLBACK_LICENSE_TYPES.slice()
    };
  }

  function syncWindowExports() {
    const snapshot = buildDataSnapshot();
    const payload = {
      __version: '2026-04-11',
      sectorStations: snapshot.sectorStations,
      licenseTypes: snapshot.licenseTypes,
      sectorKeyToLabel: snapshot.sectorKeyToLabel,
      sectorLabelToKey: snapshot.sectorLabelToKey,
      allSectorKeys: snapshot.allSectorKeys,
      stationAllKeywords,
      stationAllKeywordList
    };

    window.WeaponsData = payload;
    window.sectorStations = payload.sectorStations;
    window.LICENSE_TYPES = payload.licenseTypes;

    try {
      document.dispatchEvent(new CustomEvent('license-types:updated', {
        detail: { types: payload.licenseTypes.slice() }
      }));
    } catch (_) {}

    return payload;
  }

  async function fetchLicenseTypes() {
    if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.refresh === 'function') {
      try {
        await SHARED_REFERENCE_DATA.refresh();
      } catch (error) {
        console.warn('Failed to refresh shared reference data:', error);
      }
    }
    return syncWindowExports().licenseTypes.slice();
  }

  try {
    window.fetchLicenseTypes = fetchLicenseTypes;
  } catch (_) {}

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('reference-data:updated', () => {
      syncWindowExports();
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      syncWindowExports();
    });
  }

  syncWindowExports();
})();
