'use strict';

const STORAGE_KEYS = {
  token: 'general.auth.token',
  user: 'general.auth.user'
};

const APP_CONFIG_ENDPOINT = '/api/app-config';
const DASHBOARD_PREFERENCES_ENDPOINT = '/api/dashboard-preferences';
const ACTION_APPROVAL_POLICY_ENDPOINT = '/api/action-approval-policy';
const DEFAULT_APP_CATALOG = [
  { key: 'settings', icon: '⚙️', label: 'الإعدادات', sub: 'إدارة الأفراد والصلاحيات', adminOnly: true },
  { key: 'weapons', icon: '🔐', label: 'برنامج الرخص الملغاة', sub: 'الرخص التي لم يتم سحبها' },
  { key: 'renewal', icon: '📄', label: 'برنامج الملفات التي لم ترد', sub: '' },
  { key: 'report', icon: '📊', label: 'برنامج القرارات', sub: 'سير العمل والقرارات' },
  { key: 'accept', icon: '🤝', label: 'موافقة شؤون الضباط', sub: 'منصة اعتماد الترشيحات' },
  { key: 'request', icon: '📝', label: 'برنامج طلبات ترخيص اول مرة', sub: 'استقبال واعتماد الطلبات' },
  { key: 'seized', icon: '📦', label: 'برنامج الأحراز', sub: 'إدارة الأحراز والمصادرات' },
  { key: 'storage', icon: '🗄️', label: 'التخزين الموحد', sub: 'مكتبة ملفات مشتركة حسب الصلاحيات' },
  { key: 'company', icon: '🏢', label: 'إدارة شركات الحراسة', sub: 'شركات الحراسة ونقل الأموال' }
];
const DEFAULT_APP_KEYS = DEFAULT_APP_CATALOG.map((entry) => entry.key);
const ACTION_APPROVAL_ACTIONS = ['add', 'edit', 'delete'];
const ACTION_APPROVAL_ACTION_LABELS = {
  add: 'إضافة',
  edit: 'تعديل',
  delete: 'حذف'
};
const ACTION_APPROVAL_EXCLUDED_APPS = new Set(['settings']);
const REFERENCE_DATA_ENDPOINT = '/api/reference-data';
const ACTIVITY_API_ENDPOINTS = {
  activeUsers: '/api/activity/active-users',
  roster: '/api/activity/roster',
  userLogs: (username, limit = 120) => `/api/activity/users/${encodeURIComponent(username)}\/logs?limit=${encodeURIComponent(limit)}`
};
const ACTIVITY_STRIP_POLL_MS = 15000;
const THEME_VALUES = { LIGHT: 'light' };
const SHARED_REFERENCE_DATA = window.AdministrativeSharedReferenceData || null;
const ADMIN_SECTOR_VALUE = 'الإدارة';
const SECTOR_CHOICES = SHARED_REFERENCE_DATA
  ? SHARED_REFERENCE_DATA.getSectorChoices('label')
  : [
    { value: 'شرق', label: 'شرق' },
    { value: 'غرب', label: 'غرب' },
    { value: 'شمال', label: 'شمال' },
    { value: 'جنوب', label: 'جنوب' },
    { value: 'القطاع التجريبي الخامس', label: 'القطاع التجريبي الخامس' }
  ];
const SECTOR_LABEL_MAP = SECTOR_CHOICES.reduce((map, choice) => {
  map[choice.value] = choice.label;
  return map;
}, { [ADMIN_SECTOR_VALUE]: ADMIN_SECTOR_VALUE });
const ALL_SECTOR_VALUES = SECTOR_CHOICES.map((choice) => choice.value);
const SECTOR_STATIONS = SHARED_REFERENCE_DATA
  ? SHARED_REFERENCE_DATA.getSectorStationsMap('label')
  : {
    'شرق': ['مكتب تجريبي 01', 'مكتب تجريبي 02', 'مكتب تجريبي 03', 'مكتب تجريبي 04', 'مكتب تجريبي 05', 'مكتب تجريبي 06', 'مكتب تجريبي 07', 'مكتب تجريبي 08', 'مكتب تجريبي 09', 'مكتب تجريبي 10'],
    'غرب': ['مكتب تجريبي 11', 'مكتب تجريبي 12', 'مكتب تجريبي 13', 'مكتب تجريبي 14', 'مكتب تجريبي 15', 'مكتب تجريبي 16', 'مكتب تجريبي 17', 'مكتب تجريبي 18', 'مكتب تجريبي 19'],
    'جنوب': ['مكتب تجريبي 20', 'مكتب تجريبي 21', 'مكتب تجريبي 22', 'مكتب تجريبي 23', 'مكتب تجريبي 24', 'مكتب تجريبي 25', 'مكتب تجريبي 26', 'مكتب تجريبي 27', 'مكتب تجريبي 28', 'مكتب تجريبي 29', 'مكتب تجريبي 30'],
    'شمال': ['مكتب تجريبي 31', 'مكتب تجريبي 32', 'مكتب تجريبي 33', 'مكتب تجريبي 34', 'مكتب تجريبي 35', 'مكتب تجريبي 36', 'مكتب تجريبي 37', 'مكتب تجريبي 38', 'مكتب تجريبي 39', 'مكتب تجريبي 40'],
    'القطاع التجريبي الخامس': ['مكتب تجريبي 41', 'مكتب تجريبي 42', 'مكتب تجريبي 43', 'مكتب تجريبي 44', 'مكتب تجريبي 45']
  };
const SECTOR_STATION_SETS = Object.fromEntries(
  Object.entries(SECTOR_STATIONS).map(([sector, stations]) => [sector, new Set(stations)])
);

const ROLE_DISPLAY_LABELS = {
  admin: { short: 'مدير', badge: 'مدير النظام', detail: 'مدير النظام' },
  supersecretary: { short: 'سيكرتير اول', badge: 'سيكرتير اول', detail: 'سيكرتير اول' },
  secretary: { short: 'سكرتير', badge: 'سكرتير', detail: 'سكرتير' },
  user: { short: 'فرد', badge: 'فرد', detail: 'فرد' }
};

const MIN_PASSWORD_LENGTH = 6;
const PRESENCE_COLOR_PALETTE = [
  { hex: '#ff72b4', rgb: '255,114,180' },
  { hex: '#5b8cff', rgb: '91,140,255' },
  { hex: '#1ec8a5', rgb: '30,200,165' },
  { hex: '#ff9d57', rgb: '255,157,87' },
  { hex: '#9b74ff', rgb: '155,116,255' },
  { hex: '#53c96b', rgb: '83,201,107' },
  { hex: '#ff6f61', rgb: '255,111,97' },
  { hex: '#f3c64f', rgb: '243,198,79' }
];
const ACCOUNT_ROLE_THEMES = {
  admin: { hex: '#4aa5de', rgb: '74,165,222', ink: '#082235' },
  supersecretary: { hex: '#f6b93b', rgb: '246,185,59', ink: '#ffffff' },
  secretary: { hex: '#c0c7d2', rgb: '192,199,210', ink: '#10141b' },
  user: { hex: '#8b5e34', rgb: '139,94,52', ink: '#ffffff' }
};
const ACTIVITY_STATUS_META = {
  online: {
    key: 'online',
    className: 'is-online',
    label: 'متصل الآن',
    fallbackSubtitle: 'متصل الآن',
    timeLabel: 'آخر نشاط'
  },
  inactive: {
    key: 'inactive',
    className: 'is-inactive',
    label: 'متصل لكن غير نشط',
    fallbackSubtitle: 'الجلسة ما زالت مفتوحة',
    timeLabel: 'آخر نشاط'
  },
  offline: {
    key: 'offline',
    className: 'is-offline',
    label: 'غير متصل',
    fallbackSubtitle: 'غير متصل حالياً',
    timeLabel: 'آخر دخول'
  }
};

function buildAppLabelMap(appCatalog) {
  return (Array.isArray(appCatalog) ? appCatalog : []).reduce((map, entry) => {
    const key = String(entry?.key || '').trim();
    if (!key) return map;
    map[key] = String(entry?.label || key).trim() || key;
    return map;
  }, {});
}

function hashString(value) {
  const text = String(value || '');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getPresenceColor(username) {
  if (!PRESENCE_COLOR_PALETTE.length) {
    return { hex: '#5b8cff', rgb: '91,140,255' };
  }
  return PRESENCE_COLOR_PALETTE[hashString(username) % PRESENCE_COLOR_PALETTE.length];
}

function buildPresenceStyle(username) {
  const color = getPresenceColor(username);
  return `--presence-color:${color.hex};--presence-rgb:${color.rgb};`;
}

function getAccountTheme(user) {
  const role = getNormalizedRole(user);
  if (ACCOUNT_ROLE_THEMES[role]) return ACCOUNT_ROLE_THEMES[role];
  const color = getPresenceColor(user?.username || user?.displayName || '');
  return { ...color, ink: '#ffffff' };
}

function buildAccountThemeStyle(user) {
  const theme = getAccountTheme(user || {});
  return `--account-accent-color:${theme.hex};--account-accent-rgb:${theme.rgb};--account-panel-ink:${theme.ink || '#111318'};`;
}

function applySettingsAccountPanelTheme(panel, user) {
  const content = panel ? panel.querySelector('.view-panel-content, .edit-panel-content') : null;
  if (!content) return;
  const theme = getAccountTheme(user || {});
  content.classList.add('settings-account-themed-panel');
  content.style.setProperty('--account-accent-color', theme.hex);
  content.style.setProperty('--account-accent-rgb', theme.rgb);
  content.style.setProperty('--account-panel-ink', theme.ink || '#111318');
}

function getActivityPresenceStatus(entry) {
  const normalized = String(entry?.presenceStatus || entry?.presenceState || '').trim().toLowerCase();
  if (normalized === 'inactive') return 'inactive';
  if (normalized === 'offline') return 'offline';
  if (entry && entry.isOnline === false) return 'offline';
  return 'online';
}

function getActivityPresenceMeta(entry) {
  const key = getActivityPresenceStatus(entry);
  return ACTIVITY_STATUS_META[key] || ACTIVITY_STATUS_META.offline;
}

let activeSession = { token: null, user: null };
let profilePromise = null;
let APP_LABELS = buildAppLabelMap(DEFAULT_APP_CATALOG);
let cachedAppCatalog = DEFAULT_APP_CATALOG.slice();
let cachedAvailableApps = DEFAULT_APP_KEYS.slice();
let cachedActionApprovalPolicy = null;
let currentTheme = THEME_VALUES.LIGHT;
let themeInitialized = false;
let appCatalogPromise = null;
let activityStripPollHandle = null;
let currentActiveUsers = [];
let referenceDataCache = null;
let referenceDataPanelState = { mode: '', editModeActive: false };
const REFERENCE_LICENSE_SCOPES = ['shared', 'weapons', 'renewal', 'request'];

function getReferenceDisplayText(value) {
  if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.normalizeDisplayText === 'function') {
    return SHARED_REFERENCE_DATA.normalizeDisplayText(value);
  }
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getReferenceMatchKey(value) {
  if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.normalizeMatchKey === 'function') {
    return SHARED_REFERENCE_DATA.normalizeMatchKey(value);
  }
  return getReferenceDisplayText(value).toLowerCase();
}

function uniqueReferenceValues(values, excluded = []) {
  const result = [];
  const seen = new Set((Array.isArray(excluded) ? excluded : []).map((value) => getReferenceMatchKey(value)).filter(Boolean));
  (Array.isArray(values) ? values : []).forEach((value) => {
    const display = getReferenceDisplayText(value);
    const key = getReferenceMatchKey(display);
    if (!display || !key || seen.has(key)) return;
    seen.add(key);
    result.push(display);
  });
  return result;
}

function getReferenceFrankoKey(value, fallback = '') {
  if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.generateFrankoKey === 'function') {
    return SHARED_REFERENCE_DATA.generateFrankoKey(value, fallback);
  }
  const source = getReferenceDisplayText(value || fallback);
  return source.replace(/\s+/g, '').toLowerCase();
}

function createReferenceLicenseEntry(entry = {}) {
  const name = getReferenceDisplayText(entry && entry.name);
  return {
    name,
    aliases: uniqueReferenceValues(entry && entry.aliases, [name])
  };
}

function getReferenceMergedLicenseEntries(licenseTypes) {
  const result = [];
  const indexByKey = new Map();
  Object.values(licenseTypes && typeof licenseTypes === 'object' ? licenseTypes : {}).forEach((entries) => {
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const normalized = createReferenceLicenseEntry(entry);
      const key = getReferenceMatchKey(normalized.name);
      if (!normalized.name || !key) return;
      if (indexByKey.has(key)) {
        const existing = result[indexByKey.get(key)];
        existing.aliases = uniqueReferenceValues((existing.aliases || []).concat(normalized.aliases || []), [existing.name]);
        return;
      }
      indexByKey.set(key, result.length);
      result.push(normalized);
    });
  });
  return result;
}

function createReferenceLicenseTypesDraft(entries, sourceLicenseTypes = {}) {
  const normalizedEntries = (Array.isArray(entries) ? entries : [])
    .map((entry) => createReferenceLicenseEntry(entry))
    .filter((entry) => entry.name);
  const scopeKeys = Array.from(new Set(
    REFERENCE_LICENSE_SCOPES.concat(
      Object.keys(sourceLicenseTypes && typeof sourceLicenseTypes === 'object' ? sourceLicenseTypes : {})
        .map((scope) => getReferenceDisplayText(scope).toLowerCase())
        .filter(Boolean)
    )
  ));
  return Object.fromEntries(scopeKeys.map((scope) => [
    scope,
    normalizedEntries.map((entry) => createReferenceLicenseEntry(entry))
  ]));
}

function getReferenceStationName(entry) {
  if (typeof entry === 'string') return getReferenceDisplayText(entry);
  return getReferenceDisplayText(entry && entry.name);
}

function createReferenceStationEntry(entry = {}) {
  const name = getReferenceStationName(entry);
  return {
    name,
    aliases: uniqueReferenceValues(entry && entry.aliases, [name])
  };
}

function createReferenceSectorEntry(entry = {}, index = 0) {
  const fallbackLabel = '';
  const label = getReferenceDisplayText(entry && entry.label) || fallbackLabel;
  const fallbackKey = label ? getReferenceFrankoKey(label, `sector${index + 1}`) : `sector${index + 1}`;
  const originalKey = getReferenceDisplayText(entry && (entry.originalKey || entry.key)) || fallbackKey;
  const currentKey = label ? getReferenceFrankoKey(label, fallbackKey) || originalKey : originalKey;
  return {
    key: currentKey,
    originalKey,
    label,
    autoKey: true,
    aliases: uniqueReferenceValues(entry && entry.aliases, [entry && entry.key, label]),
    stations: (Array.isArray(entry && entry.stations) ? entry.stations : []).map((station) => createReferenceStationEntry(station)).filter((station) => station.name)
  };
}

function createReferenceDataDraft(snapshot) {
  const source = snapshot && typeof snapshot === 'object'
    ? snapshot
    : (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getSnapshot === 'function'
      ? SHARED_REFERENCE_DATA.getSnapshot()
      : {});
  const scopes = source.licenseTypes && typeof source.licenseTypes === 'object'
    ? source.licenseTypes
    : {};
  const mergedLicenseEntries = getReferenceMergedLicenseEntries(scopes);
  return {
    version: 1,
    updatedAt: source.updatedAt || '',
    sectors: (Array.isArray(source.sectors) ? source.sectors : []).map((entry, index) => createReferenceSectorEntry(entry, index)),
    licenseTypes: createReferenceLicenseTypesDraft(mergedLicenseEntries, scopes)
  };
}

function syncReferenceDataLocals(snapshot) {
  const draft = createReferenceDataDraft(snapshot);
  const sectors = Array.isArray(draft.sectors) ? draft.sectors : [];

  SECTOR_CHOICES.splice(0, SECTOR_CHOICES.length, ...sectors.map((entry) => ({
    value: entry.label,
    label: entry.label,
    key: entry.key
  })));

  Object.keys(SECTOR_LABEL_MAP).forEach((key) => delete SECTOR_LABEL_MAP[key]);
  SECTOR_LABEL_MAP[ADMIN_SECTOR_VALUE] = ADMIN_SECTOR_VALUE;
  sectors.forEach((entry) => {
    SECTOR_LABEL_MAP[entry.label] = entry.label;
  });

  ALL_SECTOR_VALUES.splice(0, ALL_SECTOR_VALUES.length, ...sectors.map((entry) => entry.label));

  Object.keys(SECTOR_STATIONS).forEach((key) => delete SECTOR_STATIONS[key]);
  Object.keys(SECTOR_STATION_SETS).forEach((key) => delete SECTOR_STATION_SETS[key]);
  sectors.forEach((entry) => {
    const stations = Array.isArray(entry.stations) ? entry.stations.map((station) => getReferenceStationName(station)).filter(Boolean) : [];
    SECTOR_STATIONS[entry.label] = stations;
    SECTOR_STATION_SETS[entry.label] = new Set(stations);
  });

  return draft;
}

function setReferenceDataCache(snapshot, canEdit = false) {
  const draft = syncReferenceDataLocals(snapshot);
  referenceDataCache = {
    data: draft,
    canEdit: Boolean(canEdit)
  };
  if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.setSnapshot === 'function') {
    SHARED_REFERENCE_DATA.setSnapshot(draft);
  }
  return draft;
}

if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getSnapshot === 'function') {
  setReferenceDataCache(SHARED_REFERENCE_DATA.getSnapshot(), false);
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function wireProfileLinks() {
  const links = document.querySelectorAll('[data-profile-link]');
  if (!links.length) return;
  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event) event.preventDefault();
      goToProfile();
    });
    link.addEventListener('keydown', (event) => {
      if (!event) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        goToProfile();
      }
    });
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadStoredSession() {
  const token = sessionStorage.getItem(STORAGE_KEYS.token) || localStorage.getItem(STORAGE_KEYS.token);
  const rawUser = sessionStorage.getItem(STORAGE_KEYS.user) || localStorage.getItem(STORAGE_KEYS.user);
  if (!token || !rawUser) return null;
  try {
    const user = JSON.parse(rawUser);
    sessionStorage.setItem(STORAGE_KEYS.token, token);
    sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    return { token, user };
  } catch (error) {
    clearSessionStorage();
    return null;
  }
}

function setActiveSession(token, user) {
  if (token && user) {
    activeSession = { token, user };
    sessionStorage.setItem(STORAGE_KEYS.token, token);
    sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEYS.token, token);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  } else {
    clearSessionStorage();
  }
}

function clearSessionStorage() {
  activeSession = { token: null, user: null };
  profilePromise = null;
  try {
    sessionStorage.removeItem(STORAGE_KEYS.token);
    sessionStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
  } catch (error) {
    // ignore storage errors
  }
}

function formatSectorDisplay(value) {
  if (Array.isArray(value)) {
    if (!value.length) return '';
    if (value.includes(ADMIN_SECTOR_VALUE)) return ADMIN_SECTOR_VALUE;
    const unique = Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)));
    return unique.map((item) => SECTOR_LABEL_MAP[item] || item).join('، ');
  }
  if (!value) return '';
  if (value === ADMIN_SECTOR_VALUE) return ADMIN_SECTOR_VALUE;
  return SECTOR_LABEL_MAP[value] || value;
}

function formatStationAccessDisplay(accessMap, sectors = []) {
  const normalized = normalizeStationSelection(Array.isArray(sectors) ? sectors : [], accessMap);
  return Object.entries(normalized).map(([sector, stations]) => ({
    sector,
    sectorLabel: SECTOR_LABEL_MAP[sector] || sector,
    stations: Array.isArray(stations) ? stations.slice() : []
  }));
}

function getSectorChecklistContainer(form) {
  return form ? form.querySelector('[data-sector-checklist]') : null;
}

function getStationChecklistContainer(form) {
  return form ? form.querySelector('[data-station-checklist]') : null;
}

function getStationGroupsWrapper(form) {
  const container = getStationChecklistContainer(form);
  return container ? container.querySelector('[data-station-groups]') : null;
}

function normalizeStationSelection(sectors, selection) {
  const normalized = {};
  if (!Array.isArray(sectors) || !sectors.length) return normalized;
  if (!selection || typeof selection !== 'object') selection = {};

  sectors.forEach((sector) => {
    const stations = SECTOR_STATIONS[sector];
    if (!Array.isArray(stations) || !stations.length) return;
    const allowed = SECTOR_STATION_SETS[sector] || new Set();
    const chosen = Array.isArray(selection[sector]) ? selection[sector] : [];
    const filtered = [];
    chosen.forEach((station) => {
      const value = String(station || '').trim();
      if (value && allowed.has(value) && !filtered.includes(value)) {
        filtered.push(value);
      }
    });
    if (filtered.length) {
      normalized[sector] = filtered;
    }
  });

  return normalized;
}

function collectStationSelections(form) {
  if (!form) return {};
  const selections = {};
  const inputs = form.querySelectorAll('[data-station-checkbox]:checked');
  inputs.forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    const sector = input.dataset.stationSector || '';
    const value = input.value || '';
    if (!sector || !value) return;
    if (!selections[sector]) selections[sector] = [];
    if (!selections[sector].includes(value)) {
      selections[sector].push(value);
    }
  });
  return selections;
}

function getStoredStationSelection(form) {
  if (!form || !form.dataset || !form.dataset.stationSelection) {
    return {};
  }
  try {
    const parsed = JSON.parse(form.dataset.stationSelection);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    delete form.dataset.stationSelection;
    return {};
  }
}

function setStoredStationSelection(form, selection) {
  if (!form || !form.dataset) return;
  const normalized = selection && typeof selection === 'object' ? selection : {};
  const keys = Object.keys(normalized);
  if (!keys.length) {
    delete form.dataset.stationSelection;
    return;
  }
  try {
    form.dataset.stationSelection = JSON.stringify(normalized);
  } catch (error) {
    delete form.dataset.stationSelection;
  }
}

function updateStoredStationSelectionFromForm(form) {
  if (!form) return;
  const sectors = collectSelectedSectors(form);
  const selections = collectStationSelections(form);
  const normalized = normalizeStationSelection(sectors, selections);
  setStoredStationSelection(form, normalized);
}

function getStationGroupElement(element) {
  if (!(element instanceof HTMLElement)) return null;
  return element.closest('.station-group');
}

function setGroupSelectAllActive(group, active) {
  if (!group) return;
  const checkboxes = Array.from(group.querySelectorAll('[data-station-checkbox]'));
  checkboxes.forEach((checkbox) => {
    if (!(checkbox instanceof HTMLInputElement)) return;
    if (active) {
      checkbox.checked = true;
    }
    checkbox.disabled = active;
    const wrapper = checkbox.closest('.station-checkbox');
    if (wrapper) {
      wrapper.classList.toggle('is-disabled', active);
    }
  });

  const selectAll = group.querySelector('[data-station-select-all]');
  if (selectAll instanceof HTMLInputElement) {
    selectAll.checked = active;
    selectAll.indeterminate = false;
  }

  const label = group.querySelector('.station-select-all');
  if (label) {
    label.classList.toggle('is-active', active);
  }

  if (active) {
    group.dataset.selectAllActive = 'true';
  } else {
    delete group.dataset.selectAllActive;
  }
}

function refreshGroupSelectAllControl(group) {
  if (!group) return;
  const selectAll = group.querySelector('[data-station-select-all]');
  if (!(selectAll instanceof HTMLInputElement)) return;

  const checkboxes = Array.from(group.querySelectorAll('[data-station-checkbox]')).filter(
    (input) => input instanceof HTMLInputElement
  );

  if (!checkboxes.length) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
    return;
  }

  const total = checkboxes.length;
  const checkedCount = checkboxes.filter((input) => input.checked).length;

  selectAll.checked = checkedCount === total;
  selectAll.indeterminate = checkedCount > 0 && checkedCount < total;

  const label = group.querySelector('.station-select-all');
  if (label) {
    label.classList.toggle('is-active', group.dataset.selectAllActive === 'true');
  }
}

function handleStationSelectAllToggle(form, control) {
  if (!(control instanceof HTMLInputElement)) return;
  const group = getStationGroupElement(control);
  setGroupSelectAllActive(group, control.checked);
  updateStoredStationSelectionFromForm(form);
}

function handleStationCheckboxChange(form, checkbox) {
  if (!(checkbox instanceof HTMLInputElement)) return;
  const group = getStationGroupElement(checkbox);
  if (!group) return;

  if (group.dataset.selectAllActive === 'true') {
    setGroupSelectAllActive(group, false);
  }

  refreshGroupSelectAllControl(group);
  updateStoredStationSelectionFromForm(form);
}

function bindStationChecklistEvents(form) {
  const container = getStationChecklistContainer(form);
  if (!container || container.dataset.stationListenerBound === 'true') return;

  container.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (target.matches('[data-station-select-all]')) {
      handleStationSelectAllToggle(form, target);
      return;
    }

    if (target.matches('[data-station-checkbox]')) {
      handleStationCheckboxChange(form, target);
    }
  });

  container.dataset.stationListenerBound = 'true';
}

function syncStationChecklist(form, { role, sectors, confirmed }) {
  const container = getStationChecklistContainer(form);
  const wrapper = getStationGroupsWrapper(form);
  if (!container || !wrapper) return;

  bindStationChecklistEvents(form);

  const normalizedRole = getNormalizedRole(role);
  const isManagement = normalizedRole === 'admin' || normalizedRole === 'supersecretary' || normalizedRole === 'secretary';
  const list = Array.isArray(sectors) ? sectors : [];
  const isConfirmed = Boolean(confirmed && list.length);

  if (isManagement || !isConfirmed) {
    wrapper.innerHTML = '';
    container.classList.add('hidden');
    setStoredStationSelection(form, {});
    return;
  }

  const stored = normalizeStationSelection(list, getStoredStationSelection(form));
  setStoredStationSelection(form, stored);
  renderStationGroups(form, role, list, stored);
}

function renderStationGroups(form, role, sectors, selection) {
  const container = getStationChecklistContainer(form);
  const wrapper = getStationGroupsWrapper(form);
  if (!container || !wrapper) return;

  const normalized = normalizeStationSelection(sectors, selection);

  const normalizedRole = getNormalizedRole(role);
  if (normalizedRole === 'admin' || normalizedRole === 'supersecretary' || normalizedRole === 'secretary' || !Array.isArray(sectors) || !sectors.length) {
    wrapper.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  const groups = [];
  const activeSectors = sectors.filter((sector) => Array.isArray(SECTOR_STATIONS[sector]) && SECTOR_STATIONS[sector].length);

  activeSectors.forEach((sector, index) => {
    if (index > 0) {
      groups.push('<hr class="station-divider" />');
    }
    const stations = SECTOR_STATIONS[sector] || [];
    const selected = new Set(normalized[sector] || []);
    const hasStations = stations.length > 0;
    const isSelectAll = hasStations && selected.size === stations.length;
    const selectAllAttr = isSelectAll ? ' checked' : '';
    const groupAttr = isSelectAll ? ' data-select-all-active="true"' : '';
    const items = stations.map((station) => {
      const checked = selected.has(station) ? 'checked' : '';
      const disabled = isSelectAll ? 'disabled' : '';
      const disabledClass = isSelectAll ? ' is-disabled' : '';
      return `
        <label class="station-checkbox${disabledClass}">
          <input type="checkbox" data-station-checkbox data-station-sector="${escapeHtml(sector)}" value="${escapeHtml(station)}" ${checked} ${disabled} />
          <span>${escapeHtml(station)}</span>
        </label>
      `;
    });

    const groupBody = items.length
      ? items.join('')
      : '<span class="station-empty">لا توجد أقسام متاحة لهذا القطاع.</span>';

    groups.push(`
      <div class="station-group" data-sector="${escapeHtml(sector)}"${groupAttr}>
        <div class="station-group-header">
          <span class="station-group-title">قطاع ${escapeHtml(sector)}</span>
          <label class="station-select-all${isSelectAll ? ' is-active' : ''}">
            <input type="checkbox" data-station-select-all data-station-sector="${escapeHtml(sector)}"${selectAllAttr} />
            <span>تحديد الكل</span>
          </label>
        </div>
        <div class="station-group-list">${groupBody}</div>
      </div>
    `);
  });

  wrapper.innerHTML = groups.join('\n');
  container.classList.toggle('hidden', groups.length === 0);
}

function renderSectorCheckboxes(container, selectedValues = []) {
  if (!container) return;
  const selectedSet = new Set(
    Array.isArray(selectedValues)
      ? selectedValues.map((item) => String(item || '').trim()).filter(Boolean)
      : []
  );

  container.innerHTML = SECTOR_CHOICES
    .map((choice) => {
      const checked = selectedSet.has(choice.value) ? 'checked' : '';
      return `
        <label class="sector-checkbox">
          <input type="checkbox" value="${escapeHtml(choice.value)}" data-sector-checkbox ${checked} />
          <span>${escapeHtml(choice.label)}</span>
        </label>
      `;
    })
    .join('');
}

function collectSelectedSectors(form) {
  if (!form) return [];
  return Array.from(form.querySelectorAll('[data-sector-checkbox]:checked'))
    .map((input) => input.value)
    .filter((value) => typeof value === 'string' && value.trim() !== '');
}

function configureRoleSectorInteraction(form) {
  if (!form) return;
  const roleField = form.querySelector('[name="role"]');
  const checklist = getSectorChecklistContainer(form);
  if (!roleField || !checklist) return;

  const applyRules = () => {
    const role = getNormalizedRole(roleField.value);
    const checkboxes = Array.from(checklist.querySelectorAll('[data-sector-checkbox]'));
    syncReferencePermissionControl(form);
    syncDashboardCustomizationPermissionControl(form);
    syncActivityHistoryPermissionControl(form);
    syncRenewalDocumentEditPermissionControl(form);
    syncAdminAppSelectionForForm(form);
    if (role === 'admin' || role === 'supersecretary' || role === 'secretary') {
      checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
        checkbox.disabled = true;
      });
      form.dataset.sectorsConfirmed = 'true';
      updateSectorSummary(form, true);
      return;
    }

    checkboxes.forEach((checkbox) => {
      checkbox.disabled = false;
    });

    const confirmed = form.dataset && form.dataset.sectorsConfirmed === 'true';
    updateSectorSummary(form, confirmed);
  };

  if (!roleField.dataset.sectorBound) {
    roleField.addEventListener('change', applyRules);
    roleField.dataset.sectorBound = 'true';
  }

  applyRules();
}

function normalizeTheme() {
  return THEME_VALUES.LIGHT;
}

function setDocumentTheme(theme) {
  const normalized = normalizeTheme(theme);
  currentTheme = normalized;
  const body = document.body;
  if (body) {
    body.classList.remove('dark-mode');
    body.classList.add('light-mode');
  }
  themeInitialized = true;
  return normalized;
}

async function loadThemePreference() {
  return themeInitialized ? currentTheme : setDocumentTheme(THEME_VALUES.LIGHT);
}

function getToken() {
  if (activeSession.token) return activeSession.token;
  const stored = loadStoredSession();
  if (stored) {
    activeSession = stored;
    return stored.token;
  }
  return null;
}

function getUser() {
  if (activeSession.user) return activeSession.user;
  const stored = loadStoredSession();
  if (stored) {
    activeSession = stored;
    return stored.user;
  }
  return null;
}

async function fetchWithAuth(url, options = {}) {
  const token = getToken();
  const opts = { ...options };
  opts.headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});
  if (token) {
    opts.headers.Authorization = `Bearer ${token}`;
  }
  return fetch(url, opts);
}

async function refreshProfile() {
  const token = getToken();
  if (!token) return null;
  if (profilePromise) return profilePromise;

  profilePromise = (async () => {
    try {
      const response = await fetchWithAuth('/api/auth/profile', { method: 'GET' });
      if (!response.ok) {
        clearSessionStorage();
        return null;
      }
      const data = await response.json();
      if (data && data.user) {
        setActiveSession(token, data.user);
        return { token, user: data.user };
      }
      clearSessionStorage();
      return null;
    } catch (error) {
      console.warn('Failed to refresh profile:', error);
      clearSessionStorage();
      return null;
    } finally {
      profilePromise = null;
    }
  })();

  return profilePromise;
}

function normalizeAppCatalogEntry(entry, fallback = {}) {
  const key = String(entry?.key || fallback.key || '').trim().toLowerCase();
  if (!key) return null;
  return {
    key,
    icon: String(entry?.icon || fallback.icon || '').trim(),
    label: String(entry?.label || fallback.label || key).trim() || key,
    sub: String(entry?.sub || fallback.sub || '').trim(),
    adminOnly: Boolean(entry?.adminOnly ?? fallback.adminOnly)
  };
}

function setAppCatalog(appCatalog) {
  const fallbackMap = new Map(DEFAULT_APP_CATALOG.map((entry) => [entry.key, entry]));
  const requested = Array.isArray(appCatalog) ? appCatalog : [];
  const requestedMap = new Map(
    requested
      .map((entry) => normalizeAppCatalogEntry(entry))
      .filter(Boolean)
      .map((entry) => [entry.key, entry])
  );

  cachedAppCatalog = DEFAULT_APP_KEYS
    .map((key) => normalizeAppCatalogEntry(requestedMap.get(key), fallbackMap.get(key)))
    .filter(Boolean);
  cachedAvailableApps = cachedAppCatalog.map((entry) => entry.key);
  APP_LABELS = buildAppLabelMap(cachedAppCatalog);
}

async function loadAppCatalog(force = false) {
  if (!force && appCatalogPromise) return appCatalogPromise;

  appCatalogPromise = (async () => {
    try {
      const response = await fetchWithAuth(APP_CONFIG_ENDPOINT, { method: 'GET' });
      if (!response.ok) throw new Error('Failed to load app catalog');
      const data = await response.json();
      setAppCatalog(Array.isArray(data?.apps) ? data.apps : DEFAULT_APP_CATALOG);
    } catch (error) {
      console.warn('Failed to load app catalog:', error);
      setAppCatalog(DEFAULT_APP_CATALOG);
    } finally {
      appCatalogPromise = null;
    }
    return cachedAppCatalog;
  })();

  return appCatalogPromise;
}

async function ensureAuthenticated({ redirect = true } = {}) {
  const session = loadStoredSession();
  if (!session) {
    clearSessionStorage();
    if (redirect) redirectToLogin();
    return null;
  }
  const profile = await refreshProfile();
  if (!profile) {
    if (redirect) redirectToLogin();
    return null;
  }
  return profile;
}

function redirectToLogin() {
  try {
    markActivityNavigation('redirect');
    window.location.href = 'index.html';
  } catch (error) {
    console.warn('Redirect failed:', error);
  }
}

function getNormalizedRole(userOrRole) {
  const value = userOrRole && typeof userOrRole === 'object' ? userOrRole.role : userOrRole;
  const normalized = String(value || 'user').trim().toLowerCase();
  if (normalized === 'admin') return 'admin';
  if (
    normalized === 'supersecretary'
    || normalized === 'super-secretary'
    || normalized === 'super_secretary'
    || normalized === 'سيكرتير اول'
    || normalized === 'سيكرتير أول'
    || normalized === 'سكرتير اول'
    || normalized === 'سكرتير أول'
  ) return 'supersecretary';
  if (normalized === 'secretary') return 'secretary';
  return 'user';
}

function isAdminUser(user) {
  return getNormalizedRole(user) === 'admin';
}

function isSecretaryUser(user) {
  return getNormalizedRole(user) === 'secretary';
}

function isSuperSecretaryUser(user) {
  return getNormalizedRole(user) === 'supersecretary';
}

function hasManagementRole(user) {
  const role = getNormalizedRole(user);
  return role === 'admin' || role === 'supersecretary' || role === 'secretary';
}

function canCreateManagedUsers(user) {
  return isAdminUser(user) || isSuperSecretaryUser(user);
}

function canCreateRole(user, role) {
  const normalizedRole = getNormalizedRole(role);
  if (isAdminUser(user)) return true;
  if (isSuperSecretaryUser(user)) {
    return normalizedRole === 'user' || normalizedRole === 'secretary';
  }
  return false;
}

function shouldLockAppSelectionForRole(role) {
  return getNormalizedRole(role) === 'admin';
}

function isTestAccount(user) {
  return Boolean(
    user
    && (user.testAccount === true || String(user.username || '').trim().toLowerCase() === 'test')
  );
}

function isProtectedAdminEditForViewer(viewer, targetUser) {
  if (!isAdminUser(viewer) || !isAdminUser(targetUser)) return false;
  if (isTestAccount(viewer)) return false;
  const viewerUsername = String(viewer?.username || '').trim().toLowerCase();
  const targetUsername = String(targetUser?.username || '').trim().toLowerCase();
  return Boolean(viewerUsername && targetUsername && viewerUsername !== targetUsername);
}

function applyRoleCreationOptions(form, viewer) {
  if (!form) return;
  const roleField = form.querySelector('[name="role"]');
  if (!roleField) return;

  Array.from(roleField.options).forEach((option) => {
    const allowed = canCreateRole(viewer, option.value);
    option.disabled = !allowed;
    option.hidden = !allowed;
  });

  if (!canCreateRole(viewer, roleField.value)) {
    roleField.value = 'user';
  }
}

function canEditExistingUsers(user) {
  return isAdminUser(user);
}

function canManageAppCatalog(user) {
  return isAdminUser(user) || isSuperSecretaryUser(user);
}

function normalizeUserPermissions(userOrPermissions, roleHint = '') {
  const role = getNormalizedRole(roleHint || userOrPermissions);
  const source = userOrPermissions && typeof userOrPermissions === 'object'
    ? (userOrPermissions.permissions && typeof userOrPermissions.permissions === 'object' ? userOrPermissions.permissions : userOrPermissions)
    : {};
  return {
    manageReferenceData: role === 'admin' || role === 'supersecretary' || role === 'secretary'
      ? true
      : Boolean(
        source.manageReferenceData
        || source.referenceDataEditor
        || source.referenceDataWrite
        || source.canManageReferenceData
      ),
    customizeDashboardApps: role === 'admin'
      ? true
      : Boolean(
        source.customizeDashboardApps
        || source.dashboardAppCustomization
        || source.canCustomizeDashboardApps
      ),
    viewActivityHistory: role === 'admin'
      ? true
      : Boolean(source.viewActivityHistory),
    editRenewalDocuments: role === 'admin' || role === 'supersecretary'
      ? true
      : Boolean(source.editRenewalDocuments)
  };
}

function canCustomizeDashboardApps(user) {
  return Boolean(user && normalizeUserPermissions(user).customizeDashboardApps);
}

function canAccessSettings(user) {
  return hasManagementRole(user) || canCustomizeDashboardApps(user);
}

function canManageReferenceData(user) {
  if (isAdminUser(user)) return true;
  if (isSuperSecretaryUser(user)) return true;
  if (isSecretaryUser(user)) return true;
  return false;
}

function hasFullAppAccess(user) {
  return isAdminUser(user);
}

function getRoleDisplayText(user, variant = 'short') {
  const key = getNormalizedRole(user);
  const labels = ROLE_DISPLAY_LABELS[key] || ROLE_DISPLAY_LABELS.user;
  return labels[variant] || labels.short;
}

function isAppAllowed(user, appKey) {
  if (!user) return false;
  if (hasFullAppAccess(user)) return true;
  if (appKey === 'settings' && canAccessSettings(user)) return true;
  const list = Array.isArray(user.allowedApps) ? user.allowedApps : [];
  return list.includes(appKey);
}

function updateDashboardButtons(user) {
  const buttons = document.querySelectorAll('[data-app]');
  buttons.forEach((button) => {
    const key = button.dataset.app;
    if (!key) return;
    const allowed = isAppAllowed(user, key);
    if (allowed) {
      button.classList.remove('app-disabled', 'hidden');
      button.removeAttribute('disabled');
    } else {
      button.classList.add('app-disabled');
      button.setAttribute('disabled', 'disabled');
      button.classList.add('hidden');
    }
  });
}

function renderUserSummary(user) {
  if (!user) return;
  const nameEl = document.getElementById('userDisplayName');
  const roleEl = document.getElementById('userRoleBadge');
  const roomEl = document.getElementById('userSectorDetail');

  if (nameEl) nameEl.textContent = user.displayName || user.username;
  if (roleEl) roleEl.textContent = getRoleDisplayText(user, 'badge');
  if (roomEl) {
    const sectorDisplay = formatSectorDisplay(user.sectors || user.room);
    if (sectorDisplay) {
      roomEl.textContent = sectorDisplay;
      roomEl.classList.remove('hidden');
    } else {
      roomEl.textContent = '';
      roomEl.classList.add('hidden');
    }
  }
}

function showStatusMessage(target, message, type = 'info') {
  if (!target) return;
  target.textContent = message || '';
  target.className = `status-message status-${type}`;
  if (message) {
    target.classList.add('visible');
    setTimeout(() => target.classList.remove('visible'), 4000);
  }
}

function markActivityNavigation(reason = 'navigate') {
  try {
    if (window.__activityTracker && typeof window.__activityTracker.markNavigation === 'function') {
      window.__activityTracker.markNavigation(reason);
    }
  } catch (error) {
    console.warn('Navigation tracking mark failed:', error);
  }
}

function logDashboardClose(reason = 'logout') {
  try {
    const pathname = String(window.location.pathname || '').toLowerCase();
    const isDashboard = pathname.endsWith('/main.html') || pathname === '/dashboard';
    if (!isDashboard) return;
    if (window.__activityTracker && typeof window.__activityTracker.log === 'function') {
      void window.__activityTracker.log('page:leave', 'إغلاق اللوحة الرئيسية', {
        pageName: 'اللوحة الرئيسية',
        reason
      });
    }
  } catch (error) {
    console.warn('Dashboard close tracking failed:', error);
  }
}

async function cleanupRenewalTmp() {
  try {
    await fetchWithAuth('/api/renewal/cleanup-tmp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'logout' }),
      keepalive: true
    });
  } catch (error) {
    console.warn('Renewal cleanup failed:', error);
  }
}

async function performLogout({ keepalive = false } = {}) {
  const token = getToken();
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ token, reason: 'logout' }),
      keepalive
    });
  } catch (error) {
    console.warn('Logout request failed:', error);
  } finally {
    clearSessionStorage();
  }
}

function attemptWindowClosure() {
  try { window.close(); } catch (error) {}
  try { window.open('', '_self'); window.close(); } catch (error) {}
  try { window.opener = null; } catch (error) {}
  try { self.close(); } catch (error) {}
  try { parent.close(); } catch (error) {}
  try { top.close(); } catch (error) {}
}

async function requestShutdown(payload) {
  try {
    await fetchWithAuth('/api/shutdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || { reason: 'exit' }),
      keepalive: true
    });
  } catch (error) {
    console.warn('Shutdown request failed:', error);
  }
}

async function logoutApp(event) {
  try { event && event.preventDefault && event.preventDefault(); } catch (error) {}

  const confirmed = typeof window.confirm === 'function'
    ? window.confirm('هل تريد تسجيل الخروج والعودة إلى صفحة الدخول؟')
    : true;
  if (!confirmed) return;

  logDashboardClose('logout');
  markActivityNavigation('logout');
  await cleanupRenewalTmp();
  await performLogout();
  redirectToLogin();
}

async function exitProgram(event) {
  try { event && event.preventDefault && event.preventDefault(); } catch (error) {}

  const confirmed = typeof window.confirm === 'function'
    ? window.confirm('هل تريد إيقاف الخادم وإغلاق البرنامج بالكامل؟')
    : true;
  if (!confirmed) return;

  const payload = { reason: 'exit', at: new Date().toISOString(), token: getToken() };

  logDashboardClose('shutdown');
  markActivityNavigation('shutdown');
  await cleanupRenewalTmp();
  await performLogout({ keepalive: true });
  await requestShutdown(payload);

  attemptWindowClosure();
  setTimeout(() => {
    attemptWindowClosure();
    try { location.replace('about:blank'); } catch (error) {}
  }, 350);
}

window.logoutApp = logoutApp;
window.exitProgram = exitProgram;

async function initLoginPage() {
  const form = document.getElementById('loginForm');
  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');
  const messageEl = document.getElementById('loginMsg');

  const existing = await refreshProfile();
  if (existing && existing.user) {
    const restoreUrl = localStorage.getItem('session.restore.url');
    if (localStorage.getItem('session.restore.active') === '1' && restoreUrl) {
      markActivityNavigation('session-restore');
      window.location.href = restoreUrl;
    } else {
      markActivityNavigation('session-redirect');
      window.location.href = 'main.html';
    }
    return;
  }
  clearSessionStorage();

  if (!form || !usernameInput || !passwordInput) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      showStatusMessage(messageEl, 'يرجى إدخال اسم المستخدم وكلمة المرور', 'error');
      return;
    }

    form.classList.add('is-loading');
    showStatusMessage(messageEl, 'جاري التحقق...', 'info');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        const errorMessage = data && data.message ? data.message : 'فشل تسجيل الدخول';
        showStatusMessage(messageEl, errorMessage, 'error');
        return;
      }

      setActiveSession(data.token, data.user);
      showStatusMessage(messageEl, 'تم تسجيل الدخول بنجاح، سيتم تحويلك الآن', 'success');
      setTimeout(() => {
        markActivityNavigation('login-success');
        const restoreUrl = localStorage.getItem('session.restore.url');
        if (localStorage.getItem('session.restore.active') === '1' && restoreUrl) {
          window.location.href = restoreUrl;
        } else {
          window.location.href = 'main.html';
        }
      }, 600);
    } catch (error) {
      console.error('Login error:', error);
      showStatusMessage(messageEl, 'تعذر الاتصال بالخادم', 'error');
    } finally {
      form.classList.remove('is-loading');
    }
  });
}

function navigateIfAllowed(appKey, url) {
  const user = getUser();
  if (!isAppAllowed(user, appKey)) {
    window.alert('لا تملك صلاحية الوصول إلى هذا التطبيق.');
    return;
  }
  markActivityNavigation(`open-${appKey}`);
  window.location.href = url;
}

function goToProfile() {
  markActivityNavigation('open-profile');
  window.location.href = 'profile.html';
}
function goToWeapons() { navigateIfAllowed('weapons', '/weapons/sheet.html'); }
function goToRenewal() { navigateIfAllowed('renewal', '/renewal/sheet.html'); }
function goToReports() { navigateIfAllowed('report', '/report/index.html'); }
function goToAccept() { navigateIfAllowed('accept', '/accept/index.html'); }
function goToRequest() { navigateIfAllowed('request', 'request/index.html'); }
function goToSeized() { navigateIfAllowed('seized', '/seized/index.html'); }
function goToStorage() { navigateIfAllowed('storage', '/storage/index.html'); }
function goToCompany() { navigateIfAllowed('company', '/company/index.html'); }
function goToSettings() {
  const user = getUser();
  if (!canAccessSettings(user)) {
    window.alert('صفحة الإعدادات غير متاحة لهذا الحساب');
    return;
  }
  markActivityNavigation('open-settings');
  window.location.href = 'settings.html';
}

window.goToProfile = goToProfile;
window.goToWeapons = goToWeapons;
window.goToRenewal = goToRenewal;
window.goToReports = goToReports;
window.goToAccept = goToAccept;
window.goToRequest = goToRequest;
window.goToSeized = goToSeized;
window.goToStorage = goToStorage;
window.goToCompany = goToCompany;
window.goToSettings = goToSettings;

const APP_NAVIGATION_ACTIONS = {
  settings: 'goToSettings',
  weapons: 'goToWeapons',
  renewal: 'goToRenewal',
  report: 'goToReports',
  accept: 'goToAccept',
  request: 'goToRequest',
  seized: 'goToSeized',
  storage: 'goToStorage',
  company: 'goToCompany'
};

function renderDashboardCards(user = getUser()) {
  const container = document.getElementById('appCardGrid');
  if (!container) return;

  const hiddenDashboardApps = new Set(
    canCustomizeDashboardApps(user) && Array.isArray(user?.hiddenDashboardApps)
      ? user.hiddenDashboardApps.map((key) => String(key || '').trim().toLowerCase())
      : []
  );
  container.innerHTML = cachedAppCatalog
    .filter((entry) => entry.key === 'settings' || !hiddenDashboardApps.has(entry.key))
    .map((entry) => {
      const actionName = APP_NAVIGATION_ACTIONS[entry.key] || '';
      const adminOnlyAttr = entry.adminOnly ? ' data-admin-only' : '';
      const subMarkup = entry.sub ? `\n          <span class="sub">${escapeHtml(entry.sub)}</span>` : '';
      return `\n        <button type="button" class="app-card" data-app="${escapeHtml(entry.key)}"${adminOnlyAttr}${actionName ? ` onclick="${escapeHtml(actionName)}()"` : ''}>\n          <div class="app-card-presence" data-app-presence hidden></div>\n          <span class="icon">${escapeHtml(entry.icon)}</span>\n          <span class="label">${escapeHtml(entry.label)}</span>${subMarkup}\n        </button>\n      `;
    })
    .join('');

  renderProgramPresenceHighlights(currentActiveUsers);
}

function renderAppCatalogEditor() {
  const container = document.getElementById('appCatalogEditor');
  if (!container) return;

  container.innerHTML = cachedAppCatalog
    .filter((entry) => entry.key !== 'settings')
    .map((entry) => {
      return `
        <div class="app-config-row" data-app-config-row="${escapeHtml(entry.key)}">
          <div class="app-config-meta">
            <span class="app-config-name">${escapeHtml(entry.label)}</span>
            <span class="app-config-icon" aria-hidden="true">${escapeHtml(entry.icon || '')}</span>
            <span class="app-config-key">${escapeHtml(entry.key)}</span>
          </div>
          <label class="field">
            <span class="field-label">اسم البطاقة</span>
            <div class="field-control">
              <input type="text" data-app-config-field="label" value="${escapeHtml(entry.label)}" />
            </div>
          </label>
          <label class="field">
            <span class="field-label">الوصف المختصر</span>
            <div class="field-control">
              <input type="text" data-app-config-field="sub" value="${escapeHtml(entry.sub || '')}" />
            </div>
          </label>
        </div>
      `;
    })
    .join('');
}

function collectAppCatalogDraft() {
  return Array.from(document.querySelectorAll('[data-app-config-row]'))
    .map((row) => {
      const key = String(row.getAttribute('data-app-config-row') || '').trim();
      if (!key) return null;
      const current = cachedAppCatalog.find((entry) => entry.key === key) || { key, adminOnly: false };
      const labelInput = row.querySelector('[data-app-config-field="label"]');
      const subInput = row.querySelector('[data-app-config-field="sub"]');
      return {
        key,
        adminOnly: Boolean(current.adminOnly),
        label: String(labelInput ? labelInput.value : current.label || key).trim() || current.label || key,
        sub: String(subInput ? subInput.value : current.sub || '').trim(),
        icon: String(current.icon || '').trim()
      };
    })
    .filter(Boolean);
}

async function saveAppCatalogChanges() {
  const messageEl = document.getElementById('appCatalogMessage');
  const saveBtn = document.getElementById('saveAppCatalogBtn');
  if (!saveBtn) return;

  const payload = { apps: collectAppCatalogDraft() };
  if (!payload.apps.length) {
    showStatusMessage(messageEl, 'لا توجد بطاقات متاحة للحفظ.', 'error');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.classList.add('is-loading');
  showStatusMessage(messageEl, 'جاري حفظ أسماء البطاقات...', 'info');

  try {
    const response = await fetchWithAuth(APP_CONFIG_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(data.apps)) {
      throw new Error(data && data.message ? data.message : 'تعذر حفظ أسماء البطاقات');
    }

    setAppCatalog(data.apps);
    renderAppCatalogEditor();
    await loadUsers();
    showStatusMessage(messageEl, 'تم حفظ أسماء بطاقات اللوحة الرئيسية.', 'success');
  } catch (error) {
    console.error('Save app catalog failed:', error);
    showStatusMessage(messageEl, error.message || 'تعذر حفظ أسماء البطاقات', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.classList.remove('is-loading');
  }
}

function getDashboardVisibilityEntries(user) {
  return cachedAppCatalog.filter((entry) => (
    entry
    && entry.key !== 'settings'
    && isAppAllowed(user, entry.key)
  ));
}

function setDashboardVisibilityButtonState(button, visible) {
  if (!button) return;
  button.classList.toggle('is-visible', Boolean(visible));
  button.classList.toggle('is-hidden', !visible);
  button.setAttribute('aria-pressed', visible ? 'true' : 'false');
  const state = button.querySelector('[data-dashboard-visibility-state]');
  if (state) state.textContent = visible ? 'ظاهر' : 'مخفي';
}

function renderDashboardVisibilityEditor(user = getUser()) {
  const container = document.getElementById('dashboardVisibilityEditor');
  if (!container) return;
  const hidden = new Set(
    canCustomizeDashboardApps(user) && Array.isArray(user?.hiddenDashboardApps)
      ? user.hiddenDashboardApps.map((key) => String(key || '').trim().toLowerCase())
      : []
  );
  const entries = getDashboardVisibilityEntries(user);
  container.innerHTML = entries.length
    ? entries.map((entry) => {
      const visible = !hidden.has(entry.key);
      return `
        <button type="button" class="dashboard-visibility-toggle ${visible ? 'is-visible' : 'is-hidden'}" data-dashboard-visibility-app="${escapeHtml(entry.key)}" aria-pressed="${visible ? 'true' : 'false'}">
          <span class="dashboard-visibility-icon" aria-hidden="true">${escapeHtml(entry.icon || '')}</span>
          <span class="dashboard-visibility-label">${escapeHtml(entry.label || entry.key)}</span>
          <span class="dashboard-visibility-state" data-dashboard-visibility-state>${visible ? 'ظاهر' : 'مخفي'}</span>
        </button>
      `;
    }).join('')
    : '<p class="view-placeholder">لا توجد تطبيقات متاحة للتخصيص.</p>';
}

function collectHiddenDashboardApps() {
  return Array.from(document.querySelectorAll('[data-dashboard-visibility-app][aria-pressed="false"]'))
    .map((button) => String(button.getAttribute('data-dashboard-visibility-app') || '').trim())
    .filter(Boolean);
}

async function saveDashboardVisibilityPreferences() {
  const container = document.getElementById('dashboardVisibilityEditor');
  const messageEl = document.getElementById('dashboardVisibilityMessage');
  if (!container) return false;
  container.classList.add('is-saving');
  showStatusMessage(messageEl, 'جاري حفظ التطبيقات مكتب تجريبي 13ة...', 'info');
  try {
    const response = await fetchWithAuth(DASHBOARD_PREFERENCES_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hiddenApps: collectHiddenDashboardApps() })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.user) {
      throw new Error(data.message || 'تعذر حفظ التطبيقات مكتب تجريبي 13ة');
    }
    const token = getToken();
    if (token) setActiveSession(token, data.user);
    showStatusMessage(messageEl, 'تم حفظ التطبيقات مكتب تجريبي 13ة في حسابك.', 'success');
    return true;
  } catch (error) {
    showStatusMessage(messageEl, error.message || 'تعذر حفظ التطبيقات مكتب تجريبي 13ة', 'error');
    return false;
  } finally {
    container.classList.remove('is-saving');
  }
}

function bindDashboardVisibilityEditor() {
  const container = document.getElementById('dashboardVisibilityEditor');
  if (!container || container.dataset.bound === 'true') return;
  container.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-dashboard-visibility-app]');
    if (!button || container.classList.contains('is-saving')) return;
    const wasVisible = button.getAttribute('aria-pressed') === 'true';
    setDashboardVisibilityButtonState(button, !wasVisible);
    const saved = await saveDashboardVisibilityPreferences();
    if (!saved) setDashboardVisibilityButtonState(button, wasVisible);
  });
  container.dataset.bound = 'true';
}

function normalizeActionApprovalPolicy(policy) {
  const source = policy && typeof policy === 'object' ? policy : {};
  const programs = source.programs && typeof source.programs === 'object' ? source.programs : {};
  const normalizedPrograms = {};

  cachedAppCatalog
    .filter((entry) => entry && !ACTION_APPROVAL_EXCLUDED_APPS.has(entry.key))
    .forEach((entry) => {
      const rawProgram = programs[entry.key] || {};
      const rawActions = rawProgram.actions && typeof rawProgram.actions === 'object'
        ? rawProgram.actions
        : rawProgram;
      const actions = {};
      ACTION_APPROVAL_ACTIONS.forEach((action) => {
        actions[action] = Boolean(rawActions && rawActions[action]);
      });
      normalizedPrograms[entry.key] = {
        label: entry.label,
        actions
      };
    });

  return {
    version: 1,
    updatedAt: source.updatedAt || '',
    programs: normalizedPrograms
  };
}

async function loadActionApprovalPolicy() {
  const response = await fetchWithAuth(ACTION_APPROVAL_POLICY_ENDPOINT, { method: 'GET' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.policy) {
    throw new Error(data && data.message ? data.message : 'تعذر تحميل قيود الاعتماد');
  }
  cachedActionApprovalPolicy = normalizeActionApprovalPolicy(data.policy);
  return cachedActionApprovalPolicy;
}

function renderActionApprovalPolicyEditor() {
  const container = document.getElementById('actionApprovalPolicyEditor');
  if (!container) return;
  const policy = normalizeActionApprovalPolicy(cachedActionApprovalPolicy);
  cachedActionApprovalPolicy = policy;
  const rows = cachedAppCatalog
    .filter((entry) => entry && !ACTION_APPROVAL_EXCLUDED_APPS.has(entry.key))
    .map((entry) => {
      const program = policy.programs[entry.key] || { actions: {} };
      const actionToggles = ACTION_APPROVAL_ACTIONS.map((action) => {
        const checked = program.actions[action] ? 'checked' : '';
        return `
          <label class="toggle action-approval-toggle">
            <input type="checkbox" data-action-approval-action="${escapeHtml(action)}" ${checked} />
            <span>${escapeHtml(ACTION_APPROVAL_ACTION_LABELS[action] || action)}</span>
          </label>
        `;
      }).join('');
      return `
        <div class="action-approval-row" data-action-approval-program="${escapeHtml(entry.key)}">
          <div class="app-config-meta">
            <span class="app-config-name">${escapeHtml(entry.label || entry.key)}</span>
            <span class="app-config-icon" aria-hidden="true">${escapeHtml(entry.icon || '')}</span>
            <span class="app-config-key">${escapeHtml(entry.key)}</span>
          </div>
          <div class="action-approval-actions" role="group" aria-label="قيود ${escapeHtml(entry.label || entry.key)}">
            ${actionToggles}
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = rows || '<p class="view-placeholder">لا توجد برامج قابلة للتقييد.</p>';
}

function collectActionApprovalPolicyDraft() {
  const programs = {};
  document.querySelectorAll('[data-action-approval-program]').forEach((row) => {
    const programKey = String(row.getAttribute('data-action-approval-program') || '').trim();
    if (!programKey || ACTION_APPROVAL_EXCLUDED_APPS.has(programKey)) return;
    const actions = {};
    ACTION_APPROVAL_ACTIONS.forEach((action) => {
      const input = row.querySelector(`[data-action-approval-action="${action}"]`);
      actions[action] = Boolean(input && input.checked);
    });
    programs[programKey] = { actions };
  });
  return { programs };
}

async function saveActionApprovalPolicyChanges() {
  const messageEl = document.getElementById('actionApprovalPolicyMessage');
  const saveBtn = document.getElementById('saveActionApprovalPolicyBtn');
  if (!saveBtn) return;

  saveBtn.disabled = true;
  saveBtn.classList.add('is-loading');
  showStatusMessage(messageEl, 'جاري حفظ قيود الاعتماد...', 'info');

  try {
    const response = await fetchWithAuth(ACTION_APPROVAL_POLICY_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectActionApprovalPolicyDraft())
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.policy) {
      throw new Error(data && data.message ? data.message : 'تعذر حفظ قيود الاعتماد');
    }
    cachedActionApprovalPolicy = normalizeActionApprovalPolicy(data.policy);
    renderActionApprovalPolicyEditor();
    showStatusMessage(messageEl, 'تم حفظ قيود الاعتماد.', 'success');
  } catch (error) {
    console.error('Save action approval policy failed:', error);
    showStatusMessage(messageEl, error.message || 'تعذر حفظ قيود الاعتماد', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.classList.remove('is-loading');
  }
}

const DEFAULT_REFERENCE_SCOPE_ORDER = ['weapons', 'renewal', 'request'];
const REFERENCE_SCOPE_LABELS = {
  weapons: 'برنامج الرخص الملغاة',
  renewal: 'برنامج التجديد',
  request: 'برنامج الطلبات'
};
const REFERENCE_SCOPE_NOTES = {
  weapons: 'تظهر في برنامج الرخص الملغاة.',
  renewal: 'تظهر في برنامج التجديد والمتابعة.',
  request: 'تظهر في برنامج طلبات الترخيص أول مرة.'
};

function getReferenceScopeOrder(snapshot) {
  const ordered = DEFAULT_REFERENCE_SCOPE_ORDER.slice();
  Object.keys((snapshot && snapshot.licenseTypes) || {}).forEach((scope) => {
    if (!ordered.includes(scope)) {
      ordered.push(scope);
    }
  });
  return ordered;
}

function getReferenceScopeLabel(scope) {
  return REFERENCE_SCOPE_LABELS[scope] || scope;
}

function getReferenceScopeNote(scope) {
  return REFERENCE_SCOPE_NOTES[scope] || 'يمكن تعديل الأنواع والمرادفات المستخدمة في هذا القسم.';
}

function parseReferenceListValue(value) {
  return uniqueReferenceValues(
    String(value || '')
      .split(/\r?\n|،|,/)
      .map((item) => getReferenceDisplayText(item))
      .filter(Boolean)
  );
}

function formatReferenceMultiline(values) {
  return uniqueReferenceValues(values).join('\n');
}

function formatReferenceAliases(values) {
  return uniqueReferenceValues(values).join('، ');
}

function readReferenceDatasetList(element, fieldName) {
  if (!element || !element.dataset) return [];
  try {
    const raw = element.dataset[fieldName];
    return uniqueReferenceValues(raw ? JSON.parse(raw) : []);
  } catch (_) {
    return [];
  }
}

function buildReferenceSectorAliases(row, keyValue, labelValue) {
  const aliases = readReferenceDatasetList(row, 'referenceAliases');
  const originalKey = row && row.dataset ? row.dataset.referenceOriginalKey : '';
  const originalLabel = row && row.dataset ? row.dataset.referenceOriginalLabel : '';
  const merged = aliases.slice();
  if (originalKey && getReferenceMatchKey(originalKey) !== getReferenceMatchKey(keyValue)) {
    merged.push(originalKey);
  }
  if (originalLabel && getReferenceMatchKey(originalLabel) !== getReferenceMatchKey(labelValue)) {
    merged.push(originalLabel);
  }
  return uniqueReferenceValues(merged, [keyValue, labelValue]);
}

function buildReferenceStationAliases(row, stationName) {
  const aliases = readReferenceDatasetList(row, 'referenceAliases');
  const originalName = row && row.dataset ? row.dataset.referenceOriginalName : '';
  const merged = aliases.slice();
  if (originalName && getReferenceMatchKey(originalName) !== getReferenceMatchKey(stationName)) {
    merged.push(originalName);
  }
  return uniqueReferenceValues(merged, [stationName]);
}

function buildReferenceLicenseAliases(row, licenseName) {
  const aliases = readReferenceDatasetList(row, 'referenceAliases');
  const originalName = row && row.dataset ? row.dataset.referenceOriginalName : '';
  const merged = aliases.slice();
  if (originalName && getReferenceMatchKey(originalName) !== getReferenceMatchKey(licenseName)) {
    merged.push(originalName);
  }
  return uniqueReferenceValues(merged, [licenseName]);
}

function renameReferenceSectorEntry(entry, nextLabel) {
  const current = createReferenceSectorEntry(entry);
  const normalizedLabel = getReferenceDisplayText(nextLabel);
  const nextKey = getReferenceFrankoKey(normalizedLabel, current.key || current.originalKey || 'sector');
  return createReferenceSectorEntry({
    key: nextKey,
    originalKey: current.originalKey || current.key,
    label: normalizedLabel,
    aliases: uniqueReferenceValues(
      (current.aliases || []).concat(
        getReferenceMatchKey(current.label) !== getReferenceMatchKey(normalizedLabel) ? [current.label] : [],
        current.key && getReferenceMatchKey(current.key) !== getReferenceMatchKey(nextKey) ? [current.key] : []
      ),
      [nextKey, normalizedLabel]
    ),
    stations: current.stations
  });
}

function renameReferenceStationEntry(entry, nextName) {
  const current = createReferenceStationEntry(entry);
  const normalizedName = getReferenceDisplayText(nextName);
  return createReferenceStationEntry({
    name: normalizedName,
    aliases: uniqueReferenceValues(
      (current.aliases || []).concat(
        getReferenceMatchKey(current.name) !== getReferenceMatchKey(normalizedName) ? [current.name] : []
      ),
      [normalizedName]
    )
  });
}

function syncReferenceSectorKey(row) {
  if (!row || !row.dataset || row.dataset.referenceAutoKey !== 'true') return;
  const labelInput = row.querySelector('[data-reference-field="label"]');
  const keyInput = row.querySelector('[data-reference-field="key"]');
  if (!labelInput || !keyInput) return;
  const sectorIndex = Number.parseInt(row.dataset.referenceSectorIndex || '0', 10);
  const nextKey = getReferenceFrankoKey(labelInput.value, `sector${Number.isInteger(sectorIndex) ? sectorIndex + 1 : 1}`) || keyInput.value;
  keyInput.value = nextKey;
}

function getReferenceDataEditorRoot() {
  return document.getElementById('referenceDataPanelBody');
}

function getReferenceDataStatusElement() {
  const panel = document.getElementById('referenceDataPanel');
  if (panel && panel.classList.contains('visible')) {
    return document.getElementById('referenceDataPanelMessage') || document.getElementById('referenceDataMessage');
  }
  return document.getElementById('referenceDataMessage') || document.getElementById('referenceDataPanelMessage');
}

function getReferenceDataDraftSnapshot(source = null) {
  const draft = createReferenceDataDraft(source || (referenceDataCache && referenceDataCache.data));
  if (!draft.sectors.length) {
    draft.sectors.push(createReferenceSectorEntry({ autoKey: true }, 0));
  }
  const sharedLicenseEntries = getReferenceMergedLicenseEntries(draft.licenseTypes);
  draft.licenseTypes = createReferenceLicenseTypesDraft(sharedLicenseEntries, draft.licenseTypes);
  return draft;
}

function rerenderReferenceDataEditorDraft(nextDraft) {
  const normalizedDraft = getReferenceDataDraftSnapshot(nextDraft);
  referenceDataCache = { data: normalizedDraft, canEdit: true };
  renderReferenceDataEditor({ editable: true, draft: normalizedDraft });
  if (referenceDataPanelState.mode) {
    renderReferenceDataPanel({ mode: referenceDataPanelState.mode, editable: true, draft: normalizedDraft });
  }
}

function handleReferenceDataEditorInput(event) {
  const editor = getReferenceDataEditorRoot();
  if (!editor || editor.dataset.referenceEditable !== 'true') return;
  if (event.target && event.target.matches('[data-reference-field="label"]')) {
    syncReferenceSectorKey(event.target.closest('[data-reference-sector-row]'));
  }
}

function handleReferenceDataEditorClick(event) {
  const editor = getReferenceDataEditorRoot();
  if (!editor || editor.dataset.referenceEditable !== 'true') return;
  const button = event.target.closest('[data-reference-action]');
  if (!button || !editor.contains(button)) return;

  const action = button.getAttribute('data-reference-action');
  if (!action) return;

  if (action === 'add-sector') {
    const nextLabelRaw = window.prompt('اكتب اسم القطاع الجديد', '');
    if (nextLabelRaw == null) return;
    const nextLabel = getReferenceDisplayText(nextLabelRaw);
    const messageEl = getReferenceDataStatusElement();
    if (!nextLabel) {
      showStatusMessage(messageEl, 'اسم القطاع لا يمكن أن يكون فارغًا.', 'error');
      return;
    }
    const nextDraft = collectReferenceDataDraftFromEditor();
    if (nextDraft.sectors.some((entry) => getReferenceMatchKey(entry.label) === getReferenceMatchKey(nextLabel))) {
      showStatusMessage(messageEl, 'يوجد قطاع آخر بنفس الاسم بالفعل.', 'error');
      return;
    }
    nextDraft.sectors.push(createReferenceSectorEntry({ label: nextLabel, autoKey: true }, nextDraft.sectors.length));
    rerenderReferenceDataEditorDraft(nextDraft);
    showStatusMessage(messageEl, 'تمت إضافة القطاع. احفظ التغييرات لتطبيقها.', 'success');
    return;
  }

  if (action === 'edit-sector') {
    const row = button.closest('[data-reference-sector-row]');
    if (!row) return;
    const nextDraft = collectReferenceDataDraftFromEditor();
    const index = Array.from(editor.querySelectorAll('[data-reference-sector-row]')).indexOf(row);
    if (index < 0 || !nextDraft.sectors[index]) return;
    const currentEntry = nextDraft.sectors[index];
    const nextLabelRaw = window.prompt('عدل اسم القطاع', currentEntry.label || '');
    if (nextLabelRaw == null) return;
    const nextLabel = getReferenceDisplayText(nextLabelRaw);
    const messageEl = getReferenceDataStatusElement();
    if (!nextLabel) {
      showStatusMessage(messageEl, 'اسم القطاع لا يمكن أن يكون فارغًا.', 'error');
      return;
    }
    if (getReferenceMatchKey(nextLabel) !== getReferenceMatchKey(currentEntry.label)
      && nextDraft.sectors.some((entry, entryIndex) => entryIndex !== index && getReferenceMatchKey(entry.label) === getReferenceMatchKey(nextLabel))) {
      showStatusMessage(messageEl, 'يوجد قطاع آخر بنفس الاسم بالفعل.', 'error');
      return;
    }
    nextDraft.sectors[index] = renameReferenceSectorEntry(currentEntry, nextLabel);
    rerenderReferenceDataEditorDraft(nextDraft);
    showStatusMessage(messageEl, 'تم تعديل اسم القطاع. احفظ التغييرات لتطبيقها.', 'success');
    return;
  }

  if (action === 'remove-sector') {
    const row = button.closest('[data-reference-sector-row]');
    if (!row) return;
    const nextDraft = collectReferenceDataDraftFromEditor();
    const index = Array.from(editor.querySelectorAll('[data-reference-sector-row]')).indexOf(row);
    if (index < 0) return;
    nextDraft.sectors.splice(index, 1);
    rerenderReferenceDataEditorDraft(nextDraft);
    return;
  }

  if (action === 'add-station') {
    const sectorRow = button.closest('[data-reference-sector-row]');
    if (!sectorRow) return;
    const nextNameRaw = window.prompt('اكتب اسم القسم الجديد', '');
    if (nextNameRaw == null) return;
    const nextName = getReferenceDisplayText(nextNameRaw);
    const messageEl = getReferenceDataStatusElement();
    if (!nextName) {
      showStatusMessage(messageEl, 'اسم القسم لا يمكن أن يكون فارغًا.', 'error');
      return;
    }
    const nextDraft = collectReferenceDataDraftFromEditor();
    const sectorIndex = Array.from(editor.querySelectorAll('[data-reference-sector-row]')).indexOf(sectorRow);
    if (sectorIndex < 0 || !Array.isArray(nextDraft.sectors[sectorIndex].stations)) return;
    if (nextDraft.sectors[sectorIndex].stations.some((entry) => getReferenceMatchKey(entry.name) === getReferenceMatchKey(nextName))) {
      showStatusMessage(messageEl, 'يوجد قسم آخر بنفس الاسم داخل هذا القطاع.', 'error');
      return;
    }
    nextDraft.sectors[sectorIndex].stations.push(createReferenceStationEntry({ name: nextName }));
    rerenderReferenceDataEditorDraft(nextDraft);
    showStatusMessage(messageEl, 'تمت إضافة القسم. احفظ التغييرات لتطبيقها.', 'success');
    return;
  }

  if (action === 'edit-station') {
    const stationRow = button.closest('[data-reference-station-row]');
    const sectorRow = button.closest('[data-reference-sector-row]');
    if (!stationRow || !sectorRow) return;
    const nextDraft = collectReferenceDataDraftFromEditor();
    const sectorIndex = Array.from(editor.querySelectorAll('[data-reference-sector-row]')).indexOf(sectorRow);
    const stationIndex = Array.from(sectorRow.querySelectorAll('[data-reference-station-row]')).indexOf(stationRow);
    if (sectorIndex < 0 || stationIndex < 0 || !Array.isArray(nextDraft.sectors[sectorIndex].stations) || !nextDraft.sectors[sectorIndex].stations[stationIndex]) return;
    const currentEntry = nextDraft.sectors[sectorIndex].stations[stationIndex];
    const nextNameRaw = window.prompt('عدل اسم القسم', currentEntry.name || '');
    if (nextNameRaw == null) return;
    const nextName = getReferenceDisplayText(nextNameRaw);
    const messageEl = getReferenceDataStatusElement();
    if (!nextName) {
      showStatusMessage(messageEl, 'اسم القسم لا يمكن أن يكون فارغًا.', 'error');
      return;
    }
    if (getReferenceMatchKey(nextName) !== getReferenceMatchKey(currentEntry.name)
      && nextDraft.sectors[sectorIndex].stations.some((entry, entryIndex) => entryIndex !== stationIndex && getReferenceMatchKey(entry.name) === getReferenceMatchKey(nextName))) {
      showStatusMessage(messageEl, 'يوجد قسم آخر بنفس الاسم داخل هذا القطاع.', 'error');
      return;
    }
    nextDraft.sectors[sectorIndex].stations[stationIndex] = renameReferenceStationEntry(currentEntry, nextName);
    rerenderReferenceDataEditorDraft(nextDraft);
    showStatusMessage(messageEl, 'تم تعديل اسم القسم. احفظ التغييرات لتطبيقها.', 'success');
    return;
  }

  if (action === 'remove-station') {
    const stationRow = button.closest('[data-reference-station-row]');
    const sectorRow = button.closest('[data-reference-sector-row]');
    if (!stationRow || !sectorRow) return;
    const nextDraft = collectReferenceDataDraftFromEditor();
    const sectorIndex = Array.from(editor.querySelectorAll('[data-reference-sector-row]')).indexOf(sectorRow);
    const stationIndex = Array.from(sectorRow.querySelectorAll('[data-reference-station-row]')).indexOf(stationRow);
    if (sectorIndex < 0 || stationIndex < 0 || !Array.isArray(nextDraft.sectors[sectorIndex].stations)) return;
    nextDraft.sectors[sectorIndex].stations.splice(stationIndex, 1);
    rerenderReferenceDataEditorDraft(nextDraft);
    return;
  }

  if (action === 'quick-add-license') {
    const input = editor.querySelector('[data-reference-field="new-license-name"]');
    const name = getReferenceDisplayText(input && input.value);
    const messageEl = getReferenceDataStatusElement();
    if (!name) {
      showStatusMessage(messageEl, 'اكتب نوع الترخيص أولًا ثم أضفه إلى القائمة.', 'error');
      return;
    }
    const nextDraft = collectReferenceDataDraftFromEditor();
    const nextEntries = getReferenceMergedLicenseEntries(nextDraft.licenseTypes);
    if (nextEntries.some((entry) => getReferenceMatchKey(entry && entry.name) === getReferenceMatchKey(name))) {
      showStatusMessage(messageEl, 'نوع الترخيص موجود بالفعل في القائمة المشتركة.', 'info');
      return;
    }
    nextEntries.push(createReferenceLicenseEntry({ name }));
    nextDraft.licenseTypes = createReferenceLicenseTypesDraft(nextEntries, nextDraft.licenseTypes);
    rerenderReferenceDataEditorDraft(nextDraft);
    showStatusMessage(messageEl, 'تمت إضافة النوع إلى القائمة المشتركة. احفظ التغييرات لتطبيقها.', 'success');
    return;
  }

  if (action === 'edit-license') {
    const row = button.closest('[data-reference-license-row]');
    if (!row) return;
    const nextDraft = collectReferenceDataDraftFromEditor();
    const entries = getReferenceMergedLicenseEntries(nextDraft.licenseTypes);
    const index = Array.from(editor.querySelectorAll('[data-reference-license-row]')).indexOf(row);
    if (index < 0 || !entries[index]) return;
    const currentEntry = entries[index];
    const nextNameRaw = window.prompt('عدل نوع الرخصة', currentEntry.name || '');
    if (nextNameRaw == null) return;
    const nextName = getReferenceDisplayText(nextNameRaw);
    const messageEl = getReferenceDataStatusElement();
    if (!nextName) {
      showStatusMessage(messageEl, 'اسم النوع لا يمكن أن يكون فارغًا.', 'error');
      return;
    }
    if (getReferenceMatchKey(nextName) !== getReferenceMatchKey(currentEntry.name)
      && entries.some((entry, entryIndex) => entryIndex !== index && getReferenceMatchKey(entry.name) === getReferenceMatchKey(nextName))) {
      showStatusMessage(messageEl, 'يوجد نوع آخر بنفس الاسم بالفعل.', 'error');
      return;
    }
    const aliases = uniqueReferenceValues(
      (Array.isArray(currentEntry.aliases) ? currentEntry.aliases.slice() : []).concat(
        getReferenceMatchKey(currentEntry.name) !== getReferenceMatchKey(nextName) ? [currentEntry.name] : []
      ),
      [nextName]
    );
    entries[index] = createReferenceLicenseEntry({ name: nextName, aliases });
    nextDraft.licenseTypes = createReferenceLicenseTypesDraft(entries, nextDraft.licenseTypes);
    rerenderReferenceDataEditorDraft(nextDraft);
    showStatusMessage(messageEl, 'تم تعديل نوع الرخصة. احفظ التغييرات لتطبيقها.', 'success');
    return;
  }

  if (action === 'remove-license') {
    const row = button.closest('[data-reference-license-row]');
    if (!row) return;
    const nextDraft = collectReferenceDataDraftFromEditor();
    const entries = getReferenceMergedLicenseEntries(nextDraft.licenseTypes);
    const index = Array.from(editor.querySelectorAll('[data-reference-license-row]')).indexOf(row);
    if (index < 0) return;
    const nextEntries = entries.filter((_, entryIndex) => entryIndex !== index);
    nextDraft.licenseTypes = createReferenceLicenseTypesDraft(nextEntries, nextDraft.licenseTypes);
    rerenderReferenceDataEditorDraft(nextDraft);
    return;
  }

  if (action === 'toggle-edit-mode') {
    const nextDraft = collectReferenceDataDraftFromEditor();
    referenceDataPanelState.editModeActive = !referenceDataPanelState.editModeActive;
    rerenderReferenceDataEditorDraft(nextDraft);
    return;
  }

  if (action === 'delete-selected') {
    const nextDraft = collectReferenceDataDraftFromEditor();
    if (referenceDataPanelState.mode === 'sectors') {
      const newSectors = [];
      editor.querySelectorAll('[data-reference-sector-row]').forEach((sectorRow, sIdx) => {
        const sectorCb = sectorRow.querySelector('.reference-sector-cb');
        if (sectorCb && sectorCb.checked) return;
        const sector = nextDraft.sectors[sIdx];
        if (!sector) return;
        const stationRows = Array.from(sectorRow.querySelectorAll('[data-reference-station-row]'));
        const checkedStationIndices = new Set();
        stationRows.forEach((stRow, stIdx) => {
          const stCb = stRow.querySelector('.reference-station-cb');
          if (stCb && stCb.checked) checkedStationIndices.add(stIdx);
        });
        if (checkedStationIndices.size) {
          sector.stations = sector.stations.filter((_, i) => !checkedStationIndices.has(i));
        }
        newSectors.push(sector);
      });
      nextDraft.sectors = newSectors;
    } else if (referenceDataPanelState.mode === 'licenses') {
      const entries = getReferenceMergedLicenseEntries(nextDraft.licenseTypes);
      const checkedIndices = new Set();
      editor.querySelectorAll('[data-reference-license-row]').forEach((row, idx) => {
        const cb = row.querySelector('.reference-select-cb');
        if (cb && cb.checked) checkedIndices.add(idx);
      });
      const nextEntries = entries.filter((_, i) => !checkedIndices.has(i));
      nextDraft.licenseTypes = createReferenceLicenseTypesDraft(nextEntries, nextDraft.licenseTypes);
    }
    rerenderReferenceDataEditorDraft(nextDraft);
    return;
  }
}

function bindReferenceDataEditorEvents(editor) {
  if (!editor || editor.dataset.referenceEventsBound === 'true') return;
  editor.addEventListener('click', handleReferenceDataEditorClick);
  editor.addEventListener('input', handleReferenceDataEditorInput);
  editor.dataset.referenceEventsBound = 'true';
}

function handleReferenceDataLauncherClick(event) {
  const editor = document.getElementById('referenceDataEditor');
  if (!editor) return;
  const button = event.target.closest('[data-reference-launch]');
  if (!button || !editor.contains(button)) return;
  const mode = getReferenceDisplayText(button.getAttribute('data-reference-launch')).toLowerCase();
  if (!mode) return;
  openReferenceDataPanel(mode);
}

function bindReferenceDataLauncherEvents(editor) {
  if (!editor || editor.dataset.referenceLaunchersBound === 'true') return;
  editor.addEventListener('click', handleReferenceDataLauncherClick);
  editor.dataset.referenceLaunchersBound = 'true';
}

function setReferenceDataCardVisibility(visible) {
  const card = document.getElementById('referenceDataCard');
  if (!card) return;
  card.classList.toggle('hidden', !visible);
  card.setAttribute('aria-hidden', visible ? 'false' : 'true');
  if (!visible) {
    closeReferenceDataPanel();
  }
}

function refreshSectorAssignmentForms() {
  ['newUserForm', 'editUserForm'].forEach((formId) => {
    const form = document.getElementById(formId);
    if (!form) return;
    const selectedSectors = collectSelectedSectors(form);
    const storedStations = getStoredStationSelection(form);
    renderSectorCheckboxes(getSectorChecklistContainer(form), selectedSectors);
    setStoredStationSelection(form, normalizeStationSelection(selectedSectors, storedStations));
    configureRoleSectorInteraction(form);
    updateSectorSummary(form, form.dataset && form.dataset.sectorsConfirmed === 'true');
  });
}

function collectReferenceDataDraftFromEditor() {
  const baseDraft = getReferenceDataDraftSnapshot(referenceDataCache && referenceDataCache.data);
  const editor = getReferenceDataEditorRoot();
  if (!editor) {
    return baseDraft;
  }

  const sectorRows = Array.from(editor.querySelectorAll('[data-reference-sector-row]'));
  const licenseRows = Array.from(editor.querySelectorAll('[data-reference-license-row]'));
  if (!sectorRows.length && !licenseRows.length) {
    return baseDraft;
  }

  const sectors = sectorRows.length
    ? sectorRows.map((row, index) => createReferenceSectorEntry({
      key: row.querySelector('[data-reference-field="key"]')?.value || row.getAttribute('data-reference-sector-key'),
      originalKey: row.dataset.referenceOriginalKey,
      label: row.querySelector('[data-reference-field="label"]')?.value || row.getAttribute('data-reference-sector-label'),
      autoKey: row.dataset.referenceAutoKey === 'true',
      aliases: buildReferenceSectorAliases(
        row,
        row.querySelector('[data-reference-field="key"]')?.value || row.getAttribute('data-reference-sector-key'),
        row.querySelector('[data-reference-field="label"]')?.value || row.getAttribute('data-reference-sector-label')
      ),
      stations: Array.from(row.querySelectorAll('[data-reference-station-row]')).map((stationRow) => createReferenceStationEntry({
        name: stationRow.querySelector('[data-reference-field="station-name"]')?.value || stationRow.getAttribute('data-reference-station-name'),
        aliases: buildReferenceStationAliases(
          stationRow,
          stationRow.querySelector('[data-reference-field="station-name"]')?.value || stationRow.getAttribute('data-reference-station-name')
        )
      }))
    }, index))
    : baseDraft.sectors.map((entry, index) => createReferenceSectorEntry(entry, index));

  const licenseEntries = licenseRows.length
    ? licenseRows.map((row) => {
      const nameInput = row.querySelector('[data-reference-field="name"]');
      const aliasesInput = row.querySelector('[data-reference-field="aliases"]');
      const name = nameInput ? nameInput.value : row.getAttribute('data-reference-license-name');
      const aliases = aliasesInput
        ? parseReferenceListValue(aliasesInput.value)
        : buildReferenceLicenseAliases(row, name);
      return createReferenceLicenseEntry({ name, aliases });
    }).filter((entry) => entry.name)
    : getReferenceMergedLicenseEntries(baseDraft.licenseTypes);

  return createReferenceDataDraft({
    version: 1,
    updatedAt: baseDraft.updatedAt || '',
    sectors,
    licenseTypes: createReferenceLicenseTypesDraft(licenseEntries, baseDraft.licenseTypes)
  });
}

function renderReferenceSectorSettingsMarkup(draft, editable, editMode) {
  const addSectorButton = editable
    ? '<button type="button" class="reference-add-action" data-reference-action="add-sector" title="إضافة قطاع">+ إضافة قطاع</button>'
    : '';
  const editToggleBtn = editable
    ? `<button type="button" class="reference-edit-toggle-btn${editMode ? ' active' : ''}" data-reference-action="toggle-edit-mode">${editMode ? '✓ إنهاء التعديل' : '✎ تعديل'}</button>`
    : '';
  const deleteSelectedBtn = editable
    ? '<button type="button" class="reference-delete-selected-btn" data-reference-action="delete-selected">حذف المحدد</button>'
    : '';

  const sectorCards = draft.sectors.map((entry, index) => {
    const nameField = editMode
      ? `<input type="text" class="reference-inline-input" data-reference-field="label" value="${escapeHtml(entry.label || '')}" placeholder="اسم القطاع" />`
      : `<h3>${escapeHtml(entry.label || `قطاع ${index + 1}`)}</h3>`;

    const stationsList = entry.stations.length
      ? entry.stations.map((station) => {
          const stationField = editMode
            ? `<input type="text" class="reference-inline-input reference-inline-input--sm" data-reference-field="station-name" value="${escapeHtml(station.name || '')}" placeholder="اسم القسم" />`
            : `<span class="reference-license-line-name">${escapeHtml(station.name || '')}</span>`;
          return `
            <div
              class="reference-license-line reference-station-row"
              data-reference-station-row
              data-reference-station-name="${escapeHtml(station.name || '')}"
              data-reference-original-name="${escapeHtml(station.name || '')}"
              data-reference-aliases="${escapeHtml(JSON.stringify(station.aliases || []))}"
            >
              ${editable ? '<input type="checkbox" class="reference-select-cb reference-station-cb" aria-label="تحديد القسم" />' : ''}
              ${stationField}
            </div>
          `;
        }).join('')
      : '<p class="reference-empty">لا توجد أقسام مضافة لهذا القطاع بعد.</p>';

    return `
      <section
        class="reference-sector-card"
        data-reference-sector-row
        data-reference-sector-index="${index}"
        data-reference-sector-key="${escapeHtml(entry.key)}"
        data-reference-sector-label="${escapeHtml(entry.label)}"
        data-reference-auto-key="${entry.autoKey ? 'true' : 'false'}"
        data-reference-original-key="${escapeHtml(entry.originalKey || entry.key || '')}"
        data-reference-original-label="${escapeHtml(entry.label || '')}"
        data-reference-aliases="${escapeHtml(JSON.stringify(entry.aliases || []))}"
      >
        <div class="reference-card-header">
          ${editable ? '<input type="checkbox" class="reference-select-cb reference-sector-cb" aria-label="تحديد القطاع" />' : ''}
          <div class="reference-card-header-name">
            ${nameField}
            <p>${entry.stations.length ? `${entry.stations.length} قسم` : 'بدون أقسام'}</p>
          </div>
        </div>
        <input type="hidden" data-reference-field="key" value="${escapeHtml(entry.key)}" />
        <div class="reference-subsection">
          <div class="reference-subsection-header">
            <h4>الأقسام</h4>
            ${editable ? '<button type="button" class="reference-license-line-btn reference-license-line-btn--add" data-reference-action="add-station" title="إضافة قسم">+</button>' : ''}
          </div>
          <div class="reference-license-lines">
            ${stationsList}
          </div>
        </div>
      </section>
    `;
  }).join('');

  return `
    <div class="reference-data-toolbar">
      <div>
        <strong>إعدادات القطاعات والأقسام</strong>
        <div class="reference-data-note">يمكنك تعديل اسم القطاع، إضافة أقسام جديدة، أو حذف أي قسم من نفس البطاقة.</div>
      </div>
      <div class="reference-actions">
        ${editToggleBtn}
        ${deleteSelectedBtn}
        ${addSectorButton}
      </div>
    </div>
    <div class="reference-data-grid reference-data-grid--sectors">
      ${sectorCards}
    </div>
  `;
}

function renderReferenceLicenseSettingsMarkup(draft, editable, editMode) {
  const sharedLicenseEntries = getReferenceMergedLicenseEntries(draft.licenseTypes);
  const disabledAttr = editable ? '' : ' disabled';
  const editToggleBtn = editable
    ? `<button type="button" class="reference-edit-toggle-btn${editMode ? ' active' : ''}" data-reference-action="toggle-edit-mode">${editMode ? '✓ إنهاء التعديل' : '✎ تعديل'}</button>`
    : '';
  const deleteSelectedBtn = editable
    ? '<button type="button" class="reference-delete-selected-btn" data-reference-action="delete-selected">حذف المحدد</button>'
    : '';

  const rowsMarkup = sharedLicenseEntries.length
    ? sharedLicenseEntries.map((entry) => {
        const nameField = editMode
          ? `<input type="text" class="reference-inline-input" data-reference-field="name" value="${escapeHtml(entry.name)}" placeholder="نوع الرخصة" />`
          : `<span class="reference-license-line-name">${escapeHtml(entry.name)}</span>`;
        return `
          <div
            class="reference-license-line"
            data-reference-license-row
            data-reference-license-name="${escapeHtml(entry.name)}"
            data-reference-original-name="${escapeHtml(entry.name)}"
            data-reference-aliases="${escapeHtml(JSON.stringify(entry.aliases || []))}"
          >
            ${editable ? '<input type="checkbox" class="reference-select-cb" aria-label="تحديد النوع" />' : ''}
            ${nameField}
          </div>
        `;
      }).join('')
    : '<p class="reference-empty">لا توجد أنواع معرفة حتى الآن.</p>';

  return `
    <div class="reference-license-manager">
      <div class="reference-data-toolbar">
        <div>
          <strong>إعدادات نوع الرخصة</strong>
          <div class="reference-data-note">قائمة واحدة مشتركة بين البرامج. يمكنك الإضافة من الأعلى، أو التعديل والحذف من كل صف.</div>
        </div>
        <div class="reference-actions">
          ${editToggleBtn}
          ${deleteSelectedBtn}
        </div>
      </div>
      <div class="reference-license-toolbar">
        <div class="reference-field">
          <label>إضافة نوع جديد</label>
          <input type="text" data-reference-field="new-license-name" placeholder="اكتب نوع الرخصة الجديد"${disabledAttr} />
        </div>
        ${editable ? '<button type="button" class="reference-license-add-btn" data-reference-action="quick-add-license" title="إضافة نوع جديد">+</button>' : ''}
      </div>
      <div class="reference-license-lines">
        ${rowsMarkup}
      </div>
    </div>
  `;
}

function renderReferenceDataPanel({ mode = referenceDataPanelState.mode, editable = false, draft: providedDraft = null } = {}) {
  const panel = document.getElementById('referenceDataPanel');
  const body = getReferenceDataEditorRoot();
  const titleEl = document.getElementById('referenceDataPanelTitle');
  const saveBtn = document.getElementById('saveReferenceDataBtn');
  if (!panel || !body || !titleEl || !saveBtn) return;

  const draft = getReferenceDataDraftSnapshot(providedDraft || (referenceDataCache && referenceDataCache.data));
  referenceDataCache = {
    data: draft,
    canEdit: Boolean(editable)
  };
  referenceDataPanelState.mode = mode || '';

  if (!referenceDataPanelState.mode) {
    closeReferenceDataPanel();
    return;
  }

  titleEl.textContent = referenceDataPanelState.mode === 'licenses'
    ? 'إعدادات نوع الرخصة'
    : 'إعدادات القطاعات والأقسام';
  body.dataset.referenceEditable = editable ? 'true' : 'false';
  bindReferenceDataEditorEvents(body);
  body.innerHTML = referenceDataPanelState.mode === 'licenses'
    ? renderReferenceLicenseSettingsMarkup(draft, editable, referenceDataPanelState.editModeActive)
    : renderReferenceSectorSettingsMarkup(draft, editable, referenceDataPanelState.editModeActive);
  body.querySelectorAll('[data-reference-sector-row]').forEach((row) => {
    syncReferenceSectorKey(row);
  });

  saveBtn.classList.toggle('hidden', !editable);
  saveBtn.disabled = false;
  panel.classList.add('visible');
  panel.setAttribute('aria-hidden', 'false');
}

function openReferenceDataPanel(mode) {
  const nextDraft = collectReferenceDataDraftFromEditor();
  referenceDataCache = {
    data: nextDraft,
    canEdit: Boolean(referenceDataCache && referenceDataCache.canEdit)
  };
  renderReferenceDataPanel({
    mode,
    editable: Boolean(referenceDataCache && referenceDataCache.canEdit),
    draft: nextDraft
  });
}

function closeReferenceDataPanel() {
  const panel = document.getElementById('referenceDataPanel');
  const body = getReferenceDataEditorRoot();
  const messageEl = document.getElementById('referenceDataPanelMessage');
  if (panel) {
    panel.classList.remove('visible');
    panel.setAttribute('aria-hidden', 'true');
  }
  if (body) {
    body.innerHTML = '';
    body.dataset.referenceEditable = 'false';
  }
  if (messageEl) {
    messageEl.textContent = '';
    messageEl.className = 'status-message';
  }
  referenceDataPanelState.mode = '';
  referenceDataPanelState.editModeActive = false;
}

function renderReferenceDataEditor({ editable = false, draft: providedDraft = null } = {}) {
  const editor = document.getElementById('referenceDataEditor');
  if (!editor) return;

  const draft = getReferenceDataDraftSnapshot(providedDraft || (referenceDataCache && referenceDataCache.data));
  const sectorsCount = draft.sectors.length;
  const stationsCount = draft.sectors.reduce((total, entry) => total + (Array.isArray(entry.stations) ? entry.stations.length : 0), 0);
  const sharedLicenseEntries = getReferenceMergedLicenseEntries(draft.licenseTypes);

  referenceDataCache = {
    data: draft,
    canEdit: Boolean(editable)
  };
  editor.dataset.referenceEditable = editable ? 'true' : 'false';
  bindReferenceDataLauncherEvents(editor);

  const triggerDisabledAttr = editable ? '' : ' disabled';
  editor.innerHTML = `
    <div class="reference-data-toolbar">
      <div>
        <strong>المصدر المشترك بين البرامج</strong>
        <div class="reference-data-note">تُحفظ القطاعات والأقسام وأنواع التراخيص مرة واحدة، مع مطابقة ذكية لاختلافات الحروف العربية.</div>
      </div>
    </div>
    <div class="reference-settings-list">
      <section class="reference-settings-item">
        <div class="reference-settings-copy">
          <h3>اعدادات القطاعات والاقسام</h3>
          <p>إدارة بطاقات القطاعات وقوائم الأقسام التابعة لها من نافذة مستقلة.</p>
          <div class="reference-settings-stats">${sectorsCount} قطاع • ${stationsCount} قسم</div>
        </div>
        <button type="button" class="reference-settings-trigger" data-reference-launch="sectors"${triggerDisabledAttr} aria-label="فتح اعدادات القطاعات والاقسام">⚙️</button>
      </section>
      <section class="reference-settings-item">
        <div class="reference-settings-copy">
          <h3>اعدادات نوع الرخصة</h3>
          <p>قائمة واحدة مشتركة لكل أنواع الرخص مع تعديل الاسم أو الحذف من نفس النافذة.</p>
          <div class="reference-settings-stats">${sharedLicenseEntries.length} نوع مشترك</div>
        </div>
        <button type="button" class="reference-settings-trigger" data-reference-launch="licenses"${triggerDisabledAttr} aria-label="فتح اعدادات نوع الرخصة">⚙️</button>
      </section>
    </div>
  `;
}

async function loadReferenceDataEditor({ editable = false } = {}) {
  const messageEl = document.getElementById('referenceDataMessage');
  const referenceCard = document.getElementById('referenceDataCard');
  if (!referenceCard) return;

  setReferenceDataCardVisibility(true);
  showStatusMessage(messageEl, 'جاري تحميل البيانات المشتركة...', 'info');

  try {
    const response = await fetchWithAuth(REFERENCE_DATA_ENDPOINT, { method: 'GET' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload || !payload.data) {
      throw new Error(payload && payload.message ? payload.message : 'تعذر تحميل البيانات المشتركة');
    }

    const canEdit = Boolean(editable && payload.canEdit);
    setReferenceDataCache(payload.data, canEdit);
    renderReferenceDataEditor({ editable: canEdit, draft: payload.data });
    if (referenceDataPanelState.mode) {
      renderReferenceDataPanel({ mode: referenceDataPanelState.mode, editable: canEdit, draft: payload.data });
    }
    refreshSectorAssignmentForms();
    showStatusMessage(messageEl, 'تم تحميل البيانات المشتركة.', 'success');
  } catch (error) {
    console.error('Load reference data failed:', error);
    const draft = setReferenceDataCache(
      referenceDataCache && referenceDataCache.data
        ? referenceDataCache.data
        : (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getSnapshot === 'function'
          ? SHARED_REFERENCE_DATA.getSnapshot()
          : {}),
      editable
    );
    renderReferenceDataEditor({ editable, draft });
    if (referenceDataPanelState.mode) {
      renderReferenceDataPanel({ mode: referenceDataPanelState.mode, editable, draft });
    }
    showStatusMessage(messageEl, draft.sectors.length
      ? 'تعذر تحميل أحدث نسخة، وتم عرض آخر بيانات متاحة محليًا.'
      : 'تعذر تحميل البيانات المشتركة.', draft.sectors.length ? 'info' : 'error');
  }
}

async function saveReferenceDataChanges() {
  const messageEl = getReferenceDataStatusElement();
  const saveBtn = document.getElementById('saveReferenceDataBtn');
  if (!saveBtn) return;

  const draft = collectReferenceDataDraftFromEditor();
  if (!draft.sectors.some((entry) => getReferenceDisplayText(entry.label))) {
    showStatusMessage(messageEl, 'أضف قطاعًا واحدًا على الأقل قبل الحفظ.', 'error');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.classList.add('is-loading');
  showStatusMessage(messageEl, 'جاري حفظ البيانات المشتركة...', 'info');

  try {
    const response = await fetchWithAuth(REFERENCE_DATA_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: draft })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload || !payload.data) {
      throw new Error(payload && payload.message ? payload.message : 'تعذر حفظ البيانات المشتركة');
    }

    setReferenceDataCache(payload.data, true);
    renderReferenceDataEditor({ editable: true, draft: payload.data });
    if (referenceDataPanelState.mode) {
      renderReferenceDataPanel({ mode: referenceDataPanelState.mode, editable: true, draft: payload.data });
    }
    refreshSectorAssignmentForms();
    showStatusMessage(messageEl, 'تم حفظ البيانات المشتركة بنجاح.', 'success');
    const summaryMessageEl = document.getElementById('referenceDataMessage');
    if (summaryMessageEl && summaryMessageEl !== messageEl) {
      showStatusMessage(summaryMessageEl, 'تم حفظ البيانات المشتركة بنجاح.', 'success');
    }
  } catch (error) {
    console.error('Save reference data failed:', error);
    showStatusMessage(messageEl, error.message || 'تعذر حفظ البيانات المشتركة', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.classList.remove('is-loading');
  }
}

async function setupModeToggle() {
  await loadThemePreference();
}

function stopActivityStripPolling() {
  if (activityStripPollHandle) {
    clearInterval(activityStripPollHandle);
    activityStripPollHandle = null;
  }
}

function setDashboardLayoutMode(withActivityStrip) {
  const layout = document.querySelector('.dashboard-layout');
  if (!layout) return;
  layout.classList.toggle('has-activity-strip', Boolean(withActivityStrip));
}

function setActivityStripVisibility(visible) {
  const strip = document.getElementById('activityStrip');
  if (!strip) return;
  strip.classList.toggle('hidden', !visible);
  strip.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function getLatestUniqueUsers(entries) {
  const unique = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const username = String(entry?.username || '').trim();
    if (!username) return;
    const current = unique.get(username);
    const nextTime = new Date(entry.lastSeenAt || 0).getTime();
    const currentTime = current ? new Date(current.lastSeenAt || 0).getTime() : 0;
    if (!current || nextTime >= currentTime) {
      unique.set(username, entry);
    }
  });
  return Array.from(unique.values()).sort((left, right) => {
    return new Date(right.lastSeenAt || 0).getTime() - new Date(left.lastSeenAt || 0).getTime();
  });
}

function renderProgramPresenceHighlights(users) {
  const grouped = new Map();
  getLatestUniqueUsers(users).forEach((entry) => {
    const programKey = String(entry?.programKey || '').trim();
    if (!programKey || !DEFAULT_APP_KEYS.includes(programKey)) return;
    if (!grouped.has(programKey)) {
      grouped.set(programKey, []);
    }
    grouped.get(programKey).push(entry);
  });

  document.querySelectorAll('.app-card[data-app]').forEach((card) => {
    const appKey = String(card.getAttribute('data-app') || '').trim();
    const presenceContainer = card.querySelector('[data-app-presence]');
    const activeEntries = grouped.get(appKey) || [];

    if (!presenceContainer) return;

    if (!activeEntries.length) {
      card.classList.remove('has-live-presence');
      card.style.removeProperty('--presence-color');
      card.style.removeProperty('--presence-rgb');
      presenceContainer.innerHTML = '';
      presenceContainer.hidden = true;
      return;
    }

    const primaryUser = activeEntries[0];
    const primaryColor = getPresenceColor(primaryUser.username);
    card.classList.add('has-live-presence');
    card.style.setProperty('--presence-color', primaryColor.hex);
    card.style.setProperty('--presence-rgb', primaryColor.rgb);
    presenceContainer.hidden = false;
    presenceContainer.innerHTML = activeEntries.map((entry) => {
      const roleLabel = getRoleDisplayText(entry, 'short');
      return `
        <span class="app-card-presence-chip" style="${buildPresenceStyle(entry.username)}">
          <span class="app-card-presence-name">${escapeHtml(entry.displayName || entry.username || '—')}</span>
          <span class="app-card-presence-role">${escapeHtml(roleLabel)}</span>
        </span>
      `;
    }).join('');
  });
}

function renderActivityRosterList(users) {
  const list = document.getElementById('activeUsersList');
  const emptyState = document.getElementById('activeUsersEmpty');
  const count = document.getElementById('activeUsersCount');
  const filterCheckbox = document.getElementById('filterActiveUsers');
  const filterNotifBtn = document.getElementById('filterWithNotifications');
  if (!list || !emptyState || !count) return;

  let items = Array.isArray(users) ? users.slice() : [];
  const onlineCount = items.filter((entry) => getActivityPresenceStatus(entry) !== 'offline').length;
  count.textContent = String(onlineCount);
  count.title = `${onlineCount} متصل من إجمالي ${items.length}`;

  if (filterCheckbox && filterCheckbox.classList.contains('is-active')) {
    items = items.filter((entry) => getActivityPresenceStatus(entry) !== 'offline');
  }

  if (filterNotifBtn && filterNotifBtn.classList.contains('is-active')) {
    items = items.filter((entry) => getDeleteApprovalCountForUser(entry.username) > 0);
  }

  if (!items.length) {
    list.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  list.innerHTML = items.map((entry) => {
    const presenceMeta = getActivityPresenceMeta(entry);
    const roleKey = getNormalizedRole(entry);
    const roleClass = roleKey === 'secretary' ? 'is-secretary' : '';
    const roleLabel = getRoleDisplayText(entry, 'short');
    const rawProgramName = String(entry?.programName || '').trim();
    const rawPageName = String(entry?.pageName || '').trim();
    const lastSeenValue = entry?.lastSeenAt || entry?.lastLogin || entry?.createdAt || '';
    const lastSeen = formatDateTime(lastSeenValue);
    const timeSummary = lastSeen === '—'
      ? presenceMeta.timeLabel
      : `${presenceMeta.timeLabel}: ${lastSeen}`;
    const subtitle = rawProgramName
      ? (
        rawPageName && rawPageName !== rawProgramName
          ? `${escapeHtml(rawProgramName)}<span class="activity-separator">•</span>${escapeHtml(rawPageName)}`
          : escapeHtml(rawProgramName)
      )
      : escapeHtml(presenceMeta.fallbackSubtitle);

    return `
      <button type="button" class="activity-user-item ${presenceMeta.className}" data-activity-user="${escapeHtml(entry.username)}" data-presence-status="${presenceMeta.key}">
        <div class="activity-user-top">
          <div class="activity-user-name-wrap">
            <span class="activity-user-name">${escapeHtml(entry.displayName || entry.username || '—')}</span>
          </div>
          <span class="activity-user-role ${roleClass}">${escapeHtml(roleLabel)}</span>
        </div>
        <div class="activity-user-program">${subtitle}</div>
        <div class="activity-user-meta">
          <span>@${escapeHtml(entry.username || '—')}</span>
          <span>${escapeHtml(timeSummary)}</span>
        </div>
        <div class="activity-user-status-row">
          <span class="activity-user-status-label">${escapeHtml(presenceMeta.label)}</span>
          <span class="activity-user-status-indicator" aria-hidden="true"></span>
        </div>
      </button>
    `;
  }).join('');
}

async function loadActivityRoster() {
  if (typeof document !== 'undefined' && document.hidden) return;
  try {
    const response = await fetchWithAuth(ACTIVITY_API_ENDPOINTS.roster, { method: 'GET' });
    if (!response.ok) throw new Error('فشل تحميل قائمة المستخدمين');
    const data = await response.json();
    const roster = Array.isArray(data?.users) ? data.users : [];
    currentActiveUsers = Array.isArray(data?.activeUsers) ? data.activeUsers : [];
    renderActivityRosterList(roster);
    renderProgramPresenceHighlights(currentActiveUsers);
  } catch (error) {
    console.error('Load activity roster failed:', error);
  }
}

function closeActivityPanel() {
  const panel = document.getElementById('activityPanel');
  if (!panel) return;
  panel.classList.remove('visible');
  panel.setAttribute('aria-hidden', 'true');
}

function renderActivityLogPanel(payload) {
  const panel = document.getElementById('activityPanel');
  const title = document.getElementById('activityPanelTitle');
  const subtitle = document.getElementById('activityPanelSubtitle');
  const body = document.getElementById('activityPanelBody');
  if (!panel || !title || !subtitle || !body) return;

  const user = payload?.user || null;
  const logs = Array.isArray(payload?.logs) ? payload.logs : [];
  const activeSessions = Array.isArray(payload?.activeSessions) ? payload.activeSessions : [];
  const actorName = user?.displayName || user?.username || '—';
  const actorRole = getRoleDisplayText(user || { role: 'user' }, 'detail');
  const actorSector = formatSectorDisplay(user?.sectors || user?.room) || '—';

  title.textContent = actorName;
  subtitle.textContent = `${actorRole} • ${actorSector}`;

  const activeMarkup = activeSessions.length
    ? activeSessions
        .map((entry) => `
          <li class="activity-live-item">
            <span class="activity-live-program">${escapeHtml(entry.programName || 'غير محدد')}</span>
            <span class="activity-live-time">${escapeHtml(formatDateTime(entry.lastSeenAt))}</span>
          </li>
        `)
        .join('')
    : '<li class="activity-live-item empty">غير متصل حالياً</li>';

  const logsMarkup = logs.length
    ? logs
        .map((entry) => {
          const details = [];
          if (entry.programName) details.push(escapeHtml(entry.programName));
          if (entry.pageName && entry.pageName !== entry.programName) details.push(escapeHtml(entry.pageName));
          if (entry.details?.method && entry.details?.url) {
            details.push(escapeHtml(`${entry.details.method} ${entry.details.url}`));
          } else if (entry.details?.label) {
            details.push(escapeHtml(entry.details.label));
          }

          return `
            <article class="activity-log-item">
              <div class="activity-log-time">${escapeHtml(formatDateTime(entry.occurredAt))}</div>
              <div class="activity-log-message">${escapeHtml(entry.message || 'نشاط جديد')}</div>
              <div class="activity-log-meta">${details.join(' • ') || '—'}</div>
            </article>
          `;
        })
        .join('')
    : '<p class="activity-log-empty">لا توجد سجلات محفوظة لهذا المستخدم حتى الآن.</p>';

  body.innerHTML = `
    <section class="activity-live-card">
      <h4>النشاط الحالي</h4>
      <ul class="activity-live-list">${activeMarkup}</ul>
    </section>
    <section class="activity-log-list-wrap">
      <h4>سجل الحركات</h4>
      <div class="activity-log-list">${logsMarkup}</div>
    </section>
  `;

  panel.classList.add('visible');
  panel.setAttribute('aria-hidden', 'false');
}

async function openActivityPanel(username) {
  if (!username) return;
  try {
    const response = await fetchWithAuth(ACTIVITY_API_ENDPOINTS.userLogs(username), { method: 'GET' });
    if (!response.ok) throw new Error('فشل تحميل السجل');
    const data = await response.json();
    renderActivityLogPanel(data);
  } catch (error) {
    console.error('Open activity panel failed:', error);
    window.alert('تعذر تحميل سجل النشاط');
  }
}

function bindActivityStripEvents() {
  const filterBtn = document.getElementById('filterActiveUsers');
  if (filterBtn && !filterBtn.dataset.bound) {
    filterBtn.addEventListener('click', () => {
      filterBtn.classList.toggle('is-active');
      void loadActivityRoster();
    });
    filterBtn.dataset.bound = 'true';
  }

  const filterNotifBtn = document.getElementById('filterWithNotifications');
  if (filterNotifBtn && !filterNotifBtn.dataset.bound) {
    filterNotifBtn.addEventListener('click', () => {
      filterNotifBtn.classList.toggle('is-active');
      void loadActivityRoster();
    });
    filterNotifBtn.dataset.bound = 'true';
  }

  const list = document.getElementById('activeUsersList');
  if (list && !list.dataset.bound) {
    list.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-activity-user]') : null;
      if (!target) return;
      void openActivityPanel(target.getAttribute('data-activity-user') || '');
    });
    list.dataset.bound = 'true';
  }

  const closeBtn = document.getElementById('closeActivityPanel');
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.addEventListener('click', closeActivityPanel);
    closeBtn.dataset.bound = 'true';
  }

  const panel = document.getElementById('activityPanel');
  if (panel && !panel.dataset.bound) {
    panel.addEventListener('click', (event) => {
      if (event.target === panel) {
        closeActivityPanel();
      }
    });
    panel.dataset.bound = 'true';
  }

  if (document.body && !document.body.dataset.activityEscapeBound) {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeActivityPanel();
      }
    });
    document.body.dataset.activityEscapeBound = 'true';
  }
}

async function setupAdminActivityStrip() {
  setDashboardLayoutMode(true);
  setActivityStripVisibility(true);
  bindActivityStripEvents();
  await loadActivityRoster();
  stopActivityStripPolling();
  activityStripPollHandle = window.setInterval(() => {
    void loadActivityRoster();
  }, ACTIVITY_STRIP_POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      void loadActivityRoster();
    }
  });
  window.addEventListener('beforeunload', stopActivityStripPolling, { once: true });
}

async function initMainPage() {
  const session = await ensureAuthenticated();
  if (!session) return;

  await loadAppCatalog();

  const { user } = session;
  renderDashboardCards(session.user);
  renderUserSummary(user);
  updateDashboardButtons(user);
  await setupModeToggle();
  wireProfileLinks();

  if (isAdminUser(user)) {
    await setupAdminActivityStrip();
  } else {
    stopActivityStripPolling();
    currentActiveUsers = [];
    renderProgramPresenceHighlights([]);
    setDashboardLayoutMode(false);
    setActivityStripVisibility(false);
  }
}

function renderAllowedAppsBadges(target, apps) {
  if (!target) return;
  if (!apps || !apps.length) {
    target.innerHTML = '<li class="empty">لا توجد تطبيقات مفعلة</li>';
    return;
  }

  target.innerHTML = apps
    .map((app) => {
      const label = APP_LABELS[app] || app;
      return `<li class="app-pill">${escapeHtml(label)}</li>`;
    })
    .join('');
}

function renderProfileDetails(user) {
  if (!user) return;
  const usernameEl = document.getElementById('profileUsername');
  const displayNameEl = document.getElementById('profileDisplayName');
  const roleBadgeEl = document.getElementById('profileRoleBadge');
  const roomEl = document.getElementById('profileSector');
  const createdEl = document.getElementById('profileCreatedAt');
  const appList = document.getElementById('profileAllowedApps');
  const adminNote = document.getElementById('profileAdminNote');

  if (usernameEl) usernameEl.textContent = user.username || '—';
  if (displayNameEl) displayNameEl.textContent = user.displayName || user.username;
  if (roleBadgeEl) roleBadgeEl.textContent = getRoleDisplayText(user, 'badge');
  if (roomEl) {
    const sectorDisplay = formatSectorDisplay(user.sectors || user.room);
    roomEl.textContent = sectorDisplay || '—';
  }
  if (createdEl) createdEl.textContent = formatDateTime(user.createdAt);

  const allowedKeys = buildUserAllowedApps(user);
  renderAllowedAppsBadges(appList, allowedKeys);

  if (adminNote) {
    if (isAdminUser(user)) {
      adminNote.classList.remove('hidden');
    } else {
      adminNote.classList.add('hidden');
    }
  }

  document.querySelectorAll('[data-admin-only]').forEach((node) => {
    if (canAccessSettings(user)) {
      node.classList.remove('hidden');
    } else {
      node.classList.add('hidden');
    }
  });
}

async function handleProfilePasswordChange(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const messageEl = document.getElementById('profilePasswordMessage');
  const currentPassword = (form.querySelector('[name="currentPassword"]')?.value || '').trim();
  const newPassword = (form.querySelector('[name="newPassword"]')?.value || '').trim();
  const confirmPassword = (form.querySelector('[name="confirmPassword"]')?.value || '').trim();

  const notify = (text, type = 'error') => {
    if (messageEl) {
      showStatusMessage(messageEl, text, type);
    } else if (text) {
      window.alert(text);
    }
  };

  if (!newPassword) {
    notify('يرجى إدخال كلمة المرور الجديدة');
    return;
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    notify(`كلمة المرور يجب أن تحتوي على ${MIN_PASSWORD_LENGTH} رموز على الأقل`);
    return;
  }

  if (newPassword !== confirmPassword) {
    notify('كلمتا المرور غير متطابقتين');
    return;
  }

  const user = getUser();
  if (!user || !user.username) {
    notify('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى.');
    redirectToLogin();
    return;
  }

  if (!isAdminUser(user) && !currentPassword) {
    notify('يرجى إدخال كلمة المرور الحالية');
    return;
  }

  notify('جاري تحديث كلمة المرور...', 'info');

  try {
    const response = await fetchWithAuth(`/api/users/${encodeURIComponent(user.username)}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data && data.message ? data.message : 'تعذر تحديث كلمة المرور');
    }

    notify(data.message || 'تم تحديث كلمة المرور بنجاح', 'success');
    form.reset();

    const token = getToken();
    if (token && data.user) {
      setActiveSession(token, data.user);
      renderUserSummary(data.user);
      renderProfileDetails(data.user);
    }
  } catch (error) {
    console.error('Password update failed:', error);
    notify(error && error.message ? error.message : 'تعذر تحديث كلمة المرور');
  }
}

async function initProfilePage() {
  const session = await ensureAuthenticated();
  if (!session) return;

  await loadAppCatalog();

  const { user } = session;
  renderUserSummary(user);
  renderProfileDetails(user);
  await setupModeToggle();
  wireProfileLinks();

  const passwordForm = document.getElementById('profilePasswordForm');
  if (passwordForm) {
    passwordForm.addEventListener('submit', handleProfilePasswordChange);
  }
}

function renderNewUserAppToggles(apps = DEFAULT_APP_KEYS) {
  const container = document.getElementById('newUserAppToggles');
  if (!container) return;
  const filtered = apps.filter((app) => app !== 'settings');
  container.innerHTML = filtered
    .map((app) => {
      const label = APP_LABELS[app] || app;
      return `\n        <label class="toggle">\n          <input type="checkbox" value="${escapeHtml(app)}" checked />\n          <span>${escapeHtml(label)}</span>\n        </label>\n      `;
    })
    .join('');
  syncAdminAppSelectionForForm(container.closest('form'));
}

function renderAppTogglesForUser(user) {
  const container = document.getElementById('existingUserControls');
  if (!container || !user) return;

  const switches = cachedAvailableApps
    .filter((app) => app !== 'settings')
    .map((app) => {
      const label = APP_LABELS[app] || app;
      const checked = hasFullAppAccess(user) || isAppAllowed(user, app) ? 'checked' : '';
      return `\n        <label class="toggle">\n          <input type="checkbox" value="${escapeHtml(app)}" ${checked} />\n          <span>${escapeHtml(label)}</span>\n        </label>\n      `;
    })
    .join('');

  container.innerHTML = `\n    <h3>صلاحيات التطبيقات</h3>\n    <div class="toggle-grid">${switches}</div>\n    <div class="future-control">\n      <h4>عناصر تحكم مستقبلية</h4>\n      <p>سيتم إضافة إعدادات جديدة هنا لاحقًا لإدارة مزايا متقدمة.</p>\n    </div>\n  `;
}

function getFormAppToggleGrid(form) {
  if (!form) return null;
  if (form.id === 'newUserForm') return document.getElementById('newUserAppToggles');
  return form.querySelector('.toggle-grid');
}

function syncAdminAppSelectionForForm(form) {
  const grid = getFormAppToggleGrid(form);
  if (!grid) return;

  const locked = shouldLockAppSelectionForRole(getFormRoleValue(form));
  grid.classList.toggle('is-admin-locked', locked);
  grid.setAttribute('aria-disabled', locked ? 'true' : 'false');
  grid.title = locked ? 'المدير يرى كل التطبيقات تلقائياً' : '';
  grid.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    if (locked) input.checked = true;
    input.disabled = locked;
  });
}

function collectCheckedValues(node) {
  if (!node) return [];
  return Array.from(node.querySelectorAll('input[type="checkbox"]:checked'))
    .map((input) => input.value);
}

function getFormMessageElement(form) {
  if (!form || !form.dataset) return null;
  const targetId = form.dataset.messageTarget;
  return targetId ? document.getElementById(targetId) : null;
}

function getReferencePermissionGroup(form) {
  return form ? form.querySelector('[data-reference-permission-group]') : null;
}

function getReferencePermissionInput(form) {
  return form ? form.querySelector('[data-manage-reference-data]') : null;
}

function getDashboardCustomizationPermissionGroup(form) {
  return form ? form.querySelector('[data-dashboard-customization-permission-group]') : null;
}

function getDashboardCustomizationPermissionInput(form) {
  return form ? form.querySelector('[data-customize-dashboard-apps]') : null;
}

function getActivityHistoryPermissionGroup(form) {
  return form ? form.querySelector('[data-activity-history-permission-group]') : null;
}

function getActivityHistoryPermissionInput(form) {
  return form ? form.querySelector('[data-view-activity-history]') : null;
}

function getRenewalDocumentEditPermissionGroup(form) {
  return form ? form.querySelector('[data-renewal-document-edit-permission-group]') : null;
}

function getRenewalDocumentEditPermissionInput(form) {
  return form ? form.querySelector('[data-edit-renewal-documents]') : null;
}

function getFormRoleValue(form) {
  const roleField = form ? form.querySelector('[name="role"]') : null;
  return getNormalizedRole(roleField ? roleField.value : 'user');
}

function syncReferencePermissionControl(form) {
  const group = getReferencePermissionGroup(form);
  const input = getReferencePermissionInput(form);
  if (!group || !input) return;

  const role = getFormRoleValue(form);
  if (role === 'admin' || role === 'supersecretary' || role === 'secretary') {
    input.checked = true;
    input.disabled = true;
    group.classList.add('hidden');
    return;
  }

  input.checked = false;
  input.disabled = true;
  group.classList.add('hidden');
}

function syncDashboardCustomizationPermissionControl(form) {
  const group = getDashboardCustomizationPermissionGroup(form);
  const input = getDashboardCustomizationPermissionInput(form);
  if (!group || !input) return;
  const role = getFormRoleValue(form);
  group.classList.remove('hidden');
  if (role === 'admin') {
    input.checked = true;
    input.disabled = true;
    return;
  }
  input.disabled = false;
}

function syncActivityHistoryPermissionControl(form) {
  const group = getActivityHistoryPermissionGroup(form);
  const input = getActivityHistoryPermissionInput(form);
  if (!group || !input) return;

  if (!isAdminUser(activeSession && activeSession.user)) {
    input.checked = false;
    input.disabled = true;
    group.classList.add('hidden');
    return;
  }

  group.classList.remove('hidden');
  const role = getFormRoleValue(form);
  if (role === 'admin') {
    input.checked = true;
    input.disabled = true;
    return;
  }
  if (input.disabled) input.checked = false;
  input.disabled = false;
}

function syncRenewalDocumentEditPermissionControl(form) {
  const group = getRenewalDocumentEditPermissionGroup(form);
  const input = getRenewalDocumentEditPermissionInput(form);
  if (!group || !input) return;

  group.classList.remove('hidden');
  const role = getFormRoleValue(form);
  if (role === 'admin' || role === 'supersecretary') {
    input.checked = true;
    input.disabled = true;
    return;
  }
  if (input.disabled) input.checked = false;
  input.disabled = false;
}

function readFormPermissions(form) {
  const role = getFormRoleValue(form);
  const customizeInput = getDashboardCustomizationPermissionInput(form);
  const activityHistoryInput = getActivityHistoryPermissionInput(form);
  const renewalDocumentEditInput = getRenewalDocumentEditPermissionInput(form);
  return {
    manageReferenceData: role === 'admin' || role === 'supersecretary' || role === 'secretary',
    customizeDashboardApps: role === 'admin' || Boolean(customizeInput && customizeInput.checked),
    viewActivityHistory: role === 'admin' || Boolean(
      isAdminUser(activeSession && activeSession.user)
      && activityHistoryInput
      && activityHistoryInput.checked
    ),
    editRenewalDocuments: role === 'admin' || role === 'supersecretary' || Boolean(
      renewalDocumentEditInput
      && renewalDocumentEditInput.checked
    )
  };
}

function populateReferencePermissionControl(form, user) {
  const input = getReferencePermissionInput(form);
  const permissions = normalizeUserPermissions(user);
  if (input) {
    input.checked = Boolean(permissions.manageReferenceData);
    syncReferencePermissionControl(form);
  }
  const customizeInput = getDashboardCustomizationPermissionInput(form);
  if (customizeInput) {
    customizeInput.checked = Boolean(permissions.customizeDashboardApps);
    syncDashboardCustomizationPermissionControl(form);
  }
  const activityHistoryInput = getActivityHistoryPermissionInput(form);
  if (activityHistoryInput) {
    activityHistoryInput.checked = Boolean(permissions.viewActivityHistory);
    syncActivityHistoryPermissionControl(form);
  }
  const renewalDocumentEditInput = getRenewalDocumentEditPermissionInput(form);
  if (renewalDocumentEditInput) {
    renewalDocumentEditInput.checked = Boolean(permissions.editRenewalDocuments);
    syncRenewalDocumentEditPermissionControl(form);
  }
}

function updateSectorSummary(form, confirmed) {
  const summaryEl = form ? form.querySelector('[data-sector-summary]') : null;
  const role = getFormRoleValue(form);
  let sectors = collectSelectedSectors(form);

  if (role === 'admin' || role === 'supersecretary' || role === 'secretary') {
    sectors = [ADMIN_SECTOR_VALUE];
    confirmed = true;
  }

  const hasSelection = sectors.length > 0;
  const finalConfirmed = Boolean(confirmed && (hasSelection || role === 'admin' || role === 'supersecretary' || role === 'secretary'));

  if (form && form.dataset) {
    form.dataset.sectorsConfirmed = finalConfirmed ? 'true' : 'false';
  }

  if (summaryEl) {
    let summaryText = '';
    if (role === 'admin') {
      summaryText = 'سيتم تعيين قطاع الإدارة تلقائيًا للمسؤول.';
    } else if (role === 'supersecretary') {
      summaryText = 'سيتم تعيين قطاع الإدارة تلقائيًا للسيكرتير الأول.';
    } else if (role === 'secretary') {
      summaryText = 'سيتم تعيين قطاع الإدارة تلقائيًا للسكرتير.';
    } else if (!hasSelection) {
      summaryText = 'اختر قطاعًا واحدًا أو أكثر ثم اضغط على زر "تأكيد القطاعات".';
    } else if (finalConfirmed) {
      summaryText = `القطاعات المسموح بها: ${formatSectorDisplay(sectors)}.`;
    } else {
      summaryText = `تم اختيار: ${formatSectorDisplay(sectors)} — يرجى الضغط على "تأكيد القطاعات" للحفظ.`;
    }
    summaryEl.textContent = summaryText;
    summaryEl.dataset.state = finalConfirmed ? 'confirmed' : 'pending';
  }

  syncStationChecklist(form, { role, sectors, confirmed: finalConfirmed });

  return { sectors, confirmed: finalConfirmed };
}

function handleSectorConfirmation(form) {
  const role = getFormRoleValue(form);
  const { sectors, confirmed } = updateSectorSummary(form, true);
  const messageEl = getFormMessageElement(form);

  if (role === 'user' && (!confirmed || !sectors.length)) {
    if (messageEl) {
      showStatusMessage(messageEl, 'يرجى اختيار قطاع واحد على الأقل ثم الضغط على "تأكيد القطاعات".', 'error');
    } else {
      window.alert('يرجى اختيار قطاع واحد على الأقل ثم الضغط على "تأكيد القطاعات".');
    }
    return false;
  }

  if (messageEl) {
    if (role === 'admin') {
      showStatusMessage(messageEl, 'تم تعيين قطاع الإدارة تلقائيًا للمسؤول.', 'info');
    } else if (role === 'supersecretary') {
      showStatusMessage(messageEl, 'تم تعيين قطاع الإدارة تلقائيًا للسيكرتير الأول.', 'info');
    } else if (role === 'secretary') {
      showStatusMessage(messageEl, 'تم تعيين قطاع الإدارة تلقائيًا للسكرتير.', 'info');
    } else {
      showStatusMessage(messageEl, 'تم تأكيد القطاعات المختارة.', 'success');
    }
  }

  return true;
}

function setupSectorConfirmation(form) {
  if (!form) return;
  const checklist = getSectorChecklistContainer(form);
  const confirmBtn = form.querySelector('[data-action="confirm-sectors"]');
  const markPending = () => {
    if (form.dataset) {
      form.dataset.sectorsConfirmed = 'false';
    }
    const sectors = collectSelectedSectors(form);
    const current = normalizeStationSelection(sectors, getStoredStationSelection(form));
    setStoredStationSelection(form, current);
    updateSectorSummary(form, false);
  };

  if (checklist && !checklist.dataset.sectorListenerBound) {
    checklist.addEventListener('change', (event) => {
      if (event.target && event.target.matches('[data-sector-checkbox]')) {
        markPending();
      }
    });
    checklist.dataset.sectorListenerBound = 'true';
  }

  if (confirmBtn && !confirmBtn.dataset.sectorConfirmBound) {
    confirmBtn.addEventListener('click', (event) => {
      event.preventDefault();
      handleSectorConfirmation(form);
    });
    confirmBtn.dataset.sectorConfirmBound = 'true';
  }

  form.dataset.sectorsConfirmed = form.dataset.sectorsConfirmed === 'true' ? 'true' : 'false';
  updateSectorSummary(form, form.dataset.sectorsConfirmed === 'true');
}

async function loadUsers() {
  const tableBody = document.getElementById('usersTableBody');
  const placeholder = document.getElementById('usersTablePlaceholder');
  if (tableBody) tableBody.innerHTML = '';
  if (placeholder) placeholder.classList.remove('hidden');

  try {
    const response = await fetchWithAuth('/api/users', { method: 'GET' });
  if (!response.ok) throw new Error('فشل تحميل الأفراد');
    const data = await response.json();
  if (!Array.isArray(data.users)) throw new Error('قائمة أفراد غير صالحة');

    const availableApps = Array.isArray(data.apps) && data.apps.length
      ? data.apps
      : DEFAULT_APP_KEYS;
    cachedAvailableApps = availableApps;

    if (!tableBody) return;

    if (placeholder) placeholder.classList.add('hidden');

      const viewer = activeSession.user;
      const viewerCanEditUsers = canEditExistingUsers(viewer);
      tableBody.innerHTML = data.users
        .map((user) => {
          const protectedAdmin = isProtectedAdminEditForViewer(viewer, user);
          const roleLabel = getRoleDisplayText(user, 'short');
          const sectorLabel = escapeHtml(formatSectorDisplay(user.sectors || user.room) || '\u2014');
          const accountThemeStyle = buildAccountThemeStyle(user);
          const appsList = formatUserAppsList(user);
          const actions = viewerCanEditUsers && !protectedAdmin
            ? `
              <button class="btn small account-row-action" data-action="view">عرض</button>
              <button class="btn small account-row-action" data-action="edit">تحرير</button>
              <button class="btn small danger" data-action="delete">حذف</button>
            `
            : `
              <button class="btn small account-row-action" data-action="view">عرض</button>
            `;
          return `
          <tr data-username="${escapeHtml(user.username)}" style="${accountThemeStyle}">
            <td>${escapeHtml(user.username)}</td>
            <td>${escapeHtml(user.displayName || '\u2014')}</td>
            <td>${roleLabel}</td>
            <td>${sectorLabel}</td>
            <td class="user-apps-cell" title="${appsList}">
              <span class="user-apps-text">${appsList}</span>
            </td>
            <td class="actions-column">
              <div class="account-row-actions">
                ${actions}
              </div>
            </td>
          </tr>
        `;
        })
        .join('');

    setupUserTableActions(tableBody);
    renderNewUserAppToggles(cachedAvailableApps);
  } catch (error) {
    console.error('Failed to load users:', error);
    if (placeholder) {
      placeholder.classList.remove('hidden');
  placeholder.textContent = 'تعذر تحميل الأفراد.';
    }
  }
}

function setupUserTableActions(tableBody) {
  if (!tableBody) return;

  tableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const row = button.closest('tr');
    const username = row ? row.dataset.username : null;
    if (!username) return;

    const action = button.dataset.action;
    const viewerCanEditUsers = canEditExistingUsers(activeSession.user);
    if (!viewerCanEditUsers && action !== 'view') return;
    if (action === 'delete') {
      await deleteUser(username);
      return;
    }
    if (action === 'view') {
      await openUserViewer(username);
      return;
    }
    if (action === 'edit') {
      await openUserEditor(username);
      return;
    }
  });
}

async function deleteUser(username) {
  if (!window.confirm(`هل تريد حذف الفرد ${username}؟`)) return;
  try {
    const response = await fetchWithAuth(`/api/users/${encodeURIComponent(username)}`, {
      method: 'DELETE'
    });
  if (!response.ok) throw new Error('فشل حذف الفرد');
    await loadUsers();
  } catch (error) {
    console.error('Delete user failed:', error);
  window.alert('تعذر حذف الفرد');
  }
}

function buildUserAllowedApps(user) {
  if (!user) return [];
  const available = Array.isArray(cachedAvailableApps) && cachedAvailableApps.length
    ? cachedAvailableApps
    : DEFAULT_APP_KEYS;
  const allowedSet = new Set(available.filter(Boolean));

  if (hasFullAppAccess(user)) {
    return Array.from(allowedSet);
  }

  const apps = Array.isArray(user.allowedApps) ? user.allowedApps : [];
  return apps
    .filter((key) => allowedSet.has(key))
    .filter((key) => key !== 'settings');
}

function formatUserAppsList(user) {
  const apps = buildUserAllowedApps(user);
  if (!apps.length) return '—';
  return apps
    .map((key) => APP_LABELS[key] || key)
    .map((label) => escapeHtml(label))
    .join(', ');
}

function renderUserDetailsPanel(user) {
  if (!user) return;
  const panel = document.getElementById('viewUserPanel');
  const body = document.getElementById('viewUserContent');
  if (!panel || !body) return;
  applySettingsAccountPanelTheme(panel, user);

  const allowedApps = buildUserAllowedApps(user);
  const appsMarkup = allowedApps.length
    ? allowedApps
        .map((key) => `<li class="app-pill">${escapeHtml(APP_LABELS[key] || key)}</li>`)
        .join('')
    : '<li class="app-pill empty">لا توجد تطبيقات مفعلة</li>';

  const createdAt = formatDateTime(user.createdAt);
  const lastLogin = formatDateTime(user.lastLogin);
  const sectorDisplay = formatSectorDisplay(user.sectors || user.room) || '—';
  const assignedSectors = Array.isArray(user.sectors) && user.sectors.length
    ? user.sectors
    : user.room
      ? [user.room]
      : [];
  const stationAccessDisplay = formatStationAccessDisplay(user.stationAccess, assignedSectors);
  const stationMarkup = stationAccessDisplay.length
    ? stationAccessDisplay
        .map((entry) => {
          const stationsLabel = entry.stations.length
            ? entry.stations.map((station) => escapeHtml(station)).join('، ')
            : escapeHtml('جميع الأقسام');
          return `
            <li class="station-access-item">
              <span class="station-access-sector">${escapeHtml(entry.sectorLabel)}</span>
              <span class="station-access-names">${stationsLabel}</span>
            </li>
          `;
        })
        .join('')
    : '<li class="station-access-item station-empty">الوصول مفتوح لكل الأقسام داخل القطاعات المُحددة.</li>';

  const roleKey = getNormalizedRole(user);
  const roleShort = getRoleDisplayText(user, 'short');
  const roleDetail = getRoleDisplayText(user, 'detail');
  const roleBadgeClass = roleKey === 'admin'
    ? 'is-admin'
    : roleKey === 'supersecretary' || roleKey === 'secretary'
      ? 'is-secretary'
      : '';

  body.innerHTML = `
    <div class="user-view-summary">
      <div class="user-view-name">
        <h3>${escapeHtml(user.displayName || user.username || '—')}</h3>
        <span class="user-view-username">@${escapeHtml(user.username || '—')}</span>
      </div>
      <span class="user-view-role ${roleBadgeClass}">
        ${roleShort}
      </span>
    </div>
    <dl class="user-detail-list">
      <div class="detail-row">
        <dt>الدور</dt>
        <dd>${roleDetail}</dd>
      </div>
      <div class="detail-row">
        <dt>القطاع</dt>
        <dd>${escapeHtml(sectorDisplay)}</dd>
      </div>
      <div class="detail-row">
        <dt>تاريخ الإنشاء</dt>
        <dd>${createdAt}</dd>
      </div>
      <div class="detail-row">
        <dt>آخر تسجيل دخول</dt>
        <dd>${lastLogin}</dd>
      </div>
    </dl>
    <div class="user-view-apps">
      <h4>التطبيقات المسموحة</h4>
      <ul class="app-pills">
        ${appsMarkup}
      </ul>
    </div>
    <div class="user-view-stations">
      <h4>الأقسام المتاحة</h4>
      <ul class="station-access-list">
        ${stationMarkup}
      </ul>
    </div>
  `;

  panel.classList.add('visible');
  panel.setAttribute('aria-hidden', 'false');
}

function applySecretaryReadOnlyMode({ allowReferenceEditing = false } = {}) {
  document.body.classList.add('settings-readonly');
  document.body.classList.add('settings-reference-only');

  const summaryCard = document.querySelector('.settings-summary');
  if (summaryCard) {
    summaryCard.classList.add('hidden');
    summaryCard.setAttribute('aria-hidden', 'true');
  }

  const newUserCard = document.querySelector('.new-user-card');
  if (newUserCard) {
    newUserCard.classList.add('hidden');
    newUserCard.setAttribute('aria-hidden', 'true');
  }

  const newUserForm = document.getElementById('newUserForm');
  if (newUserForm) {
    newUserForm.setAttribute('aria-hidden', 'true');
    newUserForm.querySelectorAll('input, select, button').forEach((element) => {
      element.setAttribute('disabled', 'disabled');
    });
  }

  const editPanel = document.getElementById('editUserPanel');
  if (editPanel) {
    editPanel.classList.add('hidden');
  }

  const futureControls = document.getElementById('existingUserControls');
  if (futureControls) {
    futureControls.classList.add('hidden');
  }

  const appCatalogCard = document.getElementById('appCatalogCard');
  if (appCatalogCard) {
    appCatalogCard.classList.add('hidden');
    appCatalogCard.setAttribute('aria-hidden', 'true');
  }

  const actionApprovalPolicyCard = document.getElementById('actionApprovalPolicyCard');
  if (actionApprovalPolicyCard) {
    actionApprovalPolicyCard.classList.add('hidden');
    actionApprovalPolicyCard.setAttribute('aria-hidden', 'true');
  }

  const referenceDataCard = document.getElementById('referenceDataCard');
  if (referenceDataCard && !allowReferenceEditing) {
    referenceDataCard.classList.add('hidden');
    referenceDataCard.setAttribute('aria-hidden', 'true');
  }

  const usersCard = document.querySelector('.users-table-card');
  if (usersCard) {
    usersCard.classList.add('hidden');
    usersCard.setAttribute('aria-hidden', 'true');
  }
}

async function openUserViewer(username) {
  try {
    const response = await fetchWithAuth(`/api/users/${encodeURIComponent(username)}`, {
      method: 'GET'
    });
  if (!response.ok) throw new Error('فشل تحميل بيانات الفرد');
    const data = await response.json();
    renderUserDetailsPanel(data.user);
  } catch (error) {
    console.error('Open user viewer failed:', error);
  window.alert('تعذر تحميل بيانات الفرد');
  }
}

function closeViewPanel() {
  const panel = document.getElementById('viewUserPanel');
  if (panel) {
    panel.classList.remove('visible');
    panel.setAttribute('aria-hidden', 'true');
  }
}

async function openUserEditor(username) {
  try {
    const response = await fetchWithAuth(`/api/users/${encodeURIComponent(username)}`, {
      method: 'GET'
    });
  if (!response.ok) throw new Error('فشل تحميل بيانات الفرد');
    const data = await response.json();
    if (isProtectedAdminEditForViewer(activeSession.user, data.user)) {
      window.alert('لا يمكن تحرير حساب مدير آخر');
      return;
    }
    populateEditForm(data.user);
  } catch (error) {
    console.error('Open user editor failed:', error);
  window.alert('تعذر تحميل بيانات الفرد');
  }
}

function consumePendingDashboardEditUser() {
  let storedUsername = '';
  try {
    storedUsername = sessionStorage.getItem('general.pendingEditUser') || '';
    sessionStorage.removeItem('general.pendingEditUser');
  } catch (_) {}

  let queryUsername = '';
  try {
    queryUsername = new URLSearchParams(window.location.search || '').get('edit') || '';
  } catch (_) {}

  return String(queryUsername || storedUsername || '').trim();
}

async function openPendingDashboardEditUser() {
  const username = consumePendingDashboardEditUser();
  if (!username) return;
  await openUserEditor(username);
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('edit');
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  } catch (_) {}
}

function populateEditForm(user) {
  if (!user) return;
  const form = document.getElementById('editUserForm');
  if (!form) return;
  form.dataset.username = user.username;

  const displayNameField = form.querySelector('[name="displayName"]');
  const roleField = form.querySelector('[name="role"]');
  const togglesContainer = form.querySelector('.toggle-grid');
  const passwordField = form.querySelector('[name="password"]');
  const passwordConfirmField = form.querySelector('[name="passwordConfirm"]');

  if (displayNameField) displayNameField.value = user.displayName || '';
  const roleValue = getNormalizedRole(user);
  if (roleField) roleField.value = roleValue;
  if (passwordField) passwordField.value = '';
  if (passwordConfirmField) passwordConfirmField.value = '';
  if (form.dataset) {
    form.dataset.sectorsConfirmed = 'true';
  }
  const selectedSectors = Array.isArray(user.sectors) && user.sectors.length
    ? user.sectors
    : user.room
      ? [user.room]
      : [];
  renderSectorCheckboxes(getSectorChecklistContainer(form), selectedSectors);
  const initialStations = normalizeStationSelection(selectedSectors, user.stationAccess || user.stations);
  setStoredStationSelection(form, initialStations);
  configureRoleSectorInteraction(form);
  populateReferencePermissionControl(form, user);
  updateSectorSummary(form, true);

  if (togglesContainer) {
    togglesContainer.innerHTML = cachedAvailableApps
      .filter((app) => app !== 'settings')
      .map((app) => {
        const label = APP_LABELS[app] || app;
        const checked = hasFullAppAccess(user) || isAppAllowed(user, app) ? 'checked' : '';
        return `\n          <label class="toggle">\n            <input type="checkbox" value="${escapeHtml(app)}" ${checked} />\n            <span>${escapeHtml(label)}</span>\n          </label>\n        `;
      })
      .join('');
    syncAdminAppSelectionForForm(form);
  }

  document.getElementById('editUserPanel').classList.add('visible');
  applySettingsAccountPanelTheme(document.getElementById('editUserPanel'), user);
}

async function submitEditUserForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const username = form.dataset.username;
  if (!username) return;

  const messageEl = getFormMessageElement(form);
  const notifyError = (text) => {
    if (messageEl) {
      showStatusMessage(messageEl, text, 'error');
    } else {
      window.alert(text);
    }
  };

  const formData = new FormData(form);
  const role = formData.get('role') || 'user';
  const normalizedRole = getNormalizedRole(role);
  let sectors = Array.from(new Set(collectSelectedSectors(form)));
  const isConfirmed = form.dataset && form.dataset.sectorsConfirmed === 'true';
  const passwordValue = (formData.get('password') || '').trim();
  const passwordConfirm = (formData.get('passwordConfirm') || '').trim();

  if (passwordValue || passwordConfirm) {
    if (passwordValue !== passwordConfirm) {
      notifyError('كلمتا المرور غير متطابقتين');
      return;
    }
    if (passwordValue.length < MIN_PASSWORD_LENGTH) {
      notifyError(`كلمة المرور يجب أن تحتوي على ${MIN_PASSWORD_LENGTH} رموز على الأقل`);
      return;
    }
  }

  if (normalizedRole === 'admin' || normalizedRole === 'supersecretary' || normalizedRole === 'secretary') {
    sectors = [ADMIN_SECTOR_VALUE];
  } else if (!sectors.length) {
  notifyError('يرجى اختيار قطاع واحد على الأقل للفرد');
    return;
  } else if (!sectors.every((value) => ALL_SECTOR_VALUES.includes(value))) {
    notifyError('تم اختيار قطاع غير معروف');
    return;
  } else if (!isConfirmed) {
    updateSectorSummary(form, false);
    notifyError('يرجى الضغط على زر "تأكيد القطاعات" قبل حفظ التغييرات.');
    return;
  }

  let stationAccess = {};
  if (normalizedRole === 'user') {
    const selections = collectStationSelections(form);
    stationAccess = normalizeStationSelection(sectors, selections);
  }

  let allowedApps = collectCheckedValues(form.querySelector('.toggle-grid'));
  if (normalizedRole === 'admin') {
    allowedApps = DEFAULT_APP_KEYS.slice();
  }

  const payload = {
    displayName: formData.get('displayName') || '',
    sectors,
    room: sectors[0] || '',
    role: normalizedRole,
    allowedApps,
    stationAccess,
    permissions: readFormPermissions(form)
  };

  if (passwordValue) {
    payload.password = passwordValue;
  }

  try {
    const response = await fetchWithAuth(`/api/users/${encodeURIComponent(username)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  if (!response.ok) throw new Error('فشل تحديث الفرد');

    document.getElementById('editUserPanel').classList.remove('visible');
    updateSectorSummary(form, true);
    if (form.querySelector('[name="password"]')) {
      form.querySelector('[name="password"]').value = '';
    }
    if (form.querySelector('[name="passwordConfirm"]')) {
      form.querySelector('[name="passwordConfirm"]').value = '';
    }
    await loadUsers();
  } catch (error) {
    console.error('Edit user failed:', error);
    if (messageEl) {
      showStatusMessage(messageEl, 'تعذر حفظ التعديلات، يرجى إعادة المحاولة.', 'error');
    } else {
      window.alert('تعذر حفظ التعديلات');
    }
  }
}

function closeEditPanel() {
  const panel = document.getElementById('editUserPanel');
  if (panel) {
    panel.classList.remove('visible');
  }
}

async function registerUser(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const messageEl = getFormMessageElement(form) || document.getElementById('newUserMessage');

  const formData = new FormData(form);
  const username = (formData.get('username') || '').trim();
  const password = (formData.get('password') || '').trim();
  const displayName = (formData.get('displayName') || '').trim();
  const role = formData.get('role') || 'user';
  const normalizedRole = getNormalizedRole(role);
  let sectors = Array.from(new Set(collectSelectedSectors(form)));
  let allowedApps = collectCheckedValues(document.getElementById('newUserAppToggles'));
  const isConfirmed = form.dataset && form.dataset.sectorsConfirmed === 'true';

  if (!username || !password) {
    showStatusMessage(messageEl, 'اسم المستخدم وكلمة المرور مطلوبان', 'error');
    return;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    showStatusMessage(messageEl, `كلمة المرور يجب أن تحتوي على ${MIN_PASSWORD_LENGTH} رموز على الأقل`, 'error');
    return;
  }

  if (!canCreateRole(activeSession.user, normalizedRole)) {
    showStatusMessage(messageEl, 'لا يمكن لهذا الدور إنشاء هذا النوع من الحسابات', 'error');
    return;
  }

  if (normalizedRole === 'admin' || normalizedRole === 'supersecretary' || normalizedRole === 'secretary') {
    sectors = [ADMIN_SECTOR_VALUE];
    if (normalizedRole === 'admin') {
      allowedApps = DEFAULT_APP_KEYS.slice();
    }
  } else if (!sectors.length) {
  showStatusMessage(messageEl, 'يرجى اختيار قطاع واحد على الأقل للفرد', 'error');
    return;
  } else if (!sectors.every((value) => ALL_SECTOR_VALUES.includes(value))) {
    showStatusMessage(messageEl, 'تم اختيار قطاع غير معروف', 'error');
    return;
  } else if (!isConfirmed) {
    updateSectorSummary(form, false);
  showStatusMessage(messageEl, 'يرجى الضغط على زر "تأكيد القطاعات" قبل حفظ الفرد.', 'error');
    return;
  }

  let stationAccess = {};
  if (normalizedRole === 'user') {
    const selections = collectStationSelections(form);
    stationAccess = normalizeStationSelection(sectors, selections);
  }

  form.classList.add('is-loading');
  showStatusMessage(messageEl, 'جاري إنشاء الفرد...', 'info');

  try {
    const response = await fetchWithAuth('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        displayName,
        role: normalizedRole,
        allowedApps,
        sectors,
        room: sectors[0] || '',
        stationAccess,
        permissions: readFormPermissions(form)
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'فشل إنشاء الفرد');

    form.reset();
    const newChecklist = getSectorChecklistContainer(form);
    renderSectorCheckboxes(newChecklist, []);
    configureRoleSectorInteraction(form);
    form.dataset.sectorsConfirmed = 'false';
    setStoredStationSelection(form, {});
    populateReferencePermissionControl(form, { role: 'user', permissions: {} });
    updateSectorSummary(form, false);
    renderNewUserAppToggles(allowedApps.length ? cachedAvailableApps : DEFAULT_APP_KEYS);
    showStatusMessage(messageEl, 'تم إنشاء الفرد بنجاح', 'success');
    await loadUsers();
  } catch (error) {
    console.error('Create user failed:', error);
    showStatusMessage(messageEl, error.message || 'تعذر إنشاء الفرد', 'error');
  } finally {
    form.classList.remove('is-loading');
  }
}

async function initSettingsPage() {
  const session = await ensureAuthenticated();
  if (!session) return;

  await loadAppCatalog();

  const { user } = session;
  const viewerIsAdmin = isAdminUser(user);
  const viewerHasManagementRole = hasManagementRole(user);
  const viewerCanCustomizeDashboard = canCustomizeDashboardApps(user);
  if (!viewerHasManagementRole && !viewerCanCustomizeDashboard) {
  window.alert('صفحة الإعدادات غير متاحة لهذا الحساب');
    redirectToLogin();
    return;
  }

  renderUserSummary(user);
  await setupModeToggle();
  wireProfileLinks();
  const viewerIsSecretary = isSecretaryUser(user);
  const viewerCanCreateUsers = canCreateManagedUsers(user);
  const viewerCanEditUsers = canEditExistingUsers(user);
  const viewerCanManageAppCatalog = canManageAppCatalog(user);
  const viewerCanManageReferenceData = canManageReferenceData(user);
  const appCatalogCard = document.getElementById('appCatalogCard');
  const actionApprovalPolicyCard = document.getElementById('actionApprovalPolicyCard');
  const dashboardVisibilityCard = document.getElementById('dashboardVisibilityCard');

  if (viewerCanCustomizeDashboard) {
    renderDashboardVisibilityEditor(user);
    bindDashboardVisibilityEditor();
  } else if (dashboardVisibilityCard) {
    dashboardVisibilityCard.classList.add('hidden');
    dashboardVisibilityCard.setAttribute('aria-hidden', 'true');
  }

  if (!viewerHasManagementRole) {
    document.querySelectorAll('.settings-layout > section').forEach((section) => {
      if (section === dashboardVisibilityCard) return;
      section.classList.add('hidden');
      section.setAttribute('aria-hidden', 'true');
    });
    return;
  }

  if (!viewerCanManageAppCatalog && appCatalogCard) {
    appCatalogCard.classList.add('hidden');
    appCatalogCard.setAttribute('aria-hidden', 'true');
  }

  if (!viewerIsAdmin && actionApprovalPolicyCard) {
    actionApprovalPolicyCard.classList.add('hidden');
    actionApprovalPolicyCard.setAttribute('aria-hidden', 'true');
  }

  if (viewerIsSecretary) {
    applySecretaryReadOnlyMode({ allowReferenceEditing: viewerCanManageReferenceData });
  } else if (viewerCanManageAppCatalog) {
    renderAppCatalogEditor();
    if (viewerCanCreateUsers) {
      renderNewUserAppToggles();
    }
    const saveCatalogBtn = document.getElementById('saveAppCatalogBtn');
    if (saveCatalogBtn && !saveCatalogBtn.dataset.bound) {
      saveCatalogBtn.addEventListener('click', () => { void saveAppCatalogChanges(); });
      saveCatalogBtn.dataset.bound = 'true';
    }
  } else if (viewerCanCreateUsers) {
    renderNewUserAppToggles();
  }

  if (viewerIsAdmin && actionApprovalPolicyCard) {
    try {
      await loadActionApprovalPolicy();
      renderActionApprovalPolicyEditor();
    } catch (error) {
      console.error('Load action approval policy failed:', error);
      showStatusMessage(
        document.getElementById('actionApprovalPolicyMessage'),
        error.message || 'تعذر تحميل قيود الاعتماد',
        'error'
      );
    }
    const saveActionApprovalPolicyBtn = document.getElementById('saveActionApprovalPolicyBtn');
    if (saveActionApprovalPolicyBtn && !saveActionApprovalPolicyBtn.dataset.bound) {
      saveActionApprovalPolicyBtn.addEventListener('click', () => { void saveActionApprovalPolicyChanges(); });
      saveActionApprovalPolicyBtn.dataset.bound = 'true';
    }
  }

  if (viewerIsAdmin || viewerCanManageReferenceData) {
    await loadReferenceDataEditor({ editable: true });
    const saveReferenceBtn = document.getElementById('saveReferenceDataBtn');
    if (saveReferenceBtn && !saveReferenceBtn.dataset.bound) {
      saveReferenceBtn.addEventListener('click', () => { void saveReferenceDataChanges(); });
      saveReferenceBtn.dataset.bound = 'true';
    }
  } else {
    setReferenceDataCardVisibility(false);
  }

  if (!viewerIsSecretary) {
    await loadUsers();
  }

  if (viewerCanCreateUsers) {
    const newUserForm = document.getElementById('newUserForm');
    if (newUserForm) {
      applyRoleCreationOptions(newUserForm, user);
      renderSectorCheckboxes(getSectorChecklistContainer(newUserForm), []);
      setStoredStationSelection(newUserForm, {});
      configureRoleSectorInteraction(newUserForm);
      populateReferencePermissionControl(newUserForm, { role: 'user', permissions: {} });
      newUserForm.dataset.sectorsConfirmed = 'false';
      setupSectorConfirmation(newUserForm);
      newUserForm.addEventListener('submit', registerUser);
    }
  } else {
    const newUserCard = document.querySelector('.new-user-card');
    if (newUserCard) {
      newUserCard.classList.add('hidden');
      newUserCard.setAttribute('aria-hidden', 'true');
    }
  }

  if (viewerCanEditUsers) {
    const editUserForm = document.getElementById('editUserForm');
    if (editUserForm) {
      renderSectorCheckboxes(getSectorChecklistContainer(editUserForm), []);
      setStoredStationSelection(editUserForm, {});
      configureRoleSectorInteraction(editUserForm);
      populateReferencePermissionControl(editUserForm, { role: 'user', permissions: {} });
      editUserForm.dataset.sectorsConfirmed = 'false';
      setupSectorConfirmation(editUserForm);
      editUserForm.addEventListener('submit', submitEditUserForm);
    }
    await openPendingDashboardEditUser();
  } else {
    const editPanel = document.getElementById('editUserPanel');
    if (editPanel) {
      editPanel.classList.add('hidden');
    }
  }

  const closeEditBtn = document.getElementById('closeEditPanel');
  if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditPanel);

  const closeViewBtn = document.getElementById('closeViewPanel');
  if (closeViewBtn) closeViewBtn.addEventListener('click', closeViewPanel);

  const closeReferenceDataBtn = document.getElementById('closeReferenceDataPanel');
  if (closeReferenceDataBtn) closeReferenceDataBtn.addEventListener('click', closeReferenceDataPanel);

  const viewPanel = document.getElementById('viewUserPanel');
  if (viewPanel) {
    viewPanel.addEventListener('click', (event) => {
      if (event.target === viewPanel) {
        closeViewPanel();
      }
    });
  }

  const referenceDataPanel = document.getElementById('referenceDataPanel');
  if (referenceDataPanel) {
    referenceDataPanel.addEventListener('click', (event) => {
      if (event.target === referenceDataPanel) {
        closeReferenceDataPanel();
      }
    });
  }

  const editPanel = document.getElementById('editUserPanel');
  if (editPanel) {
    editPanel.addEventListener('click', (event) => {
      if (event.target === editPanel) {
        closeEditPanel();
      }
    });
  }

  const refreshBtn = document.getElementById('refreshUsers');
  if (refreshBtn) refreshBtn.addEventListener('click', loadUsers);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const editPanel = document.getElementById('editUserPanel');
      if (editPanel && editPanel.classList.contains('visible')) {
        closeEditPanel();
      }
      const viewPanelEl = document.getElementById('viewUserPanel');
      if (viewPanelEl && viewPanelEl.classList.contains('visible')) {
        closeViewPanel();
      }
    }
  });
}

async function detectPageAndInit() {
  try {
    await loadThemePreference();
  } catch (error) {
    console.warn('Theme initialization failed:', error);
  }

  const path = (window.location.pathname || '').toLowerCase();
  if (path.endsWith('/index.html') || path.endsWith('/') || path === '/login') {
    await initLoginPage();
    return;
  }
  if (path.endsWith('/main.html')) {
    await initMainPage();
    return;
  }
  if (path.endsWith('/profile.html')) {
    await initProfilePage();
    return;
  }
  if (path.endsWith('/settings.html')) {
    await initSettingsPage();
    return;
  }
  await ensureAuthenticated({ redirect: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    detectPageAndInit().catch((error) => {
      console.error('Initialization failed:', error);
    });
  });
} else {
  detectPageAndInit().catch((error) => {
    console.error('Initialization failed:', error);
  });
}
