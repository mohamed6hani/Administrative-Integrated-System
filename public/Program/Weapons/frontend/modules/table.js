/***********************
 * GLOBAL CSV STATE
 ***********************/
let csvHeaders = [];
let csvAll     = [];   // master copy of ALL rows (unfiltered)
let csvAllNormLicense = []; // parallel normalized license cache (string per row)
let csvRowWithdrawKeys = []; // cached record keys per CSV row (used for withdrawal records)
let csvRowMeta = []; // parallel SQL row metadata ({ id, rowOrder, updatedAt })
let lastManualSaveStamp = 0;
const LIVE_CELL_FORMATTING = false;
const buildWeaponsApiUrl = (typeof window !== 'undefined' && typeof window.buildWeaponsApiUrl === 'function')
  ? window.buildWeaponsApiUrl
  : (path) => path;
const buildWeaponsApiCandidates = (typeof window !== 'undefined' && typeof window.buildWeaponsApiCandidates === 'function')
  ? window.buildWeaponsApiCandidates
  : (values) => (Array.isArray(values) ? values : [values]);
const DELETE_APPROVAL_INSPECT_STORAGE_KEY = 'general.deleteApprovalInspectTarget';

function publishCsvGlobals() {
  try {
    window.csvHeaders = csvHeaders;
    window.csvAll = csvAll;
    window.csvAllNormLicense = csvAllNormLicense;
    window.csvRowWithdrawKeys = csvRowWithdrawKeys;
    window.csvRowMeta = csvRowMeta;
  } catch (_) {}

}

publishCsvGlobals();

function getSqlRowMeta(rowIdx) {
  if (typeof rowIdx !== 'number' || rowIdx < 0 || !Array.isArray(csvRowMeta)) return null;
  const meta = csvRowMeta[rowIdx];
  return meta && typeof meta === 'object' ? meta : null;
}

function updateSqlRowMeta(rowIdx, patch = {}) {
  if (typeof rowIdx !== 'number' || rowIdx < 0) return;
  if (!Array.isArray(csvRowMeta)) csvRowMeta = [];
  const current = csvRowMeta[rowIdx] && typeof csvRowMeta[rowIdx] === 'object' ? csvRowMeta[rowIdx] : {};
  csvRowMeta[rowIdx] = {
    ...current,
    ...(patch.recordId != null ? { id: patch.recordId } : {}),
    ...(patch.id != null ? { id: patch.id } : {}),
    ...(patch.rowOrder != null ? { rowOrder: patch.rowOrder } : {}),
    ...(patch.rowIndex != null ? { rowIndex: patch.rowIndex } : {}),
    ...(patch.updatedAt != null ? { updatedAt: patch.updatedAt } : {})
  };
  publishCsvGlobals();
}

function getExpectedUpdatedAtForRow(rowIdx) {
  const meta = getSqlRowMeta(rowIdx);
  return meta && meta.updatedAt != null ? meta.updatedAt : null;
}

function getDirtyRowRefSet() {
  return (typeof window !== 'undefined' && window.__weaponsDirtyRowRefs instanceof Set)
    ? window.__weaponsDirtyRowRefs
    : null;
}

function getPendingWeaponSaveMap() {
  return (typeof window !== 'undefined' && window.pendingWeaponStateSaves instanceof Map)
    ? window.pendingWeaponStateSaves
    : null;
}

function pruneDirtyRowRefsToCurrentRows(dirtySet) {
  if (!(dirtySet instanceof Set)) return [];
  const currentRows = new Set(Array.isArray(csvAll) ? csvAll : []);
  Array.from(dirtySet).forEach((row) => {
    if (!Array.isArray(row) || !currentRows.has(row)) dirtySet.delete(row);
  });
  return Array.from(dirtySet);
}

const MODEL_SCAN_DEBOUNCE_MS = 900;
let modelScanTimer = null;

function getWeaponsModelSettings() {
  if (typeof window === 'undefined') return null;
  if (window.WeaponsModelSettings) return window.WeaponsModelSettings;
  try {
    const stored = localStorage.getItem('weaponsModelSettings');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        window.WeaponsModelSettings = parsed; // cache so settings.js sees the same object
        return parsed;
      }
    }
  } catch (_) {}
  return null;
}

function scheduleModelNotesScan(options = {}) {
  if (!LIVE_CELL_FORMATTING) return;
  const api = (typeof window !== 'undefined' && window.WeaponsModelAI && typeof window.WeaponsModelAI.scanDataset === 'function')
    ? window.WeaponsModelAI
    : null;
  if (!api) return;
  const run = () => {
    modelScanTimer = null;
    try {
      api.scanDataset(csvHeaders, csvAll);
    } catch (err) {
      console.warn('[ModelAI] scanDataset failed', err);
    }
  };
  if (options.immediate) {
    if (modelScanTimer) clearTimeout(modelScanTimer);
    run();
    return;
  }
  const delay = typeof options.delayMs === 'number' ? Math.max(0, options.delayMs) : MODEL_SCAN_DEBOUNCE_MS;
  if (modelScanTimer) clearTimeout(modelScanTimer);
  modelScanTimer = setTimeout(run, delay);
}

try { window.scheduleModelNotesScan = scheduleModelNotesScan; } catch (_) {}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 9999,
    padding: '10px 18px',
    borderRadius: '10px',
    fontWeight: '600',
    color: '#fff',
    background: type === 'error' ? '#dc2626' : '#16a34a',
    boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
    transition: 'none',
    opacity: '1',
    transform: 'none',
    fontFamily: 'Segoe UI, Tahoma, sans-serif'
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2500);
}

try { window.showToast = showToast; } catch (_) {}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function snapshotScrollPosition() {
  try {
    const container = document.querySelector('#csvPreviewContainer');
    return {
      x: typeof window.scrollX === 'number' ? window.scrollX : (window.pageXOffset || 0),
      y: typeof window.scrollY === 'number' ? window.scrollY : (window.pageYOffset || 0),
      tableY: container ? container.scrollTop || 0 : 0
    };
  } catch (_) {
    return null;
  }
}

function restoreScrollPosition(pos) {
  if (!pos) return;
  try {
    window.scrollTo(pos.x || 0, pos.y || 0);
    const container = document.querySelector('#csvPreviewContainer');
    if (container) container.scrollTop = pos.tableY || 0;
  } catch (_) {}
}

function restoreScrollPositionAfterRender(pos) {
  if (!pos) return;
  restoreScrollPosition(pos);
  try {
    requestAnimationFrame(() => {
      restoreScrollPosition(pos);
      requestAnimationFrame(() => restoreScrollPosition(pos));
    });
    setTimeout(() => restoreScrollPosition(pos), 60);
  } catch (_) {}
}

const GENERAL_TOKEN_KEY = 'general.auth.token';
const GENERAL_USER_KEY = 'general.auth.user';
const EXPORT_META_STORAGE_KEY = 'weaponsExportMeta';
const PORTAL_ADMIN_SECTOR_LABEL = '\u0627\u0644\u0625\u062f\u0627\u0631\u0629';

const UnsavedGuard = window.UnsavedGuard;

/***********************
 * CSV → table with filters (search, sector/station, got/not-got)
 ***********************/
document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  if (!body) return;
  if (body.classList.contains('print-page')) {
    return;
  }
  // Only on sheet.html (allow different base paths and query/hash)
  if (!location.pathname.toLowerCase().includes('sheet.html')) return;

  requireAuth();

  const table     = document.getElementById("csvPreview");
  if (!table) return;

  const CSV_URL = '/api/csv-raw';                                 // generated from SQL for Excel compatibility
  const REFRESH_INTERVAL_MS = 3000;
  let lastCsvSnapshot = null;
  let lastCsvHash = null;
  let csvRefreshTimer = null;
  let csvRefreshInFlight = false;
  let csvPollInFlight = false;
  let pendingExternalSaveRefresh = false;
  let externalSaveRefreshTimer = null;
  const SEP_RE  = /,(?=(?:[^"]*"[^"]*")*[^"]*$)|;|\t/;      // comma/semicolon/tab (quote-aware)
  const NOTE_WITHDRAW_KEYWORDS = ['حرز', 'محرز', 'احراز'];
  const noteContainsWithdrawKeyword = (text) => {
    if (!text) return false;
    const raw = String(text);
    return NOTE_WITHDRAW_KEYWORDS.some((kw) => raw.includes(kw));
  };

  const ctrlSaveListener = (ev) => {
    try {
      if (ev.repeat) return;
      const key = String(ev.key || '').toLowerCase();
      const isCtrlSave = ((ev.ctrlKey || ev.metaKey) && key === 's') || (ev.ctrlKey && ev.keyCode === 83);
      if (isCtrlSave) {
        ev.preventDefault();
        ev.stopPropagation();
        saveCSV().catch(() => {});
      }
    } catch (_) {}
  };

  document.addEventListener('keydown', ctrlSaveListener, { capture: true });
  window.addEventListener('keydown', ctrlSaveListener, { capture: true });

  // Controls
  const searchEl   = document.getElementById('filterInput');
  const searchColumnSel = document.getElementById('filterColumnSelect');
  const sectorEl   = document.getElementById('sectorSelect');
  const stationBox = document.getElementById('stationDropdownList');
  // const selectedStationsLabel = document.getElementById('selectedStationsLabel'); // unused
  const statusSel  = document.getElementById('weaponStatusSelect');             // حالة السحب: got/not/both
  const harzNotesBtn = document.getElementById('filterHarzNotesBtn');
  const statusButtonsContainer = document.getElementById('weaponStatusButtons');
  const pageSizeEl = document.getElementById('pageSize');
  const prevBtn    = document.getElementById('prevPage');
  const nextBtn    = document.getElementById('nextPage');
  const pageInfoEl = document.getElementById('pageInfo');
  const deleteBtn  = document.getElementById('deleteRowsBtn');
  const bulkWithdrawBtn = document.getElementById('bulkWithdrawFilteredBtn');
  const filterStatusLabel = document.getElementById('filterStatusLabel');
  const withdrawnWeaponsSummary = document.getElementById('withdrawnWeaponsSummary');
  const notWithdrawnWeaponsSummary = document.getElementById('notWithdrawnWeaponsSummary');
  const overallWeaponsSummary = document.getElementById('overallWeaponsSummary');
  const licensesSummary = document.getElementById('licensesSummary');
  const weaponsTotalLabel = document.getElementById('weaponsTotalCount');
  const weaponsNotWithdrawnLabel = document.getElementById('weaponsNotWithdrawnCount');
  const weaponsOverallLabel = document.getElementById('weaponsOverallCount');
  const licensesCountLabel = document.getElementById('licensesCount');
  const stationInfoBtn = document.getElementById('stationInfoBtn');
  const stationInfoFrame = document.getElementById('stationInfoFrame');
  const stationInfoCloseBtn = document.getElementById('stationInfoCloseBtn');
  const stationInfoSubtitle = document.getElementById('stationInfoSubtitle');
  const stationInfoSectorFilter = document.getElementById('stationInfoSectorFilter');
  const stationInfoStationFilter = document.getElementById('stationInfoStationFilter');
  const stationInfoMeta = document.getElementById('stationInfoMeta');
  const stationInfoTableBody = document.getElementById('stationInfoTableBody');
  const notesEditModalEl = document.getElementById('notesEditModal');
  const notesEditTextareaEl = document.getElementById('notesEditTextarea');
  const notesEditMetaEl = document.getElementById('notesEditModalMeta');
  const notesEditCancelBtn = document.getElementById('notesEditCancel');
  const notesEditDiscardBtn = document.getElementById('notesEditDiscard');
  const notesEditSaveBtn = document.getElementById('notesEditSave');
  let activeNotesEdit = null;

  const STATUS_FILTER_VALUES = ['both', 'got', 'not'];
  const STATUS_LABELS = {
    both: 'الكل',
    got: 'الاسلحة المسحوبة',
    not: 'الاسلحة الغير مسحوبة'
  };
  const statusToggleButtons = statusButtonsContainer
    ? Array.from(statusButtonsContainer.querySelectorAll('.status-toggle-btn'))
    : [];
  const SEARCH_INPUT_DEBOUNCE_MS = 200;

  function normalizeStatusFilterValue(value) {
    return STATUS_FILTER_VALUES.includes(value) ? value : 'both';
  }

  function getCurrentStatusFilter() {
    return normalizeStatusFilterValue(statusSel ? statusSel.value : 'both');
  }

  function syncStatusToggleUI(activeValue) {
    if (!statusToggleButtons.length) return;
    const normalized = normalizeStatusFilterValue(activeValue);
    statusToggleButtons.forEach((btn) => {
      const btnValue = btn?.dataset?.value;
      btn.classList.toggle('is-active', btnValue === normalized);
    });
  }

  function setStatusFilter(value, options = {}) {
    if (!statusSel) return;
    const nextValue = normalizeStatusFilterValue(value);
    const prevValue = getCurrentStatusFilter();
    statusSel.value = nextValue;
    syncStatusToggleUI(nextValue);
    const shouldDispatch = !options.skipDispatch && (options.forceDispatch || prevValue !== nextValue);
    if (shouldDispatch) {
      const event = new Event('change', { bubbles: true });
      statusSel.dispatchEvent(event);
    }
  }

  function getStatusLabel(value) {
    return STATUS_LABELS[normalizeStatusFilterValue(value)] || STATUS_LABELS.both;
  }

  if (statusToggleButtons.length) {
    statusToggleButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const btnValue = btn?.dataset?.value;
        setStatusFilter(btnValue, { forceDispatch: true });
      });
    });
  }
  try { window.setWeaponStatusFilter = setStatusFilter; } catch (_) {}

  function setHarzNotesButtonState(active) {
    if (!harzNotesBtn) return;
    const on = !!active;
    harzNotesBtn.dataset.active = on ? '1' : '0';
    harzNotesBtn.style.background = on ? '#0f172a' : '#0ea5e9';
    harzNotesBtn.style.color = '#fff';
    harzNotesBtn.style.boxShadow = on ? '0 0 0 2px #0f172a44' : 'none';
  }

  function toggleHarzNotesFilter(forceState) {
    const next = typeof forceState === 'boolean' ? forceState : !window._filterNotesContainsHarz;
    if (next) {
      const notesIdx = getColIndex('ملاحظات', 'ملاحظة');
      if (notesIdx === -1) {
        showToast('لا يوجد عمود "ملاحظات" في الملف الحالي', 'error');
        setHarzNotesButtonState(false);
        window._filterNotesContainsHarz = false;
        return;
      }
    }
    window._filterNotesContainsHarz = next;
    setHarzNotesButtonState(next);
    try { updateFilterStatusLabel(); } catch (_) {}
    try { applyAllFilters(); } catch (_) {}
    const container = document.getElementById('csvPreviewContainer');
    if (container) {
      try { container.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) { container.scrollTop = 0; }
    }
    showToast(next ? 'تم عرض الصفوف التي تحتوي "حرز" في الملاحظات' : 'تم إلغاء فلتر "حرز"');
  }

  if (harzNotesBtn) {
    harzNotesBtn.addEventListener('click', () => toggleHarzNotesFilter());
    setHarzNotesButtonState(window._filterNotesContainsHarz);
  }
  try { window.toggleHarzNotesFilter = toggleHarzNotesFilter; } catch (_) {}

  function setPagerButtonState(btn, disabled) {
    if (!btn) return;
    if (disabled) {
      btn.dataset.lockDisabled = '1';
      btn.classList.add('pager-btn-disabled');
      btn.disabled = true;
    } else {
      delete btn.dataset.lockDisabled;
      btn.classList.remove('pager-btn-disabled');
      btn.disabled = false;
    }
  }

  const saveButtons = document.querySelectorAll('button[onclick="saveCSV()"], .btn-save');
  saveButtons.forEach((btn) => { if (btn) btn.setAttribute('type', 'button'); });
  [prevBtn, nextBtn, deleteBtn, bulkWithdrawBtn, stationInfoBtn].forEach((btn) => { if (btn) btn.setAttribute('type', 'button'); });
  [notesEditCancelBtn, notesEditDiscardBtn, notesEditSaveBtn].forEach((btn) => { if (btn) btn.setAttribute('type', 'button'); });
  if (notesEditCancelBtn) notesEditCancelBtn.addEventListener('click', closeNotesEditModal);
  if (notesEditDiscardBtn) notesEditDiscardBtn.addEventListener('click', closeNotesEditModal);
  if (notesEditSaveBtn) notesEditSaveBtn.addEventListener('click', commitNotesEditModal);
  if (notesEditModalEl) {
    notesEditModalEl.addEventListener('mousedown', (ev) => {
      if (ev.target === notesEditModalEl) closeNotesEditModal();
    });
  }
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && notesEditModalEl && notesEditModalEl.classList.contains('is-visible')) {
      ev.preventDefault();
      closeNotesEditModal();
    }
  });

  // Paging state
  let filteredIndex = [];
  let currentPage = 1;
  const defaultPageSize = 100;
  let csvDataReady = false;
  let initialCsvLoadPromise = null;
  let columnPresenceFilter = { col: null, mode: null };

  populateSectorFilterOptions(sectorEl);
  restrictSectorFilterToAssignedSectors(sectorEl);
  // Render cancel token: increments each render to stop older pumps
  let __renderEpoch = 0;
  function getPageSize() {
    const v = parseInt(pageSizeEl?.value || defaultPageSize, 10);
    return isNaN(v) ? defaultPageSize : Math.min(250, Math.max(1, v));
  }

  // Default dropdown = both (set in HTML); ensure value present + sync toggle buttons
  if (statusSel && !statusSel.value) statusSel.value = 'both';
  syncStatusToggleUI(getCurrentStatusFilter());

  // --- Weapons state cache (per-weapon UI metadata such as piece counters) ---
  const weaponsStateStore = (() => {
    const api = window.WeaponsStateStore;
    if (!api || typeof api.createStore !== 'function') {
      throw new Error('Weapons state store module is not loaded');
    }
    return api.createStore({ toLatinDigits });
  })();

  const weaponTextUtils = (() => {
    const api = window.WeaponsWeaponTextUtils;
    if (!api || typeof api.createApi !== 'function') {
      throw new Error('Weapons weapon text utils module is not loaded');
    }
    return api.createApi({ toLatinDigits, toArabicDigits });
  })();

  const pendingWeaponStateSaves = (() => {
    const existing = window.pendingWeaponStateSaves;
    if (existing instanceof Map) return existing;
    const created = new Map();
    try { window.pendingWeaponStateSaves = created; } catch (_) {}
    return created;
  })();

  // Tracks row-array references that have unsaved edits. Stores the actual
  // csvAll[i] array, not its index — so deletions/sorts that shift indices
  // can't desync the set. saveCSV later filters with csvAll.includes(row).
  const dirtyRowRefs = (() => {
    const existing = window.__weaponsDirtyRowRefs;
    if (existing instanceof Set) return existing;
    const created = new Set();
    try { window.__weaponsDirtyRowRefs = created; } catch (_) {}
    return created;
  })();

  function markRowDirty(rowIdx) {
    try {
      if (typeof rowIdx === 'number' && rowIdx >= 0 && Array.isArray(csvAll[rowIdx])) {
        dirtyRowRefs.add(csvAll[rowIdx]);
        try { senseChange(); } catch (_) {}
      }
    } catch (_) {}
  }

  function normalizeWeaponStateKeyPart(value) {
    return weaponsStateStore.normalizePart(value);
  }

  function buildLegacyWeaponStateKey(name, license) {
    return weaponsStateStore.buildLegacyKey(name, license);
  }

  function getWeaponsStateEntry(recordKey, name, license) {
    return weaponsStateStore.getEntry(recordKey, name, license);
  }

  function normalizeWeaponPiecesValue(value) {
    return weaponsStateStore.normalizePieces(value);
  }

  function normalizeWeaponKey(value) {
    return weaponTextUtils.normalizeWeaponKey(value);
  }

  function buildWeaponEntryKey(name, license, weaponName) {
    return weaponsStateStore.buildWeaponKey(name, license, weaponName);
  }

  function parseWeaponNames(raw) {
    return weaponTextUtils.parseWeaponNames(raw);
  }

  function stripWithdrawTag(text) {
    return weaponTextUtils.stripWithdrawTag(text);
  }

  function hasMeaningfulWeaponText(text) {
    return weaponTextUtils.hasMeaningfulWeaponText(text);
  }

  function splitWeaponSegments(raw) {
    return weaponTextUtils.splitWeaponSegments(raw);
  }

  function extractWeaponEntries(raw) {
    return weaponTextUtils.extractWeaponEntries(raw);
  }

  function buildWeaponDisplayText(entries) {
    return weaponTextUtils.buildWeaponDisplayText(entries);
  }

  function findWeaponInEntry(entry, weaponName) {
    return weaponTextUtils.findWeaponInEntry(entry, weaponName);
  }

  function weaponNamesEqual(a, b) {
    return normalizeWeaponKey(a) === normalizeWeaponKey(b);
  }

  function levenshteinDistance(a, b) {
    const s = String(a || '');
    const t = String(b || '');
    if (s === t) return 0;
    const m = s.length;
    const n = t.length;
    if (!m) return n;
    if (!n) return m;
    const v0 = new Array(n + 1);
    const v1 = new Array(n + 1);
    for (let i = 0; i <= n; i++) v0[i] = i;
    for (let i = 0; i < m; i++) {
      v1[0] = i + 1;
      for (let j = 0; j < n; j++) {
        const cost = s[i] === t[j] ? 0 : 1;
        v1[j + 1] = Math.min(
          v1[j] + 1,
          v0[j + 1] + 1,
          v0[j] + cost
        );
      }
      for (let j = 0; j <= n; j++) v0[j] = v1[j];
    }
    return v1[n];
  }

  function looksLikeWeaponRename(oldNorm, newNorm) {
    if (!oldNorm || !newNorm) return false;
    const oldLower = oldNorm.toLowerCase();
    const newLower = newNorm.toLowerCase();
    if (oldLower === newLower) return false;

    const digitsOnly = (str) => String(str || '').replace(/\s+/g, '');

    if (newLower.startsWith(oldLower)) {
      const suffix = digitsOnly(newLower.slice(oldLower.length));
      if (suffix && /^[0-9]+$/.test(suffix)) return true;
    }
    if (oldLower.startsWith(newLower)) {
      const suffix = digitsOnly(oldLower.slice(newLower.length));
      if (suffix && /^[0-9]+$/.test(suffix)) return true;
    }

    const stripDigits = (str) => str.replace(/[0-9]+/g, '');
    const baseOld = stripDigits(oldLower);
    const baseNew = stripDigits(newLower);
    if (baseOld && baseOld === baseNew && Math.abs(oldLower.length - newLower.length) <= 6) {
      return true;
    }

    return false;
  }

  function matchRenamedWeapons(removedItems, addedItems) {
    const pairs = [];
    const usedAdded = new Set();
    for (let i = 0; i < removedItems.length; i++) {
      const oldItem = removedItems[i];
      const oldNorm = normalizeWeaponKey(oldItem && oldItem.raw);
      if (!oldNorm) continue;
      let best = null;
      for (let j = 0; j < addedItems.length; j++) {
        if (usedAdded.has(j)) continue;
        const newItem = addedItems[j];
        const newNorm = normalizeWeaponKey(newItem && newItem.raw);
        if (!newNorm) continue;
        const maxLen = Math.max(oldNorm.length, newNorm.length);
        if (!maxLen) continue;
        const dist = levenshteinDistance(oldNorm, newNorm);
        const ratio = dist / maxLen;
        const renameBoost = looksLikeWeaponRename(oldNorm, newNorm);
        if (renameBoost || (dist <= 6 && ratio <= 0.35)) {
          const effectiveRatio = renameBoost ? 0 : ratio;
          if (!best || effectiveRatio < best.effectiveRatio || (effectiveRatio === best.effectiveRatio && dist < best.dist)) {
            best = { addedIndex: j, dist, ratio, effectiveRatio };
          }
        }
      }
      if (best) {
        usedAdded.add(best.addedIndex);
        pairs.push({ removedIndex: i, addedIndex: best.addedIndex });
      }
    }
    return pairs;
  }

  function getWeaponStateRecord(recordKey, name, license, weaponName) {
    return weaponsStateStore.getWeaponRecord(recordKey, name, license, weaponName);
  }

  function getStoredWeaponPieces(recordKey, name, license, weaponName) {
    if (!weaponName) return null;
    return weaponsStateStore.getWeaponPieces(recordKey, name, license, weaponName);
  }

  function getWeaponLabelForState(entry, index = 0) {
    const raw = entry && (entry.rawName || entry.cleanName || entry.displayLabel || entry.rawText);
    const clean = stripWithdrawTag(raw || '');
    if (hasMeaningfulWeaponText(clean)) return clean;
    return `سلاح ${index + 1}`;
  }

  function buildWeaponStateEntry({ recordKey, name, license, weapons }) {
    return {
      recordKey: String(recordKey || '').trim(),
      name: String(name || '').trim(),
      license: String(license || '').trim(),
      weapons: (Array.isArray(weapons) ? weapons : [])
        .map((weapon) => {
          const weaponName = String(weapon && weapon.name || '').trim();
          if (!weaponName) return null;
          const pieces = normalizeWeaponPiecesValue(weapon && weapon.pieces);
          const next = { name: weaponName };
          if (pieces != null) next.pieces = pieces;
          if (Object.prototype.hasOwnProperty.call(weapon || {}, 'withdrawn')) {
            next.withdrawn = !!weapon.withdrawn;
          }
          if (Object.prototype.hasOwnProperty.call(weapon || {}, 'depositNumber')) {
            next.depositNumber = String(weapon.depositNumber || '').trim();
          }
          if (Object.prototype.hasOwnProperty.call(weapon || {}, 'depositDate')) {
            next.depositDate = String(weapon.depositDate || '').trim();
          }
          return next;
        })
        .filter(Boolean),
      updatedAt: Date.now()
    };
  }

  function normalizePositiveInteger(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function getRecordIdForRow(origIdx) {
    const meta = getSqlRowMeta(origIdx);
    return normalizePositiveInteger(meta && meta.id);
  }

  function getServerRowIndexForRow(origIdx) {
    const meta = getSqlRowMeta(origIdx);
    const parsed = Number(meta && meta.rowIndex);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : origIdx;
  }

  function buildWeaponMutationTargetForRow(origIdx) {
    return {
      recordId: getRecordIdForRow(origIdx),
      rowIndex: getServerRowIndexForRow(origIdx),
      expectedUpdatedAt: getExpectedUpdatedAtForRow(origIdx)
    };
  }

  function computeWithdrawRecordKeyForRow(row, rowIdx) {
    try {
      const recordId = getRecordIdForRow(rowIdx);
      if (recordId != null) return `rec|v4|id=${recordId}`;
      const serverIndex = getServerRowIndexForRow(rowIdx);
      const stableIndex = (typeof serverIndex === 'number' && serverIndex >= 0) ? serverIndex : 'na';
      return `rec|v3|idx=${stableIndex}`;
    } catch (err) {
      console.warn('computeWithdrawRecordKeyForRow failed', err);
      return '';
    }
  }

  function getRowWithdrawRecordKey(origIdx) {
    if (typeof origIdx !== 'number' || origIdx < 0) return '';
    if (!Array.isArray(csvAll) || !csvAll[origIdx]) return '';
    const computed = computeWithdrawRecordKeyForRow(csvAll[origIdx], origIdx);
    csvRowWithdrawKeys[origIdx] = computed;
    return computed;
  }

  function getWeaponStateIdentityForRow(origIdx) {
    if (typeof origIdx !== 'number' || origIdx < 0) return;
    const row = csvAll[origIdx];
    if (!Array.isArray(row)) return null;
    const recordKey = getRowWithdrawRecordKey(origIdx);
    const nameIdx = getColIndex('الاسم');
    const licIdx = getColIndex('رقم', 'رقم القيد');
    const name = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
    const license = licIdx !== -1 ? String(row[licIdx] || '').trim() : '';
    return { row, recordKey, name, license, origIdx };
  }

  function getPendingWeaponStateKey(entry) {
    if (!entry) return '';
    if (entry.recordKey) return String(entry.recordKey).trim();
    const legacyKey = buildLegacyWeaponStateKey(entry.name, entry.license);
    if (legacyKey) return legacyKey;
    if (typeof entry.origIdx === 'number' && entry.origIdx >= 0) return `idx|${entry.origIdx}`;
    return `temp|${normalizeWeaponStateKeyPart(entry.name)}|${normalizeWeaponStateKeyPart(entry.license)}`;
  }

  function registerPendingWeaponStateEntry(entry) {
    if (!entry) return;
    const key = getPendingWeaponStateKey(entry);
    if (!key) return;
    pendingWeaponStateSaves.set(key, entry);
    try { window.pendingWeaponStateSaves = pendingWeaponStateSaves; } catch (_) {}
    senseChange();
  }

  function clearPendingWeaponStateEntry(entry) {
    const key = getPendingWeaponStateKey(entry);
    if (key) pendingWeaponStateSaves.delete(key);
    try { window.pendingWeaponStateSaves = pendingWeaponStateSaves; } catch (_) {}
    try { senseChange(); } catch (_) {}
  }

  function updatePendingEntryMetadataForRow(origIdx) {
    const identity = getWeaponStateIdentityForRow(origIdx);
    if (!identity) return;
    const existing = getWeaponsStateEntry(identity.recordKey, identity.name, identity.license);
    if (!existing || !Array.isArray(existing.weapons) || !existing.weapons.length) return;
    const next = buildWeaponStateEntry({
      ...identity,
      weapons: existing.weapons.map((weapon) => {
        const out = {
          name: String(weapon && weapon.name || '').trim(),
          pieces: normalizeWeaponPiecesValue(weapon && weapon.pieces)
        };
        if (weapon && Object.prototype.hasOwnProperty.call(weapon, 'withdrawn')) {
          out.withdrawn = !!weapon.withdrawn;
        }
        if (weapon && Object.prototype.hasOwnProperty.call(weapon, 'depositNumber')) {
          out.depositNumber = String(weapon.depositNumber || '').trim();
        }
        if (weapon && Object.prototype.hasOwnProperty.call(weapon, 'depositDate')) {
          out.depositDate = String(weapon.depositDate || '').trim();
        }
        return out;
      })
    });
    weaponsStateStore.upsertEntry(next);
    registerPendingWeaponStateEntry(next);
  }

  function createWeaponStateEntryForRow(origIdx, entries, counts) {
    const identity = getWeaponStateIdentityForRow(origIdx);
    if (!identity) return null;
    const weapons = (Array.isArray(entries) ? entries : [])
      .map((entry, index) => {
        const name = getWeaponLabelForState(entry, index);
        const pieces = normalizeWeaponPiecesValue(Array.isArray(counts) ? counts[index] : null) || 1;
        const weapon = { name, pieces };
        if (entry && Object.prototype.hasOwnProperty.call(entry, 'withdrawn')) {
          weapon.withdrawn = !!entry.withdrawn;
        }
        if (entry && Object.prototype.hasOwnProperty.call(entry, 'depositNumber')) {
          weapon.depositNumber = String(entry.depositNumber || '').trim();
        }
        if (entry && Object.prototype.hasOwnProperty.call(entry, 'depositDate')) {
          weapon.depositDate = String(entry.depositDate || '').trim();
        }
        return weapon;
      })
      .filter((weapon) => weapon.name);
    return buildWeaponStateEntry({ ...identity, weapons });
  }

  async function persistWeaponStateEntry(entry) {
    if (!entry) return null;
    const normalized = weaponsStateStore.upsertEntry(entry);
    registerPendingWeaponStateEntry(normalized || entry);
    try {
      const response = await fetch(buildWeaponsApiUrl('/api/weapon-state/set'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized || entry)
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json || json.ok === false) {
        throw new Error((json && json.message) || 'server');
      }
      if (json.entry) weaponsStateStore.upsertEntry(json.entry);
      clearPendingWeaponStateEntry(normalized || entry);
      await loadWeaponsState();
      return json.entry || normalized || entry;
    } catch (error) {
      console.warn('persistWeaponStateEntry failed', error);
      return null;
    }
  }
  try { window.__weaponsPersistWeaponStateEntry = persistWeaponStateEntry; } catch (_) {}

  function maybeQueueWeaponCellChange(origIdx, prevRaw, nextRaw) {
    if (typeof origIdx !== 'number' || origIdx < 0) return;
    const identity = getWeaponStateIdentityForRow(origIdx);
    if (!identity) return;
    const prevNames = parseWeaponNames(prevRaw).map(stripWithdrawTag).filter(hasMeaningfulWeaponText);
    const nextNames = parseWeaponNames(nextRaw).map(stripWithdrawTag).filter(hasMeaningfulWeaponText);
    if (!prevNames.length && !nextNames.length) return;

    const previousCounts = prevNames.map((name, index) => (
      getStoredWeaponPieces(identity.recordKey, identity.name, identity.license, name)
      || (index === prevNames.length - 1 ? Math.max(1, computeWeaponCountForRow(identity.row, getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح'), getColIndex('عدد القطع')) - Math.max(0, prevNames.length - 1)) : 1)
    ));
    const countByNorm = new Map();
    prevNames.forEach((name, index) => {
      const norm = normalizeWeaponKey(name);
      if (norm) countByNorm.set(norm, previousCounts[index] || 1);
    });

    const prevNorms = prevNames.map(normalizeWeaponKey);
    const nextNorms = nextNames.map(normalizeWeaponKey);
    const prevSet = new Set(prevNorms.filter(Boolean));
    const nextSet = new Set(nextNorms.filter(Boolean));
    const removedItems = [];
    prevNames.forEach((raw, idx) => {
      const norm = prevNorms[idx];
      if (norm && !nextSet.has(norm)) removedItems.push({ raw, norm, prevIndex: idx });
    });
    const addedItems = [];
    nextNames.forEach((raw, idx) => {
      const norm = nextNorms[idx];
      if (norm && !prevSet.has(norm)) addedItems.push({ raw, norm, newIndex: idx });
    });

    matchRenamedWeapons(removedItems, addedItems).forEach(({ removedIndex, addedIndex }) => {
      const removedItem = removedItems[removedIndex];
      const addedItem = addedItems[addedIndex];
      if (!removedItem || !addedItem) return;
      const count = countByNorm.get(removedItem.norm);
      if (count) countByNorm.set(addedItem.norm, count);
    });

    const nextWeapons = nextNames.map((name) => ({
      name,
      pieces: countByNorm.get(normalizeWeaponKey(name)) || getStoredWeaponPieces(identity.recordKey, identity.name, identity.license, name) || 1
    }));
    const entry = buildWeaponStateEntry({ ...identity, weapons: nextWeapons });
    weaponsStateStore.upsertEntry(entry);
    registerPendingWeaponStateEntry(entry);
    persistWeaponStateEntry(entry);
  }

  async function loadWeaponsState() {
    return weaponsStateStore.load({
      fetchImpl: typeof fetch === 'function' ? fetch.bind(window) : null,
      endpoint: buildWeaponsApiUrl('/api/weapon-state')
    });
  }
  try { window.__weaponsLoadState = loadWeaponsState; } catch (_) {}

  // Flag used when user requests: show only withdrawn rows that also have empty deposit fields
  window._filterWithdrawnRequireEmptyDeposit = false;
  // Flag used when user wants to view rows whose notes mention "حرز"
  window._filterNotesContainsHarz = false;

  // Programmatic helper: set status filter to 'got' and require empty deposit fields, then reapply filters.
  window.filterWithdrawnMissingDeposit = function() {
    try {
      setStatusFilter('got', { skipDispatch: true });
      window._filterWithdrawnRequireEmptyDeposit = true;
      try { updateFilterStatusLabel(); } catch(_) {}
      try { applyAllFilters(); } catch(_) {}
      // bring table into view (only scroll the table container)
      const c = document.getElementById('csvPreviewContainer'); if (c) { try { c.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) { c.scrollTop = 0; } }
    } catch (e) { console.warn('filterWithdrawnMissingDeposit error', e); }
  };

  function applyStatusFilterSummaryVisibility() {
    const filter = getCurrentStatusFilter();
    if (withdrawnWeaponsSummary) withdrawnWeaponsSummary.hidden = (filter === 'not');
    if (notWithdrawnWeaponsSummary) notWithdrawnWeaponsSummary.hidden = (filter === 'got');
  }

  function handleStatusFilterChange() {
    try { window._filterWithdrawnRequireEmptyDeposit = false; } catch(_) {}
    syncStatusToggleUI(getCurrentStatusFilter());
    applyStatusFilterSummaryVisibility();
  try { updateFilterStatusLabel(); } catch (error) {
    console.error('Error updating filter status label:', error);
  }
    try { applyAllFilters(); } catch(_) {}
  }

  if (statusSel) {
    statusSel.addEventListener('change', handleStatusFilterChange);
  }

  function updateFilterStatusLabel() {
    if (!filterStatusLabel) return;
    const v = getCurrentStatusFilter();
    let text;
    let color = '#555';
    if (v === 'got') {
      text = 'المحدد: تم سحبها فقط';
    } else if (v === 'not') {
      text = 'المحدد: لم يتم سحبها فقط';
    } else {
      text = 'الحالتان محددتان';
    }
    const focusLabel = window.__auditFocusLabel;
    if (focusLabel) {
      text += ' | فحص: ' + focusLabel;
      color = '#b91c1c';
    }
    if (window._filterNotesContainsHarz) {
      text += ' | ملاحظات تحتوي "حرز"';
      color = '#b91c1c';
    }
    const columnPresenceLabel = getColumnPresenceFilterLabel();
    if (columnPresenceLabel) {
      text += ' | ' + columnPresenceLabel;
      color = '#b91c1c';
    }
    filterStatusLabel.textContent = text;
    filterStatusLabel.style.color = color;
  }

  function setPagerCountLabel(el, value) {
    if (!el) return;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      el.textContent = '—';
      el.removeAttribute('data-count');
      return;
    }
    const pretty = toArabicDigits(value.toLocaleString('en-US'));
    el.textContent = pretty;
    el.setAttribute('data-count', String(value));
  }

  function setPagerSummaryState(summaryEl, valueEl, value) {
    const hasValue = typeof value === 'number' && Number.isFinite(value) && value > 0;
    setPagerCountLabel(valueEl, hasValue ? value : null);
    if (summaryEl) summaryEl.hidden = !hasValue;
  }

  function updateWeaponsSummaryLabels(stats) {
    if (!stats) {
      setPagerSummaryState(withdrawnWeaponsSummary, weaponsTotalLabel, null);
      setPagerSummaryState(notWithdrawnWeaponsSummary, weaponsNotWithdrawnLabel, null);
      setPagerSummaryState(overallWeaponsSummary, weaponsOverallLabel, null);
      applyStatusFilterSummaryVisibility();
      return;
    }
    setPagerSummaryState(withdrawnWeaponsSummary, weaponsTotalLabel, stats.withdrawn);
    setPagerSummaryState(notWithdrawnWeaponsSummary, weaponsNotWithdrawnLabel, stats.notWithdrawn);
    setPagerSummaryState(overallWeaponsSummary, weaponsOverallLabel, stats.total);
    applyStatusFilterSummaryVisibility();
  }

  function updateLicenseSummaryLabel(value) {
    setPagerSummaryState(licensesSummary, licensesCountLabel, value);
  }

  function buildUniqueLicenseKeyForRow(rowIdx, licenseIdx = getColIndex('رقم', 'رقم القيد'), nameIdx = getColIndex('الاسم')) {
    const row = csvAll[rowIdx] || [];
    if (licenseIdx === -1) return `row:${rowIdx}`;
    const license = normalizeDuplicateLicenseValue(row[licenseIdx]);
    const name = nameIdx !== -1 ? normalizeDuplicateNameValue(row[nameIdx]) : '';
    return license ? `license:${license}::${name}` : `missing-license:${rowIdx}`;
  }

  function computeUniqueLicenseCount(indices) {
    if (!Array.isArray(indices) || !indices.length) return 0;
    const licenseIdx = getColIndex('رقم', 'رقم القيد');
    const nameIdx = getColIndex('الاسم');
    if (licenseIdx === -1) return indices.length;
    const seen = new Set();
    for (const rowIdx of indices) {
      seen.add(buildUniqueLicenseKeyForRow(rowIdx, licenseIdx, nameIdx));
    }
    return seen.size;
  }

  function computeWeaponCountForRow(row, weaponsColIdx, piecesColIdx) {
    if (!Array.isArray(row)) return 0;
    let fromPieces = NaN;
    if (typeof piecesColIdx === 'number' && piecesColIdx >= 0) {
      fromPieces = normalizedPiecesValue(row[piecesColIdx]);
    }
    let fromWeapons = 0;
    if (typeof weaponsColIdx === 'number' && weaponsColIdx >= 0) {
      const raw = row[weaponsColIdx];
      if (raw != null) {
        const entries = extractWeaponEntries(raw);
        if (entries.length) {
          fromWeapons = entries.length;
        } else if (String(raw).trim()) {
          fromWeapons = 1;
        }
      }
    }
    let resolved = Number.isFinite(fromPieces) ? fromPieces : 0;
    if (!resolved && fromWeapons) {
      resolved = fromWeapons;
    } else if (resolved && fromWeapons && fromWeapons > resolved) {
      resolved = fromWeapons;
    }
    return (Number.isFinite(resolved) && resolved > 0) ? resolved : 0;
  }

  function computePiecesCountForStatus(row, weaponsColIdx, piecesColIdx, statusFilter, rowOrigIdx) {
    const counts = deriveWeaponCountsForRow(row, weaponsColIdx, piecesColIdx, rowOrigIdx);
    if (!counts) return 0;
    const normalizedStatus = normalizeStatusFilterValue(statusFilter || getCurrentStatusFilter());
    let value = 0;
    if (normalizedStatus === 'got') {
      value = Number.isFinite(counts.withdrawn) ? counts.withdrawn : 0;
    } else if (normalizedStatus === 'not') {
      value = Number.isFinite(counts.notWithdrawn) ? counts.notWithdrawn : 0;
    } else {
      value = Number.isFinite(counts.total) ? counts.total : 0;
    }
    return value > 0 ? value : 0;
  }

  function computeNotWithdrawnCountForRow(row, weaponsColIdx, piecesColIdx) {
    return computePiecesCountForStatus(row, weaponsColIdx, piecesColIdx, 'not');
  }

  function getWeaponEntriesForRow(row, weaponsColIdx, rowOrigIdx) {
    if (!Array.isArray(row) || typeof weaponsColIdx !== 'number' || weaponsColIdx < 0) return [];

    const statusIdx = getColIndex('حالة السحب');
    const normalizedStatus = statusIdx !== -1 ? normalizeWithdrawalStatusText(row[statusIdx]) : null;
    const identity = (typeof rowOrigIdx === 'number' && rowOrigIdx >= 0)
      ? getWeaponStateIdentityForRow(rowOrigIdx)
      : null;
    const storedEntry = identity
      ? weaponsStateStore.getEntry(identity.recordKey, identity.name, identity.license)
      : null;

    if (storedEntry && Array.isArray(storedEntry.weapons) && storedEntry.weapons.length) {
      return storedEntry.weapons.map((weapon, index) => {
        const cleanName = String(weapon && weapon.name || '').trim();
        let withdrawn = !!(weapon && weapon.withdrawn);
        if (normalizedStatus === 'got') withdrawn = true;
        if (normalizedStatus === 'not') withdrawn = false;
        return {
          index,
          rawText: cleanName,
          cleanName,
          withdrawn,
          depositNumber: String(weapon && weapon.depositNumber || '').trim(),
          depositDate: String(weapon && weapon.depositDate || '').trim()
        };
      });
    }

    // Fallback: SQL store hasn't loaded yet (boot) or row was just appended client-side
    const entries = extractWeaponEntries(row[weaponsColIdx]);
    if (!entries.length) return entries;
    return entries.map((entry) => {
      let withdrawn = !!entry.withdrawn;
      if (normalizedStatus === 'got') withdrawn = true;
      if (normalizedStatus === 'not') withdrawn = false;
      return { ...entry, withdrawn };
    });
  }

  function filterWeaponEntriesByStatus(entries, statusFilter) {
    const normalized = normalizeStatusFilterValue(statusFilter || 'both');
    if (!Array.isArray(entries) || !entries.length) return [];
    if (normalized === 'both') return entries.slice();
    if (normalized === 'got') return entries.filter((entry) => entry.withdrawn);
    if (normalized === 'not') return entries.filter((entry) => !entry.withdrawn);
    return entries.slice();
  }

  function resolveWeaponPieceCounts(row, entries, piecesColIdx, rowOrigIdx) {
    const source = Array.isArray(entries) ? entries : [];
    if (!source.length) return [];
    const counts = source.map(() => 1);
    const hasPersisted = source.map(() => false);
    let persistedTotal = 0;

    if (typeof rowOrigIdx === 'number' && rowOrigIdx >= 0) {
      const identity = getWeaponStateIdentityForRow(rowOrigIdx);
      if (identity) {
        source.forEach((entry, index) => {
          const weaponName = getWeaponLabelForState(entry, index);
          const stored = getStoredWeaponPieces(identity.recordKey, identity.name, identity.license, weaponName);
          if (stored != null) {
            counts[index] = stored;
            hasPersisted[index] = true;
            persistedTotal += stored;
          }
        });
      }
    }

    const baseTotal = computeWeaponCountForRow(row, getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح'), piecesColIdx);
    const currentTotal = counts.reduce((sum, value) => sum + (Number(value) || 0), 0);
    let extra = Math.max(0, baseTotal - currentTotal);
    if (extra > 0) {
      const emptyPersistedIndexes = hasPersisted
        .map((hasValue, index) => hasValue ? -1 : index)
        .filter((index) => index >= 0);
      const targetIndex = emptyPersistedIndexes.length
        ? emptyPersistedIndexes[emptyPersistedIndexes.length - 1]
        : source.length - 1;
      counts[targetIndex] += extra;
    }

    if (persistedTotal > 0) {
      return counts.map((value) => Math.max(1, Number(value) || 1));
    }
    return counts.map((value) => Math.max(1, Number(value) || 1));
  }

  function deriveWeaponCountsForRow(row, weaponsColIdx, piecesColIdx, rowOrigIdx) {
    const hasWeaponsColumn = typeof weaponsColIdx === 'number' && weaponsColIdx >= 0;
    const fallback = computeWeaponCountForRow(row, weaponsColIdx, piecesColIdx);
    const summaryDetails = (() => {
      try {
        return summarizeRowWeapons(row, rowOrigIdx);
      } catch (_) {
        return null;
      }
    })();
    const entries = summaryDetails && Array.isArray(summaryDetails.entries)
      ? summaryDetails.entries
      : (hasWeaponsColumn ? getWeaponEntriesForRow(row, weaponsColIdx, rowOrigIdx) : []);
    const summaryCode = summaryDetails?.summaryCode || 'unknown';
    const normalizedStatus = summaryDetails?.normalizedStatus || null;

    const pieceCounts = resolveWeaponPieceCounts(row, entries, piecesColIdx, rowOrigIdx);
    let withdrawn = 0;
    let notWithdrawn = 0;
    entries.forEach((entry, index) => {
      const pieces = Math.max(1, Number(pieceCounts[index]) || 1);
      if (entry.withdrawn) withdrawn += pieces;
      else notWithdrawn += pieces;
    });

    const hasStatusSignal = summaryCode === 'got' || summaryCode === 'not' || summaryCode === 'partial' || !!normalizedStatus;
    let baseTotal = Math.max(pieceCounts.reduce((sum, value) => sum + (Number(value) || 0), 0), entries.length, fallback);
    if (!entries.length && baseTotal === 0 && hasStatusSignal) {
      baseTotal = 1;
    }

    let remainder = Math.max(0, baseTotal - (withdrawn + notWithdrawn));

    if (!entries.length && fallback > 0) {
      remainder = baseTotal;
    }

    if (remainder > 0) {
      if (summaryCode === 'got' || normalizedStatus === 'got') {
        withdrawn += remainder;
      } else if (summaryCode === 'not' || normalizedStatus === 'not') {
        notWithdrawn += remainder;
      } else if (summaryCode === 'partial') {
        const extraForWithdrawn = Math.max(1, Math.floor(remainder / 2));
        withdrawn += extraForWithdrawn;
        notWithdrawn += remainder - extraForWithdrawn;
      } else {
        notWithdrawn += remainder;
      }
    }

    const total = Math.max(baseTotal, withdrawn + notWithdrawn);
    return { total, withdrawn, notWithdrawn };
  }

  function computeWeaponsStatsForFiltered(indices, weaponsColIdx, piecesColIdx) {
    const hasWeaponsColumn = typeof weaponsColIdx === 'number' && weaponsColIdx >= 0;
    const hasPiecesColumn = typeof piecesColIdx === 'number' && piecesColIdx >= 0;
    if (!hasWeaponsColumn && !hasPiecesColumn) return null;
    if (!Array.isArray(indices) || !indices.length) {
      return { total: 0, withdrawn: 0, notWithdrawn: 0 };
    }
    const totals = { total: 0, withdrawn: 0, notWithdrawn: 0 };
    for (let i = 0; i < indices.length; i++) {
      const row = csvAll[indices[i]] || [];
      const counts = deriveWeaponCountsForRow(row, weaponsColIdx, piecesColIdx, indices[i]);
      totals.total += counts.total;
      totals.withdrawn += counts.withdrawn;
      totals.notWithdrawn += counts.notWithdrawn;
    }
    return totals;
  }

  function normalizeStationSummaryName(value) {
    return normalizeStationDisplayName(value);
  }

  function compareStationSummaryNames(a, b) {
    return normalizeStationSummaryName(a).localeCompare(normalizeStationSummaryName(b), 'ar', { sensitivity: 'base' });
  }

  function computeStationFooterSummaries(indices, weaponsColIdx, piecesColIdx) {
    const stationIdx = getColIndex('القسم', 'القسم التابع');
    if (stationIdx === -1 || !Array.isArray(indices) || !indices.length) return [];

    const buckets = new Map();
    for (let i = 0; i < indices.length; i++) {
      const rowIdx = indices[i];
      const row = csvAll[rowIdx] || [];
      const station = normalizeStationSummaryName(row[stationIdx]);
      const counts = deriveWeaponCountsForRow(row, weaponsColIdx, piecesColIdx, rowIdx);
      if (!buckets.has(station)) {
        buckets.set(station, {
          station,
          totalRecords: 0,
          licenseKeys: new Set(),
          totalWeapons: 0,
          withdrawnWeapons: 0,
          notWithdrawnWeapons: 0
        });
      }
      const bucket = buckets.get(station);
      bucket.totalRecords += 1;
      bucket.licenseKeys.add(buildUniqueLicenseKeyForRow(rowIdx));
      bucket.totalWeapons += Math.max(0, Number(counts?.total) || 0);
      bucket.withdrawnWeapons += Math.max(0, Number(counts?.withdrawn) || 0);
      bucket.notWithdrawnWeapons += Math.max(0, Number(counts?.notWithdrawn) || 0);
    }

    return Array.from(buckets.values())
      .map((bucket) => ({
        ...bucket,
        totalRecords: bucket.licenseKeys instanceof Set ? bucket.licenseKeys.size : bucket.totalRecords
      }))
      .sort((left, right) => compareStationSummaryNames(left.station, right.station));
  }

  function formatStationInfoNumber(value) {
    const number = Math.max(0, Number(value) || 0);
    return toArabicDigits(number.toLocaleString('en-US'));
  }

  function getStationInfoBaseIndices() {
    return Array.from({ length: Array.isArray(csvAll) ? csvAll.length : 0 }, (_, index) => index);
  }

  function getStationInfoSectorKey() {
    return String(stationInfoSectorFilter?.value || '').trim();
  }

  function getStationInfoStationKey() {
    return String(stationInfoStationFilter?.value || '').trim();
  }

  function getRowSectorKeyForStationInfo(row, sectorIdx, stationIdx) {
    const rawSector = sectorIdx !== -1 ? row[sectorIdx] : '';
    return determineSectorKeyFromValue(rawSector)
      || (stationIdx !== -1 ? detectSectorKeyForStationName(row[stationIdx]) : null)
      || '';
  }

  function collectStationInfoSectorOptions(baseIndices) {
    const sectorIdx = getColIndex('القطاع');
    const stationIdx = getColIndex('القسم', 'القسم التابع');
    const seen = new Set();
    const options = [];

    if (Array.isArray(ALL_SECTOR_KEYS) && ALL_SECTOR_KEYS.length) {
      ALL_SECTOR_KEYS.forEach((key) => {
        if (!key || seen.has(key)) return;
        seen.add(key);
        options.push({ key, label: SECTOR_KEY_TO_LABEL[key] || key });
      });
    }

    if (!options.length) {
      (Array.isArray(baseIndices) ? baseIndices : []).forEach((rowIdx) => {
        const row = csvAll[rowIdx] || [];
        const key = getRowSectorKeyForStationInfo(row, sectorIdx, stationIdx);
        if (!key || seen.has(key)) return;
        seen.add(key);
        options.push({ key, label: SECTOR_KEY_TO_LABEL[key] || key });
      });
    }

    return options.sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), 'ar', { sensitivity: 'base' }));
  }

  function populateStationInfoSectorFilter(baseIndices = getStationInfoBaseIndices()) {
    if (!stationInfoSectorFilter) return;
    const previous = getStationInfoSectorKey();
    const options = collectStationInfoSectorOptions(baseIndices);
    stationInfoSectorFilter.innerHTML = '<option value="">كل القطاعات</option>' + options.map((option) => (
      `<option value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</option>`
    )).join('');
    stationInfoSectorFilter.value = options.some((option) => option.key === previous) ? previous : '';
  }

  function collectStationInfoStationOptions(baseIndices, sectorKey) {
    const seen = new Set();
    const options = [];

    const addStation = (station, effectiveSectorKey = '') => {
      const label = normalizeStationDisplayName(station, effectiveSectorKey);
      const key = normalizeStationComparisonKey(label, effectiveSectorKey);
      if (!label || !key || seen.has(key)) return;
      seen.add(key);
      options.push({ key, label });
    };

    if (sectorKey && Array.isArray(sectorStations[sectorKey])) {
      sectorStations[sectorKey].forEach((station) => addStation(station, sectorKey));
    } else if (!sectorKey && sectorStations && typeof sectorStations === 'object') {
      Object.entries(sectorStations).forEach(([entrySectorKey, stations]) => {
        if (!Array.isArray(stations)) return;
        stations.forEach((station) => addStation(station, entrySectorKey));
      });
    }

    if (!options.length) {
      const stationIdx = getColIndex('القسم', 'القسم التابع');
      if (stationIdx === -1) return [];
      const sectorIdx = getColIndex('القطاع');
      (Array.isArray(baseIndices) ? baseIndices : []).forEach((rowIdx) => {
        const row = csvAll[rowIdx] || [];
        const rowSectorKey = getRowSectorKeyForStationInfo(row, sectorIdx, stationIdx);
        if (sectorKey && rowSectorKey !== sectorKey) return;
        addStation(row[stationIdx], rowSectorKey || sectorKey);
      });
    }

    return options.sort((a, b) => compareStationSummaryNames(a.label, b.label));
  }

  function populateStationInfoStationFilter(baseIndices = getStationInfoBaseIndices()) {
    if (!stationInfoStationFilter) return;
    const previous = getStationInfoStationKey();
    const sectorKey = getStationInfoSectorKey();
    const options = collectStationInfoStationOptions(baseIndices, sectorKey);
    stationInfoStationFilter.innerHTML = '<option value="">كل الأقسام</option>' + options.map((option) => (
      `<option value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</option>`
    )).join('');
    stationInfoStationFilter.value = options.some((option) => option.key === previous) ? previous : '';
    stationInfoStationFilter.disabled = options.length === 0;
  }

  function syncStationInfoFilters() {
    const baseIndices = getStationInfoBaseIndices();
    populateStationInfoSectorFilter(baseIndices);
    populateStationInfoStationFilter(baseIndices);
  }

  function getStationInfoFilteredIndices() {
    const baseIndices = getStationInfoBaseIndices();
    const sectorKey = getStationInfoSectorKey();
    const stationKey = getStationInfoStationKey();
    if (!sectorKey && !stationKey) return baseIndices;

    const sectorIdx = getColIndex('القطاع');
    const stationIdx = getColIndex('القسم', 'القسم التابع');
    return baseIndices.filter((rowIdx) => {
      const row = csvAll[rowIdx] || [];
      const rowSectorKey = getRowSectorKeyForStationInfo(row, sectorIdx, stationIdx);
      if (sectorKey && rowSectorKey !== sectorKey) return false;
      if (stationKey) {
        if (stationIdx === -1) return false;
        const rowStationKey = normalizeStationComparisonKey(row[stationIdx], rowSectorKey || sectorKey);
        if (rowStationKey !== stationKey) return false;
      }
      return true;
    });
  }

  function buildStationInfoDisplaySummaries(dataSummaries, baseIndices) {
    const sectorKey = getStationInfoSectorKey();
    const stationKey = getStationInfoStationKey();
    const stationOptions = collectStationInfoStationOptions(baseIndices, sectorKey);
    const selectedOptions = stationKey
      ? stationOptions.filter((option) => option.key === stationKey)
      : stationOptions;
    const summariesByKey = new Map();

    (Array.isArray(dataSummaries) ? dataSummaries : []).forEach((summary) => {
      const key = normalizeStationComparisonKey(summary.station, sectorKey || detectSectorKeyForStationName(summary.station) || '');
      if (!key) return;
      summariesByKey.set(key, {
        station: normalizeStationSummaryName(summary.station),
        totalRecords: Math.max(0, Number(summary.totalRecords) || 0),
        totalWeapons: Math.max(0, Number(summary.totalWeapons) || 0),
        withdrawnWeapons: Math.max(0, Number(summary.withdrawnWeapons) || 0),
        notWithdrawnWeapons: Math.max(0, Number(summary.notWithdrawnWeapons) || 0)
      });
    });

    selectedOptions.forEach((option) => {
      if (!option?.key || summariesByKey.has(option.key)) return;
      summariesByKey.set(option.key, {
        station: option.label,
        totalRecords: 0,
        totalWeapons: 0,
        withdrawnWeapons: 0,
        notWithdrawnWeapons: 0
      });
    });

    return Array.from(summariesByKey.values())
      .sort((left, right) => compareStationSummaryNames(left.station, right.station));
  }

  function renderStationInfoEmpty(message) {
    if (stationInfoTableBody) {
      stationInfoTableBody.innerHTML = `<tr><td colspan="5" class="station-info-empty">${escapeHtml(message)}</td></tr>`;
    }
    if (stationInfoMeta) stationInfoMeta.innerHTML = '';
  }

  function renderStationInfoFrame() {
    const baseIndices = getStationInfoBaseIndices();
    const idxList = getStationInfoFilteredIndices();
    const weaponsColIdx = getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح');
    const piecesColIdx = getColIndex('عدد القطع');
    const stationIdx = getColIndex('القسم', 'القسم التابع');
    const dataSummaries = stationIdx !== -1
      ? computeStationFooterSummaries(idxList, weaponsColIdx, piecesColIdx)
      : [];
    const summaries = stationIdx !== -1
      ? buildStationInfoDisplaySummaries(dataSummaries, baseIndices)
      : [];
    const totals = computeWeaponsStatsForFiltered(idxList, weaponsColIdx, piecesColIdx)
      || dataSummaries.reduce((acc, summary) => {
        acc.total += Math.max(0, Number(summary.totalWeapons) || 0);
        acc.withdrawn += Math.max(0, Number(summary.withdrawnWeapons) || 0);
        acc.notWithdrawn += Math.max(0, Number(summary.notWithdrawnWeapons) || 0);
        return acc;
      }, { total: 0, withdrawn: 0, notWithdrawn: 0 });
    if (stationInfoSubtitle) {
      const sectorLabel = stationInfoSectorFilter?.selectedOptions?.[0]?.textContent?.trim() || '';
      const stationLabel = stationInfoStationFilter?.selectedOptions?.[0]?.textContent?.trim() || '';
      const parts = [];
      if (getStationInfoSectorKey() && sectorLabel) parts.push(sectorLabel);
      if (getStationInfoStationKey() && stationLabel) parts.push(stationLabel);
      stationInfoSubtitle.textContent = parts.length
        ? `ملخص حسب القسم - ${parts.join(' - ')}`
        : 'ملخص حسب القسم';
    }

    if (stationInfoMeta) {
      const chips = [
        ['عدد الأقسام', summaries.length],
        ['عدد الرخص', computeUniqueLicenseCount(idxList)],
        ['إجمالي الأسلحة', totals.total],
        ['المسحوبة', totals.withdrawn],
        ['الغير مسحوبة', totals.notWithdrawn]
      ];
      stationInfoMeta.innerHTML = chips.map(([label, value]) => (
        `<span class="station-info-chip">${escapeHtml(label)}: ${formatStationInfoNumber(value)}</span>`
      )).join('');
    }

    if (stationIdx === -1) {
      renderStationInfoEmpty('تعذر تحديد عمود القسم في البيانات الحالية');
      return;
    }
    if (!summaries.length) {
      renderStationInfoEmpty('لا توجد أقسام مطابقة للعرض');
      return;
    }

    const rowsHtml = summaries.map((summary) => `
      <tr>
        <td>${escapeHtml(summary.station)}</td>
        <td>${formatStationInfoNumber(summary.totalRecords)}</td>
        <td>${formatStationInfoNumber(summary.totalWeapons)}</td>
        <td>${formatStationInfoNumber(summary.withdrawnWeapons)}</td>
        <td>${formatStationInfoNumber(summary.notWithdrawnWeapons)}</td>
      </tr>
    `).join('');
    const totalRowHtml = `
      <tr class="station-info-total-row">
        <td>الإجمالي العام</td>
        <td>${formatStationInfoNumber(computeUniqueLicenseCount(idxList))}</td>
        <td>${formatStationInfoNumber(totals.total)}</td>
        <td>${formatStationInfoNumber(totals.withdrawn)}</td>
        <td>${formatStationInfoNumber(totals.notWithdrawn)}</td>
      </tr>
    `;
    if (stationInfoTableBody) stationInfoTableBody.innerHTML = rowsHtml + totalRowHtml;
  }

  function closeStationInfoFrame() {
    if (!stationInfoFrame) return;
    stationInfoFrame.classList.remove('is-visible');
    stationInfoFrame.setAttribute('aria-hidden', 'true');
  }

  function canUseStationInfoFrame() {
    try {
      const user = getPortalUserProfile();
      return String(user?.role || '').toLowerCase() === 'admin';
    } catch (_) {
      return false;
    }
  }

  function applyStationInfoAccess() {
    if (!stationInfoBtn) return;
    const allowed = canUseStationInfoFrame();
    stationInfoBtn.hidden = !allowed;
    stationInfoBtn.style.display = allowed ? '' : 'none';
    stationInfoBtn.setAttribute('aria-hidden', allowed ? 'false' : 'true');
    if (!allowed) closeStationInfoFrame();
  }

  function openStationInfoFrame() {
    if (!stationInfoFrame || !canUseStationInfoFrame()) return;
    syncStationInfoFilters();
    renderStationInfoFrame();
    stationInfoFrame.classList.add('is-visible');
    stationInfoFrame.setAttribute('aria-hidden', 'false');
  }

  applyStationInfoAccess();

  if (stationInfoBtn) {
    stationInfoBtn.addEventListener('click', openStationInfoFrame);
  }
  if (stationInfoCloseBtn) {
    stationInfoCloseBtn.addEventListener('click', closeStationInfoFrame);
  }
  if (stationInfoSectorFilter) {
    stationInfoSectorFilter.addEventListener('change', () => {
      populateStationInfoStationFilter(getStationInfoBaseIndices());
      renderStationInfoFrame();
    });
  }
  if (stationInfoStationFilter) {
    stationInfoStationFilter.addEventListener('change', renderStationInfoFrame);
  }
  if (stationInfoFrame) {
    stationInfoFrame.addEventListener('mousedown', (event) => {
      if (event.target === stationInfoFrame) closeStationInfoFrame();
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && stationInfoFrame?.classList.contains('is-visible')) {
      closeStationInfoFrame();
    }
  });
  try { window.openWeaponsStationInfo = openStationInfoFrame; } catch (_) {}

  function normalizedPiecesValue(raw) {
    if (raw == null) return NaN;
    const trimmed = String(raw).trim();
    if (!trimmed) return NaN;
    // Extremely long entries (usually misaligned cells with case numbers) are discarded.
    if (trimmed.length > 6) return NaN;
    const digits = sanitizeNumberText(trimmed);
    if (!digits) return NaN;
    const value = parseInt(digits, 10);
    if (!Number.isFinite(value) || value <= 0) return NaN;
    // A single record should never exceed 20 weapons; larger numbers are likely corrupted text.
    if (value > 20) return NaN;
    return value;
  }

  // Selection state (store global indices from csvAll)
  const selected = new Set();
  function selectedCount() { return selected.size; }
  function isSelected(origIdx) { return selected.has(origIdx); }
  function setSelected(origIdx, checked) {
    if (checked) selected.add(origIdx); else selected.delete(origIdx);
    updateDeleteButton();
  }
  function clearSelection() { selected.clear(); updateDeleteButton(); }
  function updateDeleteButton() {
    if (!deleteBtn) return;
    const n = selectedCount();
    deleteBtn.disabled = n === 0;
    deleteBtn.textContent = n === 0 ? '🗑️ حذف المحدد' : `🗑️ حذف المحدد (${n})`;
  }

  /******** parse ********/
  function parseCSV(text) {
    const rows = text.split(/\r?\n/).filter(r => r.trim().length);
    if (!rows.length) return { headers: [], data: [] };

    const data = rows.map(r =>
      r.split(SEP_RE).map(c => c.replace(/^\uFEFF?["']?|["']$/g, '').trim())
    );

    return { headers: data[0], data: data.slice(1) };
  }

  /******** sorting ********/
  function getSortState() {
    let state = window._csvSortState;
    if (!state || typeof state !== 'object') {
      state = { col: null, dir: 1, manual: false };
      window._csvSortState = state;
    }
    if (state.dir !== 1 && state.dir !== -1) state.dir = 1;
    if (typeof state.manual !== 'boolean') state.manual = false;
    if (state.col !== null && typeof state.col !== 'number') state.col = null;
    return state;
  }

  function normalizeColumnPresenceCellValue(value) {
    return String(value ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
  }

  function getColumnPresenceFilterLabel(filter = columnPresenceFilter) {
    if (!filter || typeof filter.col !== 'number' || !filter.mode) return '';
    const header = csvHeaders[filter.col] || 'العمود';
    const modeLabel = filter.mode === 'empty' ? 'الفارغ فقط' : 'الموجود فقط';
    return `${header}: ${modeLabel}`;
  }

  function isColumnPresenceFilterActive(colIdx, mode) {
    return columnPresenceFilter
      && columnPresenceFilter.col === colIdx
      && columnPresenceFilter.mode === mode;
  }

  function setColumnPresenceFilter(colIdx, mode) {
    const normalizedMode = mode === 'empty' || mode === 'valued' ? mode : null;
    if (typeof colIdx !== 'number' || colIdx < 0 || !normalizedMode) {
      columnPresenceFilter = { col: null, mode: null };
      return;
    }
    if (isColumnPresenceFilterActive(colIdx, normalizedMode)) {
      columnPresenceFilter = { col: null, mode: null };
      return;
    }
    columnPresenceFilter = { col: colIdx, mode: normalizedMode };
  }

  function rowPassesColumnPresenceFilter(row) {
    if (!columnPresenceFilter || typeof columnPresenceFilter.col !== 'number' || !columnPresenceFilter.mode) return true;
    const value = normalizeColumnPresenceCellValue(row?.[columnPresenceFilter.col]);
    const isEmpty = value.length === 0;
    return columnPresenceFilter.mode === 'empty' ? isEmpty : !isEmpty;
  }

  function normalizeDuplicateLicenseValue(value) {
    return toLatinDigits(String(value ?? '')).replace(/\s+/g, '').trim().toLowerCase();
  }

  function normalizeDuplicateNameValue(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function isDuplicateLicenseFocusActive() {
    return window.__auditFocusMode === 'duplicate-license'
      && window.__auditFocusLabel === 'فحص التكرار الرخصة';
  }

  function compareDuplicateLicenseRows(ia, ib) {
    const licenseIdx = getColIndex('رقم', 'رقم القيد');
    const nameIdx = getColIndex('الاسم');
    const rowA = csvAll[ia] || [];
    const rowB = csvAll[ib] || [];
    const licenseA = licenseIdx !== -1 ? normalizeDuplicateLicenseValue(rowA[licenseIdx]) : '';
    const licenseB = licenseIdx !== -1 ? normalizeDuplicateLicenseValue(rowB[licenseIdx]) : '';
    if (licenseA !== licenseB) {
      const numA = /^\d+$/.test(licenseA) ? Number(licenseA) : NaN;
      const numB = /^\d+$/.test(licenseB) ? Number(licenseB) : NaN;
      if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) return numA - numB;
      const licenseCompare = licenseA.localeCompare(licenseB, 'ar', { sensitivity: 'base', numeric: true });
      if (licenseCompare) return licenseCompare;
    }
    const nameA = nameIdx !== -1 ? normalizeDuplicateNameValue(rowA[nameIdx]) : '';
    const nameB = nameIdx !== -1 ? normalizeDuplicateNameValue(rowB[nameIdx]) : '';
    const nameCompare = nameA.localeCompare(nameB, 'ar', { sensitivity: 'base' });
    if (nameCompare) return nameCompare;
    return ia - ib;
  }

  function getDuplicateLicenseGroupKey(row) {
    const licenseIdx = getColIndex('رقم', 'رقم القيد');
    const nameIdx = getColIndex('الاسم');
    const license = licenseIdx !== -1 ? normalizeDuplicateLicenseValue(row && row[licenseIdx]) : '';
    const name = nameIdx !== -1 ? normalizeDuplicateNameValue(row && row[nameIdx]) : '';
    return license || name ? `${license}::${name}` : '';
  }

  function normalizeHeaderForDateMatch(header) {
    return String(header || '')
      .replace(/\uFEFF/g, '')
      .replace(/\u0640/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isDepositDateHeader(header) {
    const value = normalizeHeaderForDateMatch(header);
    return value === 'تاريخ الايداع' || value === 'تاريخ الإيداع';
  }

  function isCancelDecisionDateHeader(header) {
    const value = normalizeHeaderForDateMatch(header);
    return value === 'تاريخ قرار اللغاء'
      || value === 'تاريخ قرار الالغاء'
      || value === 'تاريخ قرار الإلغاء'
      || value === 'تاريخ اللغاء القرار'
      || value === 'تاريخ الغاء القرار'
      || value === 'تاريخ الالغاء القرار'
      || value === 'تاريخ إلغاء القرار';
  }

  function sortIndexMap(indexMap) {
    if (isDuplicateLicenseFocusActive()) {
      return indexMap.slice().sort(compareDuplicateLicenseRows);
    }
    const state = getSortState();
    if (state.col == null) return indexMap.slice();
    const colIdx = state.col;
    const hdr = csvHeaders[colIdx];
    const dir = state.dir || 1;
    const cmp = (ia, ib) => {
      const a = csvAll[ia][colIdx] ?? '';
      const b = csvAll[ib][colIdx] ?? '';
      if (hdr === 'رقم' || hdr === 'رقم القيد') {
        const na = parseInt(a, 10), nb = parseInt(b, 10);
        if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
        return a.toString().localeCompare(b.toString(), 'ar', { sensitivity: 'base' }) * dir;
      }
      const na = parseFloat(String(a).replace(/[^\d.-]/g, ''));
      const nb = parseFloat(String(b).replace(/[^\d.-]/g, ''));
      if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
      return String(a).localeCompare(String(b), 'ar', { sensitivity: 'base' }) * dir;
    };
    const arr = indexMap.slice();
    arr.sort(cmp);
    return arr;
  }

  /******** header renderer ********/
  // Small popup for choosing sort direction on header sort icon
  let __sortMenuEl = null; let __sortMenuOutsideHandler = null;
  function __ensureSortMenu() {
    if (__sortMenuEl) return __sortMenuEl;
    const el = document.createElement('div');
    el.id = 'sortMenuPopup';
    el.style.cssText = [
      'position:absolute','display:none','background:#fff','border:1px solid #bbb',
      'border-radius:8px','box-shadow:0 8px 24px rgba(0,0,0,0.18)','z-index:2000',
      'min-width:200px','padding:6px 0','font-family:inherit','font-size:1rem'
    ].join(';');
    document.body.appendChild(el);
    __sortMenuEl = el;
    return el;
  }
  function __hideSortMenu(){ if (__sortMenuEl) { __sortMenuEl.style.display='none'; __sortMenuEl.innerHTML=''; } if (__sortMenuOutsideHandler) { document.removeEventListener('click', __sortMenuOutsideHandler, true); __sortMenuOutsideHandler = null; } }
  function __showSortMenuFor(anchorEl, colIdx) {
    const el = __ensureSortMenu();
    el.innerHTML = '';
    const mkBtn = (label, dir) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = 'display:block;width:100%;text-align:right;background:none;border:none;padding:10px 16px;cursor:pointer;color:#111;';
      b.onmouseenter = () => b.style.background = '#f5f5f5';
      b.onmouseleave = () => b.style.background = 'transparent';
      b.onclick = (e) => {
        e.stopPropagation();
        __hideSortMenu();
        const state = getSortState();
        state.col = colIdx;
        state.dir = dir;
        state.manual = true;
        // Re-sort current filtered set and re-render
        filteredIndex = sortIndexMap(filteredIndex);
        renderPage();
      };
      return b;
    };
    const mkPresenceBtn = (label, mode) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = (isColumnPresenceFilterActive(colIdx, mode) ? '✓ ' : '') + label;
      b.style.cssText = 'display:block;width:100%;text-align:right;background:none;border:none;padding:10px 16px;cursor:pointer;color:#111;';
      b.onmouseenter = () => b.style.background = '#f5f5f5';
      b.onmouseleave = () => b.style.background = 'transparent';
      b.onclick = (e) => {
        e.stopPropagation();
        __hideSortMenu();
        setColumnPresenceFilter(colIdx, mode);
        try { updateFilterStatusLabel(); } catch (_) {}
        applyAllFilters();
      };
      return b;
    };
    el.appendChild(mkBtn('من الاسفل الي الاعلي', 1));   // Ascending
    el.appendChild(mkBtn('من الاعلي الي الاسفل', -1));  // Descending
    const divider = document.createElement('div');
    divider.style.cssText = 'height:1px;background:#e5e7eb;margin:6px 0;';
    el.appendChild(divider);
    el.appendChild(mkPresenceBtn('عرض الموجود فقط', 'valued'));
    el.appendChild(mkPresenceBtn('عرض الفارغ فقط', 'empty'));
    // Position near the icon, keep within viewport
    const r = anchorEl.getBoundingClientRect();
    const top = r.bottom + window.scrollY + 6;
    let left = r.left + window.scrollX; // align to icon's left in RTL
    el.style.display = 'block';
    // Clamp horizontally after measuring
    const vw = window.innerWidth; const mh = el.offsetHeight || 0; const mw = el.offsetWidth || 220;
    if (left + mw > vw - 8) left = Math.max(8, vw - mw - 8);
    el.style.top = top + 'px';
    el.style.left = left + 'px';
    // Hide on outside click
    __sortMenuOutsideHandler = (ev) => { if (!el.contains(ev.target)) __hideSortMenu(); };
    document.addEventListener('click', __sortMenuOutsideHandler, true);
  }
  function renderHeader() {
  const thead = document.querySelector('#csvPreview thead');
  thead.innerHTML = '';
  const state = getSortState();
  const tableColumnOrder = getTableColumnOrder();
    const headTr = document.createElement('tr');
    // Selection column (appears on the right in RTL when table is RTL)
    const selTh = document.createElement('th');
  selTh.style.width = '70px';
    selTh.style.textAlign = 'center';
    selTh.title = 'تحديد/إلغاء لكل الصفحة';
    const selAll = document.createElement('input');
    selAll.type = 'checkbox';
    selAll.id = 'selectAllPage';
    selAll.addEventListener('change', () => {
      const checks = document.querySelectorAll('#csvPreview tbody input.row-select');
      checks.forEach(cb => {
        cb.checked = selAll.checked;
        const idx = parseInt(cb.getAttribute('data-orig-idx'), 10);
        if (!isNaN(idx)) setSelected(idx, cb.checked);
      });
    });
  selTh.appendChild(selAll);
  // small label to indicate the serial column is shown in this cell
  const serLbl = document.createElement('div');
  serLbl.textContent = 'م';
  serLbl.style.fontSize = '.85em';
  serLbl.style.color = '#555';
  selTh.appendChild(serLbl);
    headTr.appendChild(selTh);
  // We'll render all existing headers, then append a last column 'حالة السحب'
  tableColumnOrder.forEach((i) => {
      const h = csvHeaders[i];
      const th = document.createElement('th');
    th.dataset.csvIndex = i;
      th.style.cursor = 'pointer';
      th.style.userSelect = 'none';
      th.style.position = 'relative';
      const arrow = (state.col === i ? (state.dir === 1 ? '▲' : '▼') : '⇅');
      // Build contents: text node + icon span
      const labelSpan = document.createElement('span');
      labelSpan.textContent = (h === 'ملاحظات') ? 'اجراءات' : h;
      const iconSpan = document.createElement('span');
      iconSpan.className = 'sort-arrow';
      iconSpan.textContent = ' ' + arrow;
      iconSpan.style.cssText = 'font-size:1em;position:absolute;left:8px;top:50%;transform:translateY(-50%);color:#60a5fa;cursor:pointer;';
      th.appendChild(labelSpan);
      th.appendChild(iconSpan);
      // Click on header text toggles as before (quick toggle)
      th.addEventListener('click', function() {
        if (state.col === i) state.dir *= -1; else { state.col = i; state.dir = 1; }
        state.manual = true;
        filteredIndex = sortIndexMap(filteredIndex);
        renderPage();
      });
      // Click on the sort icon opens choice popup
      iconSpan.addEventListener('click', function(ev){ ev.stopPropagation(); __showSortMenuFor(iconSpan, i); });
      th.addEventListener('contextmenu', function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        __showSortMenuFor(th, i);
      });
      headTr.appendChild(th);
    });
  // final status column (add class so CSS can target it directly)
  const stTh = document.createElement('th');
  stTh.className = 'col-status';
  stTh.textContent = 'حالة السحب'; stTh.style.cursor = 'default'; stTh.style.userSelect = 'none'; stTh.style.width = '120px';
  headTr.appendChild(stTh);
    thead.appendChild(headTr);
  }

  /******** align weapon-cell-line heights across wcl-multi cells in a row ********/
  function syncWclMultiHeights(tbody) {
    requestAnimationFrame(() => {
      try {
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(tr => {
          const multiCells = Array.from(tr.querySelectorAll('td.wcl-multi'));
          if (!multiCells.length) return;
          let maxCount = 0;
          multiCells.forEach(td => {
            const n = td.querySelectorAll('.weapon-cell-line').length;
            if (n > maxCount) maxCount = n;
          });
          multiCells.forEach(td => {
            td.querySelectorAll('.weapon-cell-line').forEach(line => { line.style.minHeight = ''; });
          });
          for (let i = 0; i < maxCount; i++) {
            let maxH = 0;
            multiCells.forEach(td => {
              const line = td.querySelectorAll('.weapon-cell-line')[i];
              if (line) { const h = line.getBoundingClientRect().height; if (h > maxH) maxH = h; }
            });
            if (maxH > 0) {
              multiCells.forEach(td => {
                const line = td.querySelectorAll('.weapon-cell-line')[i];
                if (line) line.style.minHeight = maxH + 'px';
              });
            }
          }
        });
      } catch (_) {}
    });
  }

  /******** body renderer (paged + chunked) ********/
  function renderPage(options = {}) {
    const preserveScroll = options?.preserveScroll !== false;
    const viewportState = preserveScroll ? snapshotScrollPosition() : null;
    const desiredTableScroll = typeof options.tableScrollTop === 'number'
      ? options.tableScrollTop
      : (viewportState ? viewportState.tableY : null);
    let viewportRestored = false;
    const scheduleViewportRestore = () => {
      if (!preserveScroll || !viewportState || viewportRestored) return;
      viewportRestored = true;
      requestAnimationFrame(() => restoreScrollPosition(viewportState));
    };
    const myEpoch = ++__renderEpoch; // cancel any in-flight pump
    renderHeader();
    const tbody = document.querySelector('#csvPreview tbody');
    tbody.innerHTML = '';
    if (preserveScroll && viewportState) {
      try { restoreScrollPosition(viewportState); } catch (_) {}
    }

    // Snapshot the current filtered indices so mid-render mutations don't affect this render
    const idxSnapshot = filteredIndex.slice();
    const nameColIdxGlobal = getColIndex('الاسم');
    const licenseColIdxGlobal = getColIndex('رقم', 'رقم القيد');
    const weaponsColIdxGlobal = getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح');
    const piecesColIdxGlobal = getColIndex('عدد القطع');
    const statusColIdxGlobal = getColIndex('حالة السحب');
    const tableColumnOrder = getTableColumnOrder();
    const displayedCsvColumnCount = tableColumnOrder.length;
    const totalRenderedColumns = 1 + displayedCsvColumnCount + 1;
    const total = idxSnapshot.length;
    const weaponsStatsForFiltered = computeWeaponsStatsForFiltered(idxSnapshot, weaponsColIdxGlobal, piecesColIdxGlobal);
    updateWeaponsSummaryLabels(weaponsStatsForFiltered);
    updateLicenseSummaryLabel(computeUniqueLicenseCount(idxSnapshot));
    const size  = getPageSize();
    const pages = Math.max(1, Math.ceil(total / size));
    if (currentPage > pages) currentPage = pages;
    const start = (currentPage - 1) * size;
    const end   = Math.min(start + size, total);

    // Update pager UI
    if (pageInfoEl) pageInfoEl.textContent = `الصفحة ${toArabicDigits(String(currentPage))} من ${toArabicDigits(String(pages))}`;
    setPagerButtonState(prevBtn, currentPage <= 1);
    setPagerButtonState(nextBtn, currentPage >= pages);

    // Name/license search: if no exact match but similar results exist, show a small label above the table
    (function handleSearchNoExactLabel(){
      const labelId = 'searchNoExactLabelSheet';
      let label = document.getElementById(labelId);
      const tableEl = document.getElementById('csvPreview');
      if (!label) {
        label = document.createElement('div');
        label.id = labelId;
        label.style.cssText = 'text-align:center;color:#b00;font-weight:700;font-size:1.05em;margin:6px 0;display:none;';
        if (tableEl && tableEl.parentNode) tableEl.parentNode.insertBefore(label, tableEl);
      }
      let showNoExact = false;
      const licInputRaw = (document.getElementById('licenseNumberFilter')?.value || '').trim();
      // Only show label for license exact search; never for name
      if (total > 0 && licInputRaw) {
        // normalize digit sets (Arabic-Indic <-> Latin) and whitespace before comparing
        const licInput = toLatinDigits(licInputRaw).replace(/\s+/g, '');
        const idxLic = getColIndex('رقم', 'رقم القيد');
        if (idxLic !== -1) {
          let exact = false;
          for (let k = 0; k < idxSnapshot.length; k++) {
            const oi = idxSnapshot[k];
            const v = (csvAll[oi][idxLic] ?? '').toString().trim();
            const vNorm = toLatinDigits(v).replace(/\s+/g, '');
            if (vNorm === licInput) { exact = true; break; }
          }
          if (!exact) showNoExact = true;
        }
      }
      label.style.display = showNoExact ? 'block' : 'none';
      label.textContent = showNoExact ? 'لا يوجد' : '';
    })();

    // If no data after filtering, show an inline row message and stop
    if (total === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = totalRenderedColumns;
      td.textContent = 'لا يوجد بيانات';
      td.style.textAlign = 'center';
      td.style.color = '#b00';
      td.style.fontWeight = '700';
      td.style.fontSize = '1.08em';
      tr.appendChild(td);
      tbody.appendChild(tr);
      // Update pager buttons for empty state
  setPagerButtonState(prevBtn, true);
  setPagerButtonState(nextBtn, true);
      scheduleViewportRestore();
      return;
    }

    const batch = Math.max(1, end - start); // render the current page in one pass
    let ptr = start;

    // ensure header select-all reflects current page selection once rendered
    const selAll = document.getElementById('selectAllPage');
    function refreshSelectAllForPage() {
      if (!selAll) return;
      let allOnPage = true;
      for (let k = start; k < end; k++) {
        const oi = filteredIndex[k];
        if (!isSelected(oi)) { allOnPage = false; break; }
      }
      selAll.checked = allOnPage && end > start; // only true when all visible are selected
      selAll.indeterminate = !selAll.checked && selectedCount() > 0; // visual cue
    }

    // Normal mode groups by station. Duplicate-license focus groups by license + name.
    const stationIdxGlobal = getColIndex('القسم', 'القسم التابع');
    const sectorIdxGlobal = getColIndex('القطاع');
    const duplicateLicenseFocus = isDuplicateLicenseFocusActive();
    const serials = new Array(filteredIndex.length);
    const isGroupStart = new Array(filteredIndex.length).fill(false);
    const isGroupEnd = new Array(filteredIndex.length).fill(false);
    const getRenderGroupKey = (rowIndex) => {
      const row = csvAll[rowIndex] || [];
      if (duplicateLicenseFocus) {
        return getDuplicateLicenseGroupKey(row) || `row-${rowIndex}`;
      }
      return stationIdxGlobal !== -1
        ? normalizeStationComparisonKey(
            row[stationIdxGlobal],
            sectorIdxGlobal !== -1 ? row[sectorIdxGlobal] : ''
          )
        : '';
    };
    let prevGroupKey = null; let counter = 0;
    for (let k = 0; k < idxSnapshot.length; k++) {
      const oi = idxSnapshot[k];
      const groupKey = getRenderGroupKey(oi);
      if (k === 0 || groupKey !== prevGroupKey) { counter = 1; isGroupStart[k] = (k !== 0); prevGroupKey = groupKey; }
      else { counter++; }
      serials[k] = counter;
    }
    // compute group ends
    for (let k = 0; k < idxSnapshot.length; k++) {
      const oi = idxSnapshot[k];
      const cur = getRenderGroupKey(oi);
      const next = (k + 1 < idxSnapshot.length) ? getRenderGroupKey(idxSnapshot[k + 1]) : null;
      if (k === idxSnapshot.length - 1 || cur !== next) isGroupEnd[k] = true;
    }

    function pump() {
      if (myEpoch !== __renderEpoch) return; // aborted by a newer render
      const limit = Math.min(ptr + batch, end);
      for (; ptr < limit; ptr++) {
        if (myEpoch !== __renderEpoch) return; // stop mid-batch if superseded
        const origIdx = idxSnapshot[ptr];
  const row = csvAll[origIdx] || [];
        const tr = document.createElement('tr');
        const piecesCountForStatus = computePiecesCountForStatus(
          row,
          weaponsColIdxGlobal,
          piecesColIdxGlobal,
          getCurrentStatusFilter(),
          origIdx
        );
        if (Number.isFinite(piecesCountForStatus)) {
          tr.dataset.computedPieces = String(piecesCountForStatus);
        } else {
          delete tr.dataset.computedPieces;
        }
        // Add thick separator when a new station starts (except at very top)
  if (isGroupStart[ptr]) { tr.style.borderTop = '4px solid #000'; }
  if (isGroupEnd[ptr])   { tr.style.borderBottom = '4px solid #000'; }
        // Select checkbox cell
        const selTd = document.createElement('td');
        selTd.style.textAlign = 'center';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'row-select';
        cb.setAttribute('data-orig-idx', String(origIdx));
        cb.checked = isSelected(origIdx);
        cb.addEventListener('change', () => setSelected(origIdx, cb.checked));
        // serial badge next to checkbox
  const serialSpan = document.createElement('div');
  serialSpan.textContent = toArabicDigits(String(serials[ptr] || ''));
        serialSpan.style.fontWeight = '700';
        serialSpan.style.fontSize = '0.95em';
        serialSpan.style.marginTop = '4px';
        selTd.appendChild(cb);
        selTd.appendChild(serialSpan);
        tr.appendChild(selTd);
        for (const ci of tableColumnOrder) {
          const td = document.createElement('td');
          td.dataset.csvIndex = String(ci);
          td.contentEditable = true;
          const isPiecesColumn = (piecesColIdxGlobal !== -1 && ci === piecesColIdxGlobal);
          const isWeaponsColumn = (weaponsColIdxGlobal !== -1 && ci === weaponsColIdxGlobal);
          const isStatusColumn = (statusColIdxGlobal !== -1 && ci === statusColIdxGlobal);
          const statusFilterForCell = getCurrentStatusFilter();
          const allWeaponEntriesForCell = isWeaponsColumn ? getWeaponEntriesForRow(row, weaponsColIdxGlobal, origIdx) : [];
          const weaponEntriesForCell = isWeaponsColumn
            ? filterWeaponEntriesByStatus(allWeaponEntriesForCell, statusFilterForCell)
            : [];
          const displaySourceValue = isPiecesColumn
            ? (Number.isFinite(piecesCountForStatus) ? piecesCountForStatus : '')
            : isWeaponsColumn
              ? ''
              : (row[ci] ?? '');
          // Display with Arabic-Indic digits for all numbers (visual only). Use <bdi> to isolate bidi ordering.
          {
            const headerForCellRender = csvHeaders[ci] || '';
            const normalizedHeaderForCell = String(headerForCellRender || '').trim();
            const isDepositNumberCellRender = (normalizedHeaderForCell === '\u0631\u0642\u0645 \u0627\u0644\u0627\u064a\u062f\u0627\u0639' || normalizedHeaderForCell === '\u0631\u0642\u0645 \u0627\u0644\u0625\u064a\u062f\u0627\u0639');
            const isDepositDateCellRender = isDepositDateHeader(normalizedHeaderForCell);
            const isMultiWeaponFieldCell = isDepositNumberCellRender || isDepositDateCellRender;
            if (isWeaponsColumn) {
              if (weaponEntriesForCell.length > 1) td.classList.add('wcl-multi');
              const html = weaponEntriesForCell.map((entry) => {
                const label = escapeHtml(toArabicDigits(entry.cleanName || ''));
                return `<div class="weapon-cell-line" data-weapon-index="${entry.index}">${label}</div>`;
              }).join('');
              td.innerHTML = html;
            } else if (isMultiWeaponFieldCell) {
              td.classList.add('td-deposit');
              const fieldKey = isDepositNumberCellRender ? 'depositNumber' : 'depositDate';
              if (weaponsColIdxGlobal !== -1) {
                const allDeposEntries = getWeaponEntriesForRow(row, weaponsColIdxGlobal, origIdx);
                const visDeposEntries = filterWeaponEntriesByStatus(allDeposEntries, statusFilterForCell);
                if (visDeposEntries.length > 1) {
                  td.classList.add('wcl-multi');
                  const html = visDeposEntries.map((entry) => {
                    const val = toArabicDigits(entry[fieldKey] || '');
                    const inner = val && /^[\u0660-\u06690-9/ .\-]+$/.test(val)
                      ? '<bdi style="direction:ltr; unicode-bidi:isolate">' + escapeHtml(val) + '</bdi>'
                      : escapeHtml(val);
                    return `<div class="weapon-cell-line">${inner}</div>`;
                  }).join('');
                  td.innerHTML = html;
                } else {
                  const rawFallback = String(displaySourceValue ?? '').trim();
                  const val = toArabicDigits(visDeposEntries[0]?.[fieldKey] || rawFallback);
                  if (val && /^[\u0660-\u06690-9/ .\-]+$/.test(val)) {
                    td.innerHTML = '<bdi style="direction:ltr; unicode-bidi:isolate">' + escapeHtml(val) + '</bdi>';
                  } else {
                    td.textContent = val;
                  }
                }
              } else {
                const rawValStr = String(displaySourceValue ?? '').trim();
                const parts = rawValStr
                  ? rawValStr.split(/[ \t]*\|[ \t]*|[ \t]*\+[ \t]*|\r?\n/).map((s) => s.trim()).filter(Boolean)
                  : [];
                if (parts.length > 1) {
                  const html = parts.map((part) => {
                    const display = toArabicDigits(part);
                    const inner = /^[\u0660-\u06690-9/ .\-]+$/.test(display)
                      ? '<bdi style="direction:ltr; unicode-bidi:isolate">' + escapeHtml(display) + '</bdi>'
                      : escapeHtml(display);
                    return `<div class="weapon-cell-line">${inner}</div>`;
                  }).join('');
                  td.innerHTML = html;
                } else {
                  const displaySingle = parts.length === 1 ? parts[0] : rawValStr;
                  const val = toArabicDigits(displaySingle);
                  if (/^[\u0660-\u06690-9/ .\-]+$/.test(val)) {
                    td.innerHTML = '<bdi style="direction:ltr; unicode-bidi:isolate">' + escapeHtml(val) + '</bdi>';
                  } else {
                    td.textContent = val;
                  }
                }
              }
            } else {
              const val = toArabicDigits(String(displaySourceValue ?? ''));
              if (/^[\u0660-\u06690-9/ .\-]+$/.test(val)) {
                td.innerHTML = '<bdi style="direction:ltr; unicode-bidi:isolate">' + escapeHtml(val) + '</bdi>';
              } else {
                td.textContent = val;
              }
            }
          }
          if (isPiecesColumn) {
            td.contentEditable = false;
            if (Number.isFinite(piecesCountForStatus)) {
              td.dataset.computedPieces = String(piecesCountForStatus);
            } else {
              delete td.dataset.computedPieces;
            }
          }
          if (isWeaponsColumn || isStatusColumn) {
            td.contentEditable = false;
          }
          if (isWeaponsColumn && allWeaponEntriesForCell.length) {
            td.dataset.weaponCount = String(allWeaponEntriesForCell.length);
            td.dataset.visibleWeaponCount = String(weaponEntriesForCell.length);
          } else {
            delete td.dataset.weaponCount;
            delete td.dataset.visibleWeaponCount;
          }
          td.style.userSelect = 'text';
          // Column input safeguards
          (function wireGuards(cell, colIndex){
            const header = csvHeaders[colIndex] || '';
            const normalizedHeader = String(header || '').trim();
            const isDepositCol = (normalizedHeader === 'رقم الايداع' || normalizedHeader === 'رقم الإيداع');
            const isDepositDateColumn = isDepositDateHeader(normalizedHeader);
            const isCancelDecisionDateColumn = isCancelDecisionDateHeader(normalizedHeader);
            const isSpecialDateColumn = isDepositDateColumn || isCancelDecisionDateColumn;
            const type = isSpecialDateColumn ? null : classifyHeaderType(header);
            const isComputedPiecesCell = (piecesColIdxGlobal !== -1 && colIndex === piecesColIdxGlobal);
            // Quick helpers for dropdown-enabled columns
            const isLicenseCol = ['نوع الرخصة', 'نوع الرخـصـة', 'نوع الترخيص'].includes(header);
            const isSectorCol = ['القطاع', 'نوع القاطع', 'القسم'].includes(header) || header === 'القطاع';
            const isStationCol = ['القسم التابع', 'القسم', 'القسم التابع', 'القسم التابع '].includes(header) || header === 'القسم التابع' || header === 'القسم';
            const isNoteColumn = isNotesHeader(normalizedHeader);
            const isMultiDateColumn = false;
            if (isDepositCol || isDepositDateColumn) {
              cell.contentEditable = false;
              cell.style.cursor = 'pointer';
              if (!cell.__depositEditorWired) {
                cell.__depositEditorWired = true;
                cell.addEventListener('click', (ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  openWeaponsPopupForRowCell(cell, origIdx);
                });
                cell.addEventListener('keydown', (ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    openWeaponsPopupForRowCell(cell, origIdx);
                  }
                });
              }
              return;
            }
            if (isNoteColumn) {
              renderNotesCellPreview(cell, csvAll[origIdx]?.[colIndex] ?? '');
              if (!cell.__notesEditorWired) {
                cell.__notesEditorWired = true;
                cell.addEventListener('click', (ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  openNotesEditModal(origIdx, colIndex, cell);
                });
                cell.addEventListener('keydown', (ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    openNotesEditModal(origIdx, colIndex, cell);
                  }
                });
              }
              return;
            }
            // Disable contentEditable for dropdown columns to prevent single-click editing
            if (isLicenseCol || isSectorCol || isStationCol || isComputedPiecesCell) {
              cell.contentEditable = false;
            }
            function makeSelect(options, current) {
              const sel = document.createElement('select');
              sel.style.minWidth = '120px';
              sel.style.fontFamily = 'inherit';
              sel.innerHTML = options.map(o => `<option value="${escapeHtml(String(o))}" ${String(o)===String(current)?'selected':''}>${escapeHtml(String(o))}</option>`).join('');
              return sel;
            }
            function commitSelectValue(sel, targetCell, colIdx) {
              try {
                const v = sel.value || '';
                const prevVal = csvAll[origIdx][colIdx] || '';
                targetCell.innerHTML = '<bdi style="direction:ltr; unicode-bidi:isolate">' + escapeHtml(v) + '</bdi>';
                csvAll[origIdx][colIdx] = v;
                targetCell.__lastGood = v;
                let changed = v !== prevVal;
                // If sector changed, clear station cell in the same row so user must reselect
                if (isSectorCol && v !== prevVal) {
                  const stIdx = getColIndex('القسم التابع', 'القسم', 'القسم التابع');
                  if (stIdx !== -1) {
                    csvAll[origIdx][stIdx] = '';
                    // If the row is currently in DOM, update that cell's content
                    try {
                      const rowTr = targetCell && targetCell.parentElement;
                      if (rowTr) {
                        const td = findRenderedCellByCsvIndex(rowTr, stIdx);
                        if (td) td.innerHTML = '';
                      }
                    } catch {}
                  }
                }
                if (changed) UnsavedGuard.markDirty();
              } catch (e) {}
            }
            // Prevent digit order reversal in RTL by forcing LTR on numeric/date-like cells
            if (type === 'number' || type === 'date' || isDepositCol || isSpecialDateColumn || isMultiDateColumn) {
              cell.style.direction = 'ltr';
              cell.style.unicodeBidi = 'isolate';
              if (isDepositCol || isSpecialDateColumn || isMultiDateColumn) cell.style.whiteSpace = 'pre-wrap';
            }
            cell.__lastGood = cell.textContent;
            // date auto-format control: only auto-insert slashes when user starts typing
            // into an empty date cell. If they edit an existing date, keep editing normal.
            try { cell.__autoDate = String((cell.__lastGood || '').trim()) === ''; } catch(e){ cell.__autoDate = true; }
            cell.addEventListener('focus', () => {
              try { cell.__autoDate = String((cell.textContent || '').trim()) === ''; } catch(e) { cell.__autoDate = true; }
              try {
                const colName = csvHeaders && csvHeaders[colIndex] ? String(csvHeaders[colIndex]).trim() : '';
                if (isMultiDateColumn) {
                  const editable = toLatinDigits(String(cell.innerText || cell.textContent || '').replace(/\r\n?/g, '\n'));
                  cell.textContent = editable;
                  cell.dataset.editable = editable;
                  cell.__lastValidMultiDate = editable;
                  cell.__autoDate = false;
                  delete cell.dataset.state;
                  requestAnimationFrame(() => {
                    try {
                      const tn = _getTextNode();
                      if (tn) {
                        const range = document.createRange();
                        const len = (tn.data || '').length;
                        range.setStart(tn, len);
                        range.collapse(true);
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                      }
                    } catch (_) {}
                  });
                  return;
                }
                if (isDepositCol) {
                  // On focus, strip formatting (<br>, Arabic digits) to plain Latin text with newlines.
                  const editable = toLatinDigits(String(cell.innerText || '').replace(/\r\n?/g, '\n'));
                  cell.textContent = editable;
                  cell.dataset.editable = editable;
                  cell.__autoDate = false;
                  delete cell.dataset.state;
                  // place caret at end after rewrite
                  requestAnimationFrame(() => {
                    try {
                      const tn = _getTextNode();
                      if (tn) {
                        const range = document.createRange();
                        const len = (tn.data || '').length;
                        range.setStart(tn, len);
                        range.collapse(true);
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                      }
                    } catch (_) {}
                  });
                  return;
                }
              } catch (e) {}
            });
            // If user clears the cell fully, enable auto-format for next typing
            cell.addEventListener('keyup', (ev) => {
              try { const latin = toLatinDigits(String(cell.textContent || '')).replace(/[^0-9]/g, ''); if (!latin) cell.__autoDate = true; } catch(e) {}
            });
            // Selection helpers (keep caret where the user edits)
            function _getTextNode(){
              let n = cell.firstChild;
              if (!n) return null;
              if (n.nodeType === Node.ELEMENT_NODE) n = n.firstChild;
              return (n && n.nodeType === Node.TEXT_NODE) ? n : null;
            }
            function _getSelOffsets(){
              const sel = window.getSelection();
              if (!sel || sel.rangeCount === 0) return null;
              const tn = _getTextNode();
              if (!tn) return null;
              const r = sel.getRangeAt(0);
              if (!cell.contains(r.startContainer) || !cell.contains(r.endContainer)) return null;
              const txt = tn.data || '';
              let s = (r.startContainer === tn) ? r.startOffset : txt.length;
              let e = (r.endContainer === tn) ? r.endOffset : txt.length;
              if (s > e) { const t = s; s = e; e = t; }
              return { start: s, end: e };
            }
            function _setSelOffsets(pos){
              try {
                if (!pos) return;
                const tn = _getTextNode();
                if (!tn) return;
                const sel = window.getSelection();
                const txtLen = (tn.data || '').length;
                const s = Math.max(0, Math.min(txtLen, pos.start));
                const e = Math.max(0, Math.min(txtLen, pos.end));
                const range = document.createRange();
                range.setStart(tn, s);
                range.setEnd(tn, e);
                sel.removeAllRanges();
                sel.addRange(range);
              } catch {}
            }
            const updateModel = () => {
              const prevValue = csvAll[origIdx][colIndex] ?? '';
              let nextValue = cell.textContent ?? '';
              if (!LIVE_CELL_FORMATTING) {
                nextValue = toLatinDigits(String(nextValue));
              }
              csvAll[origIdx][colIndex] = nextValue;
              cell.__lastGood = nextValue;
              if (String(nextValue) !== String(prevValue)) {
                UnsavedGuard.markDirty();
                markRowDirty(origIdx);
                if (weaponsColIdxGlobal !== -1 && colIndex === weaponsColIdxGlobal) {
                  maybeQueueWeaponCellChange(origIdx, prevValue, nextValue);
                }
                updatePendingEntryMetadataForRow(origIdx);
                if (isNoteColumn) {
                  scheduleModelNotesScan();
                }
              }
            };

            // For multi-line fields, make Enter behave like Shift+Enter (soft line break) to avoid
            // block-level splits that scramble caret order.
            if (isDepositCol || isSpecialDateColumn || isMultiDateColumn) {
              cell.addEventListener('keydown', (ev) => {
                try {
                  if (ev.key !== 'Enter') return;
                  ev.preventDefault();
                  ev.stopPropagation();
                  document.execCommand('insertText', false, '\n');
                } catch (_) {}
              });
            }

            cell.addEventListener('beforeinput', (e) => {
              if (isMultiDateColumn) {
                const t = e.inputType || '';
                if (t === 'insertParagraph' || t === 'insertLineBreak') {
                  try {
                    e.preventDefault();
                    document.execCommand('insertText', false, '\n');
                  } catch (_) {}
                  return;
                }
                if (t.startsWith('delete') || t === 'historyUndo' || t === 'historyRedo') return;
                const incoming = (e.data != null ? e.data : (e.clipboardData && e.clipboardData.getData && e.clipboardData.getData('text')) || '');
                if (incoming) {
                  if (containsLetterText(incoming)) {
                    e.preventDefault();
                    showCellWarning(cell, 'تواريخ فقط بدون حروف');
                    return;
                  }
                  if (sanitizeMultiDateTextForEdit(incoming) !== toLatinDigits(String(incoming || '').replace(/\r\n?/g, '\n'))) {
                    e.preventDefault();
                    showCellWarning(cell, 'تواريخ فقط');
                    return;
                  }
                }
              }
              if (!LIVE_CELL_FORMATTING) return;
              if (!type && !isDepositCol) return;
              const t = e.inputType || '';
              if (isDepositCol && (t === 'insertParagraph' || t === 'insertLineBreak')) {
                try {
                  e.preventDefault();
                  document.execCommand('insertText', false, '\n');
                } catch (_) {}
                return;
              }
              if (t.startsWith('delete') || t === 'historyUndo' || t === 'historyRedo') return;
              const data = (e.data != null ? e.data : (e.clipboardData && e.clipboardData.getData && e.clipboardData.getData('text')) || '');
              if (!data) return;
              // Special: when typing '/' in a date cell, if the character before the caret
              // is a single digit (e.g. '2/'), pad it to '02/' to match dd/mm/yyyy form.
              if (type === 'date' && data === '/') {
                try {
                  const sel = _getSelOffsets();
                  if (sel && typeof sel.start === 'number' && sel.start === sel.end) {
                    const tn = _getTextNode();
                    const txt = tn ? tn.data : (cell.textContent || '');
                    const caret = Math.max(0, Math.min(sel.start, txt.length));
                    // find contiguous digits immediately before caret
                    let j = caret - 1;
                    let run = 0;
                    while (j >= 0) {
                      const ch = toLatinDigits(txt[j]);
                      if (/\d/.test(ch)) { run++; j--; } else break;
                    }
                    if (run === 1) {
                      // insert '0' before the single digit and '/' after it
                      e.preventDefault();
                      const before = txt.slice(0, j+1);
                      const single = txt.slice(j+1, j+2);
                      const after = txt.slice(caret);
                      const inserted = '0' + single + '/';
                      const newText = before + inserted + after;
                      cell.innerHTML = '<bdi style="direction:ltr; unicode-bidi:isolate">' + escapeHtml(newText) + '</bdi>';
                      updateModel();
                      // place caret after the slash
                      requestAnimationFrame(() => _setSelOffsets({ start: before.length + inserted.length, end: before.length + inserted.length }));
                      return;
                    }
                  }
                } catch (e) { /* swallow */ }
              }
              if (type === 'number') { if (/[^0-9\u0660-\u0669]/.test(data)) { e.preventDefault(); showCellWarning(cell, 'أرقام فقط'); } }
              else if (type === 'date') { if (/[^0-9\u0660-\u0669/\.-]/.test(data)) { e.preventDefault(); showCellWarning(cell, 'تاريخ فقط'); } }
              else if (type === 'name') { if (/[0-9\u0660-\u0669]/.test(data)) { e.preventDefault(); showCellWarning(cell, 'حروف فقط'); } }
            });
            cell.addEventListener('paste', (e) => {
              if (isMultiDateColumn) {
                e.preventDefault();
                const text = (e.clipboardData && e.clipboardData.getData) ? e.clipboardData.getData('text') : '';
                const cleaned = sanitizeMultiDateTextForEdit(text);
                if (cleaned !== toLatinDigits(String(text || '').replace(/\r\n?/g, '\n'))) {
                  showCellWarning(cell, containsLetterText(text) ? 'تواريخ فقط بدون حروف' : 'تواريخ فقط');
                }
                document.execCommand('insertText', false, cleaned);
                return;
              }
              if (!LIVE_CELL_FORMATTING) return;
              if (!type && !isDepositCol) return;
              e.preventDefault();
              const text = (e.clipboardData && e.clipboardData.getData) ? e.clipboardData.getData('text') : '';
              let cleaned = text;
              if (type === 'number') cleaned = sanitizeNumberText(text);
              else if (type === 'date') cleaned = sanitizeDateText(text);
              else if (type === 'name') cleaned = String(text).replace(/[0-9\u0660-\u0669]/g, '');
              else if (isDepositCol) {
                cleaned = toLatinDigits(String(text || '')).replace(/\r\n?/g, '\n');
              }
              document.execCommand('insertText', false, cleaned);
            });
            
            cell.addEventListener('input', () => {
              if (!LIVE_CELL_FORMATTING && isMultiDateColumn) {
                cell.dataset.editable = toLatinDigits(String(cell.textContent || '').replace(/\r\n?/g, '\n'));
                updateModel();
                return;
              }
              if (!LIVE_CELL_FORMATTING) {
                updateModel();
                return;
              }
              const hadFocus = document.activeElement === cell;
              const prevSel = hadFocus ? _getSelOffsets() : null;
              let colName = csvHeaders && csvHeaders[colIndex] ? String(csvHeaders[colIndex]).trim() : '';

              // Special-case deposit number: avoid DOM rewrite to preserve caret; just mark dirty.
              if (isDepositCol) {
                const raw = String(cell.textContent || '');
                cell.dataset.editable = toLatinDigits(raw);
                updateModel();
                return;
                return;
              }

              if (type === 'date') {
                // Enforce maximum of 8 numeric digits for date fields (ddmmyyyy)
                const raw = toLatinDigits(String(cell.textContent || ''));
                const allDigits = raw.replace(/\D+/g, '');
                const allowedDigits = allDigits.slice(0, 8);

                // If nothing needs changing (no invalid chars and digits <= 8), do not rewrite the DOM.
                const sanitized = sanitizeDateText(raw);
                const needsTruncate = allDigits.length > 8;
                if (!needsTruncate && sanitized === raw) {
                  // No DOM rewrite: preserve caret as-is
                  updateModel();
                  return;
                }

                // Otherwise rebuild the visible text using allowed digits and original separators.
                let di = 0;
                let out = '';
                for (let i = 0; i < raw.length; i++) {
                  const ch = raw[i];
                  if (/\d/.test(ch)) {
                    if (di < allowedDigits.length) { out += allowedDigits[di++]; }
                    else { /* drop extra digits */ }
                  } else {
                    out += ch;
                  }
                }
                if (!out) out = allowedDigits;

                cell.innerHTML = '<bdi style="direction:ltr; unicode-bidi:isolate">' + escapeHtml(out) + '</bdi>';
                updateModel();
                // Try to keep caret near its previous digit-relative place
                requestAnimationFrame(() => {
                  try {
                    const prevDigits = (prevSel && typeof prevSel.start === 'number') ? (toLatinDigits(String(cell.textContent || '')).slice(0, prevSel.start).replace(/\D+/g, '').length) : 0;
                    let pos = 0, dcount = 0;
                    for (let i = 0; i < out.length; i++) {
                      if (/\d/.test(out[i])) dcount++;
                      pos++;
                      if (dcount >= prevDigits) break;
                    }
                    _setSelOffsets({ start: pos, end: pos });
                  } catch (e) {}
                });
              } else {
                // ...existing code...
                let val = cell.textContent;
                if (type === 'number') {
                  // Keep latin digits visible while editing to avoid cursor jumps.
                  const cleaned = sanitizeNumberText(val);
                  const display = toLatinDigits(cleaned);
                  cell.innerHTML = '<bdi style="direction:ltr; unicode-bidi:isolate">' + escapeHtml(display) + '</bdi>';
                  if (cleaned !== toLatinDigits(val)) showCellWarning(cell, 'أرقام فقط');
                  updateModel();
                } else if (type === 'name') {
                  if (containsAnyDigit(val)) { cell.textContent = String(val).replace(/[0-9\u0660-\u0669]/g, ''); showCellWarning(cell, 'حروف فقط'); }
                  else updateModel();
                } else {
                  // For general text columns, avoid wrapping whole cell in LTR while editing.
                  // Only replace Arabic-Indic digits with Latin digits in-place on the text node
                  if (/[0-9 -  ]/.test('')) { /* no-op placeholder to keep context */ }
                  try {
                    const tn = _getTextNode();
                    if (tn) {
                      const newText = toLatinDigits(String(tn.data || ''));
                      if (newText !== tn.data) tn.data = newText;
                    } else {
                      // fallback: operate on whole text content
                      const newText = toLatinDigits(String(cell.textContent || ''));
                      if (newText !== cell.textContent) cell.textContent = newText;
                    }
                  } catch (e) {
                    // silent
                  }
                  updateModel();
                }
              }
              if (hadFocus) {
                const tn = _getTextNode();
                const len = tn ? (tn.data || '').length : (cell.textContent||'').length;
                const fallback = { start: len, end: len };
                _setSelOffsets(prevSel || fallback);
              }
            });
            cell.addEventListener('blur', () => {
              if (!LIVE_CELL_FORMATTING && type !== 'date' && !isSpecialDateColumn && !isMultiDateColumn && !isNoteColumn) {
                updateModel();
                return;
              }
              let val = cell.textContent.trim();
              // colName resolution for blur
              let colName = csvHeaders && csvHeaders[colIndex] ? String(csvHeaders[colIndex]).trim() : '';

              // Special-case deposit number: display Arabic-Indic digits but keep LTR isolation to prevent digit reordering.
              if (isDepositCol) {
                const latin = toLatinDigits(String(val || '')).trim();
                cell.dataset.editable = latin;
                const ar = toArabicDigits(latin);
                const htmlVal = escapeHtml(ar).replace(/\n/g, '<br>');
                cell.innerHTML = '<bdi style="direction:ltr; unicode-bidi:isolate">' + htmlVal + '</bdi>';
                updateModel();
                return;
              }

              if (isSpecialDateColumn) {
                try {
                  const text = toLatinDigits(String(val || ''));
                  const replaced = normalizeDateFragmentsText(text);
                  cell.innerHTML = '<bdi style="direction:ltr; unicode-bidi:isolate">' + escapeHtml(toArabicDigits(replaced)).replace(/\n/g, '<br>') + '</bdi>';
                  updateModel();
                  return;
                } catch (_) {
                  updateModel();
                  return;
                }
              }

              if (isMultiDateColumn) {
                const normalized = normalizeMultiDateText(val);
                if (!normalized.ok) {
                  const previous = String(cell.__lastValidMultiDate || cell.dataset.editable || '').trim();
                  const fallback = previous ? toArabicDigits(previous) : '';
                  cell.textContent = fallback;
                  cell.classList.add('error');
                  showCellWarning(cell, normalized.message || 'صيغة التاريخ غير صحيحة');
                  setTimeout(() => cell.classList.remove('error'), 1400);
                  updateModel();
                  return;
                }
                cell.dataset.editable = normalized.value;
                cell.__lastValidMultiDate = normalized.value;
                const display = toArabicDigits(normalized.value);
                cell.innerHTML = '<bdi style="direction:ltr; unicode-bidi:isolate">' + escapeHtml(display) + '</bdi>';
                updateModel();
                return;
              }

              // If this is Notes column, normalize any dd/mm/yyyy or d/m/yyyy occurrences into yyyy/mm/dd
              if (/^ملاحظ/i.test(colName)) {
                try {
                  const text = toLatinDigits(String(val || ''));
                  const replaced = normalizeDateFragmentsText(text);
                  if (replaced !== text) {
                    // replace and set as the visible content (Arabic digits will be applied later by normal blur code)
                    cell.textContent = replaced;
                    val = replaced;
                  }
                } catch (e) { /* ignore */ }
              }
              if (type === 'number') {
                if (val && !/^\d+$/.test(toLatinDigits(val))) {
                  cell.textContent = cell.__lastGood || '';
                  showCellWarning(cell, 'أرقام فقط');
                } else {
                  const ar = toArabicDigits(val);
                  cell.innerHTML = '<bdi style="direction:ltr; unicode-bidi:isolate">' + escapeHtml(ar) + '</bdi>';
                  updateModel();
                }
              } else if (type === 'date') {
                if (colName === 'تاريخ الايداع' || colName === 'تاريخ الإيداع' || colName === 'تاريخ قرار اللغاء' || colName === 'تاريخ قرار الالغاء' || colName === 'تاريخ قرار الإلغاء') {
                  if (val) {
                    let v = toLatinDigits(val);
                    let digits = v.replace(/\D+/g, '').slice(0, 8);
                    if (digits.length === 8) {
                      let dd = digits.slice(0,2), mm = digits.slice(2,4), yyyy = digits.slice(4,8);
                      // Validate date
                      const d = new Date(Number(yyyy), Number(mm)-1, Number(dd));
                      if (d.getFullYear() == Number(yyyy) && d.getMonth() == Number(mm)-1 && d.getDate() == Number(dd)) {
                        const iso = `${yyyy}/${mm}/${dd}`;
                        cell.innerHTML = '<bdi style="direction:ltr; unicode-bidi:isolate">' + toArabicDigits(iso) + '</bdi>';
                        cell.dataset.editable = `${dd}/${mm}/${yyyy}`;
                        cell.dataset.state = 'converted';
                        updateModel();
                        return;
                      }
                    }
                    cell.classList.add('error');
                    showCellWarning(cell, 'صيغة التاريخ غير صحيحة');
                    setTimeout(()=> cell.classList.remove('error'), 1400);
                  }
                  updateModel();
                } else {
                  // ...existing code...
                  if (val) {
                    if (!isValidDateText(val)) {
                      cell.textContent = cell.__lastGood || '';
                      showCellWarning(cell, 'صيغة التاريخ غير صحيحة');
                    } else {
                      const rawLatin = toLatinDigits(val);
                      const d = (function(){ try { return _parseDateSmart(rawLatin); } catch(_) { return null; } })();
                      if (d) {
                        const formattedLatin = _formatYYYYMMDD(d);
                        const formattedArabic = toArabicDigits(formattedLatin);
                        cell.innerHTML = '<bdi style="direction:ltr; unicode-bidi:isolate">' + escapeHtml(formattedArabic) + '</bdi>';
                      } else {
                        const ar2 = toArabicDigits(val);
                        cell.innerHTML = '<bdi style="direction:ltr; unicode-bidi:isolate">' + escapeHtml(ar2) + '</bdi>';
                      }
                      updateModel();
                    }
                  } else {
                    updateModel();
                  }
                }
              } else if (type === 'name') {
                if (containsAnyDigit(val)) { cell.textContent = cell.__lastGood || ''; showCellWarning(cell, 'الاسم لا يحتوي أرقام'); }
                else { updateModel(); }
              } else {
                // For general text: convert digits to Arabic but keep text direction automatic so mixed
                // Arabic + Latin (e.g., '... HQ9B ...') remains readable.
                if (/[0-9 ]/.test(val)) {
                  const converted = toArabicDigits(val);
                  // Use dir=auto so browser chooses direction per segment instead of forcing LTR
                  cell.innerHTML = '<span dir="auto">' + escapeHtml(converted) + '</span>';
                  updateModel();
                }
                else updateModel();
              }
            });
            // Add dblclick listener for dropdown columns
            cell.addEventListener('dblclick', () => {
              if (isLicenseCol || isSectorCol || isStationCol) {
                // render a select in-place when double-clicked
                const current = toLatinDigits(String(cell.textContent || '')).replace(/^[\u0660-\u0669]/,'');
                let options = [];
                if (isLicenseCol) options = getLicenseTypesList();
                else if (isSectorCol) options = Object.values(SECTOR_KEY_TO_LABEL).slice();
                else if (isStationCol) {
                  // Determine sector from this row
                  const sectorIdx = getColIndex('القطاع');
                  const sectorVal = (sectorIdx !== -1) ? (csvAll[origIdx][sectorIdx] || '') : '';
                  const sectorKey = determineSectorKeyFromValue(sectorVal);
                  const allowedStations = sectorKey ? getAllowedStationsForSectorKey(sectorKey) : [];
                  options = allowedStations.slice();
                }
                // If no options, fallback to simple text edit
                if (!options || !options.length) return;
                // create select
                const sel = makeSelect(options, (cell.textContent || '').trim());
                cell.innerHTML = ''; cell.appendChild(sel);
                sel.focus();
                sel.addEventListener('change', () => { commitSelectValue(sel, cell, colIndex); });
                sel.addEventListener('blur', () => { commitSelectValue(sel, cell, colIndex); });
              }
            });
          })(td, ci);
          tr.appendChild(td);
        }
        // Compute overall status for this record based on withdraw cache
        const statusTd = document.createElement('td');
        statusTd.className = 'col-status';
        statusTd.style.textAlign = 'center';
        (function computeAndRenderRecordStatus(td, rowData, rowOrigIdx) {
          const statusMeta = getRowStatusDisplayMeta(rowData, rowOrigIdx);
          const el = document.createElement('div');
          el.style.display = 'inline-block';
          el.style.padding = '6px 10px';
          el.style.borderRadius = '12px';
          el.style.fontWeight = '700';
          el.style.color = '#fff';
          el.textContent = statusMeta.label;
          el.style.background = statusMeta.background;
          el.dataset.statusCode = statusMeta.code;
          el.style.cursor = 'pointer';
          el.addEventListener('click', (ev) => {
            try {
              ev.stopPropagation(); ev.preventDefault();
              const rowEl = td.closest('tr');
              const origIdxAttr = rowEl?.querySelector('input.row-select')?.getAttribute('data-orig-idx');
              const origIdxActual = origIdxAttr ? parseInt(origIdxAttr, 10) : null;
              const weaponsIdx = getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح');
              const weaponsCellEl = (weaponsIdx !== -1 && rowEl)
                ? findRenderedCellByCsvIndex(rowEl, weaponsIdx)
                : null;
              const cellForPopup = weaponsCellEl || td;
              openWeaponsPopupForRowCell(cellForPopup, origIdxActual);
            } catch (e) {
              console.warn('failed opening weapons popup from status pill', e);
            }
          });

          td.appendChild(el);
        })(statusTd, row, origIdx);

        // Row warning indicator (as an extension at end of record)
        (function attachRowWarningExtension(td, rowData, rowOrigIdx) {
          const problems = computeRowProblems(rowData, rowOrigIdx);
          if (!problems || problems.length === 0) return;

          td.style.position = 'relative';
          td.style.overflow = 'visible';

          const count = problems.length;
          let colorClass = 'warning-yellow';
          if (count >= 3) colorClass = 'warning-red';
          else if (count === 2) colorClass = 'warning-orange';

          const wrapper = document.createElement('div');
          wrapper.className = `row-warning-indicator ${colorClass}`;
          wrapper.innerHTML = '<span class="warning-icon">!</span>';
          wrapper.title = problems.map(p => '• ' + p).join('\n');
          wrapper.addEventListener('mouseenter', function() {
            showRowWarningTooltip(wrapper, problems);
          });
          wrapper.addEventListener('mouseleave', function() {
            hideRowWarningTooltip();
          });

          const anchor = document.createElement('div');
          anchor.className = 'row-warning-anchor';
          anchor.appendChild(wrapper);
          td.appendChild(anchor);
        })(statusTd, row, origIdx);

        tr.appendChild(statusTd);

        tbody.appendChild(tr);
      }
      if (ptr < end) {
        if (myEpoch !== __renderEpoch) return; // don't schedule further if outdated
        pump();
      } else {
        refreshSelectAllForPage();
        // After page render, wire weapons popup handlers for 'بيانات السلاح' cells
        try { wireWeaponsPopupForVisibleRows(); } catch (e) {}
        try { syncWclMultiHeights(tbody); } catch (_) {}
        try {
          document.dispatchEvent(new CustomEvent('weapons:table-rendered', {
            detail: {
              totalRows: Array.isArray(csvAll) ? csvAll.length : 0,
              visibleRows: end - start,
              page: currentPage
            }
          }));
        } catch (_) {}
        scheduleViewportRestore();
        if (typeof desiredTableScroll === 'number') {
          const container = document.getElementById('csvPreviewContainer');
          if (container) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                try { container.scrollTop = desiredTableScroll; } catch (_) {}
              });
            });
          }
        }
      }
    }
    pump();
  }

  try { window.renderWeaponsTable = renderPage; } catch (_) {}

  document.addEventListener('model:notes-scan', () => {
    if (!LIVE_CELL_FORMATTING) return;
    try {
      renderPage({ preserveScroll: true });
    } catch (err) {
      console.warn('Failed to refresh row warnings after model scan', err);
    }
  });

  document.addEventListener('model:settings-changed', () => {
    try {
      renderPage({ preserveScroll: true });
    } catch (err) {
      console.warn('Failed to refresh row warnings after settings change', err);
    }
  });

  /******** header helpers ********/
  function getColIndex(...names) {
    if (!Array.isArray(csvHeaders)) return -1;
    for (const n of names) {
      const i = csvHeaders.indexOf(n);
      if (i !== -1) return i;
      // Loose match fallback: ignore symbols/spaces
      const normN = (n || '').replace(/[\u0640\u200c\u200d\u200e\u200f\s]+/g, '').trim();
      for (let j = 0; j < csvHeaders.length; j++) {
        const header = (csvHeaders[j] || '').replace(/[\u0640\u200c\u200d\u200e\u200f\s]+/g, '').trim();
        if (header === normN) return j;
      }
    }
    return -1;
  }

  function normalizeWeaponSearchValue(value) {
    return toLatinDigits(String(value ?? ''))
      .replace(/\uFEFF/g, '')
      .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
      .replace(/[\u064b-\u065f\u0670]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/[هة]/g, 'ه')
      .replace(/[^0-9a-z\u0600-\u06FF]+/gi, '')
      .trim()
      .toLowerCase();
  }

  function updateWeaponSearchPlaceholder() {
    if (!searchEl || !searchColumnSel) return;
    const selectedOption = searchColumnSel.selectedOptions && searchColumnSel.selectedOptions[0];
    const selectedLabel = selectedOption ? selectedOption.textContent.trim() : '';
    searchEl.placeholder = searchColumnSel.value === '__all__'
      ? 'ابحث في كل الأعمدة'
      : `ابحث في ${selectedLabel || searchColumnSel.value}`;
  }

  function populateWeaponSearchColumns() {
    if (!searchColumnSel) return;
    const previous = searchColumnSel.value || '__all__';
    searchColumnSel.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = '__all__';
    allOption.textContent = 'كل الأعمدة';
    searchColumnSel.appendChild(allOption);
    if (Array.isArray(csvHeaders)) {
      csvHeaders.forEach((header, index) => {
        const label = String(header || '').trim();
        if (!label) return;
        const option = document.createElement('option');
        option.value = `col:${index}`;
        option.textContent = label;
        searchColumnSel.appendChild(option);
      });
    }
    searchColumnSel.value = Array.from(searchColumnSel.options).some((option) => option.value === previous)
      ? previous
      : '__all__';
    updateWeaponSearchPlaceholder();
  }

  function getSelectedSearchColumnIndex() {
    if (!searchColumnSel || searchColumnSel.value === '__all__') return null;
    const match = /^col:(\d+)$/.exec(searchColumnSel.value);
    if (!match) return null;
    const index = Number.parseInt(match[1], 10);
    return Number.isInteger(index) && index >= 0 && index < csvHeaders.length ? index : null;
  }

  function buildBaseColumnOrder(omitSet = new Set()) {
    const order = [];
    if (!Array.isArray(csvHeaders)) return order;
    for (let idx = 0; idx < csvHeaders.length; idx++) {
      if (omitSet.has(idx)) continue;
      order.push(idx);
    }
    return order;
  }

  function moveColumnsAfter(order, anchorIdx, movingIndices) {
    if (!Array.isArray(order) || !order.length || typeof anchorIdx !== 'number' || anchorIdx < 0) return order || [];
    const seen = new Set();
    const moving = [];
    (Array.isArray(movingIndices) ? movingIndices : []).forEach((idx) => {
      if (typeof idx !== 'number' || idx < 0 || !order.includes(idx) || seen.has(idx)) return;
      seen.add(idx);
      moving.push(idx);
    });
    if (!moving.length || !order.includes(anchorIdx) || moving.includes(anchorIdx)) return order.slice();
    const movingSet = new Set(moving);
    const withoutMoving = order.filter((idx) => !movingSet.has(idx));
    const anchorPos = withoutMoving.indexOf(anchorIdx);
    if (anchorPos === -1) return order.slice();
    withoutMoving.splice(anchorPos + 1, 0, ...moving);
    return withoutMoving;
  }

  function getTableColumnOrder() {
    const statusIdx = getColIndex('حالة السحب');
    const omitSet = new Set(statusIdx !== -1 ? [statusIdx] : []);
    const order = buildBaseColumnOrder(omitSet);
    const piecesIdx = getColIndex('عدد القطع');
    const weaponsIdx = getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح');
    return moveColumnsAfter(order, piecesIdx, [weaponsIdx]);
  }

  function getPrintColumnOrder(omitSet = new Set()) {
    const order = buildBaseColumnOrder(omitSet);
    const piecesIdx = getColIndex('عدد القطع');
    const weaponsIdx = getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح');
    const depositNumIdx = getColIndex('رقم الايداع', 'رقم الإيداع');
    const depositDateIdx = getColIndex('تاريخ الايداع', 'تاريخ الإيداع');
    const statusIdx = getColIndex('حالة السحب');
    const notesIdx = getColIndex('ملاحظات', 'ملاحظة');
    return moveColumnsAfter(order, piecesIdx, [weaponsIdx, depositNumIdx, depositDateIdx, statusIdx, notesIdx]);
  }

  function getPrintColumnWidthForHeader(header, renderedWidth) {
    const name = String(header || '').replace(/[\u0640\u200c\u200d\u200e\u200f\s]+/g, '').trim();
    if (name === 'الاسم') return 41;
    if (name === 'العنوان') return 41;
    if (name === 'تاريخقراراللغاء'
      || name === 'تاريخقرارالالغاء'
      || name === 'تاريخقرارالإلغاء'
      || name === 'تاريخاللغاءالقرار'
      || name === 'تاريخالغاءالقرار'
      || name === 'تاريخالالغاءالقرار'
      || name === 'تاريخإلغاءالقرار') return 22;
    if (name === 'بياناتالسلاح' || name === 'بيانالسلاح' || name === 'السلاح') return 46;
    if (name === 'رقمالايداع' || name === 'رقمالإيداع') return 18;
    if (name === 'تاريخالايداع' || name === 'تاريخالإيداع') return 28;
    if (name === 'حالةالسحب') return 16;
    if (name === 'ملاحظات' || name === 'ملاحظة') return 51;
    if (name === 'عددالقطع') return 7;
    const numeric = Number(renderedWidth);
    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.max(8, Math.min(64, Math.round(numeric / 7)));
    }
    return 20;
  }

  function readPrintColumnWidthsSnapshot(columnOrder) {
    const order = Array.isArray(columnOrder) ? columnOrder : [];
    const renderedWidths = new Map();
    try {
      document.querySelectorAll('#csvPreview thead th[data-csv-index]').forEach((th) => {
        const idx = Number(th.getAttribute('data-csv-index'));
        if (!Number.isInteger(idx) || idx < 0) return;
        const width = parseFloat(window.getComputedStyle(th).width) || 0;
        if (width > 0) renderedWidths.set(idx, width);
      });
    } catch (_) {}
    return [
      8,
      ...order.map((colIdx) => getPrintColumnWidthForHeader(csvHeaders[colIdx], renderedWidths.get(colIdx)))
    ];
  }
  const norm = v => (v ?? '').toString().trim();

  function findRenderedCellByCsvIndex(rowEl, csvIndex) {
    if (!rowEl || typeof csvIndex !== 'number' || csvIndex < 0) return null;
    return rowEl.querySelector(`td[data-csv-index="${csvIndex}"]`);
  }

  function updateRenderedCellValue(origIdx, csvIndex, nextValue) {
    try {
      if (typeof origIdx !== 'number' || origIdx < 0 || typeof csvIndex !== 'number' || csvIndex < 0) return;
      const checkbox = document.querySelector(`#csvPreview tbody input.row-select[data-orig-idx="${origIdx}"]`);
      if (!checkbox) return;
      const rowEl = checkbox.closest('tr');
      if (!rowEl) return;
      const cell = findRenderedCellByCsvIndex(rowEl, csvIndex);
      if (!cell) return;
      const rowData = Array.isArray(csvAll[origIdx]) ? csvAll[origIdx] : [];
      if (rowData && typeof nextValue !== 'undefined') {
        rowData[csvIndex] = nextValue;
      }
      const weaponsColIdx = getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح');
      const piecesColIdx = getColIndex('عدد القطع');
      const isWeaponsColumn = (weaponsColIdx !== -1 && weaponsColIdx === csvIndex);
      const isPiecesColumn = (piecesColIdx !== -1 && piecesColIdx === csvIndex);

      if (isWeaponsColumn) {
        const allEntries = getWeaponEntriesForRow(rowData, weaponsColIdx, origIdx);
        const statusFilterForCell = getCurrentStatusFilter();
        const entries = filterWeaponEntriesByStatus(allEntries, statusFilterForCell);
        const html = entries.map((entry) => {
          const label = escapeHtml(toArabicDigits(entry.cleanName || ''));
          return `<div class="weapon-cell-line" data-weapon-index="${entry.index}">${label}</div>`;
        }).join('');
        cell.innerHTML = html;
        if (allEntries.length) {
          cell.dataset.weaponCount = String(allEntries.length);
          cell.dataset.visibleWeaponCount = String(entries.length);
        } else {
          delete cell.dataset.weaponCount;
          delete cell.dataset.visibleWeaponCount;
        }
        cell.contentEditable = false;
        return;
      }

      if (isPiecesColumn) {
        const currentStatus = getCurrentStatusFilter();
        const resolvedCount = computePiecesCountForStatus(rowData, weaponsColIdx, piecesColIdx, currentStatus, origIdx);
        if (Number.isFinite(resolvedCount)) {
          cell.textContent = toArabicDigits(String(resolvedCount));
          cell.dataset.computedPieces = String(resolvedCount);
        } else {
          cell.textContent = '';
          delete cell.dataset.computedPieces;
        }
        cell.contentEditable = false;
        return;
      }

      if (isNotesHeader(csvHeaders[csvIndex] || '')) {
        renderNotesCellPreview(cell, rowData[csvIndex] ?? nextValue ?? '');
        return;
      }

      const headerForUpdate = String(csvHeaders[csvIndex] || '').trim();
      const isDepositNumberCellUpdate = (headerForUpdate === '\u0631\u0642\u0645 \u0627\u0644\u0627\u064a\u062f\u0627\u0639' || headerForUpdate === '\u0631\u0642\u0645 \u0627\u0644\u0625\u064a\u062f\u0627\u0639');
      const isDepositDateCellUpdate = isDepositDateHeader(headerForUpdate);
      if (isDepositNumberCellUpdate || isDepositDateCellUpdate) {
        const sourceVal = (typeof nextValue === 'string' ? nextValue : rowData[csvIndex]) ?? '';
        const rawValStr = String(sourceVal).trim();
        const statusFilterUpd = getCurrentStatusFilter();
        const weapColIdxUpd = getColIndex('\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0633\u0644\u0627\u062d', '\u0628\u064a\u0627\u0646 \u0627\u0644\u0633\u0644\u0627\u062d', '\u0627\u0644\u0633\u0644\u0627\u062d');
        let parts;
        if (statusFilterUpd !== 'both' && weapColIdxUpd !== -1) {
          const allEntUpd = getWeaponEntriesForRow(rowData, weapColIdxUpd, origIdx);
          const visEntUpd = filterWeaponEntriesByStatus(allEntUpd, statusFilterUpd);
          if (allEntUpd.length > 1 && visEntUpd.length < allEntUpd.length) {
            const plusParts = rawValStr
              ? rawValStr.split(/[ \t]*\|[ \t]*|[ \t]*\+[ \t]*|\r?\n/).map((s) => s.trim())
              : [];
            parts = visEntUpd.map((e) => plusParts[e.index] ?? '').filter(Boolean);
          }
        }
        if (!parts) {
          parts = rawValStr
            ? rawValStr.split(/[ \t]*\|[ \t]*|[ \t]*\+[ \t]*|\r?\n/).map((s) => s.trim()).filter(Boolean)
            : [];
        }
        if (parts.length > 1) {
          cell.innerHTML = parts.map((part) => {
            const display = toArabicDigits(part);
            const inner = /^[\u0660-\u06690-9/ .\-]+$/.test(display)
              ? '<bdi style="direction:ltr; unicode-bidi:isolate">' + escapeHtml(display) + '</bdi>'
              : escapeHtml(display);
            return `<div class="weapon-cell-line">${inner}</div>`;
          }).join('');
        } else {
          const displaySingle = parts.length === 1 ? parts[0] : rawValStr;
          const val = toArabicDigits(displaySingle);
          if (/^[\u0660-\u06690-9/ .\-]+$/.test(val)) {
            cell.innerHTML = '<bdi style="direction:ltr; unicode-bidi:isolate">' + escapeHtml(val) + '</bdi>';
          } else {
            cell.textContent = val;
          }
        }
        return;
      }

      const val = toArabicDigits(String((typeof nextValue === 'string' ? nextValue : rowData[csvIndex]) ?? ''));
      if (/^[\u0660-\u06690-9/ .\-]+$/.test(val)) {
        cell.innerHTML = '<bdi style="direction:ltr; unicode-bidi:isolate">' + escapeHtml(val) + '</bdi>';
      } else {
        cell.textContent = val;
      }
    } catch (err) {
      console.warn('updateRenderedCellValue failed', err);
    }
  }

  // === Input safeguard helpers (sheet.html) ===
  function classifyHeaderType(h) {
    h = String(h || '').trim();
    if (h === 'الاسم') return 'name';
  // Treat 'رقم الايداع' as free text (may contain letters/symbols), not numeric-only
  if (h === 'رقم' || h === 'رقم القيد' || h === 'عدد القطع') return 'number';
    if (/تاريخ/.test(h)) return 'date';
    return null;
  }
  function toLatinDigits(s) {
    return String(s)
      .replace(/[\u0660-\u0669]/g, ch => String(ch.charCodeAt(0) - 0x0660))
      .replace(/[\u06F0-\u06F9]/g, ch => String(ch.charCodeAt(0) - 0x06F0));
  }
  function toArabicDigits(s) { return String(s).replace(/[0-9]/g, d => String.fromCharCode(0x0660 + Number(d))); }
  try { window.toArabicDigits = toArabicDigits; } catch (_) {}
  function escapeHtml(s){
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }
  function isNotesHeader(header) {
    return /^ملاحظ/i.test(String(header || '').trim());
  }
  function renderNotesCellPreview(cell, value) {
    if (!cell) return;
    const raw = String(value ?? '');
    const preview = raw.replace(/\s+/g, ' ').trim();
    cell.classList.add('notes-cell');
    cell.contentEditable = false;
    cell.setAttribute('role', 'button');
    cell.setAttribute('tabindex', '0');
    cell.setAttribute('aria-label', 'تعديل الملاحظات');
    cell.title = preview || 'تعديل الملاحظات';
    const display = preview ? toArabicDigits(preview) : '—';
    const emptyClass = preview ? '' : ' is-empty';
    cell.innerHTML = `<span class="notes-cell-preview${emptyClass}">${escapeHtml(display)}</span>`;
  }
  function openNotesEditModal(origIdx, colIdx, sourceCell) {
    if (!notesEditModalEl || !notesEditTextareaEl) return;
    if (typeof origIdx !== 'number' || origIdx < 0 || !Array.isArray(csvAll[origIdx])) return;
    activeNotesEdit = { origIdx, colIdx, sourceCell: sourceCell || null };
    const row = csvAll[origIdx] || [];
    notesEditTextareaEl.value = String(row[colIdx] ?? '').replace(/\r\n?/g, '\n');
    if (notesEditMetaEl) {
      const nameIdx = getColIndex('الاسم');
      const licenseIdx = getColIndex('رقم', 'رقم القيد');
      const name = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
      const license = licenseIdx !== -1 ? String(row[licenseIdx] || '').trim() : '';
      const parts = [];
      if (name) parts.push(name);
      if (license) parts.push(`رقم القيد: ${toArabicDigits(license)}`);
      notesEditMetaEl.textContent = parts.join(' | ');
    }
    notesEditModalEl.classList.add('is-visible');
    notesEditModalEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('notes-edit-modal-open');
    requestAnimationFrame(() => {
      try {
        notesEditTextareaEl.focus();
        notesEditTextareaEl.setSelectionRange(notesEditTextareaEl.value.length, notesEditTextareaEl.value.length);
      } catch (_) {}
    });
  }
  function closeNotesEditModal() {
    if (!notesEditModalEl) return;
    notesEditModalEl.classList.remove('is-visible');
    notesEditModalEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('notes-edit-modal-open');
    activeNotesEdit = null;
  }
  function commitNotesEditModal() {
    if (!activeNotesEdit || !notesEditTextareaEl) return;
    const { origIdx, colIdx, sourceCell } = activeNotesEdit;
    const row = csvAll[origIdx];
    if (!Array.isArray(row)) return;
    const prevValue = String(row[colIdx] ?? '');
    let nextValue = String(notesEditTextareaEl.value || '').replace(/\r\n?/g, '\n').trim();
    try {
      nextValue = normalizeDateFragmentsText(toLatinDigits(nextValue));
    } catch (_) {
      nextValue = toLatinDigits(nextValue);
    }
    row[colIdx] = nextValue;
    if (sourceCell) renderNotesCellPreview(sourceCell, nextValue);
    if (String(nextValue) !== prevValue) {
      try { UnsavedGuard.markDirty(); } catch (_) {}
      try { markRowDirty(origIdx); } catch (_) {}
      updatePendingEntryMetadataForRow(origIdx);
      scheduleModelNotesScan();
      publishCsvGlobals();
    }
    closeNotesEditModal();
  }
  function sanitizeNumberText(s) { return toLatinDigits(String(s)).replace(/[^0-9]/g, ''); }
  function sanitizeDateText(s) { return toLatinDigits(String(s)).replace(/[^0-9/.-]/g, ''); }
  function containsLetterText(s) {
    const value = String(s || '');
    try {
      return /[\p{L}]/u.test(value);
    } catch (_) {
      return /[A-Za-z\u0621-\u064A]/.test(value);
    }
  }
  function sanitizeMultiDateTextForEdit(s) {
    const latin = toLatinDigits(String(s || '')).replace(/\r\n?/g, '\n');
    return latin.replace(/[^\d\/.\-\s,،;؛]/g, '');
  }
  function parseFlexibleDateToken(token) {
    const raw = toLatinDigits(String(token || '').trim());
    if (!raw) return null;
    const normalizeYear = (yearText) => {
      let year = String(yearText || '').trim();
      if (year.length === 2) year = Number(year) >= 50 ? `19${year}` : `20${year}`;
      return Number(year.padStart(4, '0'));
    };
    const makeDate = (year, month, day) => {
      const yyyy = Number(year);
      const mm = Number(month);
      const dd = Number(day);
      const date = new Date(yyyy, mm - 1, dd);
      if (date.getFullYear() !== yyyy || date.getMonth() !== mm - 1 || date.getDate() !== dd) return null;
      return `${String(yyyy).padStart(4, '0')}/${String(mm).padStart(2, '0')}/${String(dd).padStart(2, '0')}`;
    };
    let match = raw.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})$/);
    if (match) return makeDate(match[1], match[2], match[3]);
    match = raw.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2}|\d{4})$/);
    if (match) return makeDate(normalizeYear(match[3]), match[2], match[1]);
    const digits = raw.replace(/\D+/g, '');
    if (digits.length === 8) {
      const asYearFirst = makeDate(digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8));
      if (asYearFirst) return asYearFirst;
      return makeDate(digits.slice(4, 8), digits.slice(2, 4), digits.slice(0, 2));
    }
    return null;
  }
  function normalizeDateFragmentsText(raw) {
    return toLatinDigits(String(raw || '')).replace(
      /(\d{8}|\d{4}[\/\.-]\d{1,2}[\/\.-]\d{1,2}|\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/g,
      (match) => parseFlexibleDateToken(match) || match
    );
  }
  function normalizeMultiDateText(raw) {
    if (containsLetterText(raw)) {
      return { ok: false, message: 'تواريخ فقط بدون حروف' };
    }
    const editable = sanitizeMultiDateTextForEdit(raw).trim();
    if (!editable) return { ok: true, value: '' };
    const tokens = editable.split(/[\s,،;؛]+/).map((part) => part.trim()).filter(Boolean);
    if (!tokens.length) return { ok: true, value: '' };
    const normalized = [];
    for (const token of tokens) {
      const dateText = parseFlexibleDateToken(token);
      if (!dateText) {
        return { ok: false, message: 'صيغة التاريخ غير صحيحة' };
      }
      normalized.push(dateText);
    }
    return { ok: true, value: normalized.join('\n') };
  }
  function containsAnyDigit(s) { return /[0-9\u0660-\u0669]/.test(String(s)); }
  function isValidDateText(s) {
    const raw = toLatinDigits(String(s).trim());
    if (!raw) return false;
    let m = raw.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2}|\d{4})$/);
    if (m) {
      let dd = parseInt(m[1],10), MM = parseInt(m[2],10), yy = m[3];
      let yyyy = yy.length===2 ? (2000 + parseInt(yy,10)) : parseInt(yy,10);
      const d = new Date(yyyy, MM-1, dd);
      return d && d.getFullYear()===yyyy && d.getMonth()===MM-1 && d.getDate()===dd;
    }
    m = raw.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})$/);
    if (m) {
      let yyyy = parseInt(m[1],10), MM = parseInt(m[2],10), dd = parseInt(m[3],10);
      const d = new Date(yyyy, MM-1, dd);
      return d && d.getFullYear()===yyyy && d.getMonth()===MM-1 && d.getDate()===dd;
    }
    return false;
  }
  function showCellWarning(td, message) {
    try {
      td.style.outline = '2px solid #d00';
      td.style.outlineOffset = '-2px';
      const r = td.getBoundingClientRect();
      const tip = document.createElement('div');
      tip.textContent = message || 'إدخال غير صحيح';
      tip.style.cssText = 'position:fixed; z-index:3000; background:#d00; color:#fff; padding:6px 10px; border-radius:8px; font-size:.9em; box-shadow:0 4px 16px rgba(0,0,0,.2); pointer-events:none;';
      const arrow = document.createElement('div');
      arrow.style.cssText = 'position:absolute; bottom:-6px; right:12px; width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:6px solid #d00;';
      tip.appendChild(arrow);
      document.body.appendChild(tip);
      tip.style.top = Math.max(6, r.top - 30) + 'px';
      tip.style.left = Math.max(6, r.left + (r.width/2) - 60) + 'px';
      setTimeout(() => { try { tip.remove(); td.style.outline=''; } catch {} }, 1800);
    } catch {}
  }

    function normalizeWithdrawalStatusText(raw) {
      if (raw == null) return null;
      const text = String(raw).trim();
      if (!text) return null;
      const normalized = text.replace(/\s+/g, ' ').toLowerCase();
      const hasPartialWord = normalized.includes('جزئي')
        || normalized.includes('جزئى')
        || normalized.includes('سحب جزئي')
        || normalized.includes('مسحوب جزئي')
        || normalized.includes('partial');
      const hasWithdrawWord = normalized.includes('مسحوب') || normalized.includes('سحب') || normalized.includes('withdraw');
      const hasNegation = normalized.includes('غير') || normalized.includes('لم') || normalized.includes('ما ') || normalized.includes('not ');
      if (hasPartialWord) return 'partial';
      if (hasWithdrawWord && !hasNegation) return 'got';
      if (hasNegation && hasWithdrawWord) return 'not';
      if (normalized.includes('غير مسحوب') || normalized.includes('لم يتم السحب') || normalized.includes('لم تسحب') || normalized.includes('not withdrawn')) {
        return 'not';
      }
      return null;
    }

    function summarizeRowWeapons(row, rowOrigIdx) {
      const weaponsIdx = getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح');
      const entries = getWeaponEntriesForRow(row, weaponsIdx, rowOrigIdx);
      const statusIdx = getColIndex('حالة السحب');
      const rawStatus = statusIdx !== -1 ? String(row[statusIdx] || '').trim() : '';
      const normalizedStatus = normalizeWithdrawalStatusText(rawStatus);
      let withdrawnCount = entries.filter((entry) => entry.withdrawn).length;
      if (normalizedStatus === 'got' && entries.length && withdrawnCount === 0) {
        withdrawnCount = entries.length;
      }
      const summaryCode = (() => {
        if (!entries.length) {
          if (normalizedStatus === 'got') return 'got';
          if (normalizedStatus === 'partial') return 'partial';
          if (normalizedStatus === 'not') return 'not';
          return 'unknown';
        }
        if (withdrawnCount === entries.length) return 'got';
        if (withdrawnCount === 0) {
          if (normalizedStatus === 'got') return 'got';
          if (normalizedStatus === 'partial') return 'partial';
          return 'not';
        }
        return 'partial';
      })();
      return {
        entries,
        total: entries.length,
        withdrawnCount,
        summaryCode,
        rawStatus,
        normalizedStatus
      };
    }

    // got/not derived from per-weapon markers; partial indicates mixed state
    function rowStatus(row, rowOrigIdx) {
      try {
        return summarizeRowWeapons(row, rowOrigIdx).summaryCode;
      } catch (e) {
        return 'unknown';
      }
    }

    function getRowStatusDisplayMeta(row, rowOrigIdx) {
      let summaryInfo = null;
      let code = 'unknown';
      try {
        summaryInfo = summarizeRowWeapons(row, rowOrigIdx);
        if (summaryInfo && summaryInfo.summaryCode) {
          code = summaryInfo.summaryCode;
        } else {
          code = rowStatus(row, rowOrigIdx);
        }
      } catch (_) {
        code = rowStatus(row, rowOrigIdx);
      }
      if (code === 'unknown') {
        try {
          const weaponsIdx = getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح');
          const weaponDetails = weaponsIdx === -1 ? '' : String(row[weaponsIdx] || '').trim();
          if (weaponDetails) {
            code = 'not';
          }
        } catch (_) {
          /* swallow */
        }
      }
      if (code === 'got') {
        return { code, label: 'تم السحب', background: '#16a34a' };
      }
      if (code === 'partial') {
        let label = 'سحب جزئي';
        if (summaryInfo && summaryInfo.total > 0) {
          const numerator = toArabicDigits(summaryInfo.withdrawnCount);
          const denominator = toArabicDigits(summaryInfo.total);
          label += ` (${numerator}/${denominator})`;
        }
        return { code, label, background: '#f59e0b' };
      }
      if (code === 'not') {
        return { code, label: 'لم يتم السحب', background: '#dc2626' };
      }
      return { code: 'unknown', label: 'غير محدد', background: '#6b7280' };
    }
  // ...existing code...

  /******** filtering (returns index map) ********/
  function rowPassesStationRestrictions(rowIndex, guard, sectorIdx, stationIdx) {
    if (!guard || guard.isAdmin) return true;
    const row = csvAll[rowIndex] || [];

    let sectorKey = null;
    if (sectorIdx !== -1) {
      sectorKey = determineSectorKeyFromValue(row[sectorIdx]);
    }
    if (!sectorKey && stationIdx !== -1) {
      sectorKey = detectSectorKeyForStationName(row[stationIdx]);
    }

    if (sectorKey) {
      if (guard.allowedSectorSet.size && !guard.allowedSectorSet.has(sectorKey)) {
        return false;
      }
      const allowedSet = guard.allowedStationSets[sectorKey];
      if (allowedSet) {
        if (!allowedSet.size) {
          return false;
        }
        if (stationIdx !== -1) {
          const stationName = resolveStationNameForMatch(row[stationIdx], sectorKey);
          const stationKey = normalizeStationComparisonKey(stationName, sectorKey);
          if (stationName && (!stationKey || !allowedSet.has(stationKey))) {
            return false;
          }
        }
      }
      return true;
    }

    if (!guard.allowedSectorSet.size && !guard.unionAllowedStations.size) {
      return true;
    }

    if (stationIdx !== -1) {
      const stationName = resolveStationNameForMatch(row[stationIdx]);
      const stationKey = normalizeStationComparisonKey(stationName);
      if (!stationName) {
        return guard.unionAllowedStationKeys.size === 0;
      }
      if (guard.unionAllowedStationKeys.size) {
        return !!stationKey && guard.unionAllowedStationKeys.has(stationKey);
      }
    }

    return false;
  }

  function computeIndexMap() {
    // start with all row indices
    let idxs = Array.from({ length: csvAll.length }, (_, i) => i);

    const stationGuard = getStationRestrictionSnapshot();
    if (!stationGuard.isAdmin) {
      const sectorIdx = getColIndex('القطاع');
      const stationIdx = getColIndex('القسم', 'القسم التابع');
      idxs = idxs.filter((rowIndex) => rowPassesStationRestrictions(rowIndex, stationGuard, sectorIdx, stationIdx));
    }

    // search
    const q = normalizeWeaponSearchValue(searchEl?.value || '');
    if (q) {
      const selectedSearchColumnIndex = getSelectedSearchColumnIndex();
      idxs = idxs.filter(i => {
        const row = csvAll[i] || [];
        if (typeof selectedSearchColumnIndex === 'number') {
          return normalizeWeaponSearchValue(row[selectedSearchColumnIndex]).includes(q);
        }
        for (let c = 0; c < row.length; c++) {
          if (normalizeWeaponSearchValue(row[c]).includes(q)) return true;
        }
        return false;
      });
    }

    // sector
    const sectorText = sectorEl?.selectedOptions?.[0]?.textContent?.trim() || '';
    const sectorIdx  = getColIndex('القطاع');
    if (sectorIdx !== -1 && sectorEl && sectorEl.value) {
      const sectorVal = sectorText.split(' ').pop(); // e.g., "قطاع الشرق" → "الشرق"
      if (sectorVal) idxs = idxs.filter(i => (csvAll[i][sectorIdx] || '').includes(sectorVal));
    }

    // stations
    const stationIdx = getColIndex('القسم', 'القسم التابع');
    const chosenStations = Array
      .from(document.querySelectorAll('#stationDropdownList input[type=checkbox]:checked'))
      .map(cb => cb.value);
    if (stationIdx !== -1 && chosenStations.length) {
      const selectedSectorKey = sectorEl && sectorEl.value ? sectorEl.value : '';
      const chosenStationKeys = new Set(
        chosenStations
          .map((station) => normalizeStationComparisonKey(station, selectedSectorKey))
          .filter(Boolean)
      );
      idxs = idxs.filter((i) => {
        const rowSectorKey = sectorIdx !== -1 ? csvAll[i][sectorIdx] : selectedSectorKey;
        const rowStationKey = normalizeStationComparisonKey(csvAll[i][stationIdx], rowSectorKey);
        return !!rowStationKey && chosenStationKeys.has(rowStationKey);
      });
    }

    // weapon status dropdown (got/not/both)
    const statusVal = getCurrentStatusFilter();
    idxs = idxs.filter(i => {
      const st = rowStatus(csvAll[i], i);
      if (statusVal === 'got') return st === 'got' || st === 'partial';
      if (statusVal === 'not') return st === 'not' || st === 'partial' || st === 'unknown';
      return true; // both
    });

    // If the UI requested to show only withdrawn rows that also have empty deposit fields,
    // apply an extra filter here. This is triggered by window.filterWithdrawnMissingDeposit().
    try {
      if (window._filterWithdrawnRequireEmptyDeposit) {
        const depositDateIdx = getColIndex('تاريخ الايداع', 'تاريخ الإيداع');
        const depositNumIdx = getColIndex('رقم الايداع', 'رقم الإيداع');
        const notesIdx = getColIndex('ملاحظات', 'ملاحظة');
        idxs = idxs.filter(i => {
          const row = csvAll[i] || [];
          const dDate = (depositDateIdx !== -1) ? String(row[depositDateIdx] || '').trim() : '';
          const dNum = (depositNumIdx !== -1) ? String(row[depositNumIdx] || '').trim() : '';
          const notes = (notesIdx !== -1) ? String(row[notesIdx] || '').trim() : '';
          // keep rows that have ALL deposit fields empty
          return !dDate && !dNum && !notes;
        });
      }
    } catch (e) { /* swallow errors and continue */ }

    // license number filter (normalize digit sets before matching)
    const licenseNumRaw = document.getElementById('licenseNumberFilter')?.value?.trim();
    if (licenseNumRaw) {
      const licenseNum = toLatinDigits(licenseNumRaw).replace(/\s+/g, '');
      const numIdx = getColIndex('رقم', 'رقم القيد');
      if (numIdx !== -1) {
        idxs = idxs.filter(i => {
          // prefer precomputed normalized value; fall back to on-the-fly normalization
          const cellNorm = (Array.isArray(csvAllNormLicense) && csvAllNormLicense.length === csvAll.length)
            ? (csvAllNormLicense[i] || '')
            : toLatinDigits(String(csvAll[i][numIdx] || '')).replace(/\s+/g, '');
          return cellNorm.includes(licenseNum);
        });
      }
    }

    if (window._filterNotesContainsHarz) {
      const notesIdx = getColIndex('ملاحظات', 'ملاحظة');
      if (notesIdx !== -1) {
        idxs = idxs.filter(i => noteContainsWithdrawKeyword(csvAll[i][notesIdx] || ''));
      }
    }

    if (columnPresenceFilter && typeof columnPresenceFilter.col === 'number' && columnPresenceFilter.mode) {
      idxs = idxs.filter((i) => rowPassesColumnPresenceFilter(csvAll[i]));
    }

    const focus = window.__auditFocusSet;
    if (focus) {
      if (typeof focus.has === 'function') {
        idxs = idxs.filter(i => focus.has(i));
      } else if (Array.isArray(focus) && focus.length) {
        const tmp = new Set(focus);
        idxs = idxs.filter(i => tmp.has(i));
      }
    }

    // safety: ensure no duplicate global indices
    {
      const seen = new Set();
      idxs = idxs.filter(i => (seen.has(i) ? false : (seen.add(i), true)));
    }

    return idxs;
  }

  // Auto-pick an ascending sort column based on which filter is active
  function setAutoSortForActiveFilters() {
    const state = getSortState();
    if (state.manual) return;

    // Current filter states
    const anyStationChecked = !!document.querySelector('#stationDropdownList input[type=checkbox]:checked');
    const sectorActive = !!(sectorEl && sectorEl.value);
  const licenseVal = toLatinDigits((document.getElementById('licenseNumberFilter')?.value || '').trim()).replace(/\s+/g, '');
    const searchVal = (searchEl?.value || '').trim();
    const selectedSearchColumnIndex = getSelectedSearchColumnIndex();
  const statusVal = getCurrentStatusFilter();

    // Candidate columns
    const idxStation = getColIndex('القسم', 'القسم التابع');
    const idxSector  = getColIndex('القطاع');
    const idxName    = getColIndex('الاسم');
    const idxLic     = getColIndex('رقم', 'رقم القيد');
    const idxDate    = getColIndex('تاريخ الايداع', 'تاريخ الإيداع');
    const idxNumDep  = getColIndex('رقم الايداع', 'رقم الإيداع');
    const idxNotes   = getColIndex('ملاحظات');

    // Priority when multiple filters are active:
    // 1) Station
    // 2) Sector
    // 3) License number
    // 4) Search (name)
  // (Status filter intentionally does not affect sorting)
    let targetCol = null;
    if (anyStationChecked && idxStation !== -1) targetCol = idxStation;
  // When sector is chosen, sort by Station (because sector is only used to choose stations)
  else if (sectorActive && (idxStation !== -1 || idxSector !== -1)) targetCol = (idxStation !== -1 ? idxStation : idxSector);
    else if (licenseVal && idxLic !== -1) targetCol = idxLic;
    else if (searchVal && typeof selectedSearchColumnIndex === 'number') targetCol = selectedSearchColumnIndex;
  else if (searchVal && idxName !== -1) targetCol = idxName;

    if (typeof targetCol === 'number' && targetCol !== null) {
      state.col = targetCol;
      state.dir = 1; // ascending
      state.manual = false;
    }
  }

  // ===== Filter History / Undo System =====
  const FILTER_HISTORY_MAX = 20;
  let filterHistory = [];
  let filterHistoryPointer = -1;
  let isRestoringFilter = false;

  function captureFilterState() {
    const searchInput = document.getElementById('filterInput');
    const licenseInput = document.getElementById('licenseNumberFilter');
    const checkedStations = stationBox ? Array.from(stationBox.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value) : [];
    return {
      search: searchInput ? searchInput.value : '',
      searchColumn: searchColumnSel ? searchColumnSel.value : '__all__',
      license: licenseInput ? licenseInput.value : '',
      sector: sectorEl ? sectorEl.value : '',
      stations: checkedStations,
      status: getCurrentStatusFilter(),
      harzFilter: !!window._filterNotesContainsHarz,
      columnPresence: { ...columnPresenceFilter },
      timestamp: Date.now()
    };
  }

  function areFilterStatesEqual(a, b) {
    if (!a || !b) return false;
    const aStations = getComparableStationSelection(a.stations, a.sector);
    const bStations = getComparableStationSelection(b.stations, b.sector);
    return a.search === b.search &&
           (a.searchColumn || '__all__') === (b.searchColumn || '__all__') &&
           a.license === b.license &&
           a.sector === b.sector &&
           a.status === b.status &&
           a.harzFilter === b.harzFilter &&
           ((a.columnPresence && a.columnPresence.col) ?? null) === ((b.columnPresence && b.columnPresence.col) ?? null) &&
           ((a.columnPresence && a.columnPresence.mode) || null) === ((b.columnPresence && b.columnPresence.mode) || null) &&
           JSON.stringify(aStations) === JSON.stringify(bStations);
  }

  function isFilterStateEmpty(state) {
    if (!state) return true;
    const hasColumnPresence = state.columnPresence && typeof state.columnPresence.col === 'number' && state.columnPresence.mode;
    return !state.search && (state.searchColumn || '__all__') === '__all__' && !state.license && !state.sector && !state.stations.length && state.status === 'both' && !state.harzFilter && !hasColumnPresence;
  }

  function pushFilterHistory(state) {
    if (isRestoringFilter) return;
    if (!state) state = captureFilterState();
    // Don't push if same as current state
    const current = filterHistory[filterHistoryPointer];
    if (current && areFilterStatesEqual(current, state)) return;
    // Don't push empty states unless history is empty
    if (isFilterStateEmpty(state) && filterHistory.length > 0) return;
    // Trim future states if we're not at the end
    if (filterHistoryPointer < filterHistory.length - 1) {
      filterHistory = filterHistory.slice(0, filterHistoryPointer + 1);
    }
    filterHistory.push(state);
    if (filterHistory.length > FILTER_HISTORY_MAX) {
      filterHistory.shift();
    }
    filterHistoryPointer = filterHistory.length - 1;
    updateUndoButtonVisibility();
  }

  function syncSectorStripeHighlight(value) {
    try {
      if (typeof window.setSectorStripeValue === 'function') {
        window.setSectorStripeValue(value || '', { dispatch: false });
      }
    } catch (_) {}
  }

  function syncStationButtonHighlights() {
    try {
      const list = document.getElementById('stationDropdownList');
      const container = document.getElementById('stationButtonsContainer');
      if (!list || !container) return;
      const checked = new Set(
        Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map((cb) => cb.value)
      );
      Array.from(container.querySelectorAll('button.station-btn')).forEach((btn) => {
        const val = btn.dataset.value || btn.textContent.trim();
        btn.classList.toggle('is-selected', checked.has(val));
      });
    } catch (_) {}
  }

  function restoreFilterState(state) {
    if (!state) return;
    isRestoringFilter = true;
    try {
      const searchInput = document.getElementById('filterInput');
      const licenseInput = document.getElementById('licenseNumberFilter');
      if (searchInput) searchInput.value = state.search || '';
      if (searchColumnSel) {
        populateWeaponSearchColumns();
        searchColumnSel.value = Array.from(searchColumnSel.options).some((option) => option.value === (state.searchColumn || '__all__'))
          ? (state.searchColumn || '__all__')
          : '__all__';
        updateWeaponSearchPlaceholder();
      }
      if (licenseInput) licenseInput.value = state.license || '';
      // Restore sector
      if (sectorEl) {
        const placeholder = sectorEl.querySelector('option[value=""]');
        if (placeholder) placeholder.disabled = false;
        const previous = sectorEl.value;
        sectorEl.value = state.sector || '';
        syncSectorStripeHighlight(sectorEl.value);
        const shouldDispatch = sectorEl.value !== previous;
        if (shouldDispatch) {
          try {
            sectorEl.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (_) {
            try { onSectorChange(); } catch (_) {}
          }
        } else {
          try { onSectorChange(); } catch (_) {}
        }
      }
      // Restore stations after sector change populates the list
      setTimeout(() => {
        if (stationBox && state.stations) {
          const checkboxes = stationBox.querySelectorAll('input[type=checkbox]');
          const savedStationKeys = new Set(getComparableStationSelection(state.stations, state.sector));
          checkboxes.forEach(cb => {
            cb.checked = savedStationKeys.has(normalizeStationComparisonKey(cb.value, state.sector));
          });
          syncStationButtonHighlights();
        }
        // Restore status filter
        if (state.status) {
          setStatusFilter(state.status, { skipDispatch: true });
        }
        // Restore harz filter
        if (typeof state.harzFilter === 'boolean' && state.harzFilter !== window._filterNotesContainsHarz) {
          window._filterNotesContainsHarz = state.harzFilter;
          setHarzNotesButtonState(state.harzFilter);
        }
        columnPresenceFilter = state.columnPresence && typeof state.columnPresence.col === 'number' && state.columnPresence.mode
          ? { col: state.columnPresence.col, mode: state.columnPresence.mode }
          : { col: null, mode: null };
        isRestoringFilter = false;
        // Apply filters after restoration
        try { updateSelectedStationsLabel(); } catch {}
        try { setAutoSortForActiveFilters(); } catch {}
        const idxMap = computeIndexMap();
        filteredIndex = sortIndexMap(idxMap);
        currentPage = 1;
        renderPage();
        updateUndoButtonVisibility();
        showToast('تم استعادة البحث السابق', 'success');
      }, 50);
    } catch (err) {
      isRestoringFilter = false;
      console.warn('restoreFilterState error:', err);
    }
  }

  function undoFilterState() {
    if (filterHistoryPointer <= 0) {
      showToast('لا يوجد بحث سابق', 'error');
      return;
    }
    // Save current state before undoing if it's different
    const currentState = captureFilterState();
    const lastSaved = filterHistory[filterHistoryPointer];
    if (!areFilterStatesEqual(currentState, lastSaved)) {
      // Current state is different, save it first
      filterHistory = filterHistory.slice(0, filterHistoryPointer + 1);
      filterHistory.push(currentState);
      if (filterHistory.length > FILTER_HISTORY_MAX) filterHistory.shift();
      filterHistoryPointer = filterHistory.length - 1;
    }
    filterHistoryPointer--;
    const prevState = filterHistory[filterHistoryPointer];
    restoreFilterState(prevState);
  }

  function updateUndoButtonVisibility() {
    const undoBtn = document.getElementById('filterUndoBtn');
    if (!undoBtn) return;
    const hasHistory = filterHistoryPointer > 0 || (filterHistoryPointer === 0 && filterHistory.length > 0 && !areFilterStatesEqual(captureFilterState(), filterHistory[0]));
    undoBtn.style.display = hasHistory ? 'inline-flex' : 'none';
  }

  // Expose undo function globally
  try {
    window.undoFilterState = undoFilterState;
    window.captureFilterState = captureFilterState;
    window.pushFilterHistory = pushFilterHistory;
  } catch (_) {}

  function applyAllFilters() {
    // Push current state to history before applying new filters
    try { pushFilterHistory(); } catch (_) {}
    // Update selected stations label
    try { updateSelectedStationsLabel(); } catch {}
    // Auto-sort according to active filter
    try { setAutoSortForActiveFilters(); } catch {}
    const idxMap = computeIndexMap();
    filteredIndex = sortIndexMap(idxMap);
    currentPage = 1;
    renderPage();
    // Update undo button visibility
    try { updateUndoButtonVisibility(); } catch (_) {}
  }
  window.applyFilter = applyAllFilters; // used by input in HTML

  try {
    window.rerenderWeaponsTable = function rerenderWeaponsTable(options = {}) {
      const preserveScroll = options && Object.prototype.hasOwnProperty.call(options, 'preserveScroll')
        ? !!options.preserveScroll
        : true;
      const renderOptions = { preserveScroll };
      if (typeof options.tableScrollTop === 'number') {
        renderOptions.tableScrollTop = options.tableScrollTop;
      }
      try {
        renderPage(renderOptions);
      } catch (err) {
        console.warn('rerenderWeaponsTable fallback to applyAllFilters', err);
        try { applyAllFilters(); } catch (_) {}
      }
    };
  } catch (_) {}

  function resetSheetFilters(options = {}) {
    const opts = (options && typeof options === 'object') ? options : {};
    const skipApply = !!opts.skipApply;
    let changed = false;

    const searchInput = document.getElementById('filterInput');
    if (searchInput && searchInput.value) {
      searchInput.value = '';
      changed = true;
    }
    if (searchColumnSel && searchColumnSel.value !== '__all__') {
      searchColumnSel.value = '__all__';
      updateWeaponSearchPlaceholder();
      changed = true;
    }

    const licenseInput = document.getElementById('licenseNumberFilter');
    if (licenseInput && licenseInput.value) {
      licenseInput.value = '';
      changed = true;
    }

    let sectorCleared = false;
    if (sectorEl && !sectorEl.disabled && sectorEl.value) {
      const placeholder = sectorEl.querySelector('option[value=""]');
      if (placeholder) placeholder.disabled = false;
      sectorEl.value = '';
      if (sectorEl.value) {
        const options = Array.from(sectorEl.options || []);
        const placeholderIdx = placeholder ? options.indexOf(placeholder) : -1;
        sectorEl.selectedIndex = placeholderIdx !== -1 ? placeholderIdx : -1;
      }
      sectorCleared = !sectorEl.value;
      if (sectorCleared) changed = true;
    }

    if (stationBox) {
      const checkedStations = stationBox.querySelectorAll('input[type=checkbox]:checked');
      if (checkedStations.length) {
        checkedStations.forEach(cb => { cb.checked = false; });
        changed = true;
      }
    }

    if (getCurrentStatusFilter() !== 'both') {
      setStatusFilter('both', { skipDispatch: true });
      changed = true;
    }

    if (sectorCleared) {
      try { onSectorChange(); } catch (_) {}
      try { closeStationDropdown(); } catch (_) {}
      const hasSectorOptions = sectorEl && Array.from(sectorEl.options || []).some(opt => opt.value);
      if (hasSectorOptions) {
        const stationBtn = document.getElementById('stationDropdownBtn');
        if (stationBtn) {
          stationBtn.disabled = true;
          stationBtn.textContent = 'اختر القسم';
        }
        const list = document.getElementById('stationDropdownList');
        if (list) {
          list.innerHTML = '<div style="padding:12px 16px;color:#c5c7ce;font-size:0.95em;">اختر قطاعًا لعرض الأقسام</div>';
        }
      }
    }

    if (window._filterWithdrawnRequireEmptyDeposit) {
      window._filterWithdrawnRequireEmptyDeposit = false;
      changed = true;
    }
    if (window._filterNotesContainsHarz) {
      window._filterNotesContainsHarz = false;
      setHarzNotesButtonState(false);
      changed = true;
    }
    if (window.__auditFocusSet) {
      window.__auditFocusSet = null;
      changed = true;
    }
    if (window.__auditFocusLabel) {
      window.__auditFocusLabel = '';
      changed = true;
    }
    if (window.__auditFocusMode) {
      window.__auditFocusMode = '';
      changed = true;
    }
    if (columnPresenceFilter && (columnPresenceFilter.col !== null || columnPresenceFilter.mode !== null)) {
      columnPresenceFilter = { col: null, mode: null };
      changed = true;
    }

    if (opts.resetSort !== false) {
      const sortState = getSortState();
      sortState.manual = false;
      sortState.col = null;
      sortState.dir = 1;
    }

    if (typeof updateFilterStatusLabel === 'function') {
      updateFilterStatusLabel();
    }

    if (!skipApply) {
      try { applyAllFilters(); } catch (_) {}
    }

    return changed;
  }
  window.resetSheetFilters = resetSheetFilters;

  function isInlineEditingActive() {
    const active = document.activeElement;
    if (!active) return false;
    if (active.isContentEditable && active.closest('#csvPreview')) return true;
    const tag = active.tagName;
    if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && active.closest('#csvPreview')) {
      return true;
    }
    return false;
  }

  function captureSelectionKeys() {
    if (!selected.size) return null;
    const keyIdx = getColIndex('رقم', 'رقم القيد');
    if (keyIdx === -1) return null;
    const keys = new Set();
    selected.forEach((idx) => {
      const row = csvAll[idx];
      if (row && row[keyIdx] != null) {
        keys.add(String(row[keyIdx]));
      }
    });
    return keys.size ? keys : null;
  }

  function restoreSelectionFromKeys(keys) {
    selected.clear();
    if (!keys || !keys.size) return;
    const keyIdx = getColIndex('رقم', 'رقم القيد');
    if (keyIdx === -1) return;
    csvAll.forEach((row, idx) => {
      if (row && keys.has(String(row[keyIdx]))) {
        selected.add(idx);
      }
    });
  }

  function buildCsvFetchUrl() {
    const base = (typeof window.buildWeaponsApiUrl === 'function')
      ? window.buildWeaponsApiUrl('/api/csv-raw')
      : encodeURI(CSV_URL);
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}_=${Date.now()}`;
  }

  function buildRecordsFetchUrl() {
    const base = (typeof window.buildWeaponsApiUrl === 'function')
      ? window.buildWeaponsApiUrl('/api/records')
      : '/api/records';
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}_=${Date.now()}`;
  }

  function normalizeRecordsPayload(payload) {
    const safe = payload && typeof payload === 'object' ? payload : {};
    const headers = Array.isArray(safe.headers) ? safe.headers.map((header) => String(header || '').trim()) : [];
    const rows = Array.isArray(safe.rows)
      ? safe.rows.map((row) => Array.isArray(row) ? row.map((cell) => cell == null ? '' : String(cell)) : [])
      : [];
    const meta = Array.isArray(safe.meta)
      ? safe.meta.map((item, index) => {
          const source = item && typeof item === 'object' ? item : {};
          return {
            id: source.id != null ? source.id : null,
            rowOrder: source.rowOrder != null ? source.rowOrder : index + 1,
            rowIndex: source.rowIndex != null ? source.rowIndex : index,
            updatedAt: source.updatedAt != null ? source.updatedAt : null
          };
        })
      : rows.map((_, index) => ({ id: null, rowOrder: index + 1, rowIndex: index, updatedAt: null }));
    while (meta.length < rows.length) {
      meta.push({ id: null, rowOrder: meta.length + 1, rowIndex: meta.length, updatedAt: null });
    }
    return {
      headers,
      rows,
      meta: meta.slice(0, rows.length),
      version: safe.version || (safe.stats && safe.stats.version) || `${rows.length}:${safe.updatedAt || ''}`
    };
  }

  function rebuildSqlRowCaches() {
    try {
      csvRowWithdrawKeys = new Array(csvAll.length);
      for (let i = 0; i < csvAll.length; i++) {
        csvRowWithdrawKeys[i] = computeWithdrawRecordKeyForRow(csvAll[i], i);
      }
    } catch (e) { csvRowWithdrawKeys = []; }
    try {
      csvAllNormLicense = new Array(csvAll.length);
      const numIdx = getColIndex('رقم', 'رقم القيد');
      if (numIdx !== -1) {
        for (let i = 0; i < csvAll.length; i++) {
          const cell = String((csvAll[i] && csvAll[i][numIdx]) || '');
          csvAllNormLicense[i] = toLatinDigits(cell).replace(/\s+/g, '');
        }
      } else {
        for (let i = 0; i < csvAll.length; i++) csvAllNormLicense[i] = '';
      }
    } catch (e) { csvAllNormLicense = []; }
  }

  function shouldDeferCsvAutoRefresh() {
    if (csvRefreshInFlight) return true;
    if (document.hidden) return true;
    if (isInlineEditingActive()) return true;
    if (UnsavedGuard?.shouldWarn?.()) return true;
    if (lastManualSaveStamp && (Date.now() - lastManualSaveStamp) < 3500) return true;
    return false;
  }

  async function applyPendingExternalSaveRefresh() {
    if (!pendingExternalSaveRefresh) return false;
    if (shouldDeferCsvAutoRefresh()) return false;
    const refreshed = await refreshCsvFromServer({
      force: false,
      preservePage: true,
      preserveScroll: true
    }).catch(() => null);
    if (refreshed === null) {
      pendingExternalSaveRefresh = true;
      scheduleExternalSaveRefresh();
      return false;
    }
    pendingExternalSaveRefresh = false;
    if (externalSaveRefreshTimer) {
      clearInterval(externalSaveRefreshTimer);
      externalSaveRefreshTimer = null;
    }
    return refreshed === true;
  }

  function scheduleExternalSaveRefresh() {
    if (externalSaveRefreshTimer) return;
    externalSaveRefreshTimer = window.setInterval(() => {
      void applyPendingExternalSaveRefresh();
    }, 2500);
  }

  function handleExternalSaveRefresh(event) {
    const detail = event && event.detail && typeof event.detail === 'object' ? event.detail : null;
    if (!detail || detail.kind !== 'save' || detail.programKey !== 'weapons') return;
    pendingExternalSaveRefresh = true;
    void applyPendingExternalSaveRefresh();
    if (pendingExternalSaveRefresh) {
      scheduleExternalSaveRefresh();
    }
  }

  window.addEventListener('activity:external-save', handleExternalSaveRefresh);

  // ----- Weapons popup wiring -----
  function buildWeaponsPopupPayloadForRow(origIdx, fallbackWeaponDetails = '') {
    const row = (typeof origIdx === 'number' && !Number.isNaN(origIdx) && csvAll[origIdx]) ? csvAll[origIdx] : null;
    const weaponsIdx = getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح');
    const nameIdx = getColIndex('الاسم');
    const licenseIdx = getColIndex('رقم', 'رقم القيد');
    const statusIdx = getColIndex('حالة السحب');
    return {
      name: row && nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '',
      license: row && licenseIdx !== -1 ? String(row[licenseIdx] || '').trim() : '',
      weaponDetails: row && weaponsIdx !== -1
        ? String(row[weaponsIdx] || '').trim()
        : String(fallbackWeaponDetails || '').trim(),
      rowStatus: row && statusIdx !== -1 ? String(row[statusIdx] || '').trim() : '',
      origIdx,
      recordKey: (typeof origIdx === 'number' && origIdx >= 0) ? getRowWithdrawRecordKey(origIdx) : ''
    };
  }

  function openWeaponsPopupForRowCell(anchorEl, origIdx, fallbackWeaponDetails = '') {
    if (!anchorEl) return;
    showWeaponsPopupForCell(anchorEl, buildWeaponsPopupPayloadForRow(origIdx, fallbackWeaponDetails));
  }

  function wireWeaponsPopupForVisibleRows() {
    const colIdx = getColIndex('بيانات السلاح');
    if (colIdx === -1) return;
    const tbody = document.querySelector('#csvPreview tbody');
    if (!tbody) return;
    Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
      const cell = findRenderedCellByCsvIndex(tr, colIdx);
      if (!cell || cell.__weaponsPopupWired) return;
      cell.__weaponsPopupWired = true;
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const origIdxAttr = tr.querySelector('input.row-select')?.getAttribute('data-orig-idx');
        const origIdx = origIdxAttr ? parseInt(origIdxAttr, 10) : null;
        openWeaponsPopupForRowCell(cell, origIdx, cell.textContent || '');
      });
    });
  }

  const weaponsPopupEl = document.getElementById('weaponsPopup');
  const withdrawTitleEl = document.getElementById('withdrawPopupTitle');
  const withdrawLicenseEl = document.getElementById('withdrawLicenseLabel');
  const withdrawWeaponDetailsEl = document.getElementById('withdrawWeaponDetails');
  const withdrawStatusLabelEl = document.getElementById('withdrawStatusLabel');
  const withdrawToggleBtn = document.getElementById('withdrawToggleBtn');
  const withdrawCloseBtn = document.getElementById('withdrawCloseBtn');
  const weaponsPopupMsg = document.getElementById('weaponsPopupMsg');
  const weaponAddFormEl = document.getElementById('weaponAddForm');
  const weaponAddInputEl = document.getElementById('weaponAddInput');
  const weaponAddBtnEl = document.getElementById('weaponAddBtn');
  const weaponDuplicateHintEl = document.getElementById('weaponDuplicateHint');
  const weaponEditModalEl = document.getElementById('weaponEditModal');
  const weaponEditInputModalEl = document.getElementById('weaponEditInput');
  const weaponEditCancelBtn = document.getElementById('weaponEditCancel');
  const weaponEditSubmitBtn = document.getElementById('weaponEditSubmit');
  const weaponEditModalHintEl = document.getElementById('weaponEditModalHint');
  [withdrawToggleBtn, withdrawCloseBtn].forEach((btn) => {
    if (btn) btn.setAttribute('type', 'button');
  });
  if (withdrawToggleBtn) {
    withdrawToggleBtn.style.display = 'none';
    try {
      if (withdrawToggleBtn.parentElement) {
        withdrawToggleBtn.parentElement.style.display = 'none';
      }
    } catch (_) {}
  }
  if (weaponAddFormEl) {
    weaponAddFormEl.style.display = 'flex';
  }
  if (weaponAddBtnEl) {
    weaponAddBtnEl.setAttribute('type', 'button');
  }
  if (weaponEditCancelBtn) weaponEditCancelBtn.setAttribute('type', 'button');
  if (weaponEditSubmitBtn) weaponEditSubmitBtn.setAttribute('type', 'button');
  if (weaponAddBtnEl) {
    weaponAddBtnEl.addEventListener('click', (ev) => {
      ev.preventDefault();
      handleWeaponAddSubmit();
    });
  }
  if (weaponAddInputEl) {
    weaponAddInputEl.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        handleWeaponAddSubmit();
      }
    });
    weaponAddInputEl.addEventListener('input', () => {
      if (weaponDuplicateHintEl) weaponDuplicateHintEl.style.display = 'none';
    });
  }
  let currentWithdrawContext = null;
  let pendingWeaponEdit = null;

  function normalizeRowStatusValue(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    const compact = trimmed.replace(/\s+/g, ' ');
    if (compact === 'مسحوب') return 'full';
    if (compact === 'مسحوب جزئي' || compact === 'سحب جزئي') return 'partial';
    return trimmed;
  }

  function buildPopupWeaponEntries(rawDetails, rowStatus, context = null) {
    const statusCode = normalizeRowStatusValue(rowStatus);
    const normalizedStatus = normalizeWithdrawalStatusText(rowStatus);
    const storedEntry = context
      ? weaponsStateStore.getEntry(context.recordKey, context.name, context.license)
      : null;

    if (storedEntry && Array.isArray(storedEntry.weapons) && storedEntry.weapons.length) {
      return storedEntry.weapons.map((weapon, idx) => {
        const cleanLabel = String(weapon && weapon.name || '').trim();
        const fallback = cleanLabel || `سلاح ${idx + 1}`;
        let withdrawn = !!(weapon && weapon.withdrawn);
        if (statusCode === 'full' || normalizedStatus === 'got') withdrawn = true;
        if (normalizedStatus === 'not') withdrawn = false;
        return {
          index: idx,
          rawName: cleanLabel || fallback,
          displayLabel: toArabicDigits(fallback),
          withdrawn,
          depositNumber: String(weapon && weapon.depositNumber || '').trim(),
          depositDate: String(weapon && weapon.depositDate || '').trim()
        };
      });
    }

    // Fallback: SQL store hasn't loaded yet — parse the CSV mirror text
    const text = typeof rawDetails === 'string' ? rawDetails.trim() : '';
    if (!text) return [];
    const extracted = extractWeaponEntries(text);
    const stripped = stripWithdrawTag(text);
    const fallbackEntry = hasMeaningfulWeaponText(stripped)
      ? [{ cleanName: stripped, rawText: text, index: 0, withdrawn: false }]
      : [];
    const source = extracted.length ? extracted : fallbackEntry;
    return source.map((entry, idx) => {
      const cleanLabel = hasMeaningfulWeaponText(entry.cleanName) ? String(entry.cleanName).trim() : '';
      const fallback = cleanLabel || `سلاح ${idx + 1}`;
      let withdrawn = (statusCode === 'full' || normalizedStatus === 'got') ? true : !!entry.withdrawn;
      if (normalizedStatus === 'not') withdrawn = false;
      return {
        index: idx,
        rawName: hasMeaningfulWeaponText(entry.rawText) ? String(entry.rawText).trim()
          : hasMeaningfulWeaponText(entry.cleanName) ? String(entry.cleanName).trim()
          : fallback,
        displayLabel: toArabicDigits(fallback),
        withdrawn
      };
    });
  }

  function refreshCurrentWeaponEntries() {
    if (!currentWithdrawContext) return;
    const { weaponDetailsRaw, rowStatus, recordKey, name, license } = currentWithdrawContext;
    currentWithdrawContext.weaponEntries = buildPopupWeaponEntries(weaponDetailsRaw, rowStatus, { recordKey, name, license });
  }

  function applyWeaponsServerUpdate(payload = {}, options = {}) {
    if (!currentWithdrawContext) return false;
    const { origIdx } = currentWithdrawContext;
    const rowWasDirtyBeforeServerUpdate = Array.isArray(csvAll[origIdx]) && dirtyRowRefs.has(csvAll[origIdx]);
    const previousEntries = Array.isArray(currentWithdrawContext.weaponEntries)
      ? currentWithdrawContext.weaponEntries.slice()
      : [];
    const previousCounts = Array.isArray(currentWithdrawContext.pieceCounts)
      ? currentWithdrawContext.pieceCounts.slice()
      : ensurePopupPieceCounts().slice();
    const previousCountByName = new Map();
    previousEntries.forEach((entry, index) => {
      const key = normalizeWeaponKey(getWeaponLabelForState(entry, index));
      if (key) previousCountByName.set(key, previousCounts[index] || 1);
    });

    // Phase 1: write new values into csvAll without re-rendering yet
    const weaponsIdx = getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح');
    const statusIdx = getColIndex('حالة السحب');
    const piecesIdx = getColIndex('عدد القطع');
    const weaponsCellChanged = typeof payload.weaponDetails === 'string';
    const statusCellChanged = Object.prototype.hasOwnProperty.call(payload, 'statusValue');
    if (weaponsCellChanged) {
      currentWithdrawContext.weaponDetailsRaw = payload.weaponDetails;
      if (weaponsIdx !== -1 && Array.isArray(csvAll[origIdx])) {
        csvAll[origIdx][weaponsIdx] = payload.weaponDetails;
      }
    }
    if (statusCellChanged) {
      currentWithdrawContext.rowStatus = payload.statusValue || '';
      if (statusIdx !== -1 && Array.isArray(csvAll[origIdx])) {
        csvAll[origIdx][statusIdx] = payload.statusValue || '';
      }
    }
    if (Array.isArray(payload.entries)) {
      const normalizedContextStatus = normalizeWithdrawalStatusText(currentWithdrawContext.rowStatus);
      currentWithdrawContext.weaponEntries = payload.entries.map((entry, idx) => {
        const cleanLabel = hasMeaningfulWeaponText(entry.name) ? String(entry.name).trim() : '';
        const fallback = cleanLabel || `سلاح ${idx + 1}`;
        let withdrawn = !!entry.withdrawn;
        if (normalizedContextStatus === 'got') withdrawn = true;
        if (normalizedContextStatus === 'not') withdrawn = false;
        return {
          index: typeof entry.index === 'number' ? entry.index : idx,
          rawName: cleanLabel || fallback,
          displayLabel: toArabicDigits(fallback),
          withdrawn,
          depositNumber: String(entry && entry.depositNumber || '').trim(),
          depositDate: String(entry && entry.depositDate || '').trim()
        };
      });
    } else {
      refreshCurrentWeaponEntries();
    }
    const nextEntries = Array.isArray(currentWithdrawContext.weaponEntries) ? currentWithdrawContext.weaponEntries : [];
    currentWithdrawContext.pieceCounts = nextEntries.map((entry, index) => {
      const key = normalizeWeaponKey(getWeaponLabelForState(entry, index));
      return previousCountByName.get(key) || previousCounts[index] || 1;
    });
    let piecesCellChanged = false;
    let nextPiecesText = '';
    if (piecesIdx !== -1 && Array.isArray(csvAll[origIdx])) {
      const nextTotal = currentWithdrawContext.pieceCounts.reduce((sum, value) => sum + (Number(value) || 0), 0);
      if (nextTotal > 0) {
        const previousPiecesValue = String(csvAll[origIdx][piecesIdx] || '');
        nextPiecesText = String(nextTotal);
        csvAll[origIdx][piecesIdx] = nextPiecesText;
        piecesCellChanged = true;
      }
    }
    if (payload.updatedAt != null || payload.recordId != null || payload.rowOrder != null) {
      updateSqlRowMeta(origIdx, {
        recordId: payload.recordId,
        rowOrder: payload.rowOrder,
        rowIndex: payload.rowIndex,
        updatedAt: payload.updatedAt
      });
    }
    if (Array.isArray(payload.entries) && !rowWasDirtyBeforeServerUpdate && Array.isArray(csvAll[origIdx])) {
      const joinEntryField = (field) => {
        const values = payload.entries.map((entry) => String(entry && entry[field] || '').trim());
        let end = values.length;
        while (end > 0 && !values[end - 1]) end--;
        return values.slice(0, end).join(' + ');
      };
      const depositNumberIdx = getColIndex('رقم الايداع', 'رقم الإيداع');
      const depositDateIdx = getColIndex('تاريخ الايداع', 'تاريخ الإيداع');
      if (depositNumberIdx !== -1) {
        const joined = joinEntryField('depositNumber');
        csvAll[origIdx][depositNumberIdx] = joined;
        try { updateRenderedCellValue(origIdx, depositNumberIdx, joined); } catch (_) {}
      }
      if (depositDateIdx !== -1) {
        const joined = joinEntryField('depositDate');
        csvAll[origIdx][depositDateIdx] = joined;
        try { updateRenderedCellValue(origIdx, depositDateIdx, joined); } catch (_) {}
      }
    }

    // Always mark the row as dirty so the global "Save" button acknowledges the changes
    // even though the backend toggle API has already updated the SQL store.
    try { UnsavedGuard.markDirty(); } catch (_) {}
    try { markRowDirty(origIdx); } catch (_) {}

    // Phase 2: upsert into the SQL-backed store BEFORE rendering, so cells repaint with fresh data
    const stateEntry = createWeaponStateEntryForRow(origIdx, nextEntries, currentWithdrawContext.pieceCounts);
    if (stateEntry) persistWeaponStateEntry(stateEntry);

    // Phase 3: now repaint cells (they read from the store via getWeaponEntriesForRow)
    if (weaponsCellChanged && weaponsIdx !== -1) {
      updateRenderedCellValue(origIdx, weaponsIdx, payload.weaponDetails);
    }
    if (statusCellChanged && statusIdx !== -1) {
      updateRenderedCellValue(origIdx, statusIdx, payload.statusValue || '');
    }
    if (piecesCellChanged && piecesIdx !== -1) {
      updateRenderedCellValue(origIdx, piecesIdx, nextPiecesText);
    }

    updateWithdrawPopupUI();
    if (typeof origIdx === 'number') {
      refreshWithdrawStatusForRow(origIdx);
    }
    if (options.successMessage) {
      showToast(options.successMessage);
    }
    if (weaponsPopupMsg) {
      weaponsPopupMsg.style.display = 'none';
    }
    return true;
  }

  function summarizeWeaponEntriesStatus(entries) {
    if (!entries || !entries.length) {
      return { label: 'لا توجد بيانات', background: '#dc2626' };
    }
    const total = entries.length;
    const withdrawnCount = entries.filter((entry) => entry.withdrawn).length;
    if (withdrawnCount === total) {
      return { label: 'تم سحب جميع الأسلحة', background: '#16a34a' };
    }
    if (withdrawnCount === 0) {
      return { label: 'لم يتم سحب أي سلاح', background: '#dc2626' };
    }
    return {
      label: `سحب جزئي (${toArabicDigits(withdrawnCount)}/${toArabicDigits(total)})`,
      background: '#f59e0b'
    };
  }

  function getPopupPiecesColumnInfo() {
    const ctx = currentWithdrawContext;
    if (!ctx || typeof ctx.origIdx !== 'number' || ctx.origIdx < 0 || !Array.isArray(csvAll[ctx.origIdx])) {
      return { piecesIdx: -1, disabled: true, total: 0, entriesLength: 0 };
    }
    const row = csvAll[ctx.origIdx];
    const piecesIdx = getColIndex('عدد القطع');
    const weaponsIdx = getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح');
    const entriesLength = Math.max(0, (ctx.weaponEntries || []).length || getWeaponEntriesForRow(row, weaponsIdx, ctx.origIdx).length);
    let rawCount = NaN;
    if (piecesIdx !== -1) {
      const digits = sanitizeNumberText(row[piecesIdx]);
      if (digits) rawCount = parseInt(digits, 10);
    }
    const fallback = computeWeaponCountForRow(row, weaponsIdx, piecesIdx);
    const total = Number.isFinite(rawCount) ? rawCount : Math.max(entriesLength, fallback || 0);
    return {
      piecesIdx,
      disabled: piecesIdx === -1,
      total: Math.max(0, total),
      entriesLength
    };
  }

  function ensurePopupPieceCounts() {
    const ctx = currentWithdrawContext;
    if (!ctx) return [];
    const entries = Array.isArray(ctx.weaponEntries) ? ctx.weaponEntries : [];
    const info = getPopupPiecesColumnInfo();
    if (Array.isArray(ctx.pieceCounts) && ctx.pieceCounts.length === entries.length) {
      return ctx.pieceCounts;
    }
    if (!entries.length) {
      ctx.pieceCounts = [];
      return ctx.pieceCounts;
    }
    const row = Array.isArray(csvAll[ctx.origIdx]) ? csvAll[ctx.origIdx] : [];
    const counts = resolveWeaponPieceCounts(row, entries, info.piecesIdx, ctx.origIdx);
    ctx.pieceCounts = counts;
    return ctx.pieceCounts;
  }

  function getCurrentPopupPiecesInfo(entryIndex = null) {
    const info = getPopupPiecesColumnInfo();
    const counts = ensurePopupPieceCounts();
    const hasEntryIndex = typeof entryIndex === 'number' && entryIndex >= 0 && entryIndex < counts.length;
    const count = hasEntryIndex ? counts[entryIndex] : counts.reduce((sum, value) => sum + (Number(value) || 0), 0);
    return {
      count: Math.max(0, count),
      totalCount: counts.reduce((sum, value) => sum + (Number(value) || 0), 0),
      min: hasEntryIndex ? 1 : counts.length,
      totalMin: counts.length,
      piecesIdx: info.piecesIdx,
      disabled: info.disabled,
      entryIndex: hasEntryIndex ? entryIndex : null
    };
  }

  function renderPopupPiecesCounter(entry = null, index = 0) {
    const info = getCurrentPopupPiecesInfo(typeof index === 'number' ? index : null);
    const count = Number.isFinite(info.count) ? info.count : 0;
    const disabledAttr = info.disabled ? ' disabled' : '';
    const downDisabled = info.disabled || count <= info.min ? ' disabled' : '';
    const indexAttr = entry ? ` data-weapon-index="${index}"` : '';
    return `
      <div class="weapon-popup-counter" title="تعديل عدد القطع لهذا السلاح">
        <span class="weapon-popup-counter-control">
          <button type="button" class="weapon-piece-step" data-piece-delta="-1"${indexAttr}${downDisabled}>▼</button>
          <span class="weapon-popup-counter-value">x${escapeHtml(toArabicDigits(String(count)))}</span>
          <button type="button" class="weapon-piece-step" data-piece-delta="1"${indexAttr}${disabledAttr}>▲</button>
        </span>
      </div>
    `;
  }

  function adjustPopupPiecesCount(delta, entryIndex = null) {
    const ctx = currentWithdrawContext;
    if (!ctx || typeof ctx.origIdx !== 'number' || ctx.origIdx < 0) return;
    const counts = ensurePopupPieceCounts();
    const info = getCurrentPopupPiecesInfo(entryIndex);
    if (info.disabled) return;
    const row = csvAll[ctx.origIdx];
    if (!Array.isArray(row)) return;
    const targetIndex = typeof entryIndex === 'number' && entryIndex >= 0 && entryIndex < counts.length ? entryIndex : null;
    if (targetIndex == null) return;
    const currentEntryCount = Number(counts[targetIndex]) || 1;
    const currentTotal = counts.reduce((sum, value) => sum + (Number(value) || 0), 0);
    const nextEntryCount = Math.max(1, currentEntryCount + delta);
    const nextTotal = currentTotal + (nextEntryCount - currentEntryCount);
    if (nextEntryCount === currentEntryCount || nextTotal < counts.length || nextTotal > 20) return;
    counts[targetIndex] = nextEntryCount;
    row[info.piecesIdx] = String(nextTotal);
    try { updateRenderedCellValue(ctx.origIdx, info.piecesIdx, String(nextTotal)); } catch (_) {}
    try { UnsavedGuard.markDirty(); } catch (_) {}
    updatePendingEntryMetadataForRow(ctx.origIdx);
    const stateEntry = createWeaponStateEntryForRow(ctx.origIdx, ctx.weaponEntries || [], counts);
    if (stateEntry) {
      weaponsStateStore.upsertEntry(stateEntry);
      persistWeaponStateEntry(stateEntry);
    }
    publishCsvGlobals();
    updateWithdrawPopupUI();
  }

  function getVisiblePopupWeaponEntryItems(entries) {
    const source = Array.isArray(entries) ? entries : [];
    const statusFilter = getCurrentStatusFilter();
    return source
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => {
        if (statusFilter === 'got') return !!entry.withdrawn;
        if (statusFilter === 'not') return !entry.withdrawn;
        return true;
      });
  }

  function getPopupWeaponFieldColumns() {
    return {
      depositNumberIdx: getColIndex('رقم الايداع', 'رقم الإيداع'),
      depositDateIdx: getColIndex('تاريخ الايداع', 'تاريخ الإيداع')
    };
  }

  const POPUP_DEPOSIT_STRONG_TOKEN_RE = /[0-9\u0660-\u0669\u06F0-\u06F9]{1,6}\s*[/\\]\s*[A-Za-z\u0621-\u064A]+/g;
  const POPUP_DEPOSIT_LOOSE_TOKEN_RE = /[0-9\u0660-\u0669\u06F0-\u06F9]{1,6}\s*(?:[/\\]\s*[A-Za-z\u0621-\u064A]+|[A-Za-z\u0621-\u064A]+)?/g;
  const POPUP_DEPOSIT_DATE_TOKEN_RE = /[0-9\u0660-\u0669\u06F0-\u06F9]{1,4}\s*[/-]\s*[0-9\u0660-\u0669\u06F0-\u06F9]{1,2}\s*[/-]\s*[0-9\u0660-\u0669\u06F0-\u06F9]{1,4}/g;
  const POPUP_TRAILING_WAW_TOKEN_RE = /^[0-9\u0660-\u0669\u06F0-\u06F9]+\u0648$/;
  const POPUP_LEADING_DIGIT_RE = /^[0-9\u0660-\u0669\u06F0-\u06F9]/;

  function normalizePopupDepositToken(raw, nextChar = '') {
    let token = String(raw || '')
      .trim()
      .replace(/\s*([/\\])\s*/g, '$1')
      .replace(/\s+/g, '');
    if (POPUP_TRAILING_WAW_TOKEN_RE.test(token) && POPUP_LEADING_DIGIT_RE.test(String(nextChar || ''))) {
      token = token.slice(0, -1);
    }
    return token;
  }

  function collectPopupDepositMatches(text, regex) {
    const matches = [];
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const raw = match[0];
      const nextChar = text.charAt(match.index + raw.length);
      const token = normalizePopupDepositToken(raw, nextChar);
      if (token) matches.push({ raw, index: match.index, token });
    }
    return matches;
  }

  function popupResidueWithoutMatches(text, matches) {
    let residue = '';
    let cursor = 0;
    matches.forEach((match) => {
      residue += text.slice(cursor, match.index);
      cursor = match.index + String(match.raw || '').length;
    });
    residue += text.slice(cursor);
    return residue.replace(/[,\s،;؛+|/\\\-–—]+/g, '').trim();
  }

  function extractDepositNumberParts(text) {
    const source = String(text || '').trim();
    if (!source) return [];
    const strongMatches = collectPopupDepositMatches(source, POPUP_DEPOSIT_STRONG_TOKEN_RE);
    if (strongMatches.length > 1) return strongMatches.map((match) => match.token);
    const looseMatches = collectPopupDepositMatches(source, POPUP_DEPOSIT_LOOSE_TOKEN_RE);
    if (looseMatches.length <= 1) return [];
    if (popupResidueWithoutMatches(source, looseMatches)) return [];
    return looseMatches.map((match) => match.token);
  }

  function extractDepositDateParts(text) {
    const parts = [];
    POPUP_DEPOSIT_DATE_TOKEN_RE.lastIndex = 0;
    let match;
    while ((match = POPUP_DEPOSIT_DATE_TOKEN_RE.exec(String(text || ''))) !== null) {
      parts.push(String(match[0] || '').replace(/\s*([/-])\s*/g, '$1').trim());
    }
    return parts;
  }

  function splitPopupWeaponFieldParts(value, options = {}) {
    const text = String(value ?? '').trim();
    if (!text) return [];
    const hasExplicitSeparator = /[|+\r\n]/.test(text);
    if (hasExplicitSeparator) {
      return text.split(/[ \t]*\|[ \t]*|[ \t]*\+[ \t]*|\r?\n/g).map((part) => String(part || '').trim());
    }
    if (options.depositNumber) {
      const parts = extractDepositNumberParts(text);
      if (parts.length > 1) return parts;
    }
    if (options.depositDate) {
      const parts = extractDepositDateParts(text);
      if (parts.length > 1) return parts;
    }
    return [text];
  }

  function joinPopupWeaponFieldParts(parts) {
    const values = (Array.isArray(parts) ? parts : []).map((part) => String(part || '').trim());
    let end = values.length;
    while (end > 0 && !values[end - 1]) end--;
    return values.slice(0, end).join(' + ');
  }

  function formatPopupDateInputValue(value) {
    const latin = toLatinDigits(String(value || '').trim());
    if (!latin) return '';
    return parseFlexibleDateToken(latin) || latin;
  }

  function normalizePopupDateInput(value) {
    const latin = toLatinDigits(String(value || '').trim());
    if (!latin) return { ok: true, value: '' };
    const normalized = parseFlexibleDateToken(latin);
    if (!normalized) return { ok: false, value: latin };
    return { ok: true, value: normalized };
  }

  function getPopupWeaponFieldValues(weaponIndex) {
    const ctx = currentWithdrawContext;
    const row = ctx && typeof ctx.origIdx === 'number' ? csvAll[ctx.origIdx] : null;
    if (!Array.isArray(row)) {
      return { depositNumber: '', depositDate: '' };
    }
    const { depositNumberIdx, depositDateIdx } = getPopupWeaponFieldColumns();
    const numberParts = depositNumberIdx !== -1
      ? splitPopupWeaponFieldParts(row[depositNumberIdx], { depositNumber: true })
      : [];
    const dateParts = depositDateIdx !== -1
      ? splitPopupWeaponFieldParts(row[depositDateIdx], { depositDate: true })
      : [];
    const entry = currentWithdrawContext?.weaponEntries?.[weaponIndex] || null;
    const depositNumber = numberParts[weaponIndex] !== undefined
      ? numberParts[weaponIndex]
      : String(entry && entry.depositNumber || '').trim();
    const depositDate = dateParts[weaponIndex] !== undefined
      ? dateParts[weaponIndex]
      : String(entry && entry.depositDate || '').trim();
    return {
      depositNumber,
      depositDate: formatPopupDateInputValue(depositDate)
    };
  }

  function showPopupFieldWarning(input, message) {
    if (!input) return;
    input.classList.add('is-invalid');
    input.title = message || 'صيغة غير صحيحة';
    showToast(message || 'صيغة غير صحيحة', 'error');
    setTimeout(() => {
      try {
        input.classList.remove('is-invalid');
        input.removeAttribute('title');
      } catch (_) {}
    }, 1600);
  }

  function markPopupFieldRowChanged(origIdx, colIdx, nextValue) {
    if (typeof origIdx !== 'number' || origIdx < 0 || typeof colIdx !== 'number' || colIdx < 0) return;
    const row = csvAll[origIdx];
    if (!Array.isArray(row)) return;
    const previous = String(row[colIdx] ?? '');
    const next = String(nextValue ?? '');
    if (previous === next) return;
    row[colIdx] = next;
    try { UnsavedGuard.markDirty(); } catch (_) {}
    try { markRowDirty(origIdx); } catch (_) {}
    try { updateRenderedCellValue(origIdx, colIdx, next); } catch (_) {}
    try { scheduleModelNotesScan(); } catch (_) {}
    try { publishCsvGlobals(); } catch (_) {}
  }

  function commitWeaponPopupFieldInput(input) {
    if (!input || !currentWithdrawContext) return;
    const { origIdx } = currentWithdrawContext;
    if (typeof origIdx !== 'number' || origIdx < 0 || !Array.isArray(csvAll[origIdx])) return;
    const weaponIndex = Number(input.getAttribute('data-weapon-index'));
    if (!Number.isInteger(weaponIndex) || weaponIndex < 0) return;
    const field = input.getAttribute('data-weapon-field') || '';
    const { depositNumberIdx, depositDateIdx } = getPopupWeaponFieldColumns();
    const row = csvAll[origIdx];

    const isDateField = field === 'depositDate';
    const colIdx = field === 'depositNumber'
      ? depositNumberIdx
      : (field === 'depositDate' ? depositDateIdx : -1);
    if (colIdx === -1) return;
    let nextValue = toLatinDigits(String(input.value || '').trim());
    if (isDateField) {
      const normalized = normalizePopupDateInput(nextValue);
      if (!normalized.ok) {
        input.value = String(input.dataset.lastValue || '');
        showPopupFieldWarning(input, 'صيغة تاريخ الإيداع غير صحيحة');
        return;
      }
      nextValue = normalized.value;
      input.value = nextValue;
    }

    const entriesLength = (currentWithdrawContext.weaponEntries || []).length;
    const parts = splitPopupWeaponFieldParts(row[colIdx], { depositNumber: !isDateField, depositDate: isDateField });
    const minLength = Math.max(parts.length, entriesLength, weaponIndex + 1);
    while (parts.length < minLength) parts.push('');
    parts[weaponIndex] = nextValue;
    input.dataset.lastValue = nextValue;
    const nextJoined = joinPopupWeaponFieldParts(parts);
    markPopupFieldRowChanged(origIdx, colIdx, nextJoined);

    const entry = currentWithdrawContext.weaponEntries && currentWithdrawContext.weaponEntries[weaponIndex];
    if (entry) {
      if (field === 'depositNumber') entry.depositNumber = nextValue;
      if (field === 'depositDate') entry.depositDate = nextValue;
    }
  }

  function renderWeaponDetailsContent(container) {
    if (!container) return;
    const entries = (currentWithdrawContext && currentWithdrawContext.weaponEntries) || [];
    if (!entries.length) {
      container.innerHTML = '<div class="weapon-popup-empty">لا توجد بيانات للسلاح</div>';
      return;
    }
    const visibleItems = getVisiblePopupWeaponEntryItems(entries);
    if (!visibleItems.length) {
      const statusText = getCurrentStatusFilter() === 'got' ? 'مسحوبة' : 'غير مسحوبة';
      container.innerHTML = `<div class="weapon-popup-empty">لا توجد أسلحة ${statusText} في هذا العرض</div>`;
      return;
    }
    const html = visibleItems.map(({ entry, index }) => {
      const statusText = entry.withdrawn ? 'تم السحب' : 'لم يتم السحب';
      const btnLabel = entry.withdrawn ? 'الغاء السحب' : 'سحب';
      const statusClass = entry.withdrawn ? 'is-withdrawn' : 'is-not-withdrawn';
      const fieldValues = getPopupWeaponFieldValues(index);
      const { depositNumberIdx, depositDateIdx } = getPopupWeaponFieldColumns();
      const depositNumberDisabled = depositNumberIdx === -1 ? ' disabled' : '';
      const depositDateDisabled = depositDateIdx === -1 ? ' disabled' : '';
      return `
        <div class="weapon-popup-line ${statusClass}" data-weapon-index="${index}">
          <div class="weapon-popup-main">
            <div class="weapon-popup-info">
              <span class="weapon-popup-seq">${toArabicDigits(index + 1)}</span>
              <span class="weapon-popup-text">${escapeHtml(entry.displayLabel)}</span>
              <span class="weapon-popup-status">${statusText}</span>
            </div>
            ${renderPopupPiecesCounter(entry, index)}
          </div>
          <div class="weapon-popup-fields">
            <label class="weapon-popup-field">
              <span>رقم الايداع</span>
              <input type="text" class="weapon-popup-input" data-weapon-field="depositNumber" data-weapon-index="${index}" value="${escapeHtml(fieldValues.depositNumber)}" data-last-value="${escapeHtml(fieldValues.depositNumber)}" dir="auto" inputmode="text" placeholder="رقم الايداع"${depositNumberDisabled} />
            </label>
            <label class="weapon-popup-field">
              <span>تاريخ الايداع</span>
              <input type="text" class="weapon-popup-input" data-weapon-field="depositDate" data-weapon-index="${index}" value="${escapeHtml(fieldValues.depositDate)}" data-last-value="${escapeHtml(fieldValues.depositDate)}" dir="ltr" inputmode="numeric" placeholder="يوم/شهر/سنة"${depositDateDisabled} />
            </label>
          </div>
          <div class="weapon-popup-actions">
            <button type="button" class="weapon-edit-btn" data-weapon-index="${index}" title="تعديل السلاح">✏️</button>
            <button type="button" class="weapon-delete-btn" data-weapon-index="${index}" title="حذف السلاح">🗑️</button>
            <button type="button" class="weapon-popup-toggle" data-weapon-index="${index}">${btnLabel}</button>
          </div>
        </div>
      `;
    }).join('');
    container.innerHTML = html;
  }

  function hideWeaponsPopup() {
    if (!weaponsPopupEl) return;
    weaponsPopupEl.style.display = 'none';
    weaponsPopupEl.classList.remove('is-visible');
    weaponsPopupEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('weapons-frame-modal-open');
    if (weaponsPopupEl.__outsideHandler) {
      document.removeEventListener('click', weaponsPopupEl.__outsideHandler);
      weaponsPopupEl.__outsideHandler = null;
    }
  }

  function attachWeaponsPopupOutsideCloser() {
    if (!weaponsPopupEl) return;
    if (weaponsPopupEl.__outsideHandler) {
      document.removeEventListener('click', weaponsPopupEl.__outsideHandler);
    }
    const handler = (ev) => {
      const panel = weaponsPopupEl.querySelector('.weapons-frame-modal__panel');
      if (isWeaponEditModalVisible() && weaponEditModalEl.contains(ev.target)) {
        return;
      }
      if (ev.target === weaponsPopupEl || (panel && !panel.contains(ev.target))) {
        hideWeaponsPopup();
      }
    };
    weaponsPopupEl.__outsideHandler = handler;
    setTimeout(() => document.addEventListener('click', handler), 10);
  }

  function updateWithdrawPopupUI() {
    if (!weaponsPopupEl || !currentWithdrawContext) return;
    const { name, license } = currentWithdrawContext;
    if (withdrawTitleEl) withdrawTitleEl.textContent = name || 'سلاح';
    if (withdrawLicenseEl) {
      withdrawLicenseEl.textContent = license ? `رقم القيد: ${license}` : '';
    }
    if (withdrawWeaponDetailsEl) {
      renderWeaponDetailsContent(withdrawWeaponDetailsEl);
    }
    const summary = summarizeWeaponEntriesStatus(currentWithdrawContext.weaponEntries || []);
    if (withdrawStatusLabelEl) {
      withdrawStatusLabelEl.textContent = summary.label;
      withdrawStatusLabelEl.style.background = summary.background;
    }
    if (weaponsPopupMsg) weaponsPopupMsg.style.display = 'none';
  }

  function refreshWithdrawStatusForRow(origIdx) {
    try {
      if (typeof origIdx !== 'number' || Number.isNaN(origIdx) || origIdx < 0) return false;
      const rowData = csvAll[origIdx];
      if (!rowData) return false;
      const checkbox = document.querySelector(`#csvPreview tbody input.row-select[data-orig-idx="${origIdx}"]`);
      if (!checkbox) return false;
      const tr = checkbox.closest('tr');
      if (!tr) return false;
      const statusTd = tr.querySelector('td.col-status');
      if (!statusTd) return false;
      const statusPill = statusTd.querySelector('div');
      if (!statusPill) return false;
      const statusMeta = getRowStatusDisplayMeta(rowData, origIdx);
      statusPill.textContent = statusMeta.label;
      statusPill.style.background = statusMeta.background;
      statusPill.dataset.statusCode = statusMeta.code;
      return true;
    } catch (err) {
      console.warn('refreshWithdrawStatusForRow failed', err);
      return false;
    }
  }

  async function showWeaponsPopupForCell(anchorEl, { name, license, weaponDetails, rowStatus, origIdx, recordKey } = {}) {
    if (!weaponsPopupEl || !anchorEl) return;
    const normalizedName = String(name || '').trim();
    const normalizedLicense = String(license || '').trim();
    const weaponDetailsRaw = String(weaponDetails || '').trim();
    const normalizedRowStatus = String(rowStatus || '').trim();
    const effectiveRecordKey = recordKey ? String(recordKey).trim() : '';
    currentWithdrawContext = {
      name: normalizedName,
      license: normalizedLicense,
      weaponDetailsRaw,
      rowStatus: normalizedRowStatus,
      weaponEntries: buildPopupWeaponEntries(weaponDetailsRaw, normalizedRowStatus, {
        recordKey: effectiveRecordKey,
        name: normalizedName,
        license: normalizedLicense
      }),
      recordKey: effectiveRecordKey,
      origIdx: (typeof origIdx === 'number' && !Number.isNaN(origIdx)) ? origIdx : null
    };

    updateWithdrawPopupUI();

    try {
      if (weaponsPopupEl.parentElement !== document.body) {
        document.body.appendChild(weaponsPopupEl);
      }
    } catch (_) {}

    weaponsPopupEl.style.display = 'flex';
    weaponsPopupEl.style.visibility = 'visible';
    weaponsPopupEl.classList.add('is-visible');
    weaponsPopupEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('weapons-frame-modal-open');

    attachWeaponsPopupOutsideCloser();
  }

  async function handleWeaponEntryToggle(index, triggerBtn) {
    if (!currentWithdrawContext) return;
    const entries = currentWithdrawContext.weaponEntries || [];
    const entry = entries[index];
    if (!entry || !entry.rawName) return;
    const readableName = entry.displayLabel || entry.rawName || `سلاح ${toArabicDigits(index + 1)}`;
  const desiredStatus = entry.withdrawn ? 'notWithdrawled' : 'withdrawled';
  const { name, license, origIdx } = currentWithdrawContext;
    if (typeof origIdx !== 'number' || Number.isNaN(origIdx) || origIdx < 0) {
      showToast('❌ تعذر تحديد صف السلاح.', 'error');
      return;
    }
    if (triggerBtn) triggerBtn.disabled = true;
    if (weaponsPopupMsg) {
      weaponsPopupMsg.textContent = `⏳ جاري تحديث حالة ${readableName}...`;
      weaponsPopupMsg.style.display = 'block';
    }
    const target = buildWeaponMutationTargetForRow(origIdx);
    try {
      const response = await fetch(buildWeaponsApiUrl('/api/weapons/toggle-withdrawn'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: target.recordId,
          rowIndex: target.rowIndex,
          weaponName: entry.rawName,
          weaponIndex: typeof entry.index === 'number' ? entry.index : index,
          desiredStatus,
          name,
          license,
          expectedUpdatedAt: target.expectedUpdatedAt
        })
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json || json.ok === false) {
        const msg = (json && json.message) ? json.message : 'server';
        throw new Error(msg);
      }
      applyWeaponsServerUpdate(json);
      if (window.rerenderWeaponsTable && weaponsPopupEl) {
        // Detach the outside click handler while the table refreshes, then reopen the frame
        // for the same row after the refreshed cell is available.
        if (weaponsPopupEl.__outsideHandler) {
          document.removeEventListener('click', weaponsPopupEl.__outsideHandler);
          weaponsPopupEl.__outsideHandler = null;
        }
        const savedCtx = currentWithdrawContext;
        window.rerenderWeaponsTable({ preserveScroll: true });
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => {
          if (!savedCtx || typeof savedCtx.origIdx !== 'number') return;
          const weaponsColIdx = getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح');
          const checkbox = document.querySelector(`#csvPreview tbody input.row-select[data-orig-idx="${savedCtx.origIdx}"]`);
          const rowEl = checkbox && checkbox.closest('tr');
          const cell = rowEl && weaponsColIdx !== -1 && rowEl.querySelector(`td[data-csv-index="${weaponsColIdx}"]`);
          if (cell && currentWithdrawContext) {
            showWeaponsPopupForCell(cell, {
              name: currentWithdrawContext.name,
              license: currentWithdrawContext.license,
              weaponDetails: currentWithdrawContext.weaponDetailsRaw,
              rowStatus: currentWithdrawContext.rowStatus,
              origIdx: currentWithdrawContext.origIdx,
              recordKey: currentWithdrawContext.recordKey
            });
          }
        }, 0)));
      }
      if (weaponsPopupMsg) {
        weaponsPopupMsg.textContent = desiredStatus === 'withdrawled'
          ? `تم تمييز ${readableName} كمسحوب.`
          : `تم الغاء سحب ${readableName}.`;
        setTimeout(() => {
          try { weaponsPopupMsg.style.display = 'none'; } catch (_) {}
        }, 1700);
      }
      showToast(desiredStatus === 'withdrawled'
        ? `تم سحب ${readableName}.`
        : `تم الغاء سحب ${readableName}.`);
    } catch (error) {
      console.error('handleWeaponEntryToggle failed', error);
      if (weaponsPopupMsg) {
        const errMsg = typeof error?.message === 'string' ? error.message : '❌ تعذر تحديث الحالة.';
        weaponsPopupMsg.textContent = errMsg.startsWith('❌') ? errMsg : `❌ ${errMsg}`;
        weaponsPopupMsg.style.display = 'block';
      }
      showToast(`❌ تعذر تحديث حالة ${readableName}.`, 'error');
    } finally {
      if (triggerBtn) triggerBtn.disabled = false;
    }
  }

  async function handleWeaponAddSubmit() {
    if (!currentWithdrawContext) return;
    const { name, license, origIdx } = currentWithdrawContext;
    if (typeof origIdx !== 'number' || Number.isNaN(origIdx) || origIdx < 0) {
      showToast('❌ تعذر تحديد صف السلاح.', 'error');
      return;
    }
    const value = weaponAddInputEl ? weaponAddInputEl.value.trim() : '';
    if (!value) {
      showToast('من فضلك اكتب اسم السلاح الجديد.', 'error');
      if (weaponAddInputEl) weaponAddInputEl.focus();
      return;
    }
    const existingWeaponEntries = Array.isArray(currentWithdrawContext.weaponEntries)
      ? currentWithdrawContext.weaponEntries
      : [];
    const normalizedInput = normalizeWeaponKey(value);
    if (normalizedInput && existingWeaponEntries.some((e, i) => normalizeWeaponKey(getWeaponLabelForState(e, i)) === normalizedInput)) {
      if (weaponDuplicateHintEl) {
        weaponDuplicateHintEl.textContent = '⚠️ هذا السلاح مضاف بالفعل في هذه الرخصة.';
        weaponDuplicateHintEl.style.display = 'block';
      }
      if (weaponAddInputEl) weaponAddInputEl.focus();
      return;
    }
    if (weaponDuplicateHintEl) weaponDuplicateHintEl.style.display = 'none';
    if (weaponAddBtnEl) weaponAddBtnEl.disabled = true;
    if (weaponAddInputEl) weaponAddInputEl.disabled = true;
    if (weaponsPopupMsg) {
      weaponsPopupMsg.textContent = '⏳ جاري اضافة السلاح...';
      weaponsPopupMsg.style.display = 'block';
    }
    const target = buildWeaponMutationTargetForRow(origIdx);
    try {
      const response = await fetch(buildWeaponsApiUrl('/api/weapons/add-weapon'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: target.recordId,
          rowIndex: target.rowIndex,
          weaponName: value,
          name,
          license,
          expectedUpdatedAt: target.expectedUpdatedAt
        })
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json || json.ok === false) {
        const msg = (json && json.message) ? json.message : 'server';
        throw new Error(msg);
      }
      applyWeaponsServerUpdate(json, { successMessage: `تم اضافة السلاح ${value}` });
      if (weaponAddInputEl) weaponAddInputEl.value = '';
    } catch (error) {
      console.error('handleWeaponAddSubmit failed', error);
      if (weaponsPopupMsg) {
        weaponsPopupMsg.textContent = '❌ تعذر اضافة السلاح. حاول مرة اخرى.';
        weaponsPopupMsg.style.display = 'block';
      }
      showToast('❌ تعذر اضافة السلاح.', 'error');
    } finally {
      if (weaponAddBtnEl) weaponAddBtnEl.disabled = false;
      if (weaponAddInputEl) weaponAddInputEl.disabled = false;
      if (weaponAddInputEl) weaponAddInputEl.focus();
    }
  }

  function isWeaponEditModalReady() {
    return !!(weaponEditModalEl && weaponEditInputModalEl && weaponEditCancelBtn && weaponEditSubmitBtn);
  }

  function isWeaponEditModalVisible() {
    return !!(weaponEditModalEl && weaponEditModalEl.classList.contains('is-visible'));
  }

  function updateWeaponEditModalHint(entry) {
    if (!weaponEditModalHintEl) return;
    const label = entry?.displayLabel || entry?.rawName || '';
    weaponEditModalHintEl.textContent = label
      ? `تعديل ${label}`
      : 'قم بتحديث اسم السلاح ثم اضغط تعديل.';
  }

  function openWeaponEditModal(entry, index, triggerBtn) {
    if (!isWeaponEditModalReady() || !entry) return false;
    pendingWeaponEdit = { index, triggerBtn };
    document.body.classList.add('weapon-edit-modal-open');
    weaponEditModalEl.classList.add('is-visible');
    weaponEditModalEl.setAttribute('aria-hidden', 'false');
    updateWeaponEditModalHint(entry);
    // Strip withdraw tag (مسحوب) from weapon name when editing
    const cleanName = stripWithdrawTag(entry.rawName || entry.displayLabel || '');
    weaponEditInputModalEl.value = cleanName;
    requestAnimationFrame(() => {
      weaponEditInputModalEl.focus();
      weaponEditInputModalEl.select();
    });
    return true;
  }

  function closeWeaponEditModal(options = {}) {
    if (!weaponEditModalEl) return;
    weaponEditModalEl.classList.remove('is-visible');
    weaponEditModalEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('weapon-edit-modal-open');
    if (weaponEditInputModalEl) weaponEditInputModalEl.value = '';
    const restoreFocus = options.restoreFocus !== false;
    const triggerBtn = pendingWeaponEdit?.triggerBtn;
    pendingWeaponEdit = null;
    if (restoreFocus && triggerBtn && typeof triggerBtn.focus === 'function') {
      requestAnimationFrame(() => triggerBtn.focus());
    }
  }

  async function persistWeaponEntryRename(index, triggerBtn, newName, options = {}) {
    if (!currentWithdrawContext) return false;
    const entries = currentWithdrawContext.weaponEntries || [];
    const entry = entries[index];
    if (!entry) return false;
    const { name, license, origIdx } = currentWithdrawContext;
    if (typeof origIdx !== 'number' || Number.isNaN(origIdx) || origIdx < 0) {
      showToast('❌ تعذر تحديد صف السلاح.', 'error');
      return false;
    }
    const trimmed = String(newName || '').trim();
    if (!trimmed) {
      showToast('الاسم الجديد غير صالح.', 'error');
      return false;
    }
    const disableTrigger = options.disableTrigger !== false;
    if (disableTrigger && triggerBtn) triggerBtn.disabled = true;
    if (weaponsPopupMsg) {
      const readable = entry.displayLabel || entry.rawName || `سلاح ${toArabicDigits(index + 1)}`;
      weaponsPopupMsg.textContent = `⏳ جاري تعديل ${readable}...`;
      weaponsPopupMsg.style.display = 'block';
    }
    const target = buildWeaponMutationTargetForRow(origIdx);
    try {
      const response = await fetch(buildWeaponsApiUrl('/api/weapons/edit-weapon'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: target.recordId,
          rowIndex: target.rowIndex,
          weaponIndex: typeof entry.index === 'number' ? entry.index : index,
          newWeaponName: trimmed,
          name,
          license,
          expectedUpdatedAt: target.expectedUpdatedAt
        })
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json || json.ok === false) {
        const msg = (json && json.message) ? json.message : 'server';
        throw new Error(msg);
      }
      applyWeaponsServerUpdate(json, { successMessage: `تم تعديل ${entry.displayLabel || entry.rawName || 'السلاح'}` });
      return true;
    } catch (error) {
      console.error('handleWeaponEntryRename failed', error);
      if (weaponsPopupMsg) {
        weaponsPopupMsg.textContent = '❌ تعذر تعديل السلاح. حاول مرة أخرى.';
        weaponsPopupMsg.style.display = 'block';
      }
      showToast('❌ تعذر تعديل السلاح.', 'error');
      return false;
    } finally {
      if (disableTrigger && triggerBtn) triggerBtn.disabled = false;
    }
  }

  async function submitWeaponEditModal() {
    if (!pendingWeaponEdit || !weaponEditInputModalEl) return;
    if (weaponEditSubmitBtn) weaponEditSubmitBtn.disabled = true;
    if (weaponEditCancelBtn) weaponEditCancelBtn.disabled = true;
    const success = await persistWeaponEntryRename(
      pendingWeaponEdit.index,
      pendingWeaponEdit.triggerBtn,
      weaponEditInputModalEl.value,
      { disableTrigger: false }
    );
    if (weaponEditSubmitBtn) weaponEditSubmitBtn.disabled = false;
    if (weaponEditCancelBtn) weaponEditCancelBtn.disabled = false;
    if (success) closeWeaponEditModal();
  }

  function wireWeaponEditModalEvents() {
    if (!isWeaponEditModalReady()) return;
    weaponEditCancelBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      closeWeaponEditModal();
    });
    weaponEditSubmitBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      submitWeaponEditModal();
    });
    weaponEditInputModalEl.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        submitWeaponEditModal();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        closeWeaponEditModal();
      }
    });
    weaponEditModalEl.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (ev.target === weaponEditModalEl) {
        ev.preventDefault();
        closeWeaponEditModal();
      }
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && isWeaponEditModalVisible()) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        closeWeaponEditModal();
      }
    });
  }
  wireWeaponEditModalEvents();

  async function handleWeaponEntryRename(index, triggerBtn) {
    if (!currentWithdrawContext) return;
    const entries = currentWithdrawContext.weaponEntries || [];
    const entry = entries[index];
    if (!entry) return;
    if (openWeaponEditModal(entry, index, triggerBtn)) return;
    const initial = entry.rawName || '';
    const replacement = window.prompt('اكتب الاسم الجديد للسلاح', initial);
    if (replacement == null) return;
    await persistWeaponEntryRename(index, triggerBtn, replacement);
  }

  async function handleWeaponEntryDelete(index, triggerBtn) {
    if (!currentWithdrawContext) return;
    const entries = currentWithdrawContext.weaponEntries || [];
    const entry = entries[index];
    if (!entry) return;
    const { name, license, origIdx } = currentWithdrawContext;
    if (typeof origIdx !== 'number' || Number.isNaN(origIdx) || origIdx < 0) {
      showToast('❌ تعذر تحديد صف السلاح.', 'error');
      return;
    }
    const readableName = entry.displayLabel || entry.rawName || `سلاح ${toArabicDigits(index + 1)}`;
    const confirmed = window.confirm(`سيتم حذف ${readableName}. هل أنت متأكد؟`);
    if (!confirmed) return;
    if (triggerBtn) triggerBtn.disabled = true;
    if (weaponsPopupMsg) {
      weaponsPopupMsg.textContent = `⏳ جاري حذف ${readableName}...`;
      weaponsPopupMsg.style.display = 'block';
    }
    const target = buildWeaponMutationTargetForRow(origIdx);
    try {
      const response = await fetch(buildWeaponsApiUrl('/api/weapons/delete-weapon'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: target.recordId,
          rowIndex: target.rowIndex,
          weaponIndex: typeof entry.index === 'number' ? entry.index : index,
          weaponName: entry.rawName,
          name,
          license,
          expectedUpdatedAt: target.expectedUpdatedAt
        })
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json || json.ok === false) {
        const msg = (json && json.message) ? json.message : 'server';
        throw new Error(msg);
      }
      applyWeaponsServerUpdate(json, { successMessage: `تم حذف ${readableName}` });
    } catch (error) {
      console.error('handleWeaponEntryDelete failed', error);
      if (weaponsPopupMsg) {
        weaponsPopupMsg.textContent = '❌ تعذر حذف السلاح. حاول مرة أخرى.';
        weaponsPopupMsg.style.display = 'block';
      }
      showToast('❌ تعذر حذف السلاح.', 'error');
    } finally {
      if (triggerBtn) triggerBtn.disabled = false;
    }
  }

  if (withdrawCloseBtn) {
    withdrawCloseBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      hideWeaponsPopup();
    });
  }
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && weaponsPopupEl && weaponsPopupEl.classList.contains('is-visible')) {
      if (isWeaponEditModalVisible()) return;
      const active = ev.target instanceof Element ? ev.target : null;
      if (active && active.closest('.weapon-popup-input')) return;
      ev.preventDefault();
      hideWeaponsPopup();
    }
  });
  if (withdrawWeaponDetailsEl) {
    withdrawWeaponDetailsEl.addEventListener('change', (ev) => {
      const input = ev.target instanceof Element ? ev.target.closest('.weapon-popup-input') : null;
      if (!input) return;
      ev.stopPropagation();
      commitWeaponPopupFieldInput(input);
    });
    withdrawWeaponDetailsEl.addEventListener('keydown', (ev) => {
      const input = ev.target instanceof Element ? ev.target.closest('.weapon-popup-input') : null;
      if (!input) return;
      if (ev.key === 'Enter') {
        ev.preventDefault();
        ev.stopPropagation();
        commitWeaponPopupFieldInput(input);
        input.blur();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        input.value = String(input.dataset.lastValue || '');
        input.blur();
      }
    });
    withdrawWeaponDetailsEl.addEventListener('click', (ev) => {
      const pieceBtn = ev.target instanceof Element ? ev.target.closest('.weapon-piece-step') : null;
      if (pieceBtn) {
        const delta = parseInt(pieceBtn.getAttribute('data-piece-delta'), 10);
        const entryIdx = parseInt(pieceBtn.getAttribute('data-weapon-index'), 10);
        if (!Number.isNaN(delta)) {
          ev.preventDefault();
          ev.stopPropagation();
          adjustPopupPiecesCount(delta, Number.isNaN(entryIdx) ? null : entryIdx);
        }
        return;
      }
      const deleteBtn = ev.target instanceof Element ? ev.target.closest('.weapon-delete-btn') : null;
      if (deleteBtn) {
        const deleteIdx = parseInt(deleteBtn.getAttribute('data-weapon-index'), 10);
        if (!Number.isNaN(deleteIdx)) {
          ev.preventDefault();
          ev.stopPropagation();
          handleWeaponEntryDelete(deleteIdx, deleteBtn);
        }
        return;
      }
      const editBtn = ev.target instanceof Element ? ev.target.closest('.weapon-edit-btn') : null;
      if (editBtn) {
        const editIdx = parseInt(editBtn.getAttribute('data-weapon-index'), 10);
        if (!Number.isNaN(editIdx)) {
          ev.preventDefault();
          ev.stopPropagation();
          handleWeaponEntryRename(editIdx, editBtn);
        }
        return;
      }
      const btn = ev.target instanceof Element ? ev.target.closest('.weapon-popup-toggle') : null;
      if (!btn) return;
      const idx = parseInt(btn.getAttribute('data-weapon-index'), 10);
      if (Number.isNaN(idx)) return;
      ev.preventDefault();
      ev.stopPropagation();
      handleWeaponEntryToggle(idx, btn);
    });
  }

  async function refreshCsvFromServer(options = {}) {
    const {
      force = false,
      preservePage = true,
      preserveScroll = false,
      recordsPayload = null,
      triggerToastOnUpdate = false,
      providedHash = null
    } = options;
  if (!force && shouldDeferCsvAutoRefresh()) return false;
  const scrollState = preserveScroll ? snapshotScrollPosition() : null;
    csvRefreshInFlight = true;
    try {
      let payload = recordsPayload && typeof recordsPayload === 'object' ? recordsPayload : null;
      if (!payload) {
        const response = await fetch(buildRecordsFetchUrl(), { cache: 'no-store' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        payload = await response.json();
      }
      if (!payload || payload.ok === false) throw new Error((payload && payload.message) || 'bad records payload');
      const parsed = normalizeRecordsPayload(payload);
      const currentHash = providedHash != null ? providedHash : parsed.version;
      if (!force && currentHash && currentHash === lastCsvSnapshot) return false;
      if (!force && lastCsvHash != null && currentHash === lastCsvHash) return false;
      lastCsvSnapshot = currentHash;
      lastCsvHash = currentHash;
      // Ensure per-weapon UI metadata is current before rendering counters and totals.
      try { await loadWeaponsState(); } catch (_) {}
      const preservedSelection = captureSelectionKeys();
  csvHeaders = parsed.headers;
  csvAll = parsed.rows;
  csvRowMeta = parsed.meta;
  csvDataReady = true;
  populateWeaponSearchColumns();
  publishCsvGlobals();
      scheduleModelNotesScan({ immediate: true });
      rebuildSqlRowCaches();
  UnsavedGuard.clearDirty();
  try { dirtyRowRefs.clear(); } catch (_) {}
  publishCsvGlobals();
      restoreSelectionFromKeys(preservedSelection);
      const previousPage = preservePage ? currentPage : 1;
      try { updateSelectedStationsLabel(); } catch (_) {}
      try { setAutoSortForActiveFilters(); } catch (_) {}
  const idxMap = computeIndexMap();
  filteredIndex = sortIndexMap(idxMap);
      const totalPages = Math.max(1, Math.ceil(filteredIndex.length / getPageSize()));
      currentPage = Math.max(1, Math.min(previousPage, totalPages));
      renderPage({ preserveScroll: false });
      updateFilterStatusLabel();
      updateDeleteButton();
      if (preserveScroll && scrollState) {
        restoreScrollPositionAfterRender(scrollState);
      }
      if (triggerToastOnUpdate) {
        showToast('♻️ تم تحديث البيانات تلقائيًا من الخادم');
      }
      if (force) lastManualSaveStamp = 0;
      return true;
    } catch (err) {
      if (force) {
        console.error('[SQL records] Load error:', err);
        const tbody = table && table.querySelector('tbody');
        if (tbody) {
          tbody.innerHTML = `<tr><td colspan="12">تعذر تحميل بيانات السلاح من قاعدة البيانات.</td></tr>`;
        }
      } else {
        console.warn('SQL records refresh failed:', err);
      }
      return null;
    } finally {
      csvRefreshInFlight = false;
    }
  }

  try {
    window.refreshWeaponsSheetFromServer = function refreshWeaponsSheetFromServer(options = {}) {
      const opts = (options && typeof options === 'object') ? options : {};
      return refreshCsvFromServer({
        force: Object.prototype.hasOwnProperty.call(opts, 'force') ? !!opts.force : true,
        preservePage: Object.prototype.hasOwnProperty.call(opts, 'preservePage') ? !!opts.preservePage : true,
        preserveScroll: Object.prototype.hasOwnProperty.call(opts, 'preserveScroll') ? !!opts.preserveScroll : true,
        recordsPayload: opts.recordsPayload && typeof opts.recordsPayload === 'object' ? opts.recordsPayload : null,
        triggerToastOnUpdate: !!opts.triggerToastOnUpdate,
        providedHash: Object.prototype.hasOwnProperty.call(opts, 'providedHash') ? opts.providedHash : null
      });
    };
  } catch (_) {}

  function startCsvAutoRefresh() {
    if (csvRefreshTimer) clearInterval(csvRefreshTimer);
    // csvRefreshTimer = setInterval(() => {
    //   checkCsvForUpdates().catch(() => {});
    // }, REFRESH_INTERVAL_MS);
  }

  async function checkCsvForUpdates() {
    if (csvPollInFlight) return;
    if (shouldDeferCsvAutoRefresh()) return;
    csvPollInFlight = true;
    try {
      const response = await fetch(buildRecordsFetchUrl(), { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const payload = await response.json();
      const parsed = normalizeRecordsPayload(payload);
      const hash = parsed.version || hashString(JSON.stringify([parsed.headers, parsed.rows, parsed.meta]));
      if (lastCsvHash != null && hash === lastCsvHash) return;
      await refreshCsvFromServer({
        preservePage: true,
        preserveScroll: true,
        recordsPayload: payload,
        providedHash: hash,
        triggerToastOnUpdate: lastCsvHash != null
      });
    } catch (err) {
      console.warn('SQL records poll failed:', err);
    } finally {
      csvPollInFlight = false;
    }
  }

  // document.addEventListener('visibilitychange', () => {
  //   if (!document.hidden) {
  //     checkCsvForUpdates().catch(() => {});
  //   }
  // });

  /******** load + auto-refresh ********/
  initialCsvLoadPromise = refreshCsvFromServer({ force: true, preservePage: false })
    .catch((err) => {
      console.error('Initial SQL records load failed:', err);
      csvDataReady = false;
      return null;
    });

  /******** wire filters ********/
  async function applySearchAfterFullLoad() {
    if (!csvDataReady && initialCsvLoadPromise) {
      await initialCsvLoadPromise.catch(() => null);
    }
    applyAllFilters();
  }

  let searchInputDebounceTimer = null;
  let searchInputComposing = false;
  function scheduleSearchAfterInput() {
    if (searchInputComposing) return;
    if (searchInputDebounceTimer) clearTimeout(searchInputDebounceTimer);
    searchInputDebounceTimer = setTimeout(() => {
      searchInputDebounceTimer = null;
      applySearchAfterFullLoad().catch(() => applyAllFilters());
    }, SEARCH_INPUT_DEBOUNCE_MS);
  }

  [searchEl, document.getElementById('licenseNumberFilter')].forEach((input) => {
    if (!input) return;
    input.addEventListener('compositionstart', () => {
      searchInputComposing = true;
    });
    input.addEventListener('compositionend', () => {
      searchInputComposing = false;
      scheduleSearchAfterInput();
    });
    input.addEventListener('input', scheduleSearchAfterInput);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (searchInputDebounceTimer) {
          clearTimeout(searchInputDebounceTimer);
          searchInputDebounceTimer = null;
        }
        applySearchAfterFullLoad().catch(() => applyAllFilters());
      }
    });
  });
  if (searchColumnSel) {
    populateWeaponSearchColumns();
    searchColumnSel.addEventListener('change', () => {
      updateWeaponSearchPlaceholder();
      applySearchAfterFullLoad().catch(() => applyAllFilters());
    });
  }
  try { window.searchWeaponsRecords = applySearchAfterFullLoad; } catch (_) {}

  function readDeleteApprovalInspectTarget() {
    try {
      const raw = sessionStorage.getItem(DELETE_APPROVAL_INSPECT_STORAGE_KEY);
      if (!raw) return null;
      const target = JSON.parse(raw);
      return target && target.programKey === 'weapons' ? target : null;
    } catch (_) {
      return null;
    }
  }

  function clearDeleteApprovalInspectTarget() {
    try { sessionStorage.removeItem(DELETE_APPROVAL_INSPECT_STORAGE_KEY); } catch (_) {}
  }

  async function applyDeleteApprovalInspectTarget() {
    const target = readDeleteApprovalInspectTarget();
    if (!target) return false;
    if (!csvDataReady && initialCsvLoadPromise) {
      await initialCsvLoadPromise.catch(() => null);
    }
    const licenseInput = document.getElementById('licenseNumberFilter');
    if (searchEl) searchEl.value = target.name || '';
    if (licenseInput) licenseInput.value = target.license || '';
    if (searchColumnSel) {
      populateWeaponSearchColumns();
      const nameIdx = getColIndex('الاسم');
      const nameValue = nameIdx !== -1 ? `col:${nameIdx}` : '__all__';
      searchColumnSel.value = Array.from(searchColumnSel.options).some((option) => option.value === nameValue)
        ? nameValue
        : '__all__';
      updateWeaponSearchPlaceholder();
    }
    applyAllFilters();
    clearDeleteApprovalInspectTarget();
    return true;
  }
  try { window.applyDeleteApprovalInspectTarget = applyDeleteApprovalInspectTarget; } catch (_) {}
  applyDeleteApprovalInspectTarget().catch(() => {});

  // Name/license search is applied automatically as the user types.
  sectorEl   && sectorEl.addEventListener('change', () => { onSectorChange(); applyAllFilters(); });
  stationBox && stationBox.addEventListener('change', () => {
    try { updateSelectedStationsLabel(); } catch {}
    applyAllFilters();
  });
  pageSizeEl && pageSizeEl.addEventListener('change', () => { currentPage = 1; renderPage(); });
  function resetTableContainerScroll() {
    const container = document.getElementById('csvPreviewContainer');
    if (!container) return;
    try { container.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) { container.scrollTop = 0; }
  }
  prevBtn && prevBtn.addEventListener('click', (ev) => {
    try { ev && ev.preventDefault && ev.preventDefault(); ev && ev.stopPropagation && ev.stopPropagation(); } catch (_) {}
    if (currentPage > 1) {
      currentPage--;
      renderPage({ preserveScroll: true, tableScrollTop: 0 });
      resetTableContainerScroll();
    }
  });

  nextBtn && nextBtn.addEventListener('click', (ev) => {
    try { ev && ev.preventDefault && ev.preventDefault(); ev && ev.stopPropagation && ev.stopPropagation(); } catch (_) {}
    const total = filteredIndex.length;
    const pages = Math.max(1, Math.ceil(total / getPageSize()));
    if (currentPage < pages) {
      currentPage++;
      renderPage({ preserveScroll: true, tableScrollTop: 0 });
      resetTableContainerScroll();
    }
  });

  /******** EXPORT: filtered rows → Excel (CSV) ********/
  function buildFilteredCSVText(indices, options = {}) {
    const csvEscape = (s) => {
      s = (s ?? '').toString().replace(/\r?\n/g, ' ').replace(/"/g, '""');
      return /[",;\t]/.test(s) ? `"${s}"` : s;
    };
    const omitSet = (() => {
      const list = Array.isArray(options?.omitColumnIndices) ? options.omitColumnIndices : [];
      const filtered = list.filter((idx) => typeof idx === 'number' && idx >= 0);
      return new Set(filtered);
    })();
    const columnOrder = options?.columnOrderMode === 'print'
      ? getPrintColumnOrder(omitSet)
      : buildBaseColumnOrder(omitSet);
    const lines = [];
    lines.push(columnOrder.map((colIdx) => csvEscape(csvHeaders[colIdx] ?? '')).join(','));
    const weaponsIdx = getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح');
    const piecesIdx = getColIndex('عدد القطع');
    const statusIdx = getColIndex('حالة السحب');
    const depositNumIdx = getColIndex('رقم الايداع', 'رقم الإيداع');
    const depositDateIdx = getColIndex('تاريخ الايداع', 'تاريخ الإيداع');
    const currentStatusFilter = getCurrentStatusFilter();
    const splitExplicitDepositField = (val) => {
      const text = String(val ?? '').trim();
      if (!text) return [];
      if (!/[|+\r\n]/.test(text)) return [text];
      return text.split(/[ \t]*\|[ \t]*|[ \t]*\+[ \t]*|\r?\n/).map((p) => p.trim());
    };
    const splitDepositNumberField = (val) => {
      const parts = splitExplicitDepositField(val);
      if (parts.length !== 1) return parts;
      const tokens = extractDepositNumberParts(parts[0]);
      return tokens.length > 1 ? tokens : parts;
    };
    const splitDepositDateField = (val) => {
      const parts = splitExplicitDepositField(val);
      if (parts.length !== 1) return parts;
      const tokens = extractDepositDateParts(parts[0]);
      return tokens.length > 1 ? tokens : parts;
    };
    const entryNameForExport = (entry, fallback) => {
      if (entry && typeof entry.cleanName === 'string' && entry.cleanName.trim()) {
        return entry.cleanName.trim();
      }
      return stripWithdrawTag(fallback ?? '').trim();
    };
    const joinEntryNamesForExport = (entries, fallback) => {
      const names = (Array.isArray(entries) ? entries : [])
        .map((entry) => entryNameForExport(entry, fallback))
        .filter(Boolean);
      return names.length ? names.join(' + ') : stripWithdrawTag(fallback ?? '');
    };
    const joinSelectedDepositParts = (parts, entries, fallback) => {
      if (!Array.isArray(parts) || !parts.length || !Array.isArray(entries) || !entries.length) {
        return fallback ?? '';
      }
      const selected = entries
        .map((entry) => {
          const idx = entry && typeof entry.index === 'number' ? entry.index : null;
          return idx === null ? '' : (parts[idx] ?? '');
        })
        .map((part) => String(part || '').trim())
        .filter(Boolean);
      return selected.length ? selected.join(' + ') : (fallback ?? '');
    };
    indices.forEach(i => {
      const row = csvAll[i] || [];
      let weaponEntries = [];
      if (weaponsIdx !== -1) {
        weaponEntries = getWeaponEntriesForRow(row, weaponsIdx, i);
      }
      const rowSummaryStatus = rowStatus(row, i);
      const filteredEntries = weaponEntries.length
        ? filterWeaponEntriesByStatus(weaponEntries, currentStatusFilter)
        : [];
      const entriesToEmit = weaponEntries.length
        ? (filteredEntries.length ? filteredEntries : (currentStatusFilter === 'both' ? weaponEntries : []))
        : [null];
      let finalEntries = entriesToEmit;
      if (!finalEntries.length && currentStatusFilter === 'got' && rowSummaryStatus === 'got') {
        finalEntries = weaponEntries.length ? weaponEntries : [null];
      }
      if (!finalEntries.length) return;
      const depositNumParts = depositNumIdx !== -1 ? splitDepositNumberField(row[depositNumIdx]) : [];
      const depositDateParts = depositDateIdx !== -1 ? splitDepositDateField(row[depositDateIdx]) : [];
      const useSelectedDepositParts = currentStatusFilter !== 'both' && weaponEntries.length > 1;
      const rawVals = columnOrder.map((colIdx) => {
        if (piecesIdx !== -1 && colIdx === piecesIdx) {
          const piecesCount = computePiecesCountForStatus(row, weaponsIdx, piecesIdx, currentStatusFilter, i);
          return Number.isFinite(piecesCount) ? piecesCount : '';
        }
        if (weaponsIdx !== -1 && colIdx === weaponsIdx) {
          return joinEntryNamesForExport(finalEntries, row[colIdx] ?? '');
        }
        if (statusIdx !== -1 && colIdx === statusIdx) {
          return row[colIdx] ?? '';
        }
        if (useSelectedDepositParts && depositNumIdx !== -1 && colIdx === depositNumIdx) {
          return joinSelectedDepositParts(depositNumParts, finalEntries, row[colIdx] ?? '');
        }
        if (useSelectedDepositParts && depositDateIdx !== -1 && colIdx === depositDateIdx) {
          return joinSelectedDepositParts(depositDateParts, finalEntries, row[colIdx] ?? '');
        }
        return row[colIdx] ?? '';
      });
      lines.push(rawVals.map(csvEscape).join(','));
    });
    return '\uFEFF' + lines.join('\r\n');
  }

  function statusCodeToExportLabel(code) {
    switch (code) {
      case 'got':
        return 'مسحوب';
      case 'partial':
        return 'سحب جزئي';
      case 'not':
        return 'غير مسحوب';
      default:
        return 'غير مسحوب';
    }
  }

  function persistExportMeta(meta) {
    try { localStorage.setItem(EXPORT_META_STORAGE_KEY, JSON.stringify(meta || {})); } catch (_) {}
  }

  function buildSelectedStationExportTitle(selectedStations) {
    const names = Array.isArray(selectedStations)
      ? selectedStations.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    if (!names.length) return '';
    if (names.length === 1) return `قسم ${names[0]}`;
    return `الأقسام المحددة: ${names.join('، ')}`;
  }

  function buildExportStatusMeta(indices) {
    const idxList = Array.isArray(indices) ? indices : [];
    const statusValue = getCurrentStatusFilter();
    const statusLabel = getStatusLabel(statusValue);
    const meta = { statusValue, statusLabel };
    const sectorText = sectorEl?.selectedOptions?.[0]?.textContent?.trim() || '';
    const weaponsColIdx = getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح');
    const piecesColIdx = getColIndex('عدد القطع');
    const selectedStations = Array
      .from(document.querySelectorAll('#stationDropdownList input[type=checkbox]:checked'))
      .map((cb) => String(cb.value || '').trim())
      .filter(Boolean);
    const selectedStationTitle = buildSelectedStationExportTitle(selectedStations);
    const weaponTotals = computeWeaponsStatsForFiltered(idxList, weaponsColIdx, piecesColIdx)
      || { total: 0, withdrawn: 0, notWithdrawn: 0 };
    meta.totals = {
      records: idxList.length,
      weaponsTotal: Math.max(0, Number(weaponTotals.total) || 0),
      withdrawnWeapons: Math.max(0, Number(weaponTotals.withdrawn) || 0),
      notWithdrawnWeapons: Math.max(0, Number(weaponTotals.notWithdrawn) || 0)
    };
    meta.hasSelectedStation = selectedStations.length > 0;
    if (selectedStationTitle) meta.selectedStationTitle = selectedStationTitle;
    meta.overallSummaryLabel = sectorEl && sectorEl.value
      ? `إجمالي ${sectorText || 'القطاع'}`
      : 'الإجمالي العام';
    if (statusValue === 'got' || statusValue === 'not') {
      meta.tableTitle = selectedStationTitle
        ? `${selectedStationTitle} - ${statusLabel || ''}`.replace(/\s+-\s*$/, '')
        : (statusLabel || '');
    } else {
      if (selectedStationTitle) meta.tableTitle = selectedStationTitle;
    }

    meta.recordStatusLabels = [];
    meta.recordWeaponStatusLabels = [];

    idxList.forEach((rowIdx) => {
      try {
        const row = csvAll[rowIdx] || [];
        const weaponEntries = (weaponsColIdx !== -1) ? getWeaponEntriesForRow(row, weaponsColIdx, rowIdx) : [];
        const rowSummaryStatus = rowStatus(row, rowIdx);
        
        // Match buildFilteredCSVText: one exported row per source record.
        const filteredEntries = weaponEntries.length
          ? filterWeaponEntriesByStatus(weaponEntries, statusValue)
          : [];
        const entriesToEmit = weaponEntries.length
          ? (filteredEntries.length ? filteredEntries : (statusValue === 'both' ? weaponEntries : []))
          : [null];
        
        let finalEntries = entriesToEmit;
        if (!finalEntries.length && statusValue === 'got' && rowSummaryStatus === 'got') {
          finalEntries = weaponEntries.length ? weaponEntries : [null];
        }
        
        if (!finalEntries.length) return;

        const summary = summarizeRowWeapons(row, rowIdx);
        const overallLabel = statusCodeToExportLabel(summary ? summary.summaryCode : 'not');
        const perWeaponLabels = (summary && Array.isArray(summary.entries)) 
          ? summary.entries.map((entry) => entry && entry.withdrawn ? 'مسحوب' : 'غير مسحوب')
          : [];

        meta.recordStatusLabels.push(overallLabel);
        if (finalEntries.some((entry) => entry && typeof entry.cleanName === 'string' && entry.cleanName.length)) {
          meta.recordWeaponStatusLabels.push(finalEntries.map((entry) => entry && entry.withdrawn ? 'مسحوب' : 'غير مسحوب'));
        } else {
          meta.recordWeaponStatusLabels.push(perWeaponLabels);
        }
      } catch (_) {
        meta.recordStatusLabels.push('غير مسحوب');
        meta.recordWeaponStatusLabels.push([]);
      }
    });

    if (!meta.hasSelectedStation) {
      meta.stationFooterSummaries = computeStationFooterSummaries(idxList, weaponsColIdx, piecesColIdx);
    }
    persistExportMeta(meta);
    return meta;
  }

  // Reformat CSV text so any date-like column values render as yyyy/mm/dd
  function reformatCsvDatesText(csvText) {
    try {
      const text = String(csvText || '');
      const lines = text.split(/\r?\n/);
      if (!lines.length) return text;
      const SEP = /,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)|;|\t/;
      const unq = (s) => String(s || '').replace(/^\uFEFF?\s*["']?|["']\s*$/g, '').replace(/""/g, '"').trim();
      const esc = (s) => {
        s = (s ?? '').toString().replace(/\r?\n/g, ' ').replace(/"/g, '""');
        return /[",;\t]/.test(s) ? `"${s}"` : s;
      };
      const rows = lines.filter(l => l.trim().length).map(l => l.split(SEP).map(unq));
      if (!rows.length) return text;
      const headers = rows[0];
      const out = [headers.map(esc).join(',')];
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const mapped = row.map((val, ci) => _maybeFormatDate(headers[ci] || '', val));
        out.push(mapped.map(esc).join(','));
      }
      return '\uFEFF' + out.join('\r\n');
    } catch { return String(csvText || ''); }
  }

  function fallbackDownloadCSV(csvText, filename) {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'filtered_data.xlsx.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function tryOpenExcelDeepLinkWithUrl(url) {
    // Use Excel protocol handler to open the server-hosted temp CSV directly in Excel
    const excelDeepLink = 'ms-excel:ofe|u|' + url;
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const timer = setTimeout(() => {
      // Fallback: open the HTTP(S) URL in a new tab (user can open in Excel)
      try { window.open(url, '_blank'); } catch(_) {}
      try { document.body.removeChild(iframe); } catch(_) {}
    }, 1200);

    iframe.src = excelDeepLink;
    window.addEventListener('blur', () => {
      // Likely switched to Excel
      clearTimeout(timer);
      try { document.body.removeChild(iframe); } catch(_) {}
    }, { once: true });
  }

  async function saveTempCsvOnServer(csvText) {
    // Try a few conventional endpoints; backend should save the CSV to a temp file
    // and respond with either JSON { url } or a Location header, or a plain text URL.
    const candidates = buildWeaponsApiCandidates(['/api/save-temp-csv', '/api/temp-csv', '/api/upload-temp-csv']);
    for (const ep of candidates) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: csvText
        });
        if (!res.ok) continue;
        const loc = res.headers.get('Location');
        if (loc) return new URL(loc, location.href).href;
        const ct = (res.headers.get('Content-Type') || '').toLowerCase();
        if (ct.includes('application/json')) {
          const j = await res.json();
          if (j && j.url) return new URL(j.url, location.href).href;
        }
        const t = await res.text();
        if (t) return new URL(t, location.href).href;
      } catch (_) { /* ignore and try next */ }
    }
    throw new Error('No temp endpoint available');
  }

  /** Export current filtered rows: try server temp → open in Excel; else download CSV */
  async function exportFilteredToExcel() {
    try {
      const idx = sortIndexMap(computeIndexMap());
      if (!idx.length) {
        showToast('لا توجد صفوف مطابقة للتصدير', 'error');
        return;
      }
      const csvText = buildFilteredCSVText(idx);

      // Preferred path: request a styled XLSX and open it via the server (Excel table: White, TableStyleMedium15)
      try {
        const res = await fetch(buildWeaponsApiUrl('/api/open-temp-xlsx'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: csvText
        });
        if (res.ok) return; // Excel should open immediately on the host
        if (res.status === 501) throw new Error('exceljs not installed');
      } catch (e) {
        console.warn('open-temp-xlsx failed, trying CSV route...', e);
      }

      // Next best: open CSV immediately from server (no styling but instant open)
      try {
        const res = await fetch(buildWeaponsApiUrl('/api/open-temp-csv'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: csvText
        });
        if (res.ok) return; // Excel should open immediately
      } catch (e) {
        console.warn('open-temp-csv failed, trying deep link...', e);
      }

      // Fallback 1: save a temp CSV or XLSX and deep-link Excel to the URL
      try {
        // Prefer XLSX deep-link if backend supported
        try {
          const res = await fetch(buildWeaponsApiUrl('/api/save-temp-xlsx'), {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: csvText
          });
          if (res.ok) {
            const j = await res.json().catch(() => null);
            const url = j && j.url ? new URL(j.url, location.href).href : null;
            if (url) { tryOpenExcelDeepLinkWithUrl(url); return; }
          }
        } catch (_) { /* ignore; try CSV temp */ }

        const tempUrl = await saveTempCsvOnServer(csvText);
        tryOpenExcelDeepLinkWithUrl(tempUrl);
        return;
      } catch (serverErr) {
        console.warn('Temp save not available, falling back to download:', serverErr);
      }

      // Fallback: client-side download (Excel opens CSV)
      const stamp = new Date().toISOString().replace(/[:.]/g,'-');
      fallbackDownloadCSV(csvText, `filtered_slah.csv`);
    } catch (e) {
      console.error('exportFilteredToExcel failed:', e);
      showToast('تعذر إنشاء ملف Excel مؤقت', 'error');
    }
  }
  function readColumnRatiosSnapshot() {
    try {
      const table = document.getElementById('csvPreview');
      if (!table) return null;
      const headerCells = table.querySelectorAll('thead th');
      if (!headerCells || !headerCells.length) return null;
      let totalWidth = 0;
      const widths = Array.from(headerCells).map((th) => {
        const width = parseFloat(window.getComputedStyle(th).width) || 0;
        totalWidth += width;
        return width;
      });
      if (!totalWidth) return null;
      return widths.map((w) => (w && totalWidth ? (w / totalWidth) : 0));
    } catch (err) {
      console.warn('readColumnRatiosSnapshot failed', err);
      return null;
    }
  }

  async function submitPrintJob(idx) {
    const currentStatus = getCurrentStatusFilter();
    const statusColumnIndices = [];
    // Only omit the status column when a specific filter is active (got/not).
    // When filter is 'both' (كل), keep the column so the user can see each row's status.
    if (currentStatus !== 'both') {
      for (let colIdx = 0; colIdx < csvHeaders.length; colIdx++) {
        const headerName = (csvHeaders[colIdx] || '').trim();
        if (headerName === 'حالة السحب') statusColumnIndices.push(colIdx);
      }
    }
    const omitSet = new Set(statusColumnIndices);
    const printColumnOrder = getPrintColumnOrder(omitSet);
    const csvText = buildFilteredCSVText(idx, {
      columnOrderMode: 'print',
      omitColumnIndices: statusColumnIndices
    });
    const columnRatios = readColumnRatiosSnapshot();
    const columnWidths = readPrintColumnWidthsSnapshot(printColumnOrder);
    const options = {
      font: { name: 'Calibri', size: 19 },
      columnWidths: (columnWidths && columnWidths.length) ? columnWidths : null,
      columnRatios: (columnRatios && columnRatios.length) ? columnRatios : null,
      tableStyle: 'TableStyleMedium15',
      pageSetup: {
        orientation: 'landscape',
        paperSize: 8,
        margins: { left: 0.25, right: 0.25, top: 0.25, bottom: 0.25, header: 0.2, footer: 0.2 }
      },
      headerBold: true,
      headerAlign: { horizontal: 'center', vertical: 'middle' }
    };

    const exportMeta = buildExportStatusMeta(idx);
    if (exportMeta) {
      options.exportMeta = exportMeta;
      persistExportMeta(exportMeta);
    }

    try {
      const res = await fetch(buildWeaponsApiUrl('/api/open-temp-xlsx-opts-print'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, options })
      });
      if (!res.ok) {
        const err = `HTTP ${res.status}: ${res.statusText}`;
        throw new Error(err);
      }
      const data = await res.json().catch(() => null);
      if (data && data.ok === false) {
        throw new Error(data.message || 'تعذر إنشاء ملف الطباعة');
      }
      return true;
    } catch (err) {
      console.error('Excel print request failed:', err);
      showToast('تعذر إرسال البيانات للطباعة: ' + (err?.message || 'خطأ غير معروف'), 'error');
      return false;
    }
  }

  // === Row Warning Indicator Helpers ===
  function computeRowProblems(rowData, rowOrigIdx) {
    const problems = [];
    const row = rowData || [];

    // settings.js is lazy-loaded; fall back to localStorage so saved choices apply on first render
    const modelSettings = getWeaponsModelSettings();
    if (modelSettings && !modelSettings.enabled) {
      return problems; // Model is entirely disabled
    }

    const nameIdx = getColIndex('الاسم');
    const addressIdx = getColIndex('العنوان');
    const weaponsIdx = getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح');
    const decisionIdx = getColIndex('تاريخ قرار اللغاء', 'تاريخ قرار الالغاء', 'تاريخ قرار الإلغاء');
    const licenseIdx = getColIndex('رقم', 'رقم القيد');
    const depositNumberIdx = getColIndex('رقم الايداع', 'رقم الإيداع');
    const depositDateIdx = getColIndex('تاريخ الايداع', 'تاريخ الإيداع');
    const depositNotesIdx = getColIndex('ملاحظات', 'ملاحظة');
    const statusIdx = getColIndex('حالة السحب');
    const digitRegex = /[0-9\u0660-\u0669\u06F0-\u06F9]/;

    const nameVal = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
    const addressVal = addressIdx !== -1 ? String(row[addressIdx] || '').trim() : '';
    const weaponVal = weaponsIdx !== -1 ? String(row[weaponsIdx] || '').trim() : '';
    const decisionVal = decisionIdx !== -1 ? String(row[decisionIdx] || '').trim() : '';
    const depositNumberVal = depositNumberIdx !== -1 ? String(row[depositNumberIdx] || '').trim() : '';
    const depositDateVal = depositDateIdx !== -1 ? String(row[depositDateIdx] || '').trim() : '';
    const depositNotesVal = depositNotesIdx !== -1 ? String(row[depositNotesIdx] || '').trim() : '';
    const statusVal = statusIdx !== -1 ? String(row[statusIdx] || '').trim() : '';
    const noteSuggestsWithdrawal = noteContainsWithdrawKeyword(depositNotesVal);
    const withdrawn = (statusVal === 'مسحوب') || noteSuggestsWithdrawal;
    let hasWithdrawnWeapon = withdrawn;
    try {
      if (typeof summarizeRowWeapons === 'function') {
        const summary = summarizeRowWeapons(row, rowOrigIdx);
        if (summary && typeof summary.withdrawnCount === 'number') {
          hasWithdrawnWeapon = hasWithdrawnWeapon || summary.withdrawnCount > 0;
        }
        if (summary && summary.summaryCode === 'got') {
          hasWithdrawnWeapon = true;
        }
      }
    } catch (_) {}

    const depositFieldsConfigured = (depositNumberIdx !== -1) || (depositDateIdx !== -1) || (depositNotesIdx !== -1);
    const depositNumberPresent = Boolean(depositNumberVal);
    const depositDatePresent = Boolean(depositDateVal);
    const depositNotesPresent = Boolean(depositNotesVal);

    const modelApi = (typeof window !== 'undefined') ? window.WeaponsModelAI : null;
    let modelDepositHint = false;
    if (modelApi) {
      try {
        if (typeof modelApi.hasRowHint === 'function' && modelApi.hasRowHint(rowOrigIdx)) {
          modelDepositHint = true;
        } else if (typeof modelApi.noteImpliesDeposit === 'function') {
          modelDepositHint = !!modelApi.noteImpliesDeposit(depositNotesVal);
        }
      } catch (_) {}
    }

    if (nameIdx !== -1 && !nameVal) {
      problems.push('الاسم مفقود');
    }
    // Address warning - check setting
    if (addressIdx !== -1 && !addressVal && (!modelSettings || modelSettings.warnMissingAddress !== false)) {
      problems.push('العنوان مفقود');
    }
    if (weaponsIdx !== -1 && !weaponVal) {
      problems.push('بيانات السلاح مفقودة');
    }
    if (decisionIdx !== -1 && !decisionVal) {
      problems.push('تاريخ القرار مفقود');
    }
    // Weapon numbers warning - check setting (skip decorative weapons)
    const isDecorativeWeaponCheck = modelApi && typeof modelApi.isDecorativeWeapon === 'function'
      ? modelApi.isDecorativeWeapon(weaponVal)
      : false;
    if (weaponsIdx !== -1 && weaponVal && !digitRegex.test(weaponVal) && !isDecorativeWeaponCheck && (!modelSettings || modelSettings.warnMissingWeaponNumbers !== false)) {
      problems.push('بيانات سلاح بلا أرقام');
    }
    // Missing deposit warning - check setting
    if (hasWithdrawnWeapon && depositFieldsConfigured && !depositNumberPresent && !modelDepositHint && (!modelSettings || modelSettings.warnMissingDeposit !== false)) {
      const hasOtherDepositInfo = depositDatePresent || depositNotesPresent;
      const suffix = hasOtherDepositInfo ? ' (يوجد بيانات إيداع أخرى لكنها بلا رقم)' : '';
      problems.push('مسحوب بلا رقم إيداع' + suffix);
    }
    if (statusIdx !== -1 && !hasWithdrawnWeapon && depositNumberPresent) {
      problems.push('رقم إيداع لسلاح غير مسحوب');
    }
    // Harz status warning - check setting
    if (noteSuggestsWithdrawal && statusVal !== 'مسحوب' && (!modelSettings || modelSettings.warnHarzStatus !== false)) {
      problems.push('الملاحظات تشير لوجود حرز ولكن السجل غير مسحوب');
    }

    // Caliber analysis warning - check setting
    if (weaponVal && modelApi && typeof modelApi.analyzeCaliber === 'function' && (!modelSettings || modelSettings.warnCaliberIssues !== false)) {
      try {
        // Analyze each weapon segment for caliber issues
        const segments = weaponVal.split('+').map(s => s.trim()).filter(Boolean);
        for (const segment of segments) {
          const caliberIssue = modelApi.analyzeCaliber(segment);
          if (caliberIssue && caliberIssue.issue) {
            problems.push(caliberIssue.shortMessage);
            break; // Only show one caliber warning per row
          }
        }
      } catch (_) {}
    }

    return problems;
  }

  let __rowWarningTooltip = null;

  function showRowWarningTooltip(anchor, problems) {
    hideRowWarningTooltip();
    if (!problems || !problems.length) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'row-warning-tooltip';
    tooltip.innerHTML = `
      <div class="row-warning-tooltip-title">⚠️ تنبيهات السجل</div>
      <ul class="row-warning-tooltip-list">
        ${problems.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
      </ul>
    `;

    document.body.appendChild(tooltip);
    __rowWarningTooltip = tooltip;

    // Position the tooltip
    const rect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    let top = rect.top + window.scrollY - tooltipRect.height - 8;
    let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipRect.width / 2);

    // Keep within viewport
    if (top < window.scrollY + 10) {
      top = rect.bottom + window.scrollY + 8;
    }
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }

    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
    tooltip.style.opacity = '1';
    tooltip.style.transform = 'translateY(0)';
  }

  function hideRowWarningTooltip() {
    if (__rowWarningTooltip) {
      __rowWarningTooltip.remove();
      __rowWarningTooltip = null;
    }
  }

  function collectPrintDefenseIssues(indices) {
    const summary = {
      totalRows: Array.isArray(indices) ? indices.length : 0,
      hasIssues: false,
      globalIssues: [],
      people: []
    };
    if (!Array.isArray(indices) || !indices.length) return summary;

    const nameIdx = getColIndex('الاسم');
    const addressIdx = getColIndex('العنوان');
  const weaponsIdx = getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح');
  const decisionIdx = getColIndex('تاريخ قرار اللغاء', 'تاريخ قرار الالغاء', 'تاريخ قرار الإلغاء');
  const licenseIdx = getColIndex('رقم', 'رقم القيد');
  const depositNumberIdx = getColIndex('رقم الايداع', 'رقم الإيداع');
  const depositDateIdx = getColIndex('تاريخ الايداع', 'تاريخ الإيداع');
  const depositNotesIdx = getColIndex('ملاحظات', 'ملاحظة');
  const statusIdx = getColIndex('حالة السحب');
  const digitRegex = /[0-9\u0660-\u0669\u06F0-\u06F9]/;
  const hasStatusColumn = statusIdx !== -1;
  const modelApi = (typeof window !== 'undefined') ? window.WeaponsModelAI : null;

  const rowHasModelDepositHint = (rowIdx, noteText) => {
    if (!modelApi) return false;
    try {
      if (typeof modelApi.hasRowHint === 'function' && modelApi.hasRowHint(rowIdx)) return true;
      if (typeof modelApi.noteImpliesDeposit === 'function') {
        return modelApi.noteImpliesDeposit(noteText);
      }
    } catch (err) {
      console.warn('[ModelAI] lookup failed', err);
    }
    return false;
  };

    const missingColumns = [];
    if (nameIdx === -1) missingColumns.push('الاسم');
    if (addressIdx === -1) missingColumns.push('العنوان');
    if (weaponsIdx === -1) missingColumns.push('بيانات السلاح');
    if (decisionIdx === -1) missingColumns.push('تاريخ قرار الإلغاء');
  if (depositNumberIdx === -1) missingColumns.push('رقم الايداع');
  if (depositDateIdx === -1) missingColumns.push('تاريخ الايداع');
  if (depositNotesIdx === -1) missingColumns.push('ملاحظات');

    const normalizeLicenseKey = (value) => toLatinDigits(String(value ?? '')).replace(/\s+/g, '').toLowerCase();
    const normalizeNameKey = (value) => String(value ?? '').trim().toLowerCase();

    const licenseNameGroups = new Map();
    const tripletGroups = new Map();

    const personBuckets = new Map();
    const severityRank = { info: 0, warning: 1, critical: 2 };

    const buildRowSample = (rowIdx, extra) => {
      const row = csvAll[rowIdx] || [];
      return {
        name: nameIdx !== -1 ? (row[nameIdx] || '').trim() : `سجل #${rowIdx + 1}`,
        license: licenseIdx !== -1 ? (row[licenseIdx] || '').trim() : '',
        weapon: weaponsIdx !== -1 ? (row[weaponsIdx] || '').trim() : '',
        rowNumber: rowIdx + 1,
        extra: extra ? String(extra) : ''
      };
    };

    const personKeyForRow = (rowIdx) => {
      const row = csvAll[rowIdx] || [];
      const rawName = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
      if (rawName) return `name|${rawName}`;
      return `row|${rowIdx}`;
    };

    const ensurePerson = (rowIdx) => {
      const key = personKeyForRow(rowIdx);
      if (personBuckets.has(key)) return personBuckets.get(key);
      const row = csvAll[rowIdx] || [];
      const displayName = nameIdx !== -1 && String(row[nameIdx] || '').trim()
        ? String(row[nameIdx] || '').trim()
        : `سجل بلا اسم #${rowIdx + 1}`;
      const person = {
        key,
        name: displayName,
        licenses: new Set(),
        rows: new Set(),
        issuesMap: new Map()
      };
      personBuckets.set(key, person);
      return person;
    };

    const addPersonIssue = (rowIdx, issueId, title, description, severity = 'info', extraSampleText) => {
      const person = ensurePerson(rowIdx);
      person.rows.add(rowIdx);
      const row = csvAll[rowIdx] || [];
      const licenseVal = licenseIdx !== -1 ? String(row[licenseIdx] || '').trim() : '';
      if (licenseVal) person.licenses.add(licenseVal);
      if (!person.issuesMap.has(issueId)) {
        person.issuesMap.set(issueId, {
          id: issueId,
          title,
          description,
          severity,
          rows: new Set(),
          samples: []
        });
      }
      const issue = person.issuesMap.get(issueId);
      issue.rows.add(rowIdx);
      if (issue.samples.length < 5) issue.samples.push(buildRowSample(rowIdx, extraSampleText));
      // If any occurrence is higher severity, keep the highest
      const prevRank = severityRank[issue.severity] ?? 0;
      if ((severityRank[severity] ?? 0) > prevRank) issue.severity = severity;
    };

    indices.forEach((rowIdx) => {
      const row = csvAll[rowIdx] || [];
      const nameVal = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
      const addressVal = addressIdx !== -1 ? String(row[addressIdx] || '').trim() : '';
      const weaponVal = weaponsIdx !== -1 ? String(row[weaponsIdx] || '').trim() : '';
      const decisionVal = decisionIdx !== -1 ? String(row[decisionIdx] || '').trim() : '';
      const licenseVal = licenseIdx !== -1 ? String(row[licenseIdx] || '').trim() : '';
  const depositNumberVal = depositNumberIdx !== -1 ? String(row[depositNumberIdx] || '').trim() : '';
  const depositDateVal = depositDateIdx !== -1 ? String(row[depositDateIdx] || '').trim() : '';
  const depositNotesVal = depositNotesIdx !== -1 ? String(row[depositNotesIdx] || '').trim() : '';
  const depositNumberPresent = Boolean(depositNumberVal);
  const depositDatePresent = Boolean(depositDateVal);
  const depositNotesPresent = Boolean(depositNotesVal);
  const depositFieldsConfigured = (depositNumberIdx !== -1) || (depositDateIdx !== -1) || (depositNotesIdx !== -1);
  const modelDepositHint = rowHasModelDepositHint(rowIdx, depositNotesVal);
      const statusVal = hasStatusColumn ? String(row[statusIdx] || '').trim() : '';
      const noteSuggestsWithdrawal = noteContainsWithdrawKeyword(depositNotesVal);
      const withdrawn = (statusVal === 'مسحوب') || noteSuggestsWithdrawal;
      let hasWithdrawnWeapon = withdrawn;
      try {
        const summary = (typeof summarizeRowWeapons === 'function') ? summarizeRowWeapons(row, rowIdx) : null;
        if (summary && typeof summary.withdrawnCount === 'number' && summary.withdrawnCount > 0) {
          hasWithdrawnWeapon = true;
        }
        if (summary && summary.summaryCode === 'got') {
          hasWithdrawnWeapon = true;
        }
      } catch (_) {}

      if (nameIdx !== -1 && !nameVal) {
        addPersonIssue(rowIdx, 'missing-name', 'الاسم مفقود', 'السجل لا يحتوي على الاسم.', 'critical');
      }
      if (addressIdx !== -1 && !addressVal) {
        addPersonIssue(rowIdx, 'missing-address', 'العنوان مفقود', 'لا يوجد عنوان مسجل.');
      }
      if (weaponsIdx !== -1 && !weaponVal) {
        addPersonIssue(rowIdx, 'missing-weapons', 'بيانات السلاح مفقودة', 'لم يتم إدخال بيانات السلاح.', 'warning');
      }
      if (decisionIdx !== -1 && !decisionVal) {
        addPersonIssue(rowIdx, 'missing-decision', 'تاريخ القرار مفقود', 'لا يوجد تاريخ صدور قرار.');
      }
      const isDecorativeInPrint = (typeof window !== 'undefined' && window.WeaponsModelAI && typeof window.WeaponsModelAI.isDecorativeWeapon === 'function')
        ? window.WeaponsModelAI.isDecorativeWeapon(weaponVal)
        : false;
      if (weaponsIdx !== -1 && weaponVal && !digitRegex.test(weaponVal) && !isDecorativeInPrint) {
        addPersonIssue(rowIdx, 'nonumber-weapons', 'بيانات سلاح بلا أرقام', 'بيان السلاح لا يحتوي على أي أرقام.', 'warning');
      }

      if (hasWithdrawnWeapon && depositFieldsConfigured && !depositNumberPresent) {
        if (modelDepositHint) {
          // Skip flagging rows where the AI detected a deposit number mention in notes.
        } else {
        const issueId = 'withdraw-missing-deposit-number';
        const extra = (depositDatePresent || depositNotesPresent)
          ? 'يوجد بيانات إيداع أخرى'
          : '';
        const desc = 'السجل مسجل كسحب لكن رقم الإيداع غير مدخل.';
        addPersonIssue(rowIdx, issueId, 'مسحوب بلا رقم إيداع', desc, 'critical', extra);
        }
      }

      if (hasStatusColumn && !hasWithdrawnWeapon && depositNumberPresent) {
        addPersonIssue(rowIdx, 'deposit-number-without-withdraw', 'رقم إيداع لسلاح غير مسحوب', 'تم إدخال رقم إيداع بينما العمود لا يشير إلى أن السجل مسحوب.', 'warning');
      }

      const licKey = (licenseIdx !== -1) ? normalizeLicenseKey(row[licenseIdx]) : '';
      const nameKey = (nameIdx !== -1) ? normalizeNameKey(row[nameIdx]) : '';
      const weaponKey = (weaponsIdx !== -1) ? normalizeWeaponKey(row[weaponsIdx]) : '';

      if (licKey && nameKey) {
        const key = `${licKey}::${nameKey}`;
        if (!licenseNameGroups.has(key)) licenseNameGroups.set(key, []);
        licenseNameGroups.get(key).push(rowIdx);
      }
      if (licKey && nameKey && weaponKey) {
        const key = `${licKey}::${nameKey}::${weaponKey}`;
        if (!tripletGroups.has(key)) tripletGroups.set(key, []);
        tripletGroups.get(key).push(rowIdx);
      }
    });

    licenseNameGroups.forEach((rows) => {
      if (rows.length <= 1) return;
      rows.forEach((rowIdx) => {
        addPersonIssue(rowIdx, 'dup-license-name', 'تكرار الاسم مع رقم القيد', `هذا الشخص له ${rows.length} سجلات بنفس رقم القيد.`, 'warning', `عدد السجلات: ${rows.length}`);
      });
    });

    tripletGroups.forEach((rows) => {
      if (rows.length <= 1) return;
      rows.forEach((rowIdx) => {
        addPersonIssue(rowIdx, 'dup-triplet', 'سجل متطابق بالكامل', `تم العثور على ${rows.length} سجلات بنفس الاسم ورقم القيد وبيان السلاح.`, 'critical', `عدد التطابقات: ${rows.length}`);
      });
    });

    if (missingColumns.length) {
      summary.globalIssues.push({
        id: 'missing-columns',
        title: 'أعمدة أساسية غير موجودة',
        description: 'ملف CSV الحالي يفتقد الأعمدة: ' + missingColumns.join('، '),
        severity: 'critical'
      });
    }

    summary.people = Array.from(personBuckets.values())
      .map((person) => {
        const issues = Array.from(person.issuesMap.values()).map((issue) => ({
          ...issue,
          count: issue.rows.size,
          indices: Array.from(issue.rows)
        }));
        if (!issues.length) return null;
        const worst = issues.reduce((rank, issue) => Math.max(rank, severityRank[issue.severity] ?? 0), 0);
        return {
          key: person.key,
          name: person.name,
          licenses: Array.from(person.licenses),
          indices: Array.from(person.rows),
          issues,
          worstSeverity: ['info', 'warning', 'critical'][worst] || 'info'
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const rankA = severityRank[a.worstSeverity] ?? 0;
        const rankB = severityRank[b.worstSeverity] ?? 0;
        if (rankA !== rankB) return rankB - rankA;
        return (b.issues.length - a.issues.length) || a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' });
      });

    summary.hasIssues = summary.globalIssues.length > 0 || summary.people.length > 0;
    return summary;
  }

  function ensurePrintDefenseFrame() {
    let frame = document.getElementById('printDefenseFrame');
    if (frame) return frame;
    frame = document.createElement('div');
    frame.id = 'printDefenseFrame';
    frame.innerHTML = `
      <div class="print-defense-dialog" role="dialog" aria-modal="true">
        <div class="print-defense-header">
          <div>
            <div class="print-defense-title">⚠️ فحص البيانات قبل الطباعة</div>
            <div class="print-defense-subtitle">نوصي بمراجعة السجلات التي تحتوي على مشكلات قبل الطباعة.</div>
          </div>
          <button type="button" class="print-defense-close" data-role="print-defense-close">✖</button>
        </div>
        <div class="print-defense-actions print-defense-actions-top">
          <button type="button" class="print-defense-secondary" data-role="print-defense-back">رجوع</button>
          <button type="button" class="print-defense-primary" data-role="print-defense-proceed">طباعة على أي حال</button>
        </div>
        <div class="print-defense-body"></div>
      </div>`;
    frame.style.display = 'none';
    document.body.appendChild(frame);

    const style = document.createElement('style');
    style.id = 'printDefenseFrameStyle';
    style.textContent = `
      #printDefenseFrame{position:fixed;inset:0;background:rgba(15,23,42,0.65);display:none;align-items:center;justify-content:center;z-index:3600;padding:20px;}
      #printDefenseFrame.open{display:flex;}
      .print-defense-dialog{background:#fff;border-radius:16px;box-shadow:0 30px 80px rgba(15,23,42,0.4);padding:20px;width:min(1100px,96vw);max-height:92vh;overflow:auto;font-family:inherit;color:#0f172a;display:flex;flex-direction:column;gap:16px;}
      .print-defense-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;}
      .print-defense-title{font-size:1.4rem;font-weight:700;}
      .print-defense-subtitle{color:#475569;font-size:0.95rem;}
      .print-defense-close{border:none;background:#e2e8f0;width:36px;height:36px;border-radius:10px;font-weight:700;cursor:pointer;}
      .print-defense-body{display:flex;flex-direction:column;gap:12px;}
      .print-defense-card{border:1px solid #e5e7eb;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px;background:#f8fafc;}
      .print-defense-card-header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;}
      .print-defense-card-title{font-weight:700;color:#0f172a;}
      .print-defense-card-desc{color:#475569;font-size:0.92rem;}
      .print-defense-badge{padding:4px 10px;border-radius:999px;font-size:0.85rem;font-weight:700;}
      .print-defense-badge.warning{background:#fef3c7;color:#b45309;}
      .print-defense-badge.info{background:#dbeafe;color:#1d4ed8;}
      .print-defense-badge.critical{background:#fee2e2;color:#b91c1c;}
      .print-defense-person-meta{display:flex;flex-direction:column;gap:4px;font-size:0.9rem;color:#475569;}
      .print-defense-issue-list{display:flex;flex-direction:column;gap:8px;margin-top:4px;}
      .print-defense-issue-row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border:1px dashed #e2e8f0;border-radius:10px;padding:8px;background:#fff;}
      .print-defense-issue-row strong{color:#0f172a;}
      .print-defense-issue-details{flex:1;display:flex;flex-direction:column;gap:4px;}
      .print-defense-samples{margin:0;padding-inline-start:18px;color:#0f172a;font-size:0.88rem;}
      .print-defense-samples li{list-style:disc;margin-bottom:2px;}
      .print-defense-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;}
      .print-defense-primary{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-size:1rem;font-weight:700;cursor:pointer;}
      .print-defense-secondary{background:#fff;color:#0f172a;border:1px solid #cbd5f5;border-radius:10px;padding:10px 18px;font-size:1rem;font-weight:600;cursor:pointer;}
      .print-defense-card-actions{display:flex;justify-content:flex-start;}
      .print-defense-focus{border:none;background:#0f172a;color:#fff;border-radius:8px;padding:8px 14px;font-weight:600;cursor:pointer;}
    `;
    document.head.appendChild(style);

    const finalize = (action, category) => {
      frame.style.display = 'none';
      frame.classList.remove('open');
      const callbacks = frame.__defenseCallbacks || {};
      if (action === 'proceed') {
        callbacks.onProceed && callbacks.onProceed();
      } else {
        callbacks.onCancel && callbacks.onCancel(action, category);
      }
    };

    frame.querySelector('[data-role="print-defense-close"]').addEventListener('click', () => finalize('cancel'));
    frame.querySelector('[data-role="print-defense-back"]').addEventListener('click', () => finalize('cancel'));
    frame.querySelector('[data-role="print-defense-proceed"]').addEventListener('click', () => finalize('proceed'));
    frame.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-person-focus]');
      if (!btn) return;
      const index = Number(btn.getAttribute('data-person-focus'));
      const summary = frame.__defenseSummary;
      if (!summary || !Array.isArray(summary.people)) return;
      const person = summary.people[index];
      if (!person) return;
      if (Array.isArray(person.indices) && person.indices.length) {
        try {
          window.__auditFocusSet = new Set(person.indices);
          window.__auditFocusLabel = person.name || 'فحص مخصص';
          if (typeof window.applyAllFilters === 'function') window.applyAllFilters();
          else if (typeof window.applyFilter === 'function') window.applyFilter();
          showToast('تم تفعيل فحص: ' + (person.name || ''), 'success');
        } catch (err) {
          console.warn('apply focus failed', err);
        }
      }
      finalize('focus-person', person);
    });

    return frame;
  }

  function showPrintDefenseFrame(summary, callbacks) {
    const frame = ensurePrintDefenseFrame();
    const body = frame.querySelector('.print-defense-body');
    frame.__defenseCallbacks = callbacks || {};
    frame.__defenseSummary = summary;
    if (body) {
      if (!summary.globalIssues.length && !summary.people.length) {
        body.innerHTML = '<div style="padding:12px;text-align:center;color:#475569;">لا توجد مشاكل لعرضها.</div>';
      } else {
        const globalHtml = summary.globalIssues.map((issue) => {
          const badge = `print-defense-badge ${issue.severity || 'info'}`;
          return `
            <div class="print-defense-card">
              <div class="print-defense-card-header">
                <div>
                  <div class="print-defense-card-title">${escapeHtml(issue.title || '')}</div>
                  <div class="print-defense-card-desc">${escapeHtml(issue.description || '')}</div>
                </div>
                <div class="${badge}">تنبيه عام</div>
              </div>
            </div>`;
        }).join('');

        const peopleHtml = summary.people.map((person, idx) => {
          const badge = `print-defense-badge ${person.worstSeverity}`;
          const licenseText = person.licenses.length
            ? `أرقام القيد: ${person.licenses.map((lic) => escapeHtml(lic)).join('، ')}`
            : 'لا يوجد رقم قيد مسجل';
          const issuesHtml = person.issues.map((issue) => {
            const issueBadge = `print-defense-badge ${issue.severity}`;
            const samples = issue.samples && issue.samples.length
              ? `<ul class="print-defense-samples">${issue.samples.map((s) => {
                  const line = [
                    s.license ? `رقم القيد: ${escapeHtml(String(s.license || ''))}` : '',
                    s.rowNumber ? `رقم الصف: ${escapeHtml(String(s.rowNumber))}` : ''
                  ].filter(Boolean).join(' — ');
                  const weapon = s.weapon ? `<div style="color:#475569;">بيانات السلاح: ${escapeHtml(String(s.weapon || ''))}</div>` : '';
                  const extra = s.extra ? `<div style="color:#94a3b8;">${escapeHtml(String(s.extra))}</div>` : '';
                  return `<li>${line}${weapon}${extra}</li>`;
                }).join('')}</ul>`
              : '';
            return `
              <div class="print-defense-issue-row">
                <div class="print-defense-issue-details">
                  <strong>${escapeHtml(issue.title || '')}</strong>
                  <div>${escapeHtml(issue.description || '')}</div>
                  ${samples}
                </div>
                <div class="${issueBadge}">${escapeHtml(issue.count + ' مرة')}</div>
              </div>`;
          }).join('');
          return `
            <div class="print-defense-card" data-person="${escapeHtml(person.key)}">
              <div class="print-defense-card-header">
                <div>
                  <div class="print-defense-card-title">${escapeHtml(person.name || '')}</div>
                  <div class="print-defense-person-meta">${licenseText}</div>
                </div>
                <div class="${badge}">${escapeHtml(person.issues.length + ' مشكلة')}</div>
              </div>
              <div class="print-defense-issue-list">${issuesHtml}</div>
              <div class="print-defense-card-actions">
                <button type="button" class="print-defense-focus" data-person-focus="${idx}">فحص</button>
              </div>
            </div>`;
        }).join('');

        body.innerHTML = globalHtml + peopleHtml;
      }
    }
    frame.style.display = 'flex';
    frame.classList.add('open');
  }

  async function maybeConfirmPrintDespiteIssues(indices) {
    try {
      const summary = collectPrintDefenseIssues(indices);
      if (!summary.hasIssues) {
        return true;
      }
      return await new Promise((resolve) => {
        showPrintDefenseFrame(summary, {
          onProceed: () => resolve(true),
          onCancel: () => resolve(false)
        });
      });
    } catch (err) {
      console.warn('print defense failed, allowing print', err);
      return true;
    }
  }

  // Hook: keep old API so existing button onclick="printFiltered()" works
  window.printFiltered = async function guardedPrintFiltered() {
    try {
      const idx = sortIndexMap(computeIndexMap());
      if (!idx || !idx.length) {
        showToast('لا توجد صفوف مطابقة للطباعة', 'error');
        return;
      }
      const allowed = await maybeConfirmPrintDespiteIssues(idx);
      if (!allowed) return;
      await submitPrintJob(idx);
    } catch (e) {
      console.error('printFiltered error:', e);
      showToast('خطأ في تحضير البيانات للطباعة', 'error');
    }
  };
  // Expose helpers so print.html can use current filtered data via window.opener
  window.buildFilteredCSVText = buildFilteredCSVText;
  window.buildExportStatusMeta = buildExportStatusMeta;
  window.computeIndexMap = computeIndexMap;
  window.sortIndexMap = sortIndexMap;

  window.printFilteredBrowser = function printFilteredBrowser() {
    const indices = sortIndexMap(computeIndexMap());
    if (!indices.length) { showToast('لا توجد صفوف للطباعة', 'error'); return; }

    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const statusFilter = getCurrentStatusFilter();
    const statusColIdx = getColIndex('حالة السحب');
    const omitSet = new Set();
    if (statusFilter !== 'both' && statusColIdx !== -1) omitSet.add(statusColIdx);

    // Same column order as the Excel export. Keep columns even when all visible rows are blank.
    let colOrder = getPrintColumnOrder(omitSet);

    const stationIdx     = getColIndex('القسم', 'القسم التابع');
    const sectorIdx      = getColIndex('القطاع');
    const weaponsIdx     = getColIndex('بيانات السلاح', 'بيان السلاح', 'السلاح');
    const depositNumIdx  = getColIndex('رقم الايداع', 'رقم الإيداع');
    const depositDateIdx = getColIndex('تاريخ الايداع', 'تاريخ الإيداع');
    const rowStatusIdx   = getColIndex('حالة السحب');
    const piecesIdx      = getColIndex('عدد القطع');

    // Proportional column widths (same weights as Excel export)
    const rawW = [13, ...colOrder.map(i => getPrintColumnWidthForHeader(csvHeaders[i]))];
    const totalW = rawW.reduce((a, b) => a + b, 0);
    const pct = rawW.map(w => ((w / totalW) * 100).toFixed(1) + '%');

    // Split colOrder into: preCols (rowspan), perWeaponCols (one row per weapon), postCols (rowspan)
    const perWeaponColSet = new Set([weaponsIdx, depositNumIdx, depositDateIdx].filter(i => i !== -1));
    const preCols = [], perWeaponCols = [], postCols = [];
    let _seenWeaponGroup = false;
    for (const ci of colOrder) {
      if (perWeaponColSet.has(ci)) { _seenWeaponGroup = true; perWeaponCols.push(ci); }
      else if (_seenWeaponGroup) postCols.push(ci);
      else preCols.push(ci);
    }

    let currentStation = null, stationCounter = 0, totalLicenses = 0, totalWeapons = 0, evenRow = false;
    let rowsHtml = '';

    for (const origIdx of indices) {
      const row = csvAll[origIdx] || [];
      const station = stationIdx !== -1 ? String(row[stationIdx] || '').trim() : '';
      const sector  = sectorIdx  !== -1 ? String(row[sectorIdx]  || '').trim() : '';

      if (station !== currentStation) {
        currentStation = station; stationCounter = 0; evenRow = false;
        rowsHtml += `<tr class="stn-hdr"><td data-span-all colspan="${colOrder.length + 1}">${esc(station)}${sector ? ' — ' + esc(sector) : ''}</td></tr>`;
      }
      stationCounter++; totalLicenses++;

      const isPartialWithdrawal = rowStatusIdx !== -1
        ? normalizeWithdrawalStatusText(row[rowStatusIdx]) === 'partial'
        : false;

      const allEntries = weaponsIdx !== -1 ? getWeaponEntriesForRow(row, weaponsIdx, origIdx) : [];
      const visEntries = filterWeaponEntriesByStatus(allEntries, statusFilter);
      totalWeapons += visEntries.length || (weaponsIdx === -1 ? 1 : 0);

      const piecesCount = (piecesIdx !== -1 && weaponsIdx !== -1)
        ? computePiecesCountForStatus(row, weaponsIdx, piecesIdx, statusFilter, origIdx)
        : -1;

      const weaponCount = Math.max(visEntries.length, 1);
      const rs = weaponCount > 1 ? ` rowspan="${weaponCount}"` : '';
      const evClass = evenRow ? ' ev' : '';

      // Non-per-weapon cell builder (gets rowspan when multi-weapon)
      const buildRsCell = (ci) => {
        const v = String((row[ci] == null ? '' : row[ci])).trim();
        if (ci === piecesIdx) {
          const val = piecesCount > 0 ? String(piecesCount) : (v || '');
          return `<td data-col-key="c${ci}"${rs}>${esc(val)}</td>`;
        }
        return `<td data-col-key="c${ci}"${rs}>${esc(v)}</td>`;
      };

      // Per-weapon cells for weapon index wi
      const buildWeaponCells = (wi) => {
        const entry = visEntries[wi] || null;
        return perWeaponCols.map(ci => {
          if (ci === weaponsIdx) {
            const name = entry?.cleanName || '';
            return `<td class="wcell" data-col-key="c${ci}">${esc(isPartialWithdrawal && entry?.withdrawn ? name + ' (مسحوب)' : name)}</td>`;
          }
          const fieldKey = ci === depositNumIdx ? 'depositNumber' : 'depositDate';
          return `<td data-col-key="c${ci}">${esc(entry?.[fieldKey] || '')}</td>`;
        }).join('');
      };

      // First row: serial + preCols (rowspan) + weapon 0 + postCols (rowspan)
      let firstRow = `<td class="ser"${rs}>${stationCounter}</td>`;
      firstRow += preCols.map(buildRsCell).join('');
      firstRow += buildWeaponCells(0);
      firstRow += postCols.map(buildRsCell).join('');
      rowsHtml += `<tr class="${evClass.trim()}">${firstRow}</tr>`;

      // Extra rows for weapons 1..N-1
      for (let wi = 1; wi < weaponCount; wi++) {
        rowsHtml += `<tr class="wex${evClass}">${buildWeaponCells(wi)}</tr>`;
      }

      evenRow = !evenRow;
    }
    if (weaponsIdx === -1) totalWeapons = totalLicenses;

    const colgroup  = `<col style="width:${pct[0]}"/>` + colOrder.map((ci, i) => `<col data-col-key="c${ci}" style="width:${pct[i + 1]}"/>`).join('');
    const printHeaderLabel = (name) => (name === 'ملاحظات') ? 'اجراءات' : (name || '');
    const headerRow = `<tr><th>م</th>${colOrder.map(i => `<th data-col-key="c${i}">${esc(printHeaderLabel(csvHeaders[i]))}</th>`).join('')}</tr>`;
    const colChoicesJson = JSON.stringify(colOrder.map((ci) => ({ key: `c${ci}`, label: String(printHeaderLabel(csvHeaders[ci])) })));
    // Read active sector / station filters (needed by both summary table and location title)
    const selectedSectorText = sectorEl?.selectedOptions?.[0]?.textContent?.trim() || '';
    const selectedSectorVal  = sectorEl?.value || '';
    const selectedStations   = Array.from(
      document.querySelectorAll('#stationDropdownList input[type=checkbox]:checked')
    ).map(cb => cb.value).filter(Boolean);

    // Station summary table — same data source as the Excel footer
    const stationSummaries = computeStationFooterSummaries(indices, weaponsIdx, piecesIdx);
    const overallTotals = stationSummaries.reduce(
      (acc, s) => ({
        totalRecords:       acc.totalRecords       + s.totalRecords,
        totalWeapons:       acc.totalWeapons       + s.totalWeapons,
        withdrawnWeapons:   acc.withdrawnWeapons   + s.withdrawnWeapons,
        notWithdrawnWeapons:acc.notWithdrawnWeapons+ s.notWithdrawnWeapons
      }),
      { totalRecords: 0, totalWeapons: 0, withdrawnWeapons: 0, notWithdrawnWeapons: 0 }
    );

    const showWithdrawn    = statusFilter !== 'not';
    const showNotWithdrawn = statusFilter !== 'got';
    const summaryColCount  = 3 + (showWithdrawn ? 1 : 0) + (showNotWithdrawn ? 1 : 0);

    const summaryHeaderCells = [
      '<th>القسم</th>',
      '<th>اجمالي الرخص</th>',
      '<th>اجمالي عدد الاسلحة</th>',
      ...(showWithdrawn    ? ['<th>اجمالي الاسلحة المسحوبة</th>']     : []),
      ...(showNotWithdrawn ? ['<th>اجمالي الاسلحة الغير مسحوبة</th>'] : []),
    ].join('');

    const buildSumCells = (s) => [
      `<td class="sum-sta">${esc(s.station)}</td>`,
      `<td>${s.totalRecords}</td>`,
      `<td>${s.totalWeapons}</td>`,
      ...(showWithdrawn    ? [`<td>${s.withdrawnWeapons}</td>`]    : []),
      ...(showNotWithdrawn ? [`<td>${s.notWithdrawnWeapons}</td>`] : []),
    ].join('');

    const summaryRowsHtml = stationSummaries
      .map((s, i) => `<tr${i % 2 === 1 ? ' class="ev"' : ''}>${buildSumCells(s)}</tr>`)
      .join('');

    const summaryTableHtml = stationSummaries.length ? `
<table class="stbl">
<thead>
  <tr><td class="sum-title" colspan="${summaryColCount}">ملخص حسب القسم</td></tr>
  <tr>${summaryHeaderCells}</tr>
</thead>
<tbody>
  ${summaryRowsHtml}
  ${!selectedStations.length ? `<tr class="sum-total">${buildSumCells({ station: 'الاجمالي العام', ...overallTotals })}</tr>` : ''}
</tbody>
</table>` : '';

    const statusLabel = statusFilter === 'got' ? 'المسحوبة' : statusFilter === 'not' ? 'الغير مسحوبة' : 'الكل';
    const dateStr = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    const displayLicenses = overallTotals.totalRecords || totalLicenses;
    const displayWeapons  = overallTotals.totalWeapons  || totalWeapons;

    // Build location line from active sector / station filters
    let locationHtml = '';
    if (selectedSectorVal && selectedSectorText) {
      let loc = esc(selectedSectorText);
      if (selectedStations.length) loc += ' — ' + selectedStations.map(esc).join('، ');
      locationHtml = `<div class="loc">${loc}</div>`;
    }

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>سجل الأسلحة</title>
<style>
@page{size:A3 landscape;margin:8mm 8mm 14mm 8mm;@bottom-center{content:"صفحة " counter(page,arabic-indic) " من " counter(pages,arabic-indic);font-family:Arial,Tahoma,sans-serif;font-size:10pt;color:#333;direction:rtl}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Tahoma,sans-serif;font-size:12pt;direction:rtl;color:#000}
h1{text-align:center;font-size:18pt;margin-bottom:2mm;font-weight:bold}
.sub{text-align:center;font-size:11pt;margin-bottom:3mm;color:#444}
table{width:100%;border-collapse:collapse;table-layout:fixed}
thead th{background:#1a1a2e;color:#fff;padding:1.5mm 1mm;font-size:12pt;font-weight:bold;text-align:center;border:1px solid #000}
tbody td{padding:1mm 1mm;border:1px solid #ccc;text-align:center;vertical-align:middle;word-break:break-word;line-height:1.3}
td.ser{font-weight:bold}
td.wcell{text-align:right}
tr.ev td{background:#f0f4f8}
tr.stn-hdr td{background:#2c3e50;color:#fff;font-weight:bold;font-size:14pt;text-align:center;padding:1.5mm;border:1px solid #000}
tr.wex td{border-top:1px dashed #999}
tr.wex.ev td{background:#f0f4f8}
.loc{text-align:center;font-size:16pt;font-weight:bold;margin-bottom:2mm;color:#1a1a2e}
.stbl{width:100%;margin-top:6mm;table-layout:auto}
.stbl thead th{font-size:13pt;padding:2mm 4mm}
.stbl tbody td{font-size:13pt;padding:1.5mm 4mm}
td.sum-title{background:#1a1a2e;color:#fff;font-size:15pt;font-weight:bold;text-align:center;padding:2mm;border:1px solid #000}
tr.sum-total td{background:#f3f4f6;font-weight:bold;border-top:2px solid #000;border-bottom:2px solid #000}
td.sum-sta{text-align:right;font-weight:bold}
.print-settings{position:fixed;top:12px;left:12px;z-index:9999;font-family:Arial,Tahoma,sans-serif;direction:rtl}
.print-settings .ps-toggle{background:#1a1a2e;color:#fff;border:none;width:50px;height:50px;border-radius:50%;cursor:pointer;font-size:22px;box-shadow:0 4px 14px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;transition:transform 0.15s,box-shadow 0.15s}
.print-settings .ps-toggle:hover{transform:scale(1.08);box-shadow:0 6px 18px rgba(0,0,0,0.35)}
.print-settings .ps-content{position:absolute;top:62px;left:0;background:#fff;border-radius:16px;padding:18px;width:420px;box-shadow:0 12px 40px rgba(0,0,0,0.22);max-height:82vh;overflow-y:auto;border:1px solid #e2e8f0}
.print-settings .ps-content[hidden]{display:none}
.print-settings h3{font-size:14pt;margin:0 0 14px;color:#1a1a2e;text-align:center;padding-bottom:12px;border-bottom:1px solid #e2e8f0;font-weight:700}
.print-settings .ps-list{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
.print-settings .ps-item{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;cursor:pointer;border:2px solid #e2e8f0;background:#f8fafc;user-select:none;transition:all 0.15s;font-size:11.5pt;color:#475569;min-height:22px}
.print-settings .ps-item:hover{border-color:#94a3b8;background:#f1f5f9}
.print-settings .ps-item.is-visible{background:#1a1a2e;color:#fff;border-color:#1a1a2e}
.print-settings .ps-item.is-visible:hover{background:#2d2d4f;border-color:#2d2d4f}
.print-settings .ps-item input{position:absolute;opacity:0;pointer-events:none}
.print-settings .ps-item .ps-check{width:22px;height:22px;border-radius:6px;border:2px solid #cbd5e1;background:#fff;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.15s;position:relative}
.print-settings .ps-item.is-visible .ps-check{background:#fff;border-color:#fff}
.print-settings .ps-item.is-visible .ps-check::after{content:'';width:5px;height:11px;border:solid #1a1a2e;border-width:0 2.5px 2.5px 0;transform:rotate(45deg);margin-top:-2px}
.print-settings .ps-item .ps-text{flex:1;font-weight:600;line-height:1.3}
.print-settings .ps-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;border-top:1px solid #e2e8f0;padding-top:14px}
.print-settings .ps-actions button{padding:12px 14px;border-radius:10px;border:2px solid #e2e8f0;background:#fff;cursor:pointer;font-size:11pt;font-family:inherit;font-weight:700;color:#475569;transition:all 0.15s}
.print-settings .ps-actions button:hover{background:#f1f5f9;border-color:#94a3b8;color:#1a1a2e}
.print-settings .ps-actions .ps-print{background:#1a1a2e;color:#fff;border-color:#1a1a2e;grid-column:1 / -1;font-size:12pt;padding:14px}
.print-settings .ps-actions .ps-print:hover{background:#2d2d4f;border-color:#2d2d4f;color:#fff}
@media print{.print-settings,.no-print{display:none !important}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
<div class="print-settings no-print" id="printSettingsPanel">
<button type="button" class="ps-toggle" id="psToggleBtn" title="إعدادات الطباعة">⚙</button>
<div class="ps-content" id="psContent" hidden>
<h3>إظهار الأعمدة في الطباعة</h3>
<div class="ps-list" id="psList"></div>
<div class="ps-actions">
<button type="button" id="psCheckAll">تحديد الكل</button>
<button type="button" id="psUncheckAll">إلغاء الكل</button>
<button type="button" id="psPrintBtn" class="ps-print">🖨️ طباعة</button>
</div>
</div>
</div>
${locationHtml}
<div class="sub">تاريخ الطباعة: ${dateStr} &nbsp;|&nbsp; حالة السحب: ${statusLabel} &nbsp;|&nbsp; إجمالي الرخص: ${displayLicenses} &nbsp;|&nbsp; إجمالي الأسلحة: ${displayWeapons}</div>
<table><colgroup>${colgroup}</colgroup><thead>${headerRow}</thead><tbody>${rowsHtml}</tbody></table>
${summaryTableHtml}
<script>
(function(){
	var STORAGE_KEY = 'weaponsPrintHiddenCols';
	var COLS = ${colChoicesJson};
	var hidden = new Set();
	try { var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); if (Array.isArray(saved)) hidden = new Set(saved); } catch(_) {}
	var list = document.getElementById('psList');
	function renderList(){
		list.innerHTML = COLS.map(function(c){
			var isVisible = !hidden.has(c.key);
			return '<label class="ps-item' + (isVisible ? ' is-visible' : '') + '">'
				+ '<input type="checkbox" data-key="' + c.key + '"' + (isVisible ? ' checked' : '') + '>'
				+ '<span class="ps-check"></span>'
				+ '<span class="ps-text">' + c.label + '</span>'
				+ '</label>';
		}).join('');
	}
	renderList();
	function persist(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(hidden))); } catch(_){} }
	function convertDigitsInNode(el){
		try {
			var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
			var node;
			while ((node = walker.nextNode())) {
				if (node.nodeValue && /[0-9]/.test(node.nodeValue)) {
					node.nodeValue = node.nodeValue.replace(/[0-9]/g, function(d){ return String.fromCharCode(0x0660 + Number(d)); });
				}
			}
		} catch(_){}
	}
	function apply(){
		document.querySelectorAll('td[data-col-key]').forEach(function(el){
			var key = el.getAttribute('data-col-key');
			if (el.dataset.origHtml === undefined) {
				convertDigitsInNode(el);
				el.dataset.origHtml = el.innerHTML;
			}
			el.innerHTML = hidden.has(key) ? '' : el.dataset.origHtml;
		});
		persist();
	}
	document.getElementById('psToggleBtn').addEventListener('click', function(){
		var c = document.getElementById('psContent');
		c.hidden = !c.hidden;
	});
	list.addEventListener('change', function(e){
		var inp = e.target.closest('input[type=checkbox]');
		if (!inp) return;
		var key = inp.getAttribute('data-key');
		if (inp.checked) hidden.delete(key); else hidden.add(key);
		var item = inp.closest('.ps-item');
		if (item) item.classList.toggle('is-visible', inp.checked);
		apply();
	});
	document.getElementById('psCheckAll').addEventListener('click', function(){
		hidden.clear();
		renderList();
		apply();
	});
	document.getElementById('psUncheckAll').addEventListener('click', function(){
		COLS.forEach(function(c){ hidden.add(c.key); });
		renderList();
		apply();
	});
	document.getElementById('psPrintBtn').addEventListener('click', function(){
		document.getElementById('psContent').hidden = true;
		setTimeout(function(){ window.print(); }, 50);
	});
	document.addEventListener('click', function(e){
		var panel = document.getElementById('printSettingsPanel');
		var content = document.getElementById('psContent');
		if (!panel || !content || content.hidden) return;
		if (panel.contains(e.target)) return;
		content.hidden = true;
	});
	apply();
})();
<\/script>
</body></html>`;

    const win = window.open('', '_blank', 'width=1200,height=850');
    if (!win) { showToast('يرجى السماح بالنوافذ المنبثقة لهذا الموقع', 'error'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      try {
        const walker = win.document.createTreeWalker(win.document.body, NodeFilter.SHOW_TEXT, null);
        const toArDigit = (d) => String.fromCharCode(0x0660 + Number(d));
        let node;
        while ((node = walker.nextNode())) {
          if (node.nodeValue && /[0-9]/.test(node.nodeValue)) {
            node.nodeValue = node.nodeValue.replace(/[0-9]/g, toArDigit);
          }
        }
      } catch (_) {}
      win.focus();
    };
  };


  // Fetches CSV from backend with the current withdrawal filter applied,
  // so deposit_number/deposit_date reflect only the weapons matching the filter.
  window.getCsvPreferFiltered = async function getCsvPreferFiltered() {
    const status = getCurrentStatusFilter();
    let filterParam = '';
    if (status === 'got') filterParam = '?filter=withdrawn';
    else if (status === 'not') filterParam = '?filter=not_withdrawn';
    const base = typeof window.buildWeaponsApiUrl === 'function'
      ? window.buildWeaponsApiUrl('/api/csv-raw')
      : '/api/csv-raw';
    const url = base + filterParam + (filterParam ? '&' : '?') + '_=' + Date.now();
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.text();
  };

  // Delete selected rows
  async function deleteSelectedRows() {
    const n = selectedCount();
    if (n === 0) {
      showToast('لم يتم تحديد أي صفوف للحذف', 'error');
      return;
    }
    const ok = confirm(`سيتم حذف ${n} سجل/سجلات الي المؤقت. هل أنت متأكد؟`);
    if (!ok) return;
    // Collect rows to be deleted (as arrays) and append them to recall.json on server.
    // Capture identity (name + license) up front so we can also tell SQL to drop them.
    const toDelete = new Set(selected);
    const nameIdx = getColIndex('الاسم');
    const licIdx = getColIndex('رقم', 'رقم القيد');
    const rowsToRecall = [];
    const deletedIdentities = [];
    for (const si of Array.from(toDelete).sort((a, b) => a - b)) {
      const row = csvAll[si];
      if (!row) continue;
      rowsToRecall.push(row);
      const name = nameIdx !== -1 ? String(row[nameIdx] ?? '').trim() : '';
      const license = licIdx !== -1 ? String(row[licIdx] ?? '').trim() : '';
      const meta = getSqlRowMeta(si);
      if (name || license || meta?.id != null) deletedIdentities.push({ id: meta?.id, name, license });
      try { dirtyRowRefs.delete(row); } catch (_) {}
    }
    let deleteResult = null;
    if (deletedIdentities.length) {
      const deleteResponse = await fetch(buildWeaponsApiUrl('/api/delete-records'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: deletedIdentities })
      });
      deleteResult = await deleteResponse.json().catch(() => ({}));
      if (deleteResult && deleteResult.approvalRequired) {
        if (window.DeleteApprovalUserNotice) {
          window.DeleteApprovalUserNotice.track(deleteResult.request, { message: deleteResult.message });
        }
        showToast(deleteResult.message || 'تم إرسال طلب الحذف إلى المدير والسيكرتير الأول لاعتماده.', 'info');
        return;
      }
      if (!deleteResponse.ok || (deleteResult && deleteResult.ok === false)) {
        throw new Error(deleteResult?.message || 'تعذر حذف السجلات المحددة');
      }
    }

    try {
      if (rowsToRecall.length) {
        await fetch(buildWeaponsApiUrl('/api/store-deleted'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: rowsToRecall }) });
      }
    } catch (e) { console.error('store-deleted failed', e); }

    // Remove selected rows from current in-memory CSV
  csvAll = csvAll.filter((_, i) => !toDelete.has(i));
  csvRowMeta = Array.isArray(csvRowMeta) ? csvRowMeta.filter((_, i) => !toDelete.has(i)) : [];
  rebuildSqlRowCaches();
  publishCsvGlobals();
  scheduleModelNotesScan({ immediate: true });
    if (!dirtyRowRefs.size) {
      try { UnsavedGuard.clearDirty(); } catch (_) {}
    }
    clearSelection();
    // Recompute and render
    filteredIndex = sortIndexMap(computeIndexMap());
    renderPage();
    updateFilterStatusLabel();
    try { senseChange(); } catch (_) {}
    showToast(deleteResult?.message || `✔️ تم حذف ${n} سجل/سجلات`);
  }
  deleteBtn && deleteBtn.addEventListener('click', deleteSelectedRows);

  function ensureStatusColumnExists() {
    let idx = getColIndex('حالة السحب');
    if (idx !== -1) return idx;

    if (!Array.isArray(csvHeaders)) {
      csvHeaders = [];
    }
    csvHeaders.push('حالة السحب');
    idx = csvHeaders.length - 1;

    for (let i = 0; i < csvAll.length; i++) {
      const row = Array.isArray(csvAll[i]) ? csvAll[i] : (csvAll[i] = []);
      while (row.length <= idx) {
        row.push('');
      }
    }

    publishCsvGlobals();
    try { UnsavedGuard?.markDirty?.(); } catch (_) {}
    scheduleModelNotesScan({ delayMs: 300 });
    return idx;
  }

  async function markFilteredRowsAsWithdrawn() {
    const statusIdx = ensureStatusColumnExists();
    if (typeof statusIdx !== 'number' || statusIdx < 0) {
      showToast('تعذر تجهيز عمود "حالة السحب".', 'error');
      return;
    }

    const visibleIndices = Array.isArray(filteredIndex) ? filteredIndex.slice() : [];
    if (!visibleIndices.length) {
      showToast('لا توجد نتائج حالية لتعليمها.', 'error');
      return;
    }

    const rowsToUpdate = [];
    visibleIndices.forEach((globalIdx) => {
      const row = csvAll[globalIdx];
      if (!row) return;
      const currentStatus = String(row[statusIdx] ?? '').trim();
      if (currentStatus !== 'مسحوب') {
        rowsToUpdate.push(globalIdx);
      }
    });

    if (!rowsToUpdate.length) {
      showToast('كل السجلات المعروضة معلمة بالفعل كمسحوبة.');
      return;
    }

    const prettyCount = toArabicDigits(rowsToUpdate.length.toLocaleString('en-US'));
    const ok = confirm(`سيتم تعليم ${prettyCount} سجل/سجلات بأنها مسحوبة. هل أنت متأكد؟`);
    if (!ok) return;

    rowsToUpdate.forEach((globalIdx) => {
      const row = csvAll[globalIdx];
      if (!row) return;
      while (row.length <= statusIdx) row.push('');
      row[statusIdx] = 'مسحوب';
      try { dirtyRowRefs.add(row); } catch (_) {}
    });

    publishCsvGlobals();
    try { UnsavedGuard?.markDirty?.(); } catch (_) {}
    try { senseChange(); } catch (_) {}
    scheduleModelNotesScan({ delayMs: 250 });

    showToast(`✔️ تم تعليم ${prettyCount} سجل/سجلات كمسحوبة. اضغط حفظ لتثبيت التغييرات.`);

    try {
      const idxMap = computeIndexMap();
      filteredIndex = sortIndexMap(idxMap);
      const totalPages = Math.max(1, Math.ceil(filteredIndex.length / getPageSize()));
      if (currentPage > totalPages) currentPage = totalPages;
      renderPage({ preserveScroll: true });
      updateFilterStatusLabel();
    } catch (renderErr) {
      console.warn('bulk withdraw render failed', renderErr);
      try { renderPage({ preserveScroll: true }); } catch (_) {}
    }
  }
  bulkWithdrawBtn && bulkWithdrawBtn.addEventListener('click', markFilteredRowsAsWithdrawn);
  // Undo / recall UI wiring
  const undoBtn = document.getElementById('undoBtn');
  const recallModal = document.getElementById('recallModal');
  const recallListContainer = document.getElementById('recallListContainer');
  const recallRecoverBtn = document.getElementById('recallRecoverBtn');
  const recallCloseBtn = document.getElementById('recallCloseBtn');
  const recallSelectAll = document.getElementById('recallSelectAll');
  const recallClearAll = document.getElementById('recallClearAll');

  [undoBtn, recallRecoverBtn, recallCloseBtn, recallSelectAll, recallClearAll].forEach((btn) => {
    if (btn) btn.setAttribute('type', 'button');
  });

  async function fetchRecallList() {
    try {
      const res = await fetch(buildWeaponsApiUrl('/api/recall-list'), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      return (j && j.rows) ? j.rows : [];
    } catch (e) { console.error('fetchRecallList failed', e); return []; }
  }

  function buildRecallListHTML(rows) {
    if (!rows || !rows.length) return '<div style="padding:12px;color:#666">لا توجد سجلات محذوفة</div>';
    // Build a table showing all columns except 'ملاحظات'
    const excluded = new Set(['ملاحظات']);
    const visibleCols = (Array.isArray(csvHeaders) ? csvHeaders.slice() : []).map(h => (h||'').toString());
    const colIndexes = [];
    visibleCols.forEach((h, i) => { if (!excluded.has(h)) colIndexes.push(i); });

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '0.95em';
    const thead = document.createElement('thead');
    const headTr = document.createElement('tr');
    const thChk = document.createElement('th'); thChk.style.width = '40px'; thChk.textContent = '';
    headTr.appendChild(thChk);
    colIndexes.forEach(ci => { const th = document.createElement('th'); th.style.textAlign = 'right'; th.style.padding = '6px 8px'; th.style.borderBottom = '1px solid #eee'; th.textContent = visibleCols[ci] || ''; headTr.appendChild(th); });
    thead.appendChild(headTr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #f4f4f4';
      const tdChk = document.createElement('td'); tdChk.style.padding = '6px'; tdChk.style.verticalAlign = 'top';
      const id = 'recall_chk_' + idx;
      const chk = document.createElement('input'); chk.type = 'checkbox'; chk.id = id; chk.dataset.idx = idx; chk.style.width = '18px';
      tdChk.appendChild(chk); tr.appendChild(tdChk);
      colIndexes.forEach(ci => {
        const td = document.createElement('td'); td.style.padding = '6px 8px'; td.style.verticalAlign = 'top';
        const val = (r && r[ci] != null) ? String(r[ci]) : '';
        td.textContent = val;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  async function openRecallModal() {
    recallListContainer.innerHTML = '<div style="padding:12px;color:#666">جارٍ التحميل…</div>';
    recallModal.style.display = 'flex';
    const rows = await fetchRecallList();
    recallListContainer.innerHTML = '';
    if (!rows || !rows.length) {
      recallListContainer.innerHTML = '<div style="padding:12px;color:#666">لا توجد سجلات محذوفة</div>';
      return;
    }
    const built = buildRecallListHTML(rows);
    if (typeof built === 'string') recallListContainer.innerHTML = built; else recallListContainer.appendChild(built);
  }

  function closeRecallModal() { recallModal.style.display = 'none'; }

  recallCloseBtn && recallCloseBtn.addEventListener('click', closeRecallModal);
  undoBtn && undoBtn.addEventListener('click', () => openRecallModal());
  recallSelectAll && recallSelectAll.addEventListener('click', () => {
    recallListContainer.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = true);
  });
  recallClearAll && recallClearAll.addEventListener('click', () => {
    recallListContainer.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
  });

  recallRecoverBtn && recallRecoverBtn.addEventListener('click', async () => {
    const rows = await fetchRecallList();
    if (!rows || !rows.length) { showToast('لا توجد سجلات للاسترجاع', 'error'); return; }
    const checks = Array.from(recallListContainer.querySelectorAll('input[type="checkbox"]')).filter(c => c.checked);
    if (!checks.length) { showToast('اختر سجلات لتسترجعها', 'error'); return; }
    const selectedIdx = checks.map(c => Number(c.dataset.idx)).filter(n => !isNaN(n));
    const rowsToRecover = selectedIdx.map(i => rows[i]);
    try {
      const res = await fetch(buildWeaponsApiUrl('/api/recall-recover'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: rowsToRecover, removeFromRecall: true }) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      if (j && j.ok) {
        try {
          await refreshCsvFromServer({ force: true, preservePage: true, preserveScroll: true });
        } catch (refreshErr) {
          console.warn('refresh after recall failed:', refreshErr);
        }
        showToast(`✔️ تم استرجاع ${j.recovered||0} سجل/سجلات`);
        closeRecallModal();
      } else {
        showToast('فشل الاسترجاع', 'error');
      }
    } catch (e) { console.error('recall-recover failed', e); showToast('فشل الاسترجاع: ' + e.message, 'error'); }
  });
  updateDeleteButton();
});

/** Serialize current data to CSV text (with BOM) */
function buildCSVText() {
  const csvEscape = (s) => {
    s = (s ?? '').toString().replace(/\r?\n/g, ' ').replace(/"/g, '""');
    return /[",;\t]/.test(s) ? `"${s}"` : s;
  };
  const lines = [];
  lines.push(csvHeaders.map(csvEscape).join(','));
  csvAll.forEach(row => lines.push((row || []).map(csvEscape).join(',')));
  return '\uFEFF' + lines.join('\r\n');
}

/** Save only changed rows to SQL — never replaces the full table */
async function saveCSV(ev) {
  if (ev && ev.preventDefault) ev.preventDefault();
  try {
    await flushPendingWeaponStateSaves().catch((err) =>
      console.warn('flushPendingWeaponStateSaves failed (continuing):', err)
    );

    const dirtySet = getDirtyRowRefSet();
    const dirtyInCurrent = pruneDirtyRowRefsToCurrentRows(dirtySet);

    if (!dirtyInCurrent.length) {
      const pendingMap = getPendingWeaponSaveMap();
      if (!pendingMap || pendingMap.size === 0) {
        try { UnsavedGuard.clearDirty(); } catch (_) {}
      }
      try { senseChange(); } catch (_) {}
      showToast('لا توجد تغييرات للحفظ');
      return;
    }

    const headers = Array.isArray(csvHeaders) ? csvHeaders : [];
    const rows = dirtyInCurrent.map((row) => {
      const obj = {};
      headers.forEach((header, i) => {
        const key = String(header || '').trim();
        if (key) obj[key] = row[i] == null ? '' : String(row[i]);
      });
      const rowIdx = csvAll.indexOf(row);
      const meta = getSqlRowMeta(rowIdx);
      if (meta) {
        if (meta.id != null) obj.__recordId = meta.id;
        if (meta.rowOrder != null) obj.__rowOrder = meta.rowOrder;
        if (meta.updatedAt != null) obj.__updatedAt = meta.updatedAt;
      }
      return obj;
    });

    const res = await fetch(buildWeaponsApiUrl('/api/update-records'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows })
    });
    const json = await res.json().catch(() => null);
    if (Array.isArray(json?.updatedRows)) {
      json.updatedRows.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        let rowIdx = -1;
        if (item.recordId != null) {
          rowIdx = csvRowMeta.findIndex((meta) => meta && Number(meta.id) === Number(item.recordId));
        }
        if (rowIdx === -1 && item.rowOrder != null) {
          rowIdx = csvRowMeta.findIndex((meta) => meta && Number(meta.rowOrder) === Number(item.rowOrder));
        }
        if (rowIdx !== -1) {
          updateSqlRowMeta(rowIdx, item);
        }
      });
    }
    if (!res.ok) {
      throw new Error((json && json.message) ? json.message : 'HTTP ' + res.status);
    }

    dirtyInCurrent.forEach((row) => dirtySet && dirtySet.delete(row));
    pruneDirtyRowRefsToCurrentRows(dirtySet);
    const pendingMap = getPendingWeaponSaveMap();
    if ((!dirtySet || dirtySet.size === 0) && (!pendingMap || pendingMap.size === 0)) {
      try { UnsavedGuard.clearDirty(); } catch (_) {}
    }
    lastManualSaveStamp = Date.now();
    try { senseChange(); } catch (_) {}

    showToast(json?.message || '✔️ تم الحفظ بنجاح');

    try {
      const _tbl = document.getElementById('csvPreviewContainer');
      const _savedTableY = _tbl ? _tbl.scrollTop : 0;
      const _savedWinY = window.scrollY || window.pageYOffset || 0;
      const _restoreScroll = () => {
        try { if (_tbl) _tbl.scrollTop = _savedTableY; window.scrollTo(0, _savedWinY); } catch (_) {}
      };
      if (typeof window.__weaponsLoadState === 'function') await window.__weaponsLoadState();
      if (typeof window.rerenderWeaponsTable === 'function') {
        window.rerenderWeaponsTable({ preserveScroll: true, tableScrollTop: _savedTableY });
      }
      _restoreScroll();
      requestAnimationFrame(() => { _restoreScroll(); requestAnimationFrame(_restoreScroll); });
      setTimeout(_restoreScroll, 80);
    } catch (_) {}
  } catch (e) {
    console.error(e);
    showToast('❌ تعذر الحفظ: ' + (e.message || 'خطأ غير معروف'), 'error');
  }
}


// ensure global access for onclick="saveCSV()"
window.saveCSV = saveCSV;
try { window.__weaponsSaveRerender = true; } catch (_) {}



async function weaponsSaveBeforeExit() {
  try {
    await saveCSV();
    return true;
  } catch (error) {
    console.error('Weapons save before exit failed:', error);
    showToast('❌ تعذر الحفظ قبل الخروج. يرجى المحاولة مرة أخرى.', 'error');
    return false;
  }
}
try { window.weaponsSaveBeforeExit = weaponsSaveBeforeExit; } catch (_) {}

/** Open Data/slah.csv in Excel (Windows) with fallback to download */
function openCSV() {
  try {
    // CSV is generated from SQL on demand for Excel compatibility.
    const csvPath = typeof window.buildWeaponsApiUrl === 'function'
      ? window.buildWeaponsApiUrl('/api/csv-raw')
      : '/api/csv-raw';
    const csvHttpUrl = new URL(csvPath, location.href).href;
    // Try Office protocol handler (opens installed Excel on Windows)
    const excelDeepLink = 'ms-excel:ofe|u|' + csvHttpUrl;

    // Use an invisible iframe to attempt protocol without unloading the page
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const fallbackTimer = setTimeout(() => {
      // Fallback: open/download the CSV in a new tab so user can open in Excel
      window.open(csvHttpUrl, '_blank');
      try { document.body.removeChild(iframe); } catch (_) {}
    }, 1200);

    // Kick off Excel via custom protocol
    iframe.src = excelDeepLink;

    // Safety: clear timer if navigation occurs (best-effort)
    window.addEventListener('blur', () => {
      clearTimeout(fallbackTimer);
      try { document.body.removeChild(iframe); } catch(_) {}
    }, { once: true });
  } catch (e) {
    // Last resort: open the SQL-backed CSV endpoint
    try { window.open(buildWeaponsApiUrl('/api/csv-raw'), '_blank'); } catch (_) {}
  }
}

// Persist all pending weapon-state edits (called before global save)
async function flushPendingWeaponStateSaves() {
  const pendingMap = getPendingWeaponSaveMap();
  if (!pendingMap || !pendingMap.size) return;
  const persistEntry = (typeof window !== 'undefined' && typeof window.__weaponsPersistWeaponStateEntry === 'function')
    ? window.__weaponsPersistWeaponStateEntry
    : null;
  if (!persistEntry) throw new Error('Weapon state save handler is not ready');

  const pendingEntries = Array.from(pendingMap.entries());
  for (const [key, payload] of pendingEntries) {
    if (!payload || typeof payload !== 'object') continue;
    try {
      const saved = await persistEntry(payload);
      if (saved) pendingMap.delete(key);
    } catch (err) {
      console.error('Failed to flush weapon state entry', err);
    }
  }
  try { senseChange(); } catch (_) {}
}
// Expose for sheet.html onclick
window.openCSV = openCSV;

/***********************
 * Sector & station dropdown logic (shared via data module)
 ***********************/
const WeaponsData = window.WeaponsData || {};
const SHARED_REFERENCE_DATA = window.AdministrativeSharedReferenceData || null;
const sectorStations = WeaponsData.sectorStations || window.sectorStations || {};
let LICENSE_TYPES = WeaponsData.licenseTypes || window.LICENSE_TYPES || [];
const SECTOR_KEY_TO_LABEL = WeaponsData.sectorKeyToLabel || {};
const SECTOR_LABEL_TO_KEY = WeaponsData.sectorLabelToKey
  || Object.fromEntries(Object.keys(SECTOR_KEY_TO_LABEL).map((k) => [SECTOR_KEY_TO_LABEL[k], k]));
const ALL_SECTOR_KEYS = Array.isArray(WeaponsData.allSectorKeys)
  ? WeaponsData.allSectorKeys.slice()
  : Object.keys(SECTOR_KEY_TO_LABEL);
const STATION_ALL_KEYWORDS = WeaponsData.stationAllKeywords instanceof Set
  ? WeaponsData.stationAllKeywords
  : new Set((WeaponsData.stationAllKeywordList || []).concat([
      'all',
      'كل',
      'الكل',
      'جميع الأقسام',
      'جميع الاقسام',
      'كافة الأقسام',
      'كافة الاقسام'
    ]));

function toLatinDigitsForStationMatch(value) {
  return String(value ?? '')
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06F0));
}

function normalizeArabicStationSource(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.normalizeArabicForMatch === 'function') {
    return SHARED_REFERENCE_DATA.normalizeArabicForMatch(raw);
  }
  return toLatinDigitsForStationMatch(raw)
    .replace(/\uFEFF/g, '')
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildStationLooseMatchKey(value) {
  const normalized = normalizeArabicStationSource(value);
  if (!normalized) return '';
  const loosened = normalized
    .split(/\s+/)
    .map((token) => (token.length >= 4 ? token.replace(/ي$/u, '') : token))
    .join(' ')
    .trim();
  return (loosened || normalized).replace(/[^\p{L}\p{N}]+/gu, '');
}

function resolveStationNameForMatch(value, sectorValue = '') {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.resolveStationName === 'function') {
    const resolved = SHARED_REFERENCE_DATA.resolveStationName(raw, sectorValue);
    const resolvedText = String(resolved || '').trim();
    if (resolvedText) return resolvedText;
  }
  const targetKey = buildStationLooseMatchKey(raw);
  if (!targetKey) return raw;
  const sectorKey = determineSectorKeyFromValue(sectorValue)
    || (Object.prototype.hasOwnProperty.call(sectorStations, sectorValue) ? sectorValue : '');
  const candidateLists = sectorKey && Array.isArray(sectorStations[sectorKey])
    ? [sectorStations[sectorKey]]
    : Object.values(sectorStations);
  const seen = new Set();
  for (const list of candidateLists) {
    if (!Array.isArray(list)) continue;
    for (const station of list) {
      const candidate = String(station || '').trim();
      if (!candidate || seen.has(candidate)) continue;
      seen.add(candidate);
      if (buildStationLooseMatchKey(candidate) === targetKey) {
        return candidate;
      }
    }
  }
  return raw;
}

function normalizeStationComparisonKey(value, sectorValue = '') {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const canonical = resolveStationNameForMatch(raw, sectorValue);
  return buildStationLooseMatchKey(canonical || raw);
}

function normalizeStationDisplayName(value, sectorValue = '') {
  const canonical = resolveStationNameForMatch(value, sectorValue);
  const trimmed = String(canonical || value || '').trim();
  return trimmed || 'بدون قسم';
}

function uniqueStationDisplayList(list, sectorValue = '') {
  const result = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((station) => {
    const text = String(resolveStationNameForMatch(station, sectorValue) || station || '').trim();
    const key = normalizeStationComparisonKey(text, sectorValue);
    if (!text || !key || seen.has(key)) return;
    seen.add(key);
    result.push(text);
  });
  return result;
}

function getComparableStationSelection(list, sectorValue = '') {
  return (Array.isArray(list) ? list : [])
    .map((station) => normalizeStationComparisonKey(station, sectorValue))
    .filter(Boolean)
    .sort();
}

function getLicenseTypesList() {
  const types = window.LICENSE_TYPES || WeaponsData.licenseTypes || LICENSE_TYPES || [];
  return Array.isArray(types) ? types.slice() : [];
}

function populateSectorFilterOptions(selectEl) {
  const sectorSelect = selectEl || document.getElementById('sectorSelect');
  if (!sectorSelect) return;
  const previousValue = sectorSelect.value;
  const hasChoices = ALL_SECTOR_KEYS.length > 0;
  sectorSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.selected = true;
  placeholder.textContent = hasChoices ? 'اختار القطاع' : 'لا توجد قطاعات متاحة';
  sectorSelect.appendChild(placeholder);
  ALL_SECTOR_KEYS.forEach((key) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = SECTOR_KEY_TO_LABEL[key] || key;
    sectorSelect.appendChild(option);
  });
  if (previousValue && ALL_SECTOR_KEYS.includes(previousValue)) {
    sectorSelect.value = previousValue;
    placeholder.selected = false;
  }
}

try {
  document.addEventListener('license-types:updated', (ev) => {
    const next = ev?.detail?.types || window.LICENSE_TYPES || WeaponsData.licenseTypes || [];
    LICENSE_TYPES = Array.isArray(next) ? next.slice() : [];
  });
} catch (_) {}

function isAllStationsToken(value) {
  if (value == null) return false;
  const normalized = String(value).trim();
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  return STATION_ALL_KEYWORDS.has(normalized) || STATION_ALL_KEYWORDS.has(lower);
}

function normalizePortalStationList(raw, allowedStations, sectorValue = '') {
  const fallback = { list: [], isAll: false };
  const allowed = uniqueStationDisplayList(allowedStations, sectorValue);
  if (!allowed.length) {
    if (typeof raw === 'string' && isAllStationsToken(raw)) {
      return { list: [], isAll: true };
    }
    if (Array.isArray(raw) && raw.some((value) => isAllStationsToken(value))) {
      return { list: [], isAll: true };
    }
    return fallback;
  }
  const allowedEntries = allowed
    .map((station) => ({
      station,
      key: normalizeStationComparisonKey(station, sectorValue)
    }))
    .filter((entry) => entry.station && entry.key);
  const allowedMap = new Map(allowedEntries.map((entry) => [entry.key, entry.station]));
  const resolveAllowedStation = (value) => {
    const key = normalizeStationComparisonKey(value, sectorValue);
    if (!key) return '';
    return allowedMap.get(key) || '';
  };
  if (typeof raw === 'string') {
    const token = raw.trim();
    if (!token) return fallback;
    if (isAllStationsToken(token)) {
      return { list: allowed.slice(), isAll: true };
    }
    const resolved = resolveAllowedStation(token);
    return resolved ? { list: [resolved], isAll: false } : fallback;
  }
  if (Array.isArray(raw)) {
    const collected = [];
    const seen = new Set();
    for (const value of raw) {
      const token = String(value || '').trim();
      if (!token) continue;
      if (isAllStationsToken(token)) {
        return { list: allowed.slice(), isAll: true };
      }
      const resolved = resolveAllowedStation(token);
      const resolvedKey = normalizeStationComparisonKey(resolved, sectorValue);
      if (resolved && resolvedKey && !seen.has(resolvedKey)) {
        seen.add(resolvedKey);
        collected.push(resolved);
      }
    }
    if (collected.length >= allowed.length) {
      return { list: allowed.slice(), isAll: true };
    }
    return { list: collected, isAll: false };
  }
  return fallback;
}

function extractStationAccessSource(user) {
  if (!user || typeof user !== 'object') return {};
  if (user.stationAccess && typeof user.stationAccess === 'object' && !Array.isArray(user.stationAccess)) {
    return user.stationAccess;
  }
  if (user.stations && typeof user.stations === 'object' && !Array.isArray(user.stations)) {
    return user.stations;
  }
  return {};
}

function determineSectorKeyFromValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (SECTOR_KEY_TO_LABEL[raw]) return raw;
  if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.resolveSectorKey === 'function') {
    const resolved = SHARED_REFERENCE_DATA.resolveSectorKey(raw);
    if (resolved) return resolved;
  }
  if (SECTOR_LABEL_TO_KEY[raw]) return SECTOR_LABEL_TO_KEY[raw];
  const cleaned = raw.replace(/^قطاع\s+/u, '').trim();
  if (SECTOR_LABEL_TO_KEY[cleaned]) return SECTOR_LABEL_TO_KEY[cleaned];
  const parts = raw.split(/\s+/);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const token = parts[i];
    if (SECTOR_LABEL_TO_KEY[token]) return SECTOR_LABEL_TO_KEY[token];
  }
  return null;
}

function detectSectorKeyForStationName(stationName) {
  const target = String(stationName || '').trim();
  if (!target) return null;
  if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.detectSectorKeyFromStation === 'function') {
    const resolved = SHARED_REFERENCE_DATA.detectSectorKeyFromStation(target);
    if (resolved) return resolved;
  }
  const targetKey = normalizeStationComparisonKey(target);
  if (!targetKey) return null;
  for (const [key, stations] of Object.entries(sectorStations)) {
    if (Array.isArray(stations) && stations.some((station) => normalizeStationComparisonKey(station, key) === targetKey)) {
      return key;
    }
  }
  return null;
}

let stationRestrictionCache = null;

function resetStationRestrictionCache() {
  stationRestrictionCache = null;
}

function getStationRestrictionSnapshot(forceRefresh = false) {
  if (!forceRefresh && stationRestrictionCache) return stationRestrictionCache;

  const user = getPortalUserProfile();
  const isAdmin = hasPortalAdminAccess(user);
  const allowedSectorKeys = (!user || isAdmin)
    ? ALL_SECTOR_KEYS.slice()
    : deriveAllowedSectorKeys(user);
  const allowedSectorSet = new Set(allowedSectorKeys);
  const allowedStationsByKey = {};
  const allowedStationSets = {};
  let hasAnyStationLimits = false;

  Object.entries(sectorStations).forEach(([sectorKey, list]) => {
    const normalized = uniqueStationDisplayList(list, sectorKey);
    allowedStationsByKey[sectorKey] = normalized;
    allowedStationSets[sectorKey] = new Set(
      normalized
        .map((station) => normalizeStationComparisonKey(station, sectorKey))
        .filter(Boolean)
    );
  });

  if (user && !isAdmin) {
    const source = extractStationAccessSource(user);
    Object.entries(source).forEach(([sectorIdentifier, raw]) => {
      const sectorKey = determineSectorKeyFromValue(sectorIdentifier)
        || (Object.prototype.hasOwnProperty.call(sectorStations, sectorIdentifier) ? sectorIdentifier : null);
      if (!sectorKey || !sectorStations[sectorKey]) return;
      const baseList = sectorStations[sectorKey] || [];
      const { list, isAll } = normalizePortalStationList(raw, baseList, sectorKey);
      if (isAll) {
        const canonicalBaseList = uniqueStationDisplayList(baseList, sectorKey);
        allowedStationsByKey[sectorKey] = canonicalBaseList.slice();
        allowedStationSets[sectorKey] = new Set(
          canonicalBaseList
            .map((station) => normalizeStationComparisonKey(station, sectorKey))
            .filter(Boolean)
        );
      } else if (list.length) {
        allowedStationsByKey[sectorKey] = list.slice();
        allowedStationSets[sectorKey] = new Set(
          list
            .map((station) => normalizeStationComparisonKey(station, sectorKey))
            .filter(Boolean)
        );
        if (list.length < baseList.length) hasAnyStationLimits = true;
      } else {
        allowedStationsByKey[sectorKey] = [];
        allowedStationSets[sectorKey] = new Set();
        hasAnyStationLimits = true;
      }
    });
  }

  const unionAllowedStations = new Set();
  const unionAllowedStationKeys = new Set();
  Object.entries(allowedStationSets).forEach(([sectorKey, set]) => {
    if (!allowedSectorSet.size || allowedSectorSet.has(sectorKey) || isAdmin) {
      (allowedStationsByKey[sectorKey] || []).forEach((station) => unionAllowedStations.add(station));
      set.forEach((stationKey) => unionAllowedStationKeys.add(stationKey));
    }
  });

  stationRestrictionCache = {
    user,
    isAdmin,
    allowedSectorKeys,
    allowedSectorSet,
    allowedStationsByKey,
    allowedStationSets,
    hasAnyStationLimits,
    unionAllowedStations,
    unionAllowedStationKeys
  };
  return stationRestrictionCache;
}

function getAllowedStationsForSectorKey(sectorKey) {
  if (!sectorKey) return [];
  const snapshot = getStationRestrictionSnapshot();
  if (snapshot.isAdmin) {
    return (snapshot.allowedStationsByKey[sectorKey] || []).slice();
  }
  if (!snapshot.allowedSectorSet.has(sectorKey)) {
    return [];
  }
  return (snapshot.allowedStationsByKey[sectorKey] || []).slice();
}


function onSectorChange() {
  const sectorSelectEl = document.getElementById('sectorSelect');
  const sector = sectorSelectEl ? sectorSelectEl.value : '';
  const btn = document.getElementById('stationDropdownBtn');
  closeStationDropdown();
  const stations = getAllowedStationsForSectorKey(sector);
  if (btn) {
    if (stations.length) {
      btn.disabled = false;
      btn.textContent = 'اختر القسم';
    } else {
      btn.disabled = true;
      btn.textContent = 'لا توجد أقسام متاحة';
    }
  }
  renderStationChecklist(stations);
  // Clear any previous selection label on sector change
  try { updateSelectedStationsLabel(); } catch {}
}

function renderStationChecklist(stations) {
  const list = document.getElementById('stationDropdownList');
  if (!list) return;
  const items = Array.isArray(stations) ? stations : [];
  if (!items.length) {
    list.innerHTML = '<div style="padding:12px 16px;color:#c5c7ce;font-size:0.95em;">لا توجد أقسام متاحة</div>';
  } else {
    list.innerHTML = items.map((station) =>
      `<label style="display:flex;align-items:center;padding:8px 16px;cursor:pointer;gap:10px;">
         <span style="font-size:1.08em;">${station}</span>
         <input type="checkbox" value="${station}" style="margin:0" />
       </label>`
    ).join('');
  }
  // After rendering new checklist, wire change listener (applyAllFilters already listens on container)
  try { updateSelectedStationsLabel(); } catch {}
  try { syncStationButtonHighlights(); } catch {}
}

// Call once on page load to set initial state
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    try { updateSelectedStationsLabel(); } catch {}
  }, 100);

  try {
    if (!document.getElementById('weapons-unsaved-style')) {
      const style = document.createElement('style');
      style.id = 'weapons-unsaved-style';
      style.textContent = `body.weapons-unsaved .btn-save { background-color: #ea580c !important; border-color: #b45309 !important; color: #fff !important; box-shadow: 0 0 0 3px rgba(234,88,12,0.25); }
body.weapons-unsaved .btn-save:hover { filter: brightness(1.05); }`;
      document.head.appendChild(style);
    }
  } catch (_) {}
});

// Update global save UI when there are pending weapon-state or row edits
function senseChange() {
  try {
    const dirtyRefs = getDirtyRowRefSet();
    pruneDirtyRowRefsToCurrentRows(dirtyRefs);
    const pendingMap = getPendingWeaponSaveMap();
    const dirty = (dirtyRefs && dirtyRefs.size > 0)
      || (pendingMap && pendingMap.size > 0);
    if (dirty) document.body.classList.add('weapons-unsaved'); else document.body.classList.remove('weapons-unsaved');
    // Also toggle small badge on save button if present
    const globalSave = document.querySelector('.btn-save') || document.querySelector('button[onclick="saveCSV()"]');
    if (globalSave) {
      if (dirty) {
        globalSave.classList.add('weapons-pending');
        globalSave.setAttribute('title', 'هناك تغييرات غير محفوظة على البيانات');
      } else {
        globalSave.classList.remove('weapons-pending');
        globalSave.removeAttribute('title');
      }
    }
  } catch (e) { console.debug('senseChange err', e); }
}

// expose for debugging
window.senseChange = senseChange;

function toggleStationDropdown() {
  const list = document.getElementById('stationDropdownList');
  if (!list) return;
  const wrapper = document.getElementById('stationDropdown');
  const isHidden = window.getComputedStyle(list).display === 'none';
  list.style.display = isHidden ? 'block' : 'none';
  if (wrapper) wrapper.classList.toggle('dropdown-open', isHidden);
}
function closeStationDropdown() {
  const el = document.getElementById('stationDropdownList');
  if (el) el.style.display = 'none';
  const wrapper = document.getElementById('stationDropdown');
  if (wrapper) wrapper.classList.remove('dropdown-open');
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.checklist-dropdown')) closeStationDropdown();
});

// Label updater: shows which stations are selected
function updateSelectedStationsLabel() {
  const preview = document.getElementById('stationSelectedList');
  if (!preview) return;
  const emptyHtml = '<span class="station-selected-empty">لا توجد أقسام محددة بعد</span>';
  const checks = Array.from(document.querySelectorAll('#stationDropdownList input[type=checkbox]:checked'));
  const names = checks.map((c) => c.value.trim()).filter(Boolean);
  if (!names.length) {
    preview.classList.remove('has-items');
    preview.innerHTML = emptyHtml;
    return;
  }
  preview.classList.add('has-items');
  const escapeHtml = (str) => str.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const listHtml = names
    .slice(0, 20)
    .map((name) => `<li>${escapeHtml(name)}</li>`)
    .join('');
  const overflowCount = names.length - 20;
  const overflowHtml = overflowCount > 0
    ? `<li class="station-selected-overflow">+ ${overflowCount} ${overflowCount === 1 ? 'قسم إضافي' : 'أقسام إضافية'}</li>`
    : '';
  preview.innerHTML = `<ul>${listHtml}${overflowHtml}</ul>`;
}

// (Old duplicate saveCSV removed; using the /api/save-csv text endpoint instead)


/***********************
 * Auth helpers
 ***********************/
const FRONTEND_ONLY = true;
const USERS = { "admin": "admin" };

function getPortalToken() {
  return sessionStorage.getItem(GENERAL_TOKEN_KEY)
    || localStorage.getItem(GENERAL_TOKEN_KEY)
    || null;
}

function primePortalSession() {
  const token = getPortalToken();
  if (!token) return false;
  try {
    sessionStorage.setItem(GENERAL_TOKEN_KEY, token);
    const storedUser = localStorage.getItem(GENERAL_USER_KEY);
    if (storedUser) {
      sessionStorage.setItem(GENERAL_USER_KEY, storedUser);
      resetStationRestrictionCache();
    }
  } catch (_) {}
  return true;
}

function getPortalUserProfile() {
  const raw = sessionStorage.getItem(GENERAL_USER_KEY) || localStorage.getItem(GENERAL_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Unable to parse portal user profile:', error);
    resetStationRestrictionCache();
    return null;
  }
}

function hasPortalAdminAccess(user) {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin') return true;
  const sectors = Array.isArray(user.sectors) && user.sectors.length
    ? user.sectors
    : (user.room ? [user.room] : []);
  return sectors.some((sector) => sector === PORTAL_ADMIN_SECTOR_LABEL);
}

function deriveAllowedSectorKeys(user) {
  if (!user) return [];
  const rawSectors = Array.isArray(user.sectors) && user.sectors.length
    ? user.sectors
    : (user.room ? [user.room] : []);
  if (!rawSectors.length) return [];
  const keys = rawSectors
    .map((label) => determineSectorKeyFromValue(label))
    .filter(Boolean);
  return Array.from(new Set(keys));
}

function restrictSectorFilterToAssignedSectors(selectEl) {
  try {
    const sectorSelect = selectEl || document.getElementById('sectorSelect');
    if (!sectorSelect) return;
    const user = getPortalUserProfile();
    if (!user || hasPortalAdminAccess(user)) return;

    const allowedKeys = deriveAllowedSectorKeys(user);
    if (!allowedKeys.length) {
      sectorSelect.innerHTML = '<option value="" selected>لا توجد قطاعات متاحة</option>';
      sectorSelect.disabled = true;
      const stationBtn = document.getElementById('stationDropdownBtn');
      if (stationBtn) stationBtn.disabled = true;
      sectorSelect.dataset.autoSelectionDone = 'true';
      return;
    }

    const allowedSet = new Set(allowedKeys);
    const hasAllSectors = ALL_SECTOR_KEYS.every((key) => allowedSet.has(key));
    Array.from(sectorSelect.options).forEach((option) => {
      if (!option.value) return;
      if (!allowedSet.has(option.value)) option.remove();
    });

    let placeholder = sectorSelect.querySelector('option[value=""]');
    if (!placeholder) {
      placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'اختار القطاع';
      placeholder.disabled = true;
      sectorSelect.insertBefore(placeholder, sectorSelect.firstChild);
    } else {
      placeholder.disabled = true;
      placeholder.textContent = 'اختار القطاع';
    }

    sectorSelect.disabled = false;

    if (sectorSelect.dataset.autoSelectionListenerAttached !== 'true') {
      sectorSelect.addEventListener('change', () => {
        sectorSelect.dataset.autoSelectionDone = 'true';
      });
      sectorSelect.dataset.autoSelectionListenerAttached = 'true';
    }

    const currentValue = sectorSelect.value;
    const currentAllowed = allowedSet.has(currentValue);
    const autoDone = sectorSelect.dataset.autoSelectionDone === 'true';
    const stationBtn = document.getElementById('stationDropdownBtn');
    const allowedOptions = Array.from(sectorSelect.options).filter((option) => option.value && allowedSet.has(option.value));

    const applySelection = (value, { disableSelect } = {}) => {
      const nextValue = value || '';
      const previous = sectorSelect.value;
      if (sectorSelect.value !== nextValue) {
        sectorSelect.value = nextValue;
      }
      if (placeholder) {
        placeholder.selected = !nextValue;
      }
      sectorSelect.dataset.autoSelectionDone = 'true';
      if (typeof disableSelect === 'boolean') {
        sectorSelect.disabled = disableSelect;
      }

      syncSectorStripeHighlight(nextValue);
      const shouldDispatch = nextValue !== previous;
      if (shouldDispatch) {
        try { sectorSelect.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) { try { onSectorChange(); } catch (_) {} }
      } else {
        try { onSectorChange(); } catch (_) {}
      }

      if (nextValue) {
        try { applyAllFilters(); } catch (_) {}
        if (stationBtn) stationBtn.disabled = false;
      } else {
        if (stationBtn) {
          stationBtn.disabled = true;
          stationBtn.textContent = 'اختر القسم';
          try { closeStationDropdown(); } catch (_) {}
          try { renderStationChecklist([]); } catch (_) {}
        }
        try { updateSelectedStationsLabel(); } catch (_) {}
      }
    };

    if (hasAllSectors) {
      sectorSelect.disabled = false;
      sectorSelect.dataset.autoSelectionDone = 'true';
      if (placeholder) {
        placeholder.selected = !currentValue;
      }
      syncSectorStripeHighlight(currentValue);
      if (currentValue) {
        try { onSectorChange(); } catch (_) {}
        try { applyAllFilters(); } catch (_) {}
      } else {
        if (stationBtn) {
          stationBtn.disabled = true;
          stationBtn.textContent = 'اختر القسم';
        }
        try { updateSelectedStationsLabel(); } catch (_) {}
      }
      return;
    }

    sectorSelect.disabled = false;

    if (currentAllowed && autoDone) {
      if (placeholder) placeholder.selected = false;
      try { onSectorChange(); } catch (_) {}
      try { applyAllFilters(); } catch (_) {}
      return;
    }

    if (sectorSelect.value) {
      sectorSelect.value = '';
    }
    if (placeholder) {
      placeholder.selected = true;
    }
    syncSectorStripeHighlight('');
    if (stationBtn) {
      stationBtn.disabled = true;
      stationBtn.textContent = 'اختر القسم';
      try { closeStationDropdown(); } catch (_) {}
    }
    try { renderStationChecklist([]); } catch (_) {}
    try { updateSelectedStationsLabel(); } catch (_) {}
  } catch (error) {
    console.warn('Failed to restrict sector filter to assigned sectors:', error);
  }
}

function localLogin(username, password) {
  const ok = USERS[username] && USERS[username] === password;
  if (ok) {
    sessionStorage.setItem('token', 'dev-token');
    sessionStorage.setItem('user', username);
    // Open main in a script-opened tab/window (so it can self-close on logout)
    const appUrl = 'frontend/main.html';
    let appWin = null;
    try { appWin = window.open(appUrl, '_blank', 'noopener,noreferrer'); } catch(_) {}
    if (!appWin) {
      // Popup blocked: fallback to same-tab navigation
      try { window.location.href = appUrl; } catch(_) { try { window.location.assign(appUrl); } catch(_) {} }
    }
  } else {
    const msg = document.getElementById('loginMsg');
    if (msg) msg.textContent = 'فشل تسجيل الدخول. تأكد من البيانات.';
  }
}

(function wireLogin(){
  const form = document.getElementById('loginForm');
  if (!form) return;
  const msg = document.getElementById('loginMsg');
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    msg.textContent = 'جارٍ التحقق...';
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (FRONTEND_ONLY) localLogin(username, password);
  });
})();

function requireAuth() {
  const hasPortalSession = primePortalSession();
  const hasLegacySession = !!sessionStorage.getItem('token')
    || localStorage.getItem('auth') === 'ok';

  if (hasPortalSession || hasLegacySession) {
    return;
  }

  try {
    window.location.href = '/index.html';
  } catch (_) {
    window.location.assign('/index.html');
  }
}

/* Add CSS for .sort-arrow to match search input color */
const style = document.createElement('style');
style.textContent = `.sort-arrow { color: #60a5fa !important; font-weight: bold; }`;
document.head.appendChild(style);

/**
 * Logout (shared): clears auth and returns to main menu.
 * Used by sheet.html header button via onclick="logoutApp(event)".
 */
async function logoutApp(ev) {
  try { ev && ev.preventDefault && ev.preventDefault(); } catch {}
  const proceed = await UnsavedGuard.tryConfirmNavigation({
    onSave: weaponsSaveBeforeExit,
  });
  if (!proceed) return;
  
  // Ask server to cleanup tmp files before leaving (best-effort)
  try {
    const blob = new Blob([JSON.stringify({ ts: Date.now() })], { type: 'application/json' });
    // Fire and forget using beacon if possible
    if (!(navigator.sendBeacon && navigator.sendBeacon(buildWeaponsApiUrl('/api/cleanup-temp'), blob))) {
      fetch(buildWeaponsApiUrl('/api/cleanup-temp'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ts: Date.now() }), keepalive: true }).catch(()=>{});
    }
  } catch {}

  const portalToken = getPortalToken();

  if (!portalToken) {
    try {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'weapons-logout' }),
        keepalive: true
      }).catch(() => {});
    } catch (_) {}
  }

  try {
    sessionStorage.removeItem('token');
    localStorage.removeItem('auth');
    localStorage.removeItem('token');
  } catch (_) {}

  // Navigate back to the main menu (General frontend)
  try {
    window.location.href = '/main.html';
  } catch {
    try { 
      window.location.assign('/main.html'); 
    } catch {}
  }
}
// Expose globally for inline onclick usage
window.logoutApp = logoutApp;
