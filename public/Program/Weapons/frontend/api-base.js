(function initWeaponsApiBase(global) {
  if (!global || typeof global.buildWeaponsApiUrl === 'function') {
    return;
  }

  const PROJECT_API_PREFIX = '/api/weapons';
  const FILE_MODE_ORIGIN = 'http://127.0.0.1:3107';

  function isAbsoluteUrl(value) {
    return /^[a-z][a-z0-9+.-]*:/i.test(value) || String(value || '').startsWith('//');
  }

  function normalizeApiPath(input) {
    const value = String(input || '');
    if (!value) return PROJECT_API_PREFIX;
    if (isAbsoluteUrl(value)) return value;
    if (!value.startsWith('/')) return value;
    if (value === PROJECT_API_PREFIX || value.startsWith(`${PROJECT_API_PREFIX}/`)) {
      return value;
    }
    if (value === '/api') {
      return PROJECT_API_PREFIX;
    }
    if (value.startsWith('/api/')) {
      return `${PROJECT_API_PREFIX}${value.slice(4)}`;
    }
    return value;
  }

  function buildWeaponsApiUrl(input) {
    const normalized = normalizeApiPath(input);
    if (isAbsoluteUrl(normalized)) return normalized;
    if (global.location && global.location.protocol === 'file:' && normalized.startsWith('/')) {
      return new URL(normalized, FILE_MODE_ORIGIN).toString();
    }
    return normalized;
  }

  function buildWeaponsApiCandidates(values) {
    const list = Array.isArray(values) ? values : [values];
    return list.map((value) => buildWeaponsApiUrl(value));
  }

  global.WEAPONS_API_PREFIX = PROJECT_API_PREFIX;
  global.buildWeaponsApiUrl = buildWeaponsApiUrl;
  global.buildWeaponsApiCandidates = buildWeaponsApiCandidates;
})(typeof window !== 'undefined' ? window : globalThis);
