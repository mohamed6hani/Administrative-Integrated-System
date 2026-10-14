'use strict';

const STORAGE_KEYS = {
  token: 'general.auth.token',
  user: 'general.auth.user'
};

const APP_CONFIG_ENDPOINT = '/api/app-config';
const GLOBAL_SEARCH_API_ENDPOINT = '/api/global-search';
const GLOBAL_SEARCH_APP_ORDER = ['weapons', 'renewal', 'report', 'accept', 'request', 'seized', 'storage', 'company'];
const ACTIVITY_API_ENDPOINTS = {
  roster: '/api/activity/roster',
  allLogs: (cursor = '', limit = 100, query = '', username = '') => `/api/activity/logs?limit=${encodeURIComponent(limit)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}${query ? `&query=${encodeURIComponent(query)}` : ''}${username ? `&username=${encodeURIComponent(username)}` : ''}`,
  userLogs: (username, limit = 120) => `/api/activity/users/${encodeURIComponent(username)}/logs?limit=${encodeURIComponent(limit)}`
};
const DELETE_APPROVAL_API_ENDPOINTS = {
  pending: '/api/delete-approvals/pending',
  approve: (id) => `/api/delete-approvals/${encodeURIComponent(id)}/approve`,
  deny: (id) => `/api/delete-approvals/${encodeURIComponent(id)}/deny`,
  approveItem: (id, itemId) => `/api/delete-approvals/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/approve`,
  denyItem: (id, itemId) => `/api/delete-approvals/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/deny`
};
const DELETE_APPROVAL_INSPECT_STORAGE_KEY = 'general.deleteApprovalInspectTarget';
const GLOBAL_SEARCH_RETURN_STORAGE_KEY = 'general.globalSearchReturnState';
const WEAPONS_SHEET_FOCUS_STORAGE_KEY = 'weaponsSheetFocus';
const DELETE_APPROVAL_INSPECT_URLS = {
  weapons: '/weapons/sheet.html',
  renewal: '/renewal/sheet.html',
  report: '/report/index.html',
  accept: '/accept/index.html',
  request: '/request/index.html',
  seized: '/seized/index.html',
  storage: '/storage/index.html',
  company: '/company/index.html'
};
const ACTIVITY_STRIP_POLL_MS = 15000;
const THEME_VALUES = { LIGHT: 'light' };
const ADMIN_SECTOR_VALUE = 'الإدارة';

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
const ROLE_DISPLAY_LABELS = {
  admin: { short: 'مدير', badge: 'مدير النظام', detail: 'مدير النظام' },
  supersecretary: { short: 'سيكرتير اول', badge: 'سيكرتير اول', detail: 'سيكرتير اول' },
  secretary: { short: 'سكرتير', badge: 'سكرتير', detail: 'سكرتير' },
  user: { short: 'فرد', badge: 'فرد', detail: 'فرد' }
};
const ACTIVITY_STATUS_META = {
  online: { key: 'online', className: 'is-online', label: 'متصل الآن', fallbackSubtitle: 'متصل الآن', timeLabel: 'آخر نشاط' },
  inactive: { key: 'inactive', className: 'is-inactive', label: 'متصل لكن غير نشط', fallbackSubtitle: 'الجلسة ما زالت مفتوحة', timeLabel: 'آخر نشاط' },
  offline: { key: 'offline', className: 'is-offline', label: 'غير متصل', fallbackSubtitle: 'غير متصل حالياً', timeLabel: 'آخر دخول' }
};
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

const GLOBAL_SEARCH_STATION_TO_SECTOR = {
  east: 'شرق',
  west: 'غرب',
  south: 'جنوب',
  north: 'شمال',
  sectorfive: 'القطاع التجريبي الخامس',
};
const GLOBAL_SEARCH_STATION_SECTORS = {
  'مكتب تجريبي 01': 'شرق', 'مكتب تجريبي 02': 'شرق', 'مكتب تجريبي 03': 'شرق',
  'مكتب تجريبي 04': 'شرق', 'مكتب تجريبي 05': 'شرق', 'مكتب تجريبي 06': 'شرق', 'مكتب تجريبي 07': 'شرق',
  'مكتب تجريبي 08': 'شرق', 'مكتب تجريبي 09': 'شرق', 'مكتب تجريبي 10': 'شرق',
  'مكتب تجريبي 11': 'غرب', 'مكتب تجريبي 12': 'غرب', 'مكتب تجريبي 13': 'غرب', 'مكتب تجريبي 14': 'غرب',
  'مكتب تجريبي 15': 'غرب', 'مكتب تجريبي 16': 'غرب', 'مكتب تجريبي 17': 'غرب', 'مكتب تجريبي 18': 'غرب',
  'مكتب تجريبي 19': 'غرب',
  'مكتب تجريبي 20': 'جنوب', 'مكتب تجريبي 21': 'جنوب', 'مكتب تجريبي 22': 'جنوب', 'مكتب تجريبي 23': 'جنوب',
  'مكتب تجريبي 24': 'جنوب', 'مكتب تجريبي 25': 'جنوب', 'مكتب تجريبي 26': 'جنوب', 'مكتب تجريبي 27': 'جنوب',
  'مكتب تجريبي 28': 'جنوب', 'مكتب تجريبي 29': 'جنوب', 'مكتب تجريبي 30': 'جنوب',
  'مكتب تجريبي 31': 'شمال', 'مكتب تجريبي 32': 'شمال', 'مكتب تجريبي 33': 'شمال', 'مكتب تجريبي 34': 'شمال',
  'مكتب تجريبي 35': 'شمال', 'مكتب تجريبي 36': 'شمال', 'مكتب تجريبي 37': 'شمال', 'مكتب تجريبي 38': 'شمال',
  'مكتب تجريبي 39': 'شمال', 'مكتب تجريبي 40': 'شمال',
  'مكتب تجريبي 41': 'القطاع التجريبي الخامس', 'مكتب تجريبي 42': 'القطاع التجريبي الخامس',
  'مكتب تجريبي 43': 'القطاع التجريبي الخامس', 'مكتب تجريبي 44': 'القطاع التجريبي الخامس', 'مكتب تجريبي 45': 'القطاع التجريبي الخامس'
};

let activeSession = { token: null, user: null };
let profilePromise = null;
let appCatalogPromise = null;
let cachedAppCatalog = DEFAULT_APP_CATALOG.slice();
let currentTheme = THEME_VALUES.LIGHT;
let themeInitialized = false;
let activityStripPollHandle = null;
let currentActiveUsers = [];
let currentRosterUsers = [];
let currentRosterAccountColorOnly = false;
let currentActivityStripMode = 'hidden';
let allActivityCursor = '';
let allActivityHasMore = false;
let allActivityLoading = false;
let allActivityPanelOpen = false;
let allActivitySearchQuery = '';
let allActivityUserFilter = '';
let allActivityRequestGeneration = 0;
const allActivityKnownUsers = new Map();
let pendingDeleteApprovals = [];
let deleteApprovalPanelVisible = false;
let deleteApprovalPanelRequesterFilter = '';
let deleteApprovalPdfLibPromise = null;
let platformSearchResults = [];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getNormalizedRole(userOrRole) {
  const value = userOrRole && typeof userOrRole === 'object' ? userOrRole.role : userOrRole;
  const normalized = String(value || 'user').toLowerCase();
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

function isSuperSecretaryUser(user) {
  return getNormalizedRole(user) === 'supersecretary';
}

function canUseGlobalSearch(user) {
  return isAdminUser(user) || isSuperSecretaryUser(user);
}

function hasManagementRole(user) {
  const role = getNormalizedRole(user);
  return role === 'admin' || role === 'supersecretary' || role === 'secretary';
}

function canCustomizeDashboardApps(user) {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  const permissions = user.permissions && typeof user.permissions === 'object'
    ? user.permissions
    : {};
  return Boolean(permissions.customizeDashboardApps);
}

function canViewActivityHistory(user) {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  const permissions = user.permissions && typeof user.permissions === 'object'
    ? user.permissions
    : {};
  return Boolean(permissions.viewActivityHistory);
}

function canAccessSettings(user) {
  return hasManagementRole(user) || canCustomizeDashboardApps(user);
}

function getRoleDisplayText(user, variant = 'short') {
  const key = getNormalizedRole(user);
  const labels = ROLE_DISPLAY_LABELS[key] || ROLE_DISPLAY_LABELS.user;
  return labels[variant] || labels.short;
}

function isAppAllowed(user, appKey) {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  if (appKey === 'settings' && canAccessSettings(user)) return true;
  const list = Array.isArray(user.allowedApps) ? user.allowedApps : [];
  return list.includes(appKey);
}

function formatSectorDisplay(value) {
  const values = Array.isArray(value)
    ? value
    : (value ? [value] : []);
  const clean = Array.from(new Set(values.map((item) => String(item || '').trim()).filter(Boolean)));
  if (!clean.length) return '';
  if (clean.includes(ADMIN_SECTOR_VALUE)) return ADMIN_SECTOR_VALUE;
  return clean.join('، ');
}

function resolveGlobalSearchSectorFromStation(station) {
  const stationStr = String(station || '').trim();
  if (!stationStr) return '';
  return GLOBAL_SEARCH_STATION_SECTORS[stationStr] || '';
}

function loadStoredSession() {
  const token = sessionStorage.getItem(STORAGE_KEYS.token) || localStorage.getItem(STORAGE_KEYS.token);
  const rawUser = sessionStorage.getItem(STORAGE_KEYS.user) || localStorage.getItem(STORAGE_KEYS.user);
  if (!token || !rawUser) return null;
  try {
    const user = JSON.parse(rawUser);
    sessionStorage.setItem(STORAGE_KEYS.token, token);
    sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    activeSession = { token, user };
    return activeSession;
  } catch (_) {
    clearSessionStorage();
    return null;
  }
}

function setActiveSession(token, user) {
  if (!token || !user) {
    clearSessionStorage();
    return;
  }
  activeSession = { token, user };
  sessionStorage.setItem(STORAGE_KEYS.token, token);
  sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEYS.token, token);
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

function clearSessionStorage() {
  activeSession = { token: null, user: null };
  profilePromise = null;
  try {
    sessionStorage.removeItem(STORAGE_KEYS.token);
    sessionStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
  } catch (_) {}
}

function getToken() {
  if (activeSession.token) return activeSession.token;
  const stored = loadStoredSession();
  return stored ? stored.token : null;
}

function getUser() {
  if (activeSession.user) return activeSession.user;
  const stored = loadStoredSession();
  return stored ? stored.user : null;
}

function fetchWithAuth(url, options = {}) {
  const token = getToken();
  const opts = { ...options };
  opts.headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});
  if (token) opts.headers.Authorization = `Bearer ${token}`;
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
    } catch (error) {
      console.warn('Failed to refresh dashboard profile:', error);
    } finally {
      profilePromise = null;
    }
    clearSessionStorage();
    return null;
  })();
  return profilePromise;
}

async function ensureAuthenticated() {
  const session = loadStoredSession();
  if (!session) {
    redirectToLogin();
    return null;
  }
  const profile = await refreshProfile();
  if (!profile) redirectToLogin();
  return profile;
}

function redirectToLogin() {
  markActivityNavigation('redirect');
  window.location.href = 'index.html';
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
  const requestedMap = new Map(
    (Array.isArray(appCatalog) ? appCatalog : [])
      .map((entry) => normalizeAppCatalogEntry(entry))
      .filter(Boolean)
      .map((entry) => [entry.key, entry])
  );
  cachedAppCatalog = DEFAULT_APP_KEYS
    .map((key) => normalizeAppCatalogEntry(requestedMap.get(key), fallbackMap.get(key)))
    .filter(Boolean);
}

async function loadAppCatalog() {
  if (appCatalogPromise) return appCatalogPromise;
  appCatalogPromise = (async () => {
    try {
      const response = await fetchWithAuth(APP_CONFIG_ENDPOINT, { method: 'GET' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setAppCatalog(Array.isArray(data?.apps) ? data.apps : DEFAULT_APP_CATALOG);
    } catch (error) {
      console.warn('Failed to load dashboard app catalog:', error);
      setAppCatalog(DEFAULT_APP_CATALOG);
    } finally {
      appCatalogPromise = null;
    }
    return cachedAppCatalog;
  })();
  return appCatalogPromise;
}

function normalizeTheme() {
  return THEME_VALUES.LIGHT;
}

function setDocumentTheme(theme) {
  const normalized = normalizeTheme(theme);
  currentTheme = normalized;
  document.body.classList.remove('dark-mode');
  document.body.classList.add('light-mode');
  themeInitialized = true;
  return normalized;
}

async function loadThemePreference() {
  return themeInitialized ? currentTheme : setDocumentTheme(THEME_VALUES.LIGHT);
}

async function setupModeToggle() {
  await loadThemePreference();
}

function markActivityNavigation(reason = 'navigate') {
  try {
    if (window.__activityTracker && typeof window.__activityTracker.markNavigation === 'function') {
      window.__activityTracker.markNavigation(reason);
    }
  } catch (_) {}
}

function logDashboardClose(reason = 'logout') {
  try {
    if (window.__activityTracker && typeof window.__activityTracker.log === 'function') {
      void window.__activityTracker.log('page:leave', 'إغلاق اللوحة الرئيسية', {
        pageName: 'اللوحة الرئيسية',
        reason
      });
    }
  } catch (_) {}
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

function goToProfile() { markActivityNavigation('open-profile'); window.location.href = 'profile.html'; }
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

Object.assign(window, {
  goToProfile,
  goToWeapons,
  goToRenewal,
  goToReports,
  goToAccept,
  goToRequest,
  goToSeized,
  goToStorage,
  goToCompany,
  goToSettings
});

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
    const subMarkup = entry.sub ? `<span class="sub">${escapeHtml(entry.sub)}</span>` : '';
    return `
      <button type="button" class="app-card" data-app="${escapeHtml(entry.key)}"${adminOnlyAttr}${actionName ? ` onclick="${escapeHtml(actionName)}()"` : ''}>
        <div class="app-card-presence" data-app-presence hidden></div>
        <span class="icon">${escapeHtml(entry.icon)}</span>
        <span class="label">${escapeHtml(entry.label)}</span>
        ${subMarkup}
      </button>
    `;
    }).join('');
  renderProgramPresenceHighlights(currentActiveUsers);
}

function updateDashboardButtons(user) {
  document.querySelectorAll('[data-app]').forEach((button) => {
    const key = button.dataset.app;
    if (!key) return;
    const allowed = isAppAllowed(user, key);
    button.classList.toggle('hidden', !allowed);
    button.classList.toggle('app-disabled', !allowed);
    if (allowed) button.removeAttribute('disabled');
    else button.setAttribute('disabled', 'disabled');
  });
}

function renderUserSummary(user) {
  if (!user) return;
  const nameEl = document.getElementById('userDisplayName');
  const roleEl = document.getElementById('userRoleBadge');
  const roomEl = document.getElementById('userSectorDetail');
  if (nameEl) nameEl.textContent = user.displayName || user.username || '—';
  if (roleEl) roleEl.textContent = getRoleDisplayText(user, 'badge');
  if (roomEl) {
    const sectorDisplay = formatSectorDisplay(user.sectors || user.rooms || user.room);
    roomEl.textContent = sectorDisplay;
    roomEl.classList.toggle('hidden', !sectorDisplay);
  }
}

function wireProfileLinks() {
  document.querySelectorAll('[data-profile-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      goToProfile();
    });
    link.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        goToProfile();
      }
    });
  });
}

function hashString(value) {
  let hash = 0;
  String(value || '').split('').forEach((char) => {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  });
  return Math.abs(hash);
}

function getPresenceColor(username) {
  return PRESENCE_COLOR_PALETTE[hashString(username) % PRESENCE_COLOR_PALETTE.length] || PRESENCE_COLOR_PALETTE[0];
}

function getAccountTheme(user) {
  const role = getNormalizedRole(user);
  if (ACCOUNT_ROLE_THEMES[role]) return ACCOUNT_ROLE_THEMES[role];
  const color = getPresenceColor(user?.username || user?.displayName || '');
  return { ...color, ink: '#ffffff' };
}

function buildPresenceStyle(username) {
  const color = getPresenceColor(username);
  return `--presence-color:${color.hex};--presence-rgb:${color.rgb};`;
}

function buildAccountThemeStyle(user) {
  const theme = getAccountTheme(user || {});
  return `--account-accent-color:${theme.hex};--account-accent-rgb:${theme.rgb};--account-panel-ink:${theme.ink || '#111318'};`;
}

function applyActivityPanelAccountTheme(panel, user) {
  const content = panel ? panel.querySelector('.activity-panel-content') : null;
  if (!content) return;
  const theme = getAccountTheme(user || {});
  content.classList.add('account-themed-panel');
  content.style.setProperty('--account-accent-color', theme.hex);
  content.style.setProperty('--account-accent-rgb', theme.rgb);
  content.style.setProperty('--account-panel-ink', theme.ink || '#111318');
}

function getActivityRoleColorClass(userOrRole) {
  const role = getNormalizedRole(userOrRole);
  if (role === 'admin') return 'activity-role-admin';
  if (role === 'supersecretary') return 'activity-role-supersecretary';
  if (role === 'secretary') return 'activity-role-secretary';
  return 'activity-role-user';
}

function getActivityRoleRank(userOrRole) {
  const role = getNormalizedRole(userOrRole);
  if (role === 'admin') return 0;
  if (role === 'supersecretary') return 1;
  if (role === 'secretary') return 2;
  return 3;
}

function sortActivityAccountsForDisplay(users) {
  return (Array.isArray(users) ? users.slice() : []).sort((left, right) => {
    const approvalRankDelta = getDeleteApprovalSortRank(left) - getDeleteApprovalSortRank(right);
    if (approvalRankDelta) return approvalRankDelta;
    const approvalCountDelta = getDeleteApprovalCountForUser(right?.username) - getDeleteApprovalCountForUser(left?.username);
    if (approvalCountDelta) return approvalCountDelta;

    const presenceRank = { online: 0, inactive: 1, offline: 2 };
    const leftPresenceRank = presenceRank[getActivityPresenceStatus(left)] ?? 2;
    const rightPresenceRank = presenceRank[getActivityPresenceStatus(right)] ?? 2;
    const presenceDelta = leftPresenceRank - rightPresenceRank;
    if (presenceDelta) return presenceDelta;

    const rankDelta = getActivityRoleRank(left) - getActivityRoleRank(right);
    if (rankDelta) return rankDelta;
    const leftName = String(left?.displayName || left?.username || '');
    const rightName = String(right?.displayName || right?.username || '');
    return leftName.localeCompare(rightName, 'ar', { sensitivity: 'base' });
  });
}

function getDeleteApprovalSortRank(user) {
  return getDeleteApprovalCountForUser(user?.username) > 0 ? 0 : 1;
}

function normalizeApprovalRequesterUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function getDeleteApprovalCountForUser(username) {
  const normalizedUsername = normalizeApprovalRequesterUsername(username);
  if (!normalizedUsername) return 0;
  return (Array.isArray(pendingDeleteApprovals) ? pendingDeleteApprovals : [])
    .filter((request) => normalizeApprovalRequesterUsername(request?.requester?.username) === normalizedUsername)
    .reduce((total, request) => total + (Array.isArray(request.items) ? request.items.length : 1), 0);
}

function renderDeleteApprovalAccountBadge(entry) {
  const username = String(entry?.username || '').trim();
  const count = getDeleteApprovalCountForUser(username);
  if (!username || !count) return '';
  return `
    <button type="button" class="delete-approval-badge" data-delete-approval-requester="${escapeHtml(username)}" title="طلبات الاعتماد" aria-label="طلبات الاعتماد">
      ${count}
    </button>
  `;
}

function getActivityPresenceStatus(entry) {
  const normalized = String(entry?.presenceStatus || entry?.presenceState || '').trim().toLowerCase();
  if (normalized === 'inactive') return 'inactive';
  if (normalized === 'offline' || entry?.isOnline === false) return 'offline';
  return 'online';
}

function getActivityPresenceMeta(entry) {
  return ACTIVITY_STATUS_META[getActivityPresenceStatus(entry)] || ACTIVITY_STATUS_META.offline;
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

function getLatestUniqueUsers(entries) {
  const unique = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const username = String(entry?.username || '').trim();
    if (!username) return;
    const current = unique.get(username);
    const nextTime = new Date(entry.lastSeenAt || 0).getTime();
    const currentTime = current ? new Date(current.lastSeenAt || 0).getTime() : 0;
    if (!current || nextTime >= currentTime) unique.set(username, entry);
  });
  return Array.from(unique.values()).sort((left, right) => new Date(right.lastSeenAt || 0) - new Date(left.lastSeenAt || 0));
}

function renderProgramPresenceHighlights(users) {
  const grouped = new Map();
  getLatestUniqueUsers(users).forEach((entry) => {
    const programKey = String(entry?.programKey || '').trim();
    if (!programKey || !DEFAULT_APP_KEYS.includes(programKey)) return;
    if (!grouped.has(programKey)) grouped.set(programKey, []);
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
    const primaryColor = getPresenceColor(activeEntries[0].username);
    card.classList.add('has-live-presence');
    card.style.setProperty('--presence-color', primaryColor.hex);
    card.style.setProperty('--presence-rgb', primaryColor.rgb);
    presenceContainer.hidden = false;
    presenceContainer.innerHTML = activeEntries.map((entry) => `
      <span class="app-card-presence-chip" style="${buildPresenceStyle(entry.username)}">
        <span class="app-card-presence-name">${escapeHtml(entry.displayName || entry.username || '—')}</span>
        <span class="app-card-presence-role">${escapeHtml(getRoleDisplayText(entry, 'short'))}</span>
      </span>
    `).join('');
  });
}

function renderActivityRosterList(users) {
  const list = document.getElementById('activeUsersList');
  const emptyState = document.getElementById('activeUsersEmpty');
  const count = document.getElementById('activeUsersCount');
  const filterCheckbox = document.getElementById('filterActiveUsers');
  const filterNotifBtn = document.getElementById('filterWithNotifications');
  if (!list || !emptyState || !count) return;

  let items = sortActivityAccountsForDisplay(users);
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
    const roleClass = roleKey === 'supersecretary' || roleKey === 'secretary' ? 'is-secretary' : '';
    const roleColorClass = getActivityRoleColorClass(entry);
    const rawProgramName = String(entry?.programName || '').trim();
    const rawPageName = String(entry?.pageName || '').trim();
    const lastSeen = formatDateTime(entry?.lastSeenAt || entry?.lastLogin || entry?.createdAt || '');
    const timeSummary = lastSeen === '—' ? presenceMeta.timeLabel : `${presenceMeta.timeLabel}: ${lastSeen}`;
    const approvalCount = getDeleteApprovalCountForUser(entry.username);
    const approvalClass = approvalCount ? 'has-delete-approvals' : '';
    const approvalBadge = renderDeleteApprovalAccountBadge(entry);
    const subtitle = rawProgramName
      ? (rawPageName && rawPageName !== rawProgramName
        ? `${escapeHtml(rawProgramName)}<span class="activity-separator">•</span>${escapeHtml(rawPageName)}`
        : escapeHtml(rawProgramName))
      : escapeHtml(presenceMeta.fallbackSubtitle);
    return `
      <article class="activity-user-item ${presenceMeta.className} ${roleColorClass} ${approvalClass}" ${roleColorClass === 'activity-role-user' ? `style="${buildAccountThemeStyle(entry)}"` : ''} data-activity-user="${escapeHtml(entry.username)}" data-presence-status="${presenceMeta.key}" role="button" tabindex="0">
        <div class="activity-user-top">
          <div class="activity-user-name-wrap">
            <span class="activity-user-name">${escapeHtml(entry.displayName || entry.username || '—')}</span>
          </div>
          <span class="activity-user-role ${roleClass}">${escapeHtml(getRoleDisplayText(entry, 'short'))}</span>
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
        <div class="activity-user-actions">
          <button type="button" class="btn small" data-account-action="history" data-account-user="${escapeHtml(entry.username)}">سجل النشاط</button>
          <button type="button" class="btn small ghost" data-account-action="view" data-account-user="${escapeHtml(entry.username)}">عرض</button>
          <button type="button" class="btn small secondary" data-account-action="edit" data-account-user="${escapeHtml(entry.username)}">تحرير</button>
        </div>
        ${approvalBadge}
      </article>
    `;
  }).join('');
}

function renderAccountColorRosterList(users) {
  const list = document.getElementById('activeUsersList');
  const emptyState = document.getElementById('activeUsersEmpty');
  const count = document.getElementById('activeUsersCount');
  const filterNotifBtn = document.getElementById('filterWithNotifications');
  if (!list || !emptyState || !count) return;

  const viewer = getUser();
  const allowHistory = canViewActivityHistory(viewer);
  const canViewAccounts = isAdminUser(viewer) || isSuperSecretaryUser(viewer);
  const canReviewApprovals = isAdminUser(viewer) || isSuperSecretaryUser(viewer);
  const notificationOnly = Boolean(
    canReviewApprovals
    && filterNotifBtn
    && filterNotifBtn.classList.contains('is-active')
  );
  let items = sortActivityAccountsForDisplay(users);
  if (notificationOnly) {
    items = items.filter((entry) => getDeleteApprovalCountForUser(entry.username) > 0);
  }

  count.textContent = String(items.length);
  count.title = notificationOnly
    ? `حسابات لديها إشعارات: ${items.length}`
    : `إجمالي الحسابات: ${items.length}`;

  if (!items.length) {
    list.innerHTML = '';
    emptyState.textContent = notificationOnly
      ? 'لا توجد إشعارات معلقة.'
      : 'لا يوجد مستخدمون أو سكرتارية مضافون في النظام حالياً.';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  list.innerHTML = items.map((entry) => {
    const roleKey = getNormalizedRole(entry);
    const roleClass = roleKey === 'supersecretary' || roleKey === 'secretary' ? 'is-secretary' : '';
    const roleColorClass = getActivityRoleColorClass(entry);
    const approvalCount = canReviewApprovals ? getDeleteApprovalCountForUser(entry.username) : 0;
    const approvalClass = approvalCount ? 'has-delete-approvals' : '';
    const approvalBadge = canReviewApprovals ? renderDeleteApprovalAccountBadge(entry) : '';
    const username = escapeHtml(entry.username || '');
    const articleAction = allowHistory
      ? `data-activity-user="${username}"`
      : (canViewAccounts ? `data-account-action="view" data-account-user="${username}"` : '');
    const actionButtons = [
      allowHistory
        ? `<button type="button" class="btn small" data-account-action="history" data-account-user="${username}">سجل النشاط</button>`
        : '',
      canViewAccounts
        ? `<button type="button" class="btn small ghost" data-account-action="view" data-account-user="${username}">عرض</button>`
        : ''
    ].filter(Boolean).join('');
    return `
      <article class="activity-user-item activity-user-color-only ${roleColorClass} ${approvalClass}" ${roleColorClass === 'activity-role-user' ? `style="${buildAccountThemeStyle(entry)}"` : ''} ${articleAction} role="button" tabindex="0">
        <div class="activity-user-top">
          <div class="activity-user-name-wrap">
            <span class="activity-user-name">${escapeHtml(entry.displayName || entry.username || '—')}</span>
          </div>
          <span class="activity-user-role ${roleClass}">${escapeHtml(getRoleDisplayText(entry, 'short'))}</span>
        </div>
        <div class="activity-user-meta">
          <span>@${escapeHtml(entry.username || '—')}</span>
          <span>${escapeHtml(formatSectorDisplay(entry.sectors || entry.room) || '—')}</span>
        </div>
        ${actionButtons ? `<div class="activity-user-actions">${actionButtons}</div>` : ''}
        ${approvalBadge}
      </article>
    `;
  }).join('');
}
function renderCurrentActivityRoster() {
  if (currentRosterAccountColorOnly) {
    renderAccountColorRosterList(currentRosterUsers);
    renderProgramPresenceHighlights([]);
    return;
  }
  renderActivityRosterList(currentRosterUsers);
  renderProgramPresenceHighlights(currentActiveUsers);
}

async function loadActivityRoster() {
  if (document.hidden) return;
  try {
    const response = await fetchWithAuth(ACTIVITY_API_ENDPOINTS.roster, { method: 'GET' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const roster = Array.isArray(data?.users) ? data.users : [];
    currentRosterUsers = roster;
    currentRosterAccountColorOnly = Boolean(data?.accountColorOnly);
    if (data?.accountColorOnly) {
      currentActiveUsers = [];
      renderCurrentActivityRoster();
      return;
    }
    currentActiveUsers = Array.isArray(data?.activeUsers) ? data.activeUsers : [];
    renderCurrentActivityRoster();
  } catch (error) {
    console.error('Load dashboard activity roster failed:', error);
  }
}

function updateDeleteApprovalBadges() {
  renderCurrentActivityRoster();
}

const DELETE_APPROVAL_FIELD_LABELS = {
  dataset: 'مصدر البيانات',
  rowCount: 'عدد السجلات',
  requesterUsername: 'اسم المستخدم',
  requesterName: 'صاحب الطلب',
  recordId: 'رقم السجل',
  recordLabel: 'السجل',
  id: 'رقم السجل',
  name: 'الاسم',
  license: 'رقم الرخصة',
  licenseNumber: 'رقم الرخصة',
  license_number: 'رقم الرخصة',
  licenseType: 'نوع الرخصة',
  license_type: 'نوع الرخصة',
  address: 'العنوان',
  weaponDetails: 'بيانات السلاح',
  weaponsDetails: 'بيانات السلاح',
  weapon_details: 'بيانات السلاح',
  cancelDecisionDate: 'تاريخ قرار الالغاء',
  cancel_decision_date: 'تاريخ قرار الالغاء',
  cancelReason: 'سبب الالغاء',
  cancel_reason: 'سبب الالغاء',
  station: 'القسم التابع',
  piecesCount: 'عدد القطع',
  pieces_count: 'عدد القطع',
  depositNumber: 'رقم الايداع',
  depositeNumber: 'رقم الايداع',
  deposit_number: 'رقم الايداع',
  depositDate: 'تاريخ الايداع',
  depositeDate: 'تاريخ الايداع',
  deposit_date: 'تاريخ الايداع',
  notes: 'ملاحظات',
  withdrawStatus: 'حالة السحب',
  withdraw_status: 'حالة السحب',
  sector: 'القطاع',
  police: 'قسم الشرطة',
  date: 'التاريخ',
  job: 'الوظيفة',
  weapon: 'نوع السلاح',
  purpose: 'الغرض',
  decision: 'القرار',
  decisionManager: 'قرار مدير الامن',
  decisionPublic: 'قرار امن العام',
  recommendation: 'توصية',
  company_name: 'اسم الشركة',
  companyName: 'اسم الشركة'
};

const DELETE_APPROVAL_DATASET_LABELS = {
  civilians: 'مدنيين',
  police: 'شرطة',
  military: 'قوات مسلحة',
  all: 'الكل'
};

const WEAPONS_APPROVAL_RECORD_COLUMNS = [
  { label: 'رقم', keys: ['رقم', 'رقم القيد', 'license', 'licenseNumber', 'license_number'] },
  { label: 'نوع الرخصة', keys: ['نوع الرخصة', 'licenseType', 'license_type'] },
  { label: 'الاسم', keys: ['الاسم', 'name'] },
  { label: 'العنوان', keys: ['العنوان', 'address'] },
  { label: 'بيانات السلاح', keys: ['بيانات السلاح', 'weaponDetails', 'weaponsDetails', 'weapon_details'] },
  { label: 'تاريخ قرار الالغاء', keys: ['تاريخ قرار الالغاء', 'cancelDecisionDate', 'cancel_decision_date'] },
  { label: 'سبب الالغاء', keys: ['سبب الالغاء', 'cancelReason', 'cancel_reason'] },
  { label: 'القسم التابع', keys: ['القسم التابع', 'station'] },
  { label: 'القطاع', keys: ['القطاع', 'sector'] },
  { label: 'عدد القطع', keys: ['عدد القطع', 'piecesCount', 'pieces_count'] },
  { label: 'رقم الايداع', keys: ['رقم الايداع', 'رقم الإيداع', 'depositNumber', 'depositeNumber', 'deposit_number'] },
  { label: 'تاريخ الايداع', keys: ['تاريخ الايداع', 'تاريخ الإيداع', 'depositDate', 'depositeDate', 'deposit_date'] },
  { label: 'ملاحظات', keys: ['ملاحظات', 'notes'] },
  { label: 'حالة السحب', keys: ['حالة السحب', 'withdrawStatus', 'withdraw_status'] }
];
const REQUEST_APPROVAL_RECORD_FIELDS = [
  { label: 'الاسم', keys: ['requesterName', 'name', 'الاسم', 'اسم الطالب'] },
  { label: 'التاريخ', keys: ['applicationDate', 'approvalDate', 'requestDate', 'submissionDate', 'date', 'تاريخ التقديم', 'تاريخ الطلب'] },
  { label: 'القطاع', keys: ['sector', 'قطاع', 'القطاع'] },
  { label: 'القسم التابع', keys: ['station', 'policeStation', 'department', 'القسم التابع', 'القسم'] },
  { label: 'السلاح المطلوب', keys: ['weaponData', 'weaponDetails', 'weaponsRequested', 'weapon', 'السلاح المطلوب', 'بيانات السلاح'] }
];
const COMPANY_APPROVAL_RECORD_FIELDS = [
  { label: '#', keys: ['id', 'company_id', 'companyId', '#'] },
  { label: 'اسم الشركة', keys: ['company_name', 'companyName', 'اسم الشركة'] },
  { label: 'رقم الرخصة', keys: ['license_number', 'licenseNumber', 'رقم الرخصة'] },
  { label: 'تاريخ الاصدار', keys: ['issue_date', 'issueDate', 'تاريخ الاصدار', 'تاريخ الإصدار'] },
  { label: 'تاريخ التجديد', keys: ['renewal_date', 'renewalDate', 'تاريخ التجديد'] },
  { label: 'نوع النشاط', keys: ['activity_type', 'activityType', 'نوع النشاط'] },
  { label: 'عنوان مقر الشركة', keys: ['headquarters_address', 'headquartersAddress', 'عنوان مقر الشركة'] },
  { label: 'القطاع', keys: ['sector', 'القطاع'] },
  { label: 'حالة الشركة', keys: ['company_status', 'companyStatus', 'حالة الشركة'] },
  { label: 'ملاحظات', keys: ['notes', 'ملاحظات'] }
];
const DELETE_APPROVAL_REPORT_SECTOR_LABELS = {
  east: 'شرق',
  west: 'غرب',
  south: 'جنوب',
  north: 'شمال',
  sectorfive: 'القطاع التجريبي الخامس',
  sector_five: 'القطاع التجريبي الخامس',
  'sector-five': 'القطاع التجريبي الخامس',
  police_unit: 'وحدة الشرطة',
  army_unit: 'وحدة قوات مسلحة'
};

const DELETE_APPROVAL_HIDDEN_FIELD_KEYS = new Set([
  'attachments',
  'operation',
  'programKey',
  'programName',
  'type',
  'action',
  'status',
  'createdAt',
  'updatedAt',
  'decidedAt',
  'reviewer',
  'execution',
  'error',
  '__recordId',
  '__rowOrder',
  '__updatedAt',
  'rowOrder',
  'rowIndex',
  'updatedAtMs'
]);

function isDeleteApprovalHiddenFieldKey(key, request = null) {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey || normalizedKey === 'صورة' || DELETE_APPROVAL_HIDDEN_FIELD_KEYS.has(normalizedKey)) return true;
  if (normalizeDeleteApprovalProgramKey(request?.programKey) === 'weapons') {
    return normalizedKey === 'id' || normalizedKey === 'recordId';
  }
  return false;
}

function getDeleteApprovalDisplayRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
  const nestedKeys = ['record', 'row', 'fullRecord', 'snapshot'];
  for (const key of nestedKeys) {
    const nested = record[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested;
  }
  return record;
}

function getDeleteApprovalFieldLabel(key) {
  const normalizedKey = String(key || '').trim();
  return DELETE_APPROVAL_FIELD_LABELS[normalizedKey] || normalizedKey;
}

function getDeleteApprovalReportSectorLabel(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return DELETE_APPROVAL_REPORT_SECTOR_LABELS[text.toLowerCase()] || text;
}

function formatDeleteApprovalFieldValue(key, value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value
        .map((entry) => {
          if (entry === null || entry === undefined) return '';
          if (typeof entry === 'object') {
            return Object.entries(entry)
              .map(([childKey, childValue]) => {
                const text = formatDeleteApprovalFieldValue(childKey, childValue);
                return text ? `${getDeleteApprovalFieldLabel(childKey)}: ${text}` : '';
              })
              .filter(Boolean)
              .join('، ');
          }
          return String(entry).replace(/\s+/g, ' ').trim();
        })
        .filter(Boolean)
        .join(' | ');
    }
    return Object.entries(value)
      .map(([childKey, childValue]) => {
        const text = formatDeleteApprovalFieldValue(childKey, childValue);
        return text ? `${getDeleteApprovalFieldLabel(childKey)}: ${text}` : '';
      })
      .filter(Boolean)
      .join('، ');
  }
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (String(key || '').trim() === 'dataset') {
    return DELETE_APPROVAL_DATASET_LABELS[text] || text;
  }
  if (String(key || '').trim() === 'sector') {
    return getDeleteApprovalReportSectorLabel(text);
  }
  return text;
}

function isDeleteApprovalMetadataOnlySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
  const keys = Object.keys(snapshot).map((key) => String(key || '').trim()).filter(Boolean);
  return Boolean(keys.length) && keys.every((key) => key === 'dataset' || key === 'rowCount');
}

function firstDeleteApprovalSnapshotValue(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function buildReportApprovalFallbackSnapshot(row, metadata = {}) {
  const source = row && typeof row === 'object' && !Array.isArray(row) ? row : {};
  const decisionNumber = firstDeleteApprovalSnapshotValue(
    source['رقم القرار'],
    source.id,
    source.decisionNumber,
    source.recordId,
    metadata['رقم القرار'],
    metadata.rowCount
  );
  const sector = firstDeleteApprovalSnapshotValue(source['القطاع'], source.sector);
  return {
    'رقم القرار': decisionNumber,
    'تاريخ القرار': firstDeleteApprovalSnapshotValue(source['تاريخ القرار'], source.date),
    'الاسم': firstDeleteApprovalSnapshotValue(source['الاسم'], source.name),
    'الوظيفة': firstDeleteApprovalSnapshotValue(source['الوظيفة'], source.job),
    'نوع الترخيص': firstDeleteApprovalSnapshotValue(source['نوع الترخيص'], source.license),
    'نوع السلاح': firstDeleteApprovalSnapshotValue(source['نوع السلاح'], source.weapon),
    'الغرض': firstDeleteApprovalSnapshotValue(source['الغرض'], source.purpose),
    'القطاع': getDeleteApprovalReportSectorLabel(sector),
    'قسم الشرطة': firstDeleteApprovalSnapshotValue(source['قسم الشرطة'], source.police),
    'قرار مدير الامن': firstDeleteApprovalSnapshotValue(source['قرار مدير الامن'], source.decisionManager, source.decision),
    'قرار امن العام': firstDeleteApprovalSnapshotValue(source['قرار امن العام'], source.decisionPublic),
    'توصية': firstDeleteApprovalSnapshotValue(source['توصية'], source.recommendation)
  };
}

function getDeleteApprovalFallbackSnapshot(snapshot, item, request) {
  if (!isDeleteApprovalMetadataOnlySnapshot(snapshot)) return snapshot;
  if (normalizeDeleteApprovalProgramKey(request?.programKey) !== 'report') return snapshot;
  const operation = item?.operation && typeof item.operation === 'object'
    ? item.operation
    : (request?.operation && typeof request.operation === 'object' ? request.operation : {});
  const action = String(operation?.action || request?.action || '').trim().toLowerCase();
  const type = String(operation?.type || '').trim();
  const rows = Array.isArray(operation?.rows) ? operation.rows : [];
  if (type !== 'report.save-records' || action !== 'add' || !rows.length) return snapshot;
  const fallbackRow = rows[rows.length - 1];
  return fallbackRow && typeof fallbackRow === 'object'
    ? buildReportApprovalFallbackSnapshot(fallbackRow, snapshot)
    : snapshot;
}

function getRequestApprovalDisplayRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
  if (record.after && typeof record.after === 'object' && !Array.isArray(record.after)) return record.after;
  if (record.record && typeof record.record === 'object' && !Array.isArray(record.record)) return record.record;
  if (record.snapshot && typeof record.snapshot === 'object' && !Array.isArray(record.snapshot)) return record.snapshot;
  return record;
}

function getRequestApprovalRecordValue(record, keys) {
  if (!record || typeof record !== 'object') return '';
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    const text = formatDeleteApprovalFieldValue(key, record[key]);
    if (text) return text;
  }
  return '';
}

function formatRequestApprovalRecordSummary(record) {
  const source = getRequestApprovalDisplayRecord(record);
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return '<p class="delete-approval-record-empty">—</p>';
  }
  const fields = REQUEST_APPROVAL_RECORD_FIELDS
    .map((field) => ({ label: field.label, value: getRequestApprovalRecordValue(source, field.keys) }))
    .filter((field) => field.value)
    .map((field) => `
        <div class="delete-approval-record-field">
          <dt>${escapeHtml(field.label)}</dt>
          <dd>${escapeHtml(toGlobalSearchArabicDigits(field.value))}</dd>
        </div>
      `)
    .join('');
  return fields ? `<dl class="delete-approval-record-grid">${fields}</dl>` : '<p class="delete-approval-record-empty">—</p>';
}

function getCompanyApprovalDisplayRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
  if (record.company && typeof record.company === 'object' && !Array.isArray(record.company)) return record.company;
  if (record.before && typeof record.before === 'object' && record.after && typeof record.after === 'object') {
    return { ...record.before, ...record.after };
  }
  if (record.after && typeof record.after === 'object' && !Array.isArray(record.after)) return record.after;
  if (record.record && typeof record.record === 'object' && !Array.isArray(record.record)) return record.record;
  if (record.snapshot && typeof record.snapshot === 'object' && !Array.isArray(record.snapshot)) return record.snapshot;
  return record;
}

function getCompanyApprovalRecordValue(record, keys) {
  if (!record || typeof record !== 'object') return '';
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    const text = formatDeleteApprovalFieldValue(key, record[key]);
    if (text) return text;
  }
  return '';
}

function formatCompanyApprovalRecordSummary(record) {
  const source = getCompanyApprovalDisplayRecord(record);
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return '<p class="delete-approval-record-empty">—</p>';
  }
  const fields = COMPANY_APPROVAL_RECORD_FIELDS
    .map((field) => ({ label: field.label, value: getCompanyApprovalRecordValue(source, field.keys) }))
    .filter((field) => field.value)
    .map((field) => `
        <div class="delete-approval-record-field">
          <dt>${escapeHtml(field.label)}</dt>
          <dd>${escapeHtml(toGlobalSearchArabicDigits(field.value))}</dd>
        </div>
      `)
    .join('');
  return fields ? `<dl class="delete-approval-record-grid">${fields}</dl>` : '<p class="delete-approval-record-empty">—</p>';
}
function getDeleteApprovalRecordLineClass(request, extraClass = '') {
  const classes = ['delete-approval-record-line'];
  if (normalizeDeleteApprovalProgramKey(request?.programKey) === 'weapons') {
    classes.push('has-weapons-row');
  }
  if (extraClass) classes.push(extraClass);
  return classes.join(' ');
}

function getWeaponsApprovalRecordValue(record, keys) {
  if (!record || typeof record !== 'object') return null;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    const value = record[key];
    const text = formatDeleteApprovalFieldValue(key, value);
    if (text) return { key, value, text };
  }
  return null;
}

function getWeaponsApprovalRecordColumns(record) {
  const usedKeys = new Set();
  const columns = [];
  WEAPONS_APPROVAL_RECORD_COLUMNS.forEach((column) => {
    const match = getWeaponsApprovalRecordValue(record, column.keys);
    column.keys.forEach((key) => usedKeys.add(String(key || '').trim()));
    if (!match) return;
    columns.push({ key: match.key, label: column.label, value: match.value, text: match.text });
  });

  Object.entries(record || {}).forEach(([key, value]) => {
    const normalizedKey = String(key || '').trim();
    if (usedKeys.has(normalizedKey) || isDeleteApprovalHiddenFieldKey(normalizedKey, { programKey: 'weapons' })) return;
    const text = formatDeleteApprovalFieldValue(normalizedKey, value);
    if (!text) return;
    columns.push({ key: normalizedKey, label: getDeleteApprovalFieldLabel(normalizedKey), value, text });
  });
  return columns;
}

function splitWeaponsApprovalTextLines(value) {
  const source = formatDeleteApprovalFieldValue('', value).replace(/\r\n/g, '\n');
  if (!source.trim()) return [];
  const rawParts = source
    .split(/\n|\s*\|\s*|\s+\+\s+/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const parts = [];
  rawParts.forEach((part) => {
    if (/^\(?\s*(?:ال)?مسحوب\s*\)?$/i.test(part) && parts.length) {
      parts[parts.length - 1] = `${parts[parts.length - 1]} ${part}`.trim();
      return;
    }
    parts.push(part);
  });
  return parts;
}

function getWeaponsApprovalLineStatus(line) {
  const text = String(line || '');
  if (/غير\s*مسحوب|لم\s*يتم\s*السحب/.test(text)) return { className: 'is-active', label: 'غير مسحوب' };
  if (/(?:^|[\s(])(?:ال)?مسحوب(?:[\s)]|$)/.test(text)) return { className: 'is-withdrawn', label: 'مسحوب' };
  return { className: '', label: '' };
}

function renderWeaponsApprovalLines(value, mode = '') {
  const lines = splitWeaponsApprovalTextLines(value);
  if (!lines.length) return '<span>—</span>';
  return `<div class="delete-approval-weapons-lines ${mode ? `is-${escapeHtml(mode)}` : ''}">${lines.map((line) => {
    if (mode === 'weapon') {
      const status = getWeaponsApprovalLineStatus(line);
      const cleanLine = line.replace(/\(?\s*(?:ال)?مسحوب\s*\)?/g, '').replace(/غير\s*مسحوب/g, '').trim() || line;
      return `<span class="delete-approval-weapons-line ${escapeHtml(status.className)}"><b>${escapeHtml(toGlobalSearchArabicDigits(cleanLine))}</b>${status.label ? `<em>${escapeHtml(status.label)}</em>` : ''}</span>`;
    }
    return `<span>${escapeHtml(toGlobalSearchArabicDigits(line))}</span>`;
  }).join('')}</div>`;
}

function renderWeaponsApprovalCell(column) {
  const label = String(column?.label || '');
  const text = String(column?.text || '').trim();
  if (/بيانات السلاح|نوع السلاح|السلاح/.test(label)) {
    return renderWeaponsApprovalLines(column.value, 'weapon');
  }
  if (/رقم الايداع|رقم الإيداع|تاريخ الايداع|تاريخ الإيداع/.test(label)) {
    return renderWeaponsApprovalLines(column.value, 'stack');
  }
  if (/حالة السحب/.test(label)) {
    const status = getWeaponsApprovalLineStatus(text);
    const className = status.className || (/جزئ|بعض|partial/i.test(text) ? 'is-partial' : '');
    return `<span class="delete-approval-weapons-status ${escapeHtml(className)}">${escapeHtml(toGlobalSearchArabicDigits(text || '—'))}</span>`;
  }
  return `<span>${escapeHtml(toGlobalSearchArabicDigits(text || '—'))}</span>`;
}

function formatWeaponsApprovalRecordRow(record) {
  const columns = getWeaponsApprovalRecordColumns(record);
  if (!columns.length) return '<p class="delete-approval-record-empty">—</p>';
  return `<div class="delete-approval-weapons-table-wrap">
    <table class="delete-approval-weapons-table" dir="rtl">
      <thead><tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr></thead>
      <tbody><tr>${columns.map((column) => `<td title="${escapeHtml(toGlobalSearchArabicDigits(column.text || '—'))}">${renderWeaponsApprovalCell(column)}</td>`).join('')}</tr></tbody>
    </table>
  </div>`;
}
function formatApprovalSnapshot(snapshot, request = null) {
  if (!snapshot || typeof snapshot !== 'object') {
    return '<div class="delete-approval-record-line"><p class="delete-approval-record-empty">لا توجد بيانات للسجل.</p></div>';
  }
  if (Array.isArray(snapshot.records)) {
    return snapshot.records.map((record, index) => `
      <div class="${getDeleteApprovalRecordLineClass(request)}">
        <strong class="delete-approval-record-title">سجل ${index + 1}</strong>
        ${formatApprovalSnapshotFields(record, request)}
      </div>
    `).join('');
  }
  return `
    <div class="${getDeleteApprovalRecordLineClass(request)}">
      ${formatApprovalSnapshotFields(snapshot, request)}
    </div>
  `;
}

function formatApprovalSnapshotFields(record, request = null) {
  if (!record || typeof record !== 'object') {
    return '<p class="delete-approval-record-empty">—</p>';
  }
  const displayRecord = getDeleteApprovalDisplayRecord(record);
  if (displayRecord && typeof displayRecord === 'object' && Array.isArray(displayRecord.records)) {
    return displayRecord.records.map((entry, index) => `
      <div class="delete-approval-record-subline">
        <strong class="delete-approval-record-title">سجل ${index + 1}</strong>
        ${formatApprovalSnapshotFields(entry, request)}
      </div>
    `).join('');
  }
  if (!displayRecord || typeof displayRecord !== 'object' || Array.isArray(displayRecord)) {
    return '<p class="delete-approval-record-empty">—</p>';
  }
  if (normalizeDeleteApprovalProgramKey(request?.programKey) === 'company') {
    return formatCompanyApprovalRecordSummary(displayRecord);
  }
  if (normalizeDeleteApprovalProgramKey(request?.programKey) === 'request') {
    return formatRequestApprovalRecordSummary(displayRecord);
  }
  if (normalizeDeleteApprovalProgramKey(request?.programKey) === 'weapons') {
    return formatWeaponsApprovalRecordRow(displayRecord);
  }
  const fields = Object.entries(displayRecord)
    .filter(([key, value]) => {
      const normalizedKey = String(key || '').trim();
      if (isDeleteApprovalHiddenFieldKey(normalizedKey, request)) return false;
      return formatDeleteApprovalFieldValue(normalizedKey, value) !== '';
    })
    .map(([key, value]) => {
      const normalizedKey = String(key || '').trim();
      const text = formatDeleteApprovalFieldValue(normalizedKey, value);
      const label = getDeleteApprovalFieldLabel(normalizedKey);
      return `
        <div class="delete-approval-record-field">
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(text)}</dd>
        </div>
      `;
    })
    .join('');
  if (!fields) return '<p class="delete-approval-record-empty">—</p>';
  return `<dl class="delete-approval-record-grid">${fields}</dl>`;
}

function normalizeDeleteApprovalItemStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'approved') return 'approved';
  if (status === 'denied') return 'denied';
  if (status === 'failed') return 'failed';
  return 'pending';
}

function getDeleteApprovalItemStatusLabel(status) {
  const normalized = normalizeDeleteApprovalItemStatus(status);
  if (normalized === 'approved') return 'تم القبول';
  if (normalized === 'denied') return 'تم الرفض';
  if (normalized === 'failed') return 'تعذر التنفيذ';
  return 'بانتظار القرار';
}

function normalizeDeleteApprovalProgramKey(value) {
  return String(value || '').trim().toLowerCase();
}

function getDeleteApprovalActionLabel(request) {
  const action = String(request?.action || '').trim().toLowerCase();
  if (action === 'add') return 'إضافة';
  if (action === 'edit') return 'تعديل';
  if (action === 'delete') return 'حذف';
  const type = String(request?.type || '').trim().toLowerCase();
  if (type.includes('add')) return 'إضافة';
  if (type.includes('edit')) return 'تعديل';
  if (type.includes('delete')) return 'حذف';
  return 'إجراء';
}

function readDeleteApprovalSnapshotValue(snapshot, keys) {
  if (!snapshot || typeof snapshot !== 'object') return '';
  for (const key of keys) {
    if (snapshot[key] != null && String(snapshot[key]).trim()) return String(snapshot[key]).trim();
  }
  if (snapshot.company && typeof snapshot.company === 'object') {
    for (const key of keys) {
      if (snapshot.company[key] != null && String(snapshot.company[key]).trim()) return String(snapshot.company[key]).trim();
    }
  }
  return '';
}

function extractDeleteApprovalInspectFields(item, request) {
  const snapshot = item?.recordSnapshot && typeof item.recordSnapshot === 'object' ? item.recordSnapshot : {};
  const programKey = normalizeDeleteApprovalProgramKey(request?.programKey);
  if (Array.isArray(snapshot)) {
    if (programKey === 'weapons') {
      return {
        name: String(snapshot[2] || item?.recordLabel || '').trim(),
        license: String(snapshot[0] || item?.recordId || '').trim(),
        recordNumber: String(item?.recordId || snapshot[0] || '').trim()
      };
    }
    return {
      name: String(item?.recordLabel || '').trim(),
      license: String(item?.recordId || '').trim(),
      recordNumber: String(item?.recordId || '').trim()
    };
  }
  const name = readDeleteApprovalSnapshotValue(snapshot, [
    'الاســـــــم',
    'الاسم',
    'اسم الطالب',
    'requesterName',
    'name',
    'company_name'
  ]) || item?.recordLabel || request?.recordLabel || '';
  const license = readDeleteApprovalSnapshotValue(snapshot, [
    'رقم الرخصة',
    'رقم القيد',
    'رقم',
    'license',
    'licenseNumber',
    'license_number'
  ]) || item?.recordId || '';
  const recordNumber = readDeleteApprovalSnapshotValue(snapshot, [
    'رقم القرار',
    'رقم الحرز',
    'رقم الطلب',
    'id',
    'ID'
  ]) || item?.recordId || '';
  return {
    name: String(name || '').trim(),
    license: String(license || '').trim(),
    recordNumber: String(recordNumber || '').trim()
  };
}

function getDeleteApprovalItems(request) {
  const rawItems = Array.isArray(request?.items) && request.items.length
    ? request.items
    : [{
        id: `${String(request?.id || 'request')}:item-1`,
        status: request?.status || 'pending',
        recordId: request?.recordId || '',
        recordLabel: request?.recordLabel || '',
        recordSnapshot: request?.recordSnapshot || {},
        attachments: request?.attachments || []
      }];
  return rawItems.map((item, index) => {
    const recordSnapshot = getDeleteApprovalFallbackSnapshot(
      item?.recordSnapshot && typeof item.recordSnapshot === 'object' ? item.recordSnapshot : {},
      item,
      request
    );
    const rawRecordLabel = String(item?.recordLabel || item?.label || item?.recordId || `سجل ${index + 1}`);
    const isReportAddCountLabel = normalizeDeleteApprovalProgramKey(request?.programKey) === 'report'
      && String(request?.action || item?.action || item?.operation?.action || '').trim().toLowerCase() === 'add'
      && /^[\d٠-٩۰-۹]+\s*سجلات?$/.test(rawRecordLabel.trim());
    const decisionNumber = firstDeleteApprovalSnapshotValue(
      recordSnapshot && recordSnapshot['رقم القرار'],
      recordSnapshot && recordSnapshot.id,
      recordSnapshot && recordSnapshot.rowCount
    );
    return {
      id: String(item?.id || `${String(request?.id || 'request')}:item-${index + 1}`),
      status: normalizeDeleteApprovalItemStatus(item?.status),
      recordId: item?.recordId == null ? '' : String(item.recordId),
      recordLabel: isReportAddCountLabel && decisionNumber
        ? `رقم القرار ${decisionNumber}`
        : rawRecordLabel,
      recordSnapshot,
      attachments: Array.isArray(item?.attachments) ? item.attachments : [],
      operation: item?.operation && typeof item.operation === 'object'
        ? item.operation
        : (request?.operation && typeof request.operation === 'object' ? request.operation : {})
    };
  });
}

function renderDeleteApprovalItems(request) {
  const items = getDeleteApprovalItems(request);
  if (!items.length) return '<div class="delete-approval-record-line"><p class="delete-approval-record-empty">لا توجد بيانات للسجل.</p></div>';
  return items.map((item, index) => {
    const isPending = item.status === 'pending';
    const statusLabel = getDeleteApprovalItemStatusLabel(item.status);
    const label = item.recordLabel && item.recordLabel !== `سجل ${index + 1}`
      ? `<span class="delete-approval-record-label">${escapeHtml(item.recordLabel)}</span>`
      : '';
    return `
      <div class="${escapeHtml(getDeleteApprovalRecordLineClass(request, `is-${item.status}`))}" data-delete-approval-item-id="${escapeHtml(item.id)}">
        <div class="delete-approval-record-line-header">
          <div>
            <strong class="delete-approval-record-title">سجل ${index + 1}</strong>
            ${label}
          </div>
          <span class="delete-approval-item-status">${escapeHtml(statusLabel)}</span>
        </div>
        ${formatApprovalSnapshotFields(item.recordSnapshot, request)}
        ${renderDeleteApprovalItemAttachments(request, item)}
        <div class="delete-approval-item-actions">
          <button type="button" class="btn small ghost" data-delete-approval-inspect-action="inspect" data-delete-approval-id="${escapeHtml(request.id)}" data-delete-approval-item-id="${escapeHtml(item.id)}">فحص</button>
          ${isPending ? `
            <button type="button" class="btn small delete-approval-accept-btn" data-delete-approval-item-action="approve" data-delete-approval-id="${escapeHtml(request.id)}" data-delete-approval-item-id="${escapeHtml(item.id)}">قبول</button>
            <button type="button" class="btn small delete-approval-deny-btn" data-delete-approval-item-action="deny" data-delete-approval-id="${escapeHtml(request.id)}" data-delete-approval-item-id="${escapeHtml(item.id)}">رفض</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function normalizeDeleteApprovalAttachmentUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;
  try {
    const parsed = new URL(raw, window.location.origin);
    return parsed.origin === window.location.origin ? parsed.href : '';
  } catch (_) {
    return '';
  }
}

function getDeleteApprovalAttachments(request) {
  return (Array.isArray(request?.attachments) ? request.attachments : [])
    .map((attachment) => {
      const url = normalizeDeleteApprovalAttachmentUrl(attachment?.url);
      if (!url) return null;
      return {
        label: String(attachment?.label || attachment?.filename || 'مرفق').trim(),
        filename: String(attachment?.filename || '').trim(),
        mimeType: String(attachment?.mimeType || '').trim(),
        url
      };
    })
    .filter(Boolean);
}

function renderDeleteApprovalItemAttachments(request, item) {
  const attachments = getDeleteApprovalAttachments(item);
  if (!attachments.length) return '';
  return `
    <div class="delete-approval-attachments">
      <span>مرفقات السجل</span>
      <div class="delete-approval-attachment-list">
        <button type="button" class="btn small ghost delete-approval-attachment-view" data-delete-approval-action="view-attachments" data-delete-approval-id="${escapeHtml(request.id)}" data-delete-approval-item-id="${escapeHtml(item.id)}">
          عرض
        </button>
      </div>
    </div>
  `;
}

function ensureDeleteApprovalPdfLibLoaded() {
  if (window.PDFLib && window.PDFLib.PDFDocument) {
    return Promise.resolve(window.PDFLib);
  }
  if (deleteApprovalPdfLibPromise) return deleteApprovalPdfLibPromise;

  deleteApprovalPdfLibPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = typeof window.resolvePlatformAsset === 'function'
      ? window.resolvePlatformAsset('/renewal/vendor/pdf-lib.min.js')
      : '/renewal/vendor/pdf-lib.min.js';
    script.async = true;
    script.onload = () => {
      if (window.PDFLib && window.PDFLib.PDFDocument) {
        resolve(window.PDFLib);
        return;
      }
      deleteApprovalPdfLibPromise = null;
      reject(new Error('PDF library loaded without PDFDocument'));
    };
    script.onerror = () => {
      deleteApprovalPdfLibPromise = null;
      reject(new Error('Failed to load PDF library'));
    };
    document.head.appendChild(script);
  });

  return deleteApprovalPdfLibPromise;
}

async function combineDeleteApprovalAttachmentsToPdf(attachments) {
  await ensureDeleteApprovalPdfLibLoaded();
  const { PDFDocument } = window.PDFLib;
  const outputPdf = await PDFDocument.create();
  const A4 = { w: 595.28, h: 841.89 };
  let appendedCount = 0;

  for (const attachment of attachments) {
    let response = null;
    try {
      response = await fetchWithAuth(attachment.url, { method: 'GET', cache: 'no-store' });
    } catch (_) {
      continue;
    }
    if (!response || !response.ok) continue;

    const bytes = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || attachment.mimeType || '';
    const url = attachment.url || '';
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
        page.drawImage(img, {
          x: (A4.w - width) / 2,
          y: (A4.h - height) / 2,
          width,
          height
        });
        appendedCount += 1;
      } catch (_) {}
    }
  }

  if (!appendedCount) {
    throw new Error('لا توجد ملفات قابلة للعرض الموحد. المتاح حالياً: PDF و JPG و PNG.');
  }

  return outputPdf.save();
}

async function openDeleteApprovalAttachments(requestId, itemId, button) {
  const request = (Array.isArray(pendingDeleteApprovals) ? pendingDeleteApprovals : [])
    .find((entry) => String(entry?.id || '') === String(requestId || ''));
  const item = itemId
    ? getDeleteApprovalItems(request).find((entry) => String(entry?.id || '') === String(itemId || ''))
    : null;
  const attachments = getDeleteApprovalAttachments(item || request);
  if (!attachments.length) {
    window.alert('لا توجد مرفقات لعرضها.');
    return;
  }

  const previousText = button ? button.textContent : '';
  if (button) {
    button.disabled = true;
    button.textContent = 'جارٍ التجهيز...';
    button.setAttribute('aria-busy', 'true');
  }

  try {
    const pdfBytes = await combineDeleteApprovalAttachmentsToPdf(attachments);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    const viewer = window.open(blobUrl, '_blank');
    if (!viewer) {
      window.alert('تعذر فتح نافذة العرض.');
    }
    setTimeout(() => {
      try { URL.revokeObjectURL(blobUrl); } catch (_) {}
    }, 60000);
  } catch (error) {
    window.alert(error.message || 'تعذر تجهيز ملف العرض.');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousText || 'عرض';
      button.removeAttribute('aria-busy');
    }
  }
}

function openDeleteApprovalInspectTarget(requestId, itemId) {
  const request = (Array.isArray(pendingDeleteApprovals) ? pendingDeleteApprovals : [])
    .find((entry) => String(entry?.id || '') === String(requestId || ''));
  if (!request) {
    window.alert('تعذر العثور على طلب الحذف.');
    return;
  }
  const programKey = normalizeDeleteApprovalProgramKey(request.programKey);
  const targetUrl = DELETE_APPROVAL_INSPECT_URLS[programKey];
  if (!targetUrl) {
    window.alert('لا يوجد مسار فحص لهذا البرنامج.');
    return;
  }
  if (!isAppAllowed(getUser(), programKey)) {
    window.alert('صلاحية هذا البرنامج مغلقة');
    return;
  }
  const item = getDeleteApprovalItems(request)
    .find((entry) => String(entry?.id || '') === String(itemId || ''));
  if (!item) {
    window.alert('تعذر العثور على السجل المطلوب فحصه.');
    return;
  }
  const fields = extractDeleteApprovalInspectFields(item, request);
  const dataset = String(item?.operation?.dataset || request?.operation?.dataset || '').trim();
  try {
    sessionStorage.setItem(DELETE_APPROVAL_INSPECT_STORAGE_KEY, JSON.stringify({
      source: 'delete-approval',
      programKey,
      requestId: String(request.id || ''),
      itemId: String(item.id || ''),
      dataset,
      name: fields.name,
      license: fields.license,
      recordNumber: fields.recordNumber,
      createdAt: new Date().toISOString()
    }));
  } catch (_) {}
  markActivityNavigation(`inspect-delete-approval-${programKey}`);
  window.location.href = targetUrl;
}

function getDeleteApprovalPanelRequests() {
  const requests = Array.isArray(pendingDeleteApprovals) ? pendingDeleteApprovals : [];
  const requesterFilter = normalizeApprovalRequesterUsername(deleteApprovalPanelRequesterFilter);
  if (!requesterFilter) return requests;
  return requests.filter((request) => (
    normalizeApprovalRequesterUsername(request?.requester?.username) === requesterFilter
  ));
}

function renderDeleteApprovalPanel() {
  const body = document.getElementById('deleteApprovalPanelBody');
  const title = document.getElementById('deleteApprovalPanelTitle');
  const subtitle = document.getElementById('deleteApprovalPanelSubtitle');
  if (!body) return;
  const requests = getDeleteApprovalPanelRequests();
  const isFiltered = Boolean(normalizeApprovalRequesterUsername(deleteApprovalPanelRequesterFilter));
  if (title) {
    title.textContent = 'طلبات الاعتماد';
  }
  if (subtitle) {
    const firstRequesterName = requests.length === 1
      ? (requests[0]?.requester?.displayName || requests[0]?.requester?.username || '')
      : '';
    subtitle.textContent = requests.length
      ? (firstRequesterName || `${requests.length} طلب اعتماد في انتظار القرار${isFiltered ? ` من @${deleteApprovalPanelRequesterFilter}` : ''}`)
      : (isFiltered ? `لا توجد طلبات اعتماد معلقة من @${deleteApprovalPanelRequesterFilter}.` : 'لا توجد طلبات اعتماد معلقة.');
  }
  if (!requests.length) {
    body.innerHTML = '<p class="view-placeholder">لا توجد طلبات اعتماد معلقة.</p>';
    return;
  }
  body.innerHTML = requests.map((request) => `
    <article class="delete-approval-card" data-delete-approval-id="${escapeHtml(request.id)}">
      <div class="delete-approval-card-header">
        <div>
          <h4>${escapeHtml(request.programName || request.programKey || 'برنامج غير محدد')}</h4>
          <p>${escapeHtml(request.requester?.displayName || request.requester?.username || '—')}</p>
        </div>
        <span class="delete-approval-time">${escapeHtml(formatDateTime(request.createdAt))}</span>
      </div>
      <dl class="delete-approval-meta">
        <div><dt>صاحب الطلب</dt><dd>${escapeHtml(request.requester?.displayName || request.requester?.username || '—')}</dd></div>
        <div><dt>اسم المستخدم</dt><dd>@${escapeHtml(request.requester?.username || '—')}</dd></div>
        <div><dt>البرنامج</dt><dd>${escapeHtml(request.programName || request.programKey || '—')}</dd></div>
        <div><dt>الإجراء</dt><dd>${escapeHtml(getDeleteApprovalActionLabel(request))}</dd></div>
      </dl>
      <div class="delete-approval-record">
        <span>السطر الكامل للسجل</span>
        ${renderDeleteApprovalItems(request)}
      </div>
      <div class="delete-approval-actions">
        <button type="button" class="btn small delete-approval-accept-btn" data-delete-approval-action="approve" data-delete-approval-id="${escapeHtml(request.id)}">قبول الكل</button>
        <button type="button" class="btn small delete-approval-deny-btn" data-delete-approval-action="deny" data-delete-approval-id="${escapeHtml(request.id)}">رفض الكل</button>
      </div>
    </article>
  `).join('');
}

async function loadDeleteApprovals() {
  if (document.hidden) return;
  try {
    const response = await fetchWithAuth(DELETE_APPROVAL_API_ENDPOINTS.pending, { method: 'GET' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    pendingDeleteApprovals = Array.isArray(data?.requests) ? data.requests : [];
    updateDeleteApprovalBadges();
    if (deleteApprovalPanelVisible) renderDeleteApprovalPanel();
  } catch (error) {
    console.error('Load delete approvals failed:', error);
  }
}

function openDeleteApprovalPanel(requesterUsername = '') {
  const panel = document.getElementById('deleteApprovalPanel');
  if (!panel) return;
  deleteApprovalPanelRequesterFilter = String(requesterUsername || '').trim();
  deleteApprovalPanelVisible = true;
  renderDeleteApprovalPanel();
  panel.classList.add('visible');
  panel.setAttribute('aria-hidden', 'false');
  void loadDeleteApprovals();
}

function closeDeleteApprovalPanel() {
  const panel = document.getElementById('deleteApprovalPanel');
  if (!panel) return;
  deleteApprovalPanelVisible = false;
  deleteApprovalPanelRequesterFilter = '';
  panel.classList.remove('visible');
  panel.setAttribute('aria-hidden', 'true');
}

function getPlatformSearchElements() {
  return {
    form: document.getElementById('globalSearchForm'),
    input: document.getElementById('globalSearchInput'),
    submit: document.getElementById('globalSearchSubmit'),
    panel: document.getElementById('platformSearchPanel'),
    closeButton: document.getElementById('closePlatformSearchPanel'),
    title: document.getElementById('platformSearchTitle'),
    subtitle: document.getElementById('platformSearchSubtitle'),
    status: document.getElementById('platformSearchStatus'),
    groups: document.getElementById('platformSearchResultsGroups')
  };
}

function openPlatformSearchPanel() {
  const { panel } = getPlatformSearchElements();
  if (!panel) return;
  panel.classList.add('visible');
  panel.setAttribute('aria-hidden', 'false');
}

function closePlatformSearchPanel() {
  const { panel } = getPlatformSearchElements();
  closeGlobalSearchReportTextIndex();
  if (!panel) return;
  panel.classList.remove('visible');
  panel.setAttribute('aria-hidden', 'true');
}

function setPlatformSearchStatus(message) {
  const { status } = getPlatformSearchElements();
  if (status) status.textContent = String(message || '');
}

function getPlatformSearchProgramLabel(result) {
  const programName = String(result?.programName || result?.programKey || '—').trim() || '—';
  const dataset = String(result?.dataset || '').trim();
  return dataset ? `${programName} - ${dataset}` : programName;
}

function getGlobalSearchProgramIcon(result) {
  const programKey = String(result?.programKey || '').trim().toLowerCase();
  return String(cachedAppCatalog.find((entry) => entry.key === programKey)?.icon || '🔎').trim() || '🔎';
}

function getGlobalSearchAttachmentFileUrl(reference, attachmentId) {
  return `${GLOBAL_SEARCH_API_ENDPOINT}/attachments/${encodeURIComponent(reference)}/files/${encodeURIComponent(attachmentId)}`;
}

function toGlobalSearchArabicDigits(value) {
  return String(value ?? '').replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
}

function normalizeGlobalSearchReportTextValue(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/\uFEFF/g, '')
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[هة]/g, 'ه')
    .replace(/[^0-9a-z\u0600-\u06FF]+/gi, '')
    .toLowerCase();
}

function findGlobalSearchReportTextRange(text, searchValue) {
  const source = String(text ?? '');
  const needle = normalizeGlobalSearchReportTextValue(searchValue);
  if (!source || !needle) return null;
  const normalizedParts = [];
  const indexMap = [];
  for (let index = 0; index < source.length; index += 1) {
    const normalized = normalizeGlobalSearchReportTextValue(source[index]);
    if (!normalized) continue;
    normalizedParts.push(normalized);
    for (let offset = 0; offset < normalized.length; offset += 1) indexMap.push(index);
  }
  const foundAt = normalizedParts.join('').indexOf(needle);
  if (foundAt < 0) return null;
  const start = indexMap[foundAt];
  const last = indexMap[foundAt + needle.length - 1];
  return Number.isFinite(start) && Number.isFinite(last) ? { start, end: last + 1 } : null;
}

function buildGlobalSearchReportTextHighlight(text, searchValue) {
  const source = String(text ?? '');
  const range = findGlobalSearchReportTextRange(source, searchValue);
  if (!range) return { found: false, html: escapeHtml(toGlobalSearchArabicDigits(source)) };
  const before = escapeHtml(toGlobalSearchArabicDigits(source.slice(0, range.start)));
  const match = escapeHtml(toGlobalSearchArabicDigits(source.slice(range.start, range.end)));
  const after = escapeHtml(toGlobalSearchArabicDigits(source.slice(range.end)));
  return {
    found: true,
    html: `${before}<mark class="platform-search-report-text-hit">${match}</mark>${after}`
  };
}

function getGlobalSearchDisplayColumns(result) {
  return Array.isArray(result?.display?.columns) ? result.display.columns : [];
}

function getGlobalSearchColumnValue(result, key) {
  const column = getGlobalSearchDisplayColumns(result).find((item) => item?.key === key);
  return String(column?.value || '').trim();
}

function renderGlobalSearchDisplayCell(column, content = null) {
  const value = String(column?.value || '').trim();
  const displayValue = toGlobalSearchArabicDigits(value || '—');
  const isNotes = column?.kind === 'notes' || /ملاحظ|توصية|وصف/.test(String(column?.label || ''));
  const classes = isNotes ? 'platform-search-note-value' : '';
  const rendered = content === null ? escapeHtml(displayValue) : content;
  return `<td class="${classes}" title="${escapeHtml(displayValue)}"><span>${rendered}</span></td>`;
}

function hasGlobalSearchAttachments(result) {
  return Number(result?.attachmentCount) > 0 && Boolean(String(result?.attachmentRef || '').trim());
}

function renderGlobalSearchViewButton(result, index) {
  if (!hasGlobalSearchAttachments(result)) return '<span class="platform-search-no-attachment">—</span>';
  return `<button type="button" class="platform-search-view-btn" data-search-action="attachments" data-search-result-index="${index}">عرض <span aria-hidden="true">(${toGlobalSearchArabicDigits(result.attachmentCount)})</span></button>`;
}

function renderGlobalSearchActions(result, index, includeView = true) {
  return `<div class="platform-search-actions">
    <button type="button" class="platform-search-inspect-btn" data-search-action="inspect" data-search-result-index="${index}">فحص</button>
    ${includeView && hasGlobalSearchAttachments(result) ? renderGlobalSearchViewButton(result, index) : ''}
  </div>`;
}

function renderGlobalSearchWeaponLines(result, column) {
  const entries = Array.isArray(result?.display?.weapons) ? result.display.weapons : [];
  if (!entries.length) return null;
  const label = String(column?.label || '');
  if (/بيانات السلاح|نوع السلاح|السلاح/.test(label)) {
    return `<div class="platform-search-weapon-lines">${entries.map((weapon) => `
      <span class="platform-search-weapon-line ${weapon.withdrawn ? 'is-withdrawn' : 'is-active'}">
        <b>${escapeHtml(toGlobalSearchArabicDigits(weapon.name || '—'))}</b>
        <em>${weapon.withdrawn ? 'مسحوب' : 'غير مسحوب'}</em>
      </span>`).join('')}</div>`;
  }
  if (/رقم الايداع|رقم الإيداع/.test(label)) {
    return `<div class="platform-search-weapon-lines">${entries.map((weapon) => `<span>${escapeHtml(toGlobalSearchArabicDigits(weapon.depositNumber || '—'))}</span>`).join('')}</div>`;
  }
  if (/تاريخ الايداع|تاريخ الإيداع/.test(label)) {
    return `<div class="platform-search-weapon-lines">${entries.map((weapon) => `<span>${escapeHtml(toGlobalSearchArabicDigits(weapon.depositDate || '—'))}</span>`).join('')}</div>`;
  }
  return null;
}

function renderGlobalSearchWeaponsRow(result, index, columns) {
  const visibleColumns = columns.filter((column) => String(column?.label || '') !== 'حالة السحب');
  const status = result?.display?.status || { code: 'empty', label: 'لا توجد بيانات' };
  return `<tr>${visibleColumns.map((column) => {
    const lines = renderGlobalSearchWeaponLines(result, column);
    return renderGlobalSearchDisplayCell(column, lines);
  }).join('')}
    <td class="platform-search-withdrawal-cell"><span class="platform-search-withdrawal-status is-${escapeHtml(status.code || 'empty')}">${escapeHtml(toGlobalSearchArabicDigits(status.label || '—'))}</span></td>
    <td class="platform-search-action-cell">${renderGlobalSearchActions(result, index)}</td>
  </tr>`;
}

function renderGlobalSearchRenewalRow(result, index, columns) {
  return `<tr>${columns.map((column) => renderGlobalSearchDisplayCell(column)).join('')}
    <td class="platform-search-action-cell">${renderGlobalSearchActions(result, index)}</td>
  </tr>`;
}

function renderGlobalSearchReportRow(result, index, columns) {
  const first = columns.slice(0, 2);
  const remaining = columns.slice(2);
  const lineCount = Math.max(0, Number(result?.display?.textIndex?.lineCount) || 0);
  return `<tr>${first.map((column) => renderGlobalSearchDisplayCell(column)).join('')}
    <td class="platform-search-report-index-cell">
      <button type="button" class="platform-search-report-plus ${lineCount ? 'has-text' : ''}" data-search-action="report-text-index" data-search-result-index="${index}" title="عرض نصوص القرار">+</button>
      ${lineCount ? `<small>${toGlobalSearchArabicDigits(lineCount)}</small>` : ''}
    </td>
    ${remaining.map((column) => renderGlobalSearchDisplayCell(column)).join('')}
    <td class="platform-search-action-cell">${renderGlobalSearchActions(result, index)}</td>
  </tr>`;
}

function renderGlobalSearchSeizedRow(result, index, columns) {
  return `<tr>${columns.map((column) => renderGlobalSearchDisplayCell(column)).join('')}
    <td class="platform-search-action-cell">${renderGlobalSearchActions(result, index)}</td>
  </tr>`;
}

function renderGlobalSearchRequestRow(result, index) {
  const summary = result?.display?.summary || {};
  const notes = String(summary.notes || '').trim();
  return `<article class="platform-search-request-record">
    <div class="platform-search-request-heading">
      <strong title="${escapeHtml(toGlobalSearchArabicDigits(summary.name || result?.name || '—'))}">${escapeHtml(toGlobalSearchArabicDigits(summary.name || result?.name || '—'))}</strong>
      <span>${escapeHtml(toGlobalSearchArabicDigits(summary.applicationDate || '—'))}</span>
    </div>
    <div class="platform-search-request-details">
      <span><b>القطاع:</b> ${escapeHtml(toGlobalSearchArabicDigits(summary.sector || result?.sector || '—'))}</span>
      <span><b>القسم:</b> ${escapeHtml(toGlobalSearchArabicDigits(summary.station || result?.station || '—'))}</span>
      <span><b>بيانات السلاح:</b> ${escapeHtml(toGlobalSearchArabicDigits(summary.weapon || '—'))}</span>
      <span class="platform-search-note-value" title="${escapeHtml(toGlobalSearchArabicDigits(notes || '—'))}"><b>ملاحظات:</b> ${escapeHtml(toGlobalSearchArabicDigits(notes || '—'))}</span>
    </div>
    <div class="platform-search-request-actions">${renderGlobalSearchActions(result, index)}</div>
  </article>`;
}

function renderGlobalSearchTable(programKey, items, columns, rowRenderer, extraHeaders = []) {
  return `<div class="platform-search-native-table-wrap">
    <table class="platform-search-native-table platform-search-native-table--${escapeHtml(programKey)}">
      <thead><tr>${columns.map((column) => `<th>${escapeHtml(column?.label || '—')}</th>`).join('')}${extraHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
      <tbody>${items.map(({ result, index }) => {
        const rowColumns = getGlobalSearchDisplayColumns(result);
        return rowRenderer(result, index, rowColumns.length ? rowColumns : columns);
      }).join('')}</tbody>
    </table>
  </div>`;
}

function renderGlobalSearchGenericRow(result, index, columns) {
  return `<tr>${columns.map((column) => renderGlobalSearchDisplayCell(column)).join('')}<td class="platform-search-action-cell">${renderGlobalSearchActions(result, index)}</td></tr>`;
}

function renderGlobalSearchProgramSection(programKey, items) {
  const firstResult = items[0]?.result || {};
  const displayColumns = getGlobalSearchDisplayColumns(firstResult);
  const label = String(firstResult.programName || programKey || 'برنامج').trim();
  const icon = getGlobalSearchProgramIcon(firstResult);
  let content = '';
  if (programKey === 'weapons') {
    const columns = displayColumns.filter((column) => String(column?.label || '') !== 'حالة السحب');
    content = renderGlobalSearchTable(programKey, items, columns, renderGlobalSearchWeaponsRow, ['حالة السحب', 'إجراءات']);
  } else if (programKey === 'renewal') {
    content = renderGlobalSearchTable(programKey, items, displayColumns, renderGlobalSearchRenewalRow, ['إجراءات']);
  } else if (programKey === 'report') {
    const headers = displayColumns.slice(0, 2).concat([{ label: '+' }], displayColumns.slice(2));
    content = `<div class="platform-search-native-table-wrap"><table class="platform-search-native-table platform-search-native-table--report">
      <thead><tr>${headers.map((column) => `<th>${escapeHtml(column.label || '—')}</th>`).join('')}<th>إجراءات</th></tr></thead>
      <tbody>${items.map(({ result, index }) => {
        const rowColumns = getGlobalSearchDisplayColumns(result);
        return renderGlobalSearchReportRow(result, index, rowColumns.length ? rowColumns : displayColumns);
      }).join('')}</tbody>
    </table></div>`;
  } else if (programKey === 'seized') {
    content = renderGlobalSearchTable(programKey, items, displayColumns, renderGlobalSearchSeizedRow, ['إجراءات']);
  } else if (programKey === 'request') {
    content = `<div class="platform-search-request-list">${items.map(({ result, index }) => renderGlobalSearchRequestRow(result, index)).join('')}</div>`;
  } else {
    content = renderGlobalSearchTable(programKey, items, displayColumns, renderGlobalSearchGenericRow, ['إجراءات']);
  }
  return `<section class="platform-search-app-section" data-program="${escapeHtml(programKey)}">
    <header class="platform-search-app-header">
      <span class="platform-search-program-icon" aria-hidden="true">${escapeHtml(icon)}</span>
      <div><h4>${escapeHtml(label)}</h4><p>${toGlobalSearchArabicDigits(items.length)} ${items.length === 1 ? 'نتيجة' : 'نتائج'}</p></div>
    </header>
    ${content}
  </section>`;
}

function closeGlobalSearchReportTextIndex() {
  document.getElementById('platformSearchReportTextModal')?.remove();
}

function openGlobalSearchReportTextIndex(result) {
  closeGlobalSearchReportTextIndex();
  const text = String(result?.display?.textIndex?.text || '').trim();
  const activeSearch = String(getPlatformSearchElements().input?.value || '').trim();
  let highlightedText = buildGlobalSearchReportTextHighlight(text, activeSearch);
  if (!highlightedText.found && result?.name) {
    highlightedText = buildGlobalSearchReportTextHighlight(text, result.name);
  }
  const modal = document.createElement('div');
  modal.id = 'platformSearchReportTextModal';
  modal.className = 'platform-search-report-text-modal';
  modal.innerHTML = `<div class="platform-search-report-text-dialog" role="dialog" aria-modal="true" aria-label="نصوص القرار">
    <header><div><h4>نصوص القرار</h4><p>${escapeHtml(toGlobalSearchArabicDigits(result?.name || '—'))} · قرار ${escapeHtml(toGlobalSearchArabicDigits(getGlobalSearchColumnValue(result, 'decisionNumber') || '—'))}</p></div><button type="button" data-close-report-text>إغلاق</button></header>
    <pre>${text ? highlightedText.html : escapeHtml('لا توجد نصوص محفوظة لهذا القرار.')}</pre>
  </div>`;
  modal.addEventListener('click', (event) => {
    if (event.target === modal || (event.target instanceof Element && event.target.closest('[data-close-report-text]'))) closeGlobalSearchReportTextIndex();
  });
  document.body.appendChild(modal);
  if (highlightedText.found) {
    window.requestAnimationFrame(() => {
      modal.querySelector('.platform-search-report-text-hit')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
}

function renderGlobalSearchResults(results, query) {
  const { groups, title, subtitle } = getPlatformSearchElements();
  closeGlobalSearchReportTextIndex();
  platformSearchResults = Array.isArray(results) ? results.slice() : [];
  const cleanQuery = String(query || '').trim();
  if (title) title.textContent = 'نتائج البحث العام';
  if (subtitle) subtitle.textContent = cleanQuery ? `نتائج البحث عن "${toGlobalSearchArabicDigits(cleanQuery)}"` : 'اكتب اسماً أو رقم رخصة للبحث في البرامج.';
  if (!groups) return;
  if (!platformSearchResults.length) {
    groups.innerHTML = '<div class="platform-search-empty">لا توجد نتائج مطابقة.</div>';
    setPlatformSearchStatus(cleanQuery ? 'لم يتم العثور على نتائج.' : 'اكتب حرفين على الأقل ثم اضغط بحث.');
    return;
  }
  const grouped = new Map();
  platformSearchResults.forEach((result, index) => {
    const key = String(result?.programKey || 'other').trim().toLowerCase() || 'other';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ result, index });
  });
  const keys = [...grouped.keys()].sort((left, right) => {
    const leftIndex = GLOBAL_SEARCH_APP_ORDER.indexOf(left);
    const rightIndex = GLOBAL_SEARCH_APP_ORDER.indexOf(right);
    return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex);
  });
  groups.innerHTML = keys.map((key) => renderGlobalSearchProgramSection(key, grouped.get(key))).join('');
  setPlatformSearchStatus(`تم العثور على ${toGlobalSearchArabicDigits(platformSearchResults.length)} نتيجة في ${toGlobalSearchArabicDigits(keys.length)} برامج.`);
}

async function openGlobalSearchAttachmentsCombined(result, button) {
  const reference = String(result?.attachmentRef || '').trim();
  if (!reference) return;

  const previousText = button ? button.textContent : '';
  if (button) {
    button.disabled = true;
    button.textContent = 'جارٍ التجهيز...';
    button.setAttribute('aria-busy', 'true');
  }

  try {
    const response = await fetchWithAuth(`${GLOBAL_SEARCH_API_ENDPOINT}/attachments/${encodeURIComponent(reference)}`, { method: 'GET' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || 'تعذر تحميل المرفقات.');
    }
    const attachments = Array.isArray(payload?.attachments) ? payload.attachments : [];
    if (!attachments.length) {
      window.alert('لا توجد مرفقات لعرضها.');
      return;
    }

    // Map platform attachments to objects with URLs so we can reuse the PDF combiner
    const mapped = attachments.map((att) => ({
      url: getGlobalSearchAttachmentFileUrl(reference, att.id || att.fileId || att.file || ''),
      mimeType: att.mimeType || att.type || '',
      name: att.name || att.filename || att.label || ''
    })).filter((attachment) => {
      const type = String(attachment.mimeType || '');
      const name = String(attachment.name || '');
      return attachment.url && (/pdf|png|jpe?g/i.test(type) || /\.(pdf|png|jpe?g)$/i.test(name));
    });

    if (!mapped.length) {
      throw new Error('لا توجد ملفات قابلة للعرض الموحد. المتاح حالياً: PDF و JPG و PNG.');
    }

    const pdfBytes = await combineDeleteApprovalAttachmentsToPdf(mapped);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    const viewer = window.open(blobUrl, '_blank');
    if (!viewer) {
      window.alert('تعذر فتح نافذة العرض.');
    }
    setTimeout(() => {
      try { URL.revokeObjectURL(blobUrl); } catch (_) {}
    }, 60000);
  } catch (error) {
    window.alert(error.message || 'تعذر تجهيز ملف العرض.');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousText || 'عرض';
      button.removeAttribute('aria-busy');
    }
  }
}

function persistGlobalSearchInspectTarget(result) {
  const programKey = String(result?.programKey || '').trim().toLowerCase();
  const name = String(result?.name || '').trim();
  const license = String(result?.licenseNumber || result?.license || '').trim();
  const recordNumber = String(result?.recordNumber || result?.recordId || result?.id || '').trim();
  const target = {
    source: 'global-search',
    programKey,
    name,
    license,
    recordNumber,
    sector: String(result?.sector || '').trim(),
    station: String(result?.station || '').trim(),
    dataset: String(result?.datasetKey || result?.dataset || '').trim(),
    createdAt: new Date().toISOString()
  };

  try {
    sessionStorage.setItem(DELETE_APPROVAL_INSPECT_STORAGE_KEY, JSON.stringify(target));
    const query = String(getPlatformSearchElements().input?.value || '').trim();
    if (query.length >= 2) {
      sessionStorage.setItem(GLOBAL_SEARCH_RETURN_STORAGE_KEY, JSON.stringify({
        source: 'global-search',
        query,
        programKey,
        returnUrl: '/dashboard?globalSearchReturn=1',
        createdAt: new Date().toISOString()
      }));
    }
  } catch (_) {}

  if (programKey === 'weapons') {
    try {
      localStorage.setItem(WEAPONS_SHEET_FOCUS_STORAGE_KEY, JSON.stringify({
        name,
        license,
        timestamp: Date.now()
      }));
    } catch (_) {}
  }
}

function openGlobalSearchResult(result) {
  const programKey = String(result?.programKey || '').trim().toLowerCase();
  if (!programKey) return;
  if (!isAppAllowed(getUser(), programKey)) {
    window.alert('لا تملك صلاحية الوصول إلى هذا التطبيق.');
    return;
  }
  const targetUrl = String(result?.inspectUrl || DELETE_APPROVAL_INSPECT_URLS[programKey] || '').trim();
  if (!targetUrl) {
    window.alert('لا يوجد مسار فحص لهذا البرنامج.');
    return;
  }
  persistGlobalSearchInspectTarget(result);
  markActivityNavigation(`global-search-${programKey}`);
  window.location.href = targetUrl;
}

async function runGlobalSearch(query, submitButton) {
  if (!canUseGlobalSearch(getUser())) return;
  const cleanQuery = String(query || '').trim();
  openPlatformSearchPanel();
  if (cleanQuery.length < 2) {
    renderGlobalSearchResults([], cleanQuery);
    setPlatformSearchStatus('اكتب حرفين على الأقل ثم اضغط بحث.');
    return;
  }

  const button = submitButton || getPlatformSearchElements().submit;
  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  }
  setPlatformSearchStatus('جاري البحث...');

  try {
    const response = await fetchWithAuth(`${GLOBAL_SEARCH_API_ENDPOINT}?q=${encodeURIComponent(cleanQuery)}`, { method: 'GET' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || 'تعذر تنفيذ البحث.');
    }
    renderGlobalSearchResults(Array.isArray(payload?.results) ? payload.results : [], cleanQuery);
  } catch (error) {
    const { groups } = getPlatformSearchElements();
    platformSearchResults = [];
    if (groups) {
      groups.innerHTML = '<div class="platform-search-empty">تعذر تنفيذ البحث الآن.</div>';
    }
    setPlatformSearchStatus(error.message || 'تعذر تنفيذ البحث.');
  } finally {
    if (button) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }
}

function initGlobalSearch(user) {
  const {
    form,
    input,
    submit,
    closeButton,
    panel,
    groups
  } = getPlatformSearchElements();
  const allowed = canUseGlobalSearch(user);
  if (form) {
    form.classList.toggle('hidden', !allowed);
    form.hidden = !allowed;
    form.setAttribute('aria-hidden', allowed ? 'false' : 'true');
  }
  if (!allowed) {
    closePlatformSearchPanel();
    return;
  }
  if (form && !form.dataset.bound) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void runGlobalSearch(input ? input.value : '', submit);
    });
    form.dataset.bound = 'true';
  }
  if (closeButton && !closeButton.dataset.bound) {
    closeButton.addEventListener('click', closePlatformSearchPanel);
    closeButton.dataset.bound = 'true';
  }
  if (panel && !panel.dataset.bound) {
    panel.addEventListener('click', (event) => {
      if (event.target === panel) closePlatformSearchPanel();
    });
    panel.dataset.bound = 'true';
  }
  if (groups && !groups.dataset.bound) {
    groups.addEventListener('click', (event) => {
      const button = event.target instanceof Element
        ? event.target.closest('[data-search-result-index]')
        : null;
      if (!button) return;
      event.preventDefault();
      const index = Number(button.getAttribute('data-search-result-index'));
      if (!Number.isInteger(index) || index < 0 || index >= platformSearchResults.length) return;
      const result = platformSearchResults[index];
      const action = button.getAttribute('data-search-action');
      if (action === 'attachments') {
        void openGlobalSearchAttachmentsCombined(result, button);
      } else if (action === 'report-text-index') {
        openGlobalSearchReportTextIndex(result);
      } else {
        openGlobalSearchResult(result);
      }
    });
    groups.dataset.bound = 'true';
  }
  if (!document.body.dataset.globalSearchEscapeBound) {
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (document.getElementById('platformSearchReportTextModal')) closeGlobalSearchReportTextIndex();
      else closePlatformSearchPanel();
    });
    document.body.dataset.globalSearchEscapeBound = 'true';
  }
}

async function restoreGlobalSearchReturnState() {
  const url = new URL(window.location.href);
  if (url.searchParams.get('globalSearchReturn') !== '1') return;

  let state = null;
  try {
    state = JSON.parse(sessionStorage.getItem(GLOBAL_SEARCH_RETURN_STORAGE_KEY) || 'null');
    sessionStorage.removeItem(GLOBAL_SEARCH_RETURN_STORAGE_KEY);
  } catch (_) {
    try { sessionStorage.removeItem(GLOBAL_SEARCH_RETURN_STORAGE_KEY); } catch (_) {}
  }

  url.searchParams.delete('globalSearchReturn');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  const query = String(state?.source === 'global-search' ? state.query : '').trim();
  if (query.length < 2) return;
  const { input, submit } = getPlatformSearchElements();
  if (input) input.value = query;
  await runGlobalSearch(query, submit);
}

async function decideDeleteApproval(id, action, button) {
  if (!id || (action !== 'approve' && action !== 'deny')) return;
  const endpoint = action === 'approve'
    ? DELETE_APPROVAL_API_ENDPOINTS.approve(id)
    : DELETE_APPROVAL_API_ENDPOINTS.deny(id);
  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  }
  try {
    const response = await fetchWithAuth(endpoint, { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || 'تعذر حفظ القرار.');
    }
    await loadDeleteApprovals();
    renderDeleteApprovalPanel();
  } catch (error) {
    window.alert(error.message || 'تعذر حفظ القرار.');
  } finally {
    if (button) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }
}

async function decideDeleteApprovalItem(id, itemId, action, button) {
  if (!id || !itemId || (action !== 'approve' && action !== 'deny')) return;
  const endpoint = action === 'approve'
    ? DELETE_APPROVAL_API_ENDPOINTS.approveItem(id, itemId)
    : DELETE_APPROVAL_API_ENDPOINTS.denyItem(id, itemId);
  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  }
  try {
    const response = await fetchWithAuth(endpoint, { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || 'تعذر حفظ قرار السجل.');
    }
    await loadDeleteApprovals();
    renderDeleteApprovalPanel();
  } catch (error) {
    window.alert(error.message || 'تعذر حفظ قرار السجل.');
  } finally {
    if (button) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }
}

function closeActivityPanel() {
  const panel = document.getElementById('activityPanel');
  if (!panel) return;
  allActivityPanelOpen = false;
  allActivityRequestGeneration += 1;

  panel.classList.remove('visible');
  panel.setAttribute('aria-hidden', 'true');
}

function renderActivityLogPanel(payload) {
  allActivityPanelOpen = false;
  const panel = document.getElementById('activityPanel');
  const title = document.getElementById('activityPanelTitle');
  const subtitle = document.getElementById('activityPanelSubtitle');
  const body = document.getElementById('activityPanelBody');
  if (!panel || !title || !subtitle || !body) return;
  const user = payload?.user || null;
  const logs = Array.isArray(payload?.logs) ? payload.logs : [];
  const activeSessions = Array.isArray(payload?.activeSessions) ? payload.activeSessions : [];
  title.textContent = user?.displayName || user?.username || '—';
  subtitle.textContent = `${getRoleDisplayText(user || { role: 'user' }, 'detail')} • ${formatSectorDisplay(user?.sectors || user?.rooms || user?.room) || '—'}`;
  applyActivityPanelAccountTheme(panel, user);
  const activeMarkup = activeSessions.length
    ? activeSessions.map((entry) => `<li class="activity-live-item"><span class="activity-live-program">${escapeHtml(entry.programName || 'غير محدد')}</span><span class="activity-live-time">${escapeHtml(formatDateTime(entry.lastSeenAt))}</span></li>`).join('')
    : '<li class="activity-live-item empty">غير متصل حالياً</li>';
  const logsMarkup = logs.length
    ? logs.map((entry) => `<article class="activity-log-item"><div class="activity-log-time">${escapeHtml(formatDateTime(entry.occurredAt))}</div><div class="activity-log-message">${escapeHtml(entry.message || 'نشاط جديد')}</div><div class="activity-log-meta">${escapeHtml(entry.programName || entry.pageName || '—')}</div></article>`).join('')
    : '<p class="activity-log-empty">لا توجد سجلات محفوظة لهذا المستخدم حتى الآن.</p>';
  body.innerHTML = `
    <section class="activity-live-card"><h4>النشاط الحالي</h4><ul class="activity-live-list">${activeMarkup}</ul></section>
    <section class="activity-log-list-wrap"><h4>سجل الحركات</h4><div class="activity-log-list">${logsMarkup}</div></section>
  `;
  panel.classList.add('visible');
  panel.setAttribute('aria-hidden', 'false');
}

function buildActivityChangesMarkup(entry) {
  const changes = Array.isArray(entry?.details?.changes) ? entry.details.changes : [];
  if (!changes.length) return '';
  const rows = changes.map((change) => `
    <div class="activity-change-row">
      <strong>${escapeHtml(change?.label || change?.field || 'حقل')}</strong>
      <span class="activity-change-before">${escapeHtml(change?.before || '—')}</span>
      <span class="activity-change-arrow" aria-hidden="true">←</span>
      <span class="activity-change-after">${escapeHtml(change?.after || '—')}</span>
    </div>
  `).join('');
  return `<details class="activity-change-details"><summary>تفاصيل الحقول المعدلة (${changes.length})</summary><div class="activity-change-list">${rows}</div></details>`;
}

function isAllActivityRecordSearchChange(change) {
  if (!change || typeof change !== 'object') return false;
  const fieldKey = String(change.field || '').replace(/[\s_-]+/g, '').toLowerCase();
  const label = String(change.label || '');
  return ['name', 'fullname', 'requestername', 'companyname', 'license', 'licensenumber'].includes(fieldKey)
    || /الاسم|اسم الشركة|رقم الرخصة|رقم الترخيص|رقم القيد/.test(label);
}

function matchesAllActivityRecordQuery(entry, query) {
  const normalizedQuery = normalizeGlobalSearchReportTextValue(query);
  if (!normalizedQuery) return true;
  const details = entry?.details && typeof entry.details === 'object' ? entry.details : null;
  if (!details) return false;
  const values = [details.recordName, details.identifierValue];
  const changes = Array.isArray(details.changes) ? details.changes : [];
  changes.filter(isAllActivityRecordSearchChange).forEach((change) => {
    values.push(change.before, change.after);
  });
  return values.some((value) => normalizeGlobalSearchReportTextValue(value).includes(normalizedQuery));
}
function renderAllActivityEntry(entry) {
  const actor = entry?.displayName || entry?.username || 'النظام';
  const role = entry?.role ? getRoleDisplayText(entry, 'short') : '';
  const program = entry?.programName || entry?.pageName || '—';
  const eventType = String(entry?.eventType || 'event').replace(/:/g, '-');
  return `
    <article class="activity-log-item activity-global-item activity-event-${escapeHtml(eventType)}">
      <div class="activity-global-head">
        <div class="activity-global-actor"><strong>${escapeHtml(actor)}</strong>${role ? `<span>${escapeHtml(role)}</span>` : ''}</div>
        <time class="activity-log-time">${escapeHtml(formatDateTime(entry?.occurredAt))}</time>
      </div>
      <div class="activity-log-message">${escapeHtml(entry?.message || 'نشاط جديد')}</div>
      <div class="activity-log-meta">${escapeHtml(program)}${entry?.eventType ? ` • ${escapeHtml(entry.eventType)}` : ''}</div>
      ${buildActivityChangesMarkup(entry)}
    </article>
  `;
}

function updateAllActivityLoadState() {
  const button = document.getElementById('loadMoreActivityLogs');
  if (!button) return;
  button.disabled = allActivityLoading || !allActivityHasMore;
  button.textContent = allActivityLoading
    ? (allActivitySearchQuery ? 'جارٍ البحث في السجل...' : 'جارٍ تحميل النشاطات الأقدم...')
    : (allActivityHasMore
      ? 'تحميل نشاطات أقدم'
      : (allActivitySearchQuery ? 'تم عرض كل نتائج البحث' : 'تم عرض كل السجل المحفوظ'));
  button.classList.toggle('is-complete', !allActivityHasMore && !allActivityLoading);
}

function updateAllActivitySearchStatus() {
  const status = document.getElementById('allActivitySearchStatus');
  const list = document.getElementById('allActivityLogList');
  if (!status) return;
  if (allActivityLoading) {
    status.textContent = allActivitySearchQuery
      ? `جارٍ البحث عن «${allActivitySearchQuery}» في كل السجل...`
      : 'جارٍ تحميل سجل النشاط...';
    return;
  }
  const visibleCount = list ? list.querySelectorAll('.activity-global-item').length : 0;
  const filterName = allActivityUserFilter
    ? (allActivityKnownUsers.get(allActivityUserFilter) || allActivityUserFilter)
    : '';
  status.textContent = allActivitySearchQuery
    ? (visibleCount
      ? `تم عرض ${toArabicDigits(visibleCount)} نتيجة مطابقة للاسم أو رقم الرخصة${filterName ? ` لنشاط «${filterName}»` : ''}${allActivityHasMore ? ' حتى الآن' : ''}.`
      : `لا توجد سجلات معدلة تطابق «${allActivitySearchQuery}».`)
    : (filterName
      ? `يتم عرض نشاط «${filterName}» فقط.`
      : 'يمكنك البحث في السجلات المعدلة بالاسم أو رقم الرخصة.');
}

function applyAllActivitySearch(query) {
  const normalizedQuery = String(query || '').trim();
  if (!allActivityPanelOpen || normalizedQuery === allActivitySearchQuery) return;
  allActivitySearchQuery = normalizedQuery;
  restartAllActivityFeed();
}

function applyAllActivityUserFilter(username) {
  const normalized = String(username || '').trim();
  if (!allActivityPanelOpen || normalized === allActivityUserFilter) return;
  allActivityUserFilter = normalized;
  restartAllActivityFeed();
}

function restartAllActivityFeed() {
  allActivityCursor = '';
  allActivityHasMore = true;
  allActivityLoading = false;
  allActivityRequestGeneration += 1;
  const list = document.getElementById('allActivityLogList');
  if (list) list.innerHTML = '';
  updateAllActivitySearchStatus();
  updateAllActivityLoadState();
  void loadMoreActivityLogs();
}

function rememberAllActivityUsers(entries = []) {
  let changed = false;
  entries.forEach((entry) => {
    const username = String(entry?.username || '').trim();
    if (!username) return;
    const displayName = String(entry?.displayName || '').trim() || username;
    const known = allActivityKnownUsers.get(username);
    if (!known || (known === username && displayName !== username)) {
      allActivityKnownUsers.set(username, displayName);
      changed = true;
    }
  });
  if (changed) renderAllActivityUserOptions();
}

function renderAllActivityUserOptions() {
  const select = document.getElementById('allActivityUserFilter');
  if (!select) return;
  const users = Array.from(allActivityKnownUsers.entries())
    .map(([username, displayName]) => ({ username, displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ar', { sensitivity: 'base', numeric: true }));
  select.innerHTML = [
    '<option value="">كل المستخدمين</option>',
    ...users.map((user) => {
      const suffix = user.displayName === user.username ? '' : ` (@${escapeHtml(user.username)})`;
      return `<option value="${escapeHtml(user.username)}">${escapeHtml(user.displayName)}${suffix}</option>`;
    })
  ].join('');
  select.value = allActivityUserFilter;
  if (select.value !== allActivityUserFilter) select.value = '';
}
async function loadMoreActivityLogs() {
  if (!allActivityPanelOpen || allActivityLoading || !allActivityHasMore) return;
  const requestGeneration = allActivityRequestGeneration;
  const requestQuery = allActivitySearchQuery;
  const requestUserFilter = allActivityUserFilter;
  allActivityLoading = true;
  updateAllActivityLoadState();
  updateAllActivitySearchStatus();
  try {
    const response = await fetchWithAuth(ACTIVITY_API_ENDPOINTS.allLogs(allActivityCursor, 100, allActivitySearchQuery, allActivityUserFilter), { method: 'GET' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (
      requestGeneration !== allActivityRequestGeneration
      || requestQuery !== allActivitySearchQuery
      || requestUserFilter !== allActivityUserFilter
    ) return;
    const logs = Array.isArray(payload?.logs) ? payload.logs : [];
    rememberAllActivityUsers(logs);
    const matchingLogs = requestQuery
      ? logs.filter((entry) => matchesAllActivityRecordQuery(entry, requestQuery))
      : logs;
    const list = document.getElementById('allActivityLogList');
    if (list && matchingLogs.length) {
      list.querySelector('.activity-log-empty')?.remove();
      list.insertAdjacentHTML('beforeend', matchingLogs.map(renderAllActivityEntry).join(''));
    }
    allActivityCursor = payload?.nextCursor || '';
    allActivityHasMore = Boolean(payload?.hasMore && allActivityCursor);
    if (list && !list.children.length) {
      const emptyMessage = allActivitySearchQuery
        ? 'لا توجد سجلات معدلة مطابقة للاسم أو رقم الرخصة.'
        : (allActivityUserFilter
          ? `لا توجد نشاطات محفوظة لـ «${allActivityKnownUsers.get(allActivityUserFilter) || allActivityUserFilter}».`
          : 'لا توجد نشاطات محفوظة حتى الآن.');
      list.innerHTML = `<p class="activity-log-empty">${emptyMessage}</p>`;
    }
  } catch (error) {
    if (requestGeneration !== allActivityRequestGeneration) return;
    console.error('Load all activity logs failed:', error);
    const list = document.getElementById('allActivityLogList');
    if (list && !list.children.length) {
      list.innerHTML = '<p class="activity-log-empty">تعذر تحميل سجل النشاط الكامل.</p>';
    }
  } finally {
    if (requestGeneration !== allActivityRequestGeneration) return;
    allActivityLoading = false;
    updateAllActivityLoadState();
    updateAllActivitySearchStatus();
  }
}
function openAllActivityPanel() {
  const panel = document.getElementById('activityPanel');
  const title = document.getElementById('activityPanelTitle');
  const subtitle = document.getElementById('activityPanelSubtitle');
  const body = document.getElementById('activityPanelBody');
  if (!panel || !title || !subtitle || !body) return;

  allActivityCursor = '';
  allActivityHasMore = true;
  allActivityLoading = false;
  allActivityPanelOpen = true;
  allActivitySearchQuery = '';
  allActivityUserFilter = '';
  allActivityRequestGeneration += 1;
  allActivityKnownUsers.clear();
  (Array.isArray(currentRosterUsers) ? currentRosterUsers : []).forEach((user) => {
    if (user?.username) {
      allActivityKnownUsers.set(String(user.username), String(user.displayName || user.username));
    }
  });
  if (activeSession?.user?.username) {
    allActivityKnownUsers.set(
      String(activeSession.user.username),
      String(activeSession.user.displayName || activeSession.user.username)
    );
  }
  title.textContent = 'كل النشاطات';
  subtitle.textContent = 'كل المستخدمين والبرامج مرتبة من الأحدث إلى الأقدم';
  applyActivityPanelAccountTheme(panel, activeSession.user || { role: 'admin' });
  body.innerHTML = `
    <section class="activity-log-list-wrap activity-global-wrap">
      <form class="activity-history-search" id="allActivitySearchForm" role="search" autocomplete="off">
        <label for="allActivityUserFilter">تصفية حسب المستخدم</label>
        <div class="activity-history-search-row">
          <select id="allActivityUserFilter" class="activity-user-filter" aria-label="تصفية النشاطات حسب المستخدم"></select>
        </div>
        <label for="allActivitySearchInput">البحث في السجلات المعدلة</label>
        <div class="activity-history-search-row">
          <input type="search" id="allActivitySearchInput" placeholder="ابحث بالاسم أو رقم الرخصة" aria-describedby="allActivitySearchStatus" />
          <button type="submit" class="btn primary">بحث</button>
        </div>
        <p class="activity-history-search-status" id="allActivitySearchStatus" role="status" aria-live="polite">يمكنك البحث في السجلات المعدلة بالاسم أو رقم الرخصة.</p>
      </form>
      <h4>المسار الزمني الكامل</h4>
      <div class="activity-log-list activity-global-list" id="allActivityLogList"></div>
      <button type="button" class="btn ghost activity-load-more" id="loadMoreActivityLogs">تحميل نشاطات أقدم</button>
    </section>
  `;
  const list = document.getElementById('allActivityLogList');
  const loadButton = document.getElementById('loadMoreActivityLogs');
  const searchForm = document.getElementById('allActivitySearchForm');
  const searchInput = document.getElementById('allActivitySearchInput');
  const userFilterSelect = document.getElementById('allActivityUserFilter');
  renderAllActivityUserOptions();
  if (loadButton) loadButton.addEventListener('click', () => void loadMoreActivityLogs());
  if (searchForm && searchInput) {
    searchForm.addEventListener('submit', (event) => {
      event.preventDefault();

      applyAllActivitySearch(searchInput.value);
    });

  }
  if (userFilterSelect) {
    userFilterSelect.addEventListener('change', () => {
      applyAllActivityUserFilter(userFilterSelect.value);
    });
  }
  if (list) {
    list.addEventListener('scroll', () => {
      if (list.scrollTop + list.clientHeight >= list.scrollHeight - 320) {
        void loadMoreActivityLogs();
      }
    });
  }
  panel.classList.add('visible');
  panel.setAttribute('aria-hidden', 'false');
  void loadMoreActivityLogs();
}
function renderAccountDetailsPanel(user) {
  allActivityPanelOpen = false;
  const panel = document.getElementById('activityPanel');
  const title = document.getElementById('activityPanelTitle');
  const subtitle = document.getElementById('activityPanelSubtitle');
  const body = document.getElementById('activityPanelBody');
  if (!panel || !title || !subtitle || !body || !user) return;

  const sectors = formatSectorDisplay(user.sectors || user.rooms || user.room) || '—';
  const allowedApps = Array.isArray(user.allowedApps) && user.allowedApps.length
    ? user.allowedApps
        .filter((key) => key !== 'settings')
        .map((key) => `<li class="app-pill">${escapeHtml(cachedAppCatalog.find((entry) => entry.key === key)?.label || key)}</li>`)
        .join('')
    : '<li class="app-pill empty">لا توجد تطبيقات مفعلة</li>';

  title.textContent = user.displayName || user.username || '—';
  subtitle.textContent = `${getRoleDisplayText(user, 'detail')} • ${sectors}`;
  applyActivityPanelAccountTheme(panel, user);
  body.innerHTML = `
    <section class="activity-live-card account-view-card">
      <h4>بيانات الحساب</h4>
      <dl class="account-view-list">
        <div><dt>اسم المستخدم</dt><dd>@${escapeHtml(user.username || '—')}</dd></div>
        <div><dt>الاسم مكتب تجريبي 13</dt><dd>${escapeHtml(user.displayName || '—')}</dd></div>
        <div><dt>الدور</dt><dd>${escapeHtml(getRoleDisplayText(user, 'detail'))}</dd></div>
        <div><dt>القطاع</dt><dd>${escapeHtml(sectors)}</dd></div>
      </dl>
    </section>
    <section class="activity-log-list-wrap account-view-card">
      <h4>التطبيقات المسموحة</h4>
      <ul class="app-pills">${allowedApps}</ul>
    </section>
  `;
  panel.classList.add('visible');
  panel.setAttribute('aria-hidden', 'false');
}

async function openAccountViewPanel(username) {
  if (!username) return;
  try {
    const response = await fetchWithAuth(`/api/users/${encodeURIComponent(username)}`, { method: 'GET' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    renderAccountDetailsPanel(payload.user);
  } catch (error) {
    console.error('Open account view failed:', error);
    window.alert('تعذر تحميل بيانات الحساب');
  }
}

async function openActivityPanel(username) {
  if (!username) return;
  try {
    const response = await fetchWithAuth(ACTIVITY_API_ENDPOINTS.userLogs(username), { method: 'GET' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderActivityLogPanel(await response.json());
  } catch (error) {
    console.error('Open dashboard activity panel failed:', error);
    window.alert('تعذر تحميل سجل النشاط');
  }
}

function openUserEditorFromDashboard(username) {
  if (!username) return;
  try {
    sessionStorage.setItem('general.pendingEditUser', username);
  } catch (_) {}
  markActivityNavigation('edit-user');
  window.location.href = `settings.html?edit=${encodeURIComponent(username)}`;
}

function configureActivityStripControls(mode) {
  currentActivityStripMode = mode;
  const activeFilterBtn = document.getElementById('filterActiveUsers');
  const notificationFilterBtn = document.getElementById('filterWithNotifications');
  const allActivityBtn = document.getElementById('showAllActivity');
  const hideActiveFilter = mode !== 'admin';
  const hideNotificationFilter = mode === 'hidden' || mode === 'reviewer';

  if (allActivityBtn) {
    const hideAllActivity = mode === 'hidden' || !canViewActivityHistory(getUser());
    allActivityBtn.classList.toggle('hidden', hideAllActivity);
    allActivityBtn.hidden = hideAllActivity;
    allActivityBtn.disabled = hideAllActivity;
    allActivityBtn.setAttribute('aria-hidden', hideAllActivity ? 'true' : 'false');
  }

  if (activeFilterBtn) {
    activeFilterBtn.classList.toggle('hidden', hideActiveFilter || mode === 'hidden');
    activeFilterBtn.hidden = hideActiveFilter || mode === 'hidden';
    activeFilterBtn.disabled = hideActiveFilter || mode === 'hidden';
    activeFilterBtn.setAttribute('aria-hidden', hideActiveFilter || mode === 'hidden' ? 'true' : 'false');
    if (hideActiveFilter || mode === 'hidden') {
      activeFilterBtn.classList.remove('is-active');
    }
  }

  if (notificationFilterBtn) {
    notificationFilterBtn.classList.toggle('hidden', hideNotificationFilter);
    notificationFilterBtn.hidden = hideNotificationFilter;
    notificationFilterBtn.disabled = hideNotificationFilter;
    notificationFilterBtn.setAttribute('aria-hidden', hideNotificationFilter ? 'true' : 'false');
    if (hideNotificationFilter) {
      notificationFilterBtn.classList.remove('is-active');
    }
  }
}

function bindActivityStripEvents() {
  const allActivityBtn = document.getElementById('showAllActivity');
  if (allActivityBtn && !allActivityBtn.dataset.bound) {
    allActivityBtn.addEventListener('click', openAllActivityPanel);
    allActivityBtn.dataset.bound = 'true';
  }

  const filterBtn = document.getElementById('filterActiveUsers');
  if (filterBtn && !filterBtn.dataset.bound) {
    filterBtn.addEventListener('click', () => {
      if (currentActivityStripMode !== 'admin') return;
      filterBtn.classList.toggle('is-active');
      renderCurrentActivityRoster();
    });
    filterBtn.dataset.bound = 'true';
  }

  const filterNotifBtn = document.getElementById('filterWithNotifications');
  if (filterNotifBtn && !filterNotifBtn.dataset.bound) {
    filterNotifBtn.addEventListener('click', async () => {
      filterNotifBtn.classList.toggle('is-active');
      if (filterNotifBtn.classList.contains('is-active')) {
        await loadDeleteApprovals();
      }
      renderCurrentActivityRoster();
    });
    filterNotifBtn.dataset.bound = 'true';
  }

  const list = document.getElementById('activeUsersList');
  if (list && !list.dataset.bound) {
    list.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;

      const deleteBadge = event.target.closest('[data-delete-approval-requester]');
      if (deleteBadge) {
        event.preventDefault();
        event.stopPropagation();
        openDeleteApprovalPanel(deleteBadge.getAttribute('data-delete-approval-requester') || '');
        return;
      }

      const actionButton = event.target.closest('[data-account-action]');
      if (actionButton) {
        const action = actionButton.getAttribute('data-account-action') || '';
        const username = actionButton.getAttribute('data-account-user') || '';
        if (action === 'view') void openAccountViewPanel(username);
        else if (action === 'edit') openUserEditorFromDashboard(username);
        else if (action === 'history') void openActivityPanel(username);
        return;
      }

      const target = event.target.closest('[data-activity-user]');
      if (target) void openActivityPanel(target.getAttribute('data-activity-user') || '');
    });
    list.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('[data-delete-approval-requester]')) return;
      const target = event.target.closest('[data-activity-user]');
      const accountTarget = target || event.target.closest('[data-account-action="view"]');
      if (!accountTarget) return;
      event.preventDefault();
      const username = accountTarget.getAttribute('data-activity-user') || accountTarget.getAttribute('data-account-user') || '';
      if (target) void openActivityPanel(username);
      else void openAccountViewPanel(username);
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
      if (event.target === panel) closeActivityPanel();
    });
    panel.dataset.bound = 'true';
  }
  const deleteCloseBtn = document.getElementById('closeDeleteApprovalPanel');
  if (deleteCloseBtn && !deleteCloseBtn.dataset.bound) {
    deleteCloseBtn.addEventListener('click', closeDeleteApprovalPanel);
    deleteCloseBtn.dataset.bound = 'true';
  }
  const deletePanel = document.getElementById('deleteApprovalPanel');
  if (deletePanel && !deletePanel.dataset.bound) {
    deletePanel.addEventListener('click', (event) => {
      if (event.target === deletePanel) {
        closeDeleteApprovalPanel();
        return;
      }
      const inspectButton = event.target instanceof Element
        ? event.target.closest('[data-delete-approval-inspect-action]')
        : null;
      if (inspectButton) {
        event.preventDefault();
        openDeleteApprovalInspectTarget(
          inspectButton.getAttribute('data-delete-approval-id') || '',
          inspectButton.getAttribute('data-delete-approval-item-id') || ''
        );
        return;
      }
      const itemActionButton = event.target instanceof Element
        ? event.target.closest('[data-delete-approval-item-action]')
        : null;
      if (itemActionButton) {
        event.preventDefault();
        void decideDeleteApprovalItem(
          itemActionButton.getAttribute('data-delete-approval-id') || '',
          itemActionButton.getAttribute('data-delete-approval-item-id') || '',
          itemActionButton.getAttribute('data-delete-approval-item-action') || '',
          itemActionButton
        );
        return;
      }
      const actionButton = event.target instanceof Element
        ? event.target.closest('[data-delete-approval-action]')
        : null;
      if (!actionButton) return;
      event.preventDefault();
      const action = actionButton.getAttribute('data-delete-approval-action') || '';
      if (action === 'view-attachments') {
        void openDeleteApprovalAttachments(
          actionButton.getAttribute('data-delete-approval-id') || '',
          actionButton.getAttribute('data-delete-approval-item-id') || '',
          actionButton
        );
        return;
      }
      void decideDeleteApproval(
        actionButton.getAttribute('data-delete-approval-id') || '',
        action,
        actionButton
      );
    });
    deletePanel.dataset.bound = 'true';
  }
}

function setDashboardLayoutMode(withActivityStrip) {
  const layout = document.querySelector('.dashboard-layout');
  if (layout) layout.classList.toggle('has-activity-strip', Boolean(withActivityStrip));
}

function setActivityStripVisibility(visible) {
  const strip = document.getElementById('activityStrip');
  if (!strip) return;
  strip.classList.toggle('hidden', !visible);
  strip.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function stopActivityStripPolling() {
  if (activityStripPollHandle) {
    clearInterval(activityStripPollHandle);
    activityStripPollHandle = null;
  }
}

async function setupAdminActivityStrip() {
  configureActivityStripControls('admin');
  setDashboardLayoutMode(true);
  setActivityStripVisibility(true);
  bindActivityStripEvents();
  await loadActivityRoster();
  await loadDeleteApprovals();
  stopActivityStripPolling();
  activityStripPollHandle = window.setInterval(() => {
    void loadActivityRoster();
    void loadDeleteApprovals();
  }, ACTIVITY_STRIP_POLL_MS);
}

async function setupSuperSecretaryActivityStrip() {
  configureActivityStripControls('supersecretary');
  setDashboardLayoutMode(true);
  setActivityStripVisibility(true);
  bindActivityStripEvents();
  await loadDeleteApprovals();
  await loadActivityRoster();
  stopActivityStripPolling();
  activityStripPollHandle = window.setInterval(() => {
    void (async () => {
      await loadDeleteApprovals();
      await loadActivityRoster();
    })();
  }, ACTIVITY_STRIP_POLL_MS);
}

async function setupActivityReviewerStrip() {
  configureActivityStripControls('reviewer');
  setDashboardLayoutMode(true);
  setActivityStripVisibility(true);
  bindActivityStripEvents();
  await loadActivityRoster();
  stopActivityStripPolling();
  activityStripPollHandle = window.setInterval(() => {
    void loadActivityRoster();
  }, ACTIVITY_STRIP_POLL_MS);
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

async function performLogout() {
  const token = getToken();
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ token, reason: 'logout' }),
      keepalive: true
    });
  } catch (error) {
    console.warn('Logout request failed:', error);
  } finally {
    clearSessionStorage();
  }
}

async function logoutApp(event) {
  try { event && event.preventDefault && event.preventDefault(); } catch (_) {}
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

window.logoutApp = logoutApp;

async function initMainPage() {
  const session = await ensureAuthenticated();
  if (!session) return;
  await loadAppCatalog();
  renderDashboardCards(session.user);
  renderUserSummary(session.user);
  updateDashboardButtons(session.user);
  await setupModeToggle();
  wireProfileLinks();
  initGlobalSearch(session.user);
  await restoreGlobalSearchReturnState();
  if (isAdminUser(session.user)) {
    await setupAdminActivityStrip();
  } else if (isSuperSecretaryUser(session.user)) {
    await setupSuperSecretaryActivityStrip();
  } else if (canViewActivityHistory(session.user)) {
    await setupActivityReviewerStrip();
  } else {
    configureActivityStripControls('hidden');
    stopActivityStripPolling();
    currentActiveUsers = [];
    renderProgramPresenceHighlights([]);
    setDashboardLayoutMode(false);
    setActivityStripVisibility(false);
  }
}

document.addEventListener('visibilitychange', () => {
  const user = getUser();
  if (document.hidden) return;
  if (isAdminUser(user)) {
    void loadActivityRoster();
    void loadDeleteApprovals();
  } else if (isSuperSecretaryUser(user)) {
    void (async () => {
      await loadDeleteApprovals();
      await loadActivityRoster();
    })();
  } else if (canViewActivityHistory(user)) {
    void loadActivityRoster();
  }
});

window.addEventListener('beforeunload', () => {
  stopActivityStripPolling();
}, { once: true });

document.addEventListener('DOMContentLoaded', () => {
  initMainPage().catch((error) => {
    console.error('Dashboard initialization failed:', error);
  });
});
