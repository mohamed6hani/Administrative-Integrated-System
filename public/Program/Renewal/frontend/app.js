// Shared constants
const OK_KEY = 'sheet_access_granted';
const GENERAL_TOKEN_KEY = 'general.auth.token';
const GENERAL_USER_KEY = 'general.auth.user';
const DELETE_APPROVAL_INSPECT_STORAGE_KEY = 'general.deleteApprovalInspectTarget';
const PORTAL_ADMIN_SECTOR_LABEL = '\u0627\u0644\u0625\u062f\u0627\u0631\u0629';
const SHARED_REFERENCE_DATA = window.AdministrativeSharedReferenceData || null;

// Static sector -> stations mapping
const sectorStations = SHARED_REFERENCE_DATA
  ? SHARED_REFERENCE_DATA.getSectorStationsMap('key')
  : {
    east: ["مكتب تجريبي 01","مكتب تجريبي 02","مكتب تجريبي 03","مكتب تجريبي 04","مكتب تجريبي 05","مكتب تجريبي 06","مكتب تجريبي 07","مكتب تجريبي 08","مكتب تجريبي 09","مكتب تجريبي 10"],
    west: ["مكتب تجريبي 11","مكتب تجريبي 12","مكتب تجريبي 13","مكتب تجريبي 14","مكتب تجريبي 15","مكتب تجريبي 16","مكتب تجريبي 17","مكتب تجريبي 18","مكتب تجريبي 19"],
    south: ["مكتب تجريبي 20","مكتب تجريبي 21","مكتب تجريبي 22","مكتب تجريبي 23","مكتب تجريبي 24","مكتب تجريبي 25","مكتب تجريبي 26","مكتب تجريبي 27","مكتب تجريبي 28","مكتب تجريبي 29","مكتب تجريبي 30"],
    north: ["مكتب تجريبي 31","مكتب تجريبي 32","مكتب تجريبي 33","مكتب تجريبي 34","مكتب تجريبي 35","مكتب تجريبي 36","مكتب تجريبي 37","مكتب تجريبي 38","مكتب تجريبي 39","مكتب تجريبي 40"],
    sectorfive: ["مكتب تجريبي 41","مكتب تجريبي 42","مكتب تجريبي 43","مكتب تجريبي 44","مكتب تجريبي 45"]
  };
const sectorArabicNames = SHARED_REFERENCE_DATA
  ? SHARED_REFERENCE_DATA.getSectorKeyToLabelMap()
  : { east:"شرق", west:"غرب", south:"جنوب", north:"شمال", sectorfive:"القطاع التجريبي الخامس" };
const ALL_SECTOR_LABELS = Object.values(sectorArabicNames);
const RENEWAL_CSV_ENDPOINT = '/api/renewal/csv-data';
const RENEWAL_CSV_VERSION_ENDPOINT = '/api/renewal/csv-version';
const REFRESH_INTERVAL_MS = 15000;
const MAX_RECORDS_PER_PAGE = 250;
const STATION_ALL_KEYWORDS = new Set(['all', 'كل', 'الكل', 'جميع الأقسام', 'جميع الاقسام', 'كافة الأقسام', 'كافة الاقسام']);

// Unsaved-change guard
const RENEWAL_UNSAVED_MESSAGE = 'هناك تعديلات لم يتم حفظها بعد. احفظ التغييرات أولاً أو تابع للمغادرة دون حفظ.';
const RENEWAL_UNSAVED_CLASS = 'renewal-unsaved';
let renewalHasUnsavedChanges = false;
let renewalGuardEnabled = false;
let renewalUnsavedDialogElement = null;
let renewalUnsavedDialogStyleInjected = false;

function renewalShouldWarn() {
  if (!renewalGuardEnabled) return false;
  return renewalHasUnsavedChanges;
}

function renewalMarkDirty() {
  if (!renewalGuardEnabled) return;
  renewalHasUnsavedChanges = true;
  try { document.body.classList.add(RENEWAL_UNSAVED_CLASS); } catch (_) {}
}

function renewalClearDirty() {
  renewalHasUnsavedChanges = false;
  try { document.body.classList.remove(RENEWAL_UNSAVED_CLASS); } catch (_) {}
}

function injectRenewalUnsavedDialogStyles() {
  if (renewalUnsavedDialogStyleInjected) return;
  try {
    const style = document.createElement('style');
    style.id = 'renewal-unsaved-exit-style';
    style.textContent = `.unsaved-exit-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.55);display:none;align-items:center;justify-content:center;z-index:9999;padding:16px;backdrop-filter:blur(2px);} 
.unsaved-exit-overlay.open{display:flex;} 
.unsaved-exit-overlay[data-loading="true"] .unsaved-exit-btn{pointer-events:none;opacity:0.65;} 
.unsaved-exit-modal{background:#fff;color:#0f172a;border-radius:14px;box-shadow:0 24px 56px rgba(15,23,42,0.25);padding:24px 28px;width:min(92vw,420px);max-width:420px;font-family:inherit;} 
.unsaved-exit-modal h2{margin:0 0 12px;font-size:1.35rem;font-weight:700;color:#0f172a;} 
.unsaved-exit-message{margin:0 0 18px;font-size:1rem;line-height:1.7;} 
.unsaved-exit-error{min-height:1.25em;margin:0 0 12px;font-size:0.95rem;color:#dc2626;} 
.unsaved-exit-actions{display:flex;flex-direction:column;gap:10px;} 
.unsaved-exit-btn{font-family:inherit;font-size:1rem;font-weight:600;border-radius:10px;padding:12px 16px;border:0;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;background:#e2e8f0;color:#0f172a;box-shadow:0 6px 16px rgba(15,23,42,0.12);} 
.unsaved-exit-btn.primary{background:#2563eb;color:#fff;box-shadow:0 10px 24px rgba(37,99,235,0.25);} 
.unsaved-exit-btn.primary:hover{background:#1d4ed8;} 
.unsaved-exit-btn.secondary{background:#f8fafc;color:#0f172a;} 
.unsaved-exit-btn.secondary:hover{background:#e2e8f0;} 
.unsaved-exit-btn.ghost{background:#fff;color:#0f172a;border:1px solid #cbd5f5;box-shadow:none;} 
.unsaved-exit-btn.ghost:hover{background:#f8fafc;} 
.unsaved-exit-btn:focus-visible{outline:3px solid rgba(37,99,235,0.45);outline-offset:2px;} 
@media (min-width:480px){.unsaved-exit-actions{flex-direction:row;}.unsaved-exit-btn{flex:1;}}
`;
    document.head.appendChild(style);
    renewalUnsavedDialogStyleInjected = true;
  } catch (_) {}
}

function ensureRenewalUnsavedDialog() {
  if (renewalUnsavedDialogElement && document.body.contains(renewalUnsavedDialogElement)) {
    return renewalUnsavedDialogElement;
  }
  injectRenewalUnsavedDialogStyles();
  const overlay = document.createElement('div');
  overlay.id = 'renewalUnsavedDialog';
  overlay.className = 'unsaved-exit-overlay';
  overlay.tabIndex = -1;
  overlay.innerHTML = `
    <div class="unsaved-exit-modal" role="dialog" aria-modal="true" aria-labelledby="renewal-unsaved-title">
      <h2 id="renewal-unsaved-title">تأكيد الخروج</h2>
      <p class="unsaved-exit-message"></p>
      <div class="unsaved-exit-error" role="alert"></div>
      <div class="unsaved-exit-actions" dir="rtl">
        <button type="button" class="unsaved-exit-btn primary" data-action="save">💾 خروج مع الحفظ</button>
        <button type="button" class="unsaved-exit-btn secondary" data-action="discard">🚪 خروج من غير حفظ</button>
        <button type="button" class="unsaved-exit-btn ghost" data-action="stay">↩️ رجوع</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  renewalUnsavedDialogElement = overlay;
  return overlay;
}

function showRenewalUnsavedDialog({ message = RENEWAL_UNSAVED_MESSAGE, onSave, checkDirty } = {}) {
  const overlay = ensureRenewalUnsavedDialog();
  const messageEl = overlay.querySelector('.unsaved-exit-message');
  const errorEl = overlay.querySelector('.unsaved-exit-error');
  const saveBtn = overlay.querySelector('button[data-action="save"]');
  const discardBtn = overlay.querySelector('button[data-action="discard"]');
  const stayBtn = overlay.querySelector('button[data-action="stay"]');
  const defaultSaveLabel = '💾 خروج مع الحفظ';
  const defaultDiscardLabel = '🚪 خروج من غير حفظ';
  const defaultStayLabel = '↩️ رجوع';

  messageEl.textContent = message;
  errorEl.textContent = '';
  overlay.dataset.loading = 'false';
  saveBtn.textContent = defaultSaveLabel;
  discardBtn.textContent = defaultDiscardLabel;
  stayBtn.textContent = defaultStayLabel;
  saveBtn.disabled = discardBtn.disabled = stayBtn.disabled = false;

  overlay.classList.add('open');
  try { overlay.focus({ preventScroll: true }); } catch (_) { try { overlay.focus(); } catch {} }

  return new Promise((resolve) => {
    let resolved = false;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const cleanup = (result) => {
      if (resolved) return;
      resolved = true;
      overlay.classList.remove('open');
      overlay.dataset.loading = 'false';
      errorEl.textContent = '';
      saveBtn.textContent = defaultSaveLabel;
      discardBtn.textContent = defaultDiscardLabel;
      stayBtn.textContent = defaultStayLabel;
      saveBtn.disabled = discardBtn.disabled = stayBtn.disabled = false;
      overlay.removeEventListener('keydown', keyHandler);
      overlay.removeEventListener('click', outsideHandler);
      saveBtn.onclick = discardBtn.onclick = stayBtn.onclick = null;
      if (previousFocus && typeof previousFocus.focus === 'function') {
        setTimeout(() => {
          try { previousFocus.focus(); } catch (_) {}
        }, 40);
      }
      resolve(result);
    };

    const keyHandler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanup('stay');
      }
    };

    const outsideHandler = (event) => {
      if (event.target === overlay) {
        event.preventDefault();
        cleanup('stay');
      }
    };

    saveBtn.onclick = async () => {
      errorEl.textContent = '';
      if (typeof onSave === 'function') {
        overlay.dataset.loading = 'true';
        saveBtn.disabled = discardBtn.disabled = stayBtn.disabled = true;
        saveBtn.textContent = '💾 جاري الحفظ...';
        try {
          const outcome = await onSave();
          const stillDirty = typeof checkDirty === 'function' ? checkDirty() : false;
          if (outcome === false || stillDirty) {
            throw new Error('SAVE_UNCONFIRMED');
          }
          cleanup('save');
          return;
        } catch (error) {
          const msg = (error && error.message && error.message !== 'SAVE_UNCONFIRMED')
            ? error.message
            : 'تعذر الحفظ. حاول مرة أخرى.';
          errorEl.textContent = msg;
          overlay.dataset.loading = 'false';
          saveBtn.disabled = discardBtn.disabled = stayBtn.disabled = false;
          saveBtn.textContent = defaultSaveLabel;
          return;
        }
      }
      cleanup('save');
    };

    discardBtn.onclick = () => cleanup('discard');
    stayBtn.onclick = () => cleanup('stay');

    overlay.addEventListener('keydown', keyHandler);
    overlay.addEventListener('click', outsideHandler);

    setTimeout(() => {
      try { saveBtn.focus({ preventScroll: true }); } catch (_) { try { saveBtn.focus(); } catch {} }
    }, 30);
  });
}

async function renewalTryConfirmNavigation(options = {}) {
  if (!renewalShouldWarn()) return true;
  const { message = RENEWAL_UNSAVED_MESSAGE, onSave } = options || {};
  const result = await showRenewalUnsavedDialog({
    message,
    onSave: typeof onSave === 'function' ? onSave : undefined,
    checkDirty: () => renewalShouldWarn(),
  });

  if (result === 'save' || result === 'discard') {
    renewalClearDirty();
    return true;
  }
  return false;
}

function renewalBeforeUnloadHandler(event) {
  if (!renewalShouldWarn()) return;
  event.preventDefault();
  event.returnValue = RENEWAL_UNSAVED_MESSAGE;
}

function ensureRenewalUnsavedStyle() {
  try {
    if (document.getElementById('renewal-unsaved-style')) return;
    const style = document.createElement('style');
    style.id = 'renewal-unsaved-style';
    style.textContent = `body.${RENEWAL_UNSAVED_CLASS} #saveBtn { background-color: #ea580c !important; border-color: #c2410c !important; color: #fff !important; box-shadow: 0 0 0 3px rgba(234,88,12,0.2); }
body.${RENEWAL_UNSAVED_CLASS} #saveBtn:hover { filter: brightness(1.05); }`;
    document.head.appendChild(style);
  } catch (_) {}
}

function ensurePortalSessionAlive() {
  try {
    const token = sessionStorage.getItem(GENERAL_TOKEN_KEY) || localStorage.getItem(GENERAL_TOKEN_KEY);
    const userRecord = sessionStorage.getItem(GENERAL_USER_KEY) || localStorage.getItem(GENERAL_USER_KEY);
    if (!token || !userRecord) return false;
    sessionStorage.setItem(GENERAL_TOKEN_KEY, token);
    localStorage.setItem(GENERAL_TOKEN_KEY, token);
    sessionStorage.setItem(GENERAL_USER_KEY, userRecord);
    localStorage.setItem(GENERAL_USER_KEY, userRecord);
    return true;
  } catch (error) {
    console.warn('⚠️  Failed to keep unified session alive:', error);
    return false;
  }
}

function isAllStationsToken(value) {
  if (value == null) return false;
  const normalized = String(value).trim();
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  return STATION_ALL_KEYWORDS.has(normalized) || STATION_ALL_KEYWORDS.has(lower);
}

function normalizePortalStationList(raw, allowedStations, sectorLabel = '') {
  const fallback = { list: [], isAll: false };
  const allowed = Array.isArray(allowedStations)
    ? allowedStations.map((station) => normalizeStationLabelValue(station, sectorLabel)).filter(Boolean)
    : [];
  if (!allowed.length) {
    if (typeof raw === 'string' && isAllStationsToken(raw)) {
      return { list: [], isAll: true };
    }
    if (Array.isArray(raw) && raw.some((value) => isAllStationsToken(value))) {
      return { list: [], isAll: true };
    }
    return fallback;
  }
  const allowedByKey = new Map();
  allowed.forEach((station) => {
    const key = normalizeStationMatchKey(station, sectorLabel);
    if (key && !allowedByKey.has(key)) allowedByKey.set(key, station);
  });
  if (typeof raw === 'string') {
    const token = normalizeStationLabelValue(raw, sectorLabel);
    if (!token) return fallback;
    if (isAllStationsToken(token)) {
      return { list: allowed.slice(), isAll: true };
    }
    const tokenKey = normalizeStationMatchKey(token, sectorLabel);
    return tokenKey && allowedByKey.has(tokenKey)
      ? { list: [allowedByKey.get(tokenKey)], isAll: false }
      : fallback;
  }
  if (Array.isArray(raw)) {
    const collected = [];
    const seen = new Set();
    for (const value of raw) {
      const token = normalizeStationLabelValue(value, sectorLabel);
      if (!token) continue;
      if (isAllStationsToken(token)) {
        return { list: allowed.slice(), isAll: true };
      }
      const tokenKey = normalizeStationMatchKey(token, sectorLabel);
      if (tokenKey && !seen.has(tokenKey) && allowedByKey.has(tokenKey)) {
        seen.add(tokenKey);
        collected.push(allowedByKey.get(tokenKey));
      }
    }
    if (collected.length >= allowed.length) {
      return { list: allowed.slice(), isAll: true };
    }
    return { list: collected, isAll: false };
  }
  return fallback;
}

function extractPortalStationSource(user) {
  if (!user || typeof user !== 'object') return {};
  if (user.stationAccess && typeof user.stationAccess === 'object' && !Array.isArray(user.stationAccess)) {
    return user.stationAccess;
  }
  if (user.stations && typeof user.stations === 'object' && !Array.isArray(user.stations)) {
    return user.stations;
  }
  return {};
}

function normalizeSectorLabelValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw === PORTAL_ADMIN_SECTOR_LABEL) return raw;
  const compact = raw.replace(/\s+/g, ' ');
  if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.resolveSectorLabel === 'function') {
    const resolved = SHARED_REFERENCE_DATA.resolveSectorLabel(compact);
    if (resolved) return resolved;
  }
  if (ALL_SECTOR_LABELS.includes(compact)) return compact;
  const withoutPrefix = compact.replace(/^قطاع\s+/u, '').trim();
  if (ALL_SECTOR_LABELS.includes(withoutPrefix)) return withoutPrefix;
  const withoutArticle = withoutPrefix.replace(/^ال/u, '').trim();
  if (ALL_SECTOR_LABELS.includes(withoutArticle)) return withoutArticle;
  for (const label of ALL_SECTOR_LABELS) {
    if (compact.includes(label)) return label;
  }
  for (const label of ALL_SECTOR_LABELS) {
    const trimmed = label.replace(/^ال/u, '');
    if (trimmed && compact.includes(trimmed)) return label;
  }
  return withoutPrefix || compact;
}

function normalizeStationLabelValue(value, sectorLabel = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const compact = raw.replace(/\s+/g, ' ');
  if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.resolveStationName === 'function') {
    return SHARED_REFERENCE_DATA.resolveStationName(compact, sectorLabel) || compact;
  }
  return compact;
}

function normalizeArabicMatchKey(value) {
  if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.normalizeMatchKey === 'function') {
    return SHARED_REFERENCE_DATA.normalizeMatchKey(value);
  }
  return toEnglishNumerals(String(value || ''))
    .replace(/\uFEFF/g, '')
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[هة]/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim()
    .toLowerCase();
}

function normalizeStationMatchKey(value, sectorLabel = '') {
  const canonical = normalizeStationLabelValue(value, sectorLabel);
  return normalizeArabicMatchKey(canonical || value);
}

function stationValuesMatch(left, right, sectorLabel = '') {
  const leftKey = normalizeStationMatchKey(left, sectorLabel);
  const rightKey = normalizeStationMatchKey(right, sectorLabel);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

function isStationInSet(stationName, stationSet, sectorLabel = '') {
  if (!stationName || !stationSet || typeof stationSet.has !== 'function') return false;
  if (stationSet.has(stationName)) return true;
  for (const allowedStation of stationSet) {
    if (stationValuesMatch(stationName, allowedStation, sectorLabel)) return true;
  }
  return false;
}

function isStationInList(stationName, stationList, sectorLabel = '') {
  return Array.isArray(stationList)
    && stationList.some((allowedStation) => stationValuesMatch(stationName, allowedStation, sectorLabel));
}

function detectSectorLabelFromStationName(stationName) {
  const target = normalizeStationLabelValue(stationName);
  if (!target) return '';
  if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.detectSectorLabelFromStation === 'function') {
    return SHARED_REFERENCE_DATA.detectSectorLabelFromStation(target) || '';
  }
  for (const [key, stations] of Object.entries(sectorStations)) {
    if (isStationInList(target, stations)) {
      return sectorArabicNames[key] || key;
    }
  }
  return '';
}

let portalStationAccessCache = null;

function resetPortalStationAccessCache() {
  portalStationAccessCache = null;
}

function getPortalStationAccessSnapshot(forceRefresh = false) {
  if (!forceRefresh && portalStationAccessCache) return portalStationAccessCache;

  const user = getPortalUserProfile();
  const isAdmin = hasPortalAdminAccess(user);
  const allowedSectorLabels = (!user || isAdmin)
    ? new Set(ALL_SECTOR_LABELS)
    : new Set(deriveAllowedPortalSectors(user));
  const allowedStationsByLabel = {};
  const allowedStationSetsByLabel = {};
  let hasAnyLimits = false;

  Object.entries(sectorStations).forEach(([key, stations]) => {
    const label = sectorArabicNames[key] || key;
    const normalized = Array.isArray(stations)
      ? stations.map((station) => String(station || '').trim()).filter(Boolean)
      : [];
    allowedStationsByLabel[label] = normalized;
    allowedStationSetsByLabel[label] = new Set(normalized);
  });

  if (user && !isAdmin) {
    const source = extractPortalStationSource(user);
    Object.entries(source).forEach(([sectorLabel, raw]) => {
      const resolvedLabel = normalizeSectorLabelValue(sectorLabel);
      const englishKey = Object.keys(sectorArabicNames).find((key) => sectorArabicNames[key] === resolvedLabel) || resolvedLabel;
      const allowedList = englishKey && sectorStations[englishKey] ? sectorStations[englishKey] : [];
      const targetLabel = sectorArabicNames[englishKey] || resolvedLabel;
      const { list, isAll } = normalizePortalStationList(raw, allowedList, targetLabel);
      if (!targetLabel) return;
      if (isAll) {
        allowedStationsByLabel[targetLabel] = allowedList.slice();
        allowedStationSetsByLabel[targetLabel] = new Set(allowedList);
      } else if (list.length) {
        allowedStationsByLabel[targetLabel] = list.slice();
        allowedStationSetsByLabel[targetLabel] = new Set(list);
        if (list.length < allowedList.length) hasAnyLimits = true;
      } else {
        allowedStationsByLabel[targetLabel] = [];
        allowedStationSetsByLabel[targetLabel] = new Set();
        hasAnyLimits = true;
      }
    });
  }

  const unionAllowedStations = new Set();
  Object.entries(allowedStationSetsByLabel).forEach(([label, set]) => {
    if (!allowedSectorLabels.size || allowedSectorLabels.has(label) || isAdmin) {
      set.forEach((station) => unionAllowedStations.add(station));
    }
  });

  portalStationAccessCache = {
    user,
    isAdmin,
    allowedSectorLabels,
    allowedStationsByLabel,
    allowedStationSetsByLabel,
    hasAnyLimits,
    unionAllowedStations
  };
  return portalStationAccessCache;
}

function getAllowedStationsForSectorLabel(sectorLabel) {
  const resolved = normalizeSectorLabelValue(sectorLabel);
  if (!resolved) return [];
  const snapshot = getPortalStationAccessSnapshot();
  if (snapshot.isAdmin) {
    return (snapshot.allowedStationsByLabel[resolved] || []).slice();
  }
  if (!snapshot.allowedSectorLabels.has(resolved)) {
    return [];
  }
  return (snapshot.allowedStationsByLabel[resolved] || []).slice();
}

function getPortalUserProfile() {
  const raw = sessionStorage.getItem(GENERAL_USER_KEY) || localStorage.getItem(GENERAL_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Unable to parse portal user record:', error);
    resetPortalStationAccessCache();
    return null;
  }
}

function canEditRenewalDocumentsForPortal(user = getPortalUserProfile()) {
  if (!user) return false;
  const role = String(user.role || 'user').trim().toLowerCase();
  if (role === 'admin' || role === 'supersecretary') return true;
  const permissions = user.permissions && typeof user.permissions === 'object'
    ? user.permissions
    : {};
  return Boolean(permissions.editRenewalDocuments);
}

function storePortalUserProfile(user) {
  if (!user || typeof user !== 'object') return;
  const serialized = JSON.stringify(user);
  try { sessionStorage.setItem(GENERAL_USER_KEY, serialized); } catch (_) {}
  try { localStorage.setItem(GENERAL_USER_KEY, serialized); } catch (_) {}
  resetPortalStationAccessCache();
}

async function refreshPortalUserProfile() {
  let token = '';
  try {
    token = sessionStorage.getItem(GENERAL_TOKEN_KEY) || localStorage.getItem(GENERAL_TOKEN_KEY) || '';
  } catch (_) {}
  if (!token) return getPortalUserProfile();
  try {
    const response = await fetch('/api/auth/profile', {
      method: 'GET',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.user) return getPortalUserProfile();
    storePortalUserProfile(payload.user);
    return payload.user;
  } catch (_) {
    return getPortalUserProfile();
  }
}

function hasPortalAdminAccess(user) {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin') return true;
  const sectors = Array.isArray(user.sectors) && user.sectors.length
    ? user.sectors
    : (user.room ? [user.room] : []);
  return sectors.some((label) => label === PORTAL_ADMIN_SECTOR_LABEL);
}

function deriveAllowedPortalSectors(user) {
  if (!user) return [];
  const rawSectors = Array.isArray(user.sectors) && user.sectors.length
    ? user.sectors
    : (user.room ? [user.room] : []);
  return Array.from(new Set(rawSectors.map(normalizeSectorLabelValue).filter(Boolean)));
}

// ---------- Utilities ----------
function escapeHTML(str){return (str??'').toString().replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));}

// Convert English numbers to Arabic numerals
function toArabicNumerals(str) {
  if (!str && str !== 0) return str;
  const arabicNumerals = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return str.toString().replace(/[0-9]/g, d => arabicNumerals[+d]);
}

// Convert Arabic numbers back to English numerals
function toEnglishNumerals(str) {
  if (!str && str !== 0) return str;
  const map = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
  return str.toString().replace(/[٠-٩]/g, d => map[d]);
}

function normalizePersonNameKey(value) {
  return String(value ?? '')
    .replace(/\uFEFF/g, '')
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractRowName(row) {
  if (!row || typeof row !== 'object') return '';
  return row['الاســـــــم']
    || row['﻿الاســـــــم']
    || row['الاسم']
    || row['اسم']
    || row.name
    || '';
}

function findDuplicateNameInRows(rows) {
  if (!Array.isArray(rows)) return null;
  const seen = new Map();
  for (const row of rows) {
    const candidate = extractRowName(row);
    const key = normalizePersonNameKey(candidate);
    if (!key) continue;
    if (seen.has(key)) {
      return { duplicate: candidate, original: seen.get(key) };
    }
    seen.set(key, candidate);
  }
  return null;
}

// Normalize BOMs in object keys (e.g., "\uFEFFرقم الرخصة" → "رقم الرخصة")
function normalizeKeys(row){
  const o = {};
  for (const k of Object.keys(row||{})) o[k.replace(/\uFEFF/g,'')] = row[k];
  return o;
}

// CSV parsing (quoted fields supported) — kept in case you use it elsewhere
function parseCSV(text){
  const rows=[]; let row=[]; let cur=''; let inside=false; let i=0;
  while(i<text.length){
    const c=text[i];
    if(c==='"'){ if(inside && text[i+1]==='"'){cur+='"'; i++;} else {inside=!inside;} }
    else if(c===',' && !inside){row.push(cur);cur='';}
    else if((c==='\n'||c==='\r') && !inside){ if(cur!==''||row.length){row.push(cur);rows.push(row);row=[];cur='';} if(c==='\r'&&text[i+1]==='\n') i++; }
    else {cur+=c;}
    i++;
  }
  if(cur!==''||row.length){row.push(cur);rows.push(row);}
  if(!rows.length) return [];
  const headers = rows.shift();
  return rows.filter(r=>r.some(v=>(v||'').trim()!==''))
             .map(r=>{const o={};headers.forEach((h,idx)=>o[h.replace(/\uFEFF/g,'')]=r[idx]||'');return o;});
}

// Page detection helpers
function isLoginPage(){ return document.body.classList.contains('login'); }
function isSheetPage(){ return document.body.classList.contains('sheet'); }

// ---------- Login ----------
function initLogin(){
  window.location.replace('/login');
}

// ---------- Validation helpers ----------
function isOnlyArabicLetters(str) { return /^[\u0600-\u06FF\s]+$/.test((str||'').trim()); }
function isOnlyNumbers(str) { return /^[0-9\u0660-\u0669]+$/.test(String(str || '').replace(/\s+/g, '')); }

function showValidationError(inputElement, message) {
  hideValidationError(inputElement);
  const errorDiv = document.createElement('div');
  errorDiv.className = 'validation-error';
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  const rect = inputElement.getBoundingClientRect();
  const er = errorDiv.getBoundingClientRect();
  errorDiv.style.left = (rect.left + rect.width/2 - er.width/2) + 'px';
  errorDiv.style.top = (rect.top - er.height - 8) + 'px';
  errorDiv.style.position = 'fixed';
  inputElement.classList.add('error');
  setTimeout(() => hideValidationError(inputElement), 3000);
}
function hideValidationError(inputElement) {
  document.querySelectorAll('.validation-error').forEach(e => e.remove());
  inputElement.classList.remove('error');
}

// ---------- Caret helpers ----------
function getCaretPosition(element) {
  let caretOffset = 0;
  const doc = element.ownerDocument || element.document;
  const win = doc.defaultView || doc.parentWindow;
  if (typeof win.getSelection != "undefined") {
    const sel = win.getSelection();
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(element);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      caretOffset = preCaretRange.toString().length;
    }
  }
  return caretOffset;
}
function setCaretPosition(element, pos) {
  const range = document.createRange();
  const sel = window.getSelection();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
  let node, offset = 0;
  while (node = walker.nextNode()) {
    if (offset + node.textContent.length >= pos) {
      range.setStart(node, pos - offset);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    offset += node.textContent.length;
  }
}

// ---------- Sheet ----------
function initSheet(){
  console.log('📊 Sheet page initialized');
  // Unified system handles auth; don't bounce to local index.html
  try { if(localStorage.getItem(OK_KEY)!=='1') localStorage.setItem(OK_KEY,'1'); } catch(_) {}
  if (!ensurePortalSessionAlive()) {
    console.warn('⚠️  Unified portal session not detected while loading renewal sheet.');
  }

  const tbody = document.getElementById('tbody');
  const countEl = document.getElementById('count');
  const form = document.getElementById('filterForm');
  const logoutBtn=document.getElementById('logoutBtn');
  const categorySelect = document.getElementById('categorySelect');
  const categoryButtonsContainer = document.getElementById('categoryButtons');
  const renewalSearchColumnSelect = document.getElementById('renewalSearchColumn');
  const sectorSelect = document.getElementById('sectorSelect');
  const sectorStripesContainer = document.getElementById('sectorStripes');
  const stationContainer = document.getElementById('stationOptions');
  const stationButtonsContainer = document.getElementById('stationButtonsContainer');
  const typeContainer = document.getElementById('typeOptions');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const pageInfo = document.getElementById('pageInfo');
  const insertBtn = document.getElementById('insertBtn');
  const browserPrintBtn = document.getElementById('browserPrintBtn');
  const saveBtn = document.getElementById('saveBtn');
  const tableWrapper = document.getElementById('tableWrapper');
  const undoBtn = document.getElementById('undoBtn');
  const renewalInfoBtn = document.getElementById('renewalInfoBtn');
  const renewalInfoFrame = document.getElementById('renewalInfoFrame');
  const renewalInfoCloseBtn = document.getElementById('renewalInfoCloseBtn');
  const renewalInfoSubtitle = document.getElementById('renewalInfoSubtitle');
  const renewalInfoSectorFilter = document.getElementById('renewalInfoSectorFilter');
  const renewalInfoStationFilter = document.getElementById('renewalInfoStationFilter');
  const renewalInfoMeta = document.getElementById('renewalInfoMeta');
  const renewalInfoTableBody = document.getElementById('renewalInfoTableBody');

  const UNDO_ENDPOINTS = {
    list: '/api/renewal/undo',
    store: '/api/renewal/undo/store',
    restore: '/api/renewal/undo/restore'
  };

  const PHOTO_ENDPOINTS = {
    upload: '/api/renewal/photos/upload',
    replace: '/api/renewal/photos/replace',
    oldFileBase: '/api/renewal/photos/old/file',
    restore: '/api/renewal/photos/restore',
    delete: '/api/renewal/photos/delete',
    fileBase: '/api/renewal/photos/file'
  };

  const undoState = {
    records: [],
    selected: new Set(),
    overlay: null,
    tableBody: null,
    emptyState: null,
    restoreButton: null,
    selectAllInput: null
  };

  const attachmentState = {
    overlay: null,
    grid: null,
    emptyState: null,
    title: null,
    subtitle: null,
    deleteButton: null,
    addButton: null,
    editButton: null,
    viewButton: null,
    oldViewButton: null,
    oldRestoreButton: null,
    selectAllInput: null,
    fileInput: null,
    activeRowIndex: -1,
    pendingUploadRowIndex: -1,
    selected: new Set(),
    oldAvailabilityCache: new Map(),
    oldAvailabilityRequestId: 0,
    lastFocusedElement: null
  };

  const renewalActionsState = {
    overlay: null,
    textarea: null,
    title: null,
    saveButton: null,
    closeButton: null,
    activeRowIndex: -1,
    originalValue: '',
    lastFocusedElement: null
  };

  const scannerState = {
    overlay: null,
    sourceCanvas: null,
    previewCanvas: null,
    sourceContext: null,
    previewContext: null,
    sourceZoom: 1,
    previewZoom: 1,
    sourceZoomMode: 'fit',
    previewZoomMode: 'fit',
    zoomResizeObserver: null,
    zoomFrameIds: { source: 0, preview: 0 },
    previewDisplayWidth: 0,
    previewDisplayHeight: 0,
    filename: '',
    documentKind: 'image',
    image: null,
    sourceBackdrop: null,
    corners: [],
    activeCorner: -1,
    scannerMode: 'digital-document',
    brightness: 0,
    contrast: 0,
    isLoading: false,
    isSaving: false,
    renderFrame: 0,
    isDraggingCorner: false,
    openRequestId: 0,
    previewViewer: null,
    lastFocusedElement: null,
    pdfLoadingTask: null,
    pdfDocument: null,
    pdfOriginalBytes: null,
    pdfPageCount: 0,
    pdfCurrentPageIndex: 0,
    pdfPageStates: [],
    pdfPageRenderRequestId: 0,
    sourceMaxEdge: 1600,
    dragPreviewMaxEdge: 420,
    previewMaxEdge: 1600,
    exportSourceMaxEdge: 4608,
    exportMaxEdge: 3840,
    exportQuality: 0.98
  };
  let undoKeydownListenerAttached = false;

  renewalGuardEnabled = true;
  ensureRenewalUnsavedStyle();
  renewalClearDirty();
  void refreshPortalUserProfile().then(() => {
    applyAttachmentEditorAccess();
  });

  // Data state
  let rawRows = [];
  // Snapshot of rawRows as last seen on the server. Saving diffs against this so we
  // send only the rows this user actually touched, instead of the whole file.
  let renewalBaselineRows = [];
  let currentPage = 1;
  let autoRefreshTimerId = null;
  let lastDataSignature = null;
  let lastCsvVersion = null;
  let isFetchInFlight = false;
  let pendingExternalSaveRefresh = false;
  let externalSaveRefreshTimerId = null;
  let pendingSelectionRestore = null;
  let pendingScrollRestore = null;
  let itemsPerPage = 100; // Default to 100 records per page
  let pdfLibLoadPromise = null;
  let pdfJsModulePromise = null;
  let pdfJsModuleLoadAttempt = 0;
  const CATEGORY_FILTER_VALUES = ['', 'has-notes', 'no-notes'];
  const SECTOR_STRIPE_COLORS = ['#0ea5a4', '#f97316', '#22c55e', '#6366f1', '#0ea5e9', '#e11d48', '#7c3aed', '#d97706'];
  
  // Sorting state
  let currentSortColumn = null;
  let currentSortDirection = 'asc'; // 'asc' or 'desc'
  const renewalColumnContentFilters = new Map();
  let columnContentFilterMenuEl = null;

  // License type normalization - map variations to canonical types
  const licenseTypeMapping = {
    // دفاع variations
    'دفاع': 'دفاع',
    'دفاع ': 'دفاع',
    'دفاع نفس': 'دفاع',
    'دفاع عن النفس': 'دفاع',
    'دفاع نفس ': 'دفاع',
    'دفاع طالما بالعمل': 'دفاع طالما بالعمل',
    'دفاع طالمه في عمله': 'دفاع طالما بالعمل',
    
    // اخطار variations (handle أ vs ا)
    'اخطار': 'اخطار',
    'اخطار ': 'اخطار',
    'أخطار': 'اخطار',
    'أخطار ': 'اخطار',
    'إخطار': 'اخطار',
    'اخطار شرطة': 'اخطار',
    'أخطار شرطة': 'اخطار',
    
    // حراسة variations
    'حراسة': 'حراسة',
    'حراسة ': 'حراسة',
    
    // مخابرات variations
    'مخابرات': 'مخابرات',
    'مخابرات ': 'مخابرات'
  };

  const RENEWAL_UNDO_HEADERS = [
    'رقم الرخصة',
    'نوع الرخصة',
    'الاســـــــم',
    'قطاع',
    'القسم',
    'التجديد',
    'ملاحظـــات',
    'صورة',
    'اجراءات'
  ];

  const RENEWAL_REQUIRED_HEADERS = [
    'رقم الرخصة',
    'نوع الرخصة',
    'الاســـــــم',
    'قطاع',
    'القسم',
    'التجديد',
    'ملاحظـــات',
    'صورة',
    'اجراءات'
  ];

  function normalizeHeaderKeyForClient(key) {
    return String(key || '')
      .replace(/\uFEFF/g, '')
      .replace(/\u0640/g, '')
      .trim();
  }

  function readRowField(row, targetHeader) {
    if (!row || typeof row !== 'object') return '';
    if (row[targetHeader] != null) return String(row[targetHeader]).trim();
    const bomKey = `\uFEFF${targetHeader}`;
    if (row[bomKey] != null) return String(row[bomKey]).trim();
    const signature = normalizeHeaderKeyForClient(targetHeader);
    for (const key of Object.keys(row)) {
      if (normalizeHeaderKeyForClient(key) === signature) {
        return String(row[key] ?? '').trim();
      }
    }
    return '';
  }

  function formatRenewalInfoNumber(value) {
    return toArabicNumerals(String(Math.max(0, Number(value) || 0)));
  }

  function canUseRenewalInfoFrame() {
    try {
      const user = getPortalUserProfile();
      return String(user?.role || '').toLowerCase() === 'admin';
    } catch (_) {
      return false;
    }
  }

  function closeRenewalInfoFrame() {
    if (!renewalInfoFrame) return;
    renewalInfoFrame.classList.remove('is-visible');
    renewalInfoFrame.setAttribute('aria-hidden', 'true');
  }

  function applyRenewalInfoAccess() {
    if (!renewalInfoBtn) return;
    const allowed = canUseRenewalInfoFrame();
    renewalInfoBtn.hidden = !allowed;
    renewalInfoBtn.style.display = allowed ? '' : 'none';
    renewalInfoBtn.setAttribute('aria-hidden', allowed ? 'false' : 'true');
    if (!allowed) closeRenewalInfoFrame();
  }

  function getRenewalInfoReasonValue(row) {
    return readRowField(row, 'اسباب عدم ورود الملف')
      || readRowField(row, 'أسباب عدم ورود الملف')
      || readRowField(row, 'ملاحظـــات')
      || readRowField(row, 'ملاحظات');
  }

  function getRenewalInfoRowSector(row) {
    const explicitSector = normalizeSectorLabelValue(readRowField(row, 'قطاع'));
    if (explicitSector) return explicitSector;
    return normalizeSectorLabelValue(detectSectorLabelFromStationName(readRowField(row, 'القسم')));
  }

  function getRenewalInfoRowStation(row) {
    const sectorLabel = getRenewalInfoRowSector(row);
    return normalizeStationLabelValue(readRowField(row, 'القسم'), sectorLabel);
  }

  function getRenewalInfoSectorValue() {
    return normalizeSectorLabelValue(renewalInfoSectorFilter?.value || '');
  }

  function getRenewalInfoStationKey() {
    return String(renewalInfoStationFilter?.value || '').trim();
  }

  function getRenewalInfoStationKeyForRow(row, sectorLabel = '') {
    const rowSector = sectorLabel || getRenewalInfoRowSector(row);
    return normalizeStationMatchKey(getRenewalInfoRowStation(row), rowSector);
  }

  function sortRenewalInfoLabels(left, right) {
    const leftIndex = ALL_SECTOR_LABELS.indexOf(left.label);
    const rightIndex = ALL_SECTOR_LABELS.indexOf(right.label);
    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    }
    return left.label.localeCompare(right.label, 'ar');
  }

  function collectRenewalInfoSectorOptions() {
    const map = new Map();
    const add = (sectorLabel) => {
      const label = normalizeSectorLabelValue(sectorLabel);
      if (!label || map.has(label)) return;
      map.set(label, { value: label, label });
    };
    ALL_SECTOR_LABELS.forEach(add);
    rawRows.forEach((row) => add(getRenewalInfoRowSector(row)));
    return Array.from(map.values()).sort(sortRenewalInfoLabels);
  }

  function collectRenewalInfoStationOptions(sectorLabel = '') {
    const selectedSector = normalizeSectorLabelValue(sectorLabel);
    const map = new Map();
    const add = (stationName, stationSector = selectedSector) => {
      const label = normalizeStationLabelValue(stationName, stationSector);
      const key = normalizeStationMatchKey(label, stationSector);
      if (!key || map.has(key)) return;
      map.set(key, { key, label });
    };
    if (selectedSector) {
      getAllowedStationsForSectorLabel(selectedSector).forEach((station) => add(station, selectedSector));
    }
    rawRows.forEach((row) => {
      const rowSector = getRenewalInfoRowSector(row);
      if (selectedSector && rowSector !== selectedSector) return;
      add(getRenewalInfoRowStation(row), rowSector || selectedSector);
    });
    return Array.from(map.values()).sort((left, right) => left.label.localeCompare(right.label, 'ar'));
  }

  function populateRenewalInfoSectorFilter() {
    if (!renewalInfoSectorFilter) return;
    const previous = getRenewalInfoSectorValue();
    const options = collectRenewalInfoSectorOptions();
    renewalInfoSectorFilter.innerHTML = '<option value="">كل القطاعات</option>' + options.map((option) => (
      `<option value="${escapeHTML(option.value)}">${escapeHTML(option.label)}</option>`
    )).join('');
    renewalInfoSectorFilter.value = options.some((option) => option.value === previous) ? previous : '';
  }

  function populateRenewalInfoStationFilter() {
    if (!renewalInfoStationFilter) return;
    const previous = getRenewalInfoStationKey();
    const options = collectRenewalInfoStationOptions(getRenewalInfoSectorValue());
    renewalInfoStationFilter.innerHTML = '<option value="">كل الأقسام</option>' + options.map((option) => (
      `<option value="${escapeHTML(option.key)}">${escapeHTML(option.label)}</option>`
    )).join('');
    renewalInfoStationFilter.value = options.some((option) => option.key === previous) ? previous : '';
    renewalInfoStationFilter.disabled = options.length === 0;
  }

  function syncRenewalInfoFilters() {
    populateRenewalInfoSectorFilter();
    populateRenewalInfoStationFilter();
  }

  function getRenewalInfoFilteredRows() {
    const sectorFilter = getRenewalInfoSectorValue();
    const stationKey = getRenewalInfoStationKey();
    return rawRows.filter((row) => {
      const rowSector = getRenewalInfoRowSector(row);
      if (sectorFilter && rowSector !== sectorFilter) return false;
      if (stationKey && getRenewalInfoStationKeyForRow(row, rowSector || sectorFilter) !== stationKey) return false;
      return true;
    });
  }

  function buildRenewalInfoSummaries(rows) {
    const sectorFilter = getRenewalInfoSectorValue();
    const stationFilter = getRenewalInfoStationKey();
    const summaries = new Map();
    const ensureSummary = (key, stationLabel) => {
      if (!summaries.has(key)) {
        summaries.set(key, {
          station: stationLabel || 'بدون قسم',
          hasReason: 0,
          emptyReason: 0
        });
      }
      return summaries.get(key);
    };
    if (sectorFilter || stationFilter) {
      collectRenewalInfoStationOptions(sectorFilter).forEach((option) => {
        if (!stationFilter || option.key === stationFilter) ensureSummary(option.key, option.label);
      });
    }
    rows.forEach((row) => {
      const sectorLabel = getRenewalInfoRowSector(row);
      const stationName = getRenewalInfoRowStation(row);
      const key = getRenewalInfoStationKeyForRow(row, sectorLabel || sectorFilter) || '__empty_station__';
      const summary = ensureSummary(key, stationName || 'بدون قسم');
      if (getRenewalInfoReasonValue(row)) {
        summary.hasReason += 1;
      } else {
        summary.emptyReason += 1;
      }
    });
    return Array.from(summaries.values())
      .sort((left, right) => left.station.localeCompare(right.station, 'ar'));
  }

  function renderRenewalInfoEmpty(message) {
    if (renewalInfoTableBody) {
      renewalInfoTableBody.innerHTML = `<tr><td colspan="3" class="renewal-info-empty">${escapeHTML(message)}</td></tr>`;
    }
    if (renewalInfoMeta) renewalInfoMeta.innerHTML = '';
  }

  function renderRenewalInfoFrame() {
    const rows = getRenewalInfoFilteredRows();
    const summaries = buildRenewalInfoSummaries(rows);
    const totals = summaries.reduce((acc, summary) => {
      acc.hasReason += summary.hasReason;
      acc.emptyReason += summary.emptyReason;
      return acc;
    }, { hasReason: 0, emptyReason: 0 });

    if (renewalInfoSubtitle) {
      const sectorLabel = renewalInfoSectorFilter?.selectedOptions?.[0]?.textContent?.trim() || '';
      const stationLabel = renewalInfoStationFilter?.selectedOptions?.[0]?.textContent?.trim() || '';
      const parts = [];
      if (getRenewalInfoSectorValue() && sectorLabel) parts.push(sectorLabel);
      if (getRenewalInfoStationKey() && stationLabel) parts.push(stationLabel);
      renewalInfoSubtitle.textContent = parts.length
        ? `ملخص أسباب عدم ورود الملف - ${parts.join(' - ')}`
        : 'ملخص أسباب عدم ورود الملف';
    }

    if (renewalInfoMeta) {
      const chips = [
        ['عدد الأقسام', summaries.length],
        ['اسباب عدم ورود الملف', totals.hasReason],
        ['فارغ', totals.emptyReason]
      ];
      renewalInfoMeta.innerHTML = chips.map(([label, value]) => (
        `<span class="renewal-info-chip">${escapeHTML(label)}: ${formatRenewalInfoNumber(value)}</span>`
      )).join('');
    }

    if (!rawRows.length) {
      renderRenewalInfoEmpty('لا توجد بيانات محملة للعرض');
      return;
    }
    if (!summaries.length) {
      renderRenewalInfoEmpty('لا توجد أقسام مطابقة للعرض');
      return;
    }

    const rowsHtml = summaries.map((summary) => `
      <tr>
        <td>${escapeHTML(summary.station)}</td>
        <td>${formatRenewalInfoNumber(summary.hasReason)}</td>
        <td>${formatRenewalInfoNumber(summary.emptyReason)}</td>
      </tr>
    `).join('');
    const totalRowHtml = `
      <tr class="renewal-info-total-row">
        <td>الإجمالي العام</td>
        <td>${formatRenewalInfoNumber(totals.hasReason)}</td>
        <td>${formatRenewalInfoNumber(totals.emptyReason)}</td>
      </tr>
    `;
    if (renewalInfoTableBody) renewalInfoTableBody.innerHTML = rowsHtml + totalRowHtml;
  }

  function openRenewalInfoFrame() {
    if (!renewalInfoFrame || !canUseRenewalInfoFrame()) return;
    syncRenewalInfoFilters();
    renderRenewalInfoFrame();
    renewalInfoFrame.classList.add('is-visible');
    renewalInfoFrame.setAttribute('aria-hidden', 'false');
  }

  applyRenewalInfoAccess();
  if (renewalInfoBtn) renewalInfoBtn.addEventListener('click', openRenewalInfoFrame);
  if (renewalInfoCloseBtn) renewalInfoCloseBtn.addEventListener('click', closeRenewalInfoFrame);
  if (renewalInfoSectorFilter) {
    renewalInfoSectorFilter.addEventListener('change', () => {
      populateRenewalInfoStationFilter();
      renderRenewalInfoFrame();
    });
  }
  if (renewalInfoStationFilter) renewalInfoStationFilter.addEventListener('change', renderRenewalInfoFrame);
  if (renewalInfoFrame) {
    renewalInfoFrame.addEventListener('mousedown', (event) => {
      if (event.target === renewalInfoFrame) closeRenewalInfoFrame();
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && renewalInfoFrame?.classList.contains('is-visible')) {
      closeRenewalInfoFrame();
    }
  });

  function buildRowSelectionId(rowIndex) {
    return Number.isInteger(rowIndex) && rowIndex >= 0 ? String(rowIndex) : '-1';
  }

  function extractRowIndexFromSelectionId(value) {
    const rawValue = String(value ?? '').trim();
    if (!rawValue) return -1;
    const [indexToken] = rawValue.split('|');
    const parsed = Number.parseInt(indexToken, 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : -1;
  }

  function buildUndoRecordPayload(row) {
    const record = {};
    RENEWAL_UNDO_HEADERS.forEach((header) => {
      record[header] = readRowField(row, header);
    });
    return record;
  }

  function formatDeletedAt(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    try {
      const localized = date.toLocaleString('ar-EG', { hour12: false });
      return toArabicNumerals(localized);
    } catch (_) {
      return toArabicNumerals(date.toISOString().replace('T', ' ').slice(0, 16));
    }
  }

  function updateUndoButton() {
    if (!undoBtn) return;
    const count = Array.isArray(undoState.records) ? undoState.records.length : 0;
    const baseLabel = 'استرجاع ⮌';
    undoBtn.textContent = count ? `${baseLabel} (${toArabicNumerals(count)})` : baseLabel;
  }

  function mergeRenewalHeaders(headers) {
    const merged = Array.isArray(headers) ? headers.slice() : [];
    const seen = new Set(merged.map((header) => normalizeHeaderKeyForClient(header)));
    RENEWAL_REQUIRED_HEADERS.forEach((header) => {
      const signature = normalizeHeaderKeyForClient(header);
      if (seen.has(signature)) return;
      merged.push(header);
      seen.add(signature);
    });
    return merged.length ? merged : RENEWAL_REQUIRED_HEADERS.slice();
  }

  function ensureRenewalRowShape(row) {
    const normalized = normalizeKeys(row);
    if (normalized['الاسم'] && !normalized['الاســـــــم']) {
      normalized['الاســـــــم'] = normalized['الاسم'];
    }
    if (normalized['ملاحظات'] && !normalized['ملاحظـــات']) {
      normalized['ملاحظـــات'] = normalized['ملاحظات'];
    }
    if (normalized['صورة'] == null) {
      normalized['صورة'] = '';
    }
    if (normalized['إجراءات'] && !normalized['اجراءات']) {
      normalized['اجراءات'] = normalized['إجراءات'];
    }
    if (normalized['اجراءات'] == null) {
      normalized['اجراءات'] = '';
    }
    return normalized;
  }

  function normalizeAttachmentList(value) {
    if (Array.isArray(value)) {
      return value
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
    }

    const raw = String(value || '').trim();
    if (!raw) return [];

    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed
            .map((entry) => String(entry || '').trim())
            .filter(Boolean);
        }
      } catch (_) {
        // Fall back to the pipe-separated storage format.
      }
    }

    return raw
      .split('|')
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }

  function serializeAttachmentList(files) {
    return Array.from(new Set(normalizeAttachmentList(files))).join('|');
  }

  function getAttachmentFilesForRow(row) {
    return normalizeAttachmentList(readRowField(row, 'صورة'));
  }

  function setAttachmentFilesForRow(rowOrIndex, files) {
    const row = typeof rowOrIndex === 'number' ? rawRows[rowOrIndex] : rowOrIndex;
    if (!row || typeof row !== 'object') return '';
    const serialized = serializeAttachmentList(files);
    row['صورة'] = serialized;
    return serialized;
  }

  function getAttachmentFileUrl(filename) {
    return `${PHOTO_ENDPOINTS.fileBase}/${encodeURIComponent(String(filename || ''))}`;
  }

  function getAttachmentFileExtension(filename) {
    const match = String(filename || '').toLowerCase().match(/\.([^.]+)$/);
    return match ? match[1] : '';
  }

  function isImageAttachment(filename) {
    return /^(png|jpe?g|gif|webp|bmp|tif|tiff|heic)$/i.test(getAttachmentFileExtension(filename));
  }

  function isPdfAttachment(filename) {
    return getAttachmentFileExtension(filename) === 'pdf';
  }

  function getAttachmentOpenIcon(filename) {
    if (isPdfAttachment(filename)) return '📄';
    if (isImageAttachment(filename)) return '🖼';
    return '📎';
  }

  function makeAbsoluteAttachmentUrl(url) {
    try {
      return new URL(String(url || ''), window.location.href).href;
    } catch (_) {
      return String(url || '');
    }
  }

  function buildAttachmentButtonHtml(files, rowIndex) {
    if (files.length) {
      return `
        <button type="button" class="attachment-trigger attachment-trigger--view" data-mode="view" data-row-index="${escapeHTML(String(rowIndex))}" title="عرض الملفات">
          <span class="attachment-trigger-icon">🔍</span>
          <span class="attachment-trigger-count">${toArabicNumerals(files.length)}</span>
        </button>
      `;
    }

    return `
      <button type="button" class="attachment-trigger attachment-trigger--add" data-mode="add" data-row-index="${escapeHTML(String(rowIndex))}" title="إضافة ملفات">
        <span class="attachment-trigger-icon">+</span>
      </button>
    `;
  }

  // Get canonical license type
  function getNormalizedLicenseType(type) {
    if (!type) return '';
    const trimmed = type.trim();
    if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.resolveLicenseType === 'function') {
      return SHARED_REFERENCE_DATA.resolveLicenseType(trimmed, 'renewal') || trimmed;
    }
    return licenseTypeMapping[trimmed] || trimmed;
  }

  function getConfiguredLicenseTypes() {
    const sharedTypes = SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getLicenseTypes === 'function'
      ? SHARED_REFERENCE_DATA.getLicenseTypes('renewal')
      : [];
    const configuredTypes = Array.isArray(sharedTypes) && sharedTypes.length
      ? sharedTypes.map((type) => getNormalizedLicenseType(type))
      : Object.values(licenseTypeMapping);
    return Array.from(new Set(configuredTypes.filter(Boolean))).sort((a,b)=>a.localeCompare(b,'ar'));
  }

  // Get all available license types (from data + configured settings)
  function getAllLicenseTypes({ includeData = true } = {}) {
    const configuredTypes = getConfiguredLicenseTypes();
    if (!includeData) {
      return configuredTypes;
    }

    const dataTypes = new Set();
    rawRows.forEach(r=>{ 
      if(r['نوع الرخصة']) {
        const normalizedType = getNormalizedLicenseType(r['نوع الرخصة']);
        dataTypes.add(normalizedType);
      }
    });

    // Combine configured settings with existing data values for filtering.
    const allTypes = new Set([...dataTypes, ...configuredTypes]);
    return Array.from(allTypes).sort((a,b)=>a.localeCompare(b,'ar'));
  }

  function updateUndoState(records) {
    undoState.records = Array.isArray(records) ? records : [];
    undoState.selected.clear();
    updateUndoButton();
    if (undoState.overlay) {
      renderUndoPanel();
    }
  }

  function ensureUndoOverlay() {
    if (undoState.overlay && document.body.contains(undoState.overlay)) {
      return undoState.overlay;
    }

    const overlay = document.createElement('div');
    overlay.className = 'undo-overlay';
    overlay.id = 'undoOverlay';
    overlay.innerHTML = `
      <div class="undo-modal" role="dialog" aria-modal="true" aria-labelledby="undoPanelTitle" tabindex="-1">
        <div class="undo-header">
          <h3 id="undoPanelTitle">سجلات محذوفة</h3>
          <button type="button" class="undo-close-btn" data-action="close" title="اغلاق">&times;</button>
        </div>
        <div class="undo-body">
          <div class="undo-toolbar">
            <label><input type="checkbox" id="undoSelectAll"> تحديد الكل</label>
            <button type="button" class="undo-refresh-btn" data-action="refresh">تحديث 🔄</button>
          </div>
          <div class="undo-empty" hidden>لا توجد سجلات محذوفة.</div>
          <div class="undo-table-wrapper" hidden>
            <table class="undo-table">
              <thead>
                <tr>
                  <th style="width:42px;"></th>
                  <th>الاسم</th>
                  <th>رقم الرخصة</th>
                  <th>القطاع</th>
                  <th>القسم</th>
                  <th>ملاحظات</th>
                  <th>وقت الحذف</th>
                </tr>
              </thead>
              <tbody class="undo-table-body"></tbody>
            </table>
          </div>
        </div>
        <div class="undo-footer">
          <button type="button" class="undo-restore-btn" data-action="restore" disabled>استرجاع المحدد</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    undoState.overlay = overlay;
  undoState.tableBody = overlay.querySelector('.undo-table-body');
    undoState.emptyState = overlay.querySelector('.undo-empty');
    undoState.restoreButton = overlay.querySelector('.undo-restore-btn');
    undoState.selectAllInput = overlay.querySelector('#undoSelectAll');

    overlay.addEventListener('click', (event) => {
      const target = event.target;
      if (target === overlay) {
        toggleUndoOverlay(false);
        return;
      }
      const action = target && target.dataset ? target.dataset.action : null;
      if (action === 'close') {
        toggleUndoOverlay(false);
      } else if (action === 'refresh') {
        refreshUndoRecords({ silent: true }).then(() => renderUndoPanel()).catch(() => {});
      } else if (action === 'restore') {
        restoreSelectedUndoRecords();
      }
    });

    overlay.addEventListener('change', (event) => {
      const { target } = event;
      if (!target) return;
      if (target.id === 'undoSelectAll') {
        handleUndoSelectAll(Boolean(target.checked));
      } else if (target.classList.contains('undo-row-checkbox')) {
        const recordId = Number(target.value);
        if (Number.isFinite(recordId)) {
          if (target.checked) {
            undoState.selected.add(recordId);
          } else {
            undoState.selected.delete(recordId);
          }
          updateUndoSelectionIndicators();
        }
      }
    });

    if (!undoKeydownListenerAttached) {
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && undoState.overlay && undoState.overlay.classList.contains('open')) {
          event.preventDefault();
          toggleUndoOverlay(false);
        }
      });
      undoKeydownListenerAttached = true;
    }

    overlay.dataset.loading = 'false';
    updateUndoSelectionIndicators();
    return overlay;
  }

  function renderUndoPanel() {
    const overlay = ensureUndoOverlay();
    const empty = undoState.emptyState;
    const tableBody = undoState.tableBody;
    const tableWrapper = overlay.querySelector('.undo-table-wrapper');
    if (!overlay || !empty || !tableBody || !tableWrapper) return;

    const records = Array.isArray(undoState.records) ? undoState.records : [];
    if (!records.length) {
      empty.hidden = false;
      tableWrapper.hidden = true;
      tableBody.innerHTML = '';
      updateUndoSelectionIndicators();
      return;
    }

    empty.hidden = true;
    tableWrapper.hidden = false;
    const rowsHtml = records.map((record) => {
      const id = Number(record?.id) || 0;
      const checked = undoState.selected.has(id) ? 'checked' : '';
      const recordData = record?.record || {};
      const nameValue = record?.name || readRowField(recordData, 'الاســـــــم') || readRowField(recordData, 'الاسم') || 'بدون اسم';
      const licenseValue = record?.licenseNumber || readRowField(recordData, 'رقم الرخصة') || '';
      const sectorValue = record?.sector || readRowField(recordData, 'قطاع') || '';
      const stationValue = record?.station || readRowField(recordData, 'القسم') || '';
      const notesValue = readRowField(recordData, 'ملاحظـــات');
      const deletedAt = formatDeletedAt(record?.deletedAt || '');
      return `<tr>
        <td class="undo-cell-select"><input type="checkbox" class="undo-row-checkbox" value="${escapeHTML(String(id))}" ${checked}></td>
        <td class="undo-cell-name">${escapeHTML(nameValue || 'بدون اسم')}</td>
        <td>${escapeHTML(toArabicNumerals(licenseValue || '-'))}</td>
        <td>${escapeHTML(sectorValue || '-')}</td>
        <td>${escapeHTML(stationValue || '-')}</td>
        <td>${notesValue ? escapeHTML(notesValue) : '-'}</td>
        <td>${deletedAt ? escapeHTML(deletedAt) : '-'}</td>
      </tr>`;
    }).join('');

    tableBody.innerHTML = rowsHtml;
    updateUndoSelectionIndicators();
  }

  function updateUndoSelectionIndicators() {
    const total = Array.isArray(undoState.records) ? undoState.records.length : 0;
    const selectedCount = undoState.selected.size;
    if (undoState.restoreButton) {
      undoState.restoreButton.disabled = selectedCount === 0;
      undoState.restoreButton.textContent = selectedCount
        ? `استرجاع (${toArabicNumerals(selectedCount)})`
        : 'استرجاع المحدد';
    }
    if (undoState.selectAllInput) {
      undoState.selectAllInput.checked = total > 0 && selectedCount === total;
      undoState.selectAllInput.indeterminate = selectedCount > 0 && selectedCount < total;
    }
  }

  function handleUndoSelectAll(checked) {
    undoState.selected.clear();
    if (checked) {
      undoState.records.forEach((record) => {
        const id = Number(record?.id);
        if (Number.isFinite(id)) {
          undoState.selected.add(id);
        }
      });
    }
    renderUndoPanel();
  }

  function toggleUndoOverlay(open) {
    const overlay = ensureUndoOverlay();
    if (!overlay) return;
    if (open) {
      overlay.dataset.loading = overlay.dataset.loading || 'false';
      overlay.classList.add('open');
      setTimeout(() => {
        try {
          const modal = overlay.querySelector('.undo-modal');
          if (modal) {
            modal.focus({ preventScroll: true });
          }
        } catch (_) {}
      }, 30);
    } else {
      overlay.classList.remove('open');
      overlay.dataset.loading = 'false';
      undoState.selected.clear();
      updateUndoSelectionIndicators();
      if (undoState.tableBody) {
        undoState.tableBody.querySelectorAll('.undo-row-checkbox').forEach((checkbox) => {
          checkbox.checked = false;
        });
      }
    }
  }

  async function refreshUndoRecords(options = {}) {
    const { silent = false } = options || {};
    try {
      const response = await fetch(UNDO_ENDPOINTS.list, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      const records = Array.isArray(result?.undoRecords) ? result.undoRecords : [];
      updateUndoState(records);
    } catch (error) {
      console.error('Failed to load undo records:', error);
      if (!silent) {
        alert('تعذر تحميل سجلات الاسترجاع. حاول مرة أخرى.');
      }
      throw error;
    }
  }

  async function openUndoPanel() {
    const overlay = ensureUndoOverlay();
    if (overlay) {
      overlay.dataset.loading = 'true';
    }
    try {
      await refreshUndoRecords({ silent: true });
      renderUndoPanel();
      toggleUndoOverlay(true);
    } catch (error) {
      console.error('Failed to open undo panel:', error);
      alert('تعذر تحميل سجلات الاسترجاع. حاول مرة أخرى.');
    } finally {
      if (overlay) {
        overlay.dataset.loading = 'false';
      }
    }
  }

  async function restoreSelectedUndoRecords() {
    if (!undoState.selected.size) {
      alert('اختر السجلات التي ترغب في استرجاعها.');
      return;
    }

    const overlay = ensureUndoOverlay();
    if (overlay) {
      overlay.dataset.loading = 'true';
    }

    const ids = Array.from(undoState.selected);
    try {
      const response = await fetch(UNDO_ENDPOINTS.restore, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });

      if (response.status === 409) {
        let conflict = null;
        try { conflict = await response.json(); } catch (_) {}
        const message = conflict?.message || 'يوجد سجل محفوظ بنفس الاسم. لم يتم الاسترجاع.';
        alert(message);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (Array.isArray(result?.undoRecords)) {
        updateUndoState(result.undoRecords);
      } else {
        await refreshUndoRecords({ silent: true }).catch(() => {});
      }
      undoState.selected.clear();
      toggleUndoOverlay(false);
      await fetchAndRender({ forceReload: true, skipIfEditing: false, preserveScroll: false });
      const restoredCount = Number(result?.restoredCount) || ids.length;
      const originalText = countEl.textContent;
      countEl.textContent = `تم استرجاع ${toArabicNumerals(restoredCount)} سجل بنجاح`;
      countEl.style.color = '#198754';
      setTimeout(() => {
        countEl.style.color = '';
        countEl.textContent = originalText;
      }, 2500);
    } catch (error) {
      console.error('Failed to restore undo records:', error);
      alert('تعذر استرجاع السجلات المحذوفة. حاول مرة أخرى.');
    } finally {
      if (overlay) {
        overlay.dataset.loading = 'false';
      }
      updateUndoButton();
    }
  }

  updateUndoButton();

  function buildAttachmentRecord(row) {
    return {
      licenseNumber: toEnglishNumerals(readRowField(row, 'رقم الرخصة')),
      stationName: readRowField(row, 'القسم'),
      personName: readRowField(row, 'الاســـــــم') || readRowField(row, 'الاسم')
    };
  }

  function ensureAttachmentReady(row) {
    const record = buildAttachmentRecord(row);
    if (!record.licenseNumber || !record.stationName || !record.personName) {
      alert('يلزم وجود رقم الرخصة والقسم والاسم قبل رفع المستندات.');
      return null;
    }
    return record;
  }

  function ensureAttachmentFileInput() {
    if (attachmentState.fileInput && document.body.contains(attachmentState.fileInput)) {
      return attachmentState.fileInput;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tif,.tiff,.heic,.txt,.doc,.docx,.xls,.xlsx';
    input.className = 'hidden';
    input.addEventListener('change', async () => {
      const rowIndex = attachmentState.pendingUploadRowIndex;
      const files = Array.from(input.files || []);
      input.value = '';
      attachmentState.pendingUploadRowIndex = -1;
      if (rowIndex < 0 || !files.length) return;
      await uploadAttachmentsForRow(rowIndex, files);
    });
    document.body.appendChild(input);
    attachmentState.fileInput = input;
    return input;
  }

  function getSelectedAttachmentFilename() {
    if (attachmentState.selected.size !== 1) return '';
    return String(attachmentState.selected.values().next().value || '').trim();
  }

  function getOldAttachmentFileUrl(filename) {
    return `${PHOTO_ENDPOINTS.oldFileBase}/${encodeURIComponent(String(filename || ''))}`;
  }

  function applyOldAttachmentButtonState() {
    const filename = getSelectedAttachmentFilename();
    const isLoading = attachmentState.overlay?.dataset.loading === 'true';
    const oldAvailable = Boolean(filename && attachmentState.oldAvailabilityCache.get(filename) === true);
    const canRestore = canEditRenewalDocumentsForPortal();

    if (attachmentState.oldViewButton) {
      attachmentState.oldViewButton.disabled = isLoading || !oldAvailable;
    }
    if (attachmentState.oldRestoreButton) {
      attachmentState.oldRestoreButton.hidden = !canRestore;
      attachmentState.oldRestoreButton.setAttribute('aria-hidden', canRestore ? 'false' : 'true');
      attachmentState.oldRestoreButton.disabled = !canRestore || isLoading || !oldAvailable;
    }
  }

  async function refreshSelectedOldAttachmentAvailability() {
    const filename = getSelectedAttachmentFilename();
    const requestId = ++attachmentState.oldAvailabilityRequestId;
    applyOldAttachmentButtonState();
    if (!filename) return false;

    const cached = attachmentState.oldAvailabilityCache.get(filename);
    if (typeof cached === 'boolean') {
      applyOldAttachmentButtonState();
      return cached;
    }

    let availabilityPromise = cached;
    if (!availabilityPromise || typeof availabilityPromise.then !== 'function') {
      availabilityPromise = fetch(makeAbsoluteAttachmentUrl(getOldAttachmentFileUrl(filename)), {
        method: 'HEAD',
        cache: 'no-store'
      }).then((response) => Boolean(response && response.ok)).catch(() => false);
      attachmentState.oldAvailabilityCache.set(filename, availabilityPromise);
    }

    const available = await availabilityPromise;
    if (attachmentState.oldAvailabilityCache.get(filename) === availabilityPromise) {
      attachmentState.oldAvailabilityCache.set(filename, available);
    }
    if (
      requestId !== attachmentState.oldAvailabilityRequestId
      || filename !== getSelectedAttachmentFilename()
    ) return available;
    applyOldAttachmentButtonState();
    return available;
  }

  function showAttachmentActionStatus(message, color = '#198754') {
    const previousText = countEl.textContent;
    countEl.textContent = message;
    countEl.style.color = color;
    setTimeout(() => {
      countEl.style.color = '';
      countEl.textContent = previousText;
    }, 3000);
  }

  async function viewSelectedOldAttachment() {
    const filename = getSelectedAttachmentFilename();
    if (!filename) {
      alert('اختر مستنداً واحداً لعرض نسخته القديمة.');
      return;
    }
    setAttachmentOverlayLoading(true);
    try {
      await openAttachmentFilesInViewer([filename], {
        getFileUrl: getOldAttachmentFileUrl,
        emptyMessage: 'لا توجد نسخة قديمة لعرضها.',
        unavailableMessage: 'تعذر العثور على نسخة قديمة قابلة للعرض.',
        failureMessage: 'تعذر عرض النسخة القديمة للمستند.'
      });
    } finally {
      setAttachmentOverlayLoading(false);
    }
  }

  async function restoreSelectedOldAttachment() {
    if (!canEditRenewalDocumentsForPortal()) return;
    const filename = getSelectedAttachmentFilename();
    if (!filename) {
      alert('اختر مستنداً واحداً لاسترجاع نسخته القديمة.');
      return;
    }
    if (!confirm('هل أنت متأكد من استرجاع النسخة القديمة لهذا المستند؟')) return;

    setAttachmentOverlayLoading(true);
    try {
      const response = await fetch(PHOTO_ENDPOINTS.restore, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      let result = null;
      try { result = await response.json(); } catch (_) {}
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.message || 'تعذر استرجاع النسخة القديمة للمستند.');
      }

      attachmentState.oldAvailabilityRequestId += 1;
      attachmentState.oldAvailabilityCache.delete(filename);
      if (attachmentState.overlay?.classList.contains('open')) {
        renderAttachmentPanel();
      }
      showAttachmentActionStatus('تم استرجاع المستند القديم.');
    } catch (error) {
      alert(error.message || 'تعذر استرجاع النسخة القديمة للمستند.');
    } finally {
      setAttachmentOverlayLoading(false);
    }
  }

  function setAttachmentOverlayLoading(isLoading) {
    if (!attachmentState.overlay) return;
    attachmentState.overlay.dataset.loading = isLoading ? 'true' : 'false';
    if (attachmentState.addButton) attachmentState.addButton.disabled = isLoading;
    if (attachmentState.editButton) {
      const allowed = canEditRenewalDocumentsForPortal();
      const selectedFilename = attachmentState.selected.size === 1
        ? attachmentState.selected.values().next().value
        : '';
      attachmentState.editButton.hidden = !allowed;
      attachmentState.editButton.setAttribute('aria-hidden', allowed ? 'false' : 'true');
      attachmentState.editButton.disabled = !allowed || isLoading || !isEditableScannerAttachment(selectedFilename);
    }
    if (attachmentState.viewButton && isLoading) attachmentState.viewButton.disabled = true;
    applyOldAttachmentButtonState();
    if (attachmentState.deleteButton) attachmentState.deleteButton.disabled = isLoading || attachmentState.selected.size === 0;
    if (attachmentState.selectAllInput) attachmentState.selectAllInput.disabled = isLoading;
    if (!isLoading) {
      updateAttachmentSelectionIndicators();
    }
  }

  function updateAttachmentSelectionIndicators() {
    const row = rawRows[attachmentState.activeRowIndex];
    const files = row ? getAttachmentFilesForRow(row) : [];
    const total = files.length;
    const selectedCount = attachmentState.selected.size;

    if (attachmentState.deleteButton) {
      attachmentState.deleteButton.disabled = selectedCount === 0;
      attachmentState.deleteButton.textContent = selectedCount
        ? `حذف المحدد (${toArabicNumerals(selectedCount)})`
        : 'حذف المحدد';
    }

    if (attachmentState.editButton) {
      const allowed = canEditRenewalDocumentsForPortal();
      const selectedFilename = selectedCount === 1 ? attachmentState.selected.values().next().value : '';
      attachmentState.editButton.hidden = !allowed;
      attachmentState.editButton.setAttribute('aria-hidden', allowed ? 'false' : 'true');
      attachmentState.editButton.disabled = !allowed || !isEditableScannerAttachment(selectedFilename);
    }

    if (attachmentState.viewButton) {
      attachmentState.viewButton.disabled = total === 0;
    }

    if (attachmentState.selectAllInput) {
      attachmentState.selectAllInput.checked = total > 0 && selectedCount === total;
      attachmentState.selectAllInput.indeterminate = selectedCount > 0 && selectedCount < total;
      attachmentState.selectAllInput.disabled = total === 0;
    }
    applyOldAttachmentButtonState();
    void refreshSelectedOldAttachmentAvailability();
  }

  function handleAttachmentSelectAll(checked) {
    const checkboxes = attachmentState.grid
      ? Array.from(attachmentState.grid.querySelectorAll('.attachment-file-checkbox'))
      : [];
    attachmentState.selected.clear();
    checkboxes.forEach((checkbox) => {
      checkbox.checked = checked;
      const card = checkbox.closest('.attachment-card');
      if (card) card.classList.toggle('selected', checked);
      if (checked) {
        attachmentState.selected.add(checkbox.value);
      }
    });
    updateAttachmentSelectionIndicators();
  }

  function ensureAttachmentOverlay() {
    if (attachmentState.overlay && document.body.contains(attachmentState.overlay)) {
      return attachmentState.overlay;
    }

    const overlay = document.createElement('div');
    overlay.className = 'attachment-overlay';
    overlay.id = 'attachmentOverlay';
    overlay.dataset.loading = 'false';
    overlay.innerHTML = `
      <div class="attachment-modal" role="dialog" aria-modal="true" aria-labelledby="attachmentTitle" tabindex="-1">
        <div class="attachment-modal-header">
          <div class="attachment-modal-heading">
            <h3 id="attachmentTitle">عرض المستندات</h3>
            <div class="attachment-modal-subtitle"></div>
          </div>
          <button type="button" class="attachment-close-btn" data-action="close" title="اغلاق">&times;</button>
        </div>
        <div class="attachment-modal-toolbar">
          <label><input type="checkbox" id="attachmentSelectAll"> تحديد الكل</label>
          <div class="attachment-modal-actions">
            <button type="button" class="attachment-add-btn" data-action="add">إضافة ملفات</button>
            <button type="button" class="attachment-edit-btn" data-action="edit" disabled>تعديل</button>
            <button type="button" class="attachment-view-btn" data-action="view-all">عرض</button>
            <button type="button" class="attachment-old-view-btn" data-action="view-old" disabled>عرض القديم</button>
            <button type="button" class="attachment-old-restore-btn" data-action="restore-old" disabled>استرجاع القديم</button>
            <button type="button" class="attachment-delete-btn" data-action="delete" disabled>حذف المحدد</button>
          </div>
        </div>
        <div class="attachment-empty" hidden>لا توجد ملفات مرفوعة لهذا السجل.</div>
        <div class="attachment-grid" hidden></div>
      </div>
    `;
    document.body.appendChild(overlay);

    attachmentState.overlay = overlay;
    attachmentState.grid = overlay.querySelector('.attachment-grid');
    attachmentState.emptyState = overlay.querySelector('.attachment-empty');
    attachmentState.title = overlay.querySelector('#attachmentTitle');
    attachmentState.subtitle = overlay.querySelector('.attachment-modal-subtitle');
    attachmentState.deleteButton = overlay.querySelector('.attachment-delete-btn');
    attachmentState.addButton = overlay.querySelector('.attachment-add-btn');
    attachmentState.editButton = overlay.querySelector('.attachment-edit-btn');
    attachmentState.viewButton = overlay.querySelector('.attachment-view-btn');
    attachmentState.oldViewButton = overlay.querySelector('.attachment-old-view-btn');
    attachmentState.oldRestoreButton = overlay.querySelector('.attachment-old-restore-btn');
    attachmentState.selectAllInput = overlay.querySelector('#attachmentSelectAll');
    applyAttachmentEditorAccess();

    overlay.addEventListener('click', (event) => {
      const target = event.target;
      if (target === overlay) {
        toggleAttachmentOverlay(false);
        return;
      }

      const action = target && target.dataset ? target.dataset.action : null;
      if (action === 'close') {
        toggleAttachmentOverlay(false);
      } else if (action === 'add') {
        openAttachmentFilePicker(attachmentState.activeRowIndex);
      } else if (action === 'edit') {
        if (canEditRenewalDocumentsForPortal()) openAttachmentScannerEditor();
      } else if (action === 'view-all') {
        viewAllAttachmentsForActiveRow();
      } else if (action === 'view-old') {
        viewSelectedOldAttachment();
      } else if (action === 'restore-old') {
        restoreSelectedOldAttachment();
      } else if (action === 'delete') {
        deleteSelectedAttachments();
      }
      if (action === 'open-file') {
        openSingleAttachment(target.dataset.filename || '');
      }
      if (action) return;

      if (overlay.dataset.loading === 'true') return;
      const card = target && typeof target.closest === 'function' ? target.closest('.attachment-card') : null;
      if (!card || target.closest('.attachment-card-select') || target.closest('button')) return;
      const checkbox = card.querySelector('.attachment-file-checkbox');
      if (!checkbox || checkbox.disabled) return;
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    });

    overlay.addEventListener('change', (event) => {
      const { target } = event;
      if (!target) return;
      if (target.id === 'attachmentSelectAll') {
        handleAttachmentSelectAll(Boolean(target.checked));
        return;
      }
      if (!target.classList.contains('attachment-file-checkbox')) return;
      if (target.checked) {
        attachmentState.selected.add(target.value);
      } else {
        attachmentState.selected.delete(target.value);
      }
      const card = target.closest('.attachment-card');
      if (card) {
        card.classList.toggle('selected', target.checked);
      }
      updateAttachmentSelectionIndicators();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && attachmentState.overlay && attachmentState.overlay.classList.contains('open')) {
        toggleAttachmentOverlay(false);
      }
    });

    return overlay;
  }

  function applyAttachmentEditorAccess() {
    if (!attachmentState.editButton) return;
    const allowed = canEditRenewalDocumentsForPortal();
    attachmentState.editButton.hidden = !allowed;
    attachmentState.editButton.setAttribute('aria-hidden', allowed ? 'false' : 'true');
    if (!allowed) {
      attachmentState.editButton.disabled = true;
      applyOldAttachmentButtonState();
    } else {
      updateAttachmentSelectionIndicators();
    }
  }

  async function openSingleAttachment(filename) {
    const fileUrl = makeAbsoluteAttachmentUrl(getAttachmentFileUrl(filename));
    let viewer = null;
    try {
      viewer = window.open('', '_blank');
      if (viewer) {
        try {
          viewer.document.write('<!doctype html><title>Loading...</title><body dir="rtl" style="font-family:sans-serif;padding:24px">جاري تحميل الملف...</body>');
          viewer.document.close();
          viewer.focus();
        } catch (_) {}
      }
    } catch (_) {}

    try {
      const response = await fetch(fileUrl, { cache: 'no-store' });
      if (!response || !response.ok) {
        throw new Error('تعذر تحميل الملف. يرجى تسجيل الدخول مرة أخرى.');
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      if (viewer && !viewer.closed) {
        viewer.location.href = blobUrl;
      } else {
        const newWin = window.open(blobUrl, '_blank');
        if (!newWin) {
          alert('تعذر فتح نافذة العرض.');
          URL.revokeObjectURL(blobUrl);
          return;
        }
        try { newWin.focus(); } catch (_) {}
      }
      window.setTimeout(() => {
        try { URL.revokeObjectURL(blobUrl); } catch (_) {}
      }, 60000);
    } catch (error) {
      if (viewer && !viewer.closed) {
        try { viewer.close(); } catch (_) {}
      }
      alert(error.message || 'تعذر تحميل الملف.');
    }
  }

  function ensurePdfLibLoaded() {
    if (window.PDFLib && window.PDFLib.PDFDocument) {
      return Promise.resolve(window.PDFLib);
    }
    if (pdfLibLoadPromise) return pdfLibLoadPromise;

    pdfLibLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = typeof window.resolvePlatformAsset === 'function'
        ? window.resolvePlatformAsset('vendor/pdf-lib.min.js')
        : 'vendor/pdf-lib.min.js';
      script.async = true;
      script.onload = () => {
        if (window.PDFLib && window.PDFLib.PDFDocument) {
          resolve(window.PDFLib);
          return;
        }
        pdfLibLoadPromise = null;
        reject(new Error('PDF library loaded without PDFDocument'));
      };
      script.onerror = () => {
        pdfLibLoadPromise = null;
        reject(new Error('Failed to load PDF library'));
      };
      document.head.appendChild(script);
    });

    return pdfLibLoadPromise;
  }

  function ensurePdfJsLoaded() {
    if (pdfJsModulePromise) return pdfJsModulePromise;
    const loadAttempt = pdfJsModuleLoadAttempt;
    pdfJsModulePromise = (async () => {
      const candidates = [
        {
          moduleSrc: '/renewal/vendor/pdfjs/legacy/build/pdf.mjs',
          workerSrc: '/renewal/vendor/pdfjs/legacy/build/pdf.worker.mjs'
        },
        {
          moduleSrc: '/renewal/vendor/pdfjs/build/pdf.mjs',
          workerSrc: '/renewal/vendor/pdfjs/build/pdf.worker.mjs'
        }
      ];
      let lastError = null;
      for (const candidate of candidates) {
        try {
          // A failed dynamic import is cached by the browser for the lifetime
          // of the current page. Use a fresh URL after a failed attempt so an
          // editor tab can recover after the server has been restarted.
          const moduleSrc = loadAttempt > 0
            ? candidate.moduleSrc + '?retry=' + loadAttempt
            : candidate.moduleSrc;
          const module = await import(moduleSrc);
          const pdfjs = module.default || module;
          pdfjs.GlobalWorkerOptions.workerSrc = candidate.workerSrc;
          return pdfjs;
        } catch (error) {
          lastError = error;
        }
      }
      const loadError = new Error('تعذر تحميل محرك PDF. حدّث الصفحة ثم حاول مرة أخرى.');
      loadError.cause = lastError;
      throw loadError;
    })().catch((error) => {
      pdfJsModulePromise = null;
      pdfJsModuleLoadAttempt += 1;
      throw error;
    });
    return pdfJsModulePromise;
  }


  function isEditableScannerAttachment(filename) {
    return /^(png|jpe?g|webp|pdf)$/i.test(getAttachmentFileExtension(filename));
  }

  function getScannerOutputMime(filename) {
    const extension = getAttachmentFileExtension(filename);
    if (/^jpe?g$/i.test(extension)) return 'image/jpeg';
    if (/^webp$/i.test(extension)) return 'image/webp';
    return 'image/png';
  }

  function createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width || 1));
    canvas.height = Math.max(1, Math.round(height || 1));
    return canvas;
  }

  function createScannerCleanSourceCanvas() {
    const canvas = createCanvas(
      scannerState.sourceCanvas ? scannerState.sourceCanvas.width : 1,
      scannerState.sourceCanvas ? scannerState.sourceCanvas.height : 1
    );
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (scannerState.image) {
      // A single bilinear step from the full-resolution document folds dense
      // security screens into moire that then contaminates detection and the
      // preview processing input.
      drawScannerImageWithProgressiveReduction(ctx, scannerState.image, canvas.width, canvas.height);
    } else if (scannerState.sourceCanvas) {
      ctx.drawImage(scannerState.sourceCanvas, 0, 0);
    }
    return canvas;
  }

  function distanceBetweenPoints(a, b) {
    const dx = Number(a.x || 0) - Number(b.x || 0);
    const dy = Number(a.y || 0) - Number(b.y || 0);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function cloneScannerCorners(corners) {
    return (Array.isArray(corners) ? corners : []).map((point) => ({
      x: Number(point.x || 0),
      y: Number(point.y || 0)
    }));
  }

  function createDefaultScannerCorners(width, height) {
    return [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height }
    ];
  }
  function getScannerSaturation(r, g, b) {
    return Math.max(Number(r || 0), Number(g || 0), Number(b || 0)) - Math.min(Number(r || 0), Number(g || 0), Number(b || 0));
  }

  function getScannerPointPercentile(points, key, ratio) {
    if (!points.length) return 0;
    const values = points.map((point) => point[key]).sort((a, b) => a - b);
    const index = Math.max(0, Math.min(values.length - 1, Math.round((values.length - 1) * ratio)));
    return values[index];
  }

  function fitScannerYLine(points) {
    if (!points || points.length < 8) return null;
    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    let sumXY = 0;
    points.forEach((point) => {
      sumX += point.x;
      sumY += point.y;
      sumXX += point.x * point.x;
      sumXY += point.x * point.y;
    });
    const n = points.length;
    const denominator = n * sumXX - sumX * sumX;
    if (Math.abs(denominator) < 0.0001) return null;
    const m = (n * sumXY - sumX * sumY) / denominator;
    const b = (sumY - m * sumX) / n;
    return { m, b };
  }

  function fitScannerXLine(points) {
    if (!points || points.length < 8) return null;
    let sumY = 0;
    let sumX = 0;
    let sumYY = 0;
    let sumYX = 0;
    points.forEach((point) => {
      sumY += point.y;
      sumX += point.x;
      sumYY += point.y * point.y;
      sumYX += point.y * point.x;
    });
    const n = points.length;
    const denominator = n * sumYY - sumY * sumY;
    if (Math.abs(denominator) < 0.0001) return null;
    const m = (n * sumYX - sumY * sumX) / denominator;
    const b = (sumX - m * sumY) / n;
    return { m, b };
  }

  function intersectScannerFittedLines(yLine, xLine) {
    if (!yLine || !xLine) return null;
    const denominator = 1 - xLine.m * yLine.m;
    if (Math.abs(denominator) < 0.0001) return null;
    const x = (xLine.m * yLine.b + xLine.b) / denominator;
    return { x, y: yLine.m * x + yLine.b };
  }

  function clampScannerPoint(point, width, height) {
    return {
      x: Math.max(0, Math.min(width, Number(point.x || 0))),
      y: Math.max(0, Math.min(height, Number(point.y || 0)))
    };
  }

  function expandScannerCornersFromCenter(corners, marginX, marginY, width, height) {
    const center = corners.reduce((acc, point) => ({ x: acc.x + point.x / 4, y: acc.y + point.y / 4 }), { x: 0, y: 0 });
    return corners.map((point) => clampScannerPoint({
      x: point.x + (point.x < center.x ? -marginX : marginX),
      y: point.y + (point.y < center.y ? -marginY : marginY)
    }, width, height));
  }

  function getScannerPolygonArea(corners) {
    if (!Array.isArray(corners) || corners.length !== 4) return 0;
    let area = 0;
    for (let index = 0; index < corners.length; index += 1) {
      const current = corners[index];
      const next = corners[(index + 1) % corners.length];
      area += current.x * next.y - next.x * current.y;
    }
    return Math.abs(area) / 2;
  }

  function isScannerUsableQuad(corners, width, height, minAreaRatio = 0.01) {
    if (!Array.isArray(corners) || corners.length !== 4) return false;
    const minDimension = Math.max(1, Math.min(width, height));
    const minEdgeLength = Math.max(8, minDimension * 0.025);
    for (let index = 0; index < corners.length; index += 1) {
      if (distanceBetweenPoints(corners[index], corners[(index + 1) % corners.length]) < minEdgeLength) return false;
    }

    let crossSign = 0;
    for (let index = 0; index < corners.length; index += 1) {
      const previous = corners[index];
      const current = corners[(index + 1) % corners.length];
      const next = corners[(index + 2) % corners.length];
      const cross = (current.x - previous.x) * (next.y - current.y)
        - (current.y - previous.y) * (next.x - current.x);
      if (Math.abs(cross) < minDimension * minDimension * 0.00005) return false;
      const sign = Math.sign(cross);
      if (!crossSign) crossSign = sign;
      else if (sign !== crossSign) return false;
    }

    return getScannerPolygonArea(corners) >= Math.max(1, width * height) * minAreaRatio;
  }

  function validateScannerDetectedCorners(corners, width, height) {
    if (!Array.isArray(corners) || corners.length !== 4) return null;
    const cleanCorners = corners.map((point) => clampScannerPoint(point, width, height));
    if (!isScannerUsableQuad(cleanCorners, width, height)) return null;
    const areaRatio = getScannerPolygonArea(cleanCorners) / Math.max(1, width * height);
    const avgWidth = (distanceBetweenPoints(cleanCorners[0], cleanCorners[1]) + distanceBetweenPoints(cleanCorners[3], cleanCorners[2])) / 2;
    const avgHeight = (distanceBetweenPoints(cleanCorners[0], cleanCorners[3]) + distanceBetweenPoints(cleanCorners[1], cleanCorners[2])) / 2;
    const aspect = avgHeight > 0 ? avgWidth / avgHeight : 0;
    if (areaRatio < 0.18 || areaRatio > 0.96) return null;
    if (aspect < 0.42 || aspect > 1.9) return null;
    return cleanCorners;
  }

  function scoreScannerDetectedCorners(imageData, corners) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const center = corners.reduce((acc, point) => ({
      x: acc.x + point.x / 4,
      y: acc.y + point.y / 4
    }), { x: 0, y: 0 });
    const sampleDistance = Math.max(2, Math.min(width, height) * 0.008);
    const readPixel = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return null;
      const px = Math.max(0, Math.min(width - 1, Math.round(x)));
      const py = Math.max(0, Math.min(height - 1, Math.round(y)));
      const index = (py * width + px) * 4;
      return [data[index], data[index + 1], data[index + 2]];
    };
    const edgeScores = [];

    for (let edgeIndex = 0; edgeIndex < corners.length; edgeIndex += 1) {
      const start = corners[edgeIndex];
      const end = corners[(edgeIndex + 1) % corners.length];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const samples = [];
      for (let sampleIndex = 0; sampleIndex < 19; sampleIndex += 1) {
        const t = 0.08 + 0.84 * (sampleIndex / 18);
        const x = start.x + dx * t;
        const y = start.y + dy * t;
        let inwardX = center.x - x;
        let inwardY = center.y - y;
        const inwardLength = Math.max(0.0001, Math.sqrt(inwardX * inwardX + inwardY * inwardY));
        inwardX /= inwardLength;
        inwardY /= inwardLength;
        const inside = readPixel(x + inwardX * sampleDistance, y + inwardY * sampleDistance);
        const outside = readPixel(x - inwardX * sampleDistance, y - inwardY * sampleDistance);
        if (!inside || !outside) continue;
        const dr = inside[0] - outside[0];
        const dg = inside[1] - outside[1];
        const db = inside[2] - outside[2];
        const colorDistance = Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3);
        const luminanceDistance = Math.abs(
          getScannerLuminance(inside[0], inside[1], inside[2])
          - getScannerLuminance(outside[0], outside[1], outside[2])
        );
        samples.push(colorDistance * 0.45 + luminanceDistance * 0.55);
      }
      samples.sort((a, b) => a - b);
      edgeScores.push(samples.length ? samples[Math.floor(samples.length / 2)] : 0);
    }

    const sortedEdges = edgeScores.slice().sort((a, b) => a - b);
    const medianEdge = (sortedEdges[1] + sortedEdges[2]) / 2;
    const weakestEdge = sortedEdges[0];
    const areaRatio = getScannerPolygonArea(corners) / Math.max(1, width * height);
    const borderMargin = Math.max(2, Math.min(width, height) * 0.008);
    let borderPenalty = 0;
    corners.forEach((point) => {
      if (
        point.x <= borderMargin
        || point.y <= borderMargin
        || point.x >= width - borderMargin
        || point.y >= height - borderMargin
      ) {
        borderPenalty += 34;
      }
    });
    const oversizedPenalty = areaRatio > 0.93 ? (areaRatio - 0.93) * 500 : 0;
    return areaRatio * 120 + medianEdge * 1.8 + weakestEdge * 1.2 - borderPenalty - oversizedPenalty;
  }

  function getScannerEdgePaperEvidence(imageData, corners, edgeIndex) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const start = corners[edgeIndex];
    const end = corners[(edgeIndex + 1) % corners.length];
    const center = corners.reduce((acc, point) => ({
      x: acc.x + point.x / 4,
      y: acc.y + point.y / 4
    }), { x: 0, y: 0 });
    const minDimension = Math.min(width, height);
    const sampleDistances = [0.012, 0.022, 0.034].map((ratio) => Math.max(3, minDimension * ratio));
    const isPaperAt = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      const px = Math.max(0, Math.min(width - 1, Math.round(x)));
      const py = Math.max(0, Math.min(height - 1, Math.round(y)));
      const index = (py * width + px) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      return getScannerLuminance(r, g, b) > 82 && getScannerSaturation(r, g, b) < 118;
    };
    let insidePaper = 0;
    let outsidePaper = 0;
    let sampleTotal = 0;
    for (let sampleIndex = 0; sampleIndex < 25; sampleIndex += 1) {
      const t = 0.1 + 0.8 * (sampleIndex / 24);
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      let inwardX = center.x - x;
      let inwardY = center.y - y;
      const inwardLength = Math.max(0.0001, Math.sqrt(inwardX * inwardX + inwardY * inwardY));
      inwardX /= inwardLength;
      inwardY /= inwardLength;
      sampleDistances.forEach((sampleDistance) => {
        if (isPaperAt(
          x + inwardX * sampleDistance,
          y + inwardY * sampleDistance
        )) insidePaper += 1;
        if (isPaperAt(
          x - inwardX * sampleDistance,
          y - inwardY * sampleDistance
        )) outsidePaper += 1;
        sampleTotal += 1;
      });
    }
    return {
      insidePaper: insidePaper / Math.max(1, sampleTotal),
      outsidePaper: outsidePaper / Math.max(1, sampleTotal)
    };
  }

  function createScannerFittedEdge(corners, edgeIndex) {
    const start = corners[edgeIndex];
    const end = corners[(edgeIndex + 1) % corners.length];
    const vertical = Math.abs(end.y - start.y) > Math.abs(end.x - start.x);
    if (vertical) {
      const denominator = end.y - start.y || 0.0001;
      const m = (end.x - start.x) / denominator;
      return { line: { m, b: start.x - m * start.y }, vertical: true };
    }
    const denominator = end.x - start.x || 0.0001;
    const m = (end.y - start.y) / denominator;
    return { line: { m, b: start.y - m * start.x }, vertical: false };
  }

  function intersectScannerFittedEdges(first, second) {
    if (!first || !second || first.vertical === second.vertical) return null;
    const yLine = first.vertical ? second.line : first.line;
    const xLine = first.vertical ? first.line : second.line;
    return intersectScannerFittedLines(yLine, xLine);
  }

  function repairScannerInternalShadowEdges(imageData, corners, alternativeCorners) {
    if (!corners || !alternativeCorners) return corners;
    const width = imageData.width;
    const height = imageData.height;
    const minDimension = Math.min(width, height);
    const center = corners.reduce((acc, point) => ({
      x: acc.x + point.x / 4,
      y: acc.y + point.y / 4
    }), { x: 0, y: 0 });
    const edges = corners.map((_, edgeIndex) => createScannerFittedEdge(corners, edgeIndex));
    let repairedEdgeCount = 0;

    for (let edgeIndex = 0; edgeIndex < 4; edgeIndex += 1) {
      const currentEvidence = getScannerEdgePaperEvidence(imageData, corners, edgeIndex);
      const alternativeEvidence = getScannerEdgePaperEvidence(imageData, alternativeCorners, edgeIndex);
      const currentStart = corners[edgeIndex];
      const currentEnd = corners[(edgeIndex + 1) % 4];
      const alternativeStart = alternativeCorners[edgeIndex];
      const alternativeEnd = alternativeCorners[(edgeIndex + 1) % 4];
      const currentMidpoint = {
        x: (currentStart.x + currentEnd.x) / 2,
        y: (currentStart.y + currentEnd.y) / 2
      };
      let outwardX = currentMidpoint.x - center.x;
      let outwardY = currentMidpoint.y - center.y;
      const outwardLength = Math.max(0.0001, Math.sqrt(outwardX * outwardX + outwardY * outwardY));
      outwardX /= outwardLength;
      outwardY /= outwardLength;
      const outwardShifts = [0.15, 0.5, 0.85].map((t) => {
        const currentPoint = {
          x: currentStart.x + (currentEnd.x - currentStart.x) * t,
          y: currentStart.y + (currentEnd.y - currentStart.y) * t
        };
        const alternativePoint = {
          x: alternativeStart.x + (alternativeEnd.x - alternativeStart.x) * t,
          y: alternativeStart.y + (alternativeEnd.y - alternativeStart.y) * t
        };
        return (alternativePoint.x - currentPoint.x) * outwardX
          + (alternativePoint.y - currentPoint.y) * outwardY;
      }).sort((first, second) => first - second);
      const minimumOutwardShift = outwardShifts[0];
      const medianOutwardShift = outwardShifts[1];
      const currentBoundary = currentEvidence.insidePaper - currentEvidence.outsidePaper;
      const alternativeBoundary = alternativeEvidence.insidePaper - alternativeEvidence.outsidePaper;
      const looksLikeInternalShadow = currentEvidence.insidePaper >= 0.68
        && currentEvidence.outsidePaper >= 0.72;
      const alternativeLooksLikeOuterPaper = alternativeEvidence.insidePaper >= 0.65
        && alternativeEvidence.outsidePaper <= currentEvidence.outsidePaper - 0.24
        && alternativeBoundary >= currentBoundary + 0.24
        && alternativeBoundary >= 0.28;
      if (
        looksLikeInternalShadow
        && alternativeLooksLikeOuterPaper
        && medianOutwardShift >= minDimension * 0.008
        && medianOutwardShift <= minDimension * 0.28
        && minimumOutwardShift >= -minDimension * 0.004
      ) {
        edges[edgeIndex] = createScannerFittedEdge(alternativeCorners, edgeIndex);
        repairedEdgeCount += 1;
      }
    }

    if (!repairedEdgeCount) return corners;
    const repaired = [
      intersectScannerFittedEdges(edges[3], edges[0]),
      intersectScannerFittedEdges(edges[0], edges[1]),
      intersectScannerFittedEdges(edges[1], edges[2]),
      intersectScannerFittedEdges(edges[2], edges[3])
    ];
    const valid = validateScannerDetectedCorners(repaired, width, height);
    if (!valid) return corners;
    const originalArea = getScannerPolygonArea(corners);
    const repairedArea = getScannerPolygonArea(valid);
    if (repairedArea < originalArea * 1.01 || repairedArea > originalArea * 1.45) return corners;
    return valid;
  }

  function scannerQuadsAgree(first, second, width, height) {
    if (!first || !second) return false;
    const tolerance = Math.max(6, Math.min(width, height) * 0.035);
    return first.every((point, index) => distanceBetweenPoints(point, second[index]) <= tolerance);
  }

  function scannerQuadTouchesFrame(corners, width, height) {
    if (!corners) return false;
    const margin = Math.max(3, Math.min(width, height) * 0.02);
    return corners.filter((point) => (
      point.x <= margin
      || point.y <= margin
      || point.x >= width - margin
      || point.y >= height - margin
    )).length >= 2;
  }
  function isScannerPaperSurfacePixel(imageData, x, y) {
    const width = imageData.width;
    const height = imageData.height;
    const px = Math.max(0, Math.min(width - 1, Math.round(x)));
    const py = Math.max(0, Math.min(height - 1, Math.round(y)));
    const index = (py * width + px) * 4;
    const data = imageData.data;
    const lum = getScannerLuminance(data[index], data[index + 1], data[index + 2]);
    const saturation = getScannerSaturation(data[index], data[index + 1], data[index + 2]);
    return lum > 82 && saturation < 118;
  }

  function getScannerMedian(values) {
    if (!values.length) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  function scanScannerPaperBoundaryX(imageData, startX, y, direction) {
    const width = imageData.width;
    let lastPaper = startX;
    let misses = 0;
    const maxSteps = Math.max(8, Math.round(width * 0.42));
    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
      const x = startX + direction * stepIndex;
      if (x < 0 || x >= width) break;
      if (isScannerPaperSurfacePixel(imageData, x, y)) {
        lastPaper = x;
        misses = 0;
      } else {
        misses += 1;
        if (misses >= 4) break;
      }
    }
    return lastPaper;
  }

  function scanScannerPaperBoundaryY(imageData, x, startY, direction) {
    const height = imageData.height;
    let lastPaper = startY;
    let misses = 0;
    const maxSteps = Math.max(8, Math.round(height * 0.42));
    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
      const y = startY + direction * stepIndex;
      if (y < 0 || y >= height) break;
      if (isScannerPaperSurfacePixel(imageData, x, y)) {
        lastPaper = y;
        misses = 0;
      } else {
        misses += 1;
        if (misses >= 4) break;
      }
    }
    return lastPaper;
  }

  function refineScannerPaperCornersFromInnerBorder(imageData, borderCorners) {
    const width = imageData.width;
    const height = imageData.height;
    const minX = Math.max(0, Math.min(...borderCorners.map((point) => point.x)));
    const maxX = Math.min(width - 1, Math.max(...borderCorners.map((point) => point.x)));
    const minY = Math.max(0, Math.min(...borderCorners.map((point) => point.y)));
    const maxY = Math.min(height - 1, Math.max(...borderCorners.map((point) => point.y)));
    const borderWidth = Math.max(1, maxX - minX);
    const borderHeight = Math.max(1, maxY - minY);
    const rows = [];
    const cols = [];
    const sampleCount = 17;
    for (let i = 1; i < sampleCount - 1; i += 1) {
      rows.push(minY + borderHeight * (i / (sampleCount - 1)));
      cols.push(minX + borderWidth * (i / (sampleCount - 1)));
    }

    const leftValues = rows.map((y) => scanScannerPaperBoundaryX(imageData, minX, y, -1));
    const rightValues = rows.map((y) => scanScannerPaperBoundaryX(imageData, maxX, y, 1));
    const topValues = cols.map((x) => scanScannerPaperBoundaryY(imageData, x, minY, -1));
    const bottomValues = cols.map((x) => scanScannerPaperBoundaryY(imageData, x, maxY, 1));

    let left = getScannerMedian(leftValues);
    let right = getScannerMedian(rightValues);
    let top = getScannerMedian(topValues);
    let bottom = getScannerMedian(bottomValues);
    if ([left, right, top, bottom].some((value) => value == null || !Number.isFinite(value))) return null;

    const minHorizontalExpansion = Math.max(8, borderWidth * 0.1);
    const minVerticalExpansion = Math.max(8, borderHeight * 0.1);
    const maxHorizontalExpansion = Math.max(minHorizontalExpansion, Math.min(width * 0.22, borderWidth * 0.32));
    const maxVerticalExpansion = Math.max(minVerticalExpansion, Math.min(height * 0.2, borderHeight * 0.26));
    left = Math.max(left, minX - maxHorizontalExpansion);
    right = Math.min(right, maxX + maxHorizontalExpansion);
    top = Math.max(top, minY - maxVerticalExpansion);
    bottom = Math.min(bottom, maxY + maxVerticalExpansion);
    left = Math.min(left, minX - minHorizontalExpansion);
    right = Math.max(right, maxX + minHorizontalExpansion);
    top = Math.min(top, minY - minVerticalExpansion);
    bottom = Math.max(bottom, maxY + minVerticalExpansion);

    return validateScannerDetectedCorners([
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom }
    ], width, height);
  }

  function getScannerBlueFrameStrength(r, g, b) {
    const saturation = Math.max(r, g, b) - Math.min(r, g, b);
    const luminance = getScannerLuminance(r, g, b);
    const blueExcess = Math.min(b - r - 7, b - g - 1);
    if (blueExcess <= 0 || saturation < 12 || luminance < 30 || luminance > 246) return 0;
    return Math.min(1, blueExcess / 28) * Math.min(1, saturation / 45);
  }

  function detectScannerLongBlueFramePaperCorners(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    if (width < 80 || height < 80) return null;
    const gridStep = Math.max(1, Math.round(Math.max(width, height) / 900));
    const gridWidth = Math.ceil(width / gridStep);
    const gridHeight = Math.ceil(height / gridStep);
    const strengthGrid = new Uint8Array(gridWidth * gridHeight);
    const occupiedRows = new Uint8Array(gridHeight);
    const occupiedColumns = new Uint8Array(gridWidth);
    let strongBlueCellCount = 0;

    const readSourceStrength = (x, y) => {
      const safeX = Math.max(0, Math.min(width - 1, x));
      const safeY = Math.max(0, Math.min(height - 1, y));
      const index = (safeY * width + safeX) * 4;
      return getScannerBlueFrameStrength(data[index], data[index + 1], data[index + 2]);
    };

    for (let gridY = 0; gridY < gridHeight; gridY += 1) {
      const sourceY = Math.min(height - 1, gridY * gridStep);
      for (let gridX = 0; gridX < gridWidth; gridX += 1) {
        const sourceX = Math.min(width - 1, gridX * gridStep);
        let strength = readSourceStrength(sourceX, sourceY);
        if (gridStep > 1) {
          strength = Math.max(strength, readSourceStrength(
            Math.min(width - 1, sourceX + gridStep - 1),
            Math.min(height - 1, sourceY + gridStep - 1)
          ));
        }
        if (strength <= 0) continue;
        strengthGrid[gridY * gridWidth + gridX] = Math.round(strength * 255);
        if (strength > 0.2) {
          occupiedRows[gridY] = 1;
          occupiedColumns[gridX] = 1;
          strongBlueCellCount += 1;
        }
      }
    }

    const occupiedRowCount = occupiedRows.reduce((sum, value) => sum + value, 0);
    const occupiedColumnCount = occupiedColumns.reduce((sum, value) => sum + value, 0);
    if (
      strongBlueCellCount < 60
      || strongBlueCellCount > gridWidth * gridHeight * 0.18
      || occupiedRowCount < gridHeight * 0.32
      || occupiedColumnCount < gridWidth * 0.32
    ) return null;

    const readLineSupport = (vertical, across, along) => {
      const centerGridX = Math.max(0, Math.min(
        gridWidth - 1,
        Math.round((vertical ? across : along) / gridStep)
      ));
      const centerGridY = Math.max(0, Math.min(
        gridHeight - 1,
        Math.round((vertical ? along : across) / gridStep)
      ));
      let best = 0;
      for (let delta = -2; delta <= 2; delta += 1) {
        const gridX = vertical ? centerGridX + delta : centerGridX;
        const gridY = vertical ? centerGridY : centerGridY + delta;
        if (gridX < 0 || gridY < 0 || gridX >= gridWidth || gridY >= gridHeight) continue;
        best = Math.max(best, strengthGrid[gridY * gridWidth + gridX]);
      }
      return best / 255;
    };

    const evaluateLine = (vertical, intercept, slope, sampleCount) => {
      const alongSpan = vertical ? height : width;
      let supported = 0;
      let currentRun = 0;
      let longestRun = 0;
      let strengthTotal = 0;
      for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
        const along = alongSpan * (0.09 + 0.82 * (sampleIndex / (sampleCount - 1)));
        const across = intercept + slope * (along - alongSpan / 2);
        const strength = readLineSupport(vertical, across, along);
        strengthTotal += strength;
        if (strength > 0.2) {
          supported += 1;
          currentRun += 1;
          longestRun = Math.max(longestRun, currentRun);
        } else {
          currentRun = 0;
        }
      }
      const supportRatio = supported / sampleCount;
      const runRatio = longestRun / sampleCount;
      const meanStrength = strengthTotal / sampleCount;
      return {
        intercept,
        slope,
        supportRatio,
        runRatio,
        score: supportRatio * 0.58 + runRatio * 0.27 + meanStrength * 0.15
      };
    };

    const findFrameLine = (vertical, side) => {
      const span = vertical ? width : height;
      const startRatio = side === 'start' ? 0.055 : 0.53;
      const endRatio = side === 'start' ? 0.47 : 0.965;
      const interceptStep = Math.max(gridStep * 2, span / 120);
      let best = null;
      for (let intercept = span * startRatio; intercept <= span * endRatio; intercept += interceptStep) {
        for (let slope = -0.24; slope <= 0.2401; slope += 0.02) {
          const candidate = evaluateLine(vertical, intercept, slope, 43);
          if (!best || candidate.score > best.score) best = candidate;
        }
      }
      if (!best) return null;
      let refined = evaluateLine(vertical, best.intercept, best.slope, 61);
      const fineInterceptStep = Math.max(0.5, gridStep * 0.5);
      for (
        let intercept = best.intercept - interceptStep;
        intercept <= best.intercept + interceptStep + 0.001;
        intercept += fineInterceptStep
      ) {
        for (let slope = best.slope - 0.025; slope <= best.slope + 0.0251; slope += 0.0025) {
          const candidate = evaluateLine(vertical, intercept, slope, 61);
          if (candidate.score > refined.score) refined = candidate;
        }
      }
      if (
        refined.score < 0.42
        || refined.supportRatio < 0.42
        || refined.runRatio < 0.16
      ) return null;
      return refined;
    };

    const left = findFrameLine(true, 'start');
    const right = findFrameLine(true, 'end');
    const top = findFrameLine(false, 'start');
    const bottom = findFrameLine(false, 'end');
    if (!left || !right || !top || !bottom) return null;

    const leftLine = { m: left.slope, b: left.intercept - left.slope * height / 2 };
    const rightLine = { m: right.slope, b: right.intercept - right.slope * height / 2 };
    const topLine = { m: top.slope, b: top.intercept - top.slope * width / 2 };
    const bottomLine = { m: bottom.slope, b: bottom.intercept - bottom.slope * width / 2 };
    const frameCorners = validateScannerDetectedCorners([
      intersectScannerFittedLines(topLine, leftLine),
      intersectScannerFittedLines(topLine, rightLine),
      intersectScannerFittedLines(bottomLine, rightLine),
      intersectScannerFittedLines(bottomLine, leftLine)
    ], width, height);
    if (!frameCorners) return null;

    const frameCenter = frameCorners.reduce((acc, point) => ({
      x: acc.x + point.x / 4,
      y: acc.y + point.y / 4
    }), { x: 0, y: 0 });
    const minDimension = Math.min(width, height);
    const boundaryProbe = Math.max(1.5, Math.min(4, minDimension * 0.003));
    const boundaryStart = Math.max(10, minDimension * 0.012);
    const boundaryEnd = Math.max(boundaryStart + 4, minDimension * 0.22);
    const boundaryStep = Math.max(0.75, minDimension / 800);
    const readBoundaryColor = (x, y) => {
      const safeX = Math.max(0, Math.min(width - 1, Math.round(x)));
      const safeY = Math.max(0, Math.min(height - 1, Math.round(y)));
      const index = (safeY * width + safeX) * 4;
      return [data[index], data[index + 1], data[index + 2]];
    };
    const boundaryColorDistance = (first, second) => {
      const dr = first[0] - second[0];
      const dg = first[1] - second[1];
      const db = first[2] - second[2];
      return Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3);
    };
    const findNearestOuterFrameEdge = (edgeIndex) => {
      const start = frameCorners[edgeIndex];
      const end = frameCorners[(edgeIndex + 1) % 4];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      let normalX = -dy / length;
      let normalY = dx / length;
      const midpointX = (start.x + end.x) / 2;
      const midpointY = (start.y + end.y) / 2;
      if (
        normalX * (midpointX - frameCenter.x)
          + normalY * (midpointY - frameCenter.y) < 0
      ) {
        normalX = -normalX;
        normalY = -normalY;
      }
      const candidates = [];
      for (let offset = boundaryStart; offset <= boundaryEnd; offset += boundaryStep) {
        const gradients = [];
        for (let sampleIndex = 0; sampleIndex < 31; sampleIndex += 1) {
          const t = 0.12 + 0.76 * (sampleIndex / 30);
          const baseX = start.x + dx * t + normalX * offset;
          const baseY = start.y + dy * t + normalY * offset;
          const inside = readBoundaryColor(
            baseX - normalX * boundaryProbe,
            baseY - normalY * boundaryProbe
          );
          const outside = readBoundaryColor(
            baseX + normalX * boundaryProbe,
            baseY + normalY * boundaryProbe
          );
          const luminanceDifference = Math.abs(
            getScannerLuminance(inside[0], inside[1], inside[2])
              - getScannerLuminance(outside[0], outside[1], outside[2])
          );
          gradients.push(
            luminanceDifference * 0.65
              + boundaryColorDistance(inside, outside) * 0.35
          );
        }
        gradients.sort((first, second) => first - second);
        candidates.push({
          offset,
          score: gradients[Math.floor(gradients.length * 0.2)] * 0.65
            + gradients[Math.floor(gradients.length * 0.5)] * 0.35
        });
      }
      const strongest = Math.max(...candidates.map((candidate) => candidate.score));
      if (!Number.isFinite(strongest) || strongest < 4) return null;
      const minimumScore = Math.max(4, strongest * 0.14);
      let selected = null;
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const previousScore = index > 0 ? candidates[index - 1].score : candidate.score;
        const nextScore = index < candidates.length - 1
          ? candidates[index + 1].score
          : candidate.score;
        if (
          candidate.score >= minimumScore
          && candidate.score >= previousScore * 0.9
          && candidate.score >= nextScore * 0.72
        ) {
          selected = candidate;
          break;
        }
      }
      if (!selected) return null;
      const shiftedCorners = frameCorners.map((point) => ({ x: point.x, y: point.y }));
      shiftedCorners[edgeIndex] = {
        x: start.x + normalX * selected.offset,
        y: start.y + normalY * selected.offset
      };
      shiftedCorners[(edgeIndex + 1) % 4] = {
        x: end.x + normalX * selected.offset,
        y: end.y + normalY * selected.offset
      };
      return createScannerFittedEdge(shiftedCorners, edgeIndex);
    };
    const nearestEdges = frameCorners.map((_, edgeIndex) => (
      findNearestOuterFrameEdge(edgeIndex)
    ));
    let nearestFrameCandidate = null;
    if (nearestEdges.every(Boolean)) {
      nearestFrameCandidate = validateScannerDetectedCorners([
        intersectScannerFittedEdges(nearestEdges[3], nearestEdges[0]),
        intersectScannerFittedEdges(nearestEdges[0], nearestEdges[1]),
        intersectScannerFittedEdges(nearestEdges[1], nearestEdges[2]),
        intersectScannerFittedEdges(nearestEdges[2], nearestEdges[3])
      ], width, height);
      if (nearestFrameCandidate) {
        const preciseNearest = validateScannerDetectedCorners(
          refineScannerQuadCornersWithGradient(
            imageData,
            nearestFrameCandidate,
            { precise: true }
          ),
          width,
          height
        );
        if (preciseNearest) nearestFrameCandidate = preciseNearest;
      }
    }

    const frameWidth = (
      distanceBetweenPoints(frameCorners[0], frameCorners[1])
      + distanceBetweenPoints(frameCorners[3], frameCorners[2])
    ) / 2;
    const frameHeight = (
      distanceBetweenPoints(frameCorners[0], frameCorners[3])
      + distanceBetweenPoints(frameCorners[1], frameCorners[2])
    ) / 2;
    const typicalSeed = expandScannerCornersFromCenter(
      frameCorners,
      Math.max(6, frameWidth * 0.045),
      Math.max(6, frameHeight * 0.04),
      width,
      height
    );
    let typicalCandidate = nearestFrameCandidate || validateScannerDetectedCorners(
      refineScannerQuadCornersWithGradient(imageData, typicalSeed),
      width,
      height
    );
    const preciseSeedCandidate = validateScannerDetectedCorners(
      refineScannerQuadCornersWithGradient(imageData, typicalSeed, { precise: true })
        || typicalSeed,
      width,
      height
    );
    if (!nearestFrameCandidate && typicalCandidate && preciseSeedCandidate) {
      const edgeAngleDifference = (firstStart, firstEnd, secondStart, secondEnd) => {
        const firstX = firstEnd.x - firstStart.x;
        const firstY = firstEnd.y - firstStart.y;
        const secondX = secondEnd.x - secondStart.x;
        const secondY = secondEnd.y - secondStart.y;
        const lengthProduct = Math.max(
          0.0001,
          Math.sqrt(firstX * firstX + firstY * firstY)
            * Math.sqrt(secondX * secondX + secondY * secondY)
        );
        const alignment = Math.max(-1, Math.min(
          1,
          Math.abs((firstX * secondX + firstY * secondY) / lengthProduct)
        ));
        return Math.acos(alignment);
      };
      const guardedEdges = typicalCandidate.map((_, edgeIndex) => {
        const nextIndex = (edgeIndex + 1) % 4;
        const angleDrift = edgeAngleDifference(
          frameCorners[edgeIndex],
          frameCorners[nextIndex],
          typicalCandidate[edgeIndex],
          typicalCandidate[nextIndex]
        );
        return createScannerFittedEdge(
          angleDrift > 0.035 ? preciseSeedCandidate : typicalCandidate,
          edgeIndex
        );
      });
      const guardedCandidate = validateScannerDetectedCorners([
        intersectScannerFittedEdges(guardedEdges[3], guardedEdges[0]),
        intersectScannerFittedEdges(guardedEdges[0], guardedEdges[1]),
        intersectScannerFittedEdges(guardedEdges[1], guardedEdges[2]),
        intersectScannerFittedEdges(guardedEdges[2], guardedEdges[3])
      ], width, height);
      if (guardedCandidate) typicalCandidate = guardedCandidate;
    }
    const scannedCandidate = refineScannerPaperCornersFromInnerBorder(imageData, frameCorners);
    const typicalScore = typicalCandidate
      ? scoreScannerDetectedCorners(imageData, typicalCandidate)
      : -Infinity;
    const scannedScore = scannedCandidate
      ? scoreScannerDetectedCorners(imageData, scannedCandidate)
      : -Infinity;
    let paperCorners = typicalCandidate || scannedCandidate;
    if (
      !nearestFrameCandidate
      && scannedCandidate
      && !scannerQuadTouchesFrame(scannedCandidate, width, height)
      && scannedScore >= Math.max(12, typicalScore * 0.72)
    ) paperCorners = scannedCandidate;
    if (!paperCorners) return null;
    paperCorners.scannerFrameConfidence = Math.min(
      left.score,
      right.score,
      top.score,
      bottom.score
    );
    return paperCorners;
  }

  function detectScannerBlueBorderCorners(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const step = Math.max(1, Math.round(Math.max(width, height) / 900));
    const points = [];

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const lum = getScannerLuminance(r, g, b);
        const saturation = getScannerSaturation(r, g, b);
        if (saturation >= 16 && b > r + 10 && b > g + 2 && lum > 34 && lum < 242) {
          points.push({ x, y });
        }
      }
    }

    if (points.length < 80) return null;
    const minX = getScannerPointPercentile(points, 'x', 0.008);
    const maxX = getScannerPointPercentile(points, 'x', 0.992);
    const minY = getScannerPointPercentile(points, 'y', 0.008);
    const maxY = getScannerPointPercentile(points, 'y', 0.992);
    const borderWidth = maxX - minX;
    const borderHeight = maxY - minY;
    if (borderWidth < width * 0.25 || borderHeight < height * 0.25) return null;

    const band = Math.max(8, Math.min(width, height) * 0.035);
    const leftPoints = points.filter((point) => point.x <= minX + band);
    const rightPoints = points.filter((point) => point.x >= maxX - band);
    const topPoints = points.filter((point) => point.y <= minY + band);
    const bottomPoints = points.filter((point) => point.y >= maxY - band);

    const topLine = fitScannerYLine(topPoints);
    const rightLine = fitScannerXLine(rightPoints);
    const bottomLine = fitScannerYLine(bottomPoints);
    const leftLine = fitScannerXLine(leftPoints);
    let corners = [
      intersectScannerFittedLines(topLine, leftLine),
      intersectScannerFittedLines(topLine, rightLine),
      intersectScannerFittedLines(bottomLine, rightLine),
      intersectScannerFittedLines(bottomLine, leftLine)
    ];

    if (corners.some((point) => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
      corners = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY }
      ];
    }

    const outerPaperCorners = refineScannerPaperCornersFromInnerBorder(imageData, corners);
    if (outerPaperCorners) return outerPaperCorners;
    const marginX = Math.max(10, borderWidth * 0.16);
    const marginY = Math.max(12, borderHeight * 0.18);
    return validateScannerDetectedCorners(expandScannerCornersFromCenter(corners, marginX, marginY, width, height), width, height);
  }

  function isScannerBrightPaperPixel(imageData, x, y) {
    const width = imageData.width;
    const height = imageData.height;
    const px = Math.max(0, Math.min(width - 1, Math.round(x)));
    const py = Math.max(0, Math.min(height - 1, Math.round(y)));
    const index = (py * width + px) * 4;
    const data = imageData.data;
    const lum = getScannerLuminance(data[index], data[index + 1], data[index + 2]);
    const saturation = getScannerSaturation(data[index], data[index + 1], data[index + 2]);
    return lum > 132 && saturation < 76;
  }

  function scanScannerBrightPaperBoundaryX(imageData, startX, y, direction, maxSteps) {
    const width = imageData.width;
    const confirmRun = 3;
    let run = 0;
    for (let stepIndex = 0; stepIndex <= maxSteps; stepIndex += 1) {
      const x = startX + direction * stepIndex;
      if (x < 0 || x >= width) return null;
      if (isScannerBrightPaperPixel(imageData, x, y)) {
        run += 1;
        if (run >= confirmRun) return x - direction * (confirmRun - 1);
      } else {
        run = 0;
      }
    }
    return null;
  }

  function scanScannerBrightPaperBoundaryY(imageData, x, startY, direction, maxSteps) {
    const height = imageData.height;
    const confirmRun = 3;
    let run = 0;
    for (let stepIndex = 0; stepIndex <= maxSteps; stepIndex += 1) {
      const y = startY + direction * stepIndex;
      if (y < 0 || y >= height) return null;
      if (isScannerBrightPaperPixel(imageData, x, y)) {
        run += 1;
        if (run >= confirmRun) return y - direction * (confirmRun - 1);
      } else {
        run = 0;
      }
    }
    return null;
  }

  function detectScannerBrightPaperCorners(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const step = Math.max(2, Math.round(Math.max(width, height) / 520));
    const points = [];

    for (let y = Math.round(height * 0.03); y < height * 0.97; y += step) {
      for (let x = Math.round(width * 0.03); x < width * 0.97; x += step) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const lum = getScannerLuminance(r, g, b);
        const saturation = getScannerSaturation(r, g, b);
        if (lum > 132 && saturation < 76) {
          points.push({ x, y });
        }
      }
    }

    if (points.length < 120) return null;

    // The point cloud's own bounding box is a safe outer search region: for a
    // rotated sheet its edges sit at or beyond the true paper edge, never
    // inside it, so scanning inward from here converges on the real edge
    // instead of collapsing to an axis-aligned box (which is wrong for any
    // photo that isn't perfectly square to the camera).
    const minX = getScannerPointPercentile(points, 'x', 0.02);
    const maxX = getScannerPointPercentile(points, 'x', 0.98);
    const minY = getScannerPointPercentile(points, 'y', 0.02);
    const maxY = getScannerPointPercentile(points, 'y', 0.98);
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);

    const marginX = Math.max(6, spanX * 0.05);
    const marginY = Math.max(6, spanY * 0.05);
    const searchMinX = Math.max(0, minX - marginX);
    const searchMaxX = Math.min(width - 1, maxX + marginX);
    const searchMinY = Math.max(0, minY - marginY);
    const searchMaxY = Math.min(height - 1, maxY + marginY);

    // Only probe the central portion of each axis for the opposite pair of
    // edges: near the corners a horizontal (or vertical) probe line can cross
    // onto the adjacent edge once the sheet is rotated, which would otherwise
    // contaminate the line fit below with points from the wrong edge.
    const centralFraction = 0.35;
    const yPad = (searchMaxY - searchMinY) * (1 - centralFraction) / 2;
    const xPad = (searchMaxX - searchMinX) * (1 - centralFraction) / 2;

    const sampleCount = 17;
    const rows = [];
    const cols = [];
    for (let i = 0; i < sampleCount; i += 1) {
      const t = i / (sampleCount - 1);
      rows.push(searchMinY + yPad + (searchMaxY - searchMinY - 2 * yPad) * t);
      cols.push(searchMinX + xPad + (searchMaxX - searchMinX - 2 * xPad) * t);
    }
    const maxHSteps = Math.round(searchMaxX - searchMinX) + 2;
    const maxVSteps = Math.round(searchMaxY - searchMinY) + 2;

    const leftPoints = rows
      .map((y) => ({ x: scanScannerBrightPaperBoundaryX(imageData, Math.round(searchMinX), Math.round(y), 1, maxHSteps), y }))
      .filter((point) => point.x != null);
    const rightPoints = rows
      .map((y) => ({ x: scanScannerBrightPaperBoundaryX(imageData, Math.round(searchMaxX), Math.round(y), -1, maxHSteps), y }))
      .filter((point) => point.x != null);
    const topPoints = cols
      .map((x) => ({ x, y: scanScannerBrightPaperBoundaryY(imageData, Math.round(x), Math.round(searchMinY), 1, maxVSteps) }))
      .filter((point) => point.y != null);
    const bottomPoints = cols
      .map((x) => ({ x, y: scanScannerBrightPaperBoundaryY(imageData, Math.round(x), Math.round(searchMaxY), -1, maxVSteps) }))
      .filter((point) => point.y != null);

    const leftLine = fitScannerXLine(leftPoints);
    const rightLine = fitScannerXLine(rightPoints);
    const topLine = fitScannerYLine(topPoints);
    const bottomLine = fitScannerYLine(bottomPoints);

    let corners = [
      intersectScannerFittedLines(topLine, leftLine),
      intersectScannerFittedLines(topLine, rightLine),
      intersectScannerFittedLines(bottomLine, rightLine),
      intersectScannerFittedLines(bottomLine, leftLine)
    ];

    if (corners.some((point) => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
      corners = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY }
      ];
    }

    const nudgeX = Math.max(4, spanX * 0.01);
    const nudgeY = Math.max(4, spanY * 0.01);
    return validateScannerDetectedCorners(expandScannerCornersFromCenter(corners, nudgeX, nudgeY, width, height), width, height);
  }

  function extractScannerSheetComponent(lumGrid, satGrid, gridW, gridH, threshold) {
    const cellCount = gridW * gridH;
    const rawMask = new Uint8Array(cellCount);
    for (let cell = 0; cell < cellCount; cell += 1) {
      if (lumGrid[cell] >= threshold && satGrid[cell] < 120) rawMask[cell] = 1;
    }

    // Morphological closing (dilate then erode by one cell): printed frames
    // and ruled lines are thin saturated strips that would otherwise split
    // the sheet into separate components, making the crop hug an inner frame
    // instead of the paper edge.
    const applySquareFilter = (source, keepValue) => {
      const output = new Uint8Array(cellCount);
      for (let gy = 0; gy < gridH; gy += 1) {
        for (let gx = 0; gx < gridW; gx += 1) {
          let hit = false;
          for (let oy = -1; oy <= 1 && !hit; oy += 1) {
            const sy = gy + oy;
            if (sy < 0 || sy >= gridH) continue;
            for (let ox = -1; ox <= 1; ox += 1) {
              const sx = gx + ox;
              if (sx < 0 || sx >= gridW) continue;
              if (source[sy * gridW + sx] === keepValue) {
                hit = true;
                break;
              }
            }
          }
          output[gy * gridW + gx] = hit ? keepValue : (1 - keepValue);
        }
      }
      return output;
    };
    const closedMask = applySquareFilter(applySquareFilter(rawMask, 1), 0);

    const labels = new Float32Array(cellCount);
    const stack = [];
    let bestLabel = 0;
    let bestArea = 0;
    let label = 0;

    for (let start = 0; start < cellCount; start += 1) {
      if (labels[start] || !closedMask[start]) continue;
      label += 1;
      let area = 0;
      stack.length = 0;
      stack.push(start);
      labels[start] = label;
      while (stack.length) {
        const cell = stack.pop();
        area += 1;
        const cx = cell % gridW;
        if (cx > 0 && !labels[cell - 1] && closedMask[cell - 1]) {
          labels[cell - 1] = label;
          stack.push(cell - 1);
        }
        if (cx < gridW - 1 && !labels[cell + 1] && closedMask[cell + 1]) {
          labels[cell + 1] = label;
          stack.push(cell + 1);
        }
        if (cell >= gridW && !labels[cell - gridW] && closedMask[cell - gridW]) {
          labels[cell - gridW] = label;
          stack.push(cell - gridW);
        }
        if (cell < cellCount - gridW && !labels[cell + gridW] && closedMask[cell + gridW]) {
          labels[cell + gridW] = label;
          stack.push(cell + gridW);
        }
      }
      if (area > bestArea) {
        bestArea = area;
        bestLabel = label;
      }
    }

    if (!bestLabel) return null;
    const mask = new Uint8Array(cellCount);
    let minGX = gridW;
    let maxGX = -1;
    let minGY = gridH;
    let maxGY = -1;
    for (let cell = 0; cell < cellCount; cell += 1) {
      if (labels[cell] !== bestLabel) continue;
      mask[cell] = 1;
      const cx = cell % gridW;
      const cy = (cell - cx) / gridW;
      if (cx < minGX) minGX = cx;
      if (cx > maxGX) maxGX = cx;
      if (cy < minGY) minGY = cy;
      if (cy > maxGY) maxGY = cy;
    }
    return { mask, area: bestArea, minGX, maxGX, minGY, maxGY };
  }

  function fitScannerSheetQuadFromComponent(component, gridW, gridH, gridStep, width, height) {
    const mask = component.mask;
    const toPixelX = (gx) => Math.min(width, (gx + 0.5) * gridStep);
    const toPixelY = (gy) => Math.min(height, (gy + 0.5) * gridStep);
    const searchMinX = Math.max(0, component.minGX - 2);
    const searchMaxX = Math.min(gridW - 1, component.maxGX + 2);
    const searchMinY = Math.max(0, component.minGY - 2);
    const searchMaxY = Math.min(gridH - 1, component.maxGY + 2);
    // Probe only the central band of each axis so that, on a rotated sheet,
    // scans aimed at one edge cannot land on the adjacent edge near a corner
    // and contaminate the line fit.
    const centralFraction = 0.35;
    const yPad = (searchMaxY - searchMinY) * (1 - centralFraction) / 2;
    const xPad = (searchMaxX - searchMinX) * (1 - centralFraction) / 2;
    const sampleCount = 17;

    const scanX = (gy, direction) => {
      const startGX = direction > 0 ? searchMinX : searchMaxX;
      let run = 0;
      for (let gx = startGX; gx >= searchMinX && gx <= searchMaxX; gx += direction) {
        if (mask[gy * gridW + gx]) {
          run += 1;
          if (run >= 2) return gx - direction;
        } else {
          run = 0;
        }
      }
      return null;
    };
    const scanY = (gx, direction) => {
      const startGY = direction > 0 ? searchMinY : searchMaxY;
      let run = 0;
      for (let gy = startGY; gy >= searchMinY && gy <= searchMaxY; gy += direction) {
        if (mask[gy * gridW + gx]) {
          run += 1;
          if (run >= 2) return gy - direction;
        } else {
          run = 0;
        }
      }
      return null;
    };

    const leftPoints = [];
    const rightPoints = [];
    const topPoints = [];
    const bottomPoints = [];
    for (let i = 0; i < sampleCount; i += 1) {
      const t = i / (sampleCount - 1);
      const gy = Math.round(searchMinY + yPad + (searchMaxY - searchMinY - 2 * yPad) * t);
      const gx = Math.round(searchMinX + xPad + (searchMaxX - searchMinX - 2 * xPad) * t);
      const leftGX = scanX(gy, 1);
      if (leftGX != null) leftPoints.push({ x: toPixelX(leftGX), y: toPixelY(gy) });
      const rightGX = scanX(gy, -1);
      if (rightGX != null) rightPoints.push({ x: toPixelX(rightGX), y: toPixelY(gy) });
      const topGY = scanY(gx, 1);
      if (topGY != null) topPoints.push({ x: toPixelX(gx), y: toPixelY(topGY) });
      const bottomGY = scanY(gx, -1);
      if (bottomGY != null) bottomPoints.push({ x: toPixelX(gx), y: toPixelY(bottomGY) });
    }

    // One-sided trimmed refit: glare streaks and folds attached to the sheet
    // only ever push a boundary sample OUTWARD, never inward, so iteratively
    // drop samples with a large outward residual and refit on the consensus
    // (inner-envelope) points.
    const oneSidedFit = (points, fitFn, residualFn, outwardSign) => {
      let kept = points.slice();
      let line = fitFn(kept);
      const tolerance = gridStep * 1.5;
      for (let iteration = 0; iteration < 3 && line; iteration += 1) {
        const next = kept.filter((point) => residualFn(line, point) * outwardSign <= tolerance);
        if (next.length === kept.length || next.length < 8) break;
        const refit = fitFn(next);
        if (!refit) break;
        kept = next;
        line = refit;
      }
      return line;
    };
    const xResidual = (line, point) => point.x - (line.m * point.y + line.b);
    const yResidual = (line, point) => point.y - (line.m * point.x + line.b);

    const leftLine = oneSidedFit(leftPoints, fitScannerXLine, xResidual, -1);
    const rightLine = oneSidedFit(rightPoints, fitScannerXLine, xResidual, 1);
    const topLine = oneSidedFit(topPoints, fitScannerYLine, yResidual, -1);
    const bottomLine = oneSidedFit(bottomPoints, fitScannerYLine, yResidual, 1);
    let corners = [
      intersectScannerFittedLines(topLine, leftLine),
      intersectScannerFittedLines(topLine, rightLine),
      intersectScannerFittedLines(bottomLine, rightLine),
      intersectScannerFittedLines(bottomLine, leftLine)
    ];
    if (corners.some((point) => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
      corners = [
        { x: toPixelX(component.minGX), y: toPixelY(component.minGY) },
        { x: toPixelX(component.maxGX), y: toPixelY(component.minGY) },
        { x: toPixelX(component.maxGX), y: toPixelY(component.maxGY) },
        { x: toPixelX(component.minGX), y: toPixelY(component.maxGY) }
      ];
    }
    return corners;
  }

  function refineScannerQuadCornersWithGradient(imageData, corners, options = {}) {
    if (!Array.isArray(corners) || corners.length !== 4) return null;
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const minDimension = Math.min(width, height);
    const precise = Boolean(options.precise);
    const searchRadius = precise
      ? Math.max(2.5, Math.min(7, minDimension * 0.0055))
      : Math.max(5, Math.min(30, minDimension * 0.025));
    const readColor = (x, y) => {
      const safeX = Math.max(0, Math.min(width - 1.001, x));
      const safeY = Math.max(0, Math.min(height - 1.001, y));
      const x0 = Math.floor(safeX);
      const y0 = Math.floor(safeY);
      const x1 = Math.min(width - 1, x0 + 1);
      const y1 = Math.min(height - 1, y0 + 1);
      const tx = safeX - x0;
      const ty = safeY - y0;
      const readChannel = (channel) => {
        const top = data[(y0 * width + x0) * 4 + channel] * (1 - tx)
          + data[(y0 * width + x1) * 4 + channel] * tx;
        const bottom = data[(y1 * width + x0) * 4 + channel] * (1 - tx)
          + data[(y1 * width + x1) * 4 + channel] * tx;
        return top * (1 - ty) + bottom * ty;
      };
      return [readChannel(0), readChannel(1), readChannel(2)];
    };
    const colorDistance = (first, second) => {
      const dr = first[0] - second[0];
      const dg = first[1] - second[1];
      const db = first[2] - second[2];
      return Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3);
    };
    const fitWeightedLine = (points, vertical) => {
      if (!points || points.length < 8) return null;
      let weightTotal = 0;
      let independentTotal = 0;
      let dependentTotal = 0;
      let independentSquaredTotal = 0;
      let productTotal = 0;
      points.forEach((point) => {
        const weight = Math.max(0.2, Number(point.weight || 1));
        const independent = vertical ? point.y : point.x;
        const dependent = vertical ? point.x : point.y;
        weightTotal += weight;
        independentTotal += independent * weight;
        dependentTotal += dependent * weight;
        independentSquaredTotal += independent * independent * weight;
        productTotal += independent * dependent * weight;
      });
      const denominator = weightTotal * independentSquaredTotal
        - independentTotal * independentTotal;
      if (Math.abs(denominator) < 0.0001) return null;
      const m = (weightTotal * productTotal - independentTotal * dependentTotal) / denominator;
      const b = (dependentTotal - m * independentTotal) / weightTotal;
      return { m, b };
    };
    const center = corners.reduce((acc, point) => ({ x: acc.x + point.x / 4, y: acc.y + point.y / 4 }), { x: 0, y: 0 });

    const refineEdge = (p0, p1) => {
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      let nx = -dy / length;
      let ny = dx / length;
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      if (nx * (midX - center.x) + ny * (midY - center.y) < 0) {
        nx = -nx;
        ny = -ny;
      }
      const probeDistance = Math.max(1.25, Math.min(2.5, minDimension * 0.003));
      // A physical sheet boundary remains a step at several observation
      // widths. Printed rules, JPEG ringing, sleeve wrinkles and narrow glare
      // streaks usually peak at only one width. Requiring support at all three
      // scales keeps the sub-pixel fit attached to the page itself.
      const probeDistances = precise
        ? [
          0.65,
          Math.max(1.4, Math.min(2.5, minDimension * 0.0018)),
          Math.max(3.2, Math.min(5.5, minDimension * 0.004))
        ]
        : [
          Math.max(0.9, probeDistance * 0.75),
          probeDistance * 1.6,
          probeDistance * 4.2
        ];
      const polaritySamples = [];
      for (let i = 0; i < 19; i += 1) {
        const t = 0.14 + 0.72 * (i / 18);
        const bx = p0.x + dx * t;
        const by = p0.y + dy * t;
        const distancePolarities = probeDistances.map((polarityDistance) => {
          const inside = readColor(bx - nx * polarityDistance, by - ny * polarityDistance);
          const outside = readColor(bx + nx * polarityDistance, by + ny * polarityDistance);
          return getScannerLuminance(inside[0], inside[1], inside[2])
            - getScannerLuminance(outside[0], outside[1], outside[2]);
        }).sort((a, b) => a - b);
        polaritySamples.push(distancePolarities[1]);
      }
      polaritySamples.sort((a, b) => a - b);
      const edgePolarity = polaritySamples[Math.floor(polaritySamples.length / 2)] < -1 ? -1 : 1;
      const sampleCount = precise ? 37 : 41;
      const searchStep = 0.5;
      const points = [];
      const medianThree = (first, second, third) => first + second + third
        - Math.min(first, second, third)
        - Math.max(first, second, third);
      const readWideProbeColor = (bx, by, offset, direction, distance) => {
        const near = readColor(
          bx + nx * (offset + direction * distance * 0.72),
          by + ny * (offset + direction * distance * 0.72)
        );
        const middle = readColor(
          bx + nx * (offset + direction * distance),
          by + ny * (offset + direction * distance)
        );
        const far = readColor(
          bx + nx * (offset + direction * distance * 1.38),
          by + ny * (offset + direction * distance * 1.38)
        );
        return [
          medianThree(near[0], middle[0], far[0]),
          medianThree(near[1], middle[1], far[1]),
          medianThree(near[2], middle[2], far[2])
        ];
      };
      for (let i = 0; i < sampleCount; i += 1) {
        const t = 0.1 + 0.8 * (i / (sampleCount - 1));
        const bx = p0.x + dx * t;
        const by = p0.y + dy * t;
        const responses = [];
        let bestGradient = -Infinity;
        let bestOffset = null;
        let bestResponseIndex = -1;
        for (let s = -searchRadius; s <= searchRadius + 0.001; s += searchStep) {
          const scaleResponses = probeDistances.map((distance, scaleIndex) => {
            const inside = scaleIndex === probeDistances.length - 1
              ? readWideProbeColor(bx, by, s, -1, distance)
              : readColor(bx + nx * (s - distance), by + ny * (s - distance));
            const outside = scaleIndex === probeDistances.length - 1
              ? readWideProbeColor(bx, by, s, 1, distance)
              : readColor(bx + nx * (s + distance), by + ny * (s + distance));
            const luminanceDifference = edgePolarity * (
              getScannerLuminance(inside[0], inside[1], inside[2])
              - getScannerLuminance(outside[0], outside[1], outside[2])
            );
            const chromaticDifference = colorDistance(inside, outside);
            let response = Math.max(0, luminanceDifference) * 0.68 + chromaticDifference * 0.32;
            if (luminanceDifference < -chromaticDifference * 0.35) response *= 0.2;
            return response;
          });
          let gradient;
          if (precise) {
            gradient = scaleResponses[0] * 0.68
              + Math.min(scaleResponses[1], scaleResponses[2]) * 0.32;
          } else {
            scaleResponses.sort((a, b) => a - b);
            gradient = scaleResponses[0] * 0.7
              + scaleResponses[1] * 0.22
              + scaleResponses[2] * 0.08;
          }
          responses.push(gradient);
          if (gradient > bestGradient) {
            bestGradient = gradient;
            bestOffset = s;
            bestResponseIndex = responses.length - 1;
          }
        }
        if (bestResponseIndex > 0 && bestResponseIndex < responses.length - 1) {
          const previous = responses[bestResponseIndex - 1];
          const current = responses[bestResponseIndex];
          const next = responses[bestResponseIndex + 1];
          const denominator = previous - 2 * current + next;
          if (Math.abs(denominator) > 0.0001) {
            const subpixelOffset = Math.max(-1, Math.min(1, (previous - next) / (2 * denominator)));
            bestOffset += subpixelOffset * searchStep;
          }
        }
        const sortedResponses = responses.slice().sort((a, b) => a - b);
        const noiseFloor = sortedResponses[Math.floor(sortedResponses.length * 0.55)] || 0;
        if (bestOffset != null && bestGradient >= Math.max(5.5, noiseFloor + 2.25)) {
          points.push({
            x: bx + nx * bestOffset,
            y: by + ny * bestOffset,
            weight: Math.max(
              0.75,
              Math.min(precise ? 2.25 : 4, 0.75 + (bestGradient - noiseFloor) / 8)
            )
          });
        }
      }
      if (points.length < 10) return null;
      const vertical = Math.abs(dy) > Math.abs(dx);
      const fitFn = (candidatePoints) => fitWeightedLine(candidatePoints, vertical)
        || (vertical ? fitScannerXLine(candidatePoints) : fitScannerYLine(candidatePoints));
      const residualFn = vertical
        ? (line, point) => point.x - (line.m * point.y + line.b)
        : (line, point) => point.y - (line.m * point.x + line.b);
      let line = fitFn(points);
      if (!line) return null;
      let kept = points;
      for (let iteration = 0; iteration < 2; iteration += 1) {
        const residuals = kept.map((point) => Math.abs(residualFn(line, point)));
        const sorted = residuals.slice().sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const deviations = residuals
          .map((value) => Math.abs(value - median))
          .sort((a, b) => a - b);
        const mad = deviations[Math.floor(deviations.length / 2)] || 0;
        const tolerance = Math.max(1.5, median + Math.max(0.75, mad * 2.8));
        const next = kept.filter((point, index) => residuals[index] <= tolerance);
        if (next.length < 10 || next.length === kept.length) break;
        const refit = fitFn(next);
        if (!refit) break;
        kept = next;
        line = refit;
      }
      // Follow the consensus edge closely while retaining sub-pixel headroom
      // for a slight page curl. A high-percentile envelope admitted too much
      // sleeve/desk around otherwise accurately detected pages.
      const outwardSign = vertical ? Math.sign(nx || 1) : Math.sign(ny || 1);
      const outwardResiduals = kept
        .map((point) => residualFn(line, point) * outwardSign)
        .sort((a, b) => a - b);
      if (!precise) {
        const bulge = Math.max(0, outwardResiduals[Math.floor(outwardResiduals.length * 0.7)]);
        const maxBulge = Math.max(0.35, Math.min(0.9, searchRadius * 0.08));
        line = { m: line.m, b: line.b + Math.min(bulge, maxBulge) * outwardSign };
      }
      return { line, vertical };
    };

    const edges = [
      refineEdge(corners[0], corners[1]),
      refineEdge(corners[1], corners[2]),
      refineEdge(corners[2], corners[3]),
      refineEdge(corners[3], corners[0])
    ];
    const fallbackEdge = (p0, p1) => {
      const vertical = Math.abs(p1.y - p0.y) > Math.abs(p1.x - p0.x);
      if (vertical) {
        const denom = p1.y - p0.y || 0.0001;
        const m = (p1.x - p0.x) / denom;
        return { line: { m, b: p0.x - m * p0.y }, vertical: true };
      }
      const denom = p1.x - p0.x || 0.0001;
      const m = (p1.y - p0.y) / denom;
      return { line: { m, b: p0.y - m * p0.x }, vertical: false };
    };
    const finalEdges = edges.map((edge, index) => edge || fallbackEdge(corners[index], corners[(index + 1) % 4]));

    const intersectEdges = (a, b) => {
      if (a.vertical === b.vertical) return null;
      const yLine = a.vertical ? b.line : a.line;
      const xLine = a.vertical ? a.line : b.line;
      return intersectScannerFittedLines(yLine, xLine);
    };
    const refined = [
      intersectEdges(finalEdges[3], finalEdges[0]),
      intersectEdges(finalEdges[0], finalEdges[1]),
      intersectEdges(finalEdges[1], finalEdges[2]),
      intersectEdges(finalEdges[2], finalEdges[3])
    ];
    if (refined.some((point) => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) return null;
    const drift = refined.map((point, index) => distanceBetweenPoints(point, corners[index]));
    if (Math.max(...drift) > searchRadius * 1.75) return null;
    return refined;
  }

  function detectScannerDocumentSheetCorners(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const gridStep = Math.max(2, Math.round(Math.max(width, height) / 320));
    const gridW = Math.floor(width / gridStep);
    const gridH = Math.floor(height / gridStep);
    if (gridW < 24 || gridH < 24) return null;
    const cellCount = gridW * gridH;
    const lumGrid = new Float32Array(cellCount);
    const satGrid = new Float32Array(cellCount);
    const histogram = new Float32Array(256);

    for (let gy = 0; gy < gridH; gy += 1) {
      for (let gx = 0; gx < gridW; gx += 1) {
        const px = Math.min(width - 2, gx * gridStep);
        const py = Math.min(height - 2, gy * gridStep);
        let r = 0;
        let g = 0;
        let b = 0;
        for (let oy = 0; oy < 2; oy += 1) {
          for (let ox = 0; ox < 2; ox += 1) {
            const index = ((py + oy) * width + (px + ox)) * 4;
            r += data[index];
            g += data[index + 1];
            b += data[index + 2];
          }
        }
        r /= 4;
        g /= 4;
        b /= 4;
        const cellIndex = gy * gridW + gx;
        const lum = getScannerLuminance(r, g, b);
        lumGrid[cellIndex] = lum;
        satGrid[cellIndex] = getScannerSaturation(r, g, b);
        histogram[Math.max(0, Math.min(255, Math.round(lum)))] += 1;
      }
    }

    let brightRef = 255;
    let running = 0;
    const brightTarget = cellCount * 0.03;
    for (let level = 255; level >= 0; level -= 1) {
      running += histogram[level];
      if (running >= brightTarget) {
        brightRef = level;
        break;
      }
    }
    if (brightRef < 110) return null;

    // Sweep the paper/background split from strict to permissive. The sheet
    // shows up as a stable large component; the moment a lower threshold lets
    // the surroundings (bright desk, plastic sleeve, folder) merge in, the
    // area jumps sharply toward the frame border - keep the component from
    // just before that jump.
    const borderMargin = Math.max(2, Math.round(Math.min(gridW, gridH) * 0.06));
    const touchesBorder = (component) => (
      component.minGX <= borderMargin
      || component.minGY <= borderMargin
      || component.maxGX >= gridW - 1 - borderMargin
      || component.maxGY >= gridH - 1 - borderMargin
    );
    const ratios = [0.94, 0.86, 0.78, 0.68, 0.56];
    let chosen = null;
    for (let i = 0; i < ratios.length; i += 1) {
      const threshold = Math.max(96, brightRef * ratios[i]);
      const candidate = extractScannerSheetComponent(lumGrid, satGrid, gridW, gridH, threshold);
      if (!candidate) continue;
      if (
        chosen
        && chosen.area >= cellCount * 0.08
        && candidate.area > chosen.area * 1.6
        && touchesBorder(candidate)
        && !touchesBorder(chosen)
      ) {
        break;
      }
      chosen = candidate;
    }
    if (!chosen || chosen.area < cellCount * 0.1) return null;

    const corners = fitScannerSheetQuadFromComponent(chosen, gridW, gridH, gridStep, width, height);
    if (!corners) return null;
    // Snap the coarse grid-level quad onto the exact paper edge using the
    // full-resolution luminance gradient, then add only a hairline margin.
    const refined = refineScannerQuadCornersWithGradient(imageData, corners);
    const nudge = refined ? 0.65 : Math.max(4, Math.min(width, height) * 0.008);
    return validateScannerDetectedCorners(expandScannerCornersFromCenter(refined || corners, nudge, nudge, width, height), width, height);
  }

  function detectScannerGradientQuadCorners(imageData, options = {}) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    if (width < 80 || height < 80) return null;
    const offset = Math.max(2, Math.round(Math.min(width, height) * 0.006));
    const readColor = (x, y) => {
      const px = Math.max(0, Math.min(width - 1, Math.round(x)));
      const py = Math.max(0, Math.min(height - 1, Math.round(y)));
      const index = (py * width + px) * 4;
      return [data[index], data[index + 1], data[index + 2]];
    };
    const colorDistance = (first, second) => {
      const dr = first[0] - second[0];
      const dg = first[1] - second[1];
      const db = first[2] - second[2];
      return Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3);
    };
    const slopeValues = [];
    for (let slope = -0.5; slope <= 0.5001; slope += 0.04) slopeValues.push(slope);

    const findLine = (orientation, side) => {
      const vertical = orientation === 'vertical';
      const span = vertical ? width : height;
      const alongSpan = vertical ? height : width;
      const startRatio = side === 'start' ? 0.025 : 0.515;
      const endRatio = side === 'start' ? 0.485 : 0.975;
      const interceptStep = Math.max(2, span / 110);
      const candidates = [];
      for (let intercept = span * startRatio; intercept <= span * endRatio; intercept += interceptStep) {
        slopeValues.forEach((slope) => {
          const gradients = [];
          for (let sampleIndex = 0; sampleIndex < 29; sampleIndex += 1) {
            const along = alongSpan * (0.18 + 0.64 * (sampleIndex / 28));
            const across = intercept + slope * (along - alongSpan / 2);
            if (across < offset || across >= span - offset) continue;
            const before = vertical
              ? readColor(across - offset, along)
              : readColor(along, across - offset);
            const after = vertical
              ? readColor(across + offset, along)
              : readColor(along, across + offset);
            gradients.push(colorDistance(before, after));
          }
          if (gradients.length < 20) return;
          gradients.sort((a, b) => a - b);
          const support = gradients[Math.floor(gradients.length * 0.2)];
          const median = gradients[Math.floor(gradients.length * 0.5)];
          candidates.push({ intercept, slope, score: support * 0.72 + median * 0.28 });
        });
      }
      if (!candidates.length) return null;
      const strongest = Math.max(...candidates.map((candidate) => candidate.score));
      if (options.preferStrongest) {
        candidates.sort((first, second) => second.score - first.score);
        return candidates[0];
      }
      const minimumScore = Math.max(4, strongest * 0.38);
      const supported = candidates.filter((candidate) => candidate.score >= minimumScore);
      if (!supported.length) return null;
      supported.sort((a, b) => (
        side === 'start'
          ? a.intercept - b.intercept || b.score - a.score
          : b.intercept - a.intercept || b.score - a.score
      ));
      return supported[0];
    };

    const left = findLine('vertical', 'start');
    const right = findLine('vertical', 'end');
    const top = findLine('horizontal', 'start');
    const bottom = findLine('horizontal', 'end');
    if (!left || !right || !top || !bottom) return null;
    const toXLine = (line) => ({ m: line.slope, b: line.intercept - line.slope * height / 2 });
    const toYLine = (line) => ({ m: line.slope, b: line.intercept - line.slope * width / 2 });
    const leftLine = toXLine(left);
    const rightLine = toXLine(right);
    const topLine = toYLine(top);
    const bottomLine = toYLine(bottom);
    const corners = [
      intersectScannerFittedLines(topLine, leftLine),
      intersectScannerFittedLines(topLine, rightLine),
      intersectScannerFittedLines(bottomLine, rightLine),
      intersectScannerFittedLines(bottomLine, leftLine)
    ];
    const valid = validateScannerDetectedCorners(corners, width, height);
    if (!valid) return null;
    const refined = refineScannerQuadCornersWithGradient(imageData, valid);
    return validateScannerDetectedCorners(refined || valid, width, height);
  }

  function detectScannerPaperCorners(imageData) {
    if (!imageData || !imageData.data || !imageData.width || !imageData.height) return null;
    const framedPaperCandidate = detectScannerLongBlueFramePaperCorners(imageData);
    if (
      framedPaperCandidate
      && framedPaperCandidate.scannerFrameConfidence >= 0.42
    ) {
      const preciseFrameCandidate = validateScannerDetectedCorners(
        refineScannerQuadCornersWithGradient(imageData, framedPaperCandidate, { precise: true }),
        imageData.width,
        imageData.height
      ) || framedPaperCandidate;
      const frameMargin = Math.max(
        0.2,
        Math.min(0.55, Math.min(imageData.width, imageData.height) * 0.00055)
      );
      return validateScannerDetectedCorners(
        expandScannerCornersFromCenter(
          preciseFrameCandidate,
          frameMargin,
          frameMargin,
          imageData.width,
          imageData.height
        ),
        imageData.width,
        imageData.height
      ) || preciseFrameCandidate;
    }
    const gradientCandidate = detectScannerGradientQuadCorners(imageData);
    const strongestGradientCandidate = detectScannerGradientQuadCorners(imageData, { preferStrongest: true });
    const documentCandidate = detectScannerDocumentSheetCorners(imageData);
    const selectBest = (candidateList) => {
      let bestCorners = null;
      let bestScore = -Infinity;
      candidateList.filter(Boolean).forEach((candidate) => {
        const corners = validateScannerDetectedCorners(candidate, imageData.width, imageData.height);
        if (!corners) return;
        const score = scoreScannerDetectedCorners(imageData, corners);
        if (score < 12) return;
        if (score > bestScore) {
          bestScore = score;
          bestCorners = corners;
        }
      });
      if (!bestCorners) return null;
      const repairedCorners = repairScannerInternalShadowEdges(
        imageData,
        bestCorners,
        strongestGradientCandidate
      );
      // Every detector is deliberately broad enough not to clip the sheet.
      // Give the winning quad one common full-resolution color-gradient pass
      // so bright, dark and colored low-contrast edges land consistently.
      const refined = validateScannerDetectedCorners(
        refineScannerQuadCornersWithGradient(imageData, repairedCorners, { precise: true }),
        imageData.width,
        imageData.height
      );
      if (!refined) return repairedCorners;
      const margin = Math.max(0.2, Math.min(0.55, Math.min(imageData.width, imageData.height) * 0.00055));
      return validateScannerDetectedCorners(
        expandScannerCornersFromCenter(refined, margin, margin, imageData.width, imageData.height),
        imageData.width,
        imageData.height
      ) || refined;
    };
    if (scannerQuadsAgree(
      gradientCandidate,
      documentCandidate,
      imageData.width,
      imageData.height
    )) {
      return selectBest([gradientCandidate, documentCandidate]);
    }

    const blueCandidate = detectScannerBlueBorderCorners(imageData);
    const blueTouchesFrame = scannerQuadTouchesFrame(
      blueCandidate,
      imageData.width,
      imageData.height
    );
    const imageArea = Math.max(1, imageData.width * imageData.height);
    const gradientArea = gradientCandidate ? getScannerPolygonArea(gradientCandidate) / imageArea : 0;
    const documentArea = documentCandidate ? getScannerPolygonArea(documentCandidate) / imageArea : 0;
    const blueArea = blueCandidate ? getScannerPolygonArea(blueCandidate) / imageArea : 0;
    const documentScore = documentCandidate
      ? scoreScannerDetectedCorners(imageData, documentCandidate)
      : -Infinity;
    const gradientLooksLikeOuterSleeve = Boolean(
      gradientCandidate
      && (
        (
          blueCandidate
          && !blueTouchesFrame
          && gradientArea > Math.max(documentArea, blueArea) * 1.2
        )
        || (
          documentCandidate
          && documentScore >= 90
          && documentArea >= 0.24
          && gradientArea > documentArea * 1.18
          && gradientArea - documentArea >= 0.055
        )
      )
    );
    const documentOutranksShadowBoundary = Boolean(
      gradientCandidate
      && documentCandidate
      && documentScore >= 90
      && gradientArea < documentArea * 0.9
    );
    const includeGradient = !gradientLooksLikeOuterSleeve && !documentOutranksShadowBoundary;
    return selectBest([
      documentCandidate,
      detectScannerDarkPaperCorners(imageData),
      blueCandidate,
      detectScannerBrightPaperCorners(imageData),
      includeGradient ? gradientCandidate : null
    ]);
  }

  function detectScannerDarkPaperCorners(imageData) {
    const source = imageData.data;
    const inverted = new Uint8ClampedArray(source.length);
    const inversionGain = 3.2;
    for (let index = 0; index < source.length; index += 4) {
      const luminance = getScannerLuminance(source[index], source[index + 1], source[index + 2]);
      const invertedLuminance = Math.min(255, (255 - luminance) * inversionGain);
      inverted[index] = invertedLuminance;
      inverted[index + 1] = invertedLuminance;
      inverted[index + 2] = invertedLuminance;
      inverted[index + 3] = source[index + 3];
    }
    return detectScannerDocumentSheetCorners({
      width: imageData.width,
      height: imageData.height,
      data: inverted
    });
  }

  function getBilinearPoint(corners, u, v) {
    const topX = corners[0].x + (corners[1].x - corners[0].x) * u;
    const topY = corners[0].y + (corners[1].y - corners[0].y) * u;
    const bottomX = corners[3].x + (corners[2].x - corners[3].x) * u;
    const bottomY = corners[3].y + (corners[2].y - corners[3].y) * u;
    return {
      x: topX + (bottomX - topX) * v,
      y: topY + (bottomY - topY) * v
    };
  }

  function computeScannerQuadHomography(cornersInput, sourceWidth, sourceHeight) {
    if (!Array.isArray(cornersInput) || cornersInput.length !== 4) return null;
    const width = Math.max(1, Number(sourceWidth || 1));
    const height = Math.max(1, Number(sourceHeight || 1));
    const points = cornersInput.map((point) => ({
      x: Number(point.x || 0) / width,
      y: Number(point.y || 0) / height
    }));
    const [p0, p1, p2, p3] = points;
    const dx1 = p1.x - p2.x;
    const dx2 = p3.x - p2.x;
    const dx3 = p0.x - p1.x + p2.x - p3.x;
    const dy1 = p1.y - p2.y;
    const dy2 = p3.y - p2.y;
    const dy3 = p0.y - p1.y + p2.y - p3.y;
    let projectiveX = 0;
    let projectiveY = 0;

    if (Math.abs(dx3) > 0.0000001 || Math.abs(dy3) > 0.0000001) {
      const denominator = dx1 * dy2 - dx2 * dy1;
      if (Math.abs(denominator) < 0.0000001) return null;
      projectiveX = (dx3 * dy2 - dx2 * dy3) / denominator;
      projectiveY = (dx1 * dy3 - dx3 * dy1) / denominator;
    }

    return {
      row0: [p1.x - p0.x + projectiveX * p1.x, p3.x - p0.x + projectiveY * p3.x, p0.x],
      row1: [p1.y - p0.y + projectiveX * p1.y, p3.y - p0.y + projectiveY * p3.y, p0.y],
      row2: [projectiveX, projectiveY, 1]
    };
  }

  function projectScannerHomographyPoint(homography, u, v, sourceWidth, sourceHeight) {
    if (!homography) return null;
    const denominator = homography.row2[0] * u + homography.row2[1] * v + homography.row2[2];
    if (Math.abs(denominator) < 0.0000001) return null;
    return {
      x: (homography.row0[0] * u + homography.row0[1] * v + homography.row0[2]) / denominator * sourceWidth,
      y: (homography.row1[0] * u + homography.row1[1] * v + homography.row1[2]) / denominator * sourceHeight
    };
  }

  function renderScannerPerspectiveWithWebGL(sourceCanvas, cornersInput, outputWidth, outputHeight, reductionScale = 1) {
    const homography = computeScannerQuadHomography(cornersInput, sourceCanvas.width, sourceCanvas.height);
    if (!homography) return null;

    const webglCanvas = createCanvas(outputWidth, outputHeight);
    let gl = null;
    let program = null;
    let vertexShader = null;
    let fragmentShader = null;
    let positionBuffer = null;
    let texture = null;

    try {
      const contextOptions = {
        alpha: false,
        antialias: false,
        depth: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
        stencil: false
      };
      gl = webglCanvas.getContext('webgl', contextOptions)
        || webglCanvas.getContext('experimental-webgl', contextOptions);
      if (!gl) return null;
      const maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0);
      const maxViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      if (
        (maxTextureSize && (sourceCanvas.width > maxTextureSize || sourceCanvas.height > maxTextureSize))
        || (maxViewport && (outputWidth > maxViewport[0] || outputHeight > maxViewport[1]))
        || gl.drawingBufferWidth !== outputWidth
        || gl.drawingBufferHeight !== outputHeight
      ) {
        return null;
      }

      const compileShader = (type, source) => {
        const shader = gl.createShader(type);
        if (!shader) throw new Error('scanner shader unavailable');
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          gl.deleteShader(shader);
          throw new Error('scanner shader compilation failed');
        }
        return shader;
      };

      vertexShader = compileShader(gl.VERTEX_SHADER, [
        'attribute vec2 a_position;',
        'varying vec2 v_output;',
        'void main() {',
        '  v_output = a_position * 0.5 + 0.5;',
        '  gl_Position = vec4(a_position, 0.0, 1.0);',
        '}'
      ].join('\n'));
      fragmentShader = compileShader(gl.FRAGMENT_SHADER, [
        'precision highp float;',
        'uniform sampler2D u_image;',
        'uniform vec3 u_h0;',
        'uniform vec3 u_h1;',
        'uniform vec3 u_h2;',
        'uniform vec2 u_texelStep;',
        'uniform float u_prefilter;',
        'varying vec2 v_output;',
        'void main() {',
        '  vec3 destination = vec3(v_output.x, 1.0 - v_output.y, 1.0);',
        '  vec3 projected = vec3(',
        '    dot(u_h0, destination),',
        '    dot(u_h1, destination),',
        '    dot(u_h2, destination)',
        '  );',
        '  if (abs(projected.z) < 0.000001) {',
        '    gl_FragColor = vec4(1.0);',
        '    return;',
        '  }',
        '  vec2 source = clamp(projected.xy / projected.z, 0.0, 1.0);',
        '  vec4 center = texture2D(u_image, source);',
        '  if (u_prefilter <= 0.001) {',
        '    gl_FragColor = center;',
        '    return;',
        '  }',
        '  vec4 filtered = center * 4.0;',
        '  filtered += texture2D(u_image, clamp(source + vec2(-u_texelStep.x, 0.0), 0.0, 1.0)) * 2.0;',
        '  filtered += texture2D(u_image, clamp(source + vec2( u_texelStep.x, 0.0), 0.0, 1.0)) * 2.0;',
        '  filtered += texture2D(u_image, clamp(source + vec2(0.0, -u_texelStep.y), 0.0, 1.0)) * 2.0;',
        '  filtered += texture2D(u_image, clamp(source + vec2(0.0,  u_texelStep.y), 0.0, 1.0)) * 2.0;',
        '  filtered += texture2D(u_image, clamp(source + vec2(-u_texelStep.x, -u_texelStep.y), 0.0, 1.0));',
        '  filtered += texture2D(u_image, clamp(source + vec2( u_texelStep.x, -u_texelStep.y), 0.0, 1.0));',
        '  filtered += texture2D(u_image, clamp(source + vec2(-u_texelStep.x,  u_texelStep.y), 0.0, 1.0));',
        '  filtered += texture2D(u_image, clamp(source + vec2( u_texelStep.x,  u_texelStep.y), 0.0, 1.0));',
        '  gl_FragColor = mix(center, filtered / 16.0, u_prefilter);',
        '}'
      ].join('\n'));

      program = gl.createProgram();
      if (!program) return null;
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
      gl.useProgram(program);

      positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        1, 1
      ]), gl.STATIC_DRAW);
      const positionLocation = gl.getAttribLocation(program, 'a_position');
      if (positionLocation < 0) return null;
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
      if (gl.getError() !== gl.NO_ERROR) return null;
      gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
      gl.uniform3fv(gl.getUniformLocation(program, 'u_h0'), new Float32Array(homography.row0));
      gl.uniform3fv(gl.getUniformLocation(program, 'u_h1'), new Float32Array(homography.row1));
      gl.uniform3fv(gl.getUniformLocation(program, 'u_h2'), new Float32Array(homography.row2));
      gl.uniform2f(
        gl.getUniformLocation(program, 'u_texelStep'),
        1 / Math.max(1, sourceCanvas.width),
        1 / Math.max(1, sourceCanvas.height)
      );
      const prefilterStrength = Math.max(0, Math.min(1, (0.92 - Number(reductionScale || 1)) / 0.25));
      gl.uniform1f(gl.getUniformLocation(program, 'u_prefilter'), prefilterStrength);
      gl.viewport(0, 0, webglCanvas.width, webglCanvas.height);
      gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (gl.getError() !== gl.NO_ERROR) return null;
      gl.flush();

      const output = createCanvas(outputWidth, outputHeight);
      const outputContext = output.getContext('2d', { alpha: false });
      outputContext.drawImage(webglCanvas, 0, 0);
      return output;
    } catch (_) {
      return null;
    } finally {
      if (gl) {
        if (texture) gl.deleteTexture(texture);
        if (positionBuffer) gl.deleteBuffer(positionBuffer);
        if (program) gl.deleteProgram(program);
        if (vertexShader) gl.deleteShader(vertexShader);
        if (fragmentShader) gl.deleteShader(fragmentShader);
        const loseContext = gl.getExtension && gl.getExtension('WEBGL_lose_context');
        if (loseContext && loseContext.loseContext) loseContext.loseContext();
      }
    }
  }

  function expandScannerTriangleForOverlap(points, padding = 1.5) {
    const center = points.reduce((acc, point) => ({
      x: acc.x + point.x / points.length,
      y: acc.y + point.y / points.length
    }), { x: 0, y: 0 });
    return points.map((point) => {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      const length = Math.max(0.0001, Math.sqrt(dx * dx + dy * dy));
      const scale = (length + padding) / length;
      return { x: center.x + dx * scale, y: center.y + dy * scale };
    });
  }

  function drawImageTriangle(ctx, sourceCanvas, s0, s1, s2, d0, d1, d2) {
    const denominator = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
    if (!denominator) return;
    const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denominator;
    const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denominator;
    const e = (d0.x * (s1.x * s2.y - s2.x * s1.y) + d1.x * (s2.x * s0.y - s0.x * s2.y) + d2.x * (s0.x * s1.y - s1.x * s0.y)) / denominator;
    const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denominator;
    const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denominator;
    const f = (d0.y * (s1.x * s2.y - s2.x * s1.y) + d1.y * (s2.x * s0.y - s0.x * s2.y) + d2.y * (s0.x * s1.y - s1.x * s0.y)) / denominator;
    const clipPoints = expandScannerTriangleForOverlap([d0, d1, d2]);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(clipPoints[0].x, clipPoints[0].y);
    ctx.lineTo(clipPoints[1].x, clipPoints[1].y);
    ctx.lineTo(clipPoints[2].x, clipPoints[2].y);
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(a, b, c, d, e, f);
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.restore();
  }

  function applyPerspectiveCorrection(sourceCanvas, cornersInput, options = {}) {
    const corners = cloneScannerCorners(cornersInput);
    if (corners.length !== 4) {
      const fallback = createCanvas(sourceCanvas.width, sourceCanvas.height);
      fallback.getContext('2d').drawImage(sourceCanvas, 0, 0);
      return fallback;
    }
    const rawWidth = Math.max(distanceBetweenPoints(corners[0], corners[1]), distanceBetweenPoints(corners[3], corners[2]), 80);
    const rawHeight = Math.max(distanceBetweenPoints(corners[0], corners[3]), distanceBetweenPoints(corners[1], corners[2]), 80);
    const maxOutputEdge = Math.max(240, Number(options.maxEdge || 2200));
    const scale = Math.min(1, maxOutputEdge / Math.max(rawWidth, rawHeight));
    const outputWidth = Math.max(1, Math.round(rawWidth * scale));
    const outputHeight = Math.max(1, Math.round(rawHeight * scale));
    const projectiveOutput = renderScannerPerspectiveWithWebGL(
      sourceCanvas,
      corners,
      outputWidth,
      outputHeight,
      scale
    );
    if (projectiveOutput) return projectiveOutput;

    const output = createCanvas(outputWidth, outputHeight);
    const ctx = output.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = options.fast ? 'medium' : 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, output.width, output.height);
    let fallbackSourceCanvas = sourceCanvas;
    let fallbackCorners = corners;
    if (scale < 0.92) {
      // Canvas triangle warping otherwise samples the full-resolution texture
      // directly into a much smaller result. That aliases a security-paper
      // carrier into wide bands before the document filter can see it. Match
      // the WebGL path with an antialiased reduction and remap the crop quad.
      const reducedWidth = Math.max(1, Math.round(sourceCanvas.width * scale));
      const reducedHeight = Math.max(1, Math.round(sourceCanvas.height * scale));
      fallbackSourceCanvas = createCanvas(reducedWidth, reducedHeight);
      const reducedContext = fallbackSourceCanvas.getContext('2d', { alpha: false });
      reducedContext.fillStyle = '#ffffff';
      reducedContext.fillRect(0, 0, reducedWidth, reducedHeight);
      drawScannerImageWithProgressiveReduction(
        reducedContext,
        sourceCanvas,
        reducedWidth,
        reducedHeight
      );
      const scaleX = reducedWidth / Math.max(1, sourceCanvas.width);
      const scaleY = reducedHeight / Math.max(1, sourceCanvas.height);
      fallbackCorners = corners.map((point) => ({
        x: point.x * scaleX,
        y: point.y * scaleY
      }));
    }
    const fallbackHomography = computeScannerQuadHomography(
      fallbackCorners,
      fallbackSourceCanvas.width,
      fallbackSourceCanvas.height
    );
    const getSourcePoint = (u, v) => (
      projectScannerHomographyPoint(
        fallbackHomography,
        u,
        v,
        fallbackSourceCanvas.width,
        fallbackSourceCanvas.height
      )
      || getBilinearPoint(fallbackCorners, u, v)
    );
    const steps = Math.max(4, Math.min(24, Math.round(Number(options.steps || 18))));
    for (let y = 0; y < steps; y += 1) {
      const v0 = y / steps;
      const v1 = (y + 1) / steps;
      const dy0 = output.height * v0;
      const dy1 = output.height * v1;
      for (let x = 0; x < steps; x += 1) {
        const u0 = x / steps;
        const u1 = (x + 1) / steps;
        const dx0 = output.width * u0;
        const dx1 = output.width * u1;
        const s00 = getSourcePoint(u0, v0);
        const s10 = getSourcePoint(u1, v0);
        const s11 = getSourcePoint(u1, v1);
        const s01 = getSourcePoint(u0, v1);
        const d00 = { x: dx0, y: dy0 };
        const d10 = { x: dx1, y: dy0 };
        const d11 = { x: dx1, y: dy1 };
        const d01 = { x: dx0, y: dy1 };
        drawImageTriangle(ctx, fallbackSourceCanvas, s00, s10, s11, d00, d10, d11);
        drawImageTriangle(ctx, fallbackSourceCanvas, s00, s11, s01, d00, d11, d01);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return output;
  }

  function clampByte(value) {
    return Math.max(0, Math.min(255, Number(value) || 0));
  }

  function getScannerContrastFactor(contrast) {
    const safeContrast = Math.max(-254, Math.min(254, Number(contrast || 0)));
    return (259 * (safeContrast + 255)) / (255 * (259 - safeContrast));
  }

  function getScannerLuminance(r, g, b) {
    return Number(r || 0) * 0.299 + Number(g || 0) * 0.587 + Number(b || 0) * 0.114;
  }

  function buildScannerBackgroundField(imageData, options = {}) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const cellSize = Number(options.cellSize) || Math.max(18, Math.min(72, Math.round(Math.max(width, height) / 34)));
    const smoothingPasses = Number.isFinite(options.smoothingPasses) ? options.smoothingPasses : 3;
    const sampleStep = Math.max(1, Math.round(cellSize / 10));
    const gridW = Math.max(1, Math.ceil(width / cellSize));
    const gridH = Math.max(1, Math.ceil(height / cellSize));
    const cellCount = gridW * gridH;
    let values = new Float32Array(cellCount * 3);
    const valid = new Uint8Array(cellCount);
    const channelSamples = [[], [], []];

    for (let gy = 0; gy < gridH; gy += 1) {
      const y0 = gy * cellSize;
      const y1 = Math.min(height, y0 + cellSize);
      for (let gx = 0; gx < gridW; gx += 1) {
        const x0 = gx * cellSize;
        const x1 = Math.min(width, x0 + cellSize);
        let maxLum = 0;

        for (let y = y0; y < y1; y += sampleStep) {
          for (let x = x0; x < x1; x += sampleStep) {
            const index = (y * width + x) * 4;
            const lum = getScannerLuminance(data[index], data[index + 1], data[index + 2]);
            if (lum > maxLum) maxLum = lum;
          }
        }

        // Only bright, unsaturated pixels count as bare paper. Cells with no
        // bare paper at all (stamp interiors, photos, leaked background) stay
        // invalid and inherit the surrounding paper estimate below, so their
        // own content is never used as its own "background" and erased.
        // Estimate paper from only the brightest neutral samples in a cell.
        // A broad cutoff treated faded stamps and pencil as illumination and
        // normalized them away, especially in densely printed areas.
        const cutoff = Math.max(104, maxLum - 18);
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let count = 0;
        for (let y = y0; y < y1; y += sampleStep) {
          for (let x = x0; x < x1; x += sampleStep) {
            const index = (y * width + x) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            if (getScannerLuminance(r, g, b) >= cutoff && getScannerSaturation(r, g, b) < 52) {
              sumR += r;
              sumG += g;
              sumB += b;
              count += 1;
            }
          }
        }

        const cellIndex = gy * gridW + gx;
        if (count) {
          valid[cellIndex] = 1;
          values[cellIndex] = sumR / count;
          values[cellCount + cellIndex] = sumG / count;
          values[cellCount * 2 + cellIndex] = sumB / count;
          channelSamples[0].push(values[cellIndex]);
          channelSamples[1].push(values[cellCount + cellIndex]);
          channelSamples[2].push(values[cellCount * 2 + cellIndex]);
        }
      }
    }

    const fallback = [238, 238, 238];
    for (let channel = 0; channel < 3; channel += 1) {
      if (channelSamples[channel].length) {
        const sorted = channelSamples[channel].sort((a, b) => a - b);
        fallback[channel] = sorted[Math.floor(sorted.length / 2)];
      }
    }

    // A cell fully covered by a faded seal can still have a relatively bright
    // maximum and masquerade as paper. Illumination changes are spatially
    // broad; a darker or more colorful local cell among mostly paper cells is
    // document detail, so invalidate it and let the surrounding field fill it.
    const detailCandidates = new Uint8Array(cellCount);
    for (let gy = 0; gy < gridH; gy += 1) {
      for (let gx = 0; gx < gridW; gx += 1) {
        const cellIndex = gy * gridW + gx;
        if (!valid[cellIndex]) continue;
        const neighborLuminances = [];
        const neighborSaturations = [];
        for (let oy = -2; oy <= 2; oy += 1) {
          const sy = gy + oy;
          if (sy < 0 || sy >= gridH) continue;
          for (let ox = -2; ox <= 2; ox += 1) {
            const sx = gx + ox;
            if (sx < 0 || sx >= gridW || (ox === 0 && oy === 0)) continue;
            const neighborIndex = sy * gridW + sx;
            if (!valid[neighborIndex]) continue;
            const r = values[neighborIndex];
            const g = values[cellCount + neighborIndex];
            const b = values[cellCount * 2 + neighborIndex];
            neighborLuminances.push(getScannerLuminance(r, g, b));
            neighborSaturations.push(getScannerSaturation(r, g, b));
          }
        }
        if (neighborLuminances.length < 8) continue;
        neighborLuminances.sort((a, b) => a - b);
        neighborSaturations.sort((a, b) => a - b);
        const localPaperLum = neighborLuminances[Math.floor(neighborLuminances.length * 0.68)];
        const localPaperSaturation = neighborSaturations[Math.floor(neighborSaturations.length * 0.5)];
        const currentR = values[cellIndex];
        const currentG = values[cellCount + cellIndex];
        const currentB = values[cellCount * 2 + cellIndex];
        const currentLum = getScannerLuminance(currentR, currentG, currentB);
        const currentSaturation = getScannerSaturation(currentR, currentG, currentB);
        if (
          currentLum < localPaperLum - 12
          || currentSaturation > localPaperSaturation + 16
        ) {
          detailCandidates[cellIndex] = 1;
        }
      }
    }
    const protectedValid = valid.slice();
    const candidateVisited = new Uint8Array(cellCount);
    for (let start = 0; start < cellCount; start += 1) {
      if (!detailCandidates[start] || candidateVisited[start]) continue;
      const component = [];
      const stack = [start];
      candidateVisited[start] = 1;
      let minGX = gridW;
      let maxGX = -1;
      let minGY = gridH;
      let maxGY = -1;
      while (stack.length) {
        const cellIndex = stack.pop();
        component.push(cellIndex);
        const gx = cellIndex % gridW;
        const gy = (cellIndex - gx) / gridW;
        minGX = Math.min(minGX, gx);
        maxGX = Math.max(maxGX, gx);
        minGY = Math.min(minGY, gy);
        maxGY = Math.max(maxGY, gy);
        const neighbors = [];
        if (gx > 0) neighbors.push(cellIndex - 1);
        if (gx < gridW - 1) neighbors.push(cellIndex + 1);
        if (gy > 0) neighbors.push(cellIndex - gridW);
        if (gy < gridH - 1) neighbors.push(cellIndex + gridW);
        neighbors.forEach((neighborIndex) => {
          if (!detailCandidates[neighborIndex] || candidateVisited[neighborIndex]) return;
          candidateVisited[neighborIndex] = 1;
          stack.push(neighborIndex);
        });
      }
      const touchesFieldEdge = minGX === 0 || minGY === 0 || maxGX === gridW - 1 || maxGY === gridH - 1;
      const spansField = maxGX - minGX + 1 >= gridW * 0.45 || maxGY - minGY + 1 >= gridH * 0.45;
      const broadIlluminationRegion = component.length >= Math.max(6, cellCount * 0.06)
        && (touchesFieldEdge || spansField);
      if (!broadIlluminationRegion) {
        component.forEach((cellIndex) => { protectedValid[cellIndex] = 0; });
      }
    }
    valid.set(protectedValid);

    for (let pass = 0; pass < 8; pass += 1) {
      let holes = 0;
      const grown = valid.slice();
      for (let gy = 0; gy < gridH; gy += 1) {
        for (let gx = 0; gx < gridW; gx += 1) {
          const cellIndex = gy * gridW + gx;
          if (valid[cellIndex]) continue;
          let sumR = 0;
          let sumG = 0;
          let sumB = 0;
          let count = 0;
          if (gx > 0 && valid[cellIndex - 1]) {
            sumR += values[cellIndex - 1];
            sumG += values[cellCount + cellIndex - 1];
            sumB += values[cellCount * 2 + cellIndex - 1];
            count += 1;
          }
          if (gx < gridW - 1 && valid[cellIndex + 1]) {
            sumR += values[cellIndex + 1];
            sumG += values[cellCount + cellIndex + 1];
            sumB += values[cellCount * 2 + cellIndex + 1];
            count += 1;
          }
          if (gy > 0 && valid[cellIndex - gridW]) {
            sumR += values[cellIndex - gridW];
            sumG += values[cellCount + cellIndex - gridW];
            sumB += values[cellCount * 2 + cellIndex - gridW];
            count += 1;
          }
          if (gy < gridH - 1 && valid[cellIndex + gridW]) {
            sumR += values[cellIndex + gridW];
            sumG += values[cellCount + cellIndex + gridW];
            sumB += values[cellCount * 2 + cellIndex + gridW];
            count += 1;
          }
          if (count) {
            grown[cellIndex] = 1;
            values[cellIndex] = sumR / count;
            values[cellCount + cellIndex] = sumG / count;
            values[cellCount * 2 + cellIndex] = sumB / count;
          } else {
            holes += 1;
          }
        }
      }
      valid.set(grown);
      if (!holes) break;
    }
    for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
      if (valid[cellIndex]) continue;
      values[cellIndex] = fallback[0];
      values[cellCount + cellIndex] = fallback[1];
      values[cellCount * 2 + cellIndex] = fallback[2];
    }

    for (let pass = 0; pass < smoothingPasses; pass += 1) {
      const smoothed = new Float32Array(values.length);
      for (let channel = 0; channel < 3; channel += 1) {
        const base = channel * cellCount;
        for (let gy = 0; gy < gridH; gy += 1) {
          for (let gx = 0; gx < gridW; gx += 1) {
            let sum = 0;
            let weight = 0;
            for (let oy = -1; oy <= 1; oy += 1) {
              const sy = gy + oy;
              if (sy < 0 || sy >= gridH) continue;
              for (let ox = -1; ox <= 1; ox += 1) {
                const sx = gx + ox;
                if (sx < 0 || sx >= gridW) continue;
                const currentWeight = ox === 0 && oy === 0 ? 3 : 1;
                sum += values[base + sy * gridW + sx] * currentWeight;
                weight += currentWeight;
              }
            }
            smoothed[base + gy * gridW + gx] = sum / Math.max(1, weight);
          }
        }
      }
      values = smoothed;
    }

    return { cellSize, gridW, gridH, cellCount, values };
  }

  function sampleScannerBackgroundField(field, x, y, channel) {
    if (!field || !field.values || !field.values.length) return 238;
    const base = (channel || 0) * field.cellCount;
    const gx = Math.max(0, Math.min(field.gridW - 1, x / field.cellSize));
    const gy = Math.max(0, Math.min(field.gridH - 1, y / field.cellSize));
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = Math.min(field.gridW - 1, x0 + 1);
    const y1 = Math.min(field.gridH - 1, y0 + 1);
    const tx = gx - x0;
    const ty = gy - y0;
    const top = field.values[base + y0 * field.gridW + x0] * (1 - tx) + field.values[base + y0 * field.gridW + x1] * tx;
    const bottom = field.values[base + y1 * field.gridW + x0] * (1 - tx) + field.values[base + y1 * field.gridW + x1] * tx;
    return top * (1 - ty) + bottom * ty;
  }

  function fillScannerBackgroundRow(field, y, redRow, greenRow, blueRow) {
    const width = redRow.length;
    if (!field.x0Lookup || field.x0Lookup.length !== width) {
      field.x0Lookup = new Uint32Array(width);
      field.xBlendLookup = new Float32Array(width);
      for (let x = 0; x < width; x += 1) {
        const gx = Math.max(0, Math.min(field.gridW - 1, x / field.cellSize));
        field.x0Lookup[x] = Math.floor(gx);
        field.xBlendLookup[x] = gx - field.x0Lookup[x];
      }
    }
    const gy = Math.max(0, Math.min(field.gridH - 1, y / field.cellSize));
    const y0 = Math.floor(gy);
    const y1 = Math.min(field.gridH - 1, y0 + 1);
    const ty = gy - y0;
    const inverseTy = 1 - ty;
    const row0 = y0 * field.gridW;
    const row1 = y1 * field.gridW;
    const greenBase = field.cellCount;
    const blueBase = field.cellCount * 2;
    for (let x = 0; x < width; x += 1) {
      const x0 = field.x0Lookup[x];
      const x1 = Math.min(field.gridW - 1, x0 + 1);
      const tx = field.xBlendLookup[x];
      const inverseTx = 1 - tx;
      const topLeft = row0 + x0;
      const topRight = row0 + x1;
      const bottomLeft = row1 + x0;
      const bottomRight = row1 + x1;
      redRow[x] = (
        field.values[topLeft] * inverseTx + field.values[topRight] * tx
      ) * inverseTy + (
        field.values[bottomLeft] * inverseTx + field.values[bottomRight] * tx
      ) * ty;
      greenRow[x] = (
        field.values[greenBase + topLeft] * inverseTx + field.values[greenBase + topRight] * tx
      ) * inverseTy + (
        field.values[greenBase + bottomLeft] * inverseTx + field.values[greenBase + bottomRight] * tx
      ) * ty;
      blueRow[x] = (
        field.values[blueBase + topLeft] * inverseTx + field.values[blueBase + topRight] * tx
      ) * inverseTy + (
        field.values[blueBase + bottomLeft] * inverseTx + field.values[blueBase + bottomRight] * tx
      ) * ty;
    }
  }

  function applyScannerMorphologyHorizontal(source, width, height, radius, useMaximum) {
    const output = new Float32Array(source.length);
    const deque = new Int32Array(width);
    const windowRadius = Math.max(1, Math.round(radius));
    for (let y = 0; y < height; y += 1) {
      const rowOffset = y * width;
      let head = 0;
      let tail = 0;
      for (let scan = 0; scan < width + windowRadius; scan += 1) {
        if (scan < width) {
          const value = source[rowOffset + scan];
          while (tail > head) {
            const previousValue = source[rowOffset + deque[tail - 1]];
            if (useMaximum ? previousValue > value : previousValue < value) break;
            tail -= 1;
          }
          deque[tail] = scan;
          tail += 1;
        }
        const windowStart = scan - windowRadius * 2;
        while (tail > head && deque[head] < windowStart) head += 1;
        const outputX = scan - windowRadius;
        if (outputX >= 0 && outputX < width && tail > head) {
          output[rowOffset + outputX] = source[rowOffset + deque[head]];
        }
      }
    }
    return output;
  }

  function applyScannerMorphologyVertical(source, width, height, radius, useMaximum) {
    const output = new Float32Array(source.length);
    const deque = new Int32Array(height);
    const windowRadius = Math.max(1, Math.round(radius));
    for (let x = 0; x < width; x += 1) {
      let head = 0;
      let tail = 0;
      for (let scan = 0; scan < height + windowRadius; scan += 1) {
        if (scan < height) {
          const value = source[scan * width + x];
          while (tail > head) {
            const previousValue = source[deque[tail - 1] * width + x];
            if (useMaximum ? previousValue > value : previousValue < value) break;
            tail -= 1;
          }
          deque[tail] = scan;
          tail += 1;
        }
        const windowStart = scan - windowRadius * 2;
        while (tail > head && deque[head] < windowStart) head += 1;
        const outputY = scan - windowRadius;
        if (outputY >= 0 && outputY < height && tail > head) {
          output[outputY * width + x] = source[deque[head] * width + x];
        }
      }
    }
    return output;
  }

  function buildScannerMorphologicalLuminanceField(imageData, coarseField) {
    const sourceWidth = imageData.width;
    const sourceHeight = imageData.height;
    const data = imageData.data;
    const thumbnailScale = Math.min(1, 640 / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(24, Math.round(sourceWidth * thumbnailScale));
    const height = Math.max(24, Math.round(sourceHeight * thumbnailScale));
    const values = new Float32Array(width * height);

    for (let y = 0; y < height; y += 1) {
      const sourceY = Math.max(0, Math.min(sourceHeight - 1, Math.round((y + 0.5) * sourceHeight / height - 0.5)));
      for (let x = 0; x < width; x += 1) {
        const sourceX = Math.max(0, Math.min(sourceWidth - 1, Math.round((x + 0.5) * sourceWidth / width - 0.5)));
        const index = (sourceY * sourceWidth + sourceX) * 4;
        const backgroundR = Math.max(48, sampleScannerBackgroundField(coarseField, sourceX, sourceY, 0));
        const backgroundG = Math.max(48, sampleScannerBackgroundField(coarseField, sourceX, sourceY, 1));
        const backgroundB = Math.max(48, sampleScannerBackgroundField(coarseField, sourceX, sourceY, 2));
        const backgroundLum = getScannerLuminance(backgroundR, backgroundG, backgroundB);
        const correctedR = data[index] * Math.max(0.72, Math.min(1.4, backgroundLum / backgroundR));
        const correctedG = data[index + 1] * Math.max(0.72, Math.min(1.4, backgroundLum / backgroundG));
        const correctedB = data[index + 2] * Math.max(0.72, Math.min(1.4, backgroundLum / backgroundB));
        values[y * width + x] = getScannerLuminance(correctedR, correctedG, correctedB);
      }
    }

    // Grayscale closing fills dark text, stamps and folds in the illumination
    // estimate while retaining broad, even abrupt, page shadows.
    const radius = Math.max(4, Math.round(Math.min(width, height) * 0.035));
    const dilatedHorizontal = applyScannerMorphologyHorizontal(values, width, height, radius, true);
    const dilated = applyScannerMorphologyVertical(dilatedHorizontal, width, height, radius, true);
    const erodedHorizontal = applyScannerMorphologyHorizontal(dilated, width, height, radius, false);
    const closed = applyScannerMorphologyVertical(erodedHorizontal, width, height, radius, false);
    return { width, height, sourceWidth, sourceHeight, values: closed };
  }

  function fillScannerMorphologicalLuminanceRow(field, y, outputRow) {
    const outputWidth = outputRow.length;
    if (!field.x0Lookup || field.x0Lookup.length !== outputWidth) {
      field.x0Lookup = new Uint32Array(outputWidth);
      field.xBlendLookup = new Float32Array(outputWidth);
      for (let x = 0; x < outputWidth; x += 1) {
        const gx = outputWidth > 1 ? x * (field.width - 1) / (outputWidth - 1) : 0;
        field.x0Lookup[x] = Math.floor(gx);
        field.xBlendLookup[x] = gx - field.x0Lookup[x];
      }
    }
    const gy = field.sourceHeight > 1 ? y * (field.height - 1) / (field.sourceHeight - 1) : 0;
    const y0 = Math.max(0, Math.min(field.height - 1, Math.floor(gy)));
    const y1 = Math.min(field.height - 1, y0 + 1);
    const ty = gy - y0;
    const inverseTy = 1 - ty;
    for (let x = 0; x < outputWidth; x += 1) {
      const x0 = field.x0Lookup[x];
      const x1 = Math.min(field.width - 1, x0 + 1);
      const tx = field.xBlendLookup[x];
      const inverseTx = 1 - tx;
      const top = field.values[y0 * field.width + x0] * inverseTx
        + field.values[y0 * field.width + x1] * tx;
      const bottom = field.values[y1 * field.width + x0] * inverseTx
        + field.values[y1 * field.width + x1] * tx;
      outputRow[x] = top * inverseTy + bottom * ty;
    }
  }

  function whitenScannerEdgeArtifacts(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    if (width < 48 || height < 48) return imageData;

    // Old scans often contain a second, inset black frame behind genuine white
    // paper padding. A border flood cannot reach that frame safely: increasing
    // its depth also floods into any text or seal touching the edge. Detect
    // only rough, thick ribbons that run parallel to an outer edge. The final
    // mask contains the dark ribbon pixels themselves, never a rectangular
    // strip or a whole connected component.
    const shortSide = Math.min(width, height);
    const maximumInset = Math.max(12, Math.min(256, Math.round(shortSide * 0.07)));
    const minimumRibbonThickness = Math.max(3, Math.round(shortSide * 0.0055));
    const maximumRibbonStart = Math.max(4, Math.round(shortSide * 0.042));
    const removalMask = new Uint8Array(width * height);
    const hardProtectionMask = new Uint8Array(width * height);
    const joinedContentFieldMask = new Uint8Array(width * height);

    const isNeutralBelow = (pixelIndex, maximumLuminance, maximumSaturation) => {
      const dataIndex = pixelIndex * 4;
      const red = data[dataIndex];
      const green = data[dataIndex + 1];
      const blue = data[dataIndex + 2];
      const luminance = getScannerLuminance(red, green, blue);
      if (luminance > maximumLuminance) return false;
      return getScannerSaturation(red, green, blue) <= maximumSaturation;
    };
    const isRibbonCore = (pixelIndex) => isNeutralBelow(pixelIndex, 155, 32);
    const isRibbonResidue = (pixelIndex) => isNeutralBelow(pixelIndex, 190, 36);
    const isContinuingContent = (pixelIndex) => {
      const dataIndex = pixelIndex * 4;
      return getScannerLuminance(
        data[dataIndex],
        data[dataIndex + 1],
        data[dataIndex + 2]
      ) <= 215;
    };

    const buildRuns = (flags, maximumGap) => {
      const runs = [];
      let start = -1;
      let last = -1;
      let count = 0;
      let gap = 0;
      for (let index = 0; index <= flags.length; index += 1) {
        const active = index < flags.length && flags[index];
        if (active) {
          if (start < 0) start = index;
          last = index;
          count += 1;
          gap = 0;
          continue;
        }
        if (start < 0) continue;
        gap += 1;
        if (index < flags.length && gap <= maximumGap) continue;
        runs.push({ start, end: last, count });
        start = -1;
        last = -1;
        count = 0;
        gap = 0;
      }
      return runs;
    };

    const percentile = (values, ratio) => {
      if (!values.length) return 0;
      const sorted = values.slice().sort((a, b) => a - b);
      return sorted[Math.max(
        0,
        Math.min(sorted.length - 1, Math.round((sorted.length - 1) * ratio))
      )];
    };

    const edgeDefinitions = [
      { name: 'top', horizontal: true, reverse: false },
      { name: 'bottom', horizontal: true, reverse: true },
      { name: 'left', horizontal: false, reverse: false },
      { name: 'right', horizontal: false, reverse: true }
    ];

    const getEdgePixelIndex = (edge, along, depth) => {
      if (edge.horizontal) {
        const y = edge.reverse ? height - 1 - depth : depth;
        return y * width + along;
      }
      const x = edge.reverse ? width - 1 - depth : depth;
      return along * width + x;
    };

    const getRibbonBox = (edge, bandStart, bandEnd, alongStart, alongEnd) => {
      if (edge.name === 'top') {
        return { left: alongStart, right: alongEnd, top: bandStart, bottom: bandEnd };
      }
      if (edge.name === 'bottom') {
        return {
          left: alongStart,
          right: alongEnd,
          top: height - 1 - bandEnd,
          bottom: height - 1 - bandStart
        };
      }
      if (edge.name === 'left') {
        return { left: bandStart, right: bandEnd, top: alongStart, bottom: alongEnd };
      }
      return {
        left: width - 1 - bandEnd,
        right: width - 1 - bandStart,
        top: alongStart,
        bottom: alongEnd
      };
    };

    const collectEdgeRibbons = (edge) => {
      const longLength = edge.horizontal ? width : height;
      const depthLength = Math.min(maximumInset, edge.horizontal ? height : width);
      const coreMask = new Uint8Array(longLength * depthLength);
      const depthCoverage = new Uint32Array(depthLength);
      for (let depth = 0; depth < depthLength; depth += 1) {
        const maskOffset = depth * longLength;
        let coverage = 0;
        for (let along = 0; along < longLength; along += 1) {
          if (!isRibbonCore(getEdgePixelIndex(edge, along, depth))) continue;
          coreMask[maskOffset + along] = 1;
          coverage += 1;
        }
        depthCoverage[depth] = coverage;
      }

      const smoothedCoverage = new Float32Array(depthLength);
      const activeDepths = new Uint8Array(depthLength);
      const minimumDepthCoverage = Math.max(8, Math.round(longLength * 0.025));
      for (let depth = 0; depth < depthLength; depth += 1) {
        const previous = depthCoverage[Math.max(0, depth - 1)];
        const current = depthCoverage[depth];
        const next = depthCoverage[Math.min(depthLength - 1, depth + 1)];
        smoothedCoverage[depth] = (previous + current * 2 + next) / 4;
        if (smoothedCoverage[depth] >= minimumDepthCoverage) activeDepths[depth] = 1;
      }

      const depthGap = Math.max(1, Math.round(shortSide * 0.0015));
      const depthRuns = buildRuns(activeDepths, depthGap);
      const ribbons = [];
      depthRuns.forEach((depthRun) => {
        const bandStart = depthRun.start;
        const bandEnd = depthRun.end;
        const bandThickness = bandEnd - bandStart + 1;
        if (
          bandStart > maximumRibbonStart
          || bandThickness < minimumRibbonThickness
        ) return;

        let peakCoverage = 0;
        for (let depth = bandStart; depth <= bandEnd; depth += 1) {
          peakCoverage = Math.max(peakCoverage, smoothedCoverage[depth]);
        }
        if (peakCoverage < longLength * 0.07) return;

        const rayThicknesses = new Uint16Array(longLength);
        for (let depth = bandStart; depth <= bandEnd; depth += 1) {
          const maskOffset = depth * longLength;
          for (let along = 0; along < longLength; along += 1) {
            rayThicknesses[along] += coreMask[maskOffset + along];
          }
        }
        const strongRays = new Uint8Array(longLength);
        const minimumRayThickness = Math.max(2, Math.round(minimumRibbonThickness * 0.55));
        for (let along = 0; along < longLength; along += 1) {
          if (rayThicknesses[along] >= minimumRayThickness) strongRays[along] = 1;
        }

        const alongGap = Math.max(3, Math.round(longLength * 0.006));
        const minimumBaseSpan = Math.max(18, Math.round(longLength * 0.06));
        buildRuns(strongRays, alongGap).forEach((alongRun) => {
          const span = alongRun.end - alongRun.start + 1;
          if (span < minimumBaseSpan || alongRun.count / span < 0.38) return;
          const localDepthCoverage = new Uint32Array(bandThickness);
          const localActiveDepths = new Uint8Array(bandThickness);
          for (let depth = bandStart; depth <= bandEnd; depth += 1) {
            const maskOffset = depth * longLength;
            let coverage = 0;
            for (let along = alongRun.start; along <= alongRun.end; along += 1) {
              coverage += coreMask[maskOffset + along];
            }
            const localDepth = depth - bandStart;
            localDepthCoverage[localDepth] = coverage;
            if (coverage >= span * 0.18) localActiveDepths[localDepth] = 1;
          }
          const localDepthRun = buildRuns(localActiveDepths, depthGap).find((run) => {
            if (run.end - run.start + 1 < minimumRibbonThickness) return false;
            let peak = 0;
            let denseDepths = 0;
            for (let localDepth = run.start; localDepth <= run.end; localDepth += 1) {
              peak = Math.max(peak, localDepthCoverage[localDepth]);
              if (localDepthCoverage[localDepth] >= span * 0.35) denseDepths += 1;
            }
            return peak >= span * 0.35 && denseDepths >= minimumRibbonThickness;
          });
          if (!localDepthRun) return;
          const localBandStart = bandStart + localDepthRun.start;
          const localBandEnd = bandStart + localDepthRun.end;
          const localBandThickness = localBandEnd - localBandStart + 1;
          if (localBandStart > maximumRibbonStart) return;

          const localRayThicknesses = new Uint16Array(longLength);
          for (let depth = localBandStart; depth <= localBandEnd; depth += 1) {
            const maskOffset = depth * longLength;
            for (let along = alongRun.start; along <= alongRun.end; along += 1) {
              localRayThicknesses[along] += coreMask[maskOffset + along];
            }
          }
          const thicknessValues = [];
          let coreArea = 0;
          let localStrongRays = 0;
          for (let along = alongRun.start; along <= alongRun.end; along += 1) {
            const thickness = localRayThicknesses[along];
            coreArea += thickness;
            if (thickness >= minimumRayThickness) {
              localStrongRays += 1;
              thicknessValues.push(thickness);
            }
          }
          const medianThickness = percentile(thicknessValues, 0.5);
          const lowThickness = percentile(thicknessValues, 0.1);
          const highThickness = percentile(thicknessValues, 0.9);
          const strongRayRatio = localStrongRays / span;
          const fillRatio = coreArea / Math.max(1, span * localBandThickness);
          const aspectRatio = span / Math.max(1, medianThickness);
          if (
            strongRayRatio < 0.38
            ||
            medianThickness < minimumRibbonThickness
            || fillRatio < 0.22
            || aspectRatio < 5
          ) return;

          // A perfectly straight, uniformly filled strip is more likely to be
          // an intentional page/table rule. Real scan rims are ragged or
          // broken; ambiguous uniform rules deliberately remain unchanged.
          const uniformRule = strongRayRatio >= 0.94
            && fillRatio >= 0.82
            && highThickness - lowThickness <= Math.max(1, medianThickness * 0.12);
          if (uniformRule) return;

          const spanRatio = span / longLength;
          ribbons.push({
            edge,
            bandStart: localBandStart,
            bandEnd: localBandEnd,
            alongStart: alongRun.start,
            alongEnd: alongRun.end,
            spanRatio,
            independent: spanRatio >= 0.18,
            minimumThickness: minimumRibbonThickness,
            box: getRibbonBox(
              edge,
              localBandStart,
              localBandEnd,
              alongRun.start,
              alongRun.end
            )
          });
        });
      });
      return ribbons;
    };

    const ribbons = edgeDefinitions.flatMap(collectEdgeRibbons);
    const qualified = new Set();
    const boxesMeet = (first, second) => {
      if (first.edge.horizontal === second.edge.horizontal) return false;
      const margin = Math.max(
        first.minimumThickness,
        second.minimumThickness,
        Math.round(shortSide * 0.004)
      );
      return first.box.left <= second.box.right + margin
        && first.box.right + margin >= second.box.left
        && first.box.top <= second.box.bottom + margin
        && first.box.bottom + margin >= second.box.top;
    };

    // A single rough line is indistinguishable from an aged page rule. Only
    // begin cleanup when a substantial ribbon is corroborated by a
    // perpendicular arm at the same inset corner. Shorter broken arms may
    // still participate, but an isolated top/bottom/side rule always fails
    // closed and remains untouched.
    ribbons.forEach((ribbon) => {
      if (!ribbon.independent) return;
      const anchor = ribbons.find((candidate) => (
        candidate !== ribbon
        && candidate.spanRatio >= 0.055
        && boxesMeet(ribbon, candidate)
      ));
      if (!anchor) return;
      qualified.add(ribbon);
      qualified.add(anchor);
    });

    // A shorter arm is accepted only when it forms a proven L-shaped rim with
    // a perpendicular candidate. This catches fragmented left/top corners
    // without treating an isolated logo or edge word as a crop artifact.
    let qualificationChanged = true;
    while (qualificationChanged) {
      qualificationChanged = false;
      ribbons.forEach((ribbon) => {
        if (qualified.has(ribbon)) return;
        const anchor = ribbons.find((candidate) => (
          candidate !== ribbon
          && boxesMeet(ribbon, candidate)
          && (
            qualified.has(candidate)
            || (
              ribbon.spanRatio + candidate.spanRatio >= 0.18
              && Math.max(ribbon.spanRatio, candidate.spanRatio) >= 0.1
            )
          )
        ));
        if (!anchor) return;
        qualified.add(ribbon);
        qualified.add(anchor);
        qualificationChanged = true;
      });
    }

    // A page that has already passed through an older scanner version can
    // retain only four-to-six dense pixels across each rim ray. That is too
    // fragmented for the primary seven-pixel ribbon detector, even though a
    // rough top arm and a rough left arm still meet at the same inset corner.
    // Run this relaxed collector only when the strict detector found no
    // qualified rim. A single rule, logo, staple, or edge word can therefore
    // never activate it.
    const collectSoftFragmentedRibbons = (edge) => {
      const longLength = edge.horizontal ? width : height;
      const depthLimit = edge.horizontal ? height : width;
      const connectionGap = Math.max(
        1,
        Math.round(shortSide * 0.0015)
      );
      const scanDepthStart = Math.max(
        0,
        maximumRibbonStart - Math.round(minimumRibbonThickness * 4.5)
      );
      const scanDepthEnd = Math.min(
        depthLimit - 1,
        maximumInset - 1,
        maximumRibbonStart + minimumRibbonThickness * 2
      );
      if (scanDepthEnd < scanDepthStart) return [];

      const rayFlags = new Uint8Array(longLength);
      const rayStarts = new Int32Array(longLength);
      const rayEnds = new Int32Array(longLength);
      const rayStrongCounts = new Uint16Array(longLength);
      rayStarts.fill(-1);
      rayEnds.fill(-1);
      const minimumSegmentThickness = Math.max(
        4,
        Math.round(minimumRibbonThickness * 0.55)
      );
      const minimumStrongPixels = Math.max(
        2,
        Math.round(minimumRibbonThickness * 0.3)
      );

      for (let along = 0; along < longLength; along += 1) {
        let bestStart = -1;
        let bestEnd = -1;
        let bestStrongCount = -1;
        let depth = scanDepthStart;
        while (depth <= scanDepthEnd) {
          while (
            depth <= scanDepthEnd
            && !isNeutralBelow(
              getEdgePixelIndex(edge, along, depth),
              232,
              42
            )
          ) depth += 1;
          if (depth > scanDepthEnd) break;

          const segmentStart = depth;
          let strongCount = 0;
          while (
            depth <= scanDepthEnd
            && isNeutralBelow(
              getEdgePixelIndex(edge, along, depth),
              232,
              42
            )
          ) {
            if (isNeutralBelow(
              getEdgePixelIndex(edge, along, depth),
              190,
              36
            )) strongCount += 1;
            depth += 1;
          }
          const segmentEnd = depth - 1;
          const segmentThickness = segmentEnd - segmentStart + 1;
          if (
            segmentThickness < minimumSegmentThickness
            || strongCount < minimumStrongPixels
          ) continue;
          const bestThickness = bestEnd >= bestStart
            ? bestEnd - bestStart + 1
            : 0;
          if (
            strongCount > bestStrongCount
            || (
              strongCount === bestStrongCount
              && segmentThickness > bestThickness
            )
            || (
              strongCount === bestStrongCount
              && segmentThickness === bestThickness
              && segmentStart < bestStart
            )
          ) {
            bestStart = segmentStart;
            bestEnd = segmentEnd;
            bestStrongCount = strongCount;
          }
        }
        if (bestStart < 0) continue;
        rayFlags[along] = 1;
        rayStarts[along] = bestStart;
        rayEnds[along] = bestEnd;
        rayStrongCounts[along] = bestStrongCount;
      }

      const candidates = [];
      const maximumAlongGap = Math.max(
        8,
        Math.round(longLength * 0.015)
      );
      const minimumSpan = Math.max(
        18,
        Math.round(longLength * 0.06)
      );
      buildRuns(rayFlags, maximumAlongGap).forEach((run) => {
        const span = run.end - run.start + 1;
        const activeRatio = run.count / Math.max(1, span);
        if (
          run.start
            > maximumRibbonStart + minimumRibbonThickness * 2
          || span < minimumSpan
          || activeRatio < 0.5
          || run.count < minimumRibbonThickness * 4
        ) return;

        const starts = [];
        const ends = [];
        const thicknesses = [];
        const strongCounts = [];
        const tones = [];
        let filledArea = 0;
        for (let along = run.start; along <= run.end; along += 1) {
          if (!rayFlags[along]) continue;
          const start = rayStarts[along];
          const end = rayEnds[along];
          const thickness = end - start + 1;
          starts.push(start);
          ends.push(end);
          thicknesses.push(thickness);
          strongCounts.push(rayStrongCounts[along]);
          filledArea += thickness;
          for (let depth = start; depth <= end; depth += 1) {
            const pixelIndex = getEdgePixelIndex(edge, along, depth);
            const dataIndex = pixelIndex * 4;
            tones.push(getScannerLuminance(
              data[dataIndex],
              data[dataIndex + 1],
              data[dataIndex + 2]
            ));
          }
        }
        if (!thicknesses.length || !tones.length) return;

        const medianThickness = percentile(thicknesses, 0.5);
        const bandStart = Math.max(
          0,
          percentile(starts, 0.1) - connectionGap
        );
        const bandEnd = Math.min(
          depthLimit - 1,
          maximumInset - 1,
          percentile(ends, 0.85)
        );
        const bandThickness = bandEnd - bandStart + 1;
        const fillRatio = filledArea
          / Math.max(1, span * bandThickness);
        const aspectRatio = span / Math.max(1, medianThickness);
        const thicknessSpread = percentile(thicknesses, 0.9)
          - percentile(thicknesses, 0.1);
        const startSpread = percentile(starts, 0.9)
          - percentile(starts, 0.1);
        const strongSpread = percentile(strongCounts, 0.9)
          - percentile(strongCounts, 0.1);
        const toneSpread = percentile(tones, 0.9)
          - percentile(tones, 0.1);
        const uniformRule = activeRatio >= 0.94
          && fillRatio >= 0.75
          && thicknessSpread <= 1
          && startSpread <= 1
          && strongSpread <= 1;
        if (
          bandStart > maximumRibbonStart
          || bandThickness > Math.round(minimumRibbonThickness * 4.5)
          || percentile(starts, 0.75) > maximumRibbonStart
          || medianThickness < Math.max(
            4,
            Math.round(minimumRibbonThickness * 0.7)
          )
          || fillRatio < 0.14
          || aspectRatio < 8
          || toneSpread < 18
          || uniformRule
        ) return;

        const spanRatio = span / longLength;
        candidates.push({
          edge,
          bandStart,
          bandEnd,
          alongStart: run.start,
          alongEnd: run.end,
          spanRatio,
          independent: spanRatio >= 0.18,
          minimumThickness: minimumRibbonThickness,
          softFallback: true,
          softScore: spanRatio * activeRatio * toneSpread,
          box: getRibbonBox(
            edge,
            bandStart,
            bandEnd,
            run.start,
            run.end
          )
        });
      });
      return candidates;
    };

    if (!qualified.size) {
      const topEdge = edgeDefinitions.find((edge) => edge.name === 'top');
      const leftEdge = edgeDefinitions.find((edge) => edge.name === 'left');
      const softTopRibbons = collectSoftFragmentedRibbons(topEdge);
      const softLeftRibbons = collectSoftFragmentedRibbons(leftEdge);
      let bestSoftPair = null;
      softTopRibbons.forEach((topRibbon) => {
        softLeftRibbons.forEach((leftRibbon) => {
          if (
            !boxesMeet(topRibbon, leftRibbon)
            || topRibbon.spanRatio < 0.07
            || leftRibbon.spanRatio < 0.07
            || topRibbon.spanRatio + leftRibbon.spanRatio < 0.2
            || Math.max(topRibbon.spanRatio, leftRibbon.spanRatio) < 0.1
          ) return;

          const cornerLeft = Math.max(
            topRibbon.alongStart,
            leftRibbon.bandStart
          );
          const cornerRight = Math.min(
            topRibbon.alongEnd,
            leftRibbon.bandEnd
          );
          const cornerTop = Math.max(
            leftRibbon.alongStart,
            topRibbon.bandStart
          );
          const cornerBottom = Math.min(
            leftRibbon.alongEnd,
            topRibbon.bandEnd
          );
          if (
            cornerRight < cornerLeft
            || cornerBottom < cornerTop
          ) return;
          let strongCornerPixels = 0;
          let relaxedCornerPixels = 0;
          let cornerPixels = 0;
          for (let y = cornerTop; y <= cornerBottom; y += 1) {
            for (let x = cornerLeft; x <= cornerRight; x += 1) {
              const pixelIndex = y * width + x;
              cornerPixels += 1;
              if (isNeutralBelow(pixelIndex, 232, 42)) {
                relaxedCornerPixels += 1;
              }
              if (isNeutralBelow(pixelIndex, 190, 36)) {
                strongCornerPixels += 1;
              }
            }
          }
          if (
            strongCornerPixels
              < minimumRibbonThickness * minimumRibbonThickness
            || relaxedCornerPixels / Math.max(1, cornerPixels) < 0.18
          ) return;
          const score = topRibbon.softScore + leftRibbon.softScore;
          if (!bestSoftPair || score > bestSoftPair.score) {
            bestSoftPair = { topRibbon, leftRibbon, score };
          }
        });
      });
      if (bestSoftPair) {
        qualified.add(bestSoftPair.topRibbon);
        qualified.add(bestSoftPair.leftRibbon);
      }
    }

    const qualifiedRibbons = Array.from(qualified);
    qualifiedRibbons.forEach((ribbon) => {
      const edge = ribbon.edge;
      const longLength = edge.horizontal ? width : height;
      const depthLimit = edge.horizontal ? height : width;
      const connectionGap = Math.max(1, Math.round(shortSide * 0.0015));
      const startTolerance = Math.max(
        2,
        Math.min(
          Math.round(ribbon.minimumThickness * 1.5),
          Math.round((ribbon.bandEnd - ribbon.bandStart + 1) * 0.35)
        )
      );
      const minimumLeadingPixels = Math.max(
        2,
        Math.round(ribbon.minimumThickness * 0.5)
      );
      const rayStarts = new Int32Array(longLength);
      const rayEnds = new Int32Array(longLength);
      const raySolidEnds = new Int32Array(longLength);
      rayStarts.fill(-1);
      rayEnds.fill(-1);
      raySolidEnds.fill(-1);
      const leadingThicknesses = [];
      const solidThicknesses = [];
      const leadingStarts = [];
      for (let along = ribbon.alongStart; along <= ribbon.alongEnd; along += 1) {
        let leadingStart = -1;
        const startSearchEnd = Math.min(
          ribbon.bandEnd,
          ribbon.bandStart + startTolerance
        );
        for (let depth = ribbon.bandStart; depth <= startSearchEnd; depth += 1) {
          if (!isRibbonCore(getEdgePixelIndex(edge, along, depth))) continue;
          leadingStart = depth;
          break;
        }
        if (leadingStart < 0) continue;
        let leadingEnd = leadingStart;
        let solidEnd = leadingStart - 1;
        let solidPrefixOpen = true;
        let leadingPixels = 0;
        let gap = 0;
        for (let depth = leadingStart; depth <= ribbon.bandEnd; depth += 1) {
          const pixelIndex = getEdgePixelIndex(edge, along, depth);
          if (isRibbonResidue(pixelIndex)) {
            if (solidPrefixOpen) solidEnd = depth;
            leadingEnd = depth;
            leadingPixels += 1;
            gap = 0;
          } else {
            solidPrefixOpen = false;
            gap += 1;
            if (gap > connectionGap) break;
          }
        }
        const solidThickness = solidEnd - leadingStart + 1;
        if (leadingPixels < minimumLeadingPixels) continue;
        rayStarts[along] = leadingStart;
        rayEnds[along] = leadingEnd;
        raySolidEnds[along] = solidEnd;
        leadingThicknesses.push(leadingEnd - leadingStart + 1);
        solidThicknesses.push(solidThickness);
        leadingStarts.push(leadingStart);
      }

      const lowerThickness = percentile(leadingThicknesses, 0.25);
      const upperThickness = percentile(leadingThicknesses, 0.8);
      const thicknessAllowance = Math.max(
        2,
        Math.round(ribbon.minimumThickness * 0.55),
        Math.round((upperThickness - lowerThickness) * 0.5)
      );
      ribbon.maximumLeadingThickness = Math.max(
        ribbon.minimumThickness,
        Math.min(
          ribbon.bandEnd - ribbon.bandStart + 1,
          Math.round(upperThickness + thicknessAllowance)
        )
      );
      ribbon.safePrefixThickness = Math.max(
        ribbon.minimumThickness,
        Math.min(
          ribbon.maximumLeadingThickness,
          Math.round(percentile(solidThicknesses, 0.25))
        )
      );
      ribbon.fragmentEnvelopeThickness = Math.max(
        ribbon.minimumThickness,
        Math.min(
          ribbon.maximumLeadingThickness,
          Math.round(percentile(solidThicknesses, 0.6) + 2)
        )
      );
      ribbon.typicalStart = Math.round(percentile(leadingStarts, 0.5));
      ribbon.rayStarts = rayStarts;
      ribbon.rayEnds = rayEnds;
      ribbon.raySolidEnds = raySolidEnds;
      ribbon.connectionGap = connectionGap;
      ribbon.startTolerance = startTolerance;
      const consensusSeparatorRays = new Uint8Array(longLength);
      const separatorRadius = Math.max(3, ribbon.minimumThickness * 2);
      const minimumSeparatorNeighbors = Math.max(5, ribbon.minimumThickness);
      for (let along = ribbon.alongStart; along <= ribbon.alongEnd; along += 1) {
        const start = rayStarts[along];
        const solidEnd = raySolidEnds[along];
        if (start < 0 || solidEnd < start || solidEnd >= rayEnds[along]) continue;
        const separatorDepth = solidEnd + 1;
        let comparable = 0;
        let paperNeighbors = 0;
        let leftPaper = false;
        let rightPaper = false;
        const neighborStart = Math.max(ribbon.alongStart, along - separatorRadius);
        const neighborEnd = Math.min(ribbon.alongEnd, along + separatorRadius);
        for (let neighbor = neighborStart; neighbor <= neighborEnd; neighbor += 1) {
          if (neighbor === along) continue;
          if (
            rayStarts[neighbor] < 0
            || Math.abs(rayStarts[neighbor] - start) > startTolerance
          ) continue;
          comparable += 1;
          if (isContinuingContent(getEdgePixelIndex(edge, neighbor, separatorDepth))) continue;
          paperNeighbors += 1;
          if (neighbor < along) leftPaper = true;
          if (neighbor > along) rightPaper = true;
        }
        if (
          comparable >= minimumSeparatorNeighbors
          && leftPaper
          && rightPaper
          && paperNeighbors >= Math.ceil(comparable * 0.7)
        ) consensusSeparatorRays[along] = 1;
      }
      ribbon.consensusSeparatorRays = consensusSeparatorRays;
    });

    // Mark only dark runs that begin at the inferred inset frame. Disconnected
    // logos, text and seals elsewhere inside the same projection band never
    // become eligible. Perpendicular runs meet as geometry at an L-shaped
    // corner, so one rim arm is not misread as inward document content.
    qualifiedRibbons.forEach((ribbon) => {
      const edge = ribbon.edge;
      const supportRadius = Math.max(3, ribbon.minimumThickness);
      for (let along = ribbon.alongStart; along <= ribbon.alongEnd; along += 1) {
        const start = ribbon.rayStarts[along];
        const end = ribbon.rayEnds[along];
        const solidEnd = ribbon.raySolidEnds[along];
        if (start < 0 || end < start) continue;
        for (let depth = start; depth <= end; depth += 1) {
          const pixelIndex = getEdgePixelIndex(edge, along, depth);
          if (!isRibbonResidue(pixelIndex)) continue;
          if (depth <= solidEnd) {
            removalMask[pixelIndex] = 2;
            continue;
          }
          if (ribbon.consensusSeparatorRays[along]) continue;

          // Once clean paper interrupted a ray, accept later dark pixels only
          // when nearby aligned rays prove that the rough ribbon continues at
          // the same depth. A detached dot, diacritic or punctuation mark has
          // no such cross-ray support and therefore remains untouched.
          let comparableRays = 0;
          let supportingRays = 0;
          const neighborStart = Math.max(ribbon.alongStart, along - supportRadius);
          const neighborEnd = Math.min(ribbon.alongEnd, along + supportRadius);
          for (let neighbor = neighborStart; neighbor <= neighborEnd; neighbor += 1) {
            if (neighbor === along) continue;
            const neighborRayStart = ribbon.rayStarts[neighbor];
            if (
              neighborRayStart < 0
              || Math.abs(neighborRayStart - start) > ribbon.startTolerance
            ) continue;
            comparableRays += 1;
            if (
              depth <= ribbon.rayEnds[neighbor]
              && isRibbonResidue(getEdgePixelIndex(edge, neighbor, depth))
            ) supportingRays += 1;
          }
          const requiredSupport = Math.max(2, Math.ceil(comparableRays * 0.6));
          const immediateNeighborsAreSolid = along > ribbon.alongStart
            && along < ribbon.alongEnd
            && [along - 1, along + 1].every((neighbor) => (
              ribbon.rayStarts[neighbor] >= 0
              && Math.abs(ribbon.rayStarts[neighbor] - start) <= ribbon.startTolerance
              && depth <= ribbon.raySolidEnds[neighbor]
              && isRibbonResidue(getEdgePixelIndex(edge, neighbor, depth))
            ));
          if (
            immediateNeighborsAreSolid
            || (
              comparableRays >= 3
              && supportingRays >= requiredSupport
            )
          ) removalMask[pixelIndex] = 2;
        }
      }
    });

    // A proven scan rim is often split into short, shallow pieces by JPEG
    // holes and the later paper-normalization stages. Recover only fragments
    // that stay inside the same narrow depth envelope and remain linked along
    // the edge to an already-proven rim pixel. Inward continuation marks a
    // glyph stem, so those rays and the short baseline gaps between them are
    // excluded before any pixels become eligible.
    qualifiedRibbons.forEach((ribbon) => {
      const edge = ribbon.edge;
      const longLength = edge.horizontal ? width : height;
      const depthLimit = edge.horizontal ? height : width;
      const linkRadius = Math.max(
        4,
        Math.min(20, Math.round(longLength * 0.04))
      );
      const scanStart = Math.max(0, ribbon.typicalStart - ribbon.startTolerance);
      const scanEnd = Math.min(
        depthLimit - 1,
        ribbon.typicalStart + ribbon.fragmentEnvelopeThickness - 1
      );
      const maximumFragmentExtension = Math.round(longLength * 0.35);
      const analysisStart = Math.max(0, ribbon.alongStart - maximumFragmentExtension);
      const analysisEnd = Math.min(longLength - 1, ribbon.alongEnd + maximumFragmentExtension);
      const fragmentStarts = new Int32Array(longLength);
      const fragmentEnds = new Int32Array(longLength);
      const fragmentRays = new Uint8Array(longLength);
      const contentRays = new Uint8Array(longLength);
      fragmentStarts.fill(-1);
      fragmentEnds.fill(-1);
      const continuationNeeded = Math.max(2, Math.round(ribbon.minimumThickness * 0.55));
      const continuationProbe = Math.max(
        ribbon.minimumThickness * 4,
        Math.round(shortSide * 0.025)
      );
      for (let along = analysisStart; along <= analysisEnd; along += 1) {
        let start = -1;
        const startLimit = Math.min(
          scanEnd,
          ribbon.typicalStart + ribbon.startTolerance + 2
        );
        for (let depth = scanStart; depth <= startLimit; depth += 1) {
          if (!isRibbonCore(getEdgePixelIndex(edge, along, depth))) continue;
          start = depth;
          break;
        }
        if (start < 0) continue;
        let end = start;
        let pixels = 0;
        let gap = 0;
        for (let depth = start; depth <= scanEnd; depth += 1) {
          const pixelIndex = getEdgePixelIndex(edge, along, depth);
          if (isNeutralBelow(pixelIndex, 205, 48)) {
            end = depth;
            pixels += 1;
            gap = 0;
          } else {
            gap += 1;
            if (gap > ribbon.connectionGap) break;
          }
        }
        if (pixels < Math.max(2, Math.round(ribbon.minimumThickness * 0.45))) continue;
        fragmentStarts[along] = start;
        fragmentEnds[along] = end;
        fragmentRays[along] = 1;

        if (start <= ribbon.connectionGap) {
          contentRays[along] = 1;
        } else {
          let outwardInk = 0;
          let outwardGap = 0;
          const outwardEnd = Math.max(
            0,
            start - Math.max(
              ribbon.minimumThickness * 3,
              Math.round(shortSide * 0.012)
            )
          );
          for (let depth = start - 1; depth >= outwardEnd; depth -= 1) {
            if (isContinuingContent(getEdgePixelIndex(edge, along, depth))) {
              outwardInk += 1;
              outwardGap = 0;
            } else {
              outwardGap += 1;
              if (outwardGap > ribbon.connectionGap) break;
            }
          }
          if (outwardInk >= continuationNeeded) contentRays[along] = 1;
        }

        let continuation = 0;
        let continuationGap = 0;
        const probeEnd = Math.min(depthLimit - 1, end + continuationProbe);
        for (let depth = end + 1; depth <= probeEnd; depth += 1) {
          if (isContinuingContent(getEdgePixelIndex(edge, along, depth))) {
            continuation += 1;
            continuationGap = 0;
          } else {
            continuationGap += 1;
            if (continuationGap > ribbon.connectionGap) break;
          }
        }
        if (continuation >= continuationNeeded) contentRays[along] = 1;
      }

      const contentBridge = Math.max(2, Math.round(ribbon.minimumThickness * 3));
      let previousContent = -1;
      for (let along = 0; along < longLength; along += 1) {
        if (!contentRays[along]) continue;
        if (previousContent >= 0 && along - previousContent - 1 <= contentBridge) {
          for (let protectedAlong = previousContent; protectedAlong <= along; protectedAlong += 1) {
            contentRays[protectedAlong] = 1;
          }
        }
        previousContent = along;
      }
      const terminalContentRays = contentRays.slice();
      const minimumConnectedContentRun = Math.max(
        contentBridge * 2,
        ribbon.minimumThickness * 6
      );
      buildRuns(contentRays, 0).forEach((run) => {
        if (run.end - run.start + 1 < minimumConnectedContentRun) return;
        const start = Math.max(analysisStart, run.start - contentBridge);
        const end = Math.min(analysisEnd, run.end + contentBridge);
        for (let along = start; along <= end; along += 1) {
          terminalContentRays[along] = 1;
        }
      });
      contentRays.set(terminalContentRays);
      for (let along = 0; along < longLength; along += 1) {
        if (!contentRays[along]) continue;
        const start = Math.max(0, along - Math.max(1, Math.round(ribbon.minimumThickness * 0.4)));
        const end = Math.min(longLength - 1, along + Math.max(1, Math.round(ribbon.minimumThickness * 0.4)));
        for (let protectedAlong = start; protectedAlong <= end; protectedAlong += 1) {
          fragmentRays[protectedAlong] = 0;
        }
      }

      buildRuns(fragmentRays, linkRadius).forEach((run) => {
        if (run.count < Math.max(6, ribbon.minimumThickness * 2)) return;
        const outwardExtension = Math.max(0, ribbon.alongStart - run.start);
        const inwardExtension = Math.max(0, run.end - ribbon.alongEnd);
        if (outwardExtension + inwardExtension > maximumFragmentExtension) return;
        let primaryRays = 0;
        for (let along = run.start; along <= run.end; along += 1) {
          let primary = false;
          for (let depth = scanStart; depth <= scanEnd; depth += 1) {
            if (removalMask[getEdgePixelIndex(edge, along, depth)] === 2) {
              primary = true;
              break;
            }
          }
          if (primary) primaryRays += 1;
        }
        if (primaryRays / Math.max(1, run.end - run.start + 1) < 0.35) return;
        for (let along = run.start; along <= run.end; along += 1) {
          if (!fragmentRays[along]) continue;
          const start = fragmentStarts[along];
          const end = fragmentEnds[along];
          for (let depth = start; depth <= end; depth += 1) {
            const pixelIndex = getEdgePixelIndex(edge, along, depth);
            if (isNeutralBelow(pixelIndex, 205, 48)) removalMask[pixelIndex] = 2;
          }
        }
      });
    });

    qualifiedRibbons.forEach((ribbon) => {
      const edge = ribbon.edge;
      const longLength = edge.horizontal ? width : height;
      const depthLimit = edge.horizontal ? height : width;
      const protectedRays = new Uint8Array(longLength);
      const outwardCrossingRays = new Uint8Array(longLength);
      const strongJoinedContinuationRays = new Uint8Array(longLength);
      const continuationNeeded = Math.max(2, Math.round(ribbon.minimumThickness * 0.55));
      const strongJoinedContinuationNeeded = Math.max(
        3,
        ribbon.minimumThickness * 2
      );
      const continuationProbe = Math.max(
        ribbon.minimumThickness * 4,
        Math.round(shortSide * 0.03)
      );
      for (let along = ribbon.alongStart; along <= ribbon.alongEnd; along += 1) {
        const leadingStart = ribbon.rayStarts[along];
        const leadingEnd = ribbon.rayEnds[along];
        if (leadingStart < 0 || leadingEnd < leadingStart) continue;
        if (leadingStart <= ribbon.connectionGap) {
          outwardCrossingRays[along] = 1;
        } else {
          let outwardInk = 0;
          let outwardGap = 0;
          let reachedPhysicalEdge = false;
          for (let depth = leadingStart - 1; depth >= 0; depth -= 1) {
            if (isContinuingContent(getEdgePixelIndex(edge, along, depth))) {
              outwardInk += 1;
              outwardGap = 0;
              if (depth <= ribbon.connectionGap) reachedPhysicalEdge = true;
            } else {
              outwardGap += 1;
              if (outwardGap > ribbon.connectionGap) break;
            }
          }
          if (
            reachedPhysicalEdge
            && outwardInk >= continuationNeeded
          ) outwardCrossingRays[along] = 1;
        }
        if (outwardCrossingRays[along]) {
          protectedRays[along] = 1;
          continue;
        }
        const leadingThickness = leadingEnd - leadingStart + 1;
        if (leadingThickness > ribbon.maximumLeadingThickness + continuationNeeded) {
          protectedRays[along] = 1;
          continue;
        }
        let started = false;
        let gap = 0;
        let continuation = 0;
        const probeEnd = Math.min(
          depthLimit - 1,
          leadingEnd + continuationProbe
        );
        const directlyJoinedContinuation = leadingEnd + 1 <= probeEnd
          && isRibbonCore(getEdgePixelIndex(edge, along, leadingEnd + 1));
        for (let depth = leadingEnd + 1; depth <= probeEnd; depth += 1) {
          const pixelIndex = getEdgePixelIndex(edge, along, depth);
          if (removalMask[pixelIndex] >= 2) {
            gap += 1;
            if (gap > ribbon.connectionGap) break;
          } else if (isContinuingContent(pixelIndex)) {
            started = true;
            continuation += 1;
            gap = 0;
          } else {
            gap += 1;
            if (gap > ribbon.connectionGap) break;
          }
        }
        if (started && continuation >= continuationNeeded) protectedRays[along] = 1;
        if (
          directlyJoinedContinuation
          && continuation >= strongJoinedContinuationNeeded
        ) {
          strongJoinedContinuationRays[along] = 1;
        }
      }

      // Connected writing often has separated vertical stems joined by one
      // baseline. Bridge only short gaps between already-proven continuation
      // rays so that baseline pixels are preserved with their letters. This
      // never creates new removal candidates; it only widens protection.
      const protectedBridge = Math.max(2, Math.round(ribbon.minimumThickness * 3));
      let previousProtected = -1;
      for (let along = ribbon.alongStart; along <= ribbon.alongEnd; along += 1) {
        if (!protectedRays[along]) continue;
        if (
          previousProtected >= 0
          && along - previousProtected - 1 <= protectedBridge
        ) {
          for (
            let protectedAlong = previousProtected + 1;
            protectedAlong < along;
            protectedAlong += 1
          ) protectedRays[protectedAlong] = 1;
        }
        previousProtected = along;
      }

      // A shorter word can overlap the last rows of the proven rim prefix and
      // still be too narrow for the broad joined-field detector below. Require
      // a substantial run of rays with strong ink continuation beyond the rim,
      // then extend only a small shoulder to cover that word's baseline ends.
      const joinedOverlapRays = new Uint8Array(longLength);
      const minimumJoinedOverlapSpan = Math.max(
        protectedBridge * 2,
        Math.round((ribbon.alongEnd - ribbon.alongStart + 1) * 0.08)
      );
      buildRuns(strongJoinedContinuationRays, protectedBridge).forEach((run) => {
        const runSpan = run.end - run.start + 1;
        if (
          runSpan < minimumJoinedOverlapSpan
          || run.count / runSpan < 0.3
        ) return;
        const start = Math.max(
          ribbon.alongStart,
          run.start - protectedBridge
        );
        const end = Math.min(
          ribbon.alongEnd,
          run.end + protectedBridge
        );
        for (let joinedAlong = start; joinedAlong <= end; joinedAlong += 1) {
          joinedOverlapRays[joinedAlong] = 1;
        }
      });
      ribbon.joinedOverlapRays = joinedOverlapRays;
      ribbon.joinedOverlapProtectionStart = Math.max(
        ribbon.bandStart,
        ribbon.typicalStart + Math.max(
          ribbon.minimumThickness,
          ribbon.safePrefixThickness - ribbon.minimumThickness + 1
        )
      );

      // A broad connected word can begin or end a few rays beyond its first
      // inward stem.  Those terminal baseline rays are genuine content too,
      // but the pairwise bridge above has a seed on only one side of them.
      // Extend only long, already-proven content runs by the same small bridge
      // distance; isolated protected rays and scan texture do not qualify.
      const terminalProtection = protectedRays.slice();
      const minimumConnectedContentSpan = Math.max(
        protectedBridge * 3,
        Math.round(longLength * 0.08)
      );
      const terminalProtectionRadius = protectedBridge
        + ribbon.minimumThickness * 2;
      buildRuns(protectedRays, 0).forEach((run) => {
        if (run.end - run.start + 1 < minimumConnectedContentSpan) return;
        const start = Math.max(ribbon.alongStart, run.start - terminalProtectionRadius);
        const end = Math.min(ribbon.alongEnd, run.end + terminalProtectionRadius);
        for (let protectedAlong = start; protectedAlong <= end; protectedAlong += 1) {
          terminalProtection[protectedAlong] = 1;
        }
      });
      protectedRays.set(terminalProtection);

      const protectionRadius = Math.max(1, Math.round(ribbon.minimumThickness * 0.4));
      const expandedProtection = protectedRays.slice();
      const expandedOutwardCrossing = outwardCrossingRays.slice();
      for (let along = ribbon.alongStart; along <= ribbon.alongEnd; along += 1) {
        if (!protectedRays[along]) continue;
        const start = Math.max(ribbon.alongStart, along - protectionRadius);
        const end = Math.min(ribbon.alongEnd, along + protectionRadius);
        for (let protectedAlong = start; protectedAlong <= end; protectedAlong += 1) {
          expandedProtection[protectedAlong] = 1;
          if (outwardCrossingRays[along]) expandedOutwardCrossing[protectedAlong] = 1;
        }
      }
      ribbon.protectedRays = expandedProtection;
      ribbon.outwardCrossingRays = expandedOutwardCrossing;
      for (let along = ribbon.alongStart; along <= ribbon.alongEnd; along += 1) {
        if (!expandedProtection[along]) continue;
        for (let depth = ribbon.bandStart; depth <= ribbon.bandEnd; depth += 1) {
          const pixelIndex = getEdgePixelIndex(edge, along, depth);
          if (expandedOutwardCrossing[along]) hardProtectionMask[pixelIndex] = 1;
          removalMask[pixelIndex] = removalMask[pixelIndex] === 2 ? 4 : 3;
        }
      }
    });

    // Protection is deliberately generous because a real glyph can meet an
    // inset frame. On old halftone scans that also classifies many short rim
    // breaks as content, leaving a dotted border behind. Recover only the
    // outer profile that is independently demonstrated by unprotected rays
    // on both sides. This follows the edge-parallel scan residue itself; it
    // never fills a strip, never crosses a consensus paper separator, and the
    // hard mask still wins for content that reaches the physical image edge.
    qualifiedRibbons.forEach((ribbon) => {
      const edge = ribbon.edge;
      const longLength = edge.horizontal ? width : height;
      const depthLimit = edge.horizontal ? height : width;
      const trustedThicknesses = [];
      for (let along = ribbon.alongStart; along <= ribbon.alongEnd; along += 1) {
        if (
          ribbon.protectedRays[along]
          || ribbon.outwardCrossingRays[along]
          || ribbon.rayStarts[along] < 0
        ) continue;
        const thickness = ribbon.raySolidEnds[along] - ribbon.rayStarts[along] + 1;
        if (thickness > 0) trustedThicknesses.push(thickness);
      }
      if (trustedThicknesses.length < Math.max(8, ribbon.minimumThickness * 2)) return;

      const provenOuterThickness = Math.max(
        ribbon.safePrefixThickness,
        Math.min(
          ribbon.maximumLeadingThickness,
          Math.round(percentile(trustedThicknesses, 0.9))
        )
      );
      const scanStart = Math.max(
        ribbon.bandStart,
        ribbon.typicalStart - ribbon.startTolerance
      );
      const provenPrefixEnd = Math.min(
        ribbon.bandEnd,
        ribbon.typicalStart + provenOuterThickness - 1
      );
      const mixedContentBoundary = Math.min(
        provenPrefixEnd,
        ribbon.typicalStart + ribbon.safePrefixThickness
      );
      const scanEnd = Math.min(
        depthLimit - 1,
        maximumInset - 1,
        ribbon.bandEnd + Math.max(
          ribbon.minimumThickness * 2,
          Math.round(ribbon.maximumLeadingThickness * 0.65)
        )
      );
      const anchorRadius = Math.max(
        ribbon.minimumThickness * 6,
        Math.min(48, Math.round(longLength * 0.03))
      );
      const minimumSideSupport = 2;
      const recoveryDepthCount = scanEnd - scanStart + 1;
      const texturedPostGapPixels = new Uint8Array(
        longLength * recoveryDepthCount
      );
      const detachedPostGapPixels = new Uint8Array(
        longLength * recoveryDepthCount
      );
      const denseMixedSeparatorPixels = new Uint8Array(
        longLength * recoveryDepthCount
      );
      const postGapLayerCounts = new Uint32Array(recoveryDepthCount);
      const postGapDetachedCounts = new Uint32Array(recoveryDepthCount);
      const postGapLayerMinimums = new Uint8Array(recoveryDepthCount);
      const postGapLayerMaximums = new Uint8Array(recoveryDepthCount);
      const postGapLayerStarts = new Int32Array(recoveryDepthCount);
      const postGapLayerEnds = new Int32Array(recoveryDepthCount);
      postGapLayerMinimums.fill(255);
      postGapLayerStarts.fill(-1);
      postGapLayerEnds.fill(-1);
      for (let along = ribbon.alongStart; along <= ribbon.alongEnd; along += 1) {
        const rayStart = ribbon.rayStarts[along];
        const solidEnd = ribbon.raySolidEnds[along];
        const rayEnd = scanEnd;
        if (rayStart < 0 || solidEnd < rayStart || rayEnd <= solidEnd) continue;
        for (let depth = solidEnd + 1; depth <= rayEnd; depth += 1) {
          const pixelIndex = getEdgePixelIndex(edge, along, depth);
          // Broad post-gap rim fields are dark and tonally varied across the
          // edge. A detached gray punctuation mark is not part of this core.
          if (!isRibbonCore(pixelIndex)) continue;
          const dataIndex = pixelIndex * 4;
          const luminance = Math.round(getScannerLuminance(
            data[dataIndex],
            data[dataIndex + 1],
            data[dataIndex + 2]
          ));
          const localDepth = depth - scanStart;
          const matrixIndex = localDepth * longLength + along;
          texturedPostGapPixels[matrixIndex] = 1;
          postGapLayerCounts[localDepth] += 1;
          if (depth > solidEnd + 1) {
            detachedPostGapPixels[matrixIndex] = 1;
            postGapDetachedCounts[localDepth] += 1;
          }
          if (postGapLayerStarts[localDepth] < 0) {
            postGapLayerStarts[localDepth] = along;
          }
          postGapLayerEnds[localDepth] = along;
          postGapLayerMinimums[localDepth] = Math.min(
            postGapLayerMinimums[localDepth],
            luminance
          );
          postGapLayerMaximums[localDepth] = Math.max(
            postGapLayerMaximums[localDepth],
            luminance
          );
        }
      }

      const ribbonSpan = ribbon.alongEnd - ribbon.alongStart + 1;
      const minimumDenseFieldSpan = Math.max(
        ribbon.minimumThickness * 4,
        Math.round(ribbonSpan * 0.35)
      );
      const maximumDenseFieldGap = Math.max(
        1,
        Math.round(ribbon.minimumThickness * 0.75)
      );
      const joinedContentTerminalRadius = Math.max(
        2,
        ribbon.minimumThickness * 3
      );
      const joinedContentContinuation = Math.max(
        2,
        Math.round(ribbon.minimumThickness * 0.55)
      );
      for (let localDepth = 0; localDepth < recoveryDepthCount; localDepth += 1) {
        const layerOffset = localDepth * longLength;
        const absoluteDepth = scanStart + localDepth;
        let fieldStart = -1;
        let fieldLast = -1;
        let fieldCount = 0;
        let detachedCount = 0;
        let fieldGap = 0;
        const closeDenseField = () => {
          if (fieldStart < 0) return;
          const fieldSpan = fieldLast - fieldStart + 1;
          let firstFieldDeepSeed = -1;
          let lastFieldDeepSeed = -1;
          let fieldDeepSeedCount = 0;
          for (
            let seedAlong = fieldStart;
            seedAlong <= fieldLast;
            seedAlong += 1
          ) {
            if (
              !ribbon.protectedRays[seedAlong]
              || ribbon.outwardCrossingRays[seedAlong]
              || ribbon.raySolidEnds[seedAlong]
                < absoluteDepth + joinedContentContinuation
            ) continue;
            if (firstFieldDeepSeed < 0) firstFieldDeepSeed = seedAlong;
            lastFieldDeepSeed = seedAlong;
            fieldDeepSeedCount += 1;
          }
          const fieldDeepSeedSpan = lastFieldDeepSeed - firstFieldDeepSeed + 1;
          if (
            fieldSpan >= minimumDenseFieldSpan
            && fieldCount / fieldSpan >= 0.5
            && detachedCount / Math.max(1, fieldCount) >= 0.25
            && fieldDeepSeedCount
              >= Math.max(3, Math.ceil(fieldCount * 0.08))
            && fieldDeepSeedSpan >= fieldSpan * 0.45
          ) {
            for (let fieldAlong = fieldStart; fieldAlong <= fieldLast; fieldAlong += 1) {
              denseMixedSeparatorPixels[layerOffset + fieldAlong] = 1;
            }
          }
          fieldStart = -1;
          fieldLast = -1;
          fieldCount = 0;
          detachedCount = 0;
          fieldGap = 0;
        };
        for (let along = ribbon.alongStart; along <= ribbon.alongEnd + 1; along += 1) {
          const active = along <= ribbon.alongEnd
            && texturedPostGapPixels[layerOffset + along];
          if (active) {
            if (fieldStart < 0) fieldStart = along;
            fieldLast = along;
            fieldCount += 1;
            fieldGap = 0;
            detachedCount += detachedPostGapPixels[layerOffset + along];
          } else if (fieldStart >= 0) {
            fieldGap += 1;
            if (along > ribbon.alongEnd || fieldGap > maximumDenseFieldGap) {
              closeDenseField();
            }
          }
        }

        // Record broad connected content independently from removal state.
        // The finalizer intersects this field evidence with its local deep-ray
        // test, so neither a dense rim alone nor a pair of noisy rays can veto
        // cleanup. Only actual dark pixels are marked; gaps are never filled.
        if (
          absoluteDepth
            >= Math.max(scanStart, mixedContentBoundary - ribbon.minimumThickness)
        ) {
          const requiredJoinedContinuation = absoluteDepth < mixedContentBoundary
            ? ribbon.minimumThickness * 4
            : joinedContentContinuation;
          let joinedFieldStart = -1;
          let joinedFieldLast = -1;
          let joinedFieldCount = 0;
          let joinedFieldGap = 0;
          let firstDeepSeed = -1;
          let lastDeepSeed = -1;
          let deepSeedCount = 0;
          const closeJoinedField = () => {
            if (joinedFieldStart < 0) return;
            const joinedFieldSpan = joinedFieldLast - joinedFieldStart + 1;
            const deepSeedSpan = lastDeepSeed - firstDeepSeed + 1;
            if (
              joinedFieldSpan >= minimumDenseFieldSpan
              && joinedFieldCount / joinedFieldSpan >= 0.5
              && deepSeedCount >= Math.max(3, Math.ceil(joinedFieldCount * 0.08))
              && deepSeedSpan >= minimumDenseFieldSpan * 0.45
            ) {
              const protectedStart = Math.max(
                joinedFieldStart,
                firstDeepSeed - joinedContentTerminalRadius
              );
              const protectedEnd = Math.min(
                joinedFieldLast,
                lastDeepSeed + joinedContentTerminalRadius
              );
              for (
                let joinedAlong = protectedStart;
                joinedAlong <= protectedEnd;
                joinedAlong += 1
              ) {
                for (let depthOffset = -1; depthOffset <= 0; depthOffset += 1) {
                  const joinedDepth = absoluteDepth + depthOffset;
                  if (joinedDepth < scanStart) continue;
                  const joinedPixelIndex = getEdgePixelIndex(
                    edge,
                    joinedAlong,
                    joinedDepth
                  );
                  if (isNeutralBelow(joinedPixelIndex, 205, 48)) {
                    joinedContentFieldMask[joinedPixelIndex] = 1;
                  }
                }
              }
            }
            joinedFieldStart = -1;
            joinedFieldLast = -1;
            joinedFieldCount = 0;
            joinedFieldGap = 0;
            firstDeepSeed = -1;
            lastDeepSeed = -1;
            deepSeedCount = 0;
          };
          for (
            let along = ribbon.alongStart;
            along <= ribbon.alongEnd + 1;
            along += 1
          ) {
            const active = along <= ribbon.alongEnd
              && isRibbonCore(getEdgePixelIndex(edge, along, absoluteDepth));
            if (active) {
              if (joinedFieldStart < 0) joinedFieldStart = along;
              joinedFieldLast = along;
              joinedFieldCount += 1;
              joinedFieldGap = 0;
              if (
                ribbon.protectedRays[along]
                && !ribbon.outwardCrossingRays[along]
                && ribbon.raySolidEnds[along]
                  >= absoluteDepth + requiredJoinedContinuation
              ) {
                if (firstDeepSeed < 0) firstDeepSeed = along;
                lastDeepSeed = along;
                deepSeedCount += 1;
              }
            } else if (joinedFieldStart >= 0) {
              joinedFieldGap += 1;
              if (
                along > ribbon.alongEnd
                || joinedFieldGap > maximumDenseFieldGap
              ) closeJoinedField();
            }
          }
        }

      }
      const layerEvidence = Array.from(
        { length: recoveryDepthCount },
        (_, localDepth) => {
        const fieldStart = postGapLayerStarts[localDepth];
        const fieldEnd = postGapLayerEnds[localDepth];
        const fieldSpan = fieldEnd - fieldStart + 1;
        let primarySeedRays = 0;
        if (fieldStart >= 0) {
          for (let seedAlong = fieldStart; seedAlong <= fieldEnd; seedAlong += 1) {
            if (
              !ribbon.protectedRays[seedAlong]
              && !ribbon.outwardCrossingRays[seedAlong]
              && ribbon.rayStarts[seedAlong] >= 0
            ) primarySeedRays += 1;
          }
        }
        return {
          density: postGapLayerCounts[localDepth] / Math.max(1, ribbonSpan),
          fieldSpan,
          fieldFill: postGapLayerCounts[localDepth] / Math.max(1, fieldSpan),
          detachedRatio: postGapDetachedCounts[localDepth]
            / Math.max(1, postGapLayerCounts[localDepth]),
          seedOverlap: primarySeedRays / Math.max(1, fieldSpan),
          tonalRange: postGapLayerMaximums[localDepth]
            - postGapLayerMinimums[localDepth]
        };
      });
      let consensusEnvelopeEnd = ribbon.bandEnd;
      let weakLayers = 0;
      for (let depth = ribbon.bandEnd + 1; depth <= scanEnd; depth += 1) {
        const localDepth = depth - scanStart;
        const evidence = layerEvidence[localDepth];
        if (!postGapLayerCounts[localDepth] || evidence.density <= 0.025) break;
        const strongLayer = evidence.density >= 0.08
          && evidence.density <= 0.78
          && evidence.fieldSpan >= ribbonSpan * 0.35
          && evidence.fieldFill >= 0.3
          && evidence.seedOverlap >= 0.35
          && evidence.tonalRange >= 12;
        if (strongLayer) {
          consensusEnvelopeEnd = depth;
          weakLayers = 0;
          continue;
        }
        weakLayers += 1;
        if (weakLayers >= 2) break;
      }

      const countTrustedSupport = (along, depth, direction, postGap) => {
        let support = 0;
        const limit = direction < 0
          ? Math.max(ribbon.alongStart, along - anchorRadius)
          : Math.min(ribbon.alongEnd, along + anchorRadius);
        for (
          let neighbor = along + direction;
          direction < 0 ? neighbor >= limit : neighbor <= limit;
          neighbor += direction
        ) {
          if (
            ribbon.protectedRays[neighbor]
            || ribbon.outwardCrossingRays[neighbor]
            || ribbon.rayStarts[neighbor] < 0
            || Math.abs(ribbon.rayStarts[neighbor] - ribbon.typicalStart)
              > ribbon.startTolerance
            || depth < ribbon.rayStarts[neighbor]
          ) continue;
          if (postGap) {
            if (
              !texturedPostGapPixels[(depth - scanStart) * longLength + neighbor]
              || depth <= ribbon.raySolidEnds[neighbor]
            ) continue;
          } else if (depth > ribbon.raySolidEnds[neighbor]) continue;
          const neighborPixelIndex = getEdgePixelIndex(edge, neighbor, depth);
          if (!isRibbonResidue(neighborPixelIndex)) continue;
          support += 1;
          if (support >= minimumSideSupport) break;
        }
        return support;
      };

      for (let along = ribbon.alongStart; along <= ribbon.alongEnd; along += 1) {
        if (ribbon.outwardCrossingRays[along]) continue;
        const rayStart = ribbon.rayStarts[along];
        const solidEnd = ribbon.raySolidEnds[along];
        for (let depth = scanStart; depth <= consensusEnvelopeEnd; depth += 1) {
          const pixelIndex = getEdgePixelIndex(edge, along, depth);
          if (
            hardProtectionMask[pixelIndex]
            || removalMask[pixelIndex] === 1
            || !isRibbonResidue(pixelIndex)
          ) continue;
          const hasPrimaryRay = rayStart >= 0 && solidEnd >= rayStart;
          const postGap = !hasPrimaryRay || depth > solidEnd;
          const localDepth = depth - scanStart;
          if (
            depth > mixedContentBoundary
            && denseMixedSeparatorPixels[localDepth * longLength + along]
          ) {
            // Fragment recovery runs before this richer field analysis. Undo
            // only its still-pending candidate state so the final 2 -> 1
            // promotion cannot erase a dense connected text field.
            if (removalMask[pixelIndex] === 2) removalMask[pixelIndex] = 3;
            continue;
          }
          if (!postGap && depth > provenPrefixEnd) continue;
          if (postGap) {
            const currentLayerEvidence = layerEvidence[localDepth];
            const fieldDensity = currentLayerEvidence.density;
            const fieldStart = postGapLayerStarts[localDepth];
            const fieldEnd = postGapLayerEnds[localDepth];
            const fieldSpan = currentLayerEvidence.fieldSpan;
            let componentStart = depth;
            let componentEnd = depth;
            while (
              componentStart > Math.max(scanStart, solidEnd + 1)
              && isRibbonCore(getEdgePixelIndex(edge, along, componentStart - 1))
            ) componentStart -= 1;
            while (
              componentEnd < consensusEnvelopeEnd
              && isRibbonCore(getEdgePixelIndex(edge, along, componentEnd + 1))
            ) componentEnd += 1;
            let componentMinimum = 255;
            let componentMaximum = 0;
            for (
              let componentDepth = componentStart;
              componentDepth <= componentEnd;
              componentDepth += 1
            ) {
              const componentIndex = getEdgePixelIndex(edge, along, componentDepth) * 4;
              const componentLuminance = Math.round(getScannerLuminance(
                data[componentIndex],
                data[componentIndex + 1],
                data[componentIndex + 2]
              ));
              componentMinimum = Math.min(componentMinimum, componentLuminance);
              componentMaximum = Math.max(componentMaximum, componentLuminance);
            }
            const uniformDetachedMark = componentEnd - componentStart + 1 >= 2
              && componentMaximum - componentMinimum < 4
              && componentStart > Math.max(scanStart, solidEnd + 1)
              && !isRibbonResidue(
                getEdgePixelIndex(edge, along, componentStart - 1)
              );
            const denseDetachedField = componentStart
              > Math.max(scanStart, solidEnd + 1)
              && currentLayerEvidence.fieldFill >= 0.72;
            const denseMixedSeparatorLayer = currentLayerEvidence.fieldFill >= 0.72
              && currentLayerEvidence.detachedRatio >= 0.25;
            const denseMixedSeparatorField = denseMixedSeparatorPixels[
              localDepth * longLength + along
            ];
            let continuationPixels = 0;
            let cleanPaperPixels = 0;
            const continuationEnd = Math.min(
              depthLimit - 1,
              consensusEnvelopeEnd + Math.max(
                ribbon.minimumThickness * 4,
                Math.round(shortSide * 0.025)
              )
            );
            for (
              let continuationDepth = componentEnd + 1;
              continuationDepth <= continuationEnd;
              continuationDepth += 1
            ) {
              if (isContinuingContent(
                getEdgePixelIndex(edge, along, continuationDepth)
              )) {
                cleanPaperPixels = 0;
                if (continuationDepth > consensusEnvelopeEnd) {
                  continuationPixels += 1;
                }
              } else {
                cleanPaperPixels += 1;
                if (cleanPaperPixels >= 2) break;
              }
            }
            const reachesBeyondEnvelope = continuationPixels
              >= Math.max(2, Math.round(ribbon.minimumThickness * 0.55));
            if (
              (
                hasPrimaryRay
                  ? !texturedPostGapPixels[localDepth * longLength + along]
                  : !isRibbonCore(pixelIndex)
              )
              || fieldDensity < 0.08
              || fieldDensity > 0.78
              || fieldSpan < ribbonSpan * 0.35
              || currentLayerEvidence.fieldFill < 0.3
              || currentLayerEvidence.seedOverlap < 0.35
              || currentLayerEvidence.tonalRange < 12
              || uniformDetachedMark
              || denseDetachedField
              || denseMixedSeparatorLayer
              || denseMixedSeparatorField
              || reachesBeyondEnvelope
            ) continue;
          }
          if (
            countTrustedSupport(along, depth, -1, postGap) < minimumSideSupport
            || countTrustedSupport(along, depth, 1, postGap) < minimumSideSupport
          ) continue;
          removalMask[pixelIndex] = 1;
        }
      }
    });

    qualifiedRibbons.forEach((ribbon) => {
      const edge = ribbon.edge;
      const depthLimit = edge.horizontal ? height : width;
      const supportRadius = Math.max(3, ribbon.minimumThickness * 2);
      const minimumComparable = Math.max(5, ribbon.minimumThickness);
      for (let along = ribbon.alongStart; along <= ribbon.alongEnd; along += 1) {
        const start = ribbon.rayStarts[along];
        const end = Math.min(
          ribbon.rayEnds[along],
          start + ribbon.maximumLeadingThickness - 1
        );
        if (start < 0 || end < start) continue;
        if (ribbon.protectedRays[along]) {
          if (
            ribbon.outwardCrossingRays[along]
            || Math.abs(start - ribbon.typicalStart) > ribbon.startTolerance
          ) continue;
          const joinedOverlapProtectionStart = (
            ribbon.joinedOverlapRays
            && ribbon.joinedOverlapRays[along]
          )
            ? ribbon.joinedOverlapProtectionStart
            : depthLimit;
          if (
            ribbon.consensusSeparatorRays[along]
            || (
              ribbon.raySolidEnds[along] - start + 1
                <= Math.min(
                  ribbon.maximumLeadingThickness,
                  ribbon.safePrefixThickness + ribbon.minimumThickness - 1
                )
              &&
              ribbon.raySolidEnds[along] + 1 < depthLimit
              && !isContinuingContent(getEdgePixelIndex(
                edge,
                along,
                ribbon.raySolidEnds[along] + 1
              ))
            )
          ) {
            const separatorPrefixEnd = Math.min(
              end,
              ribbon.raySolidEnds[along],
              joinedOverlapProtectionStart - 1
            );
            for (let depth = start; depth <= separatorPrefixEnd; depth += 1) {
              const pixelIndex = getEdgePixelIndex(edge, along, depth);
              if (
                !hardProtectionMask[pixelIndex]
                && removalMask[pixelIndex] === 4
              ) removalMask[pixelIndex] = 1;
            }
            continue;
          }
          const prefixEnd = Math.min(
            end,
            ribbon.raySolidEnds[along],
            joinedOverlapProtectionStart - 1,
            start + Math.max(
              1,
              Math.min(
                ribbon.safePrefixThickness - 1,
                ribbon.minimumThickness + 2
              )
            ) - 1
          );
          for (let depth = start; depth <= prefixEnd; depth += 1) {
            const pixelIndex = getEdgePixelIndex(edge, along, depth);
            if (
              hardProtectionMask[pixelIndex]
              ||
              (removalMask[pixelIndex] !== 3 && removalMask[pixelIndex] !== 4)
              || !isRibbonCore(pixelIndex)
            ) continue;
            const relativeDepth = depth - start;
            let comparable = 0;
            let supporting = 0;
            let leftSupport = false;
            let rightSupport = false;
            const neighborStart = Math.max(ribbon.alongStart, along - supportRadius);
            const neighborEnd = Math.min(ribbon.alongEnd, along + supportRadius);
            for (let neighbor = neighborStart; neighbor <= neighborEnd; neighbor += 1) {
              if (neighbor === along) continue;
              const neighborRayStart = ribbon.rayStarts[neighbor];
              if (
                neighborRayStart < 0
                || Math.abs(neighborRayStart - ribbon.typicalStart) > ribbon.startTolerance
              ) continue;
              comparable += 1;
              const neighborDepth = neighborRayStart + relativeDepth;
              const neighborPixelIndex = getEdgePixelIndex(edge, neighbor, neighborDepth);
              if (
                neighborDepth > ribbon.raySolidEnds[neighbor]
                || !isRibbonResidue(neighborPixelIndex)
              ) continue;
              supporting += 1;
              if (neighbor < along) leftSupport = true;
              if (neighbor > along) rightSupport = true;
            }
            if (
              comparable >= minimumComparable
              && leftSupport
              && rightSupport
              && supporting >= Math.ceil(comparable * 0.75)
            ) removalMask[pixelIndex] = 1;
          }
          continue;
        }
        const connectedThickness = ribbon.rayEnds[along] - start + 1;
        let preserveJoinedTailAfter = -1;
        if (
          connectedThickness
            > ribbon.safePrefixThickness + ribbon.minimumThickness
        ) {
          const joinedNeighborRadius = Math.max(2, ribbon.minimumThickness * 3);
          const neighborStart = Math.max(
            ribbon.alongStart,
            along - joinedNeighborRadius
          );
          const neighborEnd = Math.min(
            ribbon.alongEnd,
            along + joinedNeighborRadius
          );
          let deepProtectedNeighbors = 0;
          for (
            let neighbor = neighborStart;
            neighbor <= neighborEnd;
            neighbor += 1
          ) {
            if (
              neighbor === along
              || !ribbon.protectedRays[neighbor]
              || ribbon.outwardCrossingRays[neighbor]
              || ribbon.rayStarts[neighbor] < 0
              || ribbon.raySolidEnds[neighbor] - ribbon.rayStarts[neighbor] + 1
                < ribbon.maximumLeadingThickness
            ) continue;
            deepProtectedNeighbors += 1;
            if (deepProtectedNeighbors >= 2) break;
          }
          if (deepProtectedNeighbors >= 2) {
            // Keep cleaning the independently proven outer prefix, but a deep
            // tail beside multiple content rays is a joined word endpoint.
            preserveJoinedTailAfter = start + ribbon.safePrefixThickness;
          }
        }
        for (let depth = start; depth <= end; depth += 1) {
          const pixelIndex = getEdgePixelIndex(edge, along, depth);
          if (
            preserveJoinedTailAfter >= 0
            && depth > preserveJoinedTailAfter
            && joinedContentFieldMask[pixelIndex]
          ) {
            // State 2 is globally finalized after this ribbon loop, so move a
            // proven joined tail into the ordinary protected state explicitly.
            if (
              removalMask[pixelIndex] === 1
              || removalMask[pixelIndex] === 2
            ) removalMask[pixelIndex] = 3;
            continue;
          }
          if (!hardProtectionMask[pixelIndex] && removalMask[pixelIndex] === 2) {
            removalMask[pixelIndex] = 1;
          }
        }
      }
    });

    // Complete shallow dotted rim fragments only when they are bracketed by
    // removals that were already proven independently. This is deliberately a
    // seed-completion pass rather than an edge strip: it changes only existing
    // neutral pixels, needs anchors on both along-edge sides, rejects uniform
    // page rules, and backs away from any content continuing into the paper.
    qualifiedRibbons.forEach((ribbon) => {
      const edge = ribbon.edge;
      if (edge.name !== 'top' && edge.name !== 'left') return;
      const longLength = edge.horizontal ? width : height;
      const depthLimit = edge.horizontal ? height : width;
      const completionStart = Math.max(
        ribbon.bandStart,
        ribbon.typicalStart - ribbon.startTolerance
      );
      const completionEnd = Math.min(
        depthLimit - 1,
        maximumInset - 1,
        Math.max(
          ribbon.bandEnd,
          ribbon.typicalStart + ribbon.fragmentEnvelopeThickness - 1
        )
      );
      if (completionEnd < completionStart) return;

      const completionDepthCount = completionEnd - completionStart + 1;
      const coherentFieldPixels = new Uint8Array(
        longLength * completionDepthCount
      );
      const coherentFieldStarts = new Int32Array(
        longLength * completionDepthCount
      );
      const coherentFieldEnds = new Int32Array(
        longLength * completionDepthCount
      );
      coherentFieldStarts.fill(-1);
      coherentFieldEnds.fill(-1);
      const fieldFlags = new Uint8Array(longLength);
      const maximumFieldGap = Math.max(
        1,
        Math.round(ribbon.minimumThickness * 0.75)
      );
      const minimumFieldSpan = Math.max(
        ribbon.minimumThickness * 8,
        Math.round((ribbon.alongEnd - ribbon.alongStart + 1) * 0.08)
      );
      for (let depth = completionStart; depth <= completionEnd; depth += 1) {
        fieldFlags.fill(0);
        for (let along = ribbon.alongStart; along <= ribbon.alongEnd; along += 1) {
          const pixelIndex = getEdgePixelIndex(edge, along, depth);
          if (isNeutralBelow(pixelIndex, 190, 36)) fieldFlags[along] = 1;
        }
        buildRuns(fieldFlags, maximumFieldGap).forEach((run) => {
          const fieldSpan = run.end - run.start + 1;
          const fieldFill = run.count / fieldSpan;
          if (
            fieldSpan < minimumFieldSpan
            || fieldFill < 0.3
          ) return;
          let fieldMinimum = 255;
          let fieldMaximum = 0;
          for (let along = run.start; along <= run.end; along += 1) {
            if (!fieldFlags[along]) continue;
            const dataIndex = getEdgePixelIndex(edge, along, depth) * 4;
            const luminance = Math.round(getScannerLuminance(
              data[dataIndex],
              data[dataIndex + 1],
              data[dataIndex + 2]
            ));
            fieldMinimum = Math.min(fieldMinimum, luminance);
            fieldMaximum = Math.max(fieldMaximum, luminance);
          }
          if (fieldMaximum - fieldMinimum < 12) return;
          const fieldOffset = (depth - completionStart) * longLength;
          for (let along = run.start; along <= run.end; along += 1) {
            if (fieldFlags[along]) {
              coherentFieldPixels[fieldOffset + along] = 1;
              coherentFieldStarts[fieldOffset + along] = run.start;
              coherentFieldEnds[fieldOffset + along] = run.end;
            }
          }
        });
      }

      const contentGuardRadius = ribbon.minimumThickness * 2;
      const inwardGuardEnd = Math.min(
        depthLimit - 1,
        completionEnd + Math.max(
          ribbon.minimumThickness * 6,
          Math.round(shortSide * 0.025)
        )
      );
      const inwardRiskRays = new Uint8Array(longLength);
      for (let along = ribbon.alongStart; along <= ribbon.alongEnd; along += 1) {
        let continuingPixels = 0;
        let paperGap = 0;
        for (
          let guardDepth = completionEnd + 1;
          guardDepth <= inwardGuardEnd;
          guardDepth += 1
        ) {
          if (isContinuingContent(getEdgePixelIndex(edge, along, guardDepth))) {
            continuingPixels += 1;
            paperGap = 0;
            if (continuingPixels >= 2) {
              inwardRiskRays[along] = 1;
              break;
            }
          } else {
            paperGap += 1;
            if (paperGap > ribbon.connectionGap) break;
          }
        }
      }
      const completionContentRisk = new Uint8Array(
        longLength * completionDepthCount
      );
      const riskPrefix = new Uint32Array(longLength + 1);
      for (let depth = completionStart; depth <= completionEnd; depth += 1) {
        riskPrefix[0] = 0;
        for (let along = 0; along < longLength; along += 1) {
          const guardedPixel = getEdgePixelIndex(edge, along, depth);
          const risky = inwardRiskRays[along]
            || hardProtectionMask[guardedPixel]
            || joinedContentFieldMask[guardedPixel];
          riskPrefix[along + 1] = riskPrefix[along] + (risky ? 1 : 0);
        }
        const riskOffset = (depth - completionStart) * longLength;
        for (let along = ribbon.alongStart; along <= ribbon.alongEnd; along += 1) {
          const guardStart = Math.max(
            ribbon.alongStart,
            along - contentGuardRadius
          );
          const guardEnd = Math.min(
            ribbon.alongEnd,
            along + contentGuardRadius
          );
          if (riskPrefix[guardEnd + 1] - riskPrefix[guardStart] > 0) {
            completionContentRisk[riskOffset + along] = 1;
          }
        }
      }
      const anchorPrefix = new Uint32Array(longLength + 1);
      for (let depth = completionStart; depth <= completionEnd; depth += 1) {
        const fieldOffset = (depth - completionStart) * longLength;
        anchorPrefix[0] = 0;
        for (let along = 0; along < longLength; along += 1) {
          let anchored = false;
          if (!ribbon.outwardCrossingRays[along]) {
            for (let offset = -1; offset <= 1; offset += 1) {
              const anchorDepth = depth + offset;
              if (
                anchorDepth < completionStart
                || anchorDepth > completionEnd
              ) continue;
              const anchorPixel = getEdgePixelIndex(edge, along, anchorDepth);
              if (
                removalMask[anchorPixel] === 1
                && !hardProtectionMask[anchorPixel]
                && !joinedContentFieldMask[anchorPixel]
              ) {
                anchored = true;
                break;
              }
            }
          }
          anchorPrefix[along + 1] = anchorPrefix[along] + (anchored ? 1 : 0);
        }
        for (let along = ribbon.alongStart; along <= ribbon.alongEnd; along += 1) {
          if (!coherentFieldPixels[fieldOffset + along]) continue;
          const pixelIndex = getEdgePixelIndex(edge, along, depth);
          if (
            removalMask[pixelIndex] === 1
            || removalMask[pixelIndex] === 5
            || hardProtectionMask[pixelIndex]
            || joinedContentFieldMask[pixelIndex]
          ) continue;
          const fieldStart = coherentFieldStarts[fieldOffset + along];
          const fieldEnd = coherentFieldEnds[fieldOffset + along];
          if (
            fieldStart < 0
            || fieldEnd < fieldStart
            || anchorPrefix[along] - anchorPrefix[fieldStart] < 2
            || anchorPrefix[fieldEnd + 1] - anchorPrefix[along + 1] < 2
          ) continue;
          if (completionContentRisk[fieldOffset + along]) continue;
          // Soft states 3/4 may contain dotted rim pixels conservatively
          // protected by the earlier ray classifier. The immutable field,
          // two-sided seed, tonal-variation and inward-risk gates together are
          // the stronger artifact proof; hard and joined-content masks above
          // remain absolute vetoes.
          // Keep completion separate from independently proven state 1 so it
          // can never become an anchor for this or a later ribbon.
          removalMask[pixelIndex] = 5;
        }
      }
    });

    for (let pixelIndex = 0; pixelIndex < removalMask.length; pixelIndex += 1) {
      if (removalMask[pixelIndex] === 5) removalMask[pixelIndex] = 1;
    }

    // The last photocopy residue can stop looking like one continuous ribbon
    // after the independently proven pixels are removed. Discover only the
    // surviving strong-dark 8-connected components against that frozen mask,
    // then stage every accepted component before changing removalMask. This
    // keeps the cleanup pixel-shaped (never a white strip) and prevents one
    // accepted fleck from growing or corroborating another.
    const residualComponentRemovalMask = new Uint8Array(width * height);
    const isResidualStrongDark = (pixelIndex) => {
      if (
        removalMask[pixelIndex] === 1
        || removalMask[pixelIndex] === 2
        || removalMask[pixelIndex] === 3
        || removalMask[pixelIndex] === 4
      ) return false;
      return isNeutralBelow(pixelIndex, 140, 36);
    };
    qualifiedRibbons.forEach((ribbon) => {
      const edge = ribbon.edge;
      if (edge.name !== 'top' && edge.name !== 'left') return;
      const longLength = edge.horizontal ? width : height;
      const depthLimit = edge.horizontal ? height : width;
      const alongExtension = Math.max(
        ribbon.minimumThickness * 3,
        Math.round(longLength * 0.35)
      );
      const analysisAlongStart = Math.max(
        0,
        ribbon.alongStart - alongExtension
      );
      const analysisAlongEnd = Math.min(
        longLength - 1,
        ribbon.alongEnd + alongExtension
      );
      const analysisDepthStart = Math.max(
        0,
        Math.min(
          ribbon.bandStart,
          ribbon.typicalStart - ribbon.startTolerance
        ) - ribbon.minimumThickness
      );
      const analysisDepthEnd = Math.min(
        depthLimit - 1,
        maximumInset - 1,
        Math.max(
          ribbon.bandEnd,
          ribbon.typicalStart + ribbon.fragmentEnvelopeThickness - 1
        ) + ribbon.minimumThickness * 3
      );
      if (
        analysisAlongEnd < analysisAlongStart
        || analysisDepthEnd < analysisDepthStart
      ) return;

      const analysisAlongCount = analysisAlongEnd - analysisAlongStart + 1;
      const analysisDepthCount = analysisDepthEnd - analysisDepthStart + 1;
      const componentVisited = new Uint8Array(
        analysisAlongCount * analysisDepthCount
      );
      const components = [];
      const getAnalysisIndex = (along, depth) => (
        (depth - analysisDepthStart) * analysisAlongCount
        + along - analysisAlongStart
      );
      for (
        let seedDepth = analysisDepthStart;
        seedDepth <= analysisDepthEnd;
        seedDepth += 1
      ) {
        for (
          let seedAlong = analysisAlongStart;
          seedAlong <= analysisAlongEnd;
          seedAlong += 1
        ) {
          const seedAnalysisIndex = getAnalysisIndex(seedAlong, seedDepth);
          if (componentVisited[seedAnalysisIndex]) continue;
          componentVisited[seedAnalysisIndex] = 1;
          const seedPixelIndex = getEdgePixelIndex(
            edge,
            seedAlong,
            seedDepth
          );
          if (!isResidualStrongDark(seedPixelIndex)) continue;

          const component = {
            pixels: [],
            minAlong: seedAlong,
            maxAlong: seedAlong,
            minDepth: seedDepth,
            maxDepth: seedDepth,
            protected: false,
            crossesEdge: false,
            continuesInward: false,
            continuesAlong: false
          };
          const queue = [seedAnalysisIndex];
          for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
            const analysisIndex = queue[queueIndex];
            const localDepth = Math.floor(analysisIndex / analysisAlongCount);
            const localAlong = analysisIndex - localDepth * analysisAlongCount;
            const along = analysisAlongStart + localAlong;
            const depth = analysisDepthStart + localDepth;
            const pixelIndex = getEdgePixelIndex(edge, along, depth);
            component.pixels.push(pixelIndex);
            component.minAlong = Math.min(component.minAlong, along);
            component.maxAlong = Math.max(component.maxAlong, along);
            component.minDepth = Math.min(component.minDepth, depth);
            component.maxDepth = Math.max(component.maxDepth, depth);
            if (depth === 0 || ribbon.outwardCrossingRays[along]) {
              component.crossesEdge = true;
            }
            if (
              hardProtectionMask[pixelIndex]
              || joinedContentFieldMask[pixelIndex]
              || removalMask[pixelIndex] === 3
              || removalMask[pixelIndex] === 4
            ) component.protected = true;

            for (let depthOffset = -1; depthOffset <= 1; depthOffset += 1) {
              for (let alongOffset = -1; alongOffset <= 1; alongOffset += 1) {
                if (!depthOffset && !alongOffset) continue;
                const neighborAlong = along + alongOffset;
                const neighborDepth = depth + depthOffset;
                if (
                  neighborAlong < 0
                  || neighborAlong >= longLength
                  || neighborDepth < 0
                  || neighborDepth >= depthLimit
                ) continue;
                if (
                  neighborAlong < analysisAlongStart
                  || neighborAlong > analysisAlongEnd
                ) {
                  if (isResidualStrongDark(getEdgePixelIndex(
                    edge,
                    neighborAlong,
                    neighborDepth
                  ))) component.continuesAlong = true;
                  continue;
                }
                if (neighborDepth < analysisDepthStart) continue;
                if (neighborDepth > analysisDepthEnd) {
                  if (isResidualStrongDark(getEdgePixelIndex(
                    edge,
                    neighborAlong,
                    neighborDepth
                  ))) component.continuesInward = true;
                  continue;
                }
                const neighborAnalysisIndex = getAnalysisIndex(
                  neighborAlong,
                  neighborDepth
                );
                if (componentVisited[neighborAnalysisIndex]) continue;
                const neighborPixelIndex = getEdgePixelIndex(
                  edge,
                  neighborAlong,
                  neighborDepth
                );
                if (!isResidualStrongDark(neighborPixelIndex)) continue;
                componentVisited[neighborAnalysisIndex] = 1;
                queue.push(neighborAnalysisIndex);
              }
            }
          }
          component.area = component.pixels.length;
          component.alongSpan = component.maxAlong - component.minAlong + 1;
          component.depthSpan = component.maxDepth - component.minDepth + 1;
          component.fill = component.area
            / Math.max(1, component.alongSpan * component.depthSpan);
          component.aspect = component.alongSpan
            / Math.max(1, component.depthSpan);
          components.push(component);
        }
      }

      const hasCleanInwardSeparator = (component) => {
        const separatorDepthStart = component.maxDepth + 1;
        if (separatorDepthStart >= depthLimit) return false;
        const separatorDepthEnd = Math.min(
          depthLimit - 1,
          separatorDepthStart + Math.max(
            1,
            Math.round(ribbon.minimumThickness * 0.35)
          )
        );
        const separatorStart = Math.max(
          analysisAlongStart,
          component.minAlong - 2
        );
        const separatorEnd = Math.min(
          analysisAlongEnd,
          component.maxAlong + 2
        );
        let contentPixels = 0;
        let inspectedPixels = 0;
        for (
          let depth = separatorDepthStart;
          depth <= separatorDepthEnd;
          depth += 1
        ) {
          for (let along = separatorStart; along <= separatorEnd; along += 1) {
            inspectedPixels += 1;
            if (isNeutralBelow(
              getEdgePixelIndex(edge, along, depth),
              215,
              48
            )) contentPixels += 1;
          }
        }
        return contentPixels <= Math.max(2, Math.floor(inspectedPixels * 0.015));
      };
      const countInwardStrongPixels = (component, probeDepth) => {
        const probeStart = component.maxDepth + 1;
        const probeEnd = Math.min(
          depthLimit - 1,
          probeStart + probeDepth - 1
        );
        const probeAlongStart = Math.max(
          analysisAlongStart,
          component.minAlong - 2
        );
        const probeAlongEnd = Math.min(
          analysisAlongEnd,
          component.maxAlong + 2
        );
        let count = 0;
        for (let depth = probeStart; depth <= probeEnd; depth += 1) {
          for (
            let along = probeAlongStart;
            along <= probeAlongEnd;
            along += 1
          ) {
            if (isResidualStrongDark(getEdgePixelIndex(edge, along, depth))) {
              count += 1;
            }
          }
        }
        return count;
      };
      const isSafeComponent = (component) => (
        !component.protected
        && !component.crossesEdge
        && !component.continuesInward
        && !component.continuesAlong
        && hasCleanInwardSeparator(component)
      );
      if (edge.name === 'top') {
        const maximumDepthSpan = Math.max(
          7,
          ribbon.minimumThickness + 1
        );
        const minimumArea = Math.max(
          15,
          Math.round(ribbon.minimumThickness * 2.5)
        );
        const minimumAlongSpan = Math.max(
          10,
          Math.round(ribbon.minimumThickness * 1.6)
        );
        const minimumComponentDepth = Math.max(
          analysisDepthStart,
          ribbon.typicalStart
            - Math.max(2, Math.round(ribbon.minimumThickness * 0.4))
        );
        const maximumComponentDepth = Math.min(
          analysisDepthEnd,
          ribbon.bandEnd + ribbon.minimumThickness - 1
        );
        const topCandidates = components.filter((component) => (
          isSafeComponent(component)
          && component.minDepth >= minimumComponentDepth
          && component.maxDepth <= maximumComponentDepth
          && component.area >= minimumArea
          && component.alongSpan >= minimumAlongSpan
          && component.depthSpan <= maximumDepthSpan
          && component.aspect >= 4
          && component.fill >= 0.35
          && component.fill <= 0.85
        ));
        const substantialArea = Math.max(
          55,
          ribbon.minimumThickness * 8
        );
        const ridgeTolerance = Math.max(
          1,
          Math.round(ribbon.minimumThickness * 0.4)
        );
        topCandidates.forEach((component) => {
          const centerDepth = (component.minDepth + component.maxDepth) / 2;
          const corroborated = component.area >= substantialArea
            || topCandidates.some((candidate) => (
              candidate !== component
              && Math.abs(
                (candidate.minDepth + candidate.maxDepth) / 2 - centerDepth
              ) <= ridgeTolerance
            ));
          if (!corroborated) return;
          component.pixels.forEach((pixelIndex) => {
            residualComponentRemovalMask[pixelIndex] = 1;
          });
        });
      } else {
        const maximumDepthSpan = Math.max(
          2,
          Math.round(ribbon.minimumThickness * 0.35)
        );
        const minimumComponentDepth = Math.max(
          analysisDepthStart,
          ribbon.typicalStart - ribbon.startTolerance
        );
        components.forEach((component) => {
          if (
            !isSafeComponent(component)
            || component.minDepth < minimumComponentDepth
            || component.maxDepth > ribbon.bandStart
            || component.depthSpan > maximumDepthSpan
            || component.alongSpan < ribbon.minimumThickness
            || component.aspect < 3
            || countInwardStrongPixels(component, 12) > 8
          ) return;
          component.pixels.forEach((pixelIndex) => {
            residualComponentRemovalMask[pixelIndex] = 1;
          });
        });
      }
    });

    for (let pixelIndex = 0; pixelIndex < removalMask.length; pixelIndex += 1) {
      if (
        !residualComponentRemovalMask[pixelIndex]
        || removalMask[pixelIndex] === 1
        || removalMask[pixelIndex] === 2
        || removalMask[pixelIndex] === 3
        || removalMask[pixelIndex] === 4
        || hardProtectionMask[pixelIndex]
        || joinedContentFieldMask[pixelIndex]
        || !isNeutralBelow(pixelIndex, 190, 36)
      ) continue;
      removalMask[pixelIndex] = 1;
    }

    // A tapered bottom scan remnant can be a standalone arm, so requiring an
    // L-shaped partner leaves it completely untouched. Detect that special
    // case independently, using its substantial depth, coherent taper and
    // filled photographic texture. Thin page rules and repeated text stems do
    // not satisfy these shape constraints. Only real neutral-dark pixels are
    // changed; the envelope itself is never painted as a rectangle.
    const bottomEdge = edgeDefinitions.find((edge) => edge.name === 'bottom');
    const bottomDepthLimit = Math.min(maximumInset, height);
    const bottomStartLimit = Math.min(bottomDepthLimit - 1, maximumRibbonStart);
    const bottomConnectionGap = Math.max(1, Math.round(shortSide * 0.0015));
    const bottomStarts = new Int32Array(width);
    const bottomEnds = new Int32Array(width);
    const bottomSolidEnds = new Int32Array(width);
    const bottomPostGapMinimum = new Uint8Array(width);
    const bottomPostGapMaximum = new Uint8Array(width);
    const bottomThicknesses = new Uint16Array(width);
    const bottomPixels = new Uint16Array(width);
    const bottomRays = new Uint8Array(width);
    bottomStarts.fill(-1);
    bottomEnds.fill(-1);
    bottomSolidEnds.fill(-1);
    for (let x = 0; x < width; x += 1) {
      let start = -1;
      for (let depth = 0; depth <= bottomStartLimit; depth += 1) {
        if (!isRibbonCore(getEdgePixelIndex(bottomEdge, x, depth))) continue;
        start = depth;
        break;
      }
      if (start < 0) continue;
      let end = start;
      let solidEnd = start - 1;
      let solidPrefixOpen = true;
      let postGapMinimum = 255;
      let postGapMaximum = 0;
      let pixels = 0;
      let gap = 0;
      for (let depth = start; depth < bottomDepthLimit; depth += 1) {
        const pixelIndex = getEdgePixelIndex(bottomEdge, x, depth);
        if (isNeutralBelow(pixelIndex, 205, 48)) {
          if (solidPrefixOpen) solidEnd = depth;
          else {
            const dataIndex = pixelIndex * 4;
            const luminance = Math.round(getScannerLuminance(
              data[dataIndex],
              data[dataIndex + 1],
              data[dataIndex + 2]
            ));
            postGapMinimum = Math.min(postGapMinimum, luminance);
            postGapMaximum = Math.max(postGapMaximum, luminance);
          }
          end = depth;
          pixels += 1;
          gap = 0;
        } else {
          solidPrefixOpen = false;
          gap += 1;
          if (gap > bottomConnectionGap) break;
        }
      }
      if (pixels < Math.max(2, Math.round(minimumRibbonThickness * 0.7))) continue;
      bottomStarts[x] = start;
      bottomEnds[x] = end;
      bottomSolidEnds[x] = solidEnd;
      bottomPostGapMinimum[x] = postGapMinimum;
      bottomPostGapMaximum[x] = postGapMaximum;
      bottomThicknesses[x] = end - start + 1;
      bottomPixels[x] = pixels;
      bottomRays[x] = 1;
    }

    const bottomAlongGap = Math.max(2, Math.round(width * 0.004));
    buildRuns(bottomRays, bottomAlongGap).forEach((run) => {
      const span = run.end - run.start + 1;
      const activeRatio = run.count / span;
      const touchesCorner = run.start <= width * 0.04 || run.end >= width * 0.96;
      const minimumSpan = width * (touchesCorner ? 0.045 : 0.1);
      if (span < minimumSpan || activeRatio < 0.55) return;
      const starts = [];
      const thicknesses = [];
      let measuredArea = 0;
      let filledArea = 0;
      for (let x = run.start; x <= run.end; x += 1) {
        if (!bottomRays[x]) continue;
        starts.push(bottomStarts[x]);
        thicknesses.push(bottomThicknesses[x]);
        measuredArea += bottomThicknesses[x];
        filledArea += bottomPixels[x];
      }
      const startP10 = percentile(starts, 0.1);
      const startP90 = percentile(starts, 0.9);
      const thicknessP10 = percentile(thicknesses, 0.1);
      const thicknessP50 = percentile(thicknesses, 0.5);
      const thicknessP90 = percentile(thicknesses, 0.9);
      const thicknessSpread = thicknessP90 - thicknessP10;
      const boxFill = filledArea / Math.max(1, span * thicknessP90);
      const residueDensity = filledArea / Math.max(1, measuredArea);
      if (
        thicknessP50 < minimumRibbonThickness
        || thicknessP90 < Math.max(
          minimumRibbonThickness * 2,
          Math.round(shortSide * 0.012)
        )
        || boxFill < 0.3
        || residueDensity < 0.6
        || startP90 - startP10 > Math.max(3, minimumRibbonThickness)
        || thicknessSpread < Math.max(3, Math.round(minimumRibbonThickness * 0.5))
      ) return;

      const profileRadius = Math.max(3, minimumRibbonThickness * 2);
      const profileStep = Math.max(2, minimumRibbonThickness * 2);
      let previousProfile = null;
      let profileVariation = 0;
      let risingSteps = 0;
      let fallingSteps = 0;
      for (let x = run.start; x <= run.end; x += profileStep) {
        let total = 0;
        let count = 0;
        const localStart = Math.max(run.start, x - profileRadius);
        const localEnd = Math.min(run.end, x + profileRadius);
        for (let neighbor = localStart; neighbor <= localEnd; neighbor += 1) {
          if (!bottomRays[neighbor]) continue;
          total += bottomThicknesses[neighbor];
          count += 1;
        }
        if (!count) continue;
        const profile = total / count;
        if (previousProfile !== null) {
          const delta = profile - previousProfile;
          profileVariation += Math.abs(delta);
          if (delta >= 0.35) risingSteps += 1;
          if (delta <= -0.35) fallingSteps += 1;
        }
        previousProfile = profile;
      }
      if (profileVariation > Math.max(8, thicknessSpread * 4)) return;
      const directionalSteps = risingSteps + fallingSteps;
      const exceptionallyStrongWedge = span >= width * 0.35
        && (touchesCorner || span >= width * 0.7)
        && activeRatio >= 0.9
        && residueDensity >= 0.9
        && boxFill >= 0.55
        && thicknessP50 >= minimumRibbonThickness * 3
        && startP90 - startP10 <= minimumRibbonThickness;
      if (
        directionalSteps >= 3
        && Math.max(risingSteps, fallingSteps) / directionalSteps < 0.7
        && !exceptionallyStrongWedge
      ) return;

      const recoveryRadius = Math.max(3, minimumRibbonThickness * 2);
      for (let x = run.start; x <= run.end; x += 1) {
        if (!bottomRays[x]) continue;
        const localStarts = [];
        const localThicknesses = [];
        const localStart = Math.max(run.start, x - recoveryRadius);
        const localEnd = Math.min(run.end, x + recoveryRadius);
        for (let neighbor = localStart; neighbor <= localEnd; neighbor += 1) {
          if (!bottomRays[neighbor]) continue;
          localStarts.push(bottomStarts[neighbor]);
          localThicknesses.push(bottomThicknesses[neighbor]);
        }
        if (!localStarts.length) continue;
        const predictedStart = Math.round(percentile(localStarts, 0.5));
        const predictedThickness = Math.round(percentile(localThicknesses, 0.5));
        const safeEnd = Math.min(
          bottomEnds[x],
          predictedStart + predictedThickness + minimumRibbonThickness - 1
        );
        for (let depth = bottomStarts[x]; depth <= safeEnd; depth += 1) {
          if (depth > bottomSolidEnds[x]) {
            if (bottomPostGapMaximum[x] - bottomPostGapMinimum[x] < 12) continue;
            let comparable = 0;
            let supporting = 0;
            let leftSupport = false;
            let rightSupport = false;
            const supportRadius = Math.max(3, minimumRibbonThickness * 2);
            const neighborStart = Math.max(run.start, x - supportRadius);
            const neighborEnd = Math.min(run.end, x + supportRadius);
            for (let neighbor = neighborStart; neighbor <= neighborEnd; neighbor += 1) {
              if (neighbor === x || !bottomRays[neighbor]) continue;
              comparable += 1;
              if (
                depth > bottomEnds[neighbor]
                || !isNeutralBelow(
                  getEdgePixelIndex(bottomEdge, neighbor, depth),
                  205,
                  48
                )
              ) continue;
              supporting += 1;
              if (neighbor < x) leftSupport = true;
              if (neighbor > x) rightSupport = true;
            }
            if (
              comparable < Math.max(5, minimumRibbonThickness)
              || !leftSupport
              || !rightSupport
              || supporting < Math.ceil(comparable * 0.75)
            ) continue;
          }
          const pixelIndex = getEdgePixelIndex(bottomEdge, x, depth);
          if (
            !hardProtectionMask[pixelIndex]
            &&
            removalMask[pixelIndex] !== 3
            && removalMask[pixelIndex] !== 4
            && isNeutralBelow(pixelIndex, 205, 48)
          ) removalMask[pixelIndex] = 1;
        }
      }
    });

    // A proven L-rim may continue far beyond the short arm that originally
    // qualified it. Connected-component cleanup cannot safely follow that
    // continuation because a later table, emblem, or barcode can join the
    // same component. Complete only the already-proven shallow depth profile,
    // one perpendicular ray at a time. A broad inward probe protects content
    // before any pixel is staged, and uniform printed rules fail closed.
    const profileCompletionMask = new Uint8Array(width * height);
    const removalMaskBeforeProfileCompletion = removalMask.slice();
    qualifiedRibbons.forEach((ribbon) => {
      const edge = ribbon.edge;
      if (edge.name !== 'top' && edge.name !== 'left') return;
      const longLength = edge.horizontal ? width : height;
      const depthLimit = edge.horizontal ? height : width;
      const profileStart = Math.max(
        0,
        ribbon.bandStart - Math.max(
          1,
          Math.round(ribbon.minimumThickness * 0.35)
        )
      );
      const profileEnd = Math.min(
        depthLimit - 1,
        maximumInset - 1,
        ribbon.bandEnd + Math.max(
          2,
          Math.round(
            ribbon.minimumThickness * (edge.name === 'left' ? 2 : 1)
          )
        )
      );
      if (profileEnd < profileStart) return;

      const profileRays = new Uint8Array(longLength);
      const profileRayStarts = new Int32Array(longLength);
      const profileRayEnds = new Int32Array(longLength);
      const profileRayMinimums = new Uint8Array(longLength);
      const profileRayMaximums = new Uint8Array(longLength);
      profileRayStarts.fill(-1);
      profileRayEnds.fill(-1);
      profileRayMinimums.fill(255);
      for (let along = 0; along < longLength; along += 1) {
        let neutralPixels = 0;
        let strongPixels = 0;
        let leadingStarted = false;
        const startSearchEnd = ribbon.softFallback
          ? profileEnd
          : Math.min(
            profileEnd,
            ribbon.typicalStart + ribbon.startTolerance
          );
        for (let depth = profileStart; depth <= profileEnd; depth += 1) {
          const pixelIndex = getEdgePixelIndex(edge, along, depth);
          const neutral = isNeutralBelow(pixelIndex, 232, 42);
          if (!leadingStarted) {
            if (!neutral) {
              if (depth >= startSearchEnd) break;
              continue;
            }
            leadingStarted = true;
          } else if (!neutral) {
            // Detached punctuation or text after clean paper is not part of
            // the leading rim profile, even when it shares the same ray.
            break;
          }
          const dataIndex = pixelIndex * 4;
          const luminance = Math.round(getScannerLuminance(
            data[dataIndex],
            data[dataIndex + 1],
            data[dataIndex + 2]
          ));
          neutralPixels += 1;
          if (luminance <= 178) strongPixels += 1;
          if (profileRayStarts[along] < 0) profileRayStarts[along] = depth;
          profileRayEnds[along] = depth;
          profileRayMinimums[along] = Math.min(
            profileRayMinimums[along],
            luminance
          );
          profileRayMaximums[along] = Math.max(
            profileRayMaximums[along],
            luminance
          );
        }
        if (
          neutralPixels >= (ribbon.softFallback
            ? 1
            : Math.max(
              2,
              Math.round(ribbon.minimumThickness * 0.55)
            ))
          && strongPixels >= (ribbon.softFallback
            ? 1
            : Math.max(
              2,
              Math.round(ribbon.minimumThickness * 0.3)
            ))
        ) profileRays[along] = 1;
      }

      const inwardProbe = Math.max(
        3,
        ribbon.minimumThickness * (edge.name === 'left' ? 6 : 4)
      );
      const connectedContentRays = new Uint8Array(longLength);
      for (let along = 0; along < longLength; along += 1) {
        if (!profileRays[along]) continue;
        // Only a run that reaches the inward edge of the proven profile can
        // be joined to document content. If clean paper already ended the
        // run, text farther inward is separate and must not veto rim cleanup.
        if (profileRayEnds[along] < profileEnd - 1) continue;
        const probeStart = profileRayEnds[along] + 1;
        const probeEnd = Math.min(
          depthLimit - 1,
          probeStart + inwardProbe - 1
        );
        let strongContinuation = 0;
        let initialPaperGap = 0;
        let continuationStarted = false;
        const minimumStrongContinuation = Math.max(
          4,
          ribbon.minimumThickness
        );
        for (
          let probeDepth = probeStart;
          probeDepth <= probeEnd && !connectedContentRays[along];
          probeDepth += 1
        ) {
          let strongDepth = false;
          for (let alongOffset = -1; alongOffset <= 1; alongOffset += 1) {
            const probeAlong = along + alongOffset;
            if (probeAlong < 0 || probeAlong >= longLength) continue;
            const probePixelIndex = getEdgePixelIndex(
              edge,
              probeAlong,
              probeDepth
            );
            const probeDataIndex = probePixelIndex * 4;
            if (getScannerLuminance(
              data[probeDataIndex],
              data[probeDataIndex + 1],
              data[probeDataIndex + 2]
            ) <= 190) {
              strongDepth = true;
              break;
            }
          }
          if (!strongDepth) {
            if (continuationStarted) break;
            initialPaperGap += 1;
            if (initialPaperGap > ribbon.connectionGap) break;
            continue;
          }
          continuationStarted = true;
          strongContinuation += 1;
          if (strongContinuation >= minimumStrongContinuation) {
            connectedContentRays[along] = 1;
          }
        }
      }

      const profileGap = Math.max(3, Math.round(longLength * 0.014));
      buildRuns(profileRays, profileGap).forEach((run) => {
        const span = run.end - run.start + 1;
        const overlap = Math.max(
          0,
          Math.min(run.end, ribbon.alongEnd)
            - Math.max(run.start, ribbon.alongStart)
            + 1
        );
        const ribbonSpan = ribbon.alongEnd - ribbon.alongStart + 1;
        const overlapRequired = Math.max(
          ribbon.minimumThickness * 2,
          Math.round(Math.min(span, ribbonSpan) * 0.08)
        );
        const overlapsQualifiedArm = overlap >= overlapRequired;
        if (
          span < Math.max(
            ribbon.minimumThickness * 4,
            Math.round(longLength * 0.035)
          )
          || run.count / span < 0.22
        ) return;

        const thicknesses = [];
        const starts = [];
        let minimumTone = 255;
        let maximumTone = 0;
        for (let along = run.start; along <= run.end; along += 1) {
          if (!profileRays[along]) continue;
          thicknesses.push(
            profileRayEnds[along] - profileRayStarts[along] + 1
          );
          starts.push(profileRayStarts[along]);
          minimumTone = Math.min(minimumTone, profileRayMinimums[along]);
          maximumTone = Math.max(maximumTone, profileRayMaximums[along]);
        }
        const thicknessP10 = percentile(thicknesses, 0.1);
        const thicknessP90 = percentile(thicknesses, 0.9);
        const startP10 = percentile(starts, 0.1);
        const startP90 = percentile(starts, 0.9);
        const activeRatio = run.count / span;
        const tonalRange = maximumTone - minimumTone;
        const uniformRule = activeRatio >= 0.94
          && thicknessP90 - thicknessP10 <= 1
          && startP90 - startP10 <= 1
          && tonalRange < 14;
        if (uniformRule) return;

        const alignedWithQualifiedArm = Math.abs(
          percentile(starts, 0.5) - ribbon.typicalStart
        ) <= ribbon.startTolerance + ribbon.minimumThickness;
        const independentlyPhotographic = edge.name === 'left'
          && alignedWithQualifiedArm
          && span >= Math.max(
            ribbon.minimumThickness * 5,
            Math.round(longLength * 0.045)
          )
          && (
            thicknessP90 - thicknessP10 >= 2
            || tonalRange >= 18
            || activeRatio < 0.9
          );
        if (!overlapsQualifiedArm && !independentlyPhotographic) return;

        const photographicSupportRadius = Math.max(
          3,
          ribbon.minimumThickness * 2
        );
        const hasPhotographicSideSupport = (along, direction) => {
          const supportEnd = direction < 0
            ? Math.max(run.start, along - photographicSupportRadius)
            : Math.min(run.end, along + photographicSupportRadius);
          let support = 0;
          let minimumThickness = Number.POSITIVE_INFINITY;
          let maximumThickness = 0;
          let minimumTone = 255;
          let maximumTone = 0;
          for (
            let neighbor = along + direction;
            direction < 0 ? neighbor >= supportEnd : neighbor <= supportEnd;
            neighbor += direction
          ) {
            if (!profileRays[neighbor]) continue;
            support += 1;
            const thickness = profileRayEnds[neighbor]
              - profileRayStarts[neighbor]
              + 1;
            minimumThickness = Math.min(minimumThickness, thickness);
            maximumThickness = Math.max(maximumThickness, thickness);
            minimumTone = Math.min(
              minimumTone,
              profileRayMinimums[neighbor]
            );
            maximumTone = Math.max(
              maximumTone,
              profileRayMaximums[neighbor]
            );
          }
          return support >= 2
            && (
              maximumThickness - minimumThickness >= 2
              || maximumTone - minimumTone >= 12
            );
        };
        const joinedContentRadius = Math.max(
          4,
          ribbon.minimumThickness * 2
        );
        const hasNearbyConnectedContent = (along) => {
          const neighborStart = Math.max(
            run.start,
            along - joinedContentRadius
          );
          const neighborEnd = Math.min(
            run.end,
            along + joinedContentRadius
          );
          for (
            let neighbor = neighborStart;
            neighbor <= neighborEnd;
            neighbor += 1
          ) {
            if (connectedContentRays[neighbor]) return true;
          }
          return false;
        };
        const protectedContentRadius = Math.max(
          4,
          ribbon.minimumThickness * 2
        );
        const hasNearbyProtectedContent = (along) => {
          const neighborStart = Math.max(
            run.start,
            along - protectedContentRadius
          );
          const neighborEnd = Math.min(
            run.end,
            along + protectedContentRadius
          );
          for (
            let neighbor = neighborStart;
            neighbor <= neighborEnd;
            neighbor += 1
          ) {
            if (ribbon.protectedRays?.[neighbor]) return true;
          }
          return false;
        };
        for (let along = run.start; along <= run.end; along += 1) {
          if (!profileRays[along]) continue;
          if (
            (!ribbon.softFallback && (
              ribbon.protectedRays?.[along]
              || hasNearbyProtectedContent(along)
            ))
            || ribbon.outwardCrossingRays?.[along]
            || hasNearbyConnectedContent(along)
            || !hasPhotographicSideSupport(along, -1)
            || !hasPhotographicSideSupport(along, 1)
          ) continue;

          for (
            let depth = profileRayStarts[along];
            depth <= profileRayEnds[along];
            depth += 1
          ) {
            const pixelIndex = getEdgePixelIndex(edge, along, depth);
            if (
              removalMask[pixelIndex] === 1
              || removalMask[pixelIndex] === 2
              || hardProtectionMask[pixelIndex]
              || joinedContentFieldMask[pixelIndex]
              || !isNeutralBelow(pixelIndex, 232, 42)
            ) continue;
            profileCompletionMask[pixelIndex] = 1;
          }
        }
      });
    });

    for (let pixelIndex = 0; pixelIndex < removalMask.length; pixelIndex += 1) {
      if (
        !profileCompletionMask[pixelIndex]
        || hardProtectionMask[pixelIndex]
        || joinedContentFieldMask[pixelIndex]
      ) continue;
      removalMask[pixelIndex] = 1;
    }

    // The top-left joint is the one place where each arm looks like inward
    // continuation to the other. Remove only neutral pixels supported by a
    // nearby, already-proven removal pixel; no corner rectangle is filled.
    const qualifiedTopRibbons = qualifiedRibbons.filter(
      (ribbon) => ribbon.edge.name === 'top'
    );
    const qualifiedLeftRibbons = qualifiedRibbons.filter(
      (ribbon) => ribbon.edge.name === 'left'
    );
    qualifiedTopRibbons.forEach((topRibbon) => {
      qualifiedLeftRibbons.forEach((leftRibbon) => {
        if (!boxesMeet(topRibbon, leftRibbon)) return;
        const jointLeft = Math.max(
          0,
          leftRibbon.typicalStart - leftRibbon.startTolerance
        );
        const jointRight = Math.min(
          width - 1,
          leftRibbon.bandEnd + leftRibbon.minimumThickness * 2
        );
        const jointTop = Math.max(
          0,
          topRibbon.typicalStart - topRibbon.startTolerance
        );
        const jointBottom = Math.min(
          height - 1,
          topRibbon.bandEnd + topRibbon.minimumThickness
        );
        const jointRadius = Math.max(
          topRibbon.minimumThickness,
          leftRibbon.minimumThickness
        ) * 2;
        for (let y = jointTop; y <= jointBottom; y += 1) {
          for (let x = jointLeft; x <= jointRight; x += 1) {
            const pixelIndex = y * width + x;
            if (
              removalMask[pixelIndex] === 1
              || removalMask[pixelIndex] === 2
              || hardProtectionMask[pixelIndex]
              || joinedContentFieldMask[pixelIndex]
              || topRibbon.outwardCrossingRays?.[x]
              || leftRibbon.outwardCrossingRays?.[y]
              || !isNeutralBelow(pixelIndex, 232, 42)
            ) continue;
            let anchored = false;
            for (
              let offsetY = -jointRadius;
              offsetY <= jointRadius && !anchored;
              offsetY += 1
            ) {
              const neighborY = y + offsetY;
              if (neighborY < 0 || neighborY >= height) continue;
              const remaining = jointRadius - Math.abs(offsetY);
              for (let offsetX = -remaining; offsetX <= remaining; offsetX += 1) {
                const neighborX = x + offsetX;
                if (neighborX < 0 || neighborX >= width) continue;
                if (removalMask[neighborY * width + neighborX] === 1) {
                  anchored = true;
                  break;
                }
              }
            }
            if (anchored) removalMask[pixelIndex] = 1;
          }
        }
      });
    });

    // Finish the one- or two-pixel gray/JPEG fringe around pixels that were
    // already proven as residue. Growth is one pixel deep along the nearest
    // edge normal, never sideways along an edge into punctuation.
    const haloAnchors = removalMask.slice();
    {
      const stagedHalo = new Uint8Array(width * height);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (
            x >= maximumInset
            && x < width - maximumInset
            && y >= maximumInset
            && y < height - maximumInset
          ) continue;
          const pixelIndex = y * width + x;
          if (
            removalMask[pixelIndex] === 1
            || removalMask[pixelIndex] === 2
            || removalMaskBeforeProfileCompletion[pixelIndex] === 3
            || removalMaskBeforeProfileCompletion[pixelIndex] === 4
            || hardProtectionMask[pixelIndex]
            || joinedContentFieldMask[pixelIndex]
            || !isNeutralBelow(pixelIndex, 225, 42)
          ) continue;
          const nearestHorizontalDepth = Math.min(y, height - 1 - y);
          const nearestVerticalDepth = Math.min(x, width - 1 - x);
          let adjacent = false;
          if (nearestHorizontalDepth <= nearestVerticalDepth) {
            adjacent = (
              y > 0 && haloAnchors[(y - 1) * width + x] === 1
            ) || (
              y + 1 < height && haloAnchors[(y + 1) * width + x] === 1
            );
          } else {
            adjacent = (
              x > 0 && haloAnchors[y * width + x - 1] === 1
            ) || (
              x + 1 < width && haloAnchors[y * width + x + 1] === 1
            );
          }
          if (adjacent) stagedHalo[pixelIndex] = 1;
        }
      }
      for (
        let pixelIndex = 0;
        pixelIndex < removalMask.length;
        pixelIndex += 1
      ) {
        if (stagedHalo[pixelIndex]) removalMask[pixelIndex] = 1;
      }
    }

    // Fragment candidates may extend beyond the original ribbon's along-range,
    // so they are not visited by the per-ribbon finalizer above. Any candidate
    // that survived every content-protection pass is now safe to neutralize.
    for (let pixelIndex = 0; pixelIndex < removalMask.length; pixelIndex += 1) {
      if (!hardProtectionMask[pixelIndex] && removalMask[pixelIndex] === 2) {
        removalMask[pixelIndex] = 1;
      }
    }

    for (let pixelIndex = 0; pixelIndex < removalMask.length; pixelIndex += 1) {
      if (hardProtectionMask[pixelIndex] || removalMask[pixelIndex] !== 1) continue;
      const dataIndex = pixelIndex * 4;
      data[dataIndex] = 255;
      data[dataIndex + 1] = 255;
      data[dataIndex + 2] = 255;
    }

    return imageData;
  }

  function applyScannerManualToneAdjustments(imageData, brightness = 0, contrast = 0) {
    const brightnessValue = Number(brightness || 0);
    const contrastValue = Number(contrast || 0);
    if (!brightnessValue && !contrastValue) return imageData;
    const data = imageData.data;
    const factor = getScannerContrastFactor(contrastValue);
    for (let index = 0; index < data.length; index += 4) {
      data[index] = clampByte(factor * (data[index] - 128) + 128 + brightnessValue);
      data[index + 1] = clampByte(factor * (data[index + 1] - 128) + 128 + brightnessValue);
      data[index + 2] = clampByte(factor * (data[index + 2] - 128) + 128 + brightnessValue);
    }
    return imageData;
  }

  function denoiseScannerImageData(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    if (width < 3 || height < 3) return imageData;
    const source = data.slice();
    const rowStride = width * 4;

    // Cross-neighbor smoothing is applied only where the neighbors already
    // agree. It removes camera/JPEG grain inside paper and ink fills without
    // crossing a text, seal or signature edge.
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = (y * width + x) * 4;
        const leftIndex = index - 4;
        const rightIndex = index + 4;
        const topIndex = index - rowStride;
        const bottomIndex = index + rowStride;
        const centerLum = source[index] * 0.299 + source[index + 1] * 0.587 + source[index + 2] * 0.114;
        const leftLum = source[leftIndex] * 0.299 + source[leftIndex + 1] * 0.587 + source[leftIndex + 2] * 0.114;
        const rightLum = source[rightIndex] * 0.299 + source[rightIndex + 1] * 0.587 + source[rightIndex + 2] * 0.114;
        const topLum = source[topIndex] * 0.299 + source[topIndex + 1] * 0.587 + source[topIndex + 2] * 0.114;
        const bottomLum = source[bottomIndex] * 0.299 + source[bottomIndex + 1] * 0.587 + source[bottomIndex + 2] * 0.114;
        const neighborMin = Math.min(leftLum, rightLum, topLum, bottomLum);
        const neighborMax = Math.max(leftLum, rightLum, topLum, bottomLum);
        const neighborMean = (leftLum + rightLum + topLum + bottomLum) / 4;
        const neighborRange = neighborMax - neighborMin;
        const centerDelta = Math.abs(centerLum - neighborMean);
        if (neighborRange > 28 || centerDelta > 34) continue;

        const flatness = 1 - Math.max(0, Math.min(1, (neighborRange - 5) / 23));
        const detailProtection = Math.max(0, Math.min(1, (centerDelta - 7) / 27));
        const saturation = Math.max(source[index], source[index + 1], source[index + 2])
          - Math.min(source[index], source[index + 1], source[index + 2]);
        const colorProtection = Math.max(0, Math.min(0.35, saturation / 220));
        const blend = (0.26 + flatness * 0.3) * (1 - detailProtection * 0.55) * (1 - colorProtection);
        if (blend < 0.05) continue;

        for (let channel = 0; channel < 3; channel += 1) {
          const neighborAverage = (
            source[leftIndex + channel]
            + source[rightIndex + channel]
            + source[topIndex + channel]
            + source[bottomIndex + channel]
          ) / 4;
          data[index + channel] = source[index + channel] * (1 - blend) + neighborAverage * blend;
        }
      }
    }
    return imageData;
  }

  function despeckleScannerPaperImageData(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    if (width < 3 || height < 3) return imageData;
    const removalMask = new Uint8Array(width * height);
    const rowStride = width * 4;
    const neighborOffsets = new Int32Array([
      -rowStride - 4,
      -rowStride,
      -rowStride + 4,
      -4,
      4,
      rowStride - 4,
      rowStride,
      rowStride + 4
    ]);

    // Only remove a neutral, near-white singleton when its complete local
    // context proves that it is bare paper. Dark punctuation/pencil, colored
    // seals and every connected stroke are outside these deliberately strict
    // gates, so purification cannot eat real document content.
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        if (r === 255 && g === 255 && b === 255) continue;
        const centerLum = r * 0.299 + g * 0.587 + b * 0.114;
        const centerSaturation = Math.max(r, g, b) - Math.min(r, g, b);
        if (centerLum < 242 || centerSaturation > 8) continue;

        let whiteNeighbors = 0;
        let remainingLum = 255;
        let remainingSaturation = 0;
        for (let neighborIndex = 0; neighborIndex < neighborOffsets.length; neighborIndex += 1) {
          const sourceIndex = index + neighborOffsets[neighborIndex];
          const neighborR = data[sourceIndex];
          const neighborG = data[sourceIndex + 1];
          const neighborB = data[sourceIndex + 2];
          const neighborLum = neighborR * 0.299 + neighborG * 0.587 + neighborB * 0.114;
          const neighborSaturation = Math.max(neighborR, neighborG, neighborB)
            - Math.min(neighborR, neighborG, neighborB);
          if (neighborLum >= 252 && neighborSaturation <= 10) {
            whiteNeighbors += 1;
          } else {
            remainingLum = neighborLum;
            remainingSaturation = neighborSaturation;
          }
        }

        const completelyIsolated = whiteNeighbors === 8;
        const almostIsolated = whiteNeighbors === 7
          && centerLum >= 248
          && remainingLum >= 238
          && remainingSaturation <= 16
          && !(remainingLum < 252 && Math.abs(remainingLum - centerLum) <= 10);
        if (completelyIsolated || almostIsolated) removalMask[y * width + x] = 1;
      }
    }

    for (let pixelIndex = 0; pixelIndex < removalMask.length; pixelIndex += 1) {
      if (!removalMask[pixelIndex]) continue;
      const index = pixelIndex * 4;
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
    }
    return imageData;
  }

  function blurScannerLuminance(source, width, height, radius) {
    const blurRadius = Math.max(1, Math.round(radius || 1));
    const horizontal = new Uint8Array(source.length);
    const output = new Uint8Array(source.length);

    for (let y = 0; y < height; y += 1) {
      const rowOffset = y * width;
      let sum = 0;
      let count = 0;
      for (let x = -blurRadius; x < width + blurRadius; x += 1) {
        const addX = x + blurRadius;
        if (addX >= 0 && addX < width) {
          sum += source[rowOffset + addX];
          count += 1;
        }
        const removeX = x - blurRadius - 1;
        if (removeX >= 0 && removeX < width) {
          sum -= source[rowOffset + removeX];
          count -= 1;
        }
        if (x >= 0 && x < width) horizontal[rowOffset + x] = Math.round(sum / Math.max(1, count));
      }
    }

    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let y = -blurRadius; y < height + blurRadius; y += 1) {
        const addY = y + blurRadius;
        if (addY >= 0 && addY < height) {
          sum += horizontal[addY * width + x];
          count += 1;
        }
        const removeY = y - blurRadius - 1;
        if (removeY >= 0 && removeY < height) {
          sum -= horizontal[removeY * width + x];
          count -= 1;
        }
        if (y >= 0 && y < height) output[y * width + x] = Math.round(sum / Math.max(1, count));
      }
    }

    return output;
  }

  function buildScannerTextureFingerprint(values, width, height) {
    const horizontal = new Float32Array(values.length);
    const smoothed = new Float32Array(values.length);
    const residuals = new Float32Array(values.length);
    const weights = [1, 4, 6, 4, 1];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let sum = 0;
        for (let offset = -2; offset <= 2; offset += 1) {
          const sampleX = Math.max(0, Math.min(width - 1, x + offset));
          sum += values[y * width + sampleX] * weights[offset + 2];
        }
        horizontal[y * width + x] = sum / 16;
      }
    }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let sum = 0;
        for (let offset = -2; offset <= 2; offset += 1) {
          const sampleY = Math.max(0, Math.min(height - 1, y + offset));
          sum += horizontal[sampleY * width + x] * weights[offset + 2];
        }
        const pixelIndex = y * width + x;
        smoothed[pixelIndex] = sum / 16;
        residuals[pixelIndex] = values[pixelIndex] - smoothed[pixelIndex];
      }
    }

    const tileSize = 16;
    const tileSigmas = [];
    const tileAlternations = [];
    let flaggedTiles = 0;
    for (let y0 = 0; y0 < height; y0 += tileSize) {
      const y1 = Math.min(height, y0 + tileSize);
      for (let x0 = 0; x0 < width; x0 += tileSize) {
        const x1 = Math.min(width, x0 + tileSize);
        const histogram = new Uint16Array(256);
        let sampleCount = 0;
        for (let y = y0; y < y1; y += 1) {
          for (let x = x0; x < x1; x += 1) {
            const absoluteResidual = Math.max(0, Math.min(255, Math.round(Math.abs(residuals[y * width + x]))));
            histogram[absoluteResidual] += 1;
            sampleCount += 1;
          }
        }
        const medianTarget = Math.floor(sampleCount / 2);
        let cumulative = 0;
        let medianAbsoluteResidual = 0;
        for (let bucket = 0; bucket < histogram.length; bucket += 1) {
          cumulative += histogram[bucket];
          if (cumulative > medianTarget) {
            medianAbsoluteResidual = bucket;
            break;
          }
        }
        const sigma = medianAbsoluteResidual * 1.4826;
        const residualThreshold = Math.max(3, sigma * 0.7);
        let alternating = 0;
        let alternatingCandidates = 0;
        for (let y = y0; y < y1; y += 1) {
          for (let x = x0; x < x1; x += 1) {
            const pixelIndex = y * width + x;
            const residual = residuals[pixelIndex];
            alternatingCandidates += 1;
            if (Math.abs(residual) <= residualThreshold) continue;
            const rightResidual = x + 1 < width ? residuals[pixelIndex + 1] : residual;
            const bottomResidual = y + 1 < height ? residuals[pixelIndex + width] : residual;
            if (residual * rightResidual < 0 || residual * bottomResidual < 0) alternating += 1;
          }
        }
        const alternation = alternating / Math.max(1, alternatingCandidates);
        tileSigmas.push(sigma);
        tileAlternations.push(alternation);
        if (sigma >= 4 && sigma <= 26 && alternation > 0.27) flaggedTiles += 1;
      }
    }

    tileSigmas.sort((first, second) => first - second);
    tileAlternations.sort((first, second) => first - second);
    const middle = Math.floor(tileSigmas.length / 2);
    return {
      sigma: tileSigmas.length ? tileSigmas[middle] : 0,
      alternation: tileAlternations.length ? tileAlternations[middle] : 0,
      flaggedTileRatio: flaggedTiles / Math.max(1, tileSigmas.length)
    };
  }

  function buildScannerStructuredNoiseProfile(normalizedLuminance, sourceWidth, sourceHeight) {
    const thumbnailScale = Math.min(1, 720 / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(24, Math.round(sourceWidth * thumbnailScale));
    const height = Math.max(24, Math.round(sourceHeight * thumbnailScale));
    const values = new Uint8Array(width * height);

    const sourcePixelWidth = sourceWidth / width;
    const sourcePixelHeight = sourceHeight / height;
    for (let y = 0; y < height; y += 1) {
      const centerY = (y + 0.5) * sourcePixelHeight - 0.5;
      const y0 = Math.max(0, Math.min(sourceHeight - 1, Math.round(centerY - sourcePixelHeight * 0.25)));
      const y1 = Math.max(0, Math.min(sourceHeight - 1, Math.round(centerY + sourcePixelHeight * 0.25)));
      for (let x = 0; x < width; x += 1) {
        const centerX = (x + 0.5) * sourcePixelWidth - 0.5;
        const x0 = Math.max(0, Math.min(sourceWidth - 1, Math.round(centerX - sourcePixelWidth * 0.25)));
        const x1 = Math.max(0, Math.min(sourceWidth - 1, Math.round(centerX + sourcePixelWidth * 0.25)));
        values[y * width + x] = Math.round((
          normalizedLuminance[y0 * sourceWidth + x0]
          + normalizedLuminance[y0 * sourceWidth + x1]
          + normalizedLuminance[y1 * sourceWidth + x0]
          + normalizedLuminance[y1 * sourceWidth + x1]
        ) / 4);
      }
    }

    const integralStride = width + 1;
    const integralSize = integralStride * (height + 1);
    // Double precision matters here: squared-luminance integrals reach tens
    // of billions on the 720px analysis image. Float32 cancellation would
    // turn a uniform page into position-dependent fake variance.
    const sums = new Float64Array(integralSize);
    const squaredSums = new Float64Array(integralSize);
    for (let y = 0; y < height; y += 1) {
      let rowSum = 0;
      let rowSquaredSum = 0;
      for (let x = 0; x < width; x += 1) {
        const value = values[y * width + x];
        rowSum += value;
        rowSquaredSum += value * value;
        const integralIndex = (y + 1) * integralStride + x + 1;
        sums[integralIndex] = sums[integralIndex - integralStride] + rowSum;
        squaredSums[integralIndex] = squaredSums[integralIndex - integralStride] + rowSquaredSum;
      }
    }

    const means = new Float32Array(values.length);
    const paperLevels = new Float32Array(values.length);
    const thresholds = new Float32Array(values.length);
    const deviations = new Float32Array(values.length);
    const statisticsRadius = Math.max(5, Math.min(16, Math.round(Math.min(width, height) * 0.022)));
    let busyCells = 0;
    let deviationSum = 0;
    let eligibleCells = 0;

    for (let y = 0; y < height; y += 1) {
      const y0 = Math.max(0, y - statisticsRadius);
      const y1 = Math.min(height - 1, y + statisticsRadius);
      for (let x = 0; x < width; x += 1) {
        const x0 = Math.max(0, x - statisticsRadius);
        const x1 = Math.min(width - 1, x + statisticsRadius);
        const topLeft = y0 * integralStride + x0;
        const topRight = y0 * integralStride + x1 + 1;
        const bottomLeft = (y1 + 1) * integralStride + x0;
        const bottomRight = (y1 + 1) * integralStride + x1 + 1;
        const count = (x1 - x0 + 1) * (y1 - y0 + 1);
        const sum = sums[bottomRight] - sums[topRight] - sums[bottomLeft] + sums[topLeft];
        const squaredSum = squaredSums[bottomRight] - squaredSums[topRight]
          - squaredSums[bottomLeft] + squaredSums[topLeft];
        const mean = sum / Math.max(1, count);
        const variance = Math.max(0, squaredSum / Math.max(1, count) - mean * mean);
        const deviation = Math.sqrt(variance);
        const fieldIndex = y * width + x;
        means[fieldIndex] = mean;
        deviations[fieldIndex] = deviation;
        paperLevels[fieldIndex] = Math.min(255, mean + deviation * 0.34);
        // Sauvola's local threshold is used as a soft ink guard, never as a
        // hard black/white conversion. That protects weak writing while the
        // low-frequency paper estimate removes repeating screen texture.
        thresholds[fieldIndex] = mean * (1 + 0.34 * (deviation / 128 - 1));
        if (mean >= 92 && mean <= 253) {
          eligibleCells += 1;
          deviationSum += deviation;
          if (deviation >= 9.5) busyCells += 1;
        }
      }
    }

    const sampleStep = Math.max(1, Math.floor(Math.sqrt(sourceWidth * sourceHeight / 145000)));
    let textureSamples = 0;
    let textureCandidates = 0;
    let differenceSum = 0;
    for (let y = 1; y < sourceHeight - 1; y += sampleStep) {
      for (let x = 1; x < sourceWidth - 1; x += sampleStep) {
        const pixelIndex = y * sourceWidth + x;
        const center = normalizedLuminance[pixelIndex];
        if (center < 88) continue;
        const left = normalizedLuminance[pixelIndex - 1];
        const right = normalizedLuminance[pixelIndex + 1];
        const top = normalizedLuminance[pixelIndex - sourceWidth];
        const bottom = normalizedLuminance[pixelIndex + sourceWidth];
        const neighborRange = Math.max(center, left, right, top, bottom)
          - Math.min(center, left, right, top, bottom);
        const difference = (
          Math.abs(center - left)
          + Math.abs(center - right)
          + Math.abs(center - top)
          + Math.abs(center - bottom)
        ) / 4;
        textureCandidates += 1;
        differenceSum += difference;
        if (neighborRange >= 10 && difference >= 4.2) textureSamples += 1;
      }
    }

    const textureRatio = textureSamples / Math.max(1, textureCandidates);
    const meanDifference = differenceSum / Math.max(1, textureCandidates);
    const busyRatio = busyCells / Math.max(1, eligibleCells);
    const meanDeviation = deviationSum / Math.max(1, eligibleCells);
    const textureFingerprint = buildScannerTextureFingerprint(values, width, height);
    // Dense security-paper screening alternates above and below its local
    // 5x5 base across most tiles. Real text and a few photographed shadows can
    // have high gradients too, but they do not create page-wide alternating
    // residuals. Requiring all three fingerprint signals prevents the strong
    // restoration branch from touching the already-good clear documents.
    // The carrier keeps its pixel period as the working image scales up, so
    // on export-size renders the 720px fingerprint thumbnail averages it away
    // and sigma stays low while the full-resolution sampler still sees almost
    // every background pixel swinging against its direct neighbors. Accept
    // that as an independent signal so the same document is purified
    // identically at preview and export sizes.
    const fineCarrier = textureRatio >= 0.62 && meanDifference >= 5;
    // Perspective reduction can alias a photographed security weave into
    // wider stepped bands. Direct-neighbor textureRatio then falls below the
    // fine-carrier gate even though robust residuals still alternate across
    // most of the page. Detect that broad carrier independently so the later
    // purification pass runs instead of contrast-enhancing the bands.
    const broadCarrier = textureFingerprint.sigma >= 5.5
      && textureFingerprint.alternation >= 0.22
      && textureFingerprint.flaggedTileRatio >= 0.48
      && busyRatio >= 0.55
      && meanDifference >= 6;
    const active = (textureFingerprint.sigma >= 3.8 && textureRatio >= 0.58)
      || fineCarrier
      || broadCarrier;
    const severity = Math.max(
      Math.max(0, Math.min(1, (textureFingerprint.sigma - 3.8) / 8)),
      Math.max(0, Math.min(1, (textureFingerprint.alternation - 0.195) / 0.25)),
      Math.max(0, Math.min(1, (textureFingerprint.flaggedTileRatio - 0.38) / 0.45)),
      fineCarrier ? Math.max(0, Math.min(1, (meanDifference - 5) / 18)) : 0
    );

    return {
      active,
      broadCarrier,
      strength: active ? Math.min(0.99, 0.94 + severity * 0.05) : 0,
      width,
      height,
      sourceWidth,
      sourceHeight,
      means,
      paperLevels,
      thresholds,
      deviations,
      textureRatio,
      meanDifference,
      busyRatio,
      meanDeviation,
      textureSigma: textureFingerprint.sigma,
      textureAlternation: textureFingerprint.alternation,
      texturedTileRatio: textureFingerprint.flaggedTileRatio
    };
  }

  function fillScannerStructuredNoiseRow(profile, values, y, outputRow) {
    const outputWidth = outputRow.length;
    if (!profile.x0Lookup || profile.x0Lookup.length !== outputWidth) {
      profile.x0Lookup = new Uint32Array(outputWidth);
      profile.xBlendLookup = new Float32Array(outputWidth);
      for (let x = 0; x < outputWidth; x += 1) {
        const gx = outputWidth > 1 ? x * (profile.width - 1) / (outputWidth - 1) : 0;
        profile.x0Lookup[x] = Math.floor(gx);
        profile.xBlendLookup[x] = gx - profile.x0Lookup[x];
      }
    }
    const gy = profile.sourceHeight > 1 ? y * (profile.height - 1) / (profile.sourceHeight - 1) : 0;
    const y0 = Math.max(0, Math.min(profile.height - 1, Math.floor(gy)));
    const y1 = Math.min(profile.height - 1, y0 + 1);
    const ty = gy - y0;
    for (let x = 0; x < outputWidth; x += 1) {
      const x0 = profile.x0Lookup[x];
      const x1 = Math.min(profile.width - 1, x0 + 1);
      const tx = profile.xBlendLookup[x];
      const top = values[y0 * profile.width + x0] * (1 - tx) + values[y0 * profile.width + x1] * tx;
      const bottom = values[y1 * profile.width + x0] * (1 - tx) + values[y1 * profile.width + x1] * tx;
      outputRow[x] = top * (1 - ty) + bottom * ty;
    }
  }

  function buildScannerContentProtectionMask(normalizedLuminance, profile, width, height) {
    // A broad aliased carrier needs a slightly coarser area reduction before
    // content-mask analysis. At 960px the weave is still resolved and gets
    // protected as ink, producing the blocky dashed preview. Clear documents
    // and fine carriers retain the higher-resolution 960px analysis path.
    const analysisLongEdge = profile && profile.broadCarrier ? 720 : 960;
    const analysisScale = Math.min(1, analysisLongEdge / Math.max(width, height));
    if (analysisScale < 0.999) {
      // True area averaging, not point sampling: undersampling a dense screen
      // aliases it into fake moire blobs that the closings cannot remove, and
      // those blobs then get protected as "content" (blocky gray bands around
      // text). Area reduction averages the carrier away before analysis.
      const analysisThumbnail = buildScannerAreaLuminanceThumbnail(normalizedLuminance, width, height, analysisScale);
      const analysisWidth = analysisThumbnail.width;
      const analysisHeight = analysisThumbnail.height;
      const analysisLuminance = analysisThumbnail.values;
      const analysisProfile = {
        ...profile,
        sourceWidth: analysisWidth,
        sourceHeight: analysisHeight,
        x0Lookup: null,
        xBlendLookup: null
      };
      const analysisMask = buildScannerContentProtectionMask(
        analysisLuminance,
        analysisProfile,
        analysisWidth,
        analysisHeight
      );
      const outputMask = new Uint8Array(width * height);
      for (let y = 0; y < height; y += 1) {
        const sampleY = Math.max(0, Math.min(
          analysisHeight - 1,
          (y + 0.5) * analysisHeight / height - 0.5
        ));
        const y0 = Math.floor(sampleY);
        const y1 = Math.min(analysisHeight - 1, y0 + 1);
        const yBlend = sampleY - y0;
        for (let x = 0; x < width; x += 1) {
          const sampleX = Math.max(0, Math.min(
            analysisWidth - 1,
            (x + 0.5) * analysisWidth / width - 0.5
          ));
          const x0 = Math.floor(sampleX);
          const x1 = Math.min(analysisWidth - 1, x0 + 1);
          const xBlend = sampleX - x0;
          const top = analysisMask[y0 * analysisWidth + x0] * (1 - xBlend)
            + analysisMask[y0 * analysisWidth + x1] * xBlend;
          const bottom = analysisMask[y1 * analysisWidth + x0] * (1 - xBlend)
            + analysisMask[y1 * analysisWidth + x1] * xBlend;
          outputMask[y * width + x] = Math.round(top * (1 - yBlend) + bottom * yBlend);
        }
      }
      return outputMask;
    }

    const luminance = new Float32Array(normalizedLuminance.length);
    luminance.set(normalizedLuminance);
    const closingRadius = Math.max(1, Math.min(6, Math.round(Math.max(width, height) / 520)));
    // A one-dimensional grayscale closing removes small dark screen dots but
    // preserves strokes running in the closing direction. Taking the darker
    // result of horizontal and vertical closings retains table rules, printed
    // text and locally horizontal/vertical handwriting without accepting raw
    // halftone troughs as content.
    const horizontalMaximum = applyScannerMorphologyHorizontal(luminance, width, height, closingRadius, true);
    const horizontalClosed = applyScannerMorphologyHorizontal(horizontalMaximum, width, height, closingRadius, false);
    const verticalMaximum = applyScannerMorphologyVertical(luminance, width, height, closingRadius, true);
    const verticalClosed = applyScannerMorphologyVertical(verticalMaximum, width, height, closingRadius, false);
    const rawMask = new Uint8Array(width * height);
    const deepMask = new Uint8Array(width * height);
    const veryDeepMask = new Uint8Array(width * height);
    const strokeMask = new Uint8Array(width * height);
    const mask = new Uint8Array(width * height);
    const meanRow = new Float32Array(width);
    const thresholdRow = new Float32Array(width);
    const deviationRow = new Float32Array(width);

    for (let y = 0; y < height; y += 1) {
      fillScannerStructuredNoiseRow(profile, profile.means, y, meanRow);
      fillScannerStructuredNoiseRow(profile, profile.thresholds, y, thresholdRow);
      fillScannerStructuredNoiseRow(profile, profile.deviations, y, deviationRow);
      for (let x = 0; x < width; x += 1) {
        const pixelIndex = y * width + x;
        const localDeviation = deviationRow[x];
        const directionalLum = Math.min(horizontalClosed[pixelIndex], verticalClosed[pixelIndex]);
        const directionalDarkness = meanRow[x] - directionalLum;
        // The closings bridge gaps along a text line, which used to mask the
        // bare paper between segments and let its screen texture survive as
        // gray bands. The analysis image is area-averaged (carrier-free), so
        // requiring the pixel itself to be dark removes that bridge credit
        // without losing any real mark, however faint.
        const ownDepression = meanRow[x] - luminance[pixelIndex];
        const ownCredit = Math.max(0, Math.min(1, (ownDepression - 3) / 13));
        const strokeFloor = Math.max(7, localDeviation * 0.48);
        const coherentStroke = Math.max(0, Math.min(1, (directionalDarkness - strokeFloor) / 18)) * ownCredit;
        const deepInk = Math.max(0, Math.min(1, (thresholdRow[x] - 12 - directionalLum) / 28)) * ownCredit;
        deepMask[pixelIndex] = Math.round(deepInk * 255);
        veryDeepMask[pixelIndex] = Math.round(
          Math.max(0, Math.min(1, (thresholdRow[x] - 38 - directionalLum) / 24)) * ownCredit * 255
        );
        strokeMask[pixelIndex] = Math.round(coherentStroke * 255);
      }
    }

    // Screen texture creates weak candidates across a large part of every
    // small neighborhood. A real thin signature or table rule occupies a
    // narrow coherent path. Suppress only densely repeated weak candidates;
    // deep ink remains unconditional.
    const densityStride = width + 1;
    const densityIntegral = new Uint32Array(densityStride * (height + 1));
    for (let y = 0; y < height; y += 1) {
      let rowCount = 0;
      for (let x = 0; x < width; x += 1) {
        const pixelIndex = y * width + x;
        // Only weak candidates vote for "repeated texture". Confident ink is
        // document content; counting it let dense handwriting lines suppress
        // their own protection and get reconstructed as smears.
        const candidateValue = Math.max(strokeMask[pixelIndex], deepMask[pixelIndex]);
        if (candidateValue >= 18 && candidateValue < 128) rowCount += 1;
        const integralIndex = (y + 1) * densityStride + x + 1;
        densityIntegral[integralIndex] = densityIntegral[integralIndex - densityStride] + rowCount;
      }
    }
    const densityRadius = Math.max(4, Math.min(10, Math.round(Math.max(width, height) / 150)));
    for (let y = 0; y < height; y += 1) {
      const y0 = Math.max(0, y - densityRadius);
      const y1 = Math.min(height - 1, y + densityRadius);
      for (let x = 0; x < width; x += 1) {
        const x0 = Math.max(0, x - densityRadius);
        const x1 = Math.min(width - 1, x + densityRadius);
        const topLeft = y0 * densityStride + x0;
        const topRight = y0 * densityStride + x1 + 1;
        const bottomLeft = (y1 + 1) * densityStride + x0;
        const bottomRight = (y1 + 1) * densityStride + x1 + 1;
        const count = densityIntegral[bottomRight] - densityIntegral[topRight]
          - densityIntegral[bottomLeft] + densityIntegral[topLeft];
        const area = (x1 - x0 + 1) * (y1 - y0 + 1);
        const density = count / Math.max(1, area);
        const repeatedTexture = Math.max(0, Math.min(1, (density - 0.2) / 0.3));
        const pixelIndex = y * width + x;
        // Suppression scales with candidate weakness: page-wide weave gives
        // weak candidates and is still removed, while a confident stroke in a
        // busy neighborhood keeps its protection instead of being smeared.
        const strokeWeakness = Math.max(0, Math.min(1, (150 - strokeMask[pixelIndex]) / 120));
        const deepWeakness = Math.max(0, Math.min(1, (150 - deepMask[pixelIndex]) / 120));
        const protectedStroke = strokeMask[pixelIndex] * (1 - repeatedTexture * 0.94 * strokeWeakness);
        const protectedDeep = deepMask[pixelIndex] * (1 - repeatedTexture * 0.86 * deepWeakness);
        rawMask[pixelIndex] = Math.round(Math.max(
          veryDeepMask[pixelIndex],
          protectedDeep,
          protectedStroke
        ));
      }
    }

    // One-pixel dilation keeps antialiasing on the edge of protected writing
    // and seals. The reduced neighbor weight prevents a protected stroke from
    // carrying the surrounding paper texture with it.
    mask.set(rawMask);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixelIndex = y * width + x;
        const neighborValue = Math.round(rawMask[pixelIndex] * 0.82);
        if (!neighborValue) continue;
        for (let oy = -1; oy <= 1; oy += 1) {
          const sampleY = y + oy;
          if (sampleY < 0 || sampleY >= height) continue;
          for (let ox = -1; ox <= 1; ox += 1) {
            if (!ox && !oy) continue;
            const sampleX = x + ox;
            if (sampleX < 0 || sampleX >= width) continue;
            const neighborIndex = sampleY * width + sampleX;
            if (neighborValue > mask[neighborIndex]) mask[neighborIndex] = neighborValue;
          }
        }
      }
    }
    return mask;
  }

  function purifyScannerStructuredNoise(imageData, normalizedLuminance, profile) {
    if (!profile || !profile.active) return imageData;
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const source = data.slice();
    // The coherent-reconstruction blur only needs to span the screen carrier,
    // not a fixed fraction of the page. Uncapped it reached ~46px on export
    // renders, where dense handwriting lines collapsed into one smeared
    // depression and thin strokes averaged away entirely.
    const smoothingRadius = Math.max(3, Math.min(16, Math.round(Math.max(width, height) * 0.012)));
    // Clip ink depth before blurring: unclipped, a bold stroke drags the blur
    // down across its whole window and the 3.7x rebuild paints a gray halo
    // band around every dense text line. Clipped, deep ink contributes no
    // more than a faint mark would, so halos stay below the texture floor
    // while genuinely faint coherent marks (shallower than the clip) rebuild
    // at full strength.
    const coherentClipDepth = 45;
    const clippedLuminance = new Uint8Array(normalizedLuminance.length);
    {
      const clipMeanRow = new Float32Array(width);
      for (let y = 0; y < height; y += 1) {
        fillScannerStructuredNoiseRow(profile, profile.means, y, clipMeanRow);
        const rowOffset = y * width;
        for (let x = 0; x < width; x += 1) {
          const floorValue = clipMeanRow[x] - coherentClipDepth;
          const value = normalizedLuminance[rowOffset + x];
          clippedLuminance[rowOffset + x] = value < floorValue ? floorValue : value;
        }
      }
    }
    const smoothedLuminance = blurScannerLuminance(clippedLuminance, width, height, smoothingRadius);
    // Carrier-sized blur: one full screen period fits in the window, so the
    // weave averages to paper while real strokes keep nearly full depth. This
    // is the fidelity floor that guarantees legible text at 1:1 darkness no
    // matter what the coarser reconstruction and protection masks decide.
    const detailLuminance = blurScannerLuminance(normalizedLuminance, width, height, 3);
    const contentMask = buildScannerContentProtectionMask(normalizedLuminance, profile, width, height);
    profile.contentMask = contentMask;
    const meanRow = new Float32Array(width);
    const deviationRow = new Float32Array(width);

    for (let y = 0; y < height; y += 1) {
      fillScannerStructuredNoiseRow(profile, profile.means, y, meanRow);
      fillScannerStructuredNoiseRow(profile, profile.deviations, y, deviationRow);
      for (let x = 0; x < width; x += 1) {
        const pixelIndex = y * width + x;
        const index = pixelIndex * 4;
        const smoothedLum = smoothedLuminance[pixelIndex];
        const paperLevel = meanRow[x];
        const localDeviation = deviationRow[x];
        const coherentDarkness = paperLevel - smoothedLum;
        const outputSaturation = Math.max(source[index], source[index + 1], source[index + 2])
          - Math.min(source[index], source[index + 1], source[index + 2]);
        const colorInk = Math.max(0, Math.min(1, (outputSaturation - 4) / 18));
        const sourceLum = getScannerLuminance(source[index], source[index + 1], source[index + 2]);
        const sourceDarkness = 255 - sourceLum;
        const contentProtection = contentMask[pixelIndex] / 255;
        // Reconstruct weak gray marks from their low-frequency darkness
        // instead of retaining the original high-frequency pixel. A thin
        // handwriting stroke still leaves a small coherent depression after
        // the box blur; alternating paper weave averages away. The modest
        // gain restores that stroke's readable density without restoring the
        // weave that crossed it.
        const textureFloor = 2.5 + Math.min(3, localDeviation * 0.035);
        const coherentTargetDarkness = Math.max(0, Math.min(145, (coherentDarkness - textureFloor) * 3.7));
        const protectedDarkness = Math.max(
          sourceDarkness * contentProtection,
          sourceDarkness * colorInk * 0.9
        );
        // Kept at 1:1, never amplified: whatever survives the carrier-sized
        // blur is document detail, whatever averages away was the screen.
        // Taking the minimum with the pixel's own depression stops the blur
        // window from painting gray halos onto the paper beside a stroke and
        // stops isolated carrier troughs from passing as detail.
        // Both caps matter: near text the local deviation is inflated by the
        // text itself, and an uncapped gate/floor would disqualify the very
        // strokes it is meant to protect.
        const detailFloor = Math.max(9, Math.min(18, localDeviation * 0.45));
        const detailDarkness = Math.max(
          0,
          Math.min(paperLevel - detailLuminance[pixelIndex], paperLevel - sourceLum) - detailFloor
        );
        let targetLum = 255 - Math.max(coherentTargetDarkness, protectedDarkness, detailDarkness);
        if (contentProtection < 0.12 && colorInk < 0.1 && targetLum >= 238) targetLum = 255;
        const colorRetention = Math.min(1, colorInk * 1.05);
        const targetR = targetLum + (source[index] - sourceLum) * colorRetention;
        const targetG = targetLum + (source[index + 1] - sourceLum) * colorRetention;
        const targetB = targetLum + (source[index + 2] - sourceLum) * colorRetention;
        data[index] = source[index] * (1 - profile.strength) + targetR * profile.strength;
        data[index + 1] = source[index + 1] * (1 - profile.strength) + targetG * profile.strength;
        data[index + 2] = source[index + 2] * (1 - profile.strength) + targetB * profile.strength;
      }
    }

    return imageData;
  }

  function buildScannerAreaLuminanceThumbnail(luminance, width, height, scale) {
    const thumbnailWidth = Math.max(24, Math.round(width * scale));
    const thumbnailHeight = Math.max(24, Math.round(height * scale));
    const sums = new Float64Array(thumbnailWidth * thumbnailHeight);
    const counts = new Uint16Array(sums.length);
    for (let y = 0; y < height; y += 1) {
      const thumbnailY = Math.min(
        thumbnailHeight - 1,
        Math.floor((y + 0.5) * thumbnailHeight / height)
      );
      for (let x = 0; x < width; x += 1) {
        const thumbnailX = Math.min(
          thumbnailWidth - 1,
          Math.floor((x + 0.5) * thumbnailWidth / width)
        );
        const thumbnailIndex = thumbnailY * thumbnailWidth + thumbnailX;
        sums[thumbnailIndex] += luminance[y * width + x];
        counts[thumbnailIndex] += 1;
      }
    }
    const values = new Float32Array(sums.length);
    for (let index = 0; index < values.length; index += 1) {
      values[index] = sums[index] / Math.max(1, counts[index]);
    }
    return { width: thumbnailWidth, height: thumbnailHeight, values };
  }

  function buildScannerSoftInkThresholds(thumbnail, sourceRadius, scale) {
    const width = thumbnail.width;
    const height = thumbnail.height;
    const values = thumbnail.values;
    const integralStride = width + 1;
    const integralSize = integralStride * (height + 1);
    const sums = new Float64Array(integralSize);
    const squaredSums = new Float64Array(integralSize);
    for (let y = 0; y < height; y += 1) {
      let rowSum = 0;
      let rowSquaredSum = 0;
      for (let x = 0; x < width; x += 1) {
        const value = values[y * width + x];
        rowSum += value;
        rowSquaredSum += value * value;
        const index = (y + 1) * integralStride + x + 1;
        sums[index] = sums[index - integralStride] + rowSum;
        squaredSums[index] = squaredSums[index - integralStride] + rowSquaredSum;
      }
    }

    const radius = Math.max(3, Math.round(sourceRadius * scale));
    const thresholds = new Float32Array(values.length);
    for (let y = 0; y < height; y += 1) {
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(height - 1, y + radius);
      for (let x = 0; x < width; x += 1) {
        const x0 = Math.max(0, x - radius);
        const x1 = Math.min(width - 1, x + radius);
        const topLeft = y0 * integralStride + x0;
        const topRight = y0 * integralStride + x1 + 1;
        const bottomLeft = (y1 + 1) * integralStride + x0;
        const bottomRight = (y1 + 1) * integralStride + x1 + 1;
        const count = (x1 - x0 + 1) * (y1 - y0 + 1);
        const sum = sums[bottomRight] - sums[topRight] - sums[bottomLeft] + sums[topLeft];
        const squaredSum = squaredSums[bottomRight] - squaredSums[topRight]
          - squaredSums[bottomLeft] + squaredSums[topLeft];
        const mean = sum / Math.max(1, count);
        const deviation = Math.sqrt(Math.max(0, squaredSum / Math.max(1, count) - mean * mean));
        thresholds[y * width + x] = mean * (1 + 0.38 * (deviation / 128 - 1));
      }
    }
    return thresholds;
  }

  function neutralizeScannerPeriodicPattern(imageData, profile) {
    const extremePeriodicPattern = profile
      && profile.active
      && profile.textureSigma >= 8
      && profile.texturedTileRatio >= 0.55
      && profile.meanDifference >= 14;
    if (!extremePeriodicPattern) return imageData;
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const source = data.slice();
    const luminance = new Float32Array(width * height);
    for (let pixelIndex = 0; pixelIndex < luminance.length; pixelIndex += 1) {
      const index = pixelIndex * 4;
      luminance[pixelIndex] = getScannerLuminance(
        source[index],
        source[index + 1],
        source[index + 2]
      );
    }

    // Area reduction destroys the repeating carrier instead of allowing it to
    // alias into wider dashed bands. A soft Sauvola reconstruction then keeps
    // coherent document ink without turning the result into harsh binary B/W.
    // The thumbnail only supplies the smooth local thresholds; ink darkness is
    // rebuilt from a small-radius descreen of the full-resolution luminance,
    // otherwise every stroke edge would be re-rendered from thumbnail pixels
    // and the page would lose most of its real resolution.
    const scale = Math.max(0.42, Math.min(0.78, 500 / Math.max(width, height)));
    const thumbnail = buildScannerAreaLuminanceThumbnail(luminance, width, height, scale);
    const sourceRadius = Math.max(6, Math.round(Math.max(width, height) * 0.017));
    const thresholds = buildScannerSoftInkThresholds(thumbnail, sourceRadius, scale);
    const descreenRadius = Math.max(2, Math.round(Math.max(width, height) * 0.0014));
    const descreenedLuminance = blurScannerLuminance(luminance, width, height, descreenRadius);
    const x0Lookup = new Uint32Array(width);
    const xBlendLookup = new Float32Array(width);
    for (let x = 0; x < width; x += 1) {
      const gx = width > 1 ? x * (thumbnail.width - 1) / (width - 1) : 0;
      x0Lookup[x] = Math.floor(gx);
      xBlendLookup[x] = gx - x0Lookup[x];
    }

    for (let y = 0; y < height; y += 1) {
      const gy = height > 1 ? y * (thumbnail.height - 1) / (height - 1) : 0;
      const y0 = Math.floor(gy);
      const y1 = Math.min(thumbnail.height - 1, y0 + 1);
      const ty = gy - y0;
      for (let x = 0; x < width; x += 1) {
        const x0 = x0Lookup[x];
        const x1 = Math.min(thumbnail.width - 1, x0 + 1);
        const tx = xBlendLookup[x];
        const topLeft = y0 * thumbnail.width + x0;
        const topRight = y0 * thumbnail.width + x1;
        const bottomLeft = y1 * thumbnail.width + x0;
        const bottomRight = y1 * thumbnail.width + x1;
        const lowLuminance = (
          thumbnail.values[topLeft] * (1 - tx) + thumbnail.values[topRight] * tx
        ) * (1 - ty) + (
          thumbnail.values[bottomLeft] * (1 - tx) + thumbnail.values[bottomRight] * tx
        ) * ty;
        const threshold = (
          thresholds[topLeft] * (1 - tx) + thresholds[topRight] * tx
        ) * (1 - ty) + (
          thresholds[bottomLeft] * (1 - tx) + thresholds[bottomRight] * tx
        ) * ty;
        const pixelIndex = y * width + x;
        // Darker of the two carrier-free estimates: the full-resolution
        // descreen keeps stroke edges sharp, while the area thumbnail keeps
        // very thin strokes (which a box blur dilutes) above the ink gate.
        const effectiveLum = Math.min(descreenedLuminance[pixelIndex], lowLuminance);
        let inkConfidence = Math.max(0, Math.min(1, (threshold + 3 - effectiveLum) / 22));
        inkConfidence *= inkConfidence * (3 - 2 * inkConfidence);
        const targetDarkness = Math.min(255, (255 - effectiveLum) * inkConfidence * 1.6);
        const index = pixelIndex * 4;
        const sourceLuminance = luminance[pixelIndex];
        const saturation = Math.max(source[index], source[index + 1], source[index + 2])
          - Math.min(source[index], source[index + 1], source[index + 2]);
        const colorInk = Math.max(0, Math.min(1, (saturation - 4) / 18));
        const darkness = Math.max(
          targetDarkness,
          (255 - sourceLuminance) * colorInk * 0.9
        );
        const targetLuminance = 255 - darkness;
        const targetR = targetLuminance + (source[index] - sourceLuminance) * colorInk;
        const targetG = targetLuminance + (source[index + 1] - sourceLuminance) * colorInk;
        const targetB = targetLuminance + (source[index + 2] - sourceLuminance) * colorInk;
        // This is a descreening correction, not a replacement document. The
        // previous full overwrite removed most neutral mid-tones and turned
        // small Arabic glyphs into disconnected black blobs. Bare paper can
        // take most of the correction, while pixels already identified as
        // coherent document content retain almost all of their pre-pass tone.
        const contentProtection = profile.contentMask
          ? profile.contentMask[pixelIndex] / 255
          : 0;
        const neutralizationAmount = 0.7 * (1 - 0.94 * contentProtection);
        data[index] = source[index] + (targetR - source[index]) * neutralizationAmount;
        data[index + 1] = source[index + 1] + (targetG - source[index + 1]) * neutralizationAmount;
        data[index + 2] = source[index + 2] + (targetB - source[index + 2]) * neutralizationAmount;
      }
    }
    return imageData;
  }

  function isScannerSeverePeriodicPattern(profile) {
    return Boolean(
      profile
      && profile.active
      && profile.textureSigma >= 8
      && profile.meanDifference >= 14
      && profile.busyRatio >= 0.68
      && (profile.textureRatio >= 0.72 || profile.texturedTileRatio >= 0.55)
    );
  }

  function applyScannerClaritySafePeriodicFilter(imageData, original, normalizedLuminance) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    if (!width || !height || !normalizedLuminance?.length) return imageData;

    // Two tiny area passes average the photographed screen cell before it can
    // become a wide moire dash. A much wider local field then measures only
    // coherent document ink. This deliberately avoids binary replacement:
    // up to 15% of the normalized source remains as a content-only fidelity
    // floor for pencil, pale seals and antialiased Arabic strokes. Neutral
    // bare paper does not keep the photographed gray cast.
    const firstDescreenPass = blurScannerLuminance(normalizedLuminance, width, height, 1);
    const descreened = blurScannerLuminance(firstDescreenPass, width, height, 1);
    const localRadius = Math.max(18, Math.min(72, Math.round(Math.max(width, height) * 0.02)));
    const localPaper = blurScannerLuminance(descreened, width, height, localRadius);
    const faintCandidate = new Uint8Array(normalizedLuminance.length);
    const longFaintInk = new Uint8Array(normalizedLuminance.length);
    const preserveLongFaintInk = Math.max(width, height) <= 2200;
    if (preserveLongFaintInk) {
      for (let pixelIndex = 0; pixelIndex < normalizedLuminance.length; pixelIndex += 1) {
        if (localPaper[pixelIndex] - normalizedLuminance[pixelIndex] >= 14) {
          faintCandidate[pixelIndex] = 1;
        }
      }
      // A faded rule or pencil stroke stays connected for many pixels; the
      // security weave breaks into short repeated dashes. Preserve only long
      // horizontal/vertical runs from this low-contrast channel, so faint real
      // marks survive without reintroducing the page-wide carrier. At native
      // export resolution the carrier itself becomes connected; the primary
      // high-resolution ink channel is already sufficient there.
      const minimumFaintRun = Math.max(15, Math.min(31, Math.round(Math.max(width, height) * 0.012)));
      for (let y = 0; y < height; y += 1) {
        const rowOffset = y * width;
        let runStart = -1;
        for (let x = 0; x <= width; x += 1) {
          const candidate = x < width && faintCandidate[rowOffset + x];
          if (candidate && runStart < 0) runStart = x;
          if (candidate || runStart < 0) continue;
          if (x - runStart >= minimumFaintRun) {
            for (let runX = runStart; runX < x; runX += 1) longFaintInk[rowOffset + runX] = 1;
          }
          runStart = -1;
        }
      }
      for (let x = 0; x < width; x += 1) {
        let runStart = -1;
        for (let y = 0; y <= height; y += 1) {
          const candidate = y < height && faintCandidate[y * width + x];
          if (candidate && runStart < 0) runStart = y;
          if (candidate || runStart < 0) continue;
          if (y - runStart >= minimumFaintRun) {
            for (let runY = runStart; runY < y; runY += 1) longFaintInk[runY * width + x] = 1;
          }
          runStart = -1;
        }
      }
    }

    for (let pixelIndex = 0; pixelIndex < normalizedLuminance.length; pixelIndex += 1) {
      const index = pixelIndex * 4;
      const normalizedSource = normalizedLuminance[pixelIndex];
      const coherentDarkness = Math.max(0, localPaper[pixelIndex] - descreened[pixelIndex]);
      let inkConfidence = Math.max(0, Math.min(1, (coherentDarkness - 24) / 24));
      inkConfidence *= inkConfidence * (3 - 2 * inkConfidence);
      if (longFaintInk[pixelIndex]) {
        let faintConfidence = Math.max(0, Math.min(
          1,
          (localPaper[pixelIndex] - normalizedSource - 10) / 24
        ));
        faintConfidence *= faintConfidence * (3 - 2 * faintConfidence) * 0.5;
        inkConfidence = Math.max(inkConfidence, faintConfidence);
      }
      const inkDarkness = Math.min(
        240,
        170 + Math.max(0, 255 - descreened[pixelIndex]) * 0.28
      );
      const originalLuminance = getScannerLuminance(
        original[index],
        original[index + 1],
        original[index + 2]
      );
      const saturation = Math.max(original[index], original[index + 1], original[index + 2])
        - Math.min(original[index], original[index + 1], original[index + 2]);
      const colorInk = Math.max(0, Math.min(1, (saturation - 5) / 28));
      const fidelityProtection = Math.min(1, Math.max(
        colorInk,
        longFaintInk[pixelIndex] ? 1 : 0,
        inkConfidence * 2
      ));
      const sourceRetention = 0.15 * fidelityProtection;
      const purifiedLuminance = 255 - inkConfidence * inkDarkness;
      let outputLuminance = purifiedLuminance * (1 - sourceRetention)
        + normalizedSource * sourceRetention;
      outputLuminance = Math.min(
        outputLuminance,
        255 - Math.max(0, 255 - normalizedSource) * colorInk * 0.86
      );
      const colorRetention = 0.15 + colorInk * 0.85;
      data[index] = outputLuminance + (original[index] - originalLuminance) * colorRetention;
      data[index + 1] = outputLuminance + (original[index + 1] - originalLuminance) * colorRetention;
      data[index + 2] = outputLuminance + (original[index + 2] - originalLuminance) * colorRetention;
    }
    return imageData;
  }

  function applyDigitalDocumentFilterToImageData(imageData, brightness = 0, contrast = 0) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const original = data.slice();

    // The coarse RGB field is used only for slow color-cast correction. A
    // morphological luma field follows hard diagonal shadows without smearing
    // them across the paper or treating the shadow itself as document detail.
    const coarseField = buildScannerBackgroundField(imageData, { smoothingPasses: 1 });
    const illuminationField = buildScannerMorphologicalLuminanceField(imageData, coarseField);
    const backgroundR = new Float32Array(width);
    const backgroundG = new Float32Array(width);
    const backgroundB = new Float32Array(width);
    const illuminationRow = new Float32Array(width);
    const normalizedLuminance = new Uint8Array(width * height);
    const baseWhitePoint = 0.865;
    const blackPoint = 0.1;

    for (let y = 0; y < height; y += 1) {
      fillScannerBackgroundRow(coarseField, y, backgroundR, backgroundG, backgroundB);
      fillScannerMorphologicalLuminanceRow(illuminationField, y, illuminationRow);
      let index = y * width * 4;
      for (let x = 0; x < width; x += 1, index += 4) {
        const bgR = Math.max(48, backgroundR[x]);
        const bgG = Math.max(48, backgroundG[x]);
        const bgB = Math.max(48, backgroundB[x]);
        const bgLum = bgR * 0.299 + bgG * 0.587 + bgB * 0.114;
        const correctedR = original[index] * Math.max(0.72, Math.min(1.4, bgLum / bgR));
        const correctedG = original[index + 1] * Math.max(0.72, Math.min(1.4, bgLum / bgG));
        const correctedB = original[index + 2] * Math.max(0.72, Math.min(1.4, bgLum / bgB));
        const correctedLum = correctedR * 0.299 + correctedG * 0.587 + correctedB * 0.114;
        const localIllumination = Math.max(48, illuminationRow[x]);
        const illuminationGain = Math.max(0.8, Math.min(3.4, 248 / localIllumination));
        const nR = correctedR * illuminationGain;
        const nG = correctedG * illuminationGain;
        const nB = correctedB * illuminationGain;
        const scaledLum = nR * 0.299 + nG * 0.587 + nB * 0.114;
        const nLum = Math.min(255, scaledLum);
        normalizedLuminance[y * width + x] = Math.round(nLum);
        const relativeChroma = (
          Math.max(correctedR, correctedG, correctedB)
          - Math.min(correctedR, correctedG, correctedB)
        ) / Math.max(1, correctedLum);

        // Raise the white point around real local detail. Bare paper still
        // becomes clean white, while faint gray pencil and pale colored stamps
        // get a longer shoulder instead of falling over a hard bleach cutoff.
        const reflectance = correctedLum / localIllumination;
        const darknessDetail = Math.max(0, Math.min(1, (0.965 - reflectance) / 0.34));
        const chromaDetail = Math.max(0, Math.min(1, (relativeChroma - 0.15) / 0.15));
        const colorDetail = Math.sqrt(chromaDetail);
        const detailStrength = Math.max(darknessDetail, colorDetail);
        const whitePoint = Math.min(0.995, baseWhitePoint + detailStrength * 0.18);
        const toneSpan = whitePoint - blackPoint;
        const toneGamma = 1.3 + detailStrength * 0.2;
        const t = nLum / 255;
        let outLum;
        if (t >= whitePoint) {
          outLum = 255;
        } else if (t <= blackPoint) {
          outLum = 0;
        } else {
          outLum = 255 * Math.pow((t - blackPoint) / toneSpan, toneGamma);
        }
        // Colored document marks must retain visible density even when their
        // local background estimate is almost as dark as the mark itself.
        outLum = Math.min(outLum, 255 - colorDetail * 38);
        // Carry color according to both local darkness and saturation. This
        // keeps pale red/blue seals legible while normalized color casts on
        // otherwise blank paper still fade away.
        const whiteLum = whitePoint * 255;
        const paperDistance = Math.max(0, Math.min(1, (whiteLum - nLum) / Math.max(28, whiteLum * 0.3)));
        const chromaScale = Math.max(
          paperDistance * 0.88,
          Math.min(1, colorDetail * 1.4) * (0.9 + paperDistance * 0.1)
        );
        data[index] = outLum + (nR - scaledLum) * chromaScale;
        data[index + 1] = outLum + (nG - scaledLum) * chromaScale;
        data[index + 2] = outLum + (nB - scaledLum) * chromaScale;
      }
    }

    const structuredNoiseProfile = buildScannerStructuredNoiseProfile(normalizedLuminance, width, height);
    if (isScannerSeverePeriodicPattern(structuredNoiseProfile)) {
      applyScannerClaritySafePeriodicFilter(imageData, original, normalizedLuminance);
      whitenScannerEdgeArtifacts(imageData);
      return applyScannerManualToneAdjustments(imageData, brightness, contrast);
    }
    denoiseScannerImageData(imageData);
    denoiseScannerImageData(imageData);
    purifyScannerStructuredNoise(imageData, normalizedLuminance, structuredNoiseProfile);
    despeckleScannerPaperImageData(imageData);
    // A structured carrier can leave uncertain residuals in the protection
    // mask. Sharpening those residuals recreates dark blocks, so sharpening is
    // reserved for already-clean pages.
    if (!structuredNoiseProfile.active) sharpenScannerImageData(imageData);
    neutralizeScannerPeriodicPattern(imageData, structuredNoiseProfile);
    whitenScannerEdgeArtifacts(imageData);
    return applyScannerManualToneAdjustments(imageData, brightness, contrast);
  }

  function sharpenScannerImageData(imageData, options = {}) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    if (width < 3 || height < 3) return imageData;
    // Noise-aware unsharp mask: real stroke edges get a small, capped boost;
    // low-amplitude paper/JPEG texture does not get amplified.
    const source = data.slice();
    const rowStride = width * 4;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = (y * width + x) * 4;
        if (options.contentMask && options.contentMask[y * width + x] < 80) continue;
        const leftIndex = index - 4;
        const rightIndex = index + 4;
        const topIndex = index - rowStride;
        const bottomIndex = index + rowStride;
        const centerLum = source[index] * 0.299 + source[index + 1] * 0.587 + source[index + 2] * 0.114;
        const leftLum = source[leftIndex] * 0.299 + source[leftIndex + 1] * 0.587 + source[leftIndex + 2] * 0.114;
        const rightLum = source[rightIndex] * 0.299 + source[rightIndex + 1] * 0.587 + source[rightIndex + 2] * 0.114;
        const topLum = source[topIndex] * 0.299 + source[topIndex + 1] * 0.587 + source[topIndex + 2] * 0.114;
        const bottomLum = source[bottomIndex] * 0.299 + source[bottomIndex + 1] * 0.587 + source[bottomIndex + 2] * 0.114;
        const edgeRange = Math.max(centerLum, leftLum, rightLum, topLum, bottomLum)
          - Math.min(centerLum, leftLum, rightLum, topLum, bottomLum);
        const minimumEdge = Number(options.minimumEdge) || 14;
        const maximumAmount = Number(options.maximumAmount) || 0.35;
        if (edgeRange < minimumEdge || centerLum > 252) continue;
        let amount = Math.min(maximumAmount, 0.15 + edgeRange / 220);
        if (
          Math.max(source[index], source[index + 1], source[index + 2])
          - Math.min(source[index], source[index + 1], source[index + 2]) > 58
        ) amount *= 0.82;
        for (let channel = 0; channel < 3; channel += 1) {
          const centerValue = source[index + channel];
          const neighborAverage = (
            source[leftIndex + channel]
            + source[rightIndex + channel]
            + source[topIndex + channel]
            + source[bottomIndex + channel]
          ) / 4;
          const adjustment = Math.max(-12, Math.min(12, (centerValue - neighborAverage) * amount));
          if (Math.abs(adjustment) >= 0.5) data[index + channel] = centerValue + adjustment;
        }
      }
    }
    return imageData;
  }

  function applyScannerFilterToImageData(imageData, scannerMode = scannerState.scannerMode, brightness = scannerState.brightness, contrast = scannerState.contrast) {
    if (scannerMode === 'digital-document') {
      return applyDigitalDocumentFilterToImageData(imageData, brightness, contrast);
    }
    const data = imageData.data;
    const factor = getScannerContrastFactor(contrast);
    for (let index = 0; index < data.length; index += 4) {
      if (scannerMode === 'bw') {
        const gray = getScannerLuminance(data[index], data[index + 1], data[index + 2]);
        const value = clampByte(factor * (gray - 128) + 128 + Number(brightness || 0));
        const output = value > 174 ? 255 : 0;
        data[index] = output;
        data[index + 1] = output;
        data[index + 2] = output;
        continue;
      }
      data[index] = clampByte(factor * (data[index] - 128) + 128 + Number(brightness || 0));
      data[index + 1] = clampByte(factor * (data[index + 1] - 128) + 128 + Number(brightness || 0));
      data[index + 2] = clampByte(factor * (data[index + 2] - 128) + 128 + Number(brightness || 0));
    }
    return imageData;
  }

  function createScannerFullResolutionCrop(maxEdge) {
    const image = scannerState.image;
    if (!image || !scannerState.sourceCanvas || scannerState.corners.length !== 4) {
      return {
        canvas: createScannerCleanSourceCanvas(),
        corners: cloneScannerCorners(scannerState.corners)
      };
    }
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    const naturalScaleX = naturalWidth / Math.max(1, scannerState.sourceCanvas.width);
    const naturalScaleY = naturalHeight / Math.max(1, scannerState.sourceCanvas.height);
    const naturalCorners = scannerState.corners.map((point) => ({
      x: point.x * naturalScaleX,
      y: point.y * naturalScaleY
    }));
    const margin = Math.max(2, Math.min(naturalWidth, naturalHeight) * 0.002);
    const sourceX = Math.max(0, Math.floor(Math.min(...naturalCorners.map((point) => point.x)) - margin));
    const sourceY = Math.max(0, Math.floor(Math.min(...naturalCorners.map((point) => point.y)) - margin));
    const sourceRight = Math.min(naturalWidth, Math.ceil(Math.max(...naturalCorners.map((point) => point.x)) + margin));
    const sourceBottom = Math.min(naturalHeight, Math.ceil(Math.max(...naturalCorners.map((point) => point.y)) + margin));
    const sourceWidth = Math.max(1, sourceRight - sourceX);
    const sourceHeight = Math.max(1, sourceBottom - sourceY);
    const scale = Math.min(1, Number(maxEdge || 4096) / Math.max(sourceWidth, sourceHeight));
    const canvas = createCanvas(sourceWidth * scale, sourceHeight * scale);
    const cropContext = canvas.getContext('2d', { willReadFrequently: true });
    cropContext.imageSmoothingEnabled = true;
    cropContext.imageSmoothingQuality = 'high';
    cropContext.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );
    const cropScaleX = canvas.width / sourceWidth;
    const cropScaleY = canvas.height / sourceHeight;
    return {
      canvas,
      corners: naturalCorners.map((point) => ({
        x: (point.x - sourceX) * cropScaleX,
        y: (point.y - sourceY) * cropScaleY
      }))
    };
  }

  function buildProcessedScannerCanvas(options = {}) {
    if (!scannerState.sourceCanvas || !scannerState.corners.length) return null;
    if (!isScannerUsableQuad(
      scannerState.corners,
      scannerState.sourceCanvas.width,
      scannerState.sourceCanvas.height
    )) {
      return null;
    }
    // The interactive source canvas is downscaled for responsiveness; the
    // save path crops directly from the original pixels before downscaling,
    // so a document that occupies only part of a high-resolution photo still
    // reaches print-quality output without allocating the full camera frame.
    const source = options.sourceMaxEdge
      ? createScannerFullResolutionCrop(options.sourceMaxEdge)
      : {
          canvas: createScannerCleanSourceCanvas(),
          corners: cloneScannerCorners(scannerState.corners)
        };
    const corrected = applyPerspectiveCorrection(source.canvas, source.corners, {
      maxEdge: Number(options.maxEdge || scannerState.previewMaxEdge || 860),
      steps: Number(options.steps || 10),
      fast: Boolean(options.fast)
    });
    const processed = createCanvas(corrected.width, corrected.height);
    const processedContext = processed.getContext('2d', { willReadFrequently: true });
    processedContext.drawImage(corrected, 0, 0);
    const imageData = processedContext.getImageData(0, 0, processed.width, processed.height);
    processedContext.putImageData(applyScannerFilterToImageData(imageData), 0, 0);
    return processed;
  }

  function getScannerSourceBackdropCanvas() {
    const canvas = scannerState.sourceCanvas;
    const image = scannerState.image;
    if (!canvas || !image) return null;
    const cache = scannerState.sourceBackdrop;
    if (
      cache
      && cache.image === image
      && cache.width === canvas.width
      && cache.height === canvas.height
    ) {
      return cache.canvas;
    }
    const backdrop = createCanvas(canvas.width, canvas.height);
    const context = backdrop.getContext('2d', { alpha: false });
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, backdrop.width, backdrop.height);
    // Cache one honest source-resolution render. The old display-size stage
    // reduced this page to roughly 500px and then enlarged it back to 1600px,
    // hiding both small writing and the source noise the operator must judge.
    drawScannerImageWithProgressiveReduction(context, image, canvas.width, canvas.height);
    scannerState.sourceBackdrop = {
      image,
      width: canvas.width,
      height: canvas.height,
      canvas: backdrop
    };
    return backdrop;
  }

  function drawScannerSource() {
    if (!scannerState.sourceCanvas || !scannerState.sourceContext || !scannerState.image) return;
    applyScannerPaneZoom('source');
    const sourceRect = scannerState.sourceCanvas.getBoundingClientRect();
    const sourceDisplayScale = (
      Number.isFinite(sourceRect.width)
      && sourceRect.width > 0
      && scannerState.sourceCanvas.width > 0
    )
      ? sourceRect.width / scannerState.sourceCanvas.width
      : Math.max(0.02, Number(scannerState.sourceZoom || 1));
    const ctx = scannerState.sourceContext;
    ctx.clearRect(0, 0, scannerState.sourceCanvas.width, scannerState.sourceCanvas.height);
    const backdrop = getScannerSourceBackdropCanvas();
    if (backdrop) {
      ctx.drawImage(backdrop, 0, 0);
    } else {
      ctx.drawImage(scannerState.image, 0, 0, scannerState.sourceCanvas.width, scannerState.sourceCanvas.height);
    }
    if (scannerState.corners.length === 4) {
      ctx.save();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = Math.max(0.5, Math.min(100, 2 / sourceDisplayScale));
      ctx.beginPath();
      ctx.moveTo(scannerState.corners[0].x, scannerState.corners[0].y);
      scannerState.corners.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.closePath();
      ctx.stroke();
      scannerState.corners.forEach((point, index) => {
        ctx.beginPath();
        ctx.fillStyle = index === scannerState.activeCorner ? '#facc15' : '#ffffff';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = Math.max(0.5, Math.min(100, 2 / sourceDisplayScale));
        ctx.arc(point.x, point.y, Math.max(1, Math.min(500, 9 / sourceDisplayScale)), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      ctx.restore();
    }
  }

  function renderScannerPreview() {
    if (!scannerState.sourceCanvas || !scannerState.previewCanvas || !scannerState.corners.length) return;
    const previewMaxEdge = scannerState.isDraggingCorner ? scannerState.dragPreviewMaxEdge : scannerState.previewMaxEdge;
    const processed = buildProcessedScannerCanvas({
      maxEdge: previewMaxEdge,
      steps: scannerState.isDraggingCorner ? 4 : 10,
      fast: scannerState.isDraggingCorner
    });
    if (!processed) return;
    scannerState.previewCanvas.width = processed.width;
    scannerState.previewCanvas.height = processed.height;
    scannerState.previewContext.clearRect(0, 0, processed.width, processed.height);
    scannerState.previewContext.drawImage(processed, 0, 0);
    if (scannerState.isDraggingCorner) {
      const previousMaxEdge = Math.max(
        1,
        scannerState.previewDisplayWidth || processed.width,
        scannerState.previewDisplayHeight || processed.height
      );
      const processedMaxEdge = Math.max(1, processed.width, processed.height);
      scannerState.previewDisplayWidth = Math.max(1, Math.round(processed.width * previousMaxEdge / processedMaxEdge));
      scannerState.previewDisplayHeight = Math.max(1, Math.round(processed.height * previousMaxEdge / processedMaxEdge));
    } else {
      scannerState.previewDisplayWidth = processed.width;
      scannerState.previewDisplayHeight = processed.height;
    }
    applyScannerPaneZoom('preview');
  }

  const SCANNER_ZOOM_LEVELS = [0.025, 0.05, 0.075, 0.1, 0.15, 0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];

  function getScannerPaneZoomElements(target) {
    if (!scannerState.overlay || (target !== 'source' && target !== 'preview')) return null;
    const canvas = target === 'source' ? scannerState.sourceCanvas : scannerState.previewCanvas;
    const viewport = scannerState.overlay.querySelector('[data-scanner-zoom-viewport="' + target + '"]');
    const surface = viewport?.querySelector('.attachment-scanner-canvas-surface');
    if (!canvas || !viewport || !surface) return null;
    return {
      canvas,
      viewport,
      surface,
      label: scannerState.overlay.querySelector('[data-scanner-zoom-label="' + target + '"]'),
      fitButton: scannerState.overlay.querySelector('[data-scanner-action="zoom-fit"][data-scanner-zoom-target="' + target + '"]'),
      actualButton: scannerState.overlay.querySelector('[data-scanner-action="zoom-actual"][data-scanner-zoom-target="' + target + '"]')
    };
  }

  function getScannerPaneSurfacePadding(elements) {
    const fallback = { horizontal: 16, vertical: 16 };
    if (
      typeof window === 'undefined'
      || typeof window.getComputedStyle !== 'function'
      || !elements?.surface
    ) return fallback;
    const style = window.getComputedStyle(elements.surface);
    const readPadding = (property) => {
      const value = Number.parseFloat(style[property]);
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    };
    return {
      horizontal: readPadding('paddingLeft') + readPadding('paddingRight'),
      vertical: readPadding('paddingTop') + readPadding('paddingBottom')
    };
  }

  function getScannerPaneDisplaySize(target, elements) {
    if (
      target === 'preview'
      && scannerState.isDraggingCorner
      && scannerState.previewDisplayWidth > 0
      && scannerState.previewDisplayHeight > 0
    ) {
      return {
        width: scannerState.previewDisplayWidth,
        height: scannerState.previewDisplayHeight
      };
    }
    return {
      width: elements.canvas.width,
      height: elements.canvas.height
    };
  }

  function getScannerPaneFitZoom(target) {
    const elements = getScannerPaneZoomElements(target);
    if (!elements || !elements.canvas.width || !elements.canvas.height) return 1;
    const displaySize = getScannerPaneDisplaySize(target, elements);
    const surfacePadding = getScannerPaneSurfacePadding(elements);
    const availableWidth = Math.max(1, elements.viewport.clientWidth - surfacePadding.horizontal - 2);
    const availableHeight = Math.max(1, elements.viewport.clientHeight - surfacePadding.vertical - 2);
    if (availableWidth <= 1 || availableHeight <= 1) return 1;
    return Math.max(0.02, Math.min(
      1,
      availableWidth / displaySize.width,
      availableHeight / displaySize.height
    ));
  }

  function applyScannerPaneZoom(target, options = {}) {
    const elements = getScannerPaneZoomElements(target);
    if (!elements || !elements.canvas.width || !elements.canvas.height) return 1;
    const modeKey = target === 'source' ? 'sourceZoomMode' : 'previewZoomMode';
    const zoomKey = target === 'source' ? 'sourceZoom' : 'previewZoom';
    const displaySize = getScannerPaneDisplaySize(target, elements);
    const oldWidth = Math.max(1, elements.viewport.scrollWidth);
    const oldHeight = Math.max(1, elements.viewport.scrollHeight);
    const centerX = (elements.viewport.scrollLeft + elements.viewport.clientWidth / 2) / oldWidth;
    const centerY = (elements.viewport.scrollTop + elements.viewport.clientHeight / 2) / oldHeight;
    const zoom = scannerState[modeKey] === 'fit'
      ? getScannerPaneFitZoom(target)
      : Math.max(0.025, Math.min(4, Number(scannerState[zoomKey] || 1)));
    scannerState[zoomKey] = zoom;
    const renderedWidth = Math.max(1, Math.round(displaySize.width * zoom));
    const renderedHeight = Math.max(1, Math.round(displaySize.height * zoom));
    const surfacePadding = getScannerPaneSurfacePadding(elements);
    elements.canvas.style.width = String(renderedWidth) + 'px';
    elements.canvas.style.height = String(renderedHeight) + 'px';
    elements.surface.style.width = String(Math.max(
      elements.viewport.clientWidth,
      renderedWidth + surfacePadding.horizontal
    )) + 'px';
    elements.surface.style.height = String(Math.max(
      elements.viewport.clientHeight,
      renderedHeight + surfacePadding.vertical
    )) + 'px';
    if (elements.label) elements.label.textContent = toArabicNumerals(Math.round(zoom * 100)) + '٪';
    if (elements.fitButton) elements.fitButton.classList.toggle('is-active', scannerState[modeKey] === 'fit');
    if (elements.actualButton) {
      elements.actualButton.classList.toggle(
        'is-active',
        scannerState[modeKey] !== 'fit' && Math.abs(zoom - 1) < 0.001
      );
    }
    const resetScroll = options.resetScroll || scannerState[modeKey] === 'fit';
    if (options.preserveCenter || resetScroll) {
      const requestFrame = window.requestAnimationFrame
        ? window.requestAnimationFrame.bind(window)
        : (callback) => setTimeout(callback, 0);
      const cancelFrame = window.cancelAnimationFrame
        ? window.cancelAnimationFrame.bind(window)
        : clearTimeout;
      if (scannerState.zoomFrameIds[target]) cancelFrame(scannerState.zoomFrameIds[target]);
      scannerState.zoomFrameIds[target] = requestFrame(() => {
        scannerState.zoomFrameIds[target] = 0;
        if (resetScroll) {
          elements.viewport.scrollLeft = 0;
          elements.viewport.scrollTop = 0;
        } else {
          elements.viewport.scrollLeft = Math.max(
            0,
            centerX * elements.viewport.scrollWidth - elements.viewport.clientWidth / 2
          );
          elements.viewport.scrollTop = Math.max(
            0,
            centerY * elements.viewport.scrollHeight - elements.viewport.clientHeight / 2
          );
        }
      });
    }
    return zoom;
  }

  function changeScannerPaneZoom(target, action) {
    const modeKey = target === 'source' ? 'sourceZoomMode' : 'previewZoomMode';
    const zoomKey = target === 'source' ? 'sourceZoom' : 'previewZoom';
    if (target !== 'source' && target !== 'preview') return;
    if (action === 'zoom-fit') {
      scannerState[modeKey] = 'fit';
      applyScannerPaneZoom(target, { resetScroll: true });
      if (target === 'source') drawScannerSource();
      return;
    }
    if (action === 'zoom-actual') {
      scannerState[modeKey] = 'manual';
      scannerState[zoomKey] = 1;
      applyScannerPaneZoom(target, { preserveCenter: true });
      if (target === 'source') drawScannerSource();
      return;
    }
    const current = scannerState[modeKey] === 'fit'
      ? getScannerPaneFitZoom(target)
      : Math.max(0.025, Math.min(4, Number(scannerState[zoomKey] || 1)));
    const fitZoom = getScannerPaneFitZoom(target);
    if (action === 'zoom-out' && current > fitZoom + 0.005) {
      scannerState[modeKey] = 'fit';
      scannerState[zoomKey] = fitZoom;
      applyScannerPaneZoom(target, { resetScroll: true });
      if (target === 'source') drawScannerSource();
      return;
    }
    let next = current;
    if (action === 'zoom-in') {
      next = SCANNER_ZOOM_LEVELS.find((value) => value > current + 0.005) || 4;
    } else if (action === 'zoom-out') {
      next = SCANNER_ZOOM_LEVELS.slice().reverse().find((value) => value < current - 0.005) || 0.025;
    } else {
      return;
    }
    scannerState[modeKey] = 'manual';
    scannerState[zoomKey] = next;
    applyScannerPaneZoom(target, { preserveCenter: true });
    if (target === 'source') drawScannerSource();
  }

  function refreshScannerFitZooms() {
    let sourceZoomChanged = false;
    ['source', 'preview'].forEach((target) => {
      const modeKey = target === 'source' ? 'sourceZoomMode' : 'previewZoomMode';
      const zoomKey = target === 'source' ? 'sourceZoom' : 'previewZoom';
      if (scannerState[modeKey] !== 'fit') return;
      const previousZoom = Number(scannerState[zoomKey] || 1);
      const nextZoom = applyScannerPaneZoom(target);
      if (target === 'source' && Math.abs(nextZoom - previousZoom) > 0.0005) {
        sourceZoomChanged = true;
      }
    });
    if (sourceZoomChanged) drawScannerSource();
  }

  function cancelScannerZoomFrames() {
    const cancelFrame = typeof window !== 'undefined' && window.cancelAnimationFrame
      ? window.cancelAnimationFrame.bind(window)
      : clearTimeout;
    ['source', 'preview'].forEach((target) => {
      if (!scannerState.zoomFrameIds[target]) return;
      cancelFrame(scannerState.zoomFrameIds[target]);
      scannerState.zoomFrameIds[target] = 0;
    });
  }

  function cancelScannerPreviewRender() {
    if (!scannerState.renderFrame) return;
    const cancelFrame = typeof window !== 'undefined' && window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : clearTimeout;
    cancelFrame(scannerState.renderFrame);
    scannerState.renderFrame = 0;
  }

  function scheduleScannerPreviewRender() {
    if (scannerState.renderFrame) return;
    const requestFrame = typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : (callback) => setTimeout(callback, 16);
    scannerState.renderFrame = requestFrame(() => {
      scannerState.renderFrame = 0;
      renderScannerPreview();
    });
  }

  function refreshScannerCanvases() {
    drawScannerSource();
    scheduleScannerPreviewRender();
  }

  function setScannerLoading(isLoading) {
    scannerState.isLoading = isLoading;
    if (!scannerState.overlay) return;
    scannerState.overlay.dataset.loading = isLoading ? 'true' : 'false';
    scannerState.overlay.querySelectorAll('button,input').forEach((control) => {
      control.disabled = isLoading;
    });
    if (!isLoading) updateScannerPdfPageControls();
  }

  function getScannerCanvasPoint(event) {
    if (!scannerState.sourceCanvas) return null;
    const rect = scannerState.sourceCanvas.getBoundingClientRect();
    if (
      !Number.isFinite(rect.width)
      || !Number.isFinite(rect.height)
      || rect.width <= 0
      || rect.height <= 0
    ) return null;
    return {
      x: (event.clientX - rect.left) * scannerState.sourceCanvas.width / rect.width,
      y: (event.clientY - rect.top) * scannerState.sourceCanvas.height / rect.height
    };
  }

  function setScannerCornerFromEvent(event) {
    if (scannerState.activeCorner < 0) return;
    const point = getScannerCanvasPoint(event);
    if (!point) return;
    const candidateCorners = cloneScannerCorners(scannerState.corners);
    candidateCorners[scannerState.activeCorner] = {
      x: Math.max(0, Math.min(scannerState.sourceCanvas.width, point.x)),
      y: Math.max(0, Math.min(scannerState.sourceCanvas.height, point.y))
    };
    if (!isScannerUsableQuad(
      candidateCorners,
      scannerState.sourceCanvas.width,
      scannerState.sourceCanvas.height
    )) {
      return;
    }
    scannerState.corners = candidateCorners;
    markCurrentScannerPdfPageDirty();
    drawScannerSource();
    scheduleScannerPreviewRender();
  }

  function bindScannerCanvasEvents(canvas) {
    canvas.addEventListener('pointerdown', (event) => {
      if (!scannerState.corners.length) return;
      const point = getScannerCanvasPoint(event);
      if (!point) return;
      let nearest = -1;
      let nearestDistance = Infinity;
      scannerState.corners.forEach((corner, index) => {
        const dist = distanceBetweenPoints(point, corner);
        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearest = index;
        }
      });
      const sourceRect = scannerState.sourceCanvas.getBoundingClientRect();
      const displayScale = (
        Number.isFinite(sourceRect.width)
        && sourceRect.width > 0
        && scannerState.sourceCanvas.width > 0
      )
        ? sourceRect.width / scannerState.sourceCanvas.width
        : Math.max(0.02, Number(scannerState.sourceZoom || 1));
      const threshold = Math.max(2, Math.min(900, 18 / displayScale));
      if (nearestDistance > threshold) return;
      scannerState.activeCorner = nearest;
      scannerState.isDraggingCorner = true;
      try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
      setScannerCornerFromEvent(event);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (scannerState.activeCorner < 0) return;
      event.preventDefault();
      setScannerCornerFromEvent(event);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => {
      canvas.addEventListener(eventName, () => {
        const wasDragging = scannerState.isDraggingCorner;
        scannerState.activeCorner = -1;
        scannerState.isDraggingCorner = false;
        drawScannerSource();
        if (wasDragging) scheduleScannerPreviewRender();
      });
    });
  }

  function ensureAttachmentScannerOverlay() {
    if (scannerState.overlay && document.body.contains(scannerState.overlay)) {
      return scannerState.overlay;
    }
    const overlay = document.createElement('div');
    overlay.className = 'attachment-scanner-overlay';
    overlay.dataset.loading = 'false';
    overlay.innerHTML = `
      <div class="attachment-scanner-modal" role="dialog" aria-modal="true" aria-labelledby="attachmentScannerTitle" tabindex="-1">
        <div class="attachment-scanner-header">
          <div>
            <h3 id="attachmentScannerTitle">تعديل المستند</h3>
            <div class="attachment-scanner-filename" dir="ltr"></div>
            <div class="attachment-scanner-page-controls" hidden>
              <button type="button" data-scanner-action="previous-page">السابق</button>
              <span class="attachment-scanner-page-info" aria-live="polite"></span>
              <button type="button" data-scanner-action="next-page">التالي</button>
            </div>
          </div>
          <button type="button" class="attachment-scanner-close" data-scanner-action="close" title="اغلاق">&times;</button>
        </div>
        <div class="attachment-scanner-body">
          <aside class="attachment-scanner-tools">
            <div class="attachment-scanner-tool-row">
              <button type="button" data-scanner-action="auto-scan">مسح تلقائي</button>
            </div>
            <label class="attachment-scanner-slider">
              <span>السطوع</span>
              <input type="range" min="-80" max="80" value="0" data-scanner-slider="brightness">
            </label>
            <label class="attachment-scanner-slider">
              <span>التباين</span>
              <input type="range" min="-80" max="120" value="0" data-scanner-slider="contrast">
            </label>
            <div class="attachment-scanner-save-row">
              <button type="button" class="attachment-scanner-preview-btn" data-scanner-action="preview-result">عرض</button>
              <button type="button" class="attachment-scanner-save" data-scanner-action="save">تبديل</button>
            </div>
          </aside>
          <section class="attachment-scanner-stage">
            <div class="attachment-scanner-pane attachment-scanner-pane--source">
              <div class="attachment-scanner-pane-title">
                <span>الأصل</span>
                <div class="attachment-scanner-zoom-controls" dir="ltr" aria-label="تكبير وتصغير الأصل">
                  <button type="button" data-scanner-action="zoom-out" data-scanner-zoom-target="source" aria-label="تصغير الأصل">−</button>
                  <output data-scanner-zoom-label="source">١٠٠٪</output>
                  <button type="button" data-scanner-action="zoom-in" data-scanner-zoom-target="source" aria-label="تكبير الأصل">+</button>
                  <button type="button" data-scanner-action="zoom-fit" data-scanner-zoom-target="source" title="إظهار الصورة كاملة">إظهار الصفحة كاملة</button>
                  <button type="button" data-scanner-action="zoom-actual" data-scanner-zoom-target="source" title="عرض كل بكسل بحجمه الأصلي">١:١ (دقة كاملة)</button>
                </div>
              </div>
              <div class="attachment-scanner-canvas-viewport attachment-scanner-canvas-viewport--source" data-scanner-zoom-viewport="source">
                <div class="attachment-scanner-canvas-surface">
                  <canvas class="attachment-scanner-source"></canvas>
                </div>
              </div>
            </div>
            <div class="attachment-scanner-pane attachment-scanner-pane--preview">
              <div class="attachment-scanner-pane-title">
                <span>النتيجة</span>
                <div class="attachment-scanner-zoom-controls" dir="ltr" aria-label="تكبير وتصغير النتيجة">
                  <button type="button" data-scanner-action="zoom-out" data-scanner-zoom-target="preview" aria-label="تصغير النتيجة">−</button>
                  <output data-scanner-zoom-label="preview">١٠٠٪</output>
                  <button type="button" data-scanner-action="zoom-in" data-scanner-zoom-target="preview" aria-label="تكبير النتيجة">+</button>
                  <button type="button" data-scanner-action="zoom-fit" data-scanner-zoom-target="preview" title="إظهار النتيجة كاملة">إظهار الصفحة كاملة</button>
                  <button type="button" data-scanner-action="zoom-actual" data-scanner-zoom-target="preview" title="عرض كل بكسل بحجمه الأصلي">١:١ (دقة كاملة)</button>
                </div>
              </div>
              <div class="attachment-scanner-canvas-viewport attachment-scanner-canvas-viewport--preview" data-scanner-zoom-viewport="preview">
                <div class="attachment-scanner-canvas-surface">
                  <canvas class="attachment-scanner-preview"></canvas>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    scannerState.overlay = overlay;
    scannerState.sourceCanvas = overlay.querySelector('.attachment-scanner-source');
    scannerState.previewCanvas = overlay.querySelector('.attachment-scanner-preview');
    scannerState.sourceContext = scannerState.sourceCanvas.getContext('2d', { willReadFrequently: true });
    scannerState.previewContext = scannerState.previewCanvas.getContext('2d', { willReadFrequently: true });
    bindScannerCanvasEvents(scannerState.sourceCanvas);
    if (typeof ResizeObserver === 'function') {
      scannerState.zoomResizeObserver = new ResizeObserver(() => {
        if (scannerState.overlay?.classList.contains('open')) refreshScannerFitZooms();
      });
      overlay.querySelectorAll('[data-scanner-zoom-viewport]').forEach((viewport) => {
        scannerState.zoomResizeObserver.observe(viewport);
      });
    } else {
      window.addEventListener('resize', refreshScannerFitZooms);
    }

    overlay.addEventListener('click', (event) => {
      const target = event.target && event.target.closest ? event.target.closest('[data-scanner-action]') : null;
      if (!target) return;
      const action = target.dataset.scannerAction;
      if (action === 'close') {
        if (!scannerState.isSaving && !scannerState.isLoading) toggleAttachmentScannerOverlay(false);
      } else if (action === 'auto-scan') {
        applyAutoScanToScanner();
      } else if (action === 'previous-page') {
        changeScannerPdfPage(-1);
      } else if (action === 'next-page') {
        changeScannerPdfPage(1);
      } else if (
        action === 'zoom-in'
        || action === 'zoom-out'
        || action === 'zoom-fit'
        || action === 'zoom-actual'
      ) {
        changeScannerPaneZoom(target.dataset.scannerZoomTarget || '', action);
      } else if (action === 'preview-result') {
        previewEditedAttachmentResult();
      } else if (action === 'save') {
        saveEditedAttachment();
      }
    });

    overlay.addEventListener('input', (event) => {
      const slider = event.target && event.target.dataset ? event.target.dataset.scannerSlider : '';
      if (slider === 'brightness') {
        scannerState.brightness = Number(event.target.value || 0);
        markCurrentScannerPdfPageDirty();
        scheduleScannerPreviewRender();
      } else if (slider === 'contrast') {
        scannerState.contrast = Number(event.target.value || 0);
        markCurrentScannerPdfPageDirty();
        scheduleScannerPreviewRender();
      }
    });

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!scannerState.isSaving && !scannerState.isLoading) toggleAttachmentScannerOverlay(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(overlay.querySelectorAll(
        'button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )).filter((control) => control.offsetParent !== null);
      const modal = overlay.querySelector('.attachment-scanner-modal');
      if (!focusable.length) {
        event.preventDefault();
        try { modal.focus({ preventScroll: true }); } catch (_) {}
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modal)) {
        event.preventDefault();
        first.focus();
      }
    });

    return overlay;
  }

  function toggleAttachmentScannerOverlay(open) {
    const overlay = ensureAttachmentScannerOverlay();
    overlay.classList.toggle('open', Boolean(open));
    if (open) {
      setTimeout(() => {
        try { overlay.querySelector('.attachment-scanner-modal').focus({ preventScroll: true }); } catch (_) {}
        refreshScannerFitZooms();
      }, 30);
      return;
    }
    scannerState.openRequestId += 1;
    resetScannerPdfState();
    scannerState.documentKind = 'image';
    const previousFocus = scannerState.lastFocusedElement;
    scannerState.lastFocusedElement = null;
    cancelScannerZoomFrames();
    cancelScannerPreviewRender();
    scannerState.filename = '';
    scannerState.image = null;
    scannerState.sourceBackdrop = null;
    scannerState.corners = [];
    scannerState.activeCorner = -1;
    scannerState.isDraggingCorner = false;
    scannerState.previewDisplayWidth = 0;
    scannerState.previewDisplayHeight = 0;
    setScannerLoading(false);
    if (previousFocus && document.contains(previousFocus)) {
      setTimeout(() => {
        try { previousFocus.focus({ preventScroll: true }); } catch (_) {
          try { previousFocus.focus(); } catch (__) {}
        }
      }, 30);
    }
  }

  function readBlobAsBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = () => reject(new Error('تعذر قراءة الملف المعدل.'));
      reader.readAsDataURL(blob);
    });
  }

  function canvasToBlob(canvas, mimeType, quality = 0.92) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('تعذر تجهيز الصورة المعدلة.'));
      }, mimeType, quality);
    });
  }

  function openScannerPreviewViewer(filename = '') {
    let viewer = null;
    try {
      viewer = window.open('', '_blank');
    } catch (_) {}
    if (!viewer) return null;

    try {
      const doc = viewer.document;
      doc.open();
      doc.write([
        '<!doctype html>',
        '<html lang="ar" dir="rtl">',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        '<title>معاينة المستند</title>',
        '<style>',
        '*{box-sizing:border-box}',
        'html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#e5e7eb;color:#172033;font-family:Tahoma,Arial,sans-serif}',
        'body{display:grid;grid-template-rows:auto minmax(0,1fr)}',
        '[hidden]{display:none!important}',
        '.preview-header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #cbd5e1;background:#f8fafc;box-shadow:0 1px 5px rgba(15,23,42,.12);z-index:2}',
        '.preview-heading{display:flex;align-items:baseline;gap:8px;min-width:0}',
        '.preview-heading strong{font-size:1rem}',
        '.preview-filename{max-width:min(52vw,680px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#64748b;font-size:.78rem;direction:rtl}',
        '.preview-loading{display:flex;align-items:center;gap:8px;flex:1 1 360px;justify-content:flex-start;min-width:min(100%,280px)}',
        '.preview-loading span{font-size:.82rem;font-weight:800;white-space:nowrap}',
        '.preview-loading progress{width:clamp(130px,28vw,360px);height:12px;accent-color:#178d58}',
        '.preview-loading output{min-width:42px;color:#475569;font-size:.76rem;font-weight:800;text-align:center;font-variant-numeric:tabular-nums}',
        '.preview-toolbar{display:flex;align-items:center;gap:5px;direction:ltr}',
        '.preview-toolbar button{height:30px;min-width:32px;padding:0 9px;border:1px solid #b8c3d1;border-radius:6px;background:#fff;color:#172033;font-family:inherit;font-size:.76rem;font-weight:800;cursor:pointer}',
        '.preview-toolbar button:hover{background:#e2e8f0;border-color:#8796aa}',
        '.preview-toolbar button.is-active{background:#0f4c81;color:#fff;border-color:#0f4c81}',
        '.preview-toolbar output{min-width:48px;color:#334155;text-align:center;font-size:.76rem;font-weight:800;font-variant-numeric:tabular-nums}',
        '.preview-stage{min-width:0;min-height:0;overflow:auto;direction:ltr;background:#d7dce3;scrollbar-gutter:stable}',
        '.preview-surface{display:grid;place-items:center;box-sizing:border-box;min-width:100%;min-height:100%;width:100%;height:100%;padding:24px}',
        '.preview-image{display:block;max-width:none;max-height:none;width:auto;height:auto;object-fit:contain;background:#fff;box-shadow:0 4px 22px rgba(15,23,42,.22)}',
        '.preview-stage.is-pdf{background:#525659}',
        '.preview-stage.is-pdf.is-pdf-native{overflow:hidden}',
        '.preview-stage.is-pdf.is-pdf-native .preview-surface{display:block;width:100%;height:100%;min-width:100%;min-height:100%;padding:0}',
        '.preview-pdf{display:block;width:100%;height:100%;border:0;background:#525659}',
        '.preview-stage.is-pdf.is-pdf-pages{overflow:auto}',
        '.preview-stage.is-pdf.is-pdf-pages .preview-surface{display:block;width:100%;height:auto;min-width:100%;min-height:100%;padding:20px}',
        '.preview-pdf-pages{display:flex;flex-direction:column;align-items:center;gap:18px;min-width:100%}',
        '.preview-pdf-page{display:flex;flex-direction:column;align-items:center;gap:7px;max-width:100%;color:#f8fafc;font-size:.75rem;font-weight:800}',
        '.preview-pdf-page canvas{display:block;max-width:100%;height:auto;background:#fff;box-shadow:0 4px 22px rgba(0,0,0,.38)}',
        '.preview-error{color:#b42318!important}',
        '@media(max-width:640px){.preview-header{padding:8px}.preview-heading{width:100%}.preview-loading{order:3}.preview-surface{padding:12px}}',
        '</style>',
        '</head>',
        '<body>',
        '<header class="preview-header">',
        '<div class="preview-heading"><strong>معاينة المستند</strong><span class="preview-filename" data-preview-filename></span></div>',
        '<div class="preview-loading" data-preview-loading>',
        '<span data-preview-status aria-live="polite">جاري تجهيز المعاينة...</span>',
        '<progress data-preview-progress max="100" value="4" aria-label="تقدم تجهيز المعاينة"></progress>',
        '<output data-preview-percent>٤٪</output>',
        '</div>',
        '<div class="preview-toolbar" data-preview-toolbar hidden aria-label="تكبير وتصغير المعاينة">',
        '<button type="button" data-preview-action="zoom-out" aria-label="تصغير">−</button>',
        '<button type="button" data-preview-action="zoom-in" aria-label="تكبير">+</button>',
        '<button type="button" data-preview-action="zoom-fit" title="إظهار الصورة كاملة">إظهار الصفحة كاملة</button>',
        '<button type="button" data-preview-action="zoom-actual" title="عرض كل بكسل بحجمه الأصلي">١:١ (دقة كاملة)</button>',
        '<output data-preview-zoom-label>١٠٠٪</output>',
        '</div>',
        '</header>',
        '<main class="preview-stage" data-preview-stage>',
        '<div class="preview-surface" data-preview-surface></div>',
        '</main>',
        '</body>',
        '</html>'
      ].join('\n'));
      doc.close();
      const filenameElement = doc.querySelector('[data-preview-filename]');
      if (filenameElement) filenameElement.textContent = filename;
      return viewer;
    } catch (_) {
      try { viewer.close(); } catch (__) {}
      return null;
    }
  }

  function updateScannerPreviewViewerProgress(viewer, value, statusText = '') {
    if (!viewer || viewer.closed) return false;
    try {
      const doc = viewer.document;
      const loading = doc.querySelector('[data-preview-loading]');
      const status = doc.querySelector('[data-preview-status]');
      const progress = doc.querySelector('[data-preview-progress]');
      const percent = doc.querySelector('[data-preview-percent]');
      const normalized = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
      if (loading) loading.hidden = false;
      if (status) {
        status.classList.remove('preview-error');
        if (statusText) status.textContent = statusText;
      }
      if (progress) {
        progress.hidden = false;
        progress.value = normalized;
      }
      if (percent) {
        percent.hidden = false;
        percent.textContent = toArabicNumerals(normalized) + '٪';
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function showScannerPreviewViewerError(viewer, message) {
    if (!viewer || viewer.closed) return;
    try {
      const doc = viewer.document;
      const loading = doc.querySelector('[data-preview-loading]');
      const status = doc.querySelector('[data-preview-status]');
      const progress = doc.querySelector('[data-preview-progress]');
      const percent = doc.querySelector('[data-preview-percent]');
      if (loading) loading.hidden = false;
      if (status) {
        status.textContent = message || 'تعذر تجهيز المعاينة.';
        status.classList.add('preview-error');
      }
      if (progress) progress.hidden = true;
      if (percent) percent.hidden = true;
    } catch (_) {}
  }

  async function showScannerPreviewBlob(viewer, blob, mimeType, filename = '', options = {}) {
    if (!viewer || viewer.closed || !blob) return false;
    let blobUrl = '';
    let disposeBlobUrl = null;
    try {
      const doc = viewer.document;
      const stage = doc.querySelector('[data-preview-stage]');
      const surface = doc.querySelector('[data-preview-surface]');
      const loading = doc.querySelector('[data-preview-loading]');
      const toolbar = doc.querySelector('[data-preview-toolbar]');
      const zoomLabel = doc.querySelector('[data-preview-zoom-label]');
      if (!stage || !surface || !loading || !toolbar) return false;

      blobUrl = URL.createObjectURL(blob);
      let revoked = false;
      let closePoll = 0;
      const revokeBlobUrl = () => {
        if (revoked) return;
        revoked = true;
        if (closePoll) window.clearInterval(closePoll);
        try { URL.revokeObjectURL(blobUrl); } catch (_) {}
      };
      disposeBlobUrl = revokeBlobUrl;
      viewer.addEventListener('pagehide', revokeBlobUrl, { once: true });
      closePoll = window.setInterval(() => {
        if (viewer.closed) revokeBlobUrl();
      }, 1000);

      surface.replaceChildren();
      const filenameElement = doc.querySelector('[data-preview-filename]');
      if (filenameElement) filenameElement.textContent = filename;
      const normalizedMime = String(mimeType || blob.type || '').toLowerCase();
      if (normalizedMime === 'application/pdf') {
        toolbar.hidden = true;
        stage.classList.add('is-pdf');
        if (options.usePdfJs !== true) {
          stage.classList.add('is-pdf-native');
          stage.classList.remove('is-pdf-pages');
          const frame = doc.createElement('iframe');
          frame.className = 'preview-pdf';
          frame.title = 'معاينة ملف PDF';
          frame.addEventListener('load', () => {
            if (!viewer.closed) loading.hidden = true;
          }, { once: true });
          frame.addEventListener('error', () => {
            revokeBlobUrl();
            showScannerPreviewViewerError(viewer, 'تعذر عرض ملف PDF.');
          }, { once: true });
          frame.src = blobUrl;
          surface.appendChild(frame);
          loading.hidden = true;
          try { viewer.focus(); } catch (_) {}
          return true;
        }

        stage.classList.remove('is-pdf-native');
        stage.classList.add('is-pdf-pages');
        const pagesHost = doc.createElement('div');
        pagesHost.className = 'preview-pdf-pages';
        surface.appendChild(pagesHost);
        updateScannerPreviewViewerProgress(viewer, 2, 'جاري فتح ملف PDF...');

        const pdfjs = await ensurePdfJsLoaded();
        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(await blob.arrayBuffer()),
          cMapUrl: '/renewal/vendor/pdfjs/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/renewal/vendor/pdfjs/standard_fonts/',
          wasmUrl: '/renewal/vendor/pdfjs/wasm/'
        });
        let pdfDocument = null;
        let renderTask = null;
        let pdfPreviewClosed = false;
        const cancelPdfPreviewWork = () => {
          pdfPreviewClosed = true;
          if (renderTask) {
            try { renderTask.cancel(); } catch (_) {}
          }
          try {
            const destroyResult = loadingTask.destroy();
            if (destroyResult && typeof destroyResult.catch === 'function') destroyResult.catch(() => {});
          } catch (_) {}
        };
        viewer.addEventListener('pagehide', cancelPdfPreviewWork, { once: true });
        try {
          pdfDocument = await loadingTask.promise;
          if (!pdfDocument.numPages) throw new Error('ملف PDF لا يحتوي على صفحات قابلة للعرض.');
          for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
            if (!viewer || viewer.closed) return false;
            updateScannerPreviewViewerProgress(
              viewer,
              Math.max(4, Math.round((pageNumber - 1) / pdfDocument.numPages * 94)),
              'جاري عرض الصفحة ' + toArabicNumerals(pageNumber) + ' من ' + toArabicNumerals(pdfDocument.numPages) + '...'
            );
            const page = await pdfDocument.getPage(pageNumber);
            const baseViewport = page.getViewport({ scale: 1 });
            const availableWidth = Math.max(
              320,
              Math.min(1200, Number(stage.clientWidth || viewer.innerWidth || 900) - 48)
            );
            const cssScale = Math.max(0.35, Math.min(2, availableWidth / Math.max(1, baseViewport.width)));
            const outputScale = Math.max(1, Math.min(2, Number(viewer.devicePixelRatio || 1)));
            const viewport = page.getViewport({ scale: cssScale * outputScale });
            const pageElement = doc.createElement('section');
            pageElement.className = 'preview-pdf-page';
            const label = doc.createElement('span');
            label.textContent = 'صفحة ' + toArabicNumerals(pageNumber) + ' من ' + toArabicNumerals(pdfDocument.numPages);
            const canvas = doc.createElement('canvas');
            canvas.width = Math.max(1, Math.ceil(viewport.width));
            canvas.height = Math.max(1, Math.ceil(viewport.height));
            canvas.style.width = Math.max(1, Math.round(viewport.width / outputScale)) + 'px';
            canvas.style.height = Math.max(1, Math.round(viewport.height / outputScale)) + 'px';
            canvas.setAttribute('aria-label', label.textContent);
            pageElement.append(label, canvas);
            pagesHost.appendChild(pageElement);
            const context = canvas.getContext('2d', { alpha: false });
            renderTask = page.render({
              canvasContext: context,
              viewport,
              background: 'rgb(255,255,255)',
              intent: 'print'
            });
            await renderTask.promise;
            renderTask = null;
            try { page.cleanup(); } catch (_) {}
            await waitForScannerWorkYield(viewer);
          }
        } catch (error) {
          if (pdfPreviewClosed || error?.name === 'RenderingCancelledException') return false;
          throw error;
        } finally {
          if (renderTask) {
            try { renderTask.cancel(); } catch (_) {}
            renderTask = null;
          }
          if (pdfDocument) {
            try { await pdfDocument.destroy(); } catch (_) {}
          }
          try { await loadingTask.destroy(); } catch (_) {}
          revokeBlobUrl();
        }
        updateScannerPreviewViewerProgress(viewer, 100, 'اكتمل عرض ملف PDF.');
        loading.hidden = true;
        try { viewer.focus(); } catch (_) {}
        return true;
      }

      stage.classList.remove('is-pdf', 'is-pdf-native', 'is-pdf-pages');
      toolbar.hidden = false;
      const image = doc.createElement('img');
      image.className = 'preview-image';
      image.alt = filename ? 'معاينة ' + filename : 'معاينة المستند';
      image.decoding = 'async';
      surface.appendChild(image);

      const zoomLevels = [0.025, 0.05, 0.075, 0.1, 0.15, 0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];
      let currentScale = 1;
      let zoomMode = 'fit';
      let zoomFrame = 0;
      const fitButton = toolbar.querySelector('[data-preview-action="zoom-fit"]');
      const actualButton = toolbar.querySelector('[data-preview-action="zoom-actual"]');
      const requestViewerFrame = typeof viewer.requestAnimationFrame === 'function'
        ? viewer.requestAnimationFrame.bind(viewer)
        : (callback) => window.setTimeout(callback, 0);
      const cancelViewerFrame = typeof viewer.cancelAnimationFrame === 'function'
        ? viewer.cancelAnimationFrame.bind(viewer)
        : window.clearTimeout.bind(window);
      const getSurfacePadding = () => {
        if (typeof viewer.getComputedStyle !== 'function') {
          return { horizontal: 48, vertical: 48 };
        }
        const style = viewer.getComputedStyle(surface);
        const readPadding = (property) => {
          const value = Number.parseFloat(style[property]);
          return Number.isFinite(value) ? Math.max(0, value) : 0;
        };
        return {
          horizontal: readPadding('paddingLeft') + readPadding('paddingRight'),
          vertical: readPadding('paddingTop') + readPadding('paddingBottom')
        };
      };

      const applyScale = (scale, mode = 'custom') => {
        if (!image.naturalWidth || !image.naturalHeight) return;
        const previousScrollWidth = Math.max(1, stage.scrollWidth);
        const previousScrollHeight = Math.max(1, stage.scrollHeight);
        const centerRatioX = (stage.scrollLeft + stage.clientWidth / 2) / previousScrollWidth;
        const centerRatioY = (stage.scrollTop + stage.clientHeight / 2) / previousScrollHeight;
        currentScale = Math.max(0.02, Math.min(4, Number(scale) || 1));
        zoomMode = mode;
        const renderedWidth = Math.max(1, Math.round(image.naturalWidth * currentScale));
        const renderedHeight = Math.max(1, Math.round(image.naturalHeight * currentScale));
        const surfacePadding = getSurfacePadding();
        image.style.width = renderedWidth + 'px';
        image.style.height = renderedHeight + 'px';
        surface.style.width = Math.max(stage.clientWidth, renderedWidth + surfacePadding.horizontal) + 'px';
        surface.style.height = Math.max(stage.clientHeight, renderedHeight + surfacePadding.vertical) + 'px';
        if (zoomLabel) zoomLabel.textContent = toArabicNumerals(Math.round(currentScale * 100)) + '٪';
        if (fitButton) fitButton.classList.toggle('is-active', zoomMode === 'fit');
        if (actualButton) actualButton.classList.toggle('is-active', zoomMode === 'actual');
        if (zoomFrame) cancelViewerFrame(zoomFrame);
        zoomFrame = requestViewerFrame(() => {
          zoomFrame = 0;
          if (zoomMode === 'fit') {
            stage.scrollLeft = 0;
            stage.scrollTop = 0;
          } else {
            stage.scrollLeft = Math.max(0, centerRatioX * stage.scrollWidth - stage.clientWidth / 2);
            stage.scrollTop = Math.max(0, centerRatioY * stage.scrollHeight - stage.clientHeight / 2);
          }
        });
      };

      const getFitScale = () => {
        if (!image.naturalWidth || !image.naturalHeight) return 1;
        const surfacePadding = getSurfacePadding();
        const availableWidth = Math.max(1, stage.clientWidth - surfacePadding.horizontal - 2);
        const availableHeight = Math.max(1, stage.clientHeight - surfacePadding.vertical - 2);
        return Math.max(0.02, Math.min(
          1,
          availableWidth / image.naturalWidth,
          availableHeight / image.naturalHeight
        ));
      };

      const fitImage = () => {
        if (!image.naturalWidth || !image.naturalHeight) return;
        applyScale(getFitScale(), 'fit');
      };

      const stepZoom = (direction) => {
        const epsilon = 0.0001;
        let nextScale = currentScale;
        if (direction > 0) {
          nextScale = zoomLevels.find((level) => level > currentScale + epsilon) || zoomLevels[zoomLevels.length - 1];
        } else {
          const fitScale = getFitScale();
          if (currentScale > fitScale + epsilon) {
            applyScale(fitScale, 'fit');
            return;
          }
          for (let index = zoomLevels.length - 1; index >= 0; index -= 1) {
            if (zoomLevels[index] < currentScale - epsilon) {
              nextScale = zoomLevels[index];
              break;
            }
          }
        }
        applyScale(nextScale, 'custom');
      };

      toolbar.addEventListener('click', (event) => {
        const button = event.target.closest('[data-preview-action]');
        if (!button) return;
        const action = button.dataset.previewAction;
        if (action === 'zoom-in') stepZoom(1);
        else if (action === 'zoom-out') stepZoom(-1);
        else if (action === 'zoom-fit') fitImage();
        else if (action === 'zoom-actual') applyScale(1, 'actual');
      });
      viewer.addEventListener('resize', () => {
        if (zoomMode === 'fit') requestViewerFrame(fitImage);
      });
      image.addEventListener('load', () => {
        fitImage();
        requestViewerFrame(() => requestViewerFrame(fitImage));
        loading.hidden = true;
      }, { once: true });
      image.addEventListener('error', () => {
        revokeBlobUrl();
        showScannerPreviewViewerError(viewer, 'تعذر عرض صورة المعاينة.');
      }, { once: true });
      image.src = blobUrl;
      try { viewer.focus(); } catch (_) {}
      return true;
    } catch (_) {
      if (disposeBlobUrl) {
        disposeBlobUrl();
      } else if (blobUrl) {
        try { URL.revokeObjectURL(blobUrl); } catch (__) {}
      }
      return false;
    }
  }

  function loadImageFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(blob);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('تعذر قراءة الصورة.'));
      };
      image.src = url;
    });
  }

  function getCurrentScannerPdfPageState() {
    if (scannerState.documentKind !== 'pdf') return null;
    return scannerState.pdfPageStates[scannerState.pdfCurrentPageIndex] || null;
  }

  function normalizeScannerCornersForStorage(corners, width, height) {
    if (!Array.isArray(corners) || corners.length !== 4 || !width || !height) return null;
    return corners.map((point) => ({
      x: Math.max(0, Math.min(1, Number(point.x || 0) / width)),
      y: Math.max(0, Math.min(1, Number(point.y || 0) / height))
    }));
  }

  function restoreStoredScannerCorners(corners, width, height) {
    if (!Array.isArray(corners) || corners.length !== 4) return null;
    return corners.map((point) => ({
      x: Math.max(0, Math.min(width, Number(point.x || 0) * width)),
      y: Math.max(0, Math.min(height, Number(point.y || 0) * height))
    }));
  }

  function captureCurrentScannerPdfPage(options = {}) {
    const pageState = getCurrentScannerPdfPageState();
    if (!pageState || !scannerState.sourceCanvas) return;
    pageState.corners = normalizeScannerCornersForStorage(
      scannerState.corners,
      scannerState.sourceCanvas.width,
      scannerState.sourceCanvas.height
    );
    pageState.brightness = Number(scannerState.brightness || 0);
    pageState.contrast = Number(scannerState.contrast || 0);
    pageState.scannerMode = scannerState.scannerMode || 'digital-document';
    if (options.markDirty) pageState.dirty = true;
  }

  function markCurrentScannerPdfPageDirty() {
    const pageState = getCurrentScannerPdfPageState();
    if (pageState) pageState.dirty = true;
  }

  function updateScannerPdfPageControls(statusText = '') {
    if (!scannerState.overlay) return;
    const controls = scannerState.overlay.querySelector('.attachment-scanner-page-controls');
    const info = scannerState.overlay.querySelector('.attachment-scanner-page-info');
    const previous = scannerState.overlay.querySelector('[data-scanner-action="previous-page"]');
    const next = scannerState.overlay.querySelector('[data-scanner-action="next-page"]');
    const isPdf = scannerState.documentKind === 'pdf' && scannerState.pdfPageCount > 0;
    if (controls) controls.hidden = !isPdf;
    if (!isPdf) return;
    const pageNumber = scannerState.pdfCurrentPageIndex + 1;
    if (info) info.textContent = statusText || `صفحة ${toArabicNumerals(pageNumber)} من ${toArabicNumerals(scannerState.pdfPageCount)}`;
    if (previous) previous.disabled = scannerState.isLoading || pageNumber <= 1;
    if (next) next.disabled = scannerState.isLoading || pageNumber >= scannerState.pdfPageCount;
  }

  function resetScannerPdfState() {
    scannerState.pdfPageRenderRequestId += 1;
    const documentToDestroy = scannerState.pdfDocument;
    const loadingTaskToDestroy = scannerState.pdfLoadingTask;
    scannerState.pdfLoadingTask = null;
    scannerState.pdfDocument = null;
    scannerState.pdfOriginalBytes = null;
    scannerState.pdfPageCount = 0;
    scannerState.pdfCurrentPageIndex = 0;
    scannerState.pdfPageStates = [];
    if (documentToDestroy && typeof documentToDestroy.destroy === 'function') {
      try { void documentToDestroy.destroy(); } catch (_) {}
    } else if (loadingTaskToDestroy && typeof loadingTaskToDestroy.destroy === 'function') {
      try { void loadingTaskToDestroy.destroy(); } catch (_) {}
    }
  }

  async function renderScannerPdfPageImage(pageIndex, requestId, pageRenderRequestId) {
    const pageState = scannerState.pdfPageStates[pageIndex];
    if (!pageState || !scannerState.pdfDocument) throw new Error('تعذر العثور على صفحة PDF.');
    if (pageState.image) return pageState.image;
    const page = await scannerState.pdfDocument.getPage(pageIndex + 1);
    const baseViewport = page.getViewport({ scale: 1 });
    const baseMaxEdge = Math.max(1, baseViewport.width, baseViewport.height);
    const targetMaxEdge = Math.min(3400, Math.max(1800, Number(scannerState.exportSourceMaxEdge || 3400)));
    let scale = Math.min(4, targetMaxEdge / baseMaxEdge);
    const maxPixels = 14000000;
    scale = Math.min(scale, Math.sqrt(maxPixels / Math.max(1, baseViewport.width * baseViewport.height)));
    scale = Math.max(0.1, scale);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d', { alpha: false });
    context.save();
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
    await page.render({
      canvasContext: context,
      viewport,
      background: 'rgb(255,255,255)',
      // PDF.js uses requestAnimationFrame for display rendering. The editor
      // tab becomes hidden as soon as the preview tab opens, so Chromium can
      // pause that frame indefinitely. Print intent uses Promise scheduling
      // and preserves the same rendered pixels without depending on visibility.
      intent: 'print'
    }).promise;
    try { page.cleanup(); } catch (_) {}
    if (
      requestId !== scannerState.openRequestId
      || pageRenderRequestId !== scannerState.pdfPageRenderRequestId
      || !scannerState.overlay?.classList.contains('open')
    ) return null;
    pageState.pageWidth = Number(baseViewport.width || 0);
    pageState.pageHeight = Number(baseViewport.height || 0);
    // Canvas is already a valid CanvasImageSource for every downstream draw.
    // Reusing it avoids a large asynchronous PNG encode + Image decode cycle,
    // another operation browsers may defer while this tab is in the background.
    pageState.image = canvas;
    return canvas;
  }

  async function loadScannerPdfPage(pageIndex, options = {}) {
    if (scannerState.documentKind !== 'pdf' || !scannerState.pdfDocument) return false;
    const normalizedIndex = Math.max(0, Math.min(scannerState.pdfPageCount - 1, Number(pageIndex) || 0));
    const previousIndex = scannerState.pdfCurrentPageIndex;
    if (!options.skipCapture) captureCurrentScannerPdfPage();
    scannerState.pdfCurrentPageIndex = normalizedIndex;
    const requestId = Number(options.requestId || scannerState.openRequestId);
    const pageRenderRequestId = ++scannerState.pdfPageRenderRequestId;
    updateScannerPdfPageControls(`جاري تحميل الصفحة ${toArabicNumerals(normalizedIndex + 1)}...`);
    const pageState = scannerState.pdfPageStates[normalizedIndex];
    const image = await renderScannerPdfPageImage(normalizedIndex, requestId, pageRenderRequestId);
    if (!image) return false;
    initializeScannerImage(scannerState.filename, image, {
      scannerMode: pageState.scannerMode || 'digital-document',
      brightness: pageState.brightness || 0,
      contrast: pageState.contrast || 0,
      normalizedCorners: pageState.corners,
      corners: pageState.corners ? undefined : 'full',
      suppressPreviewRender: Boolean(options.suppressPreviewRender)
    });
    if (previousIndex !== normalizedIndex) {
      const previousState = scannerState.pdfPageStates[previousIndex];
      if (previousState) previousState.image = null;
    }
    updateScannerPdfPageControls();
    return true;
  }

  async function changeScannerPdfPage(offset) {
    if (scannerState.documentKind !== 'pdf' || scannerState.isLoading || scannerState.isSaving) return;
    const nextIndex = scannerState.pdfCurrentPageIndex + Number(offset || 0);
    if (nextIndex < 0 || nextIndex >= scannerState.pdfPageCount) return;
    setScannerLoading(true);
    try {
      await loadScannerPdfPage(nextIndex);
    } catch (error) {
      alert(error.message || 'تعذر تحميل صفحة PDF.');
    } finally {
      if (scannerState.overlay?.classList.contains('open')) setScannerLoading(false);
    }
  }

  async function initializeScannerPdf(filename, bytes, requestId) {
    const pdfjs = await ensurePdfJsLoaded();
    const originalBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
    const loadingTask = pdfjs.getDocument({
      data: originalBytes.slice(),
      cMapUrl: '/renewal/vendor/pdfjs/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/renewal/vendor/pdfjs/standard_fonts/',
      wasmUrl: '/renewal/vendor/pdfjs/wasm/'
    });
    scannerState.pdfLoadingTask = loadingTask;
    const pdfDocument = await loadingTask.promise;
    if (requestId !== scannerState.openRequestId || !scannerState.overlay?.classList.contains('open')) {
      try { await pdfDocument.destroy(); } catch (_) {}
      return false;
    }
    if (!pdfDocument.numPages) throw new Error('ملف PDF لا يحتوي على صفحات قابلة للتعديل.');
    scannerState.documentKind = 'pdf';
    scannerState.filename = filename;
    scannerState.pdfDocument = pdfDocument;
    scannerState.pdfOriginalBytes = originalBytes.slice();
    scannerState.pdfPageCount = pdfDocument.numPages;
    scannerState.pdfCurrentPageIndex = 0;
    scannerState.pdfPageStates = Array.from({ length: pdfDocument.numPages }, () => ({
      image: null,
      corners: null,
      brightness: 0,
      contrast: 0,
      scannerMode: 'digital-document',
      pageWidth: 0,
      pageHeight: 0,
      dirty: false
    }));
    return loadScannerPdfPage(0, { requestId, skipCapture: true });
  }

  function drawScannerImageWithProgressiveReduction(context, image, targetWidth, targetHeight) {
    const naturalWidth = Math.max(1, image.naturalWidth || image.width || targetWidth);
    const naturalHeight = Math.max(1, image.naturalHeight || image.height || targetHeight);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    if (Math.max(naturalWidth / targetWidth, naturalHeight / targetHeight) < 1.45) {
      context.drawImage(image, 0, 0, targetWidth, targetHeight);
      return;
    }

    // Reducing a dense security screen in one bilinear step folds its carrier
    // into wide moire bands. Half-size area-like stages remove that carrier
    // before it can alias, while the final high-quality draw reaches the exact
    // interactive canvas size.
    let currentSource = image;
    let currentWidth = naturalWidth;
    let currentHeight = naturalHeight;
    while (
      currentWidth > targetWidth * 1.45
      || currentHeight > targetHeight * 1.45
    ) {
      const nextWidth = Math.max(targetWidth, Math.round(currentWidth * 0.5));
      const nextHeight = Math.max(targetHeight, Math.round(currentHeight * 0.5));
      const stage = createCanvas(nextWidth, nextHeight);
      const stageContext = stage.getContext('2d', { alpha: false });
      stageContext.imageSmoothingEnabled = true;
      stageContext.imageSmoothingQuality = 'high';
      stageContext.fillStyle = '#ffffff';
      stageContext.fillRect(0, 0, nextWidth, nextHeight);
      stageContext.drawImage(currentSource, 0, 0, currentWidth, currentHeight, 0, 0, nextWidth, nextHeight);
      currentSource = stage;
      currentWidth = nextWidth;
      currentHeight = nextHeight;
    }
    context.drawImage(currentSource, 0, 0, currentWidth, currentHeight, 0, 0, targetWidth, targetHeight);
  }

  function initializeScannerImage(filename, image, options = {}) {
    const overlay = ensureAttachmentScannerOverlay();
    const maxEdge = scannerState.sourceMaxEdge;
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    scannerState.filename = filename;
    scannerState.image = image;
    scannerState.scannerMode = options.scannerMode || 'digital-document';
    scannerState.brightness = Number(options.brightness || 0);
    scannerState.contrast = Number(options.contrast ?? 0);
    scannerState.isDraggingCorner = false;
    scannerState.sourceZoomMode = 'fit';
    scannerState.previewZoomMode = 'fit';
    scannerState.sourceZoom = 1;
    scannerState.previewZoom = 1;
    cancelScannerZoomFrames();
    scannerState.sourceCanvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    scannerState.sourceCanvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    scannerState.sourceContext.clearRect(0, 0, scannerState.sourceCanvas.width, scannerState.sourceCanvas.height);
    drawScannerImageWithProgressiveReduction(
      scannerState.sourceContext,
      image,
      scannerState.sourceCanvas.width,
      scannerState.sourceCanvas.height
    );
    const restoredCorners = restoreStoredScannerCorners(
      options.normalizedCorners,
      scannerState.sourceCanvas.width,
      scannerState.sourceCanvas.height
    );
    if (restoredCorners && isScannerUsableQuad(restoredCorners, scannerState.sourceCanvas.width, scannerState.sourceCanvas.height)) {
      scannerState.corners = restoredCorners;
    } else if (options.corners === 'full') {
      scannerState.corners = [
        { x: 0, y: 0 },
        { x: scannerState.sourceCanvas.width, y: 0 },
        { x: scannerState.sourceCanvas.width, y: scannerState.sourceCanvas.height },
        { x: 0, y: scannerState.sourceCanvas.height }
      ];
    } else {
      const detectedCorners = detectScannerPaperCorners(scannerState.sourceContext.getImageData(0, 0, scannerState.sourceCanvas.width, scannerState.sourceCanvas.height));
      scannerState.corners = detectedCorners || createDefaultScannerCorners(scannerState.sourceCanvas.width, scannerState.sourceCanvas.height);
    }
    const brightness = overlay.querySelector('[data-scanner-slider="brightness"]');
    const contrast = overlay.querySelector('[data-scanner-slider="contrast"]');
    if (brightness) brightness.value = String(scannerState.brightness);
    if (contrast) contrast.value = String(scannerState.contrast);
    const filenameNode = overlay.querySelector('.attachment-scanner-filename');
    if (filenameNode) filenameNode.textContent = filename;
    updateScannerPdfPageControls();
    if (!options.suppressPreviewRender) {
      refreshScannerCanvases();
      const requestFrame = window.requestAnimationFrame
        ? window.requestAnimationFrame.bind(window)
        : (callback) => setTimeout(callback, 0);
      requestFrame(() => requestFrame(refreshScannerFitZooms));
    }
  }

  function waitForScannerFrame() {
    return new Promise((resolve) => {
      const requestFrame = typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : (callback) => setTimeout(callback, 16);
      requestFrame(() => resolve());
    });
  }

  function waitForScannerWorkYield(viewer = null) {
    return new Promise((resolve) => {
      let settled = false;
      let fallbackTimer = 0;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (fallbackTimer) window.clearTimeout(fallbackTimer);
        resolve();
      };

      // عرض opens a new active tab. Chromium can pause requestAnimationFrame
      // in the now-background Renewal tab indefinitely, so use the active
      // viewer's frame when available and keep a timer fallback.
      fallbackTimer = window.setTimeout(finish, 32);
      try {
        if (viewer && !viewer.closed && typeof viewer.requestAnimationFrame === 'function') {
          viewer.requestAnimationFrame(finish);
          return;
        }
      } catch (_) {}
      window.setTimeout(finish, 0);
    });
  }

  function updateScannerSliderValue(name, value) {
    if (!scannerState.overlay) return;
    const slider = scannerState.overlay.querySelector(`[data-scanner-slider="${name}"]`);
    if (slider) slider.value = String(value);
  }

  async function applyAutoScanToScanner() {
    if (!scannerState.sourceCanvas || !scannerState.sourceContext) return;
    const requestId = scannerState.openRequestId;
    setScannerLoading(true);
    try {
      await waitForScannerFrame();
      await waitForScannerFrame();
      if (requestId !== scannerState.openRequestId || !scannerState.overlay?.classList.contains('open')) return;
      const cleanSourceCanvas = createScannerCleanSourceCanvas();
      const cleanContext = cleanSourceCanvas.getContext('2d', { willReadFrequently: true });
      const imageData = cleanContext.getImageData(0, 0, cleanSourceCanvas.width, cleanSourceCanvas.height);
      const detectedCorners = detectScannerPaperCorners(imageData);
      scannerState.corners = detectedCorners || createDefaultScannerCorners(scannerState.sourceCanvas.width, scannerState.sourceCanvas.height);
      scannerState.scannerMode = 'digital-document';
      scannerState.brightness = 0;
      scannerState.contrast = 0;
      markCurrentScannerPdfPageDirty();
      updateScannerSliderValue('brightness', 0);
      updateScannerSliderValue('contrast', 0);
      refreshScannerCanvases();
      await waitForScannerFrame();
    } finally {
      if (requestId === scannerState.openRequestId) setScannerLoading(false);
    }
  }

  async function openAttachmentScannerEditor() {
    if (!canEditRenewalDocumentsForPortal()) return;
    if (attachmentState.selected.size !== 1) return;
    const filename = Array.from(attachmentState.selected)[0] || '';
    if (!isEditableScannerAttachment(filename)) {
      alert('التعديل متاح حالياً لصور JPG و PNG و WEBP وملفات PDF فقط.');
      return;
    }
    const isPdf = getAttachmentFileExtension(filename).toLowerCase() === 'pdf';
    scannerState.lastFocusedElement = document.activeElement;
    scannerState.sourceZoomMode = 'fit';
    scannerState.previewZoomMode = 'fit';
    scannerState.sourceZoom = 1;
    scannerState.previewZoom = 1;
    scannerState.previewDisplayWidth = 0;
    scannerState.previewDisplayHeight = 0;
    const requestId = ++scannerState.openRequestId;
    const overlay = ensureAttachmentScannerOverlay();
    toggleAttachmentScannerOverlay(true);
    setScannerLoading(true);
    try {
      const responsePromise = fetch(
        makeAbsoluteAttachmentUrl(getAttachmentFileUrl(filename)),
        { cache: 'no-store' }
      );
      const dependencyPromise = isPdf
        ? Promise.all([ensurePdfJsLoaded(), ensurePdfLibLoaded()])
        : Promise.resolve();
      const [response] = await Promise.all([responsePromise, dependencyPromise]);
      if (!response.ok) throw new Error('تعذر تحميل المستند للتعديل.');
      if (requestId !== scannerState.openRequestId || !overlay.classList.contains('open')) return;
      if (isPdf) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (requestId !== scannerState.openRequestId || !overlay.classList.contains('open')) return;
        await initializeScannerPdf(filename, bytes, requestId);
      } else {
        scannerState.documentKind = 'image';
        const image = await loadImageFromBlob(await response.blob());
        if (requestId !== scannerState.openRequestId || !overlay.classList.contains('open')) return;
        initializeScannerImage(filename, image);
      }
    } catch (error) {
      if (requestId !== scannerState.openRequestId) return;
      toggleAttachmentScannerOverlay(false);
      alert(error.message || 'تعذر فتح أداة التعديل.');
    } finally {
      if (requestId === scannerState.openRequestId && overlay.classList.contains('open')) setScannerLoading(false);
    }
  }

  function getProcessedPdfPageSize(pageState, processedCanvas) {
    const originalWidth = Math.max(1, Number(pageState?.pageWidth || 595.28));
    const originalHeight = Math.max(1, Number(pageState?.pageHeight || 841.89));
    const processedRatio = Math.max(0.01, processedCanvas.width / Math.max(1, processedCanvas.height));
    const originalRatio = originalWidth / originalHeight;
    if (Math.abs(processedRatio - originalRatio) / Math.max(0.01, originalRatio) < 0.025) {
      return [originalWidth, originalHeight];
    }
    const longestEdge = Math.max(originalWidth, originalHeight);
    return processedRatio >= 1
      ? [longestEdge, longestEdge / processedRatio]
      : [longestEdge * processedRatio, longestEdge];
  }

  async function buildProcessedScannerPdfBlob(onProgress = null, options = {}) {
    const reportProgress = typeof onProgress === 'function' ? onProgress : () => {};
    const outputMaxEdge = Math.max(640, Number(options.maxEdge || scannerState.exportMaxEdge));
    const outputSourceMaxEdge = Math.max(800, Number(options.sourceMaxEdge || scannerState.exportSourceMaxEdge));
    const perspectiveSteps = Math.max(4, Number(options.steps || 24));
    const yieldForWork = typeof options.yieldForWork === 'function'
      ? options.yieldForWork
      : () => new Promise((resolve) => setTimeout(resolve, 0));
    reportProgress(8, 'جاري قراءة ملف PDF...');
    if (!scannerState.pdfOriginalBytes || !scannerState.pdfDocument || !scannerState.pdfPageCount) {
      throw new Error('تعذر قراءة صفحات PDF للتعديل.');
    }
    captureCurrentScannerPdfPage({ markDirty: true });
    const editedPageIndexes = scannerState.pdfPageStates
      .map((pageState, index) => (pageState.dirty ? index : -1))
      .filter((index) => index >= 0);
    if (!editedPageIndexes.length) throw new Error('لم يتم اختيار صفحة PDF للتعديل.');
    reportProgress(12, 'جاري فتح صفحات PDF...');

    const { PDFDocument } = await ensurePdfLibLoaded();
    let pdfDocument;
    try {
      pdfDocument = await PDFDocument.load(scannerState.pdfOriginalBytes.slice());
    } catch (_) {
      throw new Error('تعذر فتح ملف PDF. قد يكون محمياً بكلمة مرور أو تالفاً.');
    }
    reportProgress(16, 'تم فتح ملف PDF.');

    const requestId = scannerState.openRequestId;
    for (let editIndex = 0; editIndex < editedPageIndexes.length; editIndex += 1) {
      const pageIndex = editedPageIndexes[editIndex];
      const pageState = scannerState.pdfPageStates[pageIndex];
      reportProgress(
        18 + (editIndex / editedPageIndexes.length) * 68,
        'جاري تجهيز الصفحة ' + toArabicNumerals(pageIndex + 1) + ' من ' + toArabicNumerals(scannerState.pdfPageCount) + '...'
      );
      scannerState.pdfCurrentPageIndex = pageIndex;
      updateScannerPdfPageControls(
        `جاري تجهيز الصفحة ${toArabicNumerals(pageIndex + 1)} من ${toArabicNumerals(scannerState.pdfPageCount)}`
      );
      const loaded = await loadScannerPdfPage(pageIndex, {
        requestId,
        skipCapture: true,
        suppressPreviewRender: true
      });
      if (!loaded) throw new Error('توقف تجهيز صفحات PDF قبل اكتماله.');
      const processedCanvas = buildProcessedScannerCanvas({
        maxEdge: outputMaxEdge,
        steps: perspectiveSteps,
        sourceMaxEdge: outputSourceMaxEdge
      });
      if (!processedCanvas) throw new Error(`تعذر تجهيز صفحة PDF رقم ${pageIndex + 1}.`);
      const pngBlob = await canvasToBlob(processedCanvas, 'image/png');
      const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
      const embeddedImage = await pdfDocument.embedPng(pngBytes);
      const [pageWidth, pageHeight] = getProcessedPdfPageSize(pageState, processedCanvas);
      pdfDocument.removePage(pageIndex);
      const replacementPage = pdfDocument.insertPage(pageIndex, [pageWidth, pageHeight]);
      replacementPage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight
      });
      // Release the largest temporary RGBA allocation before yielding or
      // processing another page. The embedded PNG is already owned by pdf-lib.
      try {
        processedCanvas.width = 1;
        processedCanvas.height = 1;
      } catch (_) {}
      pageState.image = null;
      await yieldForWork();
      reportProgress(
        18 + ((editIndex + 1) / editedPageIndexes.length) * 68,
        'تم تجهيز الصفحة ' + toArabicNumerals(pageIndex + 1) + '.'
      );
    }
    reportProgress(94, 'جاري إنشاء ملف PDF النهائي...');
    const outputBytes = await pdfDocument.save({ useObjectStreams: true });
    reportProgress(100, 'اكتملت المعاينة.');
    return new Blob([outputBytes], { type: 'application/pdf' });
  }

  async function previewEditedAttachmentResult() {
    if (!scannerState.filename || !scannerState.previewCanvas) return;
    if (scannerState.isLoading || scannerState.isSaving) return;
    const requestId = scannerState.openRequestId;
    const pdfPageIndexBefore = scannerState.documentKind === 'pdf' ? scannerState.pdfCurrentPageIndex : -1;
    if (scannerState.previewViewer && !scannerState.previewViewer.closed) {
      try { scannerState.previewViewer.close(); } catch (_) {}
    }
    const viewer = openScannerPreviewViewer(scannerState.filename);
    if (!viewer) {
      alert('يرجى السماح بالنوافذ المنبثقة لعرض المعاينة.');
      return;
    }
    scannerState.previewViewer = viewer;
    try {
      viewer.addEventListener('pagehide', () => {
        if (scannerState.previewViewer === viewer) scannerState.previewViewer = null;
      }, { once: true });
    } catch (_) {}
    updateScannerPreviewViewerProgress(viewer, 4, 'جاري تجهيز المعاينة...');
    setScannerLoading(true);
    try {
      await waitForScannerWorkYield(viewer);
      await waitForScannerWorkYield(viewer);
      let blob;
      let mimeType;
      if (scannerState.documentKind === 'pdf') {
        mimeType = 'application/pdf';
        try {
          blob = await buildProcessedScannerPdfBlob((progress, statusText) => {
            updateScannerPreviewViewerProgress(viewer, progress, statusText);
          }, {
            yieldForWork: () => waitForScannerWorkYield(viewer)
          });
        } finally {
          if (
            requestId === scannerState.openRequestId
            && scannerState.overlay?.classList.contains('open')
            && pdfPageIndexBefore >= 0
            && scannerState.pdfCurrentPageIndex !== pdfPageIndexBefore
          ) {
            try { await loadScannerPdfPage(pdfPageIndexBefore, { requestId, skipCapture: true }); } catch (_) {}
          }
        }
      } else {
        mimeType = getScannerOutputMime(scannerState.filename);
        updateScannerPreviewViewerProgress(viewer, 18, 'جاري تصحيح الصورة بكامل الدقة...');
        await waitForScannerWorkYield(viewer);
        const outputCanvas = buildProcessedScannerCanvas({
          maxEdge: scannerState.exportMaxEdge,
          steps: 24,
          sourceMaxEdge: scannerState.exportSourceMaxEdge
        });
        if (!outputCanvas) throw new Error('تعذر تجهيز المعاينة.');
        updateScannerPreviewViewerProgress(viewer, 82, 'جاري ترميز صورة المعاينة...');
        await waitForScannerWorkYield(viewer);
        blob = await canvasToBlob(outputCanvas, mimeType, scannerState.exportQuality);
        try {
          outputCanvas.width = 1;
          outputCanvas.height = 1;
        } catch (_) {}
      }
      updateScannerPreviewViewerProgress(viewer, 100, 'اكتملت المعاينة.');
      if (!await showScannerPreviewBlob(viewer, blob, mimeType, scannerState.filename)) {
        throw new Error('أُغلقت نافذة المعاينة قبل اكتمال التجهيز.');
      }
    } catch (error) {
      showScannerPreviewViewerError(viewer, error.message || 'تعذر تجهيز المعاينة.');
      if (requestId === scannerState.openRequestId) {
        alert(error.message || 'تعذر تجهيز المعاينة.');
      }
    } finally {
      if (requestId === scannerState.openRequestId) setScannerLoading(false);
    }
  }

  async function saveEditedAttachment() {
    if (!scannerState.filename || !scannerState.previewCanvas) return;
    const filename = scannerState.filename;
    scannerState.isSaving = true;
    setScannerLoading(true);
    try {
      await waitForScannerFrame();
      await waitForScannerFrame();
      let mimeType;
      let blob;
      if (scannerState.documentKind === 'pdf') {
        mimeType = 'application/pdf';
        blob = await buildProcessedScannerPdfBlob();
      } else {
        const outputCanvas = buildProcessedScannerCanvas({
          maxEdge: scannerState.exportMaxEdge,
          steps: 24,
          sourceMaxEdge: scannerState.exportSourceMaxEdge
        });
        if (!outputCanvas) throw new Error('تعذر تجهيز الصورة المعدلة.');
        mimeType = getScannerOutputMime(filename);
        blob = await canvasToBlob(outputCanvas, mimeType, scannerState.exportQuality);
      }
      const contentBase64 = await readBlobAsBase64(blob);
      const response = await fetch(PHOTO_ENDPOINTS.replace, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          file: {
            name: filename,
            type: mimeType,
            contentBase64
          }
        })
      });
      let result = null;
      try { result = await response.json(); } catch (_) {}
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.message || 'تعذر حفظ التعديل.');
      }
      attachmentState.oldAvailabilityRequestId += 1;
      attachmentState.oldAvailabilityCache.set(filename, true);
      toggleAttachmentScannerOverlay(false);
      if (attachmentState.overlay && attachmentState.overlay.classList.contains('open')) {
        renderAttachmentPanel();
        setTimeout(() => {
          try { attachmentState.editButton?.focus({ preventScroll: true }); } catch (_) {}
        }, 40);
      }
      const previousText = countEl.textContent;
      countEl.textContent = 'تم تبديل المستند.';
      countEl.style.color = '#198754';
      setTimeout(() => {
        countEl.style.color = '';
        countEl.textContent = previousText;
      }, 3000);
    } catch (error) {
      alert(error.message || 'تعذر حفظ التعديل.');
    } finally {
      scannerState.isSaving = false;
      setScannerLoading(false);
    }
  }

  async function openAttachmentFilesInViewer(files, options = {}) {
    const filenames = Array.from(files || []).map((filename) => String(filename || '').trim()).filter(Boolean);
    if (!filenames.length) {
      alert(options.emptyMessage || 'لا توجد مرفقات لعرضها.');
      return false;
    }

    const getFileUrl = typeof options.getFileUrl === 'function'
      ? options.getFileUrl
      : getAttachmentFileUrl;
    try {
      await ensurePdfLibLoaded();
    } catch (_) {
      alert('مكتبة PDF غير متاحة.');
      return false;
    }

    try {
      const { PDFDocument } = window.PDFLib;
      const outputPdf = await PDFDocument.create();
      const A4 = { w: 595.28, h: 841.89 };
      let appendedCount = 0;

      for (const filename of filenames) {
        const url = makeAbsoluteAttachmentUrl(getFileUrl(filename));
        let response;
        try {
          response = await fetch(url, { cache: 'no-store' });
        } catch (_) {
          continue;
        }
        if (!response || !response.ok) continue;

        const bytes = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || '';
        const isPdf = /pdf/i.test(contentType) || /\.pdf(\?|$)/i.test(url);
        const isPng = /png/i.test(contentType) || /\.png(\?|$)/i.test(url);
        const isJpg = /jpe?g/i.test(contentType) || /\.jpe?g(\?|$)/i.test(url);

        if (isPdf) {
          try {
            const srcPdf = await PDFDocument.load(bytes);
            const pages = await outputPdf.copyPages(srcPdf, srcPdf.getPageIndices());
            pages.forEach((page) => outputPdf.addPage(page));
            appendedCount += pages.length;
          } catch (_) {}
          continue;
        }

        if (isPng || isJpg) {
          try {
            const img = isPng ? await outputPdf.embedPng(bytes) : await outputPdf.embedJpg(bytes);
            const page = outputPdf.addPage([A4.w, A4.h]);
            const scale = Math.min(A4.w / img.width, A4.h / img.height);
            const width = img.width * scale;
            const height = img.height * scale;
            const x = (A4.w - width) / 2;
            const y = (A4.h - height) / 2;
            page.drawImage(img, { x, y, width, height });
            appendedCount += 1;
          } catch (_) {}
        }
      }

      if (!appendedCount) {
        alert(options.unavailableMessage || 'لا توجد ملفات قابلة للعرض الموحّد. المتاح حالياً: PDF و JPG و PNG.');
        return false;
      }

      const pdfBytes = await outputPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      const viewer = window.open(blobUrl, '_blank');
      if (!viewer) {
        alert('تعذر فتح نافذة العرض.');
        URL.revokeObjectURL(blobUrl);
        return false;
      }
      setTimeout(() => {
        try { URL.revokeObjectURL(blobUrl); } catch (_) {}
      }, 60000);
      return true;
    } catch (error) {
      console.error('Attachment view-all failed:', error);
      alert(options.failureMessage || 'تعذر تجهيز ملف العرض.');
      return false;
    }
  }

  async function viewAllAttachmentsForActiveRow() {
    const row = rawRows[attachmentState.activeRowIndex];
    const files = row ? getAttachmentFilesForRow(row) : [];
    if (!files.length) {
      alert('لا توجد مرفقات لعرضها.');
      return;
    }

    const viewButton = attachmentState.viewButton;
    if (viewButton) {
      viewButton.disabled = true;
      viewButton.textContent = '⏳ جارٍ التجهيز...';
    }

    try {
      await openAttachmentFilesInViewer(files);
    } finally {
      if (viewButton) {
        viewButton.disabled = false;
        viewButton.textContent = 'عرض';
      }
    }
  }

  function renderAttachmentPanel() {
    const row = rawRows[attachmentState.activeRowIndex];
    if (!row) {
      toggleAttachmentOverlay(false);
      return;
    }

    const files = getAttachmentFilesForRow(row);
    const validSelected = new Set();
    files.forEach((filename) => {
      if (attachmentState.selected.has(filename)) {
        validSelected.add(filename);
      }
    });
    attachmentState.selected = validSelected;

    const personName = readRowField(row, 'الاســـــــم') || readRowField(row, 'الاسم') || 'بدون اسم';
    const licenseNumber = toArabicNumerals(readRowField(row, 'رقم الرخصة') || '-');
    const stationName = readRowField(row, 'القسم') || '-';
    if (attachmentState.subtitle) {
      attachmentState.subtitle.textContent = `${personName} | ${licenseNumber} | ${stationName}`;
    }

    if (!files.length) {
      attachmentState.grid.innerHTML = '';
      attachmentState.grid.hidden = true;
      attachmentState.emptyState.hidden = false;
      updateAttachmentSelectionIndicators();
      return;
    }

    attachmentState.emptyState.hidden = true;
    attachmentState.grid.hidden = false;
    attachmentState.grid.innerHTML = files.map((filename) => {
      const safeName = escapeHTML(filename);
      const checked = attachmentState.selected.has(filename) ? 'checked' : '';
      const selectedClass = attachmentState.selected.has(filename) ? ' selected' : '';
      const icon = escapeHTML(getAttachmentOpenIcon(filename));
      return `
        <article class="attachment-card${selectedClass}">
          <div class="attachment-card-main">
            <label class="attachment-card-select">
              <input type="checkbox" class="attachment-file-checkbox" value="${safeName}" ${checked}>
              <span>تحديد</span>
            </label>
            <div class="attachment-name" title="${safeName}">${safeName}</div>
          </div>
          <div class="attachment-card-actions">
            <button type="button" class="attachment-open-btn" data-action="open-file" data-filename="${safeName}" title="فتح الملف">
              ${icon}
            </button>
          </div>
        </article>
      `;
    }).join('');
    updateAttachmentSelectionIndicators();
  }

  function toggleAttachmentOverlay(open) {
    const overlay = ensureAttachmentOverlay();
    if (!overlay) return;

    if (open) {
      if (!overlay.classList.contains('open')) {
        attachmentState.lastFocusedElement = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      }
      overlay.classList.add('open');
      setTimeout(() => {
        try {
          const modal = overlay.querySelector('.attachment-modal');
          if (modal) modal.focus({ preventScroll: true });
        } catch (_) {}
      }, 30);
      return;
    }

    overlay.classList.remove('open');
    overlay.dataset.loading = 'false';
    attachmentState.selected.clear();
    attachmentState.activeRowIndex = -1;
    updateAttachmentSelectionIndicators();
    try {
      if (attachmentState.lastFocusedElement) {
        attachmentState.lastFocusedElement.focus({ preventScroll: true });
      }
    } catch (_) {}
    attachmentState.lastFocusedElement = null;
  }

  function openAttachmentPanel(rowIndex) {
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || !rawRows[rowIndex]) return;
    attachmentState.activeRowIndex = rowIndex;
    attachmentState.selected.clear();
    ensureAttachmentOverlay();
    renderAttachmentPanel();
    toggleAttachmentOverlay(true);
  }

  function openAttachmentFilePicker(rowIndex) {
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || !rawRows[rowIndex]) return;
    const row = rawRows[rowIndex];
    if (!ensureAttachmentReady(row)) return;
    attachmentState.pendingUploadRowIndex = rowIndex;
    const input = ensureAttachmentFileInput();
    input.click();
  }

  function setupAttachmentButtons() {
    tbody.querySelectorAll('.attachment-trigger').forEach((button) => {
      button.addEventListener('click', () => {
        const rowIndex = Number.parseInt(button.dataset.rowIndex || '-1', 10);
        if (button.dataset.mode === 'view') {
          openAttachmentPanel(rowIndex);
        } else {
          openAttachmentPanel(rowIndex);
        }
      });
    });
  }

  function buildRenewalActionsCellHtml(actionsText, rowIndex) {
    const text = String(actionsText || '').trim();
    const safeRowIndex = escapeHTML(String(rowIndex));
    if (text) {
      return `<div class="renewal-actions-preview has-content" data-action="open-actions" data-row-index="${safeRowIndex}" title="${escapeHTML(text)}" role="button" tabindex="0">${escapeHTML(text)}</div>`;
    }
    return `<div class="renewal-actions-preview renewal-actions-preview--empty" data-action="open-actions" data-row-index="${safeRowIndex}" role="button" tabindex="0">—</div>`;
  }

  function setupRenewalActionsButtons() {
    tbody.querySelectorAll('.renewal-actions-cell').forEach((cell) => {
      cell.addEventListener('click', (event) => {
        event.preventDefault();
        const button = event.target && event.target.closest ? event.target.closest('[data-action="open-actions"]') : null;
        const row = cell.closest('tr');
        const rowIndex = Number.parseInt((button && button.dataset.rowIndex) || (row && row.dataset.index) || '-1', 10);
        openRenewalActionsFrame(rowIndex);
      });
      cell.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          const trigger = event.target && event.target.closest ? event.target.closest('[data-action="open-actions"]') : null;
          const row = cell.closest('tr');
          const rowIndex = Number.parseInt((trigger && trigger.dataset.rowIndex) || (row && row.dataset.index) || '-1', 10);
          openRenewalActionsFrame(rowIndex);
        }
      });
    });
  }

  function ensureRenewalActionsOverlay() {
    if (renewalActionsState.overlay && document.body.contains(renewalActionsState.overlay)) {
      return renewalActionsState.overlay;
    }
    const overlay = document.createElement('div');
    overlay.className = 'renewal-actions-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="renewal-actions-dialog" role="dialog" aria-modal="true" aria-labelledby="renewalActionsTitle" tabindex="-1">
        <div class="renewal-actions-header">
          <div>
            <h3 id="renewalActionsTitle">اجراءات</h3>
            <div class="renewal-actions-subtitle"></div>
          </div>
          <button type="button" class="renewal-actions-close" data-renewal-actions-action="close" title="اغلاق">&times;</button>
        </div>
        <div class="renewal-actions-body">
          <textarea class="renewal-actions-textarea" dir="rtl" spellcheck="false"></textarea>
        </div>
        <div class="renewal-actions-footer">
          <button type="button" class="renewal-actions-cancel" data-renewal-actions-action="close">إلغاء</button>
          <button type="button" class="renewal-actions-save" data-renewal-actions-action="save">حفظ</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    renewalActionsState.overlay = overlay;
    renewalActionsState.textarea = overlay.querySelector('.renewal-actions-textarea');
    renewalActionsState.title = overlay.querySelector('.renewal-actions-subtitle');
    renewalActionsState.saveButton = overlay.querySelector('.renewal-actions-save');
    renewalActionsState.closeButton = overlay.querySelector('.renewal-actions-close');

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeRenewalActionsFrame();
        return;
      }
      const control = event.target && event.target.closest ? event.target.closest('[data-renewal-actions-action]') : null;
      if (!control) return;
      const action = control.dataset.renewalActionsAction;
      if (action === 'close') closeRenewalActionsFrame();
      if (action === 'save') saveRenewalActionsText();
    });

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRenewalActionsFrame();
      }
    });

    return overlay;
  }

  function getRenewalActionsText(row) {
    return readRowField(row, 'اجراءات') || readRowField(row, 'إجراءات');
  }

  function setRenewalActionsSaving(isSaving) {
    if (!renewalActionsState.overlay) return;
    renewalActionsState.overlay.dataset.saving = isSaving ? 'true' : 'false';
    if (renewalActionsState.textarea) renewalActionsState.textarea.disabled = isSaving;
    if (renewalActionsState.saveButton) renewalActionsState.saveButton.disabled = isSaving;
    if (renewalActionsState.closeButton) renewalActionsState.closeButton.disabled = isSaving;
  }

  function updateRenewalActionsCell(rowIndex) {
    const row = rawRows[rowIndex];
    if (!row) return;
    const tableRow = Array.from(tbody.querySelectorAll('tr')).find((candidate) => candidate.dataset.index === String(rowIndex));
    if (!tableRow) return;
    const cell = tableRow.querySelector('.renewal-actions-cell');
    if (!cell) return;
    cell.innerHTML = buildRenewalActionsCellHtml(getRenewalActionsText(row), rowIndex);
  }

  function openRenewalActionsFrame(rowIndex) {
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || !rawRows[rowIndex]) return;
    const row = rawRows[rowIndex];
    const overlay = ensureRenewalActionsOverlay();
    const personName = readRowField(row, 'الاســـــــم') || readRowField(row, 'الاسم') || 'بدون اسم';
    const licenseNumber = readRowField(row, 'رقم الرخصة') || '-';
    const currentText = getRenewalActionsText(row);
    renewalActionsState.activeRowIndex = rowIndex;
    renewalActionsState.originalValue = currentText;
    renewalActionsState.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (renewalActionsState.title) {
      renewalActionsState.title.textContent = `${personName} | ${toArabicNumerals(licenseNumber)}`;
    }
    if (renewalActionsState.textarea) renewalActionsState.textarea.value = currentText;
    setRenewalActionsSaving(false);
    overlay.classList.add('is-visible');
    overlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
      try { renewalActionsState.textarea.focus({ preventScroll: true }); } catch (_) { try { renewalActionsState.textarea.focus(); } catch (__) {} }
    }, 30);
  }

  function closeRenewalActionsFrame() {
    const overlay = renewalActionsState.overlay;
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
    renewalActionsState.activeRowIndex = -1;
    renewalActionsState.originalValue = '';
    setRenewalActionsSaving(false);
    const previous = renewalActionsState.lastFocusedElement;
    renewalActionsState.lastFocusedElement = null;
    if (previous && typeof previous.focus === 'function') {
      setTimeout(() => {
        try { previous.focus({ preventScroll: true }); } catch (_) { try { previous.focus(); } catch (__) {} }
      }, 30);
    }
  }

  async function saveRenewalActionsText() {
    const rowIndex = renewalActionsState.activeRowIndex;
    const row = rawRows[rowIndex];
    if (!row) return;
    const valueToSave = String(renewalActionsState.textarea ? renewalActionsState.textarea.value : '')
      .replace(/\r\n/g, '\n')
      .trim();
    const previousValue = getRenewalActionsText(row);
    const hasChange = String(previousValue) !== String(valueToSave);
    if (!hasChange && !renewalShouldWarn()) {
      closeRenewalActionsFrame();
      return;
    }

    if (hasChange) {
      rawRows[rowIndex]['اجراءات'] = valueToSave;
      updateRenewalActionsCell(rowIndex);
      renewalMarkDirty();
    }

    setRenewalActionsSaving(true);
    try {
      const saveSuccess = await saveChangesToFile();
      if (saveSuccess) {
        closeRenewalActionsFrame();
      }
    } finally {
      setRenewalActionsSaving(false);
    }
  }

  function readLocalFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = () => reject(new Error(`تعذر قراءة الملف: ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  async function uploadAttachmentsForRow(rowIndex, files) {
    const row = rawRows[rowIndex];
    if (!row) return;

    const record = ensureAttachmentReady(row);
    if (!record) return;

    setAttachmentOverlayLoading(true);
    try {
      const preparedFiles = await Promise.all(files.map(async (file) => ({
        name: file.name,
        type: file.type,
        contentBase64: await readLocalFileAsBase64(file)
      })));

      const existingFiles = getAttachmentFilesForRow(row);
      const response = await fetch(PHOTO_ENDPOINTS.upload, {
        method: 'POST',
        headers: { 'Content-Type': 'application/vnd.renewal-upload+json' },
        body: JSON.stringify({
          record,
          existingFiles,
          files: preparedFiles
        })
      });

      let result = null;
      try { result = await response.json(); } catch (_) {}
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.message || 'تعذر رفع الملفات.');
      }

      setAttachmentFilesForRow(rowIndex, result?.files || existingFiles.concat(result?.addedFiles || []));
      renewalMarkDirty();
      render();
      if (attachmentState.overlay && attachmentState.overlay.classList.contains('open') && attachmentState.activeRowIndex === rowIndex) {
        renderAttachmentPanel();
      }

      const saveSuccess = await saveChangesToFile();
      if (!saveSuccess) {
        const previousText = countEl.textContent;
        countEl.textContent = 'تم رفع الملفات محلياً. أعد الحفظ لتثبيت الربط.';
        countEl.style.color = '#ea580c';
        setTimeout(() => {
          countEl.style.color = '';
          countEl.textContent = previousText;
        }, 3500);
      }
    } catch (error) {
      console.error('Attachment upload failed:', error);
      alert(error.message || 'تعذر رفع الملفات.');
    } finally {
      setAttachmentOverlayLoading(false);
    }
  }

  async function deleteSelectedAttachments() {
    const row = rawRows[attachmentState.activeRowIndex];
    if (!row) return;
    if (!attachmentState.selected.size) {
      alert('اختر الملفات التي ترغب في حذفها.');
      return;
    }

    const selectedFiles = Array.from(attachmentState.selected);
    if (!confirm(`هل أنت متأكد من حذف ${toArabicNumerals(selectedFiles.length)} ملف؟`)) {
      return;
    }

    const remainingFiles = getAttachmentFilesForRow(row).filter((filename) => !attachmentState.selected.has(filename));
    setAttachmentFilesForRow(attachmentState.activeRowIndex, remainingFiles);
    attachmentState.selected.clear();
    renewalMarkDirty();
    render();
    if (attachmentState.overlay && attachmentState.overlay.classList.contains('open')) {
      renderAttachmentPanel();
    }

    setAttachmentOverlayLoading(true);
    try {
      const saveSuccess = await saveChangesToFile();
      if (!saveSuccess) {
        const previousText = countEl.textContent;
        countEl.textContent = 'تم تعديل السجل محلياً فقط. أعد الحفظ لإكمال الحذف.';
        countEl.style.color = '#ea580c';
        setTimeout(() => {
          countEl.style.color = '';
          countEl.textContent = previousText;
        }, 3500);
        return;
      }

      const response = await fetch(PHOTO_ENDPOINTS.delete, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: selectedFiles })
      });

      let result = null;
      try { result = await response.json(); } catch (_) {}
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.message || 'تم حذف الروابط من السجل لكن تعذر حذف الملفات من المجلد.');
      }
    } catch (error) {
      console.error('Attachment delete failed:', error);
      const previousText = countEl.textContent;
      countEl.textContent = error.message || 'تم حذف الروابط من السجل لكن تعذر حذف الملفات من المجلد.';
      countEl.style.color = '#ea580c';
      setTimeout(() => {
        countEl.style.color = '';
        countEl.textContent = previousText;
      }, 4000);
    } finally {
      setAttachmentOverlayLoading(false);
    }
  }

  function preserveRenewalAccessMarker(){
    try { sessionStorage.setItem(OK_KEY, '1'); } catch {}
    try { localStorage.setItem(OK_KEY, '1'); } catch {}
    ensurePortalSessionAlive();
  }

  async function cleanupRenewalTmpSafe(){
    try {
      const response = await fetch('/api/renewal/cleanup-tmp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true
      });

      if (response.ok) {
        const result = await response.json();
        console.log('🗑️ Cleanup result:', result.message);
      } else {
        console.warn('⚠️ Cleanup failed, but continuing with navigation');
      }
    } catch (error) {
      console.warn('⚠️ Could not perform cleanup:', error.message);
    }
  }

  function navigateToDashboard(){
    ensurePortalSessionAlive();
    const target = '/main.html';
    try {
      window.location.href = target;
    } catch (error) {
      try {
        window.location.assign(target);
      } catch (fallbackError) {
        console.warn('⚠️  Dashboard redirect via /main.html failed, falling back to /dashboard.', { error, fallbackError });
        try { window.location.href = '/dashboard'; }
        catch { location.href = '/dashboard'; }
      }
    }
  }

  logoutBtn.onclick = async () => {
    const proceed = await renewalTryConfirmNavigation({
      onSave: async () => {
        await saveChangesToFile();
        return !renewalShouldWarn();
      }
    });
    if (!proceed) return;
    preserveRenewalAccessMarker();
    await cleanupRenewalTmpSafe();
    navigateToDashboard();
  };
  setupCategoryToggleUI();
  setupSectorStripesUI();
  setupStationButtonsUI();
  setupColumnContentFilterHeaders();
  categorySelect.addEventListener('change', ()=>{currentPage=1;render();});
  sectorSelect.addEventListener('change', ()=> { toggleStationState(); if(sectorSelect.value){ buildStationOptions(); } currentPage=1; render(); });

  applyPortalSectorRestrictions();

  // Pagination
  function scrollTableToTop(){
    if(tableWrapper) tableWrapper.scrollTop = 0;
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) { window.scrollTo(0, 0); }
  }
  prevBtn.onclick = () => { if(currentPage > 1) { currentPage--; render(); scrollTableToTop(); } };
  nextBtn.onclick = () => { const maxPages = Math.ceil(getFilteredData().length / itemsPerPage); if(currentPage < maxPages) { currentPage++; render(); scrollTableToTop(); } };

  // Records per page selector
  const recordsPerPageSelect = document.getElementById('recordsPerPageSelect');
  recordsPerPageSelect.addEventListener('change', () => {
    const requestedPageSize = parseInt(recordsPerPageSelect.value, 10);
    itemsPerPage = Math.min(MAX_RECORDS_PER_PAGE, Number.isFinite(requestedPageSize) ? requestedPageSize : 100);
    if(String(itemsPerPage) !== recordsPerPageSelect.value) recordsPerPageSelect.value = String(itemsPerPage);
    currentPage = 1; // Reset to first page
    render();
  });

  // Sort functionality
  function setupSortButtons() {
    // Remove all existing event listeners by cloning buttons
    document.querySelectorAll('.sort-btn').forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
    });
    
    // Add fresh event listeners
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
  const column = this.dataset.column;
  if (!column) return; // safety
        
        // Toggle sort direction if same column, otherwise start with ascending
        if (currentSortColumn === column) {
          currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          currentSortColumn = column;
          currentSortDirection = 'asc';
        }
        
        // Update button visual states
        updateSortButtons();
        
        // Reset to first page and re-render with sorting
        currentPage = 1;
        render();
      });

    });
    setupColumnContentFilterHeaders();
  }

  function setupColumnContentFilterHeaders() {
    document.querySelectorAll('#dataTable thead th[data-column-filter]').forEach((header) => {
      if (header.dataset.columnFilterBound === 'true') return;
      header.dataset.columnFilterBound = 'true';
      header.tabIndex = 0;
      header.title = 'اضغط بزر الفأرة الأيمن لتصفية الصفوف الفارغة أو المليئة';
      header.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openColumnContentFilterMenu(event.clientX, event.clientY, header.dataset.columnFilter);
      });
      header.addEventListener('keydown', (event) => {
        if (!(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) return;
        event.preventDefault();
        const rect = header.getBoundingClientRect();
        openColumnContentFilterMenu(rect.left + rect.width / 2, rect.bottom, header.dataset.columnFilter);
      });
    });
    updateColumnContentFilterHeaders();
  }

  function ensureColumnContentFilterMenu() {
    if (columnContentFilterMenuEl && document.body.contains(columnContentFilterMenuEl)) {
      return columnContentFilterMenuEl;
    }
    const menu = document.createElement('div');
    menu.className = 'renewal-column-content-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'تصفية محتوى العمود');
    menu.innerHTML = `
      <button type="button" role="menuitemcheckbox" data-column-content-mode="empty">فارغ</button>
      <button type="button" role="menuitemcheckbox" data-column-content-mode="filled">مليئ</button>
    `;
    menu.addEventListener('click', (event) => {
      const button = event.target.closest('[data-column-content-mode]');
      if (!button) return;
      const column = menu.dataset.column || '';
      const mode = button.dataset.columnContentMode || '';
      if (!column || !mode) return;
      if (renewalColumnContentFilters.get(column) === mode) renewalColumnContentFilters.delete(column);
      else renewalColumnContentFilters.set(column, mode);
      currentPage = 1;
      hideColumnContentFilterMenu();
      updateColumnContentFilterHeaders();
      render();
    });
    document.body.appendChild(menu);
    columnContentFilterMenuEl = menu;
    document.addEventListener('pointerdown', (event) => {
      if (columnContentFilterMenuEl && !columnContentFilterMenuEl.contains(event.target)) {
        hideColumnContentFilterMenu();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hideColumnContentFilterMenu();
    });
    window.addEventListener('resize', hideColumnContentFilterMenu);
    window.addEventListener('scroll', hideColumnContentFilterMenu, true);
    return menu;
  }

  function openColumnContentFilterMenu(x, y, column) {
    if (!column) return;
    const menu = ensureColumnContentFilterMenu();
    menu.dataset.column = column;
    const selectedMode = renewalColumnContentFilters.get(column) || '';
    menu.querySelectorAll('[data-column-content-mode]').forEach((button) => {
      const active = button.dataset.columnContentMode === selectedMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-checked', active ? 'true' : 'false');
      button.title = active ? 'اضغط مرة أخرى لإلغاء التصفية' : '';
    });
    menu.classList.add('is-visible');
    menu.style.left = '0px';
    menu.style.top = '0px';
    const width = menu.offsetWidth || 150;
    const height = menu.offsetHeight || 96;
    const left = Math.max(8, Math.min(Number(x) || 0, window.innerWidth - width - 8));
    const top = Math.max(8, Math.min(Number(y) || 0, window.innerHeight - height - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    const activeButton = menu.querySelector('.is-active') || menu.querySelector('[data-column-content-mode]');
    if (activeButton) activeButton.focus({ preventScroll: true });
  }

  function hideColumnContentFilterMenu() {
    if (columnContentFilterMenuEl) columnContentFilterMenuEl.classList.remove('is-visible');
  }

  function updateColumnContentFilterHeaders() {
    document.querySelectorAll('#dataTable thead th[data-column-filter]').forEach((header) => {
      const mode = renewalColumnContentFilters.get(header.dataset.columnFilter) || '';
      header.classList.toggle('has-content-filter', Boolean(mode));
      if (mode) header.dataset.activeContentFilter = mode === 'empty' ? 'فارغ' : 'مليئ';
      else delete header.dataset.activeContentFilter;
    });
  }

  function updateSortButtons() {
    document.querySelectorAll('.sort-btn').forEach(btn => {
      const column = btn.dataset.column;
      btn.classList.remove('asc', 'desc');
      
      if (currentSortColumn === column) {
        btn.classList.add(currentSortDirection);
        btn.title = currentSortDirection === 'asc' ? 'من أسفل إلى أعلى' : 'من أعلى إلى أسفل';
      } else {
        btn.title = 'من أعلى إلى أسفل';
      }
    });

    // If currentSortColumn points to a removed/disabled column, clear it
    if (currentSortColumn) {
      const exists = Array.from(document.querySelectorAll('.sort-btn')).some(b => b.dataset.column === currentSortColumn);
      if (!exists) {
        currentSortColumn = null;
        currentSortDirection = 'asc';
      }
    }
  }

  // Actions
  insertBtn.onclick = () => { showAddSheet(); };
  browserPrintBtn.onclick = () => { printWithBrowser(); };
  const ctrlPrintHandler = (event) => {
    try {
      const isCtrlMod = event.ctrlKey || event.metaKey;
      if (!isCtrlMod) return;
      const isPKey = event.code === 'KeyP'
        || event.keyCode === 80
        || event.which === 80
        || event.key === 'p' || event.key === 'P';
      if (!isPKey) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      const printBtn = document.getElementById('browserPrintBtn');
      if (printBtn) printBtn.click();
      else printWithBrowser();
    } catch (_) {}
  };
  window.addEventListener('keydown', ctrlPrintHandler, { capture: true });
  document.addEventListener('keydown', ctrlPrintHandler, { capture: true });
  saveBtn.onclick = () => { saveChangesToFile(); };
  if (undoBtn) undoBtn.onclick = () => { openUndoPanel(); };

  // Multi-select dropdowns
  setupMultiDropdown(document.getElementById('typeMulti'));
  window.addEventListener('reference-data:updated', () => {
    buildTypeOptions(true);
  });
  if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.refresh === 'function') {
    SHARED_REFERENCE_DATA.refresh()
      .then(() => buildTypeOptions(true))
      .catch(() => {});
  }

  const SEARCH_INPUT_DEBOUNCE_MS = 200;
  let searchInputDebounceTimer = null;
  let searchInputComposing = false;
  const applySearchFilters = () => {
    currentPage = 1;
    render();
  };
  const scheduleSearchFilter = () => {
    if(searchInputComposing) return;
    if(searchInputDebounceTimer) clearTimeout(searchInputDebounceTimer);
    searchInputDebounceTimer = setTimeout(() => {
      searchInputDebounceTimer = null;
      applySearchFilters();
    }, SEARCH_INPUT_DEBOUNCE_MS);
  };

  if(form){
    form.addEventListener('submit', (event)=>{
      event.preventDefault();
      if(searchInputDebounceTimer){
        clearTimeout(searchInputDebounceTimer);
        searchInputDebounceTimer = null;
      }
      applySearchFilters();
    });
    form.querySelectorAll('input[name="name"], input[name="license"]').forEach((input)=>{
      input.addEventListener('compositionstart', ()=>{
        searchInputComposing = true;
      });
      input.addEventListener('compositionend', ()=>{
        searchInputComposing = false;
        scheduleSearchFilter();
      });
      input.addEventListener('input', scheduleSearchFilter);
    });
    if (renewalSearchColumnSelect) {
      renewalSearchColumnSelect.addEventListener('change', ()=>{
        updateRenewalSearchPlaceholder();
        currentPage = 1;
        render();
      });
    }
    form.querySelectorAll('select[name="sector"], select[name="category"]').forEach(sel=>{
      sel.addEventListener('change', ()=>{currentPage=1;render();});
    });
  }

  function readDeleteApprovalInspectTarget() {
    try {
      const raw = sessionStorage.getItem(DELETE_APPROVAL_INSPECT_STORAGE_KEY);
      if (!raw) return null;
      const target = JSON.parse(raw);
      return target && target.programKey === 'renewal' ? target : null;
    } catch (_) {
      return null;
    }
  }

  function clearDeleteApprovalInspectTarget() {
    try { sessionStorage.removeItem(DELETE_APPROVAL_INSPECT_STORAGE_KEY); } catch (_) {}
  }

  function applyDeleteApprovalInspectTarget() {
    const target = readDeleteApprovalInspectTarget();
    if (!target || !form) return false;
    const nameInput = form.querySelector('input[name="name"]');
    const licenseInput = form.querySelector('input[name="license"]');
    if (nameInput) nameInput.value = target.name || '';
    if (licenseInput) licenseInput.value = target.license || '';
    if (renewalSearchColumnSelect) {
      renewalSearchColumnSelect.value = '__all__';
      updateRenewalSearchPlaceholder();
    }
    currentPage = 1;
    render();
    clearDeleteApprovalInspectTarget();
    return true;
  }
  try { window.applyDeleteApprovalInspectTarget = applyDeleteApprovalInspectTarget; } catch (_) {}

  // Initial
  toggleStationState();
  const startInitialDataLoad = () => {
    fetchAndRender({ forceReload: true, skipIfEditing: false, preserveScroll: true })
      .catch(() => {})
      .finally(() => {
        applyDeleteApprovalInspectTarget();
        refreshUndoRecords({ silent: true }).catch(() => {});
        startAutoRefresh();
      });
  };
  startInitialDataLoad();

  document.addEventListener('visibilitychange', () => {
    if(!document.hidden){
      fetchAndRender({ forceReload: false, skipIfEditing: true, preserveScroll: true }).catch(()=>{});
    }
  });

  window.addEventListener('beforeunload', (event) => {
    stopAutoRefresh();
    renewalBeforeUnloadHandler(event);
  });

  // ------- helpers inside initSheet -------
  function applyPortalSectorRestrictions(){
    if(!sectorSelect) return;
    const portalUser = getPortalUserProfile();
    if(!portalUser || hasPortalAdminAccess(portalUser)) return;

    const allowedSectors = deriveAllowedPortalSectors(portalUser)
      .filter((label) => label && label !== PORTAL_ADMIN_SECTOR_LABEL);

    if(!allowedSectors.length){
      sectorSelect.innerHTML = '<option value="">لا توجد قطاعات متاحة</option>';
      sectorSelect.value = '';
      sectorSelect.disabled = true;
      const stationWrapper = document.getElementById('stationMulti');
      if(stationWrapper){
        stationWrapper.classList.add('disabled');
        const btn = stationWrapper.querySelector('.mdrop-toggle');
        if(btn) btn.disabled = true;
      }
      if(stationContainer) stationContainer.innerHTML = '';
      try { updateStationToggleText(); } catch(_) {}
      sectorSelect.dataset.autoSelectionDone = 'true';
      return;
    }

    const allowedSet = new Set(allowedSectors);
    Array.from(sectorSelect.options).forEach((option) => {
      if(!option.value) return;
      if(!allowedSet.has(option.value)) option.remove();
    });

    let placeholder = sectorSelect.querySelector('option[value=""]');
    if(placeholder){
      placeholder.textContent = 'كل القطاعات المصرح بها';
      placeholder.disabled = false;
    } else {
      placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'كل القطاعات المصرح بها';
      placeholder.disabled = false;
      sectorSelect.insertBefore(placeholder, sectorSelect.firstChild);
    }

    sectorSelect.disabled = false;
    sectorSelect.value = '';
    placeholder.selected = true;

    toggleStationState();
    if (stationContainer) {
      stationContainer.innerHTML = '';
      try { updateStationToggleText(); } catch (_) {}
    }
    currentPage = 1;
    if (rawRows.length) {
      render();
    }
  }

  function getRenewalColumnContentValue(row, column) {
    if (!row || !column) return '';
    if (column === 'صورة') return getAttachmentFilesForRow(row).length ? 'filled' : '';
    if (column === 'اجراءات') return getRenewalActionsText(row);
    if (column === 'ملاحظـــات') return readRowField(row, 'ملاحظـــات') || readRowField(row, 'ملاحظات');
    if (column === 'الاســـــــم') return readRowField(row, 'الاســـــــم') || readRowField(row, 'الاسم');
    return readRowField(row, column);
  }

  function rowMatchesRenewalColumnContentFilters(row) {
    for (const [column, mode] of renewalColumnContentFilters.entries()) {
      const filled = String(getRenewalColumnContentValue(row, column) ?? '').trim() !== '';
      if (mode === 'empty' && filled) return false;
      if (mode === 'filled' && !filled) return false;
    }
    return true;
  }

  function getFilteredData(){
    const f=getFilters();
    return rawRows.filter(r=>matches(r,f));
  }

    function sortFilteredData(rows){
      if (!Array.isArray(rows)) return [];

      if (currentSortColumn) {
        const col = currentSortColumn;
        const dir = currentSortDirection === 'desc' ? -1 : 1;
        rows.sort((a,b)=>{
          let aVal, bVal;
          if (col === 'index') {
            aVal = rawRows.indexOf(a);
            bVal = rawRows.indexOf(b);
            return (aVal - bVal) * dir;
          }
          aVal = a[col] || a['﻿'+col] || '';
          bVal = b[col] || b['﻿'+col] || '';
          if (col === 'رقم الرخصة' || col === 'التجديد') {
            const an = parseInt(toEnglishNumerals(String(aVal))) || 0;
            const bn = parseInt(toEnglishNumerals(String(bVal))) || 0;
            return (an - bn) * dir;
          }
          const cmp = String(aVal).localeCompare(String(bVal), 'ar', {numeric:true});
          return cmp * dir;
        });
        return rows;
      }

      rows.sort((a, b) => {
        const sA = (a['القسم'] || '');
        const sB = (b['القسم'] || '');
        const sc = sA.localeCompare(sB, 'ar');
        if (sc !== 0) return sc;
        const licA = parseInt(toEnglishNumerals(String(a['رقم الرخصة'] || a['﻿رقم الرخصة'] || ''))) || 0;
        const licB = parseInt(toEnglishNumerals(String(b['رقم الرخصة'] || b['﻿رقم الرخصة'] || ''))) || 0;
        return licA - licB;
      });
      return rows;
    }

    function getOrderedVisibleData(){
      return sortFilteredData(getFilteredData());
    }

  function toggleStationState(){
    const wrapper = document.getElementById('stationMulti');
    if(!wrapper) return;
    const btn = wrapper.querySelector('.mdrop-toggle');
    const selectedSector = sectorSelect ? sectorSelect.value : '';
    const normalizedSector = normalizeSectorLabelValue(selectedSector);
    const allowedStations = normalizedSector ? getAllowedStationsForSectorLabel(normalizedSector) : [];
    if(normalizedSector && allowedStations.length){
      wrapper.classList.remove('disabled');
      if(btn) btn.disabled = false;
    } else {
      wrapper.classList.add('disabled');
      if(btn) btn.disabled = true;
      if(stationContainer){
        stationContainer.innerHTML = normalizedSector && !allowedStations.length
          ? '<div class="empty small">لا توجد أقسام متاحة</div>'
          : '';
      }
      updateStationToggleText();
      syncStationButtons();
    }
  }

  function buildStationOptions(){
    if(!sectorSelect.value){ stationContainer.innerHTML=''; updateStationToggleText(); syncStationButtons(); return; }
    const selectedSector = normalizeSectorLabelValue(sectorSelect.value);
    const stationList = selectedSector ? getAllowedStationsForSectorLabel(selectedSector) : [];
    if(!stationList.length){
      stationContainer.innerHTML='<div class="empty small">لا توجد أقسام متاحة</div>';
      updateStationToggleText();
      syncStationButtons();
      return;
    }
    const prev = getSelected('station');
    renderOptions(stationContainer, stationList, 'station');
    stationContainer.querySelectorAll('input[type=checkbox]').forEach(cb=>{
      if(prev.some((value) => stationValuesMatch(value, cb.value, selectedSector))) cb.checked = true;
      cb.parentElement.classList.toggle('on', cb.checked);
    });
    updateStationToggleText();
    syncStationButtons();
  }

  function buildTypeOptions(force = false){
    if(!typeContainer) return;
    const prev = getSelected('type');
    typeContainer.innerHTML = '';

    // Get all license types (data + configured settings)
    const allTypes = getAllLicenseTypes();

    renderOptions(typeContainer, allTypes, 'type');
    typeContainer.querySelectorAll('input[type=checkbox]').forEach(cb=>{
      if(prev.includes(cb.value)) {
        cb.checked = true;
        cb.parentElement.classList.add('on');
      }
    });
    updateTypeToggleText();
  }

  function isInlineEditingActive(){
    if (renewalActionsState.overlay && renewalActionsState.overlay.classList.contains('is-visible')) return true;
    const active = document.activeElement;
    if(!active) return false;
    if(active.isContentEditable && active.closest('#tbody')) return true;
    const tagName = active.tagName;
    if((tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') && active.closest('#tbody')){
      return true;
    }
    return false;
  }

  function captureSelectedRowIds(){
    const checked = Array.from(tbody.querySelectorAll('.row-checkbox:checked'));
    if(!checked.length) return null;
    return checked.map(cb => cb.value);
  }

  function restoreSelectedRowIds(ids){
    if(!Array.isArray(ids) || !ids.length) return;
    const idSet = new Set(ids);
    tbody.querySelectorAll('.row-checkbox').forEach(cb => {
      const shouldCheck = idSet.has(cb.value);
      cb.checked = shouldCheck;
      const row = cb.closest('tr');
      if(row) row.classList.toggle('selected', shouldCheck);
    });
    updateDeleteButton();
  }

  function computeDataSignature(csvText){
    if(typeof csvText !== 'string') return 'null';
    let hash = 0;
    for(let i = 0; i < csvText.length; i += 1){
      hash = ((hash << 5) - hash + csvText.charCodeAt(i)) | 0;
    }
    return `${csvText.length}:${hash >>> 0}`;
  }

  async function fetchRenewalCsvVersion(){
    try{
      const res = await fetch(RENEWAL_CSV_VERSION_ENDPOINT, { cache: 'no-store' });
      if(!res.ok) return null;
      const payload = await res.json();
      if(!payload || payload.ok === false || !payload.version) return null;
      return payload;
    }catch(_){
      return null;
    }
  }

  function startAutoRefresh(){
    if(autoRefreshTimerId) clearInterval(autoRefreshTimerId);
    autoRefreshTimerId = window.setInterval(() => {
      fetchAndRender({ forceReload: false, skipIfEditing: true, preserveScroll: true }).catch(()=>{});
    }, REFRESH_INTERVAL_MS);
  }

  function stopAutoRefresh(){
    if(autoRefreshTimerId){
      clearInterval(autoRefreshTimerId);
      autoRefreshTimerId = null;
    }
  }

  // Parse header line to preserve original column order
  function parseHeaderLine(text){
    const firstLine = (text||'').split(/\r?\n/)[0] || '';
    const headers=[]; let cur=''; let inside=false; for(let i=0;i<firstLine.length;i++){ const c=firstLine[i]; if(c==='"'){ if(inside && firstLine[i+1]==='"'){ cur+='"'; i++; } else { inside=!inside; } } else if(c===',' && !inside){ headers.push(cur.replace(/\uFEFF/g,'').trim()); cur=''; } else { cur+=c; } } headers.push(cur.replace(/\uFEFF/g,'').trim()); return headers.filter(h=>h!=='' || headers.length===1);
  }

  let csvHeaders = null;

  function getRenewalSearchColumnOptions() {
    const sourceHeaders = Array.isArray(csvHeaders) && csvHeaders.length
      ? mergeRenewalHeaders(csvHeaders)
      : mergeRenewalHeaders(RENEWAL_REQUIRED_HEADERS);
    const seen = new Set();
    return sourceHeaders
      .map((header) => String(header || '').replace(/\uFEFF/g, '').trim())
      .filter((header) => {
        if (!header || header === 'صورة') return false;
        const signature = normalizeHeaderKeyForClient(header);
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
      })
      .map((header) => ({ key: header, label: header }));
  }

  function getRenewalSearchColumnKeys() {
    return getRenewalSearchColumnOptions().map((option) => option.key);
  }

  function getRenewalSearchInput() {
    return form ? form.querySelector('input[name="name"]') : null;
  }

  function updateRenewalSearchPlaceholder() {
    const input = getRenewalSearchInput();
    if (!input || !renewalSearchColumnSelect) return;
    const selectedOption = renewalSearchColumnSelect.selectedOptions && renewalSearchColumnSelect.selectedOptions[0];
    const selectedLabel = selectedOption ? selectedOption.textContent.trim() : '';
    const isSpecificColumn = renewalSearchColumnSelect.value !== '__all__';
    const control = renewalSearchColumnSelect.closest('.search-column-control');
    input.placeholder = renewalSearchColumnSelect.value === '__all__'
      ? 'ابحث في كل الأعمدة'
      : `ابحث في ${selectedLabel || renewalSearchColumnSelect.value}`;
    if (control) control.classList.toggle('is-column-selected', isSpecificColumn);
    renewalSearchColumnSelect.title = isSpecificColumn
      ? `البحث في ${selectedLabel || renewalSearchColumnSelect.value}`
      : 'البحث في كل الأعمدة';
  }

  function populateRenewalSearchColumns() {
    if (!renewalSearchColumnSelect) return;
    const previous = renewalSearchColumnSelect.value || '__all__';
    renewalSearchColumnSelect.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = '__all__';
    allOption.textContent = 'كل الأعمدة';
    renewalSearchColumnSelect.appendChild(allOption);

    getRenewalSearchColumnOptions().forEach((option) => {
      const item = document.createElement('option');
      item.value = option.key;
      item.textContent = option.label;
      renewalSearchColumnSelect.appendChild(item);
    });

    renewalSearchColumnSelect.value = Array.from(renewalSearchColumnSelect.options).some((option) => option.value === previous)
      ? previous
      : '__all__';
    updateRenewalSearchPlaceholder();
  }

  function rowMatchesRenewalSearch(row, queryKey, searchColumns) {
    if (!queryKey) return true;
    const columns = Array.isArray(searchColumns) && searchColumns.length
      ? searchColumns
      : getRenewalSearchColumnKeys();
    return columns.some((column) => normalizeArabicMatchKey(readRowField(row, column)).includes(queryKey));
  }

  async function fetchAndRender(options){
    const opts = typeof options === 'boolean' ? { forceReload: options } : (options || {});
    const {
      forceReload = false,
      skipIfEditing = false,
      preserveScroll = false,
      showLoadingState = !rawRows.length
    } = opts;

  if(isFetchInFlight) return false;
  if(!forceReload && skipIfEditing && isInlineEditingActive()) return false;
  if(!forceReload && typeof document !== 'undefined' && document.hidden) return false;
  if(!forceReload && renewalShouldWarn()) return false;

    isFetchInFlight = true;
    const prevSelectedIds = captureSelectedRowIds();
    const prevScrollTop = tableWrapper ? tableWrapper.scrollTop : null;

    try{
      const versionPayload = await fetchRenewalCsvVersion();
      if(!forceReload && versionPayload && lastCsvVersion && versionPayload.version === lastCsvVersion) return false;

      if(showLoadingState){
        tbody.innerHTML = '<tr><td colspan="11" class="empty">تحميل البيانات...</td></tr>';
      }

      const res = await fetch(RENEWAL_CSV_ENDPOINT, { cache: 'no-store' });
      if(!res.ok) throw new Error('HTTP '+res.status);
      const payload = await res.json();
      if(!payload || payload.ok === false) throw new Error((payload && payload.message) || 'No data');
      const csvText = payload.csvText || '';
      const signature = computeDataSignature(csvText);
      if(!forceReload && lastDataSignature && signature === lastDataSignature) {
        if(versionPayload && versionPayload.version) lastCsvVersion = versionPayload.version;
        return false;
      }
      lastCsvVersion = versionPayload && versionPayload.version ? versionPayload.version : `csv:${signature}`;
      lastDataSignature = signature;
      csvHeaders = mergeRenewalHeaders(parseHeaderLine(csvText));
      populateRenewalSearchColumns();
      rawRows = parseCSV(csvText).map(ensureRenewalRowShape);
      captureRenewalBaseline();
  renewalClearDirty();
      pendingSelectionRestore = prevSelectedIds;
      pendingScrollRestore = preserveScroll ? prevScrollTop : null;
      render();
      return true;
    }catch(err){
      console.error('Failed to fetch data:', err);
      if(!rawRows.length){
        tbody.innerHTML = '<tr><td colspan="11" class="empty">تعذر تحميل الملف: '+escapeHTML(err.message)+'</td></tr>';
      }
      return null;
    }finally{
      isFetchInFlight = false;
    }
  }

  function canApplyExternalSaveRefresh(){
    if (typeof document !== 'undefined' && document.hidden) return false;
    if (isFetchInFlight) return false;
    if (renewalShouldWarn()) return false;
    if (isInlineEditingActive()) return false;
    return true;
  }

  async function applyPendingExternalSaveRefresh(){
    if (!pendingExternalSaveRefresh) return false;
    if (!canApplyExternalSaveRefresh()) return false;
    const refreshed = await fetchAndRender({
      forceReload: false,
      skipIfEditing: false,
      preserveScroll: true,
      showLoadingState: false
    }).catch(() => null);
    if (refreshed === null) {
      pendingExternalSaveRefresh = true;
      scheduleExternalSaveRefresh();
      return false;
    }
    pendingExternalSaveRefresh = false;
    if (externalSaveRefreshTimerId) {
      clearInterval(externalSaveRefreshTimerId);
      externalSaveRefreshTimerId = null;
    }
    return refreshed === true;
  }

  function scheduleExternalSaveRefresh(){
    if (externalSaveRefreshTimerId) return;
    externalSaveRefreshTimerId = window.setInterval(() => {
      void applyPendingExternalSaveRefresh();
    }, 2500);
  }

  function handleExternalSaveRefresh(event){
    const detail = event && event.detail && typeof event.detail === 'object' ? event.detail : null;
    if (!detail || detail.kind !== 'save' || detail.programKey !== 'renewal') return;
    pendingExternalSaveRefresh = true;
    void applyPendingExternalSaveRefresh();
    if (pendingExternalSaveRefresh) {
      scheduleExternalSaveRefresh();
    }
  }

  window.addEventListener('activity:external-save', handleExternalSaveRefresh);

  function renderOptions(container, list, group){
    container.innerHTML = list.map(val=>`<label><input type="checkbox" value="${escapeHTML(val)}" data-group="${group}"><span>${escapeHTML(val)}</span></label>`).join('');
    container.querySelectorAll('input[type=checkbox]').forEach(cb=>{
      cb.addEventListener('change', ()=> { 
        if(group==='station'){ 
          cb.parentElement.classList.toggle('on', cb.checked); 
          updateStationToggleText(); 
          syncStationButtons();
        } else if(group==='type'){ 
          cb.parentElement.classList.toggle('on', cb.checked); 
          updateTypeToggleText(); 
        } 
        render(); 
      });
    });
    if(group==='station') updateStationToggleText();
    if(group==='type') updateTypeToggleText();
  }

  function updateStationToggleText(){
    const toggle = document.querySelector('#stationMulti .mdrop-toggle');
    const countLabel = document.getElementById('stationCountLabel');
    const sel = getSelected('station');
    if(!toggle) return;
    const normalizedSector = sectorSelect ? normalizeSectorLabelValue(sectorSelect.value) : '';
    const allowedStations = normalizedSector ? getAllowedStationsForSectorLabel(normalizedSector) : [];
    
    if(!sel.length) {
      if(normalizedSector && !allowedStations.length){
        toggle.textContent = 'لا توجد أقسام متاحة';
      } else {
        toggle.textContent = 'القسم';
      }
      if(countLabel) {
        countLabel.style.display = 'none';
      }
    } else if(sel.length === 1) {
      toggle.textContent = sel[0];
      if(countLabel) {
        countLabel.textContent = sel[0];
        countLabel.style.display = 'block';
      }
    } else {
      toggle.textContent = `اقسام (${toArabicNumerals(sel.length)})`;
      if(countLabel) {
        // Show all selected station names
        countLabel.textContent = sel.join(' - ');
        countLabel.style.display = 'block';
      }
    }
  }

  function updateTypeToggleText(){
    const toggle = document.querySelector('#typeMulti .mdrop-toggle');
    const sel = getSelected('type');
    if(!toggle) return;
    if(!sel.length) toggle.textContent = 'نوع الرخصة';
    else if(sel.length === 1) toggle.textContent = sel[0];
    else toggle.textContent = `انواع (${toArabicNumerals(sel.length)})`;
  }

  function getSelected(group){
    return Array.from(document.querySelectorAll(`input[type=checkbox][data-group="${group}"]:checked`)).map(i=>i.value);
  }

  function normalizeCategoryFilterValue(value){
    return CATEGORY_FILTER_VALUES.includes(value) ? value : '';
  }

  function syncCategoryToggleButtons(value){
    if(!categoryButtonsContainer) return;
    const normalized = normalizeCategoryFilterValue(value);
    categoryButtonsContainer.querySelectorAll('.status-toggle-btn').forEach((btn) => {
      const isActive = (btn.dataset.value || '') === normalized;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function setCategoryFilterValue(value, options = {}){
    if(!categorySelect) return;
    const normalized = normalizeCategoryFilterValue(value);
    if(categorySelect.value !== normalized){
      categorySelect.value = normalized;
    }
    syncCategoryToggleButtons(normalized);
    if(options.dispatch !== false){
      categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function setupCategoryToggleUI(){
    if(!categorySelect || !categoryButtonsContainer) return;
    categoryButtonsContainer.addEventListener('click', (event) => {
      const btn = event.target.closest('.status-toggle-btn');
      if(!btn) return;
      const nextValue = btn.dataset.value || '';
      if(categorySelect.value === nextValue) return;
      setCategoryFilterValue(nextValue);
    });
    categorySelect.addEventListener('change', () => {
      syncCategoryToggleButtons(categorySelect.value || '');
    });
    syncCategoryToggleButtons(categorySelect.value || '');
  }

  function getSectorStripeButtons(){
    return sectorStripesContainer
      ? Array.from(sectorStripesContainer.querySelectorAll('[data-sector-stripe]'))
      : [];
  }

  function updateActiveSectorStripe(value){
    if(!sectorStripesContainer) return;
    const normalized = value || '';
    sectorStripesContainer.dataset.activeSector = normalized;
    getSectorStripeButtons().forEach((btn) => {
      const isActive = btn.dataset.sector === normalized;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function renderSectorStripes(){
    if(!sectorSelect || !sectorStripesContainer) return;
    const options = Array.from(sectorSelect.options).filter((opt) => opt.value);
    sectorStripesContainer.innerHTML = '';
    options.forEach((opt, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sector-stripe';
      btn.dataset.sectorStripe = '';
      btn.dataset.sector = opt.value;
      btn.textContent = (opt.textContent || '').trim() || opt.value;
      btn.style.setProperty('--stripe-color', SECTOR_STRIPE_COLORS[index % SECTOR_STRIPE_COLORS.length]);
      btn.disabled = Boolean(opt.disabled) || Boolean(sectorSelect.disabled);
      btn.classList.toggle('is-disabled', btn.disabled);
      btn.setAttribute('aria-disabled', btn.disabled ? 'true' : 'false');
      sectorStripesContainer.appendChild(btn);
    });
    updateActiveSectorStripe(sectorSelect.value || '');
  }

  function setSectorFilterValue(value, options = {}){
    if(!sectorSelect) return;
    const normalized = value || '';
    if(sectorSelect.value !== normalized){
      sectorSelect.value = normalized;
    }
    updateActiveSectorStripe(normalized);
    if(options.dispatch !== false){
      sectorSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function setupSectorStripesUI(){
    if(!sectorSelect || !sectorStripesContainer) return;
    sectorStripesContainer.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-sector-stripe]');
      if(!btn || btn.disabled) return;
      const sectorValue = btn.dataset.sector || '';
      if(!sectorValue || sectorSelect.value === sectorValue) return;
      setSectorFilterValue(sectorValue);
    });
    sectorSelect.addEventListener('change', () => {
      updateActiveSectorStripe(sectorSelect.value || '');
    });
    const observer = new MutationObserver(() => renderSectorStripes());
    observer.observe(sectorSelect, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    renderSectorStripes();
  }

  function renderStationButtonsEmpty(message){
    if(!stationButtonsContainer) return;
    stationButtonsContainer.innerHTML = '';
    if(!message) return;
    const note = document.createElement('div');
    note.className = 'renewal-filter-empty';
    note.textContent = message;
    stationButtonsContainer.appendChild(note);
  }

  function syncStationButtons(){
    if(!stationButtonsContainer) return;
    const normalizedSector = sectorSelect ? normalizeSectorLabelValue(sectorSelect.value) : '';
    const checkboxes = stationContainer
      ? Array.from(stationContainer.querySelectorAll('input[type="checkbox"][data-group="station"]'))
      : [];

    stationButtonsContainer.innerHTML = '';
    if(!normalizedSector) return;

    if(!checkboxes.length){
      renderStationButtonsEmpty('لا توجد أقسام متاحة');
      return;
    }

    checkboxes.forEach((chk) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'station-btn';
      btn.textContent = chk.parentElement ? chk.parentElement.textContent.trim() : chk.value;
      btn.dataset.value = chk.value;
      btn.disabled = Boolean(chk.disabled);
      btn.classList.toggle('is-selected', chk.checked);
      btn.addEventListener('click', () => {
        if(chk.disabled) return;
        chk.click();
      });
      stationButtonsContainer.appendChild(btn);
    });
  }

  function setupStationButtonsUI(){
    if(!stationContainer || !stationButtonsContainer) return;
    const observer = new MutationObserver(() => syncStationButtons());
    observer.observe(stationContainer, { childList: true, subtree: true });
    stationContainer.addEventListener('change', (event) => {
      const target = event.target;
      if(target && target.matches('input[type="checkbox"][data-group="station"]')){
        syncStationButtons();
      }
    });
    syncStationButtons();
  }

  function getFilters(){
    const fd=new FormData(form);
    const name = (fd.get('name')||'').trim();
    const searchColumn = (fd.get('searchColumn')||'__all__').trim() || '__all__';
    const validSearchColumns = getRenewalSearchColumnKeys();
    return {
      category: (fd.get('category')||'').trim(),
      license: (fd.get('license')||'').trim(),
      name,
      nameSearchKey: normalizeArabicMatchKey(name),
      searchColumn,
      searchColumns: searchColumn === '__all__'
        ? validSearchColumns
        : (validSearchColumns.includes(searchColumn) ? [searchColumn] : validSearchColumns),
      sector: (fd.get('sector')||'').trim(),
      stations: getSelected('station'),
      types: getSelected('type')
    };
  }

  function matches(row,f){
    const access = getPortalStationAccessSnapshot();
    if(!access.isAdmin){
      const rawStationName = String(row['القسم'] || row['﻿القسم'] || '').trim();
      let sectorLabel = normalizeSectorLabelValue(row['قطاع'] || row['﻿قطاع'] || '');
      const stationName = normalizeStationLabelValue(rawStationName, sectorLabel);
      if(!sectorLabel && stationName){
        sectorLabel = normalizeSectorLabelValue(detectSectorLabelFromStationName(stationName));
      }
      if(access.allowedSectorLabels.size){
        if(sectorLabel){
          if(!access.allowedSectorLabels.has(sectorLabel)) return false;
        } else {
          return false;
        }
      }
      const allowedSet = access.allowedStationSetsByLabel[sectorLabel];
      if(allowedSet){
        if(!allowedSet.size) return false;
        if(stationName && !isStationInSet(stationName, allowedSet, sectorLabel)) return false;
        if(!stationName && access.hasAnyLimits) return false;
      } else if(stationName) {
        if(access.unionAllowedStations.size && !isStationInSet(stationName, access.unionAllowedStations, sectorLabel)) return false;
      } else if(access.hasAnyLimits){
        return false;
      }
    }

    if (!rowMatchesRenewalColumnContentFilters(row)) return false;

    // Notes category
    const notesVal = (row['ملاحظـــات']||'').trim();
    if(f.category === 'has-notes' && !notesVal) return false;
    if(f.category === 'no-notes' && notesVal) return false;

    // License filter: compare in English numerals to avoid digit-set issues
    if (f.license) {
      const filt = toEnglishNumerals(f.license);
      const lic  = toEnglishNumerals(row['رقم الرخصة']||row['﻿رقم الرخصة']||'');
      if (!lic.includes(filt)) return false;
    }

    // Search filter
    if (f.nameSearchKey && !rowMatchesRenewalSearch(row, f.nameSearchKey, f.searchColumns)) return false;

    // Sector
    if (f.sector && !((row['قطاع']||'').includes(f.sector))) return false;

    // Station
    if (f.stations.length) {
      const rowSector = normalizeSectorLabelValue(readRowField(row, 'قطاع') || f.sector || '');
      const rowStation = readRowField(row, 'القسم');
      const hasStationMatch = f.stations.some((station) => stationValuesMatch(station, rowStation, rowSector));
      if (!hasStationMatch) return false;
    }

    // Type - use normalized matching
    if (f.types.length) {
      const rowType = getNormalizedLicenseType(row['نوع الرخصة'] || '');
      const hasMatch = f.types.some(selectedType => {
        const normalizedSelected = getNormalizedLicenseType(selectedType);
        return normalizedSelected === rowType;
      });
      if (!hasMatch) return false;
    }

    return true;
  }

  function render(){
    const filtered = getOrderedVisibleData();
    const totalPages = Math.ceil(filtered.length / itemsPerPage);

    // Count + pagination
    countEl.textContent = `${toArabicNumerals(filtered.length)} / ${toArabicNumerals(rawRows.length)} صف`;
    pageInfo.textContent = `صفحة ${toArabicNumerals(currentPage)} من ${toArabicNumerals(totalPages || 1)}`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;

    if(!filtered.length){
      tbody.innerHTML='<tr><td colspan="11" class="empty">لا توجد نتائج</td></tr>';
      return;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filtered.slice(startIndex, endIndex);

    let html='';
    let currentStation=null;
    let counter=0;

    for(const row of pageData){
      const station = readRowField(row, 'القسم');

      if(station!==currentStation){ currentStation=station; counter=0; }
      counter++;

      const rowIndex = rawRows.indexOf(row);
      const isFirstInStation = counter === 1;
      const rawLicenseNumber = readRowField(row, 'رقم الرخصة');
      const licenseNumber = toEnglishNumerals(String(rawLicenseNumber));
      const sector = readRowField(row, 'قطاع');
      const personName = readRowField(row, 'الاســـــــم') || readRowField(row, 'الاسم');
      const rowSelectionId = buildRowSelectionId(rowIndex);
      const renewalValue = readRowField(row, 'التجديد') || readRowField(row, 'تجديد') || row['Renewal'] || row['renewal'] || readRowField(row, 'تم التجديد') || '';
      const licenseType = readRowField(row, 'نوع الرخصة');
      const notes = readRowField(row, 'ملاحظـــات') || readRowField(row, 'ملاحظات');
      const attachments = getAttachmentFilesForRow(row);
      const actionsText = readRowField(row, 'اجراءات') || readRowField(row, 'إجراءات');

      html += `<tr class="${isFirstInStation ? 'group-break' : ''}" data-index="${rowIndex}" data-license="${escapeHTML(licenseNumber)}" data-unique-id="${escapeHTML(rowSelectionId)}">`+
        `<td><input type="checkbox" class="row-checkbox" value="${escapeHTML(rowSelectionId)}" /></td>`+
  `<td><strong>${toArabicNumerals(counter)}</strong></td>`+
  `<td contenteditable="true" class="editable-cell" data-field="رقم الرخصة">${escapeHTML(toArabicNumerals(licenseNumber))}</td>`+
        `<td contenteditable="true" class="editable-cell dropdown-cell" data-field="نوع الرخصة">${escapeHTML(licenseType)}</td>`+
        `<td contenteditable="true" class="editable-cell" data-field="الاسم">${escapeHTML(personName)}</td>`+
        `<td contenteditable="true" class="editable-cell dropdown-cell" data-field="القسم" data-sector="${escapeHTML(sector)}"><strong>${escapeHTML(station)}</strong></td>`+
        `<td contenteditable="true" class="editable-cell dropdown-cell" data-field="قطاع">${escapeHTML(sector)}</td>`+
        `<td contenteditable="true" class="editable-cell" data-field="التجديد">${escapeHTML(toArabicNumerals(renewalValue))}</td>`+
        `<td contenteditable="true" class="editable-cell" data-field="ملاحظات" style="min-width:140px;">${escapeHTML(notes)}</td>`+
        `<td class="attachment-cell">${buildAttachmentButtonHtml(attachments, rowIndex)}</td>`+
        `<td class="renewal-actions-cell">${buildRenewalActionsCellHtml(actionsText, rowIndex)}</td>`+
      `</tr>`;
    }
    tbody.innerHTML=html;

    setupCheckboxListeners();
    setupEditableCells();
    setupAttachmentButtons();
    setupRenewalActionsButtons();
    setupSortButtons();
    updateSortButtons();
    if(Array.isArray(pendingSelectionRestore) && pendingSelectionRestore.length){
      restoreSelectedRowIds(pendingSelectionRestore);
      pendingSelectionRestore = null;
    }
    if(typeof pendingScrollRestore === 'number' && tableWrapper){
      tableWrapper.scrollTop = pendingScrollRestore;
      pendingScrollRestore = null;
    }
  }

  function setupCheckboxListeners(){
    const selectAllCheckbox = document.getElementById('selectAll');
    const rowCheckboxes = tbody.querySelectorAll('.row-checkbox');
    const deleteBtn = document.getElementById('deleteBtn');

    // Select All
    selectAllCheckbox.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      rowCheckboxes.forEach(cb => {
        cb.checked = isChecked;
        cb.closest('tr').classList.toggle('selected', isChecked);
      });
      updateDeleteButton();
    });

    // Individual
    rowCheckboxes.forEach(cb => {
      cb.addEventListener('change', (e) => {
        const row = e.target.closest('tr');
        row.classList.toggle('selected', e.target.checked);
        const checkedCount = tbody.querySelectorAll('.row-checkbox:checked').length;
        const totalCount = rowCheckboxes.length;
        selectAllCheckbox.checked = checkedCount === totalCount;
        selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < totalCount;
        updateDeleteButton();
      });
    });

    // Remove existing event listener and add new one to prevent multiple handlers
    const newDeleteBtn = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
    
    document.getElementById('deleteBtn').addEventListener('click', async () => {
      const selectedUniqueIds = Array.from(tbody.querySelectorAll('.row-checkbox:checked')).map(cb => cb.value);
      if(selectedUniqueIds.length === 0) return;
      if(confirm(`هل أنت متأكد من حذف ${toArabicNumerals(selectedUniqueIds.length)} سجل؟`)) {
        const currentDeleteBtn = document.getElementById('deleteBtn');
        if (currentDeleteBtn) {
          currentDeleteBtn.disabled = true;
        }
        await deleteSelectedRows(selectedUniqueIds);
      }
    });

    updateDeleteButton();
  }

  function updateDeleteButton(){
    const deleteBtn = document.getElementById('deleteBtn');
    const checkedCount = tbody.querySelectorAll('.row-checkbox:checked').length;
    deleteBtn.disabled = checkedCount === 0;
    deleteBtn.textContent = checkedCount > 0 ? `حذف المحدد (${toArabicNumerals(checkedCount)})` : 'حذف المحدد';
  }

  function setupEditableCells(){
    const editableCells = tbody.querySelectorAll('.editable-cell');
    editableCells.forEach(cell => {
      if (cell.classList.contains('dropdown-cell')) {
        setupDropdownCell(cell);
      } else {
        setupRegularCell(cell);
      }
    });
  }

  function setupRegularCell(cell) {
    cell.addEventListener('focus', (e) => {
      e.target.dataset.originalValue = e.target.textContent;
      e.target.style.backgroundColor = '#fff3cd';
    });

    cell.addEventListener('input', (e) => {
      const field = e.target.dataset.field;
      const text  = e.target.textContent;

      if (field === 'رقم الرخصة' || field === 'التجديد') {
        const asEnglish = toEnglishNumerals(text);
        if (asEnglish && /[^0-9]/.test(asEnglish)) {
          showValidationError(e.target, 'أرقام فقط');
          e.target.textContent = toArabicNumerals(asEnglish.replace(/[^0-9]/g, ''));
        } else {
          hideValidationError(e.target);
        }
      } else if (field === 'الاسم') {
        if (text && !isOnlyArabicLetters(text)) {
          showValidationError(e.target, 'حروف فقط');
          e.target.textContent = text.replace(/[^\u0600-\u06FF\s]/g, '');
        } else {
          hideValidationError(e.target);
        }
      }

      const caret = getCaretPosition(e.target);
      const conv  = toArabicNumerals(e.target.textContent);
      if (conv !== e.target.textContent) {
        e.target.textContent = conv;
        setCaretPosition(e.target, caret);
      }
    });

    cell.addEventListener('blur', (e) => {
      e.target.style.backgroundColor = '';
      const newValue = e.target.textContent.trim();
      const original = e.target.dataset.originalValue || '';
      if (newValue !== original) {
        saveEditedCell(e.target, newValue);
      }
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.target.textContent = e.target.dataset.originalValue || '';
        e.target.blur();
      }
    });
  }

  function setupDropdownCell(cell) {
    const field = cell.dataset.field;
    cell.contentEditable = false;
    cell.style.cursor = 'pointer';

    cell.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.cell-dropdown').forEach(d => d.remove());
      cell.dataset.originalValue = cell.textContent.trim();
      createCellDropdown(cell, field);
    });
  }

  function createCellDropdown(cell, field) {
    const dd = document.createElement('select');
    dd.className = 'cell-dropdown';
    
    const rect = cell.getBoundingClientRect();
    dd.style.cssText = `
      position: fixed; 
      z-index: 10000; 
      width: ${rect.width}px; 
      padding: 2px 4px;
      font-size: 12px; 
      border: 1px solid #000; 
      background: #fff; 
      max-height: 150px; 
      overflow-y: auto;
      font-family: inherit;
    `;

    dd.style.left = rect.left + 'px';
    dd.style.top  = (rect.bottom + 2) + 'px';

    if (field === 'نوع الرخصة') {
      dd.innerHTML = '<option value="">اختر نوع الرخصة</option>' +
        getAllLicenseTypes()
          .map(t => `<option value="${escapeHTML(t)}" ${cell.textContent.trim()===t?'selected':''}>${escapeHTML(t)}</option>`).join('');
    } else if (field === 'قطاع') {
      const opts = ['شرق','القطاع التجريبي الخامس','شمال','جنوب','غرب'];
      dd.innerHTML = '<option value="">اختر القطاع</option>' +
        opts.map(s => `<option value="${s}" ${cell.textContent.trim()===s?'selected':''}>${s}</option>`).join('');
    } else if (field === 'القسم') {
      const currentSector = cell.dataset.sector || cell.closest('tr').querySelector('[data-field="قطاع"]').textContent.trim();
      const normalizedSector = normalizeSectorLabelValue(currentSector);
      const stations = normalizedSector ? getAllowedStationsForSectorLabel(normalizedSector) : [];
      dd.innerHTML = '<option value="">اختر القسم</option>' +
        stations
          .map(s => `<option value="${escapeHTML(s)}" ${stationValuesMatch(cell.textContent.trim(), s, normalizedSector) ? 'selected' : ''}>${escapeHTML(s)}</option>`)
          .join('');
    }

    document.body.appendChild(dd);
    dd.focus();

    dd.addEventListener('change', e => {
      const val = e.target.value;
      const prev = cell.dataset.originalValue || '';
      if (field === 'القسم') cell.innerHTML = `<strong>${escapeHTML(val)}</strong>`;
      else cell.textContent = val;

      if (val !== prev) {
        saveEditedCell(cell, val);
        if (field === 'قطاع') {
          const stationCell = cell.closest('tr').querySelector('[data-field="القسم"]');
          if (stationCell) {
            stationCell.innerHTML = '<strong></strong>';
            stationCell.dataset.sector = normalizeSectorLabelValue(val);
          }
        }
      }
      dd.remove();
    });

    const close = (ev) => { if (!dd.contains(ev.target)) { dd.remove(); document.removeEventListener('click', close); } };
    setTimeout(() => document.addEventListener('click', close), 100);
    dd.addEventListener('keydown', ev => { if (ev.key === 'Escape') dd.remove(); });
  }

  function updateRowDatasetAttributes(rowEl, rowObj) {
    if (!rowEl || !rowObj) return;
    const license = toEnglishNumerals(readRowField(rowObj, 'رقم الرخصة'));
    const idx = rawRows.indexOf(rowObj);
    if (idx >= 0) {
      rowEl.dataset.index = String(idx);
    }
    rowEl.dataset.license = license;
    const uniqueId = buildRowSelectionId(idx);
    rowEl.dataset.uniqueId = uniqueId;
    const checkbox = rowEl.querySelector('.row-checkbox');
    if (checkbox) checkbox.value = uniqueId;
  }

  function saveEditedCell(cell, newValue) {
    const rowEl = cell.closest('tr');
    if (!rowEl) return;
    const field = cell.dataset.field;
    const rowIndexAttr = parseInt(rowEl.dataset.index ?? '-1', 10);
    const currentLicense = toEnglishNumerals(rowEl.dataset.license || '');

    let idx = Number.isNaN(rowIndexAttr) ? -1 : rowIndexAttr;
    if (idx < 0 || !rawRows[idx]) {
      // Prefer normalized 'رقم الرخصة', fallback to BOM key
      idx = rawRows.findIndex(r => (r['رقم الرخصة']||r['﻿رقم الرخصة']||'') === currentLicense);
    }

    if (idx !== -1 && rawRows[idx]) {
      let valueToStore = newValue;
      if (field === 'رقم الرخصة') {
        valueToStore = toEnglishNumerals(newValue);
      }

      const fieldMap = {
        'رقم الرخصة': 'رقم الرخصة',
        'نوع الرخصة': 'نوع الرخصة',
        'الاسم': 'الاســـــــم',
        'القسم': 'القسم',
        'قطاع': 'قطاع',
        'التجديد': 'التجديد',
        'ملاحظات': 'ملاحظـــات',
        'اجراءات': 'اجراءات'
      };

      const key = fieldMap[field] || field;
      const prevValue = rawRows[idx][key] ?? '';
      if (String(prevValue) === String(valueToStore ?? '')) {
        return;
      }

      rawRows[idx][key] = valueToStore;
      updateRowDatasetAttributes(rowEl, rawRows[idx]);
      renewalMarkDirty();

      cell.style.backgroundColor = '#d4edda';
      setTimeout(() => { cell.style.backgroundColor = ''; }, 700);
      console.log(`Updated ${field}: "${valueToStore}" for license ${rawRows[idx]['رقم الرخصة'] || rawRows[idx]['﻿رقم الرخصة'] || ''}`);
    }
  }

  async function deleteSelectedRows(uniqueIds){
    if (!Array.isArray(uniqueIds) || !uniqueIds.length) return;

    const originalRows = rawRows.slice();
    const targetIndexes = new Set(
      uniqueIds
        .map((value) => extractRowIndexFromSelectionId(value))
        .filter((value) => value >= 0)
    );
    if (!targetIndexes.size) return;
    const deletedRows = [];
    const remainingRows = [];

    for (let index = 0; index < originalRows.length; index += 1) {
      const row = originalRows[index];
      if (targetIndexes.has(index)) {
        deletedRows.push(row);
      } else {
        remainingRows.push(row);
      }
    }

    if (!deletedRows.length) return;

    const payload = deletedRows.map((row) => ({ record: buildUndoRecordPayload(row) }));
    let deleteResult = null;
    try {
      const response = await fetch('/api/renewal/delete-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: payload })
      });
      deleteResult = await response.json().catch(() => ({}));
      if (deleteResult && deleteResult.approvalRequired) {
        if (window.DeleteApprovalUserNotice) {
          window.DeleteApprovalUserNotice.track(deleteResult.request, { message: deleteResult.message });
        }
        return;
      }
      if (!response.ok) {
        throw new Error(deleteResult?.message || 'تعذر حذف السجلات المحددة.');
      }
    } catch (error) {
      console.error('Failed to delete renewal records:', error);
      countEl.textContent = error.message || 'تعذر حذف السجلات المحددة.';
      countEl.style.color = '#cc0000';
      setTimeout(() => {
        countEl.style.color = '';
        render();
      }, 3000);
      return;
    }

    rawRows = remainingRows;
    captureRenewalBaseline();
    currentPage = 1;
    renewalClearDirty();

    if (deleteResult && Array.isArray(deleteResult.undoRecords)) {
      updateUndoState(deleteResult.undoRecords);
    } else {
      await refreshUndoRecords({ silent: true }).catch(() => {});
    }

    render();
    const originalText = countEl.textContent;
    countEl.textContent = `تم حذف ${toArabicNumerals(deleteResult?.deletedCount || deletedRows.length)} سجل وحفظ نسخة للاسترجاع`;
    countEl.style.color = '#198754';
    setTimeout(() => {
      countEl.style.color = '';
      countEl.textContent = originalText;
    }, 2500);
  }

  // ─── Add-sheet (bottom slide-up popup) ───────────────────────────────────────
  let _addSheetOverlay = null;

  function buildAddSheetLicenseTypeOptions(currentValue = '') {
    const current = getNormalizedLicenseType(currentValue);
    const options = new Set(getAllLicenseTypes({ includeData: false }));
    if (current) options.add(current);
    return ['', ...Array.from(options).sort((a,b)=>a.localeCompare(b,'ar'))]
      .map(t => `<option value="${escapeHTML(t)}" ${current && t === current ? 'selected' : ''}>${t || 'اختر نوع الرخصة'}</option>`)
      .join('');
  }

  function refreshAddSheetLicenseTypeOptions() {
    const typeSelect = _addSheetOverlay?.querySelector('#newType');
    if (!typeSelect) return;
    const currentValue = typeSelect.value;
    typeSelect.innerHTML = buildAddSheetLicenseTypeOptions(currentValue);
    if (currentValue) {
      typeSelect.value = getNormalizedLicenseType(currentValue);
    }
  }

  window.addEventListener('reference-data:updated', refreshAddSheetLicenseTypeOptions);

  function _ensureAddSheet() {
    if (_addSheetOverlay) {
      refreshAddSheetLicenseTypeOptions();
      return;
    }

    const sectorOptions = ['', 'شرق', 'القطاع التجريبي الخامس', 'شمال', 'جنوب', 'غرب']
      .map(s => `<option value="${s}">${s || 'اختر القطاع'}</option>`).join('');

    const typeOptions = buildAddSheetLicenseTypeOptions();

    _addSheetOverlay = document.createElement('div');
    _addSheetOverlay.className = 'add-sheet-overlay';
    _addSheetOverlay.innerHTML = `
      <div class="add-sheet" role="dialog" aria-modal="true" aria-label="إضافة سجل جديد">
        <h3>إضافة سجل جديد</h3>
        <div class="add-sheet-fields">
          <div class="add-sheet-field">
            <label for="newLicense">رقم الرخصة</label>
            <input type="text" id="newLicense" placeholder="أرقام فقط" required />
          </div>
          <div class="add-sheet-field">
            <label for="newType">نوع الرخصة</label>
            <select id="newType" required>${typeOptions}</select>
          </div>
          <div class="add-sheet-field">
            <label for="newName">الاسم</label>
            <input type="text" id="newName" placeholder="حروف عربية فقط" required />
          </div>
          <div class="add-sheet-field">
            <label for="newSector">القطاع</label>
            <select id="newSector" required>${sectorOptions}</select>
          </div>
          <div class="add-sheet-field">
            <label for="newStation">القسم</label>
            <select id="newStation" disabled required><option value="">اختر القطاع أولاً</option></select>
          </div>
          <div class="add-sheet-field">
            <label for="newRenewal">التجديد</label>
            <input type="text" id="newRenewal" placeholder="أرقام فقط" />
          </div>
          <div class="add-sheet-field add-sheet-field--wide">
            <label for="newNotes">ملاحظات</label>
            <input type="text" id="newNotes" placeholder="اختياري" />
          </div>
        </div>
        <div class="add-sheet-actions">
          <button type="button" class="add-btn" onclick="addNewRow()">اضافة</button>
          <button type="button" class="cancel-btn" onclick="cancelInsert()">الغاء</button>
        </div>
      </div>
    `;
    document.body.appendChild(_addSheetOverlay);

    // Close on backdrop click
    _addSheetOverlay.addEventListener('click', e => {
      if (e.target === _addSheetOverlay) window.cancelInsert();
    });

    // Sector → station cascade
    const sectorSel = document.getElementById('newSector');
    const stationSel = document.getElementById('newStation');
    sectorSel.addEventListener('change', () => {
      const sel = normalizeSectorLabelValue(sectorSel.value);
      if (sel) {
        const stations = getAllowedStationsForSectorLabel(sel);
        if (stations.length) {
          stationSel.innerHTML = '<option value="">اختر القسم</option>' +
            stations.map(s => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join('');
          stationSel.disabled = false;
        } else {
          stationSel.innerHTML = '<option value="">لا توجد أقسام متاحة</option>';
          stationSel.disabled = true;
        }
      } else {
        stationSel.innerHTML = '<option value="">اختر القطاع أولاً</option>';
        stationSel.disabled = true;
      }
    });

    // Validation listeners
    document.getElementById('newLicense').addEventListener('input', function(e) {
      const v = e.target.value;
      if (v && !isOnlyNumbers(v)) {
        showValidationError(e.target, 'أرقام فقط');
        e.target.value = v.replace(/[^0-9]/g, '');
      } else { hideValidationError(e.target); }
    });
    document.getElementById('newRenewal').addEventListener('input', function(e) {
      const v = e.target.value;
      if (v && !isOnlyNumbers(v)) {
        showValidationError(e.target, 'أرقام فقط');
        e.target.value = v.replace(/[^0-9]/g, '');
      } else { hideValidationError(e.target); }
    });
    document.getElementById('newName').addEventListener('input', function(e) {
      const v = e.target.value;
      if (v && !isOnlyArabicLetters(v)) {
        showValidationError(e.target, 'حروف فقط');
        e.target.value = v.replace(/[^\u0600-\u06FF\s]/g, '');
      } else { hideValidationError(e.target); }
    });
  }

  function showAddSheet() {
    _ensureAddSheet();
    // Reset all fields
    ['newLicense', 'newType', 'newName', 'newSector', 'newRenewal', 'newNotes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const stationSel = document.getElementById('newStation');
    if (stationSel) { stationSel.innerHTML = '<option value="">اختر القطاع أولاً</option>'; stationSel.disabled = true; }
    _addSheetOverlay.classList.add('open');
    insertBtn.disabled = true;
    setTimeout(() => { const el = document.getElementById('newLicense'); if (el) el.focus(); }, 50);
  }

  function _closeAddSheet() {
    if (_addSheetOverlay) _addSheetOverlay.classList.remove('open');
    insertBtn.disabled = false;
  }

  function _showAddToast() {
    let toast = document.getElementById('_add-sheet-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = '_add-sheet-toast';
      toast.className = 'add-sheet-toast';
      toast.textContent = 'تم الإضافة والحفظ';
      document.body.appendChild(toast);
    }
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // Keep old name as alias so nothing else breaks
  function showInsertRow() { showAddSheet(); }

  // expose for onclick handlers
  window.addNewRow = async function(){
    const license = (document.getElementById('newLicense').value||'').trim();
    const type = (document.getElementById('newType').value||'').trim();
    const name = (document.getElementById('newName').value||'').trim();
    const station = (document.getElementById('newStation').value||'').trim();
    const sector = (document.getElementById('newSector').value||'').trim();
    const renewal = (document.getElementById('newRenewal').value||'').trim();
    const notes = (document.getElementById('newNotes').value||'').trim();

    if(!license || !type || !name || !station || !sector) {
      alert('يرجى ملء جميع الحقول المطلوبة (رقم الرخصة، نوع الرخصة، الاسم، القسم، القطاع)');
      return;
    }
    if (!isOnlyNumbers(license)) { alert('رقم الرخصة يجب أن يحتوي على أرقام فقط'); return; }
    if (!isOnlyArabicLetters(name)) { alert('الاسم يجب أن يحتوي على حروف عربية فقط'); return; }
    if (renewal && !isOnlyNumbers(renewal)) { alert('التجديد يجب أن يحتوي على أرقام فقط'); return; }

    const normalizedSector = normalizeSectorLabelValue(sector);
    const allowedStations = normalizedSector ? getAllowedStationsForSectorLabel(normalizedSector) : [];
    const normalizedStation = normalizeStationLabelValue(station, normalizedSector);
    if(normalizedSector && (!allowedStations.length || !isStationInList(normalizedStation, allowedStations, normalizedSector))){
      alert('القسم المختار غير مسموح به لهذا الفرد');
      return;
    }

    const newNameKey = normalizePersonNameKey(name);
    if (newNameKey) {
      const hasDuplicate = rawRows.some(row => normalizePersonNameKey(extractRowName(row)) === newNameKey);
      if (hasDuplicate) {
        alert('السجل موجود مسبقًا بنفس الاسم.');
        return;
      }
    }

    const newRow = {
      'رقم الرخصة': license,
      'نوع الرخصة': getNormalizedLicenseType(type),
      'الاســـــــم': name,
      'القسم': normalizedStation,
      'قطاع': normalizedSector || sector,
      'التجديد': renewal,
      'ملاحظـــات': notes,
      'صورة': '',
      'اجراءات': ''
    };
    const snapshot = rawRows.slice();
    rawRows.push(newRow);
    renewalMarkDirty();

    _closeAddSheet();

    const saveSuccess = await saveChangesToFile();
    if (!saveSuccess) {
      rawRows = snapshot;
      renewalClearDirty();
      render();
      countEl.textContent = 'خطأ في حفظ التغييرات بعد الإضافة';
      countEl.style.color = '#cc0000';
      setTimeout(() => {
        countEl.style.color = '';
        render();
      }, 3000);
      return;
    }

    render();
    _showAddToast();
  };

  window.cancelInsert = function(){
    _closeAddSheet();
    render();
  };

  function printWithBrowser() {
    const filtered = getOrderedVisibleData();
    if (!filtered.length) { alert('لا توجد بيانات للطباعة'); return; }

    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const dateStr = new Date().toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    });

    const PRINT_COLUMNS = [
      { key: 'license_number', label: 'رقم الرخصة', width: '9%', value: (row) => row['رقم الرخصة'] || row['﻿رقم الرخصة'] || '' },
      { key: 'license_type',   label: 'نوع الرخصة', width: '14%', value: (row) => row['نوع الرخصة'] || '' },
      { key: 'name',           label: 'الاسم',      width: '20%', value: (row) => row['الاســـــــم'] || '' },
      { key: 'station',        label: 'القسم',      width: '12%', value: (row) => row['القسم'] || '' },
      { key: 'sector',         label: 'القطاع',     width: '9%',  value: (row) => row['قطاع'] || '' },
      { key: 'renewal',        label: 'التجديد',    width: '9%',  value: (row) => row['التجديد'] || row['تجديد'] || row['Renewal'] || row['renewal'] || '' },
      { key: 'notes',          label: 'ملاحظات',    width: '23.5%', value: (row) => row['ملاحظـــات'] || '' }
    ];

    let currentStation = null;
    let counter = 0;
    let evenRow = false;
    let rowsHtml = '';
    const totalColspan = PRINT_COLUMNS.length + 1;

    for (const row of filtered) {
      const station = row['القسم'] || '';
      if (station !== currentStation) {
        currentStation = station;
        counter = 0;
        evenRow = false;
        const sector = esc(row['قطاع'] || '');
        rowsHtml += `<tr class="stn-hdr"><td data-span-all colspan="${totalColspan}">${esc(station)}${sector ? ' — ' + sector : ''}</td></tr>`;
      }
      counter++;
      const cells = PRINT_COLUMNS.map((c) => `<td data-col-key="${c.key}">${esc(c.value(row))}</td>`).join('');
      rowsHtml += `<tr${evenRow ? ' class="even"' : ''}><td>${counter}</td>${cells}</tr>`;
      evenRow = !evenRow;
    }

    const colgroupHtml = '<colgroup><col class="c1" style="width:3.5%"/>'
      + PRINT_COLUMNS.map((c) => `<col data-col-key="${c.key}" style="width:${c.width}"/>`).join('')
      + '</colgroup>';
    const headerCellsHtml = '<th>م</th>' + PRINT_COLUMNS.map((c) => `<th data-col-key="${c.key}">${esc(c.label)}</th>`).join('');
    const colChoicesJson = JSON.stringify(PRINT_COLUMNS.map((c) => ({ key: c.key, label: c.label })));

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>سجل التجديد</title>
<style>
@page { size: A3 landscape; margin: 10mm 10mm 16mm 10mm; @bottom-center { content: "صفحة " counter(page, arabic-indic) " من " counter(pages, arabic-indic); font-family: Arial, Tahoma, sans-serif; font-size: 10pt; color: #333; direction: rtl; } }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Tahoma, sans-serif; font-size: 12pt; direction: rtl; color: #000; }
h1 { text-align: center; font-size: 18pt; margin-bottom: 3mm; font-weight: bold; }
.sub { text-align: center; font-size: 11pt; margin-bottom: 5mm; color: #444; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
col.c1 { width: 3.5%; }
thead th { background: #1a1a2e; color: #fff; padding: 2mm 1.5mm; font-size: 12pt; font-weight: bold; text-align: center; border: 1px solid #000; }
tbody td { padding: 1.5mm 1.5mm; border: 1px solid #ccc; text-align: center; vertical-align: middle; word-break: break-word; }
tr.even td { background: #f0f4f8; }
tr.stn-hdr td { background: #2c3e50; color: #fff; font-weight: bold; font-size: 14pt; text-align: center; padding: 1.5mm; border: 1px solid #000; }
.print-settings { position: fixed; top: 12px; left: 12px; z-index: 9999; font-family: Arial, Tahoma, sans-serif; direction: rtl; }
.print-settings .ps-toggle { background: #1a1a2e; color: #fff; border: none; width: 50px; height: 50px; border-radius: 50%; cursor: pointer; font-size: 22px; box-shadow: 0 4px 14px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; transition: transform 0.15s, box-shadow 0.15s; }
.print-settings .ps-toggle:hover { transform: scale(1.08); box-shadow: 0 6px 18px rgba(0,0,0,0.35); }
.print-settings .ps-content { position: absolute; top: 62px; left: 0; background: #fff; border-radius: 16px; padding: 18px; width: 420px; box-shadow: 0 12px 40px rgba(0,0,0,0.22); max-height: 82vh; overflow-y: auto; border: 1px solid #e2e8f0; }
.print-settings .ps-content[hidden] { display: none; }
.print-settings h3 { font-size: 14pt; margin: 0 0 14px; color: #1a1a2e; text-align: center; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; font-weight: 700; }
.print-settings .ps-list { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
.print-settings .ps-item { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 10px; cursor: pointer; border: 2px solid #e2e8f0; background: #f8fafc; user-select: none; transition: all 0.15s; font-size: 11.5pt; color: #475569; min-height: 22px; }
.print-settings .ps-item:hover { border-color: #94a3b8; background: #f1f5f9; }
.print-settings .ps-item.is-visible { background: #1a1a2e; color: #fff; border-color: #1a1a2e; }
.print-settings .ps-item.is-visible:hover { background: #2d2d4f; border-color: #2d2d4f; }
.print-settings .ps-item input { position: absolute; opacity: 0; pointer-events: none; }
.print-settings .ps-item .ps-check { width: 22px; height: 22px; border-radius: 6px; border: 2px solid #cbd5e1; background: #fff; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all 0.15s; position: relative; }
.print-settings .ps-item.is-visible .ps-check { background: #fff; border-color: #fff; }
.print-settings .ps-item.is-visible .ps-check::after { content: ''; width: 5px; height: 11px; border: solid #1a1a2e; border-width: 0 2.5px 2.5px 0; transform: rotate(45deg); margin-top: -2px; }
.print-settings .ps-item .ps-text { flex: 1; font-weight: 600; line-height: 1.3; }
.print-settings .ps-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; border-top: 1px solid #e2e8f0; padding-top: 14px; }
.print-settings .ps-actions button { padding: 12px 14px; border-radius: 10px; border: 2px solid #e2e8f0; background: #fff; cursor: pointer; font-size: 11pt; font-family: inherit; font-weight: 700; color: #475569; transition: all 0.15s; }
.print-settings .ps-actions button:hover { background: #f1f5f9; border-color: #94a3b8; color: #1a1a2e; }
.print-settings .ps-actions .ps-print { background: #1a1a2e; color: #fff; border-color: #1a1a2e; grid-column: 1 / -1; font-size: 12pt; padding: 14px; }
.print-settings .ps-actions .ps-print:hover { background: #2d2d4f; border-color: #2d2d4f; color: #fff; }
@media print { .print-settings, .no-print { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
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
<h1>سجل التجديد &mdash; ملفات لم ترد</h1>
<div class="sub">تاريخ الطباعة: ${dateStr} &nbsp;|&nbsp; إجمالي السجلات: ${filtered.length}</div>
<table>
${colgroupHtml}
<thead><tr>${headerCellsHtml}</tr></thead>
<tbody>${rowsHtml}</tbody>
</table>
<script>
(function(){
	var STORAGE_KEY = 'renewalPrintHiddenCols';
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
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1200,height=850');
    if (!win) { alert('يرجى السماح بالنوافذ المنبثقة لهذا الموقع'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.onload = function () {
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
      try {
        const reprint = (ev) => {
          const isCtrlMod = ev.ctrlKey || ev.metaKey;
          if (!isCtrlMod) return;
          const isPKey = ev.code === 'KeyP' || ev.keyCode === 80 || ev.which === 80
            || ev.key === 'p' || ev.key === 'P';
          if (!isPKey) return;
          ev.preventDefault();
          ev.stopPropagation();
          if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
          try { win.print(); } catch (_) {}
        };
        win.addEventListener('keydown', reprint, { capture: true });
        win.document.addEventListener('keydown', reprint, { capture: true });
      } catch (_) {}
      win.focus();
    };
  }

  // Reduce a table row to the stored columns, normalized the way the CSV stores them.
  function buildRenewalRowRecord(row) {
    const shapedRow = ensureRenewalRowShape(row || {});
    const record = {};
    RENEWAL_REQUIRED_HEADERS.forEach(header => {
      record[header] = toEnglishNumerals(shapedRow[header] ?? '') ?? '';
    });
    return record;
  }

  function captureRenewalBaseline() {
    renewalBaselineRows = rawRows.map(buildRenewalRowRecord);
  }

  function renewalCellsEqual(left, right) {
    const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    return normalize(left) === normalize(right);
  }

  // Diff the table against the server snapshot taken at load time. rawRows is never
  // reordered (sorting runs on a filtered copy), so index pairing is reliable.
  function buildRenewalRowDelta() {
    const current = rawRows.map(buildRenewalRowRecord);
    const baseline = Array.isArray(renewalBaselineRows) ? renewalBaselineRows : [];
    const shared = Math.min(current.length, baseline.length);
    const edits = [];
    const additions = [];
    const removals = [];

    for (let index = 0; index < shared; index += 1) {
      const before = baseline[index];
      const after = current[index];
      const changed = RENEWAL_REQUIRED_HEADERS.some(header => !renewalCellsEqual(before[header], after[header]));
      if (changed) edits.push({ index, before, after });
    }
    for (let index = shared; index < current.length; index += 1) {
      additions.push({ index, record: current[index] });
    }
    for (let index = shared; index < baseline.length; index += 1) {
      removals.push({ index, record: baseline[index] });
    }

    return { edits, additions, removals, hasChanges: !!(edits.length || additions.length || removals.length) };
  }

  function reportRenewalSaveConflicts(conflicts) {
    const shown = conflicts.slice(0, 6).map(conflict => {
      const label = [conflict.name, conflict.license].filter(Boolean).join(' - ') || 'سجل';
      if (conflict.type === 'cell-conflict') return `${label}: ${(conflict.fields || []).join('، ')}`;
      if (conflict.type === 'missing-row') return `${label}: تم حذفه بواسطة مستخدم آخر`;
      if (conflict.type === 'duplicate-name') return `${label}: يوجد سجل آخر بنفس الاسم`;
      return label;
    });
    const extra = conflicts.length > shown.length
      ? `\n… و${toArabicNumerals(conflicts.length - shown.length)} غيرها`
      : '';
    alert(
      'تم حفظ باقي التعديلات، لكن التعديلات التالية غيّرها مستخدم آخر في نفس الوقت فلم يتم تطبيقها:\n\n'
      + shown.join('\n') + extra
      + '\n\nتم تحديث الجدول بأحدث البيانات، راجع هذه السجلات وأعد التعديل إذا لزم الأمر.'
    );
  }

  async function saveChangesToFile(){
    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'جاري الحفظ...';

      // Send only the rows this user touched. The server replays them onto whatever
      // is on disk at save time, so a colleague saving at the same moment is merged
      // instead of overwritten.
      const delta = buildRenewalRowDelta();
      if (!delta.hasChanges) {
        renewalClearDirty();
        return true;
      }

      const response = await fetch('/api/renewal/save-rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edits: delta.edits, additions: delta.additions, removals: delta.removals })
      });

      const result = await response.json().catch(() => ({}));

      if(!response.ok) {
        throw new Error(result?.error || result?.message || `فشل في حفظ البيانات (خطأ ${response.status})`);
      }

      if(result && result.approvalRequired) {
        renewalClearDirty();
        const originalText = countEl.textContent;
        countEl.textContent = result.message || 'تم إرسال طلب الاعتماد إلى المدير والسيكرتير الأول.';
        countEl.style.color = '#0d6efd';
        setTimeout(() => { countEl.style.color = ''; countEl.textContent = originalText; }, 5000);
        return true;
      }

      if(!result.ok) {
        throw new Error(result.error || 'خطأ غير معروف');
      }

      // Reload so this user also picks up whatever others saved while we were editing.
      renewalClearDirty();
      await fetchAndRender({ forceReload: true, preserveScroll: true, showLoadingState: false }).catch(() => null);

      const conflicts = Array.isArray(result.conflicts) ? result.conflicts : [];
      if(conflicts.length) {
        reportRenewalSaveConflicts(conflicts);
        return true;
      }

      const originalText = countEl.textContent;
      countEl.textContent = `تم حفظ التغييرات بنجاح (${toArabicNumerals(rawRows.length)} سجل)`;
      countEl.style.color = '#28a745';
      setTimeout(() => { countEl.style.color = ''; countEl.textContent = originalText; }, 3000);
      return true;
    } catch(error) {
      console.error('Save error:', error);
      alert('حدث خطأ أثناء الحفظ: ' + error.message);
      return false;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'حفظ التغييرات';
    }
  }

  function setupMultiDropdown(wrapper){
    if(!wrapper) return;
    const btn = wrapper.querySelector('.mdrop-toggle');
    const menu = wrapper.querySelector('.mdrop-menu');
    const isStation = wrapper.id === 'stationMulti';
    const isType = wrapper.id === 'typeMulti';
    btn.addEventListener('click', ()=>{
      if(isStation && btn.disabled) return;
      if(isStation){ buildStationOptions(); }
      if(isType){ buildTypeOptions(); }
      const open = !wrapper.classList.contains('open');
      document.querySelectorAll('.mdrop.open').forEach(w=>{ if(w!==wrapper){w.classList.remove('open'); w.querySelector('.mdrop-menu').hidden=true;} });
      if(open){ wrapper.classList.add('open'); menu.hidden=false; } else { wrapper.classList.remove('open'); menu.hidden=true; }
    });
    document.addEventListener('click', e=>{ if(!wrapper.contains(e.target)){ wrapper.classList.remove('open'); menu.hidden=true; }});
  }
} // end initSheet

// Init dispatcher
window.addEventListener('DOMContentLoaded', ()=>{
  if(isLoginPage()) initLogin();
  if(isSheetPage()) initSheet();
});
