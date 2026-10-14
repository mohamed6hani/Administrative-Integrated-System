(function initWeaponsWeaponTextUtilsModule() {
  if (window.WeaponsWeaponTextUtils && typeof window.WeaponsWeaponTextUtils.createApi === 'function') {
    return;
  }

  function createApi(options = {}) {
    const toLatinDigits = typeof options.toLatinDigits === 'function'
      ? options.toLatinDigits
      : (value) => String(value ?? '');
    const toArabicDigits = typeof options.toArabicDigits === 'function'
      ? options.toArabicDigits
      : (value) => String(value ?? '');

    function normalizeWeaponKey(value) {
      return toLatinDigits(String(value ?? '')).trim().replace(/\s+/g, ' ');
    }

    function parseWeaponNames(raw) {
      return String(raw || '')
        .split(/\+/)
        .map((value) => String(value || '').trim().replace(/^و+\s*/, ''))
        .filter((value) => value.length > 0);
    }

    function stripWithdrawTag(text) {
      return String(text || '')
        .replace(/\s*\(\s*(?:ال)?مسحوب\s*\)\s*/g, ' ')
        .replace(/\(\s*\)/g, ' ')
        .replace(/^و+\s*/u, '')
        .replace(/\s*\+\s*/g, ' + ')
        .replace(/(\+\s*){2,}/g, ' + ')
        .replace(/^(\s*\+\s*)+/, '')
        .replace(/(\s*\+\s*)+$/, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }

    function hasMeaningfulWeaponText(text) {
      if (!text) return false;
      const stripped = stripWithdrawTag(text)
        .replace(/[()\[\]{}（）]/g, ' ')
        .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
        .replace(/\s+/g, '')
        .trim();
      return stripped.length > 0;
    }

    function splitWeaponSegments(raw) {
      if (raw == null) return [];
      return String(raw)
        .split(/[ \t]*\+[ \t]*|\r?\n/)
        .map((segment) => String(segment || '').trim())
        .filter((segment) => segment && hasMeaningfulWeaponText(segment));
    }

    function extractWeaponEntries(raw) {
      const segments = splitWeaponSegments(raw);
      if (!segments.length) return [];

      const entries = [];
      segments.forEach((segment, index) => {
        const withdrawn = /\(\s*(?:ال)?مسحوب\s*\)/.test(segment);
        const cleanName = stripWithdrawTag(segment);
        if (!hasMeaningfulWeaponText(cleanName || segment)) return;
        entries.push({
          index,
          rawText: segment,
          withdrawn,
          cleanName
        });
      });

      return entries;
    }

    function buildWeaponDisplayText(entries) {
      if (!Array.isArray(entries) || !entries.length) return '';
      return entries.map((entry) => toArabicDigits(entry.cleanName || '')).join(' \u2003 ');
    }

    function findWeaponInEntry(entry, weaponName) {
      if (!entry || typeof entry !== 'object' || !Array.isArray(entry.weapons)) return null;
      const target = normalizeWeaponKey(weaponName);
      if (!target) return null;
      return entry.weapons.find((weapon) => normalizeWeaponKey(weapon && weapon.name) === target) || null;
    }

    function detectWithdrawalStatusCode(line) {
      const text = String(line || '').trim();
      if (!text) return 'unknown';
      if (text.includes('جزئي')) return 'partial';
      if (text.includes('غير مسحوب') || text.includes('لم يتم')) return 'not';
      if (text.includes('مسحوب') || text.includes('تم السحب')) return 'got';
      return 'unknown';
    }

    function countWeaponLines(text) {
      return String(text || '')
        .split(/\r?\n/)
        .map((line) => String(line || '').trim())
        .filter((line) => line.length).length;
    }

    function sanitizeNumericText(value) {
      return toLatinDigits(String(value ?? '')).replace(/[^0-9]/g, '');
    }

    function countWeaponsForGroup(group, row, piecesColIdx) {
      const byLines = countWeaponLines(group?.weaponText || '');
      if (byLines > 0) return byLines;
      if (piecesColIdx !== -1) {
        const parsed = parseInt(sanitizeNumericText(row && row[piecesColIdx]), 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
      return 0;
    }

    return {
      normalizeWeaponKey,
      parseWeaponNames,
      stripWithdrawTag,
      hasMeaningfulWeaponText,
      splitWeaponSegments,
      extractWeaponEntries,
      buildWeaponDisplayText,
      findWeaponInEntry,
      detectWithdrawalStatusCode,
      countWeaponLines,
      countWeaponsForGroup
    };
  }

  window.WeaponsWeaponTextUtils = { createApi };
})();
