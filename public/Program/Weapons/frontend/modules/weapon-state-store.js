(function initWeaponsStateStoreModule() {
  if (window.WeaponsStateStore && typeof window.WeaponsStateStore.createStore === 'function') {
    return;
  }

  const buildWeaponsApiUrl = typeof window.buildWeaponsApiUrl === 'function'
    ? window.buildWeaponsApiUrl
    : (path) => path;

  function createStore(options = {}) {
    const toLatinDigits = typeof options.toLatinDigits === 'function'
      ? options.toLatinDigits
      : (value) => String(value ?? '');

    let cache = [];
    let byRecordKey = new Map();
    let byLegacyKey = new Map();
    let byWeaponKey = new Map();

    function normalizePart(value) {
      return toLatinDigits(String(value ?? '').trim()).replace(/\s+/g, ' ');
    }

    function normalizeWeaponKey(value) {
      return toLatinDigits(String(value ?? '')).trim().replace(/\s+/g, ' ');
    }

    function normalizePieces(value) {
      const digits = toLatinDigits(String(value ?? '')).replace(/[^0-9]/g, '');
      if (!digits) return null;
      const parsed = parseInt(digits, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    function buildLegacyKey(name, license) {
      const normName = normalizePart(name);
      const normLicense = normalizePart(license);
      if (!normName && !normLicense) return '';
      return `legacy|${normName}::${normLicense}`;
    }

    function buildWeaponKey(name, license, weaponName) {
      const normName = normalizePart(name);
      const normLicense = normalizePart(license);
      const normWeapon = normalizeWeaponKey(weaponName);
      if (!normName && !normLicense && !normWeapon) return '';
      return `triple|${normName}::${normLicense}::${normWeapon}`;
    }

    function isStableRecordKey(recordKey) {
      return /^rec\|v4\|id=\d+$/.test(String(recordKey || '').trim());
    }

    function entryMatchesIdentity(entry, name, license) {
      const normName = normalizePart(name);
      const normLicense = normalizePart(license);
      if (!normName && !normLicense) return true;
      if (!entry || typeof entry !== 'object') return false;
      if (normName && normalizePart(entry.name) !== normName) return false;
      if (normLicense && normalizePart(entry.license) !== normLicense) return false;
      return true;
    }

    function indexEntry(entry) {
      if (!entry || typeof entry !== 'object') return;
      const recordKey = typeof entry.recordKey === 'string' ? entry.recordKey.trim() : '';
      if (recordKey) byRecordKey.set(recordKey, entry);

      const legacyKey = buildLegacyKey(entry.name, entry.license);
      if (legacyKey) {
        if (!byLegacyKey.has(legacyKey)) byLegacyKey.set(legacyKey, []);
        byLegacyKey.get(legacyKey).push(entry);
      }

      if (Array.isArray(entry.weapons)) {
        entry.weapons.forEach((weapon, weaponIndex) => {
          const weaponKey = buildWeaponKey(entry.name, entry.license, weapon && weapon.name);
          if (!weaponKey) return;
          byWeaponKey.set(weaponKey, { entry, weapon, weaponIndex });
        });
      }
    }

    function rebuildIndexes() {
      byRecordKey = new Map();
      byLegacyKey = new Map();
      byWeaponKey = new Map();
      cache.forEach(indexEntry);
    }

    function normalizeEntry(entry) {
      const item = entry && typeof entry === 'object' ? { ...entry } : {};
      item.name = String(item.name || '').trim();
      item.license = String(item.license || '').trim();
      item.recordKey = typeof item.recordKey === 'string' ? item.recordKey.trim() : '';
      item.weapons = (Array.isArray(item.weapons) ? item.weapons : [])
        .map((weapon) => {
          if (!weapon) return null;
          const name = typeof weapon === 'string'
            ? weapon.trim()
            : String(weapon.name || weapon.weapon || '').trim();
          if (!name) return null;
          const next = { name };
          const pieces = typeof weapon === 'object' ? normalizePieces(weapon.pieces ?? weapon.count) : null;
          if (pieces != null) next.pieces = pieces;
          if (typeof weapon === 'object' && Object.prototype.hasOwnProperty.call(weapon, 'withdrawn')) {
            next.withdrawn = !!weapon.withdrawn;
          }
          if (typeof weapon === 'object' && Object.prototype.hasOwnProperty.call(weapon, 'depositNumber')) {
            next.depositNumber = String(weapon.depositNumber || '').trim();
          }
          if (typeof weapon === 'object' && Object.prototype.hasOwnProperty.call(weapon, 'depositDate')) {
            next.depositDate = String(weapon.depositDate || '').trim();
          }
          return next;
        })
        .filter(Boolean);
      return item;
    }

    function replaceCache(list) {
      cache = (Array.isArray(list) ? list : []).map(normalizeEntry);
      rebuildIndexes();
      return cache;
    }

    function getCache() {
      return cache;
    }

    function upsertEntry(entry) {
      const normalized = normalizeEntry(entry);
      if (!normalized.recordKey && !buildLegacyKey(normalized.name, normalized.license)) return null;
      const direct = normalized.recordKey ? byRecordKey.get(normalized.recordKey) : null;
      const existing = direct && (isStableRecordKey(normalized.recordKey) || entryMatchesIdentity(direct, normalized.name, normalized.license))
        ? direct
        : getEntry(normalized.recordKey, normalized.name, normalized.license);
      const idx = existing ? cache.indexOf(existing) : -1;
      if (idx !== -1) {
        cache[idx] = normalized;
      } else {
        cache.push(normalized);
      }
      rebuildIndexes();
      return normalized;
    }

    function getEntry(recordKey, name, license) {
      const recKey = recordKey ? String(recordKey).trim() : '';
      if (recKey && byRecordKey.has(recKey)) {
        const direct = byRecordKey.get(recKey);
        if (entryMatchesIdentity(direct, name, license)) return direct;
      }

      const legacyKey = buildLegacyKey(name, license);
      if (legacyKey) {
        const bucket = byLegacyKey.get(legacyKey);
        if (Array.isArray(bucket) && bucket.length) {
          if (bucket.length === 1) return bucket[0];
          if (recKey) {
            const directMatch = bucket.find((entry) => String(entry?.recordKey || '').trim() === recKey);
            if (directMatch) return directMatch;
            const emptyKeyMatch = bucket.find((entry) => !String(entry?.recordKey || '').trim());
            if (emptyKeyMatch) return emptyKeyMatch;
            return null;
          }
          return bucket[0];
        }
      }

      return null;
    }

    function getWeaponRecord(recordKey, name, license, weaponName) {
      const weaponKey = buildWeaponKey(name, license, weaponName);
      if (weaponKey && byWeaponKey.has(weaponKey)) {
        const direct = byWeaponKey.get(weaponKey);
        const directRecordKey = String(direct?.entry?.recordKey || '').trim();
        if (!recordKey || !directRecordKey || directRecordKey === String(recordKey).trim()) {
          return direct;
        }
      }

      const entry = getEntry(recordKey, name, license);
      if (!entry || !Array.isArray(entry.weapons)) return null;

      const target = normalizeWeaponKey(weaponName);
      if (!target) return null;

      const weaponIndex = entry.weapons.findIndex((weapon) => normalizeWeaponKey(weapon && weapon.name) === target);
      if (weaponIndex === -1) return null;
      return { entry, weapon: entry.weapons[weaponIndex], weaponIndex };
    }

    function getWeaponPieces(recordKey, name, license, weaponName) {
      const match = getWeaponRecord(recordKey, name, license, weaponName);
      if (!match || !match.weapon) return null;
      return normalizePieces(match.weapon.pieces ?? match.weapon.count);
    }

    async function load(config = {}) {
      const endpoint = buildWeaponsApiUrl(config.endpoint || '/api/weapon-state');
      const fetchImpl = typeof config.fetchImpl === 'function'
        ? config.fetchImpl
        : (typeof fetch === 'function' ? fetch.bind(window) : null);

      if (!fetchImpl) return replaceCache([]);

      try {
        const response = await fetchImpl(endpoint, { cache: 'no-store' });
        if (!response.ok) return replaceCache([]);
        const payload = await response.json();
        return replaceCache(payload && Array.isArray(payload.list) ? payload.list : []);
      } catch (_) {
        return replaceCache([]);
      }
    }

    return {
      normalizePart,
      normalizeWeaponKey,
      normalizePieces,
      buildLegacyKey,
      buildWeaponKey,
      replaceCache,
      getCache,
      upsertEntry,
      getEntry,
      getWeaponRecord,
      getWeaponPieces,
      load
    };
  }

  window.WeaponsStateStore = { createStore };
})();
