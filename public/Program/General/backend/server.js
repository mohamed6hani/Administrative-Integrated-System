const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const http = require('node:http');
const { DEMO_ADMIN_PASSWORD, makeDemoAccounts } = require('./demo-accounts');
const { pathToFileURL } = require('url');
const {
  PROGRAM_ROOT,
  PROJECT_ROOT,
  appDataDir,
  dataSubdir,
  dataFile
} = require('./platform-paths');
const {
  loadReferenceData,
  saveReferenceData,
  sanitizeReferenceDataForClient,
  normalizeDisplayText: normalizeReferenceDisplayText,
  resolveSectorLabel,
  resolveStationName
} = require('./reference-data-store');
const {
  canUseGlobalSearch,
  isProtectedAdminEdit
} = require('./admin-account-policy');
const {
  canCustomizeDashboardApps,
  getEffectiveHiddenDashboardApps,
  normalizeHiddenDashboardApps
} = require('./dashboard-preferences');
const deleteApprovalStore = require('./delete-approval-store');
const { createActivityLogStore } = require('./activity-log-store');
const {
  canViewActivityHistory,
  readActivityHistoryPermission
} = require('./activity-history-permission');
const {
  applyLocalTestAccountPolicy,
  canUseLocalTestAccount,
  isLocalOnlyUser
} = require('./local-test-account');
const {
  listGlobalSearchAttachments,
  resolveGlobalSearchAttachment,
  searchPlatformRecords
} = require('./global-search-store');

function createLazyRouter(modulePath, { successMessage, failureMessage, createHandler } = {}) {
  let routerPromise = null;
  let reportedFailure = false;
  let reportedSuccess = false;

  const loadRouter = () => {
    if (!routerPromise) {
      routerPromise = import(pathToFileURL(modulePath).href)
        .then((module) => {
          const exported = module && (module.default || module.router || module);
          const handler = typeof createHandler === 'function'
            ? createHandler(exported, module)
            : exported;
          if (typeof handler !== 'function') {
            throw new TypeError('Router module did not export a middleware function');
          }
          if (!reportedSuccess && successMessage) {
            console.log(successMessage);
            reportedSuccess = true;
          }
          return handler;
        })
        .catch((error) => {
          if (!reportedFailure && failureMessage) {
            console.warn(failureMessage, error && error.message);
            reportedFailure = true;
          }
          throw error;
        });
    }
    return routerPromise;
  };

  return (req, res, next) => {
    loadRouter()
      .then((handler) => handler(req, res, next))
      .catch(next);
  };
}

const app = express();
const PDFJS_DIST_DIR = path.dirname(require.resolve('pdfjs-dist/package.json'));
const PORT = Number(process.env.PORT) || 3107;

// ========== USER STORE / AUTH UTILITIES ==========
const GENERAL_LEGACY_DATA_DIR = path.join(__dirname, '..', 'Data');
const GENERAL_LEGACY_AUTH_DIR = path.join(__dirname, 'data');
const GENERAL_LEGACY_SETTINGS_DIR = path.join(__dirname, 'settings');
const GENERAL_DATA_DIR = appDataDir('General', { legacyDirs: [GENERAL_LEGACY_DATA_DIR] });
const USERS_DIR = GENERAL_DATA_DIR;
const USERS_DB_PATH = dataFile('General', 'users.json', [
  path.join(GENERAL_LEGACY_AUTH_DIR, 'users.json')
]);
const APP_CONFIG_PATH = dataFile('General', 'app-config.json', [
  path.join(GENERAL_LEGACY_DATA_DIR, 'app-config.json')
]);
const DEFAULT_APP_CATALOG = [
  { key: 'settings', icon: '⚙️', label: 'الإعدادات', sub: 'إدارة الأفراد والصلاحيات', adminOnly: true },
  { key: 'weapons', icon: '🔐', label: 'برنامج الرخص الملغاة', sub: 'الرخص التي لم يتم سحبها', adminOnly: false },
  { key: 'renewal', icon: '📄', label: 'برنامج الملفات التي لم ترد', sub: '', adminOnly: false },
  { key: 'report', icon: '📊', label: 'برنامج القرارات', sub: 'سير العمل والقرارات', adminOnly: false },
  { key: 'accept', icon: '🤝', label: 'موافقة شؤون الضباط', sub: 'منصة اعتماد الترشيحات', adminOnly: false },
  { key: 'request', icon: '📝', label: 'برنامج طلبات ترخيص اول مرة', sub: 'استقبال واعتماد الطلبات', adminOnly: false },
  { key: 'seized', icon: '📦', label: 'برنامج الأحراز', sub: 'إدارة الأحراز والمصادرات', adminOnly: false },
  { key: 'storage', icon: '🗄️', label: 'التخزين الموحد', sub: 'مكتبة ملفات مشتركة حسب الصلاحيات', adminOnly: false },
  { key: 'company', icon: '🏢', label: 'إدارة شركات الحراسة', sub: 'شركات الحراسة ونقل الأموال', adminOnly: false }
];
const ALL_APP_KEYS = DEFAULT_APP_CATALOG.map((entry) => entry.key);
const ACCESS_CONTROLLED_APP_KEYS = ALL_APP_KEYS.filter((key) => key !== 'settings');
const ACCESS_CONTROLLED_APP_KEY_SET = new Set(ACCESS_CONTROLLED_APP_KEYS);
const ACTIVE_TOKENS = new Map();
const ACTIVE_CLIENTS = new Map();
const ACCESS_REVOKE_STREAMS = new Map(); // token -> Set<SSE response>
const ACTIVITY_SIGNALS = [];
let _usersCache = null;
let _referenceJsCache = null;       // { updatedAt, etag, body }
let _referenceRuntimeCache = null;  // { updatedAt, etag, body }
let _helperSourceCache = null;      // shared-reference-data.js file content, loaded once
const ROOT_DIR = PROJECT_ROOT;
const LOGS_ROOT_DIR = dataSubdir('General', 'logs');
const ACTIVITY_LOG_PATH = path.join(LOGS_ROOT_DIR, 'activity-log.jsonl');
const ACTIVITY_LOG_SEGMENTS_DIR = path.join(LOGS_ROOT_DIR, 'activity');
const ACTIVITY_LOG_STORE = createActivityLogStore({
  segmentsDir: ACTIVITY_LOG_SEGMENTS_DIR,
  legacyPath: ACTIVITY_LOG_PATH
});
const ACTIVITY_PRESENCE_TTL_MS = 25 * 1000;
const ACTIVITY_SIGNAL_TTL_MS = 20 * 1000;
const ACTIVITY_SIGNAL_LIMIT = 80;
const ACTIVITY_LOG_RESPONSE_LIMIT = 500;
const ACTIVITY_PRESENCE_STATES = {
  active: 'active',
  inactive: 'inactive',
  offline: 'offline'
};
const SYSTEM_ACTIVITY_API_PATTERNS = [
  /^\/api\/[^/]+\/tmp\/clear(?:$|[/?])/i,
  /^\/api\/[^/]+\/cleanup-tmp(?:$|[/?])/i,
  /^\/api\/[^/]+\/cleanup-temp(?:$|[/?])/i,
  /^\/api\/cleanup-tmp(?:$|[/?])/i,
  /^\/api\/cleanup-temp(?:$|[/?])/i
];
const SETTINGS_DIR = dataSubdir('General', 'settings', { legacyDirs: [GENERAL_LEGACY_SETTINGS_DIR] });
const THEME_SETTINGS_PATH = path.join(SETTINGS_DIR, 'settings.json');
const ADMIN_SECTOR_VALUE = 'الإدارة';
const DEFAULT_THEME_SETTINGS = {
  theme: 'light',
  updatedAt: new Date().toISOString()
};
const DEFAULT_APP_LABELS = DEFAULT_APP_CATALOG.reduce((map, entry) => {
  map[entry.key] = entry.label;
  return map;
}, {
  dashboard: 'اللوحة الرئيسية',
  profile: 'الملف الشخصي',
  general: 'المنصة العامة',
  login: 'تسجيل الدخول'
});

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createDefaultAppConfig() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    apps: DEFAULT_APP_CATALOG.map((entry) => ({ ...entry }))
  };
}

const ADMIN_ROLE = 'admin';
const SUPERSECRETARY_ROLE = 'supersecretary';
const SECRETARY_ROLE = 'secretary';
const USER_ROLE = 'user';
const MIN_PASSWORD_LENGTH = 6;
const DEFAULT_ADMIN_PASSWORD = DEMO_ADMIN_PASSWORD;
const DEFAULT_ADMIN_PASSWORD_HASH = hashPassword(DEFAULT_ADMIN_PASSWORD);
const LEGACY_PASSWORD_HASHES = new Set();

function normalizeRoleValue(value) {
  const normalized = String(value || USER_ROLE).trim().toLowerCase();
  if (normalized === ADMIN_ROLE) return ADMIN_ROLE;
  if (
    normalized === SUPERSECRETARY_ROLE
    || normalized === 'super-secretary'
    || normalized === 'super_secretary'
    || normalized === 'سيكرتير اول'
    || normalized === 'سيكرتير أول'
    || normalized === 'سكرتير اول'
    || normalized === 'سكرتير أول'
  ) return SUPERSECRETARY_ROLE;
  if (normalized === SECRETARY_ROLE) return SECRETARY_ROLE;
  return USER_ROLE;
}

function isAdminRole(user) {
  return user && normalizeRoleValue(user.role) === ADMIN_ROLE;
}

function isSuperSecretaryRole(user) {
  return user && normalizeRoleValue(user.role) === SUPERSECRETARY_ROLE;
}

function isSecretaryRole(user) {
  return user && normalizeRoleValue(user.role) === SECRETARY_ROLE;
}

function hasManagementRole(user) {
  return isAdminRole(user) || isSuperSecretaryRole(user) || isSecretaryRole(user);
}

function getSharedReferenceData() {
  return loadReferenceData();
}

function getSharedSectorStations() {
  return Object.fromEntries(
    (getSharedReferenceData().sectors || []).map((entry) => [
      entry.label,
      Array.isArray(entry.stations)
        ? entry.stations.map((station) => (typeof station === 'string' ? station : String(station && station.name || '').trim())).filter(Boolean)
        : []
    ])
  );
}

function normalizePermissionsValue(value, roleHint) {
  const role = normalizeRoleValue(roleHint || (value && value.role));
  const source = value && typeof value === 'object'
    ? (value.permissions && typeof value.permissions === 'object' ? value.permissions : value)
    : {};
  const manageReferenceData = role === ADMIN_ROLE || role === SUPERSECRETARY_ROLE || role === SECRETARY_ROLE
    ? true
    : Boolean(
      source.manageReferenceData
      || source.referenceDataEditor
      || source.referenceDataWrite
      || source.canManageReferenceData
    );
  const customizeDashboardApps = role === ADMIN_ROLE
    ? true
    : Boolean(
      source.customizeDashboardApps
      || source.dashboardAppCustomization
      || source.canCustomizeDashboardApps
    );
  const viewActivityHistory = role === ADMIN_ROLE
    ? true
    : readActivityHistoryPermission(source);
  const editRenewalDocuments = role === ADMIN_ROLE || role === SUPERSECRETARY_ROLE
    ? true
    : Boolean(source.editRenewalDocuments);
  return { manageReferenceData, customizeDashboardApps, viewActivityHistory, editRenewalDocuments };
}

function canManageReferenceData(user) {
  if (isAdminRole(user)) return true;
  if (isSuperSecretaryRole(user)) return true;
  if (isSecretaryRole(user)) return true;
  return false;
}

function canViewUsers(user) {
  return isAdminRole(user) || isSuperSecretaryRole(user);
}

function canManageAppCatalog(user) {
  return isAdminRole(user) || isSuperSecretaryRole(user);
}

function canCreateManagedUsers(user) {
  return isAdminRole(user) || isSuperSecretaryRole(user);
}

function canCreateUserRole(actor, requestedRole) {
  const role = normalizeRoleValue(requestedRole);
  if (isAdminRole(actor)) return true;
  if (isSuperSecretaryRole(actor)) {
    return role === USER_ROLE || role === SECRETARY_ROLE;
  }
  return false;
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password || '')).digest('hex');
}

function defaultAdminUser() {
  return {
    username: 'admin',
    displayName: 'مدير النظام',
    room: ADMIN_SECTOR_VALUE,
    rooms: [ADMIN_SECTOR_VALUE],
    role: 'admin',
    allowedApps: ALL_APP_KEYS,
    permissions: { manageReferenceData: true, customizeDashboardApps: true, viewActivityHistory: true, editRenewalDocuments: true },
    hiddenDashboardApps: [],
    stationAccess: {},
    passwordHash: DEFAULT_ADMIN_PASSWORD_HASH,
    createdAt: new Date().toISOString()
  };
}

function backfillUserPasswords(users) {
  if (!Array.isArray(users) || !users.length) return false;
  let changed = false;
  users.forEach((user) => {
    if (!user || typeof user !== 'object') return;
    const hash = typeof user.passwordHash === 'string' ? user.passwordHash.trim() : '';
    const missingHash = !hash;
    const legacyHash = hash && LEGACY_PASSWORD_HASHES.has(hash);

    if (missingHash || (legacyHash && isAdminRole(user))) {
      user.passwordHash = DEFAULT_ADMIN_PASSWORD_HASH;
      changed = true;
    }
  });
  return changed;
}

function ensureUserStore() {
  if (_usersCache) return _usersCache;

  try { if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true }); } catch {}

  let store;
  if (!fs.existsSync(USERS_DB_PATH)) {
    store = { version: 1, updatedAt: new Date().toISOString(), users: makeDemoAccounts() };
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(store, null, 2), 'utf8');
    _usersCache = store;
    return store;
  }

  try {
    const raw = fs.readFileSync(USERS_DB_PATH, 'utf8') || '{}';
    store = JSON.parse(raw);
  } catch {
    store = { version: 1, users: [] };
  }

  if (!Array.isArray(store.users)) store.users = [];

  store.users = store.users.map((user) => normalizeUserSectors(user));

  let storeChanged = false;
  if (backfillUserPasswords(store.users)) {
    storeChanged = true;
  }

  if (!store.users.some((u) => isAdminRole(u))) {
    store.users.push(defaultAdminUser());
    storeChanged = true;
  }

  const localTestPolicy = applyLocalTestAccountPolicy(store, {
    allAppKeys: ALL_APP_KEYS,
    adminSector: ADMIN_SECTOR_VALUE,
    hashPassword
  });
  if (localTestPolicy.changed) {
    storeChanged = true;
  }

  if (storeChanged) {
    store.updatedAt = new Date().toISOString();
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(store, null, 2), 'utf8');
  }

  _usersCache = store;
  return store;
}

function loadUsers() {
  return ensureUserStore();
}

function normalizeAccessEventApps(apps) {
  const list = Array.isArray(apps) ? apps : [];
  const seen = new Set();
  const normalized = [];
  list.forEach((app) => {
    const key = String(app || '').trim().toLowerCase();
    if (!ACCESS_CONTROLLED_APP_KEY_SET.has(key) || seen.has(key)) return;
    seen.add(key);
    normalized.push(key);
  });
  return normalized;
}

function getRevokedAllowedApps(beforeUser, afterUser) {
  const beforeApps = normalizeAccessEventApps(resolveAllowedApps(beforeUser));
  const afterApps = new Set(normalizeAccessEventApps(resolveAllowedApps(afterUser)));
  return beforeApps.filter((app) => !afterApps.has(app));
}

function addAccessRevokeStream(token, res) {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken || !res) return;
  let streams = ACCESS_REVOKE_STREAMS.get(normalizedToken);
  if (!streams) {
    streams = new Set();
    ACCESS_REVOKE_STREAMS.set(normalizedToken, streams);
  }
  streams.add(res);
}

function removeAccessRevokeStream(token, res) {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) return;
  const streams = ACCESS_REVOKE_STREAMS.get(normalizedToken);
  if (!streams) return;
  streams.delete(res);
  if (!streams.size) ACCESS_REVOKE_STREAMS.delete(normalizedToken);
}

function writeAccessRevokeEvent(token, res, payload) {
  try {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    return true;
  } catch {
    removeAccessRevokeStream(token, res);
    return false;
  }
}

function broadcastAccessRevoked(username, apps) {
  const targetUsername = String(username || '').trim();
  const revokedApps = normalizeAccessEventApps(apps);
  if (!targetUsername || !revokedApps.length || ACCESS_REVOKE_STREAMS.size === 0) return;

  const payload = { type: 'access-revoked', apps: revokedApps };
  for (const [token, streams] of ACCESS_REVOKE_STREAMS.entries()) {
    const session = ACTIVE_TOKENS.get(token);
    if (!session || session.username !== targetUsername) continue;
    for (const res of Array.from(streams)) {
      writeAccessRevokeEvent(token, res, payload);
    }
  }
}

function saveUsers(store) {
  if (!store || typeof store !== 'object') return;

  // Before overwriting cache, find any active tokens whose app access was just revoked
  const oldStore = _usersCache;
  if (oldStore && oldStore !== store && oldStore.users && ACCESS_REVOKE_STREAMS.size > 0) {
    for (const session of ACTIVE_TOKENS.values()) {
      if (!session || !session.username) continue;
      const oldUser = oldStore.users.find((u) => u.username === session.username);
      const newUser = store.users && store.users.find((u) => u.username === session.username);
      if (!oldUser || !newUser) continue;
      const revoked = getRevokedAllowedApps(oldUser, newUser);
      broadcastAccessRevoked(session.username, revoked);
    }
  }

  store.updatedAt = new Date().toISOString();
  try { if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true }); } catch {}
  fs.writeFileSync(USERS_DB_PATH, JSON.stringify(store, null, 2), 'utf8');
  _usersCache = store;
}

function ensureThemeSettings() {
  try {
    if (!fs.existsSync(SETTINGS_DIR)) fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  } catch {}

  if (!fs.existsSync(THEME_SETTINGS_PATH)) {
    fs.writeFileSync(THEME_SETTINGS_PATH, JSON.stringify(DEFAULT_THEME_SETTINGS, null, 2), 'utf8');
    return { ...DEFAULT_THEME_SETTINGS };
  }

  try {
    const raw = fs.readFileSync(THEME_SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid settings file');
    const normalizedTheme = String(parsed.theme || 'light').toLowerCase() === 'dark' ? 'dark' : 'light';
    return {
      theme: normalizedTheme,
      updatedAt: parsed.updatedAt || new Date().toISOString()
    };
  } catch (error) {
    console.warn('Theme settings corrupted, resetting to defaults:', error);
    const fallback = { ...DEFAULT_THEME_SETTINGS, updatedAt: new Date().toISOString() };
    fs.writeFileSync(THEME_SETTINGS_PATH, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

function loadThemeSettings() {
  return ensureThemeSettings();
}

function saveThemeSettings(settings) {
  const theme = String((settings && settings.theme) || 'light').toLowerCase() === 'dark' ? 'dark' : 'light';
  const payload = {
    theme,
    updatedAt: new Date().toISOString()
  };
  try {
    if (!fs.existsSync(SETTINGS_DIR)) fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  } catch {}
  fs.writeFileSync(THEME_SETTINGS_PATH, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
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

function normalizeAppConfig(config) {
  const source = config && typeof config === 'object' ? config : {};
  const requested = Array.isArray(source.apps) ? source.apps : [];
  const requestedMap = new Map(
    requested
      .map((entry) => normalizeAppCatalogEntry(entry))
      .filter(Boolean)
      .map((entry) => [entry.key, entry])
  );

  const apps = DEFAULT_APP_CATALOG
    .map((entry) => normalizeAppCatalogEntry(requestedMap.get(entry.key), entry))
    .filter(Boolean);

  return {
    version: 1,
    updatedAt: String(source.updatedAt || new Date().toISOString()),
    apps
  };
}

function ensureAppConfig() {
  const fallback = createDefaultAppConfig();
  try {
    if (!fs.existsSync(GENERAL_DATA_DIR)) {
      fs.mkdirSync(GENERAL_DATA_DIR, { recursive: true });
    }
  } catch {}

  if (!fs.existsSync(APP_CONFIG_PATH)) {
    fs.writeFileSync(APP_CONFIG_PATH, JSON.stringify(fallback, null, 2), 'utf8');
  }

  try {
    const raw = fs.readFileSync(APP_CONFIG_PATH, 'utf8');
    const parsed = raw ? JSON.parse(raw) : fallback;
    const normalized = normalizeAppConfig(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      fs.writeFileSync(APP_CONFIG_PATH, JSON.stringify(normalized, null, 2), 'utf8');
    }
    return normalized;
  } catch (error) {
    console.warn('App config corrupted, resetting to defaults:', error);
    fs.writeFileSync(APP_CONFIG_PATH, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

function loadAppConfig() {
  return ensureAppConfig();
}

function saveAppConfig(config) {
  const normalized = normalizeAppConfig({
    ...(config && typeof config === 'object' ? config : {}),
    updatedAt: new Date().toISOString()
  });
  try {
    if (!fs.existsSync(GENERAL_DATA_DIR)) {
      fs.mkdirSync(GENERAL_DATA_DIR, { recursive: true });
    }
  } catch {}
  fs.writeFileSync(APP_CONFIG_PATH, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

function getProgramLabel(programKey) {
  const key = String(programKey || '').trim().toLowerCase();
  if (!key) return '';
  return DEFAULT_APP_LABELS[key] || key;
}

function sanitizeActivityText(value, maxLength = 180) {
  const normalized = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return '';
  return normalized.slice(0, maxLength);
}

function sanitizeActivityDraftValue(value, maxLength = 2400) {
  const normalized = String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!normalized) return '';
  return normalized.slice(0, maxLength);
}

function sanitizeActivityClientId(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return normalized.replace(/[^\w.-]/g, '').slice(0, 128);
}

function normalizeActivityRowContext(row) {
  const source = row && typeof row === 'object' ? row : {};
  const rowId = sanitizeActivityText(source.rowId || source.id, 160);
  const rowKey = sanitizeActivityText(source.rowKey || source.key, 40).toLowerCase();
  const rowLabel = sanitizeActivityText(source.rowLabel || source.label, 180);
  const rowType = sanitizeActivityText(source.rowType || source.type, 48).toLowerCase();
  if (!rowId && !rowLabel) return undefined;
  return {
    rowId,
    rowKey,
    rowLabel,
    rowType
  };
}

function normalizeActivityLocationContext(location) {
  const source = location && typeof location === 'object' ? location : {};
  const sector = sanitizeActivityText(source.sector || source.room || source.sectorLabel, 120);
  const seenStations = new Set();
  const stations = []
    .concat(Array.isArray(source.stations) ? source.stations : [])
    .concat([source.station || source.police || source.department || ''])
    .map((value) => sanitizeActivityText(value, 140))
    .filter((value) => {
      if (!value || seenStations.has(value)) return false;
      seenStations.add(value);
      return true;
    });
  if (!sector && !stations.length) return undefined;
  return {
    sector,
    station: stations[0] || '',
    stations
  };
}

function normalizeActivityCellContext(cell) {
  const source = cell && typeof cell === 'object' ? cell : {};
  const field = sanitizeActivityText(source.field || source.dataField, 120);
  const key = sanitizeActivityText(source.key || source.dataKey, 64).toLowerCase();
  const header = sanitizeActivityText(source.header || source.label, 160);
  const csvIndexRaw = Number.parseInt(source.csvIndex, 10);
  const cellIndexRaw = Number.parseInt(source.cellIndex, 10);
  const normalized = {};
  if (field) normalized.field = field;
  if (key) normalized.key = key;
  if (header) normalized.header = header;
  if (Number.isInteger(csvIndexRaw) && csvIndexRaw >= 0) {
    normalized.csvIndex = csvIndexRaw;
  }
  if (Number.isInteger(cellIndexRaw) && cellIndexRaw >= 0) {
    normalized.cellIndex = cellIndexRaw;
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

function normalizeActivityDraftContext(draft) {
  const source = draft && typeof draft === 'object' ? draft : {};
  const cell = normalizeActivityCellContext(source.cell || source.target || source.column);
  if (!cell) return undefined;
  return {
    cell,
    value: sanitizeActivityDraftValue(source.value ?? source.text ?? source.displayValue ?? '', 2400)
  };
}

function normalizeActivitySignalContext(signal) {
  const source = signal && typeof signal === 'object' ? signal : {};
  const signalId = sanitizeActivityText(source.signalId || source.id, 160)
    || `signal-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const kind = sanitizeActivityText(source.kind || source.type || 'save', 32).toLowerCase() || 'save';
  const scope = sanitizeActivityText(source.scope || 'program', 48).toLowerCase() || 'program';
  const dataset = sanitizeActivityText(source.dataset || source.targetDataset || source.view, 64);
  const requestPath = sanitizeActivityText(source.requestPath || source.url || source.path, 260);
  const message = sanitizeActivityText(source.message || source.title, 220);
  return {
    signalId,
    kind,
    scope,
    dataset,
    requestPath,
    message
  };
}

function inferActivityContextFromPath(rawPath) {
  const pathValue = sanitizeActivityText(rawPath || '/', 260) || '/';
  const lowered = pathValue.toLowerCase();

  if (lowered.startsWith('/weapons')) {
    return { programKey: 'weapons', programName: getProgramLabel('weapons'), pageName: 'برنامج الرخص الملغاة', path: pathValue };
  }
  if (lowered.startsWith('/renewal')) {
    return { programKey: 'renewal', programName: getProgramLabel('renewal'), pageName: 'برنامج الملفات التي لم ترد', path: pathValue };
  }
  if (lowered.startsWith('/report')) {
    return { programKey: 'report', programName: getProgramLabel('report'), pageName: 'برنامج القرارات', path: pathValue };
  }
  if (lowered.startsWith('/accept')) {
    return { programKey: 'accept', programName: getProgramLabel('accept'), pageName: 'موافقة شؤون الضباط', path: pathValue };
  }
  if (lowered.startsWith('/request')) {
    return { programKey: 'request', programName: getProgramLabel('request'), pageName: 'برنامج طلبات ترخيص اول مرة', path: pathValue };
  }
  if (lowered.startsWith('/seized')) {
    return { programKey: 'seized', programName: getProgramLabel('seized'), pageName: 'برنامج الأحراز', path: pathValue };
  }
  if (lowered.startsWith('/company')) {
    return { programKey: 'company', programName: getProgramLabel('company'), pageName: 'إدارة شركات الحراسة', path: pathValue };
  }
  if (lowered.endsWith('/settings.html')) {
    return { programKey: 'settings', programName: getProgramLabel('settings'), pageName: 'الإعدادات', path: pathValue };
  }
  if (lowered.endsWith('/profile.html')) {
    return { programKey: 'profile', programName: getProgramLabel('profile'), pageName: 'الملف الشخصي', path: pathValue };
  }
  if (lowered.endsWith('/main.html') || lowered === '/dashboard') {
    return { programKey: 'dashboard', programName: getProgramLabel('dashboard'), pageName: 'اللوحة الرئيسية', path: pathValue };
  }
  if (lowered.endsWith('/index.html') || lowered === '/' || lowered === '/login') {
    return { programKey: 'login', programName: getProgramLabel('login'), pageName: 'تسجيل الدخول', path: pathValue };
  }

  return { programKey: 'general', programName: getProgramLabel('general'), pageName: 'المنصة العامة', path: pathValue };
}

function normalizeActivityContext(context, fallbackPath = '') {
  const source = context && typeof context === 'object' ? context : {};
  const inferred = inferActivityContextFromPath(source.path || fallbackPath || '/');
  const programKey = sanitizeActivityText(source.programKey || inferred.programKey, 64).toLowerCase() || inferred.programKey;
  const programName = sanitizeActivityText(source.programName || getProgramLabel(programKey) || inferred.programName, 120)
    || getProgramLabel(programKey)
    || inferred.programName;
  const pageName = sanitizeActivityText(source.pageName || inferred.pageName, 120) || inferred.pageName;
  const normalized = {
    programKey,
    programName,
    pageName,
    path: sanitizeActivityText(source.path || inferred.path, 260) || inferred.path
  };
  const activeRow = normalizeActivityRowContext(source.activeRow || source.row);
  if (activeRow) {
    normalized.activeRow = activeRow;
  }
  const location = normalizeActivityLocationContext(source.location || source.hierarchy);
  if (location) {
    normalized.location = location;
  }
  return normalized;
}

function sanitizeActivityDetailValue(value, depth = 0) {
  if (value === undefined || value === null || depth > 4) return undefined;
  if (typeof value === 'string') return sanitizeActivityDraftValue(value, 1200);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 100)
      .map((entry) => sanitizeActivityDetailValue(entry, depth + 1))
      .filter((entry) => entry !== undefined);
  }
  if (typeof value === 'object') {
    const normalized = {};
    Object.entries(value).slice(0, 100).forEach(([key, entry]) => {
      const safeEntry = sanitizeActivityDetailValue(entry, depth + 1);
      if (safeEntry !== undefined) normalized[sanitizeActivityText(key, 80)] = safeEntry;
    });
    return normalized;
  }
  return sanitizeActivityText(value, 260);
}

function sanitizeActivityDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return undefined;
  const normalized = {};
  for (const [key, value] of Object.entries(details)) {
    if (value === undefined || value === null) continue;
    const safeValue = sanitizeActivityDetailValue(value);
    if (safeValue !== undefined) normalized[sanitizeActivityText(key, 80)] = safeValue;
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

function matchesSystemActivityApi(pathValue) {
  const normalizedPath = sanitizeActivityText(pathValue, 260);
  if (!normalizedPath) return false;
  return SYSTEM_ACTIVITY_API_PATTERNS.some((pattern) => pattern.test(normalizedPath));
}

function isSystemActivityEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const eventType = sanitizeActivityText(entry.eventType, 48).toLowerCase();
  const details = entry.details && typeof entry.details === 'object' ? entry.details : {};
  const detailUrl = sanitizeActivityText(details.url, 260);
  const pathValue = sanitizeActivityText(entry.path, 260);

  if (eventType === 'api:request' && matchesSystemActivityApi(detailUrl || pathValue)) {
    return true;
  }

  return false;
}

function ensureActivityLogStore() {
  ACTIVITY_LOG_STORE.ensureStores();
}

function buildActivityMessage(eventType, context) {
  const safeContext = normalizeActivityContext(context);
  switch (String(eventType || '').toLowerCase()) {
    case 'page:view':
      return `فتح ${safeContext.pageName || safeContext.programName}`;
    case 'page:leave':
      return `إغلاق ${safeContext.pageName || safeContext.programName}`;
    case 'ui:click':
      return `تنفيذ أمر داخل ${safeContext.programName}`;
    case 'ui:submit':
      return `إرسال نموذج داخل ${safeContext.programName}`;
    case 'api:request':
      return `استدعاء خدمة داخل ${safeContext.programName}`;
    case 'auth:login':
      return 'تم تسجيل الدخول';
    case 'auth:logout':
      return 'تم تسجيل الخروج';
    default:
      return safeContext.pageName || safeContext.programName || 'نشاط جديد';
  }
}

function logActivityEvent(payload) {
  const actor = payload && payload.user ? sanitizeUser(payload.user) : null;
  const context = normalizeActivityContext(payload && payload.context, payload && payload.fallbackPath);
  const entry = {
    id: crypto.randomBytes(12).toString('hex'),
    occurredAt: new Date().toISOString(),
    source: sanitizeActivityText(payload && payload.source ? payload.source : 'server', 24) || 'server',
    eventType: sanitizeActivityText(payload && payload.eventType ? payload.eventType : 'event', 48) || 'event',
    message: sanitizeActivityText(payload && payload.message ? payload.message : buildActivityMessage(payload && payload.eventType, context), 220)
      || buildActivityMessage(payload && payload.eventType, context),
    username: actor ? actor.username : '',
    displayName: actor ? actor.displayName : '',
    role: actor ? actor.role : '',
    clientId: sanitizeActivityClientId(payload && payload.clientId),
    programKey: context.programKey,
    programName: context.programName,
    pageName: context.pageName,
    path: context.path
  };
  const details = sanitizeActivityDetails(payload && payload.details);
  if (details) {
    entry.details = details;
  }

  try {
    ensureActivityLogStore();
    ACTIVITY_LOG_STORE.append(entry);
  } catch (error) {
    console.warn('Failed to append activity log:', error && error.message);
  }

  return entry;
}

function readActivityPage({ username, limit, cursor, query } = {}) {
  ensureActivityLogStore();
  const normalizedUsername = sanitizeActivityText(username, 64);
  const maxItems = Math.min(
    Math.max(Number.parseInt(limit, 10) || 80, 1),
    ACTIVITY_LOG_RESPONSE_LIMIT
  );
  return ACTIVITY_LOG_STORE.readPage({
    username: normalizedUsername,
    limit: maxItems,
    cursor: sanitizeActivityText(cursor, 1000),
    query: sanitizeActivityText(query, 220)
  });
}

function readActivityEvents({ username, limit } = {}) {
  return readActivityPage({ username, limit }).entries;
}

app.locals.logActivityEvent = logActivityEvent;
if (typeof deleteApprovalStore.configureActivityLogger === 'function') {
  deleteApprovalStore.configureActivityLogger(logActivityEvent);
}
function clearPresenceByToken(token) {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) return;
  for (const [key, entry] of ACTIVE_CLIENTS.entries()) {
    if (entry && entry.token === normalizedToken) {
      ACTIVE_CLIENTS.delete(key);
    }
  }
}

function pruneInactiveClients(nowMs = Date.now()) {
  for (const [key, entry] of ACTIVE_CLIENTS.entries()) {
    if (!entry || !entry.lastSeenMs || (nowMs - Number(entry.lastSeenMs)) > ACTIVITY_PRESENCE_TTL_MS) {
      ACTIVE_CLIENTS.delete(key);
    }
  }
}

function pruneActivitySignals(nowMs = Date.now()) {
  for (let index = ACTIVITY_SIGNALS.length - 1; index >= 0; index -= 1) {
    const entry = ACTIVITY_SIGNALS[index];
    if (!entry || !entry.createdAtMs || (nowMs - Number(entry.createdAtMs)) > ACTIVITY_SIGNAL_TTL_MS) {
      ACTIVITY_SIGNALS.splice(index, 1);
    }
  }
  if (ACTIVITY_SIGNALS.length > ACTIVITY_SIGNAL_LIMIT) {
    ACTIVITY_SIGNALS.splice(0, ACTIVITY_SIGNALS.length - ACTIVITY_SIGNAL_LIMIT);
  }
}

function normalizePresenceState(value) {
  const normalized = String(value || ACTIVITY_PRESENCE_STATES.active).trim().toLowerCase();
  if (normalized === ACTIVITY_PRESENCE_STATES.inactive) return ACTIVITY_PRESENCE_STATES.inactive;
  if (normalized === 'closing' || normalized === 'closed' || normalized === ACTIVITY_PRESENCE_STATES.offline) {
    return ACTIVITY_PRESENCE_STATES.offline;
  }
  return ACTIVITY_PRESENCE_STATES.active;
}

function getPresenceStatePriority(value) {
  const normalized = normalizePresenceState(value);
  if (normalized === ACTIVITY_PRESENCE_STATES.active) return 0;
  if (normalized === ACTIVITY_PRESENCE_STATES.inactive) return 1;
  return 2;
}

function pickPreferredPresenceEntry(current, candidate) {
  if (!candidate) return current || null;
  if (!current) return candidate;

  const stateDelta = getPresenceStatePriority(candidate.presenceState) - getPresenceStatePriority(current.presenceState);
  if (stateDelta !== 0) {
    return stateDelta < 0 ? candidate : current;
  }

  const currentTime = new Date(current.lastSeenAt || 0).getTime();
  const candidateTime = new Date(candidate.lastSeenAt || 0).getTime();
  return candidateTime >= currentTime ? candidate : current;
}

function setClientPresence({ auth, clientId, context, presenceState }) {
  const normalizedClientId = sanitizeActivityClientId(clientId);
  if (!auth || !auth.user || !auth.token || !normalizedClientId) return null;
  const actor = sanitizeUser(auth.user);
  const safeContext = normalizeActivityContext(context);
  const now = new Date();
  const key = `${actor.username}:${normalizedClientId}`;
  const previousEntry = ACTIVE_CLIENTS.get(key);
  const entry = {
    clientId: normalizedClientId,
    token: auth.token,
    username: actor.username,
    displayName: actor.displayName,
    role: actor.role,
    programKey: safeContext.programKey,
    programName: safeContext.programName,
    pageName: safeContext.pageName,
    path: safeContext.path,
    activeRow: safeContext.activeRow || null,
    location: safeContext.location || null,
    draft: previousEntry && previousEntry.draft ? previousEntry.draft : null,
    presenceState: normalizePresenceState(presenceState || (previousEntry && previousEntry.presenceState)),
    lastSeenAt: now.toISOString(),
    lastSeenMs: now.getTime()
  };
  ACTIVE_CLIENTS.set(key, entry);
  return entry;
}

function setClientDraft({ auth, clientId, context, draft, presenceState }) {
  const normalizedClientId = sanitizeActivityClientId(clientId);
  if (!auth || !auth.user || !auth.token || !normalizedClientId) return null;
  const actor = sanitizeUser(auth.user);
  const safeContext = normalizeActivityContext(context);
  const normalizedDraft = draft ? normalizeActivityDraftContext(draft) : null;
  const now = new Date();
  const key = `${actor.username}:${normalizedClientId}`;
  const previousEntry = ACTIVE_CLIENTS.get(key);
  const entry = {
    clientId: normalizedClientId,
    token: auth.token,
    username: actor.username,
    displayName: actor.displayName,
    role: actor.role,
    programKey: safeContext.programKey,
    programName: safeContext.programName,
    pageName: safeContext.pageName,
    path: safeContext.path,
    activeRow: safeContext.activeRow || null,
    location: safeContext.location || null,
    draft: normalizedDraft,
    presenceState: normalizePresenceState(presenceState || (previousEntry && previousEntry.presenceState)),
    lastSeenAt: now.toISOString(),
    lastSeenMs: now.getTime()
  };
  if (!normalizedDraft && previousEntry && previousEntry.draft && !safeContext.activeRow && previousEntry.activeRow) {
    entry.activeRow = previousEntry.activeRow;
  }
  ACTIVE_CLIENTS.set(key, entry);
  return entry;
}

function clearClientPresence({ auth, clientId }) {
  const normalizedClientId = sanitizeActivityClientId(clientId);
  if (!auth || !auth.user || !normalizedClientId) return;
  ACTIVE_CLIENTS.delete(`${auth.user.username}:${normalizedClientId}`);
}

function addActivitySignal({ auth, clientId, context, signal }) {
  const normalizedClientId = sanitizeActivityClientId(clientId);
  if (!auth || !auth.user || !auth.token || !normalizedClientId) return null;
  const actor = sanitizeUser(auth.user);
  const safeContext = normalizeActivityContext(context);
  const safeSignal = normalizeActivitySignalContext(signal);
  const now = new Date();
  const entry = {
    id: safeSignal.signalId,
    clientId: normalizedClientId,
    username: actor.username,
    displayName: actor.displayName,
    role: actor.role,
    programKey: safeContext.programKey,
    programName: safeContext.programName,
    pageName: safeContext.pageName,
    path: safeContext.path,
    kind: safeSignal.kind,
    scope: safeSignal.scope,
    dataset: safeSignal.dataset,
    requestPath: safeSignal.requestPath,
    message: safeSignal.message,
    createdAt: now.toISOString(),
    createdAtMs: now.getTime()
  };
  ACTIVITY_SIGNALS.push(entry);
  pruneActivitySignals(entry.createdAtMs);
  return entry;
}

function listActiveClients() {
  pruneInactiveClients();
  const store = loadUsers();
  const userMap = new Map(store.users.map((user) => [user.username, sanitizeUser(user)]));
  return Array.from(ACTIVE_CLIENTS.values())
    .map((entry) => {
      const actor = userMap.get(entry.username);
      if (!actor) return null;
      return {
        clientId: entry.clientId,
        username: actor.username,
        displayName: actor.displayName,
        role: actor.role,
        programKey: entry.programKey,
        programName: entry.programName,
        pageName: entry.pageName,
        path: entry.path,
        activeRow: entry.activeRow || null,
        location: entry.location || null,
        draft: entry.draft || null,
        presenceState: normalizePresenceState(entry.presenceState),
        isOnline: true,
        lastSeenAt: entry.lastSeenAt
      };
    })
    .filter((entry) => entry && entry.role !== ADMIN_ROLE)
    .sort((left, right) => new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime());
}

function listPresenceRoster(activeUsers = listActiveClients()) {
  const store = loadUsers();
  const preferredPresenceByUser = new Map();

  (Array.isArray(activeUsers) ? activeUsers : []).forEach((entry) => {
    if (!entry || !entry.username) return;
    const current = preferredPresenceByUser.get(entry.username);
    preferredPresenceByUser.set(entry.username, pickPreferredPresenceEntry(current, entry));
  });

  const users = store.users
    .map((user) => sanitizeUser(user))
    .filter((user) => user && user.role !== ADMIN_ROLE)
    .map((user) => {
      const currentPresence = preferredPresenceByUser.get(user.username) || null;
      const presenceStatus = currentPresence
        ? normalizePresenceState(currentPresence.presenceState)
        : ACTIVITY_PRESENCE_STATES.offline;

      return {
        ...user,
        presenceStatus,
        isOnline: presenceStatus !== ACTIVITY_PRESENCE_STATES.offline,
        lastSeenAt: currentPresence ? currentPresence.lastSeenAt : null,
        programKey: currentPresence ? currentPresence.programKey : '',
        programName: currentPresence ? currentPresence.programName : '',
        pageName: currentPresence ? currentPresence.pageName : '',
        path: currentPresence ? currentPresence.path : '',
        activeRow: currentPresence ? currentPresence.activeRow || null : null,
        location: currentPresence ? currentPresence.location || null : null,
        draft: currentPresence ? currentPresence.draft || null : null
      };
    });

  return users.sort((left, right) => {
    const stateDelta = getPresenceStatePriority(left.presenceStatus) - getPresenceStatePriority(right.presenceStatus);
    if (stateDelta !== 0) return stateDelta;

    const rightTime = new Date(right.lastSeenAt || right.lastLogin || right.createdAt || 0).getTime();
    const leftTime = new Date(left.lastSeenAt || left.lastLogin || left.createdAt || 0).getTime();
    if (rightTime !== leftTime) return rightTime - leftTime;

    return String(left.displayName || left.username || '').localeCompare(
      String(right.displayName || right.username || ''),
      'ar'
    );
  });
}

function listAccountColorRoster() {
  const store = loadUsers();
  return store.users
    .map((user) => sanitizeUser(user))
    .filter(Boolean)
    .map((user) => ({
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      room: user.room || '',
      sectors: Array.isArray(user.sectors) ? user.sectors : []
    }))
    .sort((left, right) => String(left.displayName || left.username || '').localeCompare(
      String(right.displayName || right.username || ''),
      'ar'
    ));
}

function listRecentActivitySignals() {
  pruneActivitySignals();
  const store = loadUsers();
  const userMap = new Map(store.users.map((user) => [user.username, sanitizeUser(user)]));
  return ACTIVITY_SIGNALS
    .map((entry) => {
      if (!entry) return null;
      const actor = userMap.get(entry.username);
      if (!actor) return null;
      return {
        id: entry.id,
        clientId: entry.clientId,
        username: actor.username,
        displayName: actor.displayName,
        role: actor.role,
        programKey: entry.programKey,
        programName: entry.programName,
        pageName: entry.pageName,
        path: entry.path,
        kind: entry.kind,
        scope: entry.scope,
        dataset: entry.dataset,
        requestPath: entry.requestPath,
        message: entry.message,
        createdAt: entry.createdAt
      };
    })
    .filter(Boolean)
    .sort((left, right) => new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime());
}

function resolveAllowedApps(user) {
  if (!user) return [];
  if (isAdminRole(user)) return ALL_APP_KEYS.slice();
  const list = Array.isArray(user.allowedApps) ? user.allowedApps : [];
  const normalized = new Set(list.map((a) => String(a || '').trim().toLowerCase()));
  if (isSuperSecretaryRole(user) || isSecretaryRole(user)) {
    normalized.add('settings');
  }
  return ALL_APP_KEYS.filter((key) => normalized.has(key));
}

function userHasAppAccess(user, programKey) {
  const key = String(programKey || '').trim().toLowerCase();
  if (!ACCESS_CONTROLLED_APP_KEY_SET.has(key)) return true;
  return resolveAllowedApps(user).includes(key);
}

function normalizeSectorList(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const sectors = [];
  for (const value of values) {
    const rawSector = normalizeReferenceDisplayText(value);
    if (!rawSector) continue;
    const sector = rawSector === ADMIN_SECTOR_VALUE ? ADMIN_SECTOR_VALUE : resolveSectorLabel(rawSector) || rawSector;
    if (!sector) continue;
    if (sector === ADMIN_SECTOR_VALUE) {
      if (!seen.has(ADMIN_SECTOR_VALUE)) {
        seen.clear();
        sectors.length = 0;
        sectors.push(ADMIN_SECTOR_VALUE);
        seen.add(ADMIN_SECTOR_VALUE);
      }
      continue;
    }
    if (!seen.has(sector)) {
      sectors.push(sector);
      seen.add(sector);
    }
  }
  return sectors;
}

function normalizeStationAccessForSectors(sectors, payload) {
  if (!Array.isArray(sectors) || !sectors.length) return {};
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};

  const normalized = {};
  const sectorStations = getSharedSectorStations();
  sectors.forEach((sector) => {
    const canonicalSector = sector === ADMIN_SECTOR_VALUE ? sector : resolveSectorLabel(sector) || sector;
    if (!canonicalSector || canonicalSector === ADMIN_SECTOR_VALUE) return;
    const allowed = sectorStations[canonicalSector];
    if (!Array.isArray(allowed) || !allowed.length) return;
    const requested = payload[sector] || payload[canonicalSector];
    if (!Array.isArray(requested) || !requested.length) return;

    const unique = [];
    const seen = new Set();
    requested.forEach((station) => {
      const resolved = resolveStationName(station, canonicalSector);
      if (!resolved || seen.has(resolved) || !allowed.includes(resolved)) return;
      unique.push(resolved);
      seen.add(resolved);
    });

    if (unique.length) {
      normalized[canonicalSector] = unique;
    }
  });

  return normalized;
}

function extractStationPayload(body) {
  if (!body || typeof body !== 'object') return {};
  const direct = body.stationAccess;
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) return direct;
  const legacy = body.stations;
  if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) return legacy;
  return {};
}

function normalizeUserStationAccess(user) {
  if (!user || typeof user !== 'object') return user;
  const role = normalizeRoleValue(user.role);
  const sectors = Array.isArray(user.rooms) ? user.rooms.slice() : [];

  if (!sectors.length || role === ADMIN_ROLE || role === SUPERSECRETARY_ROLE || role === SECRETARY_ROLE || sectors.includes(ADMIN_SECTOR_VALUE)) {
    user.stationAccess = {};
    if (user.stations && typeof user.stations === 'object' && !Array.isArray(user.stations)) {
      delete user.stations;
    }
    return user;
  }

  const payload = user.stationAccess && typeof user.stationAccess === 'object'
    ? user.stationAccess
    : (user.stations && typeof user.stations === 'object' ? user.stations : {});

  user.stationAccess = normalizeStationAccessForSectors(sectors, payload);
  if (user.stations && typeof user.stations === 'object') {
    delete user.stations;
  }
  return user;
}

function normalizeUserSectors(user) {
  if (!user || typeof user !== 'object') return user;
  const role = normalizeRoleValue(user.role);
  const isManagement = role === ADMIN_ROLE || role === SUPERSECRETARY_ROLE || role === SECRETARY_ROLE;

  const initial = Array.isArray(user.rooms)
    ? user.rooms
    : Array.isArray(user.sectors)
      ? user.sectors
      : user.room
        ? [user.room]
        : [];

  let sectors = normalizeSectorList(initial);
  if (isManagement) {
    sectors = [ADMIN_SECTOR_VALUE];
  }

  user.rooms = sectors;
  user.room = sectors[0] || '';
  user.permissions = normalizePermissionsValue(user, role);
  user.hiddenDashboardApps = normalizeHiddenDashboardApps(user.hiddenDashboardApps, ALL_APP_KEYS);
  delete user.sectors; // legacy field if present
  normalizeUserStationAccess(user);
  return user;
}

function extractSectorPayload(body) {
  if (!body || typeof body !== 'object') return [];
  if (Array.isArray(body.sectors)) return normalizeSectorList(body.sectors);
  if (Array.isArray(body.rooms)) return normalizeSectorList(body.rooms);
  if (typeof body.room === 'string') return normalizeSectorList([body.room]);
  if (typeof body.sector === 'string') return normalizeSectorList([body.sector]);
  return [];
}

function sanitizeUser(user) {
  if (!user) return null;
  const normalized = normalizeUserSectors({ ...user });
  const sectors = Array.isArray(normalized.rooms) ? normalized.rooms.slice() : [];
  const stationAccess = normalizeStationAccessForSectors(sectors, normalized.stationAccess);
  return {
    username: normalized.username,
    displayName: normalized.displayName || normalized.username,
    room: normalized.room || '',
    sectors,
    role: normalizeRoleValue(normalized.role),
    allowedApps: resolveAllowedApps(normalized),
    permissions: normalizePermissionsValue(normalized, normalized.role),
    hiddenDashboardApps: getEffectiveHiddenDashboardApps(normalized, ALL_APP_KEYS),
    createdAt: normalized.createdAt,
    lastLogin: normalized.lastLogin || null,
    stationAccess
  };
}

function buildGlobalSearchAccessScope(user) {
  const normalized = normalizeUserSectors({ ...(user || {}) });
  const sectors = Array.isArray(normalized.rooms) ? normalized.rooms.filter(Boolean) : [];
  if (hasManagementRole(normalized) || sectors.includes(ADMIN_SECTOR_VALUE)) {
    return { unrestrictedSectors: true };
  }
  return {
    unrestrictedSectors: false,
    allowedSectors: new Set(sectors),
    stationAccess: normalizeStationAccessForSectors(sectors, normalized.stationAccess)
  };
}

function authenticateRequest(req) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const match = typeof authHeader === 'string' ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
    let token = match ? match[1] : '';
    // Browsers cannot attach Bearer headers to img/iframe/window.open requests.
    // A same-site HttpOnly cookie is accepted only for protected attachment GET/HEAD routes.
    const attachmentPath = String(req.originalUrl || '').split('?')[0];
    const isAttachment = /^(?:\/report\/photo[CPA](?:\/|$)|\/company\/(?:uploads|license-uploads|company-uploads|gps-uploads|qr-uploads|logo-uploads|inspection-uploads|car-uploads)(?:\/|$)|\/weapons\/(?:tmp(?:\/|$)|slah\.csv$))/.test(attachmentPath);
    if (!token && isAttachment && (req.method === 'GET' || req.method === 'HEAD')) {
      const cookie = String(req.headers.cookie || '').split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith('administrative_demo_session='));
      token = cookie ? cookie.slice('administrative_demo_session='.length) : '';
    }
    if (!token) return null;
    const session = ACTIVE_TOKENS.get(token);
    if (!session) return null;

    const store = loadUsers();
    const user = store.users.find((u) => u.username === session.username);
    if (!user) {
      ACTIVE_TOKENS.delete(token);
      return null;
    }

    return { token, user, session };
  } catch {
    return null;
  }
}

function requireAuthenticatedUser(req, res) {
  const auth = authenticateRequest(req);
  if (!auth) {
    res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول مرة أخرى' });
    return null;
  }
  return auth;
}

function requireGlobalSearchUser(req, res) {
  const auth = requireAuthenticatedUser(req, res);
  if (!auth) return null;
  if (!canUseGlobalSearch(auth.user)) {
    res.status(403).json({ success: false, message: 'البحث العام متاح للمدير والسيكرتير الأول فقط' });
    return null;
  }
  return auth;
}

function buildGlobalSearchStoreOptions(auth, extra = {}) {
  return {
    allowedApps: new Set(
      resolveAllowedApps(auth.user).filter((key) => key !== 'settings')
    ),
    access: buildGlobalSearchAccessScope(auth.user),
    user: sanitizeUser(auth.user),
    ...extra
  };
}

function requireAuthMiddleware(req, res, next) {
  const auth = authenticateRequest(req);
  if (!auth) {
    return res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول مرة أخرى' });
  }
  next();
}

function requireAppAccessMiddleware(programKey) {
  const key = String(programKey || '').trim().toLowerCase();
  return (req, res, next) => {
    const auth = authenticateRequest(req);
    if (!auth) {
      return res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول مرة أخرى' });
    }
    if (!userHasAppAccess(auth.user, key)) {
      return res.status(403).json({
        success: false,
        accessRevoked: true,
        app: key,
        message: 'صلاحية هذا البرنامج مغلقة'
      });
    }
    req.portalAuth = auth;
    req.portalUser = auth.user;
    return next();
  };
}

function requireAdminUser(req, res) {
  const auth = authenticateRequest(req);
  if (!auth || !isAdminRole(auth.user)) {
    res.status(403).json({ success: false, message: 'صلاحيات غير كافية' });
    return null;
  }
  return auth;
}

function requireActivityReviewer(req, res) {
  const auth = authenticateRequest(req);
  if (!auth) {
    res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول مرة أخرى' });
    return null;
  }
  if (!canViewActivityHistory(auth.user)) {
    res.status(403).json({ success: false, message: 'لا تملك صلاحية عرض سجل النشاط' });
    return null;
  }
  return auth;
}

function requireUserViewer(req, res) {
  const auth = authenticateRequest(req);
  if (!auth) {
    res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول مرة أخرى' });
    return null;
  }
  if (!canViewUsers(auth.user)) {
    res.status(403).json({ success: false, message: 'صلاحيات غير كافية' });
    return null;
  }
  return auth;
}

function requireManagedUserCreator(req, res) {
  const auth = authenticateRequest(req);
  if (!auth) {
    res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول مرة أخرى' });
    return null;
  }
  if (!canCreateManagedUsers(auth.user)) {
    res.status(403).json({ success: false, message: 'صلاحيات غير كافية' });
    return null;
  }
  return auth;
}

function requireAppCatalogManager(req, res) {
  const auth = authenticateRequest(req);
  if (!auth) {
    res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول مرة أخرى' });
    return null;
  }
  if (!canManageAppCatalog(auth.user)) {
    res.status(403).json({ success: false, message: 'صلاحيات غير كافية' });
    return null;
  }
  return auth;
}

function requireDeleteApprovalReviewer(req, res) {
  const auth = requireAuthenticatedUser(req, res);
  if (!auth) return null;
  if (!deleteApprovalStore.canReviewDeleteApprovals(auth.user)) {
    res.status(403).json({ success: false, message: 'صلاحيات غير كافية' });
    return null;
  }
  return auth;
}

// Initialize store on startup
ensureUserStore();
ensureThemeSettings();
ensureAppConfig();
ensureActivityLogStore();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ type: ["text/*", "application/csv", "application/octet-stream"], limit: "25mb" }));

function appendVaryHeader(res, value) {
  const current = res.getHeader('Vary');
  if (!current) {
    res.setHeader('Vary', value);
    return;
  }
  const parts = String(current).split(',').map((part) => part.trim().toLowerCase());
  if (!parts.includes(String(value).toLowerCase())) {
    res.setHeader('Vary', `${current}, ${value}`);
  }
}

function createLargeResponseCompressionMiddleware(options = {}) {
  const threshold = Number(options.thresholdBytes) || 8 * 1024;
  const compressibleType = /(?:^|;|\s)(?:application\/json|application\/javascript|text\/|text\/csv|application\/csv|application\/x-javascript)\b/i;

  return (req, res, next) => {
    if (req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    if (req.headers.range) return next();

    const originalRequestUrl = String(req.originalUrl || req.url || '');
    const acceptsContent = String(req.headers.accept || '');
    if (/\btext\/event-stream\b/i.test(acceptsContent) || /^\/api\/auth\/access-events(?:$|[/?])/i.test(originalRequestUrl)) {
      return next();
    }

    const accepts = String(req.headers['accept-encoding'] || '');
    const encodingName = /\bbr\b/i.test(accepts) ? 'br' : (/\bgzip\b/i.test(accepts) ? 'gzip' : '');
    if (!encodingName) return next();

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    const chunks = [];
    let bodyLength = 0;

    function addChunk(chunk, encoding) {
      if (chunk == null) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
      chunks.push(buffer);
      bodyLength += buffer.length;
    }

    res.write = function writeCompressedBuffer(chunk, encoding, callback) {
      if (typeof encoding === 'function') {
        callback = encoding;
        encoding = undefined;
      }
      addChunk(chunk, encoding);
      if (typeof callback === 'function') process.nextTick(callback);
      return true;
    };

    res.end = function endCompressedBuffer(chunk, encoding, callback) {
      if (typeof chunk === 'function') {
        callback = chunk;
        chunk = undefined;
        encoding = undefined;
      } else if (typeof encoding === 'function') {
        callback = encoding;
        encoding = undefined;
      }
      addChunk(chunk, encoding);

      const contentType = String(res.getHeader('Content-Type') || '');
      const statusCode = Number(res.statusCode) || 200;
      const isApiResponse = originalRequestUrl.startsWith('/api/');
      const hasEntityTag = !!res.getHeader('ETag');
      const shouldCompress =
        !res.headersSent
        && !res.getHeader('Content-Encoding')
        && (!hasEntityTag || isApiResponse)
        && statusCode >= 200
        && statusCode < 300
        && statusCode !== 204
        && bodyLength >= threshold
        && compressibleType.test(contentType);

      const body = bodyLength ? Buffer.concat(chunks, bodyLength) : Buffer.alloc(0);
      if (!shouldCompress) {
        if (body.length) originalWrite(body);
        return originalEnd(callback);
      }

      const finish = (error, compressed) => {
        if (error || !compressed || compressed.length >= body.length) {
          if (body.length) originalWrite(body);
          return originalEnd(callback);
        }
        res.setHeader('Content-Encoding', encodingName);
        if (hasEntityTag) res.removeHeader('ETag');
        res.removeHeader('Content-Length');
        appendVaryHeader(res, 'Accept-Encoding');
        originalWrite(compressed);
        return originalEnd(callback);
      };

      if (encodingName === 'br') {
        zlib.brotliCompress(
          body,
          { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } },
          finish
        );
      } else {
        zlib.gzip(body, { level: 6 }, finish);
      }
      return undefined;
    };

    return next();
  };
}

app.use(createLargeResponseCompressionMiddleware());

// ========== STATIC FILE SERVING ==========

const STATIC_ASSET_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const NO_STORE_CACHE = 'no-store, no-cache, must-revalidate, private';
const REVALIDATE_CACHE = 'public, no-cache, must-revalidate';
const LONG_CACHE = `public, max-age=${STATIC_ASSET_MAX_AGE_SECONDS}`;
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const PLATFORM_BUILD_ROOT = path.join(PROJECT_ROOT, '.platform-build');
const PLATFORM_BUILD_MANIFEST = path.join(PLATFORM_BUILD_ROOT, 'manifest.json');

function setNoStoreHeaders(res) {
  res.setHeader('Cache-Control', NO_STORE_CACHE);
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function setStaticAssetHeaders(res, filePath, options = {}) {
  const ext = path.extname(filePath || '').toLowerCase();
  const noStoreExtensions = options.noStoreExtensions || new Set(['.html', '.csv']);
  if (noStoreExtensions.has(ext)) {
    setNoStoreHeaders(res);
    return;
  }
  if (ext === '.js' || ext === '.css') {
    res.setHeader('Cache-Control', REVALIDATE_CACHE);
    return;
  }
  if (/\.(png|jpg|jpeg|gif|webp|ico|svg|woff|woff2|ttf|otf)$/i.test(ext)) {
    res.setHeader('Cache-Control', LONG_CACHE);
  }
}

function getBuiltFrontendPath(key) {
  return path.join(PLATFORM_BUILD_ROOT, key);
}

function setBuiltAssetHeaders(res, filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  if (ext === '.html') {
    setNoStoreHeaders(res);
    return;
  }
  if (ext === '.js' || ext === '.css' || /\.(?:png|jpg|jpeg|gif|webp|ico|svg|woff|woff2|ttf|otf)$/i.test(ext)) {
    res.setHeader('Cache-Control', IMMUTABLE_CACHE);
  }
}

function servePrecompressedBuilt(rootDir) {
  return (req, res, next) => {
    const requestPath = String(req.path || '').split('?')[0];
    if (!/\.(?:js|css)$/i.test(requestPath)) return next();
    if (!/\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''))) return next();

    const decodedPath = decodeURIComponent(requestPath);
    const targetPath = path.resolve(rootDir, '.' + decodedPath);
    if (!targetPath.startsWith(path.resolve(rootDir))) return next();

    const gzipPath = `${targetPath}.gz`;
    if (!fs.existsSync(gzipPath)) return next();

    setBuiltAssetHeaders(res, targetPath);
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    if (/\.css$/i.test(targetPath)) res.type('text/css');
    else res.type('application/javascript');
    return res.sendFile(gzipPath, { dotfiles: 'allow' }, (err) => {
      if (err) next(err);
    });
  };
}

function builtStatic(key) {
  const rootDir = getBuiltFrontendPath(key);
  if (!fs.existsSync(rootDir)) {
    return (req, res, next) => next();
  }
  return [
    servePrecompressedBuilt(rootDir),
    express.static(rootDir, {
      dotfiles: 'allow',
      setHeaders: setBuiltAssetHeaders
    })
  ];
}

function sendFrontendHtml(res, filename, key = 'general') {
  const builtFile = path.join(getBuiltFrontendPath(key), filename);
  if (fs.existsSync(builtFile)) {
    setNoStoreHeaders(res);
    return res.sendFile(builtFile, { dotfiles: 'allow' });
  }
  const sourceFile = path.join(__dirname, '..', 'frontend', filename);
  setNoStoreHeaders(res);
  return res.sendFile(sourceFile);
}

function reportBuiltAssetStatus() {
  if (fs.existsSync(PLATFORM_BUILD_MANIFEST)) {
    console.log('✅ Optimized frontend build detected at .platform-build.');
  } else {
    console.warn('⚠️  Optimized frontend build missing. Run "npm run build" before PM2/server restart for fastest startup; source fallback is active.');
  }
}

reportBuiltAssetStatus();

// Serve static files from frontend with no-cache for HTML
app.use('/', builtStatic('general'));
app.use('/', express.static(path.join(__dirname, '..', 'frontend'), {
  setHeaders: (res, filePath) => {
    setStaticAssetHeaders(res, filePath, { noStoreExtensions: new Set(['.html']) });
  }
}));

app.use('/weapons/tmp', requireAppAccessMiddleware('weapons'));

// Serve weapons program frontend
app.use('/weapons', builtStatic('weapons'));
app.use('/weapons', express.static(path.join(__dirname, '..', '..', 'Weapons', 'frontend'), {
  setHeaders: (res, filePath) => {
    setStaticAssetHeaders(res, filePath);
  }
}));

// Ensure Report data/photos directory exists for serving uploaded assets
const REPORT_DATA_DIR = appDataDir('Report', {
  legacyDirs: [path.join(PROGRAM_ROOT, 'Report', 'data')],
  migrate: false
});
const REPORT_PHOTO_DIRS = ['photoC', 'photoP', 'photoA'];

const reportPhotoHeaderSetter = (res, filePath) => {
  setStaticAssetHeaders(res, filePath, { noStoreExtensions: new Set(['.pdf']) });
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    res.type('application/pdf');
  }
};

REPORT_PHOTO_DIRS.forEach((dirName) => {
  const absoluteDir = path.join(REPORT_DATA_DIR, dirName);
  try {
    if (!fs.existsSync(absoluteDir)) {
      fs.mkdirSync(absoluteDir, { recursive: true });
    }
  } catch (error) {
    console.warn(`⚠️  Unable to ensure Report photo directory ${dirName}:`, error && error.message);
  }
  app.use(`/report/${dirName}`, requireAppAccessMiddleware('report'), express.static(absoluteDir, { setHeaders: reportPhotoHeaderSetter }));
});

// Serve report frontend
app.use('/report', builtStatic('report'));
app.use('/report', express.static(path.join(__dirname, '..', '..', 'Report', 'public'), {
  setHeaders: (res, filePath) => {
    setStaticAssetHeaders(res, filePath);
  }
}));

// Serve request frontend
app.use('/request', builtStatic('request'));
app.use('/request', express.static(path.join(__dirname, '..', '..', 'Request', 'frontend'), {
  setHeaders: (res, filePath) => {
    setStaticAssetHeaders(res, filePath);
  }
}));

// Serve accept frontend
app.use('/accept', builtStatic('accept'));
app.use('/accept', express.static(path.join(__dirname, '..', '..', 'Accept', 'frontend'), {
  setHeaders: (res, filePath) => {
    setStaticAssetHeaders(res, filePath);
  }
}));

// Serve weapons temp files
// Serve temp files actually stored under Weapons/frontend/tmp
app.use('/weapons/tmp', requireAuthMiddleware, express.static(dataSubdir('Weapons', 'tmp'), {
  etag: false,
  lastModified: false,
  cacheControl: false,
  setHeaders: (res) => {
    setNoStoreHeaders(res);
  }
}));

// Serve renewal program frontend
app.use('/renewal/vendor/pdfjs', express.static(PDFJS_DIST_DIR, {
  setHeaders: (res, filePath) => {
    setStaticAssetHeaders(res, filePath);
  }
}));
app.use('/renewal', builtStatic('renewal'));
app.use('/renewal', express.static(path.join(__dirname, '..', '..', 'Renewal', 'frontend'), {
  setHeaders: (res, filePath) => {
    setStaticAssetHeaders(res, filePath);
  }
}));

// Serve weapons data files stored outside the frontend bundle
const WEAPONS_DATA_DIR = appDataDir('Weapons', {
  legacyDirs: [path.join(PROGRAM_ROOT, 'Weapons', 'Data')],
  migrate: false
});
const WEAPONS_CSV_PATH = dataFile('Weapons', 'slah.csv', [
  path.join(PROGRAM_ROOT, 'Weapons', 'Data', 'slah.csv')
]);

app.use('/weapons/data', (req, res) => res.status(404).json({ error: 'Direct data-directory access is disabled.' }));

// Legacy direct CSV URL compatibility
app.get('/weapons/slah.csv', requireAppAccessMiddleware('weapons'), (req, res) => {
  setNoStoreHeaders(res);
  res.sendFile(WEAPONS_CSV_PATH);
});

// Serve seized program frontend
app.use('/seized', builtStatic('seized'));
app.use('/seized', express.static(path.join(__dirname, '..', '..', 'Seized', 'Frontend'), {
  setHeaders: (res, filePath) => {
    setStaticAssetHeaders(res, filePath, { noStoreExtensions: new Set(['.html']) });
  }
}));

// Serve united storage frontend. Uploaded blobs are never served statically.
app.get('/storage', (req, res) => {
  res.redirect('/storage/index.html');
});
app.use('/storage', builtStatic('storage'));
app.use('/storage', express.static(path.join(__dirname, '..', '..', 'Storage', 'frontend'), {
  setHeaders: (res, filePath) => {
    setStaticAssetHeaders(res, filePath, { noStoreExtensions: new Set(['.html']) });
  }
}));

// Serve Company program frontend and API under the /company namespace.
app.get('/company', (req, res) => {
  res.redirect('/company/index.html');
});
app.use('/company/api', requireAppAccessMiddleware('company'));
app.use(['/company/uploads', '/company/license-uploads', '/company/company-uploads', '/company/gps-uploads', '/company/qr-uploads', '/company/logo-uploads', '/company/inspection-uploads', '/company/car-uploads'], requireAppAccessMiddleware('company'));
app.use('/company', builtStatic('company'));
app.use('/company', createLazyRouter(
  path.join(__dirname, '..', '..', 'Company', 'Backend', 'api-routes.js'),
  {
    successMessage: '✅ Company app loaded at /company',
    failureMessage: '⚠️  Company app not loaded:'
  }
));

// ========== ROUTING ==========

app.get('/reference-data.js', (req, res) => {
  const data = loadReferenceData();
  if (!_referenceJsCache || _referenceJsCache.updatedAt !== data.updatedAt) {
    const snapshot = sanitizeReferenceDataForClient(data);
    const serialized = JSON.stringify(snapshot).replace(/</g, '\\u003c');
    const body = `window.__ADMINISTRATIVE_SHARED_REFERENCE_DATA__ = ${serialized};`;
    const etag = `"${crypto.createHash('sha1').update(body).digest('hex')}"`;
    _referenceJsCache = { updatedAt: data.updatedAt, etag, body };
  }
  if (req.headers['if-none-match'] === _referenceJsCache.etag) {
    return res.status(304).end();
  }
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', REVALIDATE_CACHE);
  res.setHeader('ETag', _referenceJsCache.etag);
  res.send(_referenceJsCache.body);
});

app.get('/reference-runtime.js', (req, res) => {
  const data = loadReferenceData();
  if (!_referenceRuntimeCache || _referenceRuntimeCache.updatedAt !== data.updatedAt) {
    const helperPath = path.join(__dirname, '..', 'frontend', 'shared-reference-data.js');
    if (_helperSourceCache === null) {
      _helperSourceCache = fs.existsSync(helperPath) ? fs.readFileSync(helperPath, 'utf8') : '';
    }
    const snapshot = sanitizeReferenceDataForClient(data);
    const serialized = JSON.stringify(snapshot).replace(/</g, '\\u003c');
    const body = [
      `window.__ADMINISTRATIVE_SHARED_REFERENCE_DATA__ = ${serialized};`,
      _helperSourceCache
    ].join('\n');
    const etag = `"${crypto.createHash('sha1').update(body).digest('hex')}"`;
    _referenceRuntimeCache = { updatedAt: data.updatedAt, etag, body };
  }
  if (req.headers['if-none-match'] === _referenceRuntimeCache.etag) {
    return res.status(304).end();
  }
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', REVALIDATE_CACHE);
  res.setHeader('ETag', _referenceRuntimeCache.etag);
  res.send(_referenceRuntimeCache.body);
});

// Main authentication route - redirect to index.html
app.get('/', (req, res) => {
  sendFrontendHtml(res, 'index.html');
});

// Explicit route for login page
app.get('/login', (req, res) => {
  sendFrontendHtml(res, 'index.html');
});

// Dashboard route after authentication
app.get('/dashboard', (req, res) => {
  sendFrontendHtml(res, 'main.html');
});

// Convenience redirects to entry pages of sub-programs
app.get('/weapons', (req, res) => {
  res.redirect('/weapons/sheet.html');
});

app.get('/renewal', (req, res) => {
  res.redirect('/renewal/sheet.html');
});

app.get('/accept', (req, res) => {
  res.redirect('/accept/index.html');
});

app.get('/seized', (req, res) => {
  res.redirect('/seized/index.html');
});

// ========== AUTHENTICATION API ==========

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
    }

    const store = loadUsers();
    const user = store.users.find((u) => u.username && u.username.toLowerCase() === String(username).toLowerCase());
    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    if (isLocalOnlyUser(user) && !canUseLocalTestAccount(req)) {
      return res.status(403).json({ success: false, message: 'هذا الحساب التجريبي متاح من جهاز الخادم فقط' });
    }

    user.lastLogin = new Date().toISOString();
    saveUsers(store);

    const token = crypto.randomBytes(32).toString('hex');
    ACTIVE_TOKENS.set(token, { username: user.username, issuedAt: Date.now() });
    res.cookie('administrative_demo_session', token, { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 8 * 60 * 60 * 1000 });
    logActivityEvent({
      user,
      token,
      source: 'server',
      eventType: 'auth:login',
      message: 'تم تسجيل الدخول',
      context: { programKey: 'login', path: '/login', pageName: 'تسجيل الدخول' }
    });

    return res.json({
      success: true,
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('login error:', error);
    return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

app.get('/api/auth/profile', (req, res) => {
  const auth = authenticateRequest(req);
  if (!auth) return res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول مرة أخرى' });
  return res.json({ success: true, user: sanitizeUser(auth.user) });
});

app.put('/api/dashboard-preferences', (req, res) => {
  const auth = requireAuthenticatedUser(req, res);
  if (!auth) return;
  if (!canCustomizeDashboardApps(auth.user)) {
    return res.status(403).json({ success: false, message: 'صلاحية تخصيص تطبيقات اللوحة غير متاحة لهذا الحساب' });
  }

  const hiddenApps = req.body && Array.isArray(req.body.hiddenApps)
    ? req.body.hiddenApps
    : null;
  if (!hiddenApps) {
    return res.status(400).json({ success: false, message: 'يرجى إرسال قائمة التطبيقات المخفية بشكل صحيح' });
  }

  const store = loadUsers();
  const user = store.users.find((entry) => entry.username === auth.user.username);
  if (!user) {
    return res.status(404).json({ success: false, message: 'الحساب غير موجود' });
  }

  user.hiddenDashboardApps = normalizeHiddenDashboardApps(hiddenApps, ALL_APP_KEYS);
  saveUsers(store);
  logActivityEvent({
    user,
    token: auth.token,
    source: 'server',
    eventType: 'dashboard-preferences:update',
    message: 'تم تحديث التطبيقات مكتب تجريبي 13ة في اللوحة الرئيسية',
    context: { programKey: 'settings', path: req.originalUrl, pageName: 'الإعدادات' },
    details: { hiddenApps: user.hiddenDashboardApps.slice() }
  });
  return res.json({ success: true, user: sanitizeUser(user) });
});

app.get('/api/global-search', async (req, res) => {
  const auth = requireGlobalSearchUser(req, res);
  if (!auth) return;

  try {
    const query = String(req.query.q || req.query.query || '').trim();
    if (query.length < 2) {
      return res.json({ success: true, query, count: 0, results: [] });
    }

    const payload = await searchPlatformRecords(
      query,
      buildGlobalSearchStoreOptions(auth, { limit: 200 })
    );
    return res.json(payload);
  } catch (error) {
    console.error('global search error:', error);
    return res.status(500).json({ success: false, message: 'تعذر تنفيذ البحث العام' });
  }
});

app.get('/api/global-search/attachments/:reference', async (req, res) => {
  const auth = requireGlobalSearchUser(req, res);
  if (!auth) return;

  try {
    setNoStoreHeaders(res);
    const attachments = await listGlobalSearchAttachments(
      req.params.reference,
      buildGlobalSearchStoreOptions(auth)
    );
    return res.json({ success: true, count: attachments.length, attachments });
  } catch (error) {
    const status = Number(error && error.status) || 500;
    if (status >= 500) console.error('global search attachment list error:', error);
    return res.status(status).json({
      success: false,
      message: status >= 500 ? 'تعذر تحميل المرفقات' : String(error.message || 'تعذر تحميل المرفقات')
    });
  }
});

app.get('/api/global-search/attachments/:reference/files/:attachmentId', async (req, res) => {
  const auth = requireGlobalSearchUser(req, res);
  if (!auth) return;

  try {
    const attachment = await resolveGlobalSearchAttachment(
      req.params.reference,
      req.params.attachmentId,
      buildGlobalSearchStoreOptions(auth)
    );
    setNoStoreHeaders(res);
    res.type(attachment.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(attachment.name || 'attachment')}`
    );
    return res.sendFile(attachment.absolutePath);
  } catch (error) {
    const status = Number(error && error.status) || 500;
    if (status >= 500) console.error('global search attachment file error:', error);
    return res.status(status).json({
      success: false,
      message: status >= 500 ? 'تعذر فتح المرفق' : String(error.message || 'تعذر فتح المرفق')
    });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('administrative_demo_session', { httpOnly: true, sameSite: 'strict', path: '/' });
  let logoutUser = null;
  let logoutToken = '';
  let cleared = false;
  const auth = authenticateRequest(req);
  if (auth) {
    logoutUser = auth.user;
    logoutToken = auth.token;
    ACTIVE_TOKENS.delete(auth.token);
    clearPresenceByToken(auth.token);
    cleared = true;
  } else if (req.body && req.body.token) {
    logoutToken = String(req.body.token);
    const existingSession = ACTIVE_TOKENS.get(logoutToken);
    if (existingSession && existingSession.username) {
      const store = loadUsers();
      logoutUser = store.users.find((user) => user.username === existingSession.username) || null;
    }
    ACTIVE_TOKENS.delete(logoutToken);
    clearPresenceByToken(logoutToken);
    cleared = true;
  }
  if (logoutUser) {
    logActivityEvent({
      user: logoutUser,
      token: logoutToken,
      source: 'server',
      eventType: 'auth:logout',
      message: 'تم تسجيل الخروج',
      context: { programKey: 'general', path: '/api/auth/logout', pageName: 'تسجيل الخروج' }
    });
  }
  res.json({ success: true, message: 'تم تسجيل الخروج بنجاح', cleared });
});

app.get('/api/auth/access-events', (req, res) => {
  // EventSource can't send custom headers, so token comes via query param
  const token = String(req.query.token || '').trim();
  const session = token ? ACTIVE_TOKENS.get(token) : null;
  if (!session) return res.status(401).end();
  const store = loadUsers();
  if (!store.users.find((u) => u.username === session.username)) return res.status(401).end();
  try { req.socket.setTimeout(0); } catch {}

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write(': connected\n\n');

  addAccessRevokeStream(token, res);

  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) {
      clearInterval(ping);
      removeAccessRevokeStream(token, res);
    }
  }, 25000);

  const cleanup = () => {
    clearInterval(ping);
    removeAccessRevokeStream(token, res);
  };

  try { req.socket.on('close', cleanup); } catch {}
  res.on('error', cleanup);
  res.on('finish', cleanup);
});

app.get('/api/auth/app-access', (req, res) => {
  const auth = requireAuthenticatedUser(req, res);
  if (!auth) return;
  const programKey = String(req.query.app || '').trim().toLowerCase();
  return res.json({ hasAccess: userHasAppAccess(auth.user, programKey) });
});

app.post('/api/activity/heartbeat', (req, res) => {
  const auth = requireAuthenticatedUser(req, res);
  if (!auth) return;

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const clientId = sanitizeActivityClientId(body.clientId);
  if (!clientId) {
    return res.status(400).json({ success: false, message: 'معرف الجلسة غير متوفر' });
  }

  const state = sanitizeActivityText(body.state || 'active', 16).toLowerCase();
  const context = normalizeActivityContext(body.context || body, req.get('referer') || req.originalUrl);

  if (state === 'closing' || state === 'closed' || state === 'offline') {
    clearClientPresence({ auth, clientId });
    return res.json({ success: true, active: false });
  }

  // Check if the user still has access to the app they're currently in
  if (!userHasAppAccess(auth.user, context.programKey)) {
    clearClientPresence({ auth, clientId });
    return res.json({ success: true, active: false, accessRevoked: true });
  }

  const presence = setClientPresence({ auth, clientId, context, presenceState: state });
  return res.json({ success: true, active: true, presence });
});

app.post('/api/activity/events', (req, res) => {
  const auth = requireAuthenticatedUser(req, res);
  if (!auth) return;

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const context = normalizeActivityContext(body.context || body, req.get('referer') || req.originalUrl);
  const clientId = sanitizeActivityClientId(body.clientId);
  const eventType = sanitizeActivityText(body.eventType || 'event', 48) || 'event';
  const message = sanitizeActivityText(body.message || '', 220) || buildActivityMessage(eventType, context);
  const details = body.details && typeof body.details === 'object' ? body.details : undefined;

  const entry = logActivityEvent({
    user: auth.user,
    token: auth.token,
    clientId,
    source: 'client',
    eventType,
    message,
    context,
    details
  });

  return res.json({ success: true, entry });
});

app.post('/api/activity/draft', (req, res) => {
  const auth = requireAuthenticatedUser(req, res);
  if (!auth) return;

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const clientId = sanitizeActivityClientId(body.clientId);
  if (!clientId) {
    return res.status(400).json({ success: false, message: 'معرف الجلسة غير متوفر' });
  }

  const context = normalizeActivityContext(body.context || body, req.get('referer') || req.originalUrl);
  const clearRequested = body.clear === true || body.draft === null;
  const presence = setClientDraft({
    auth,
    clientId,
    context,
    draft: clearRequested ? null : (body.draft || body)
  });

  return res.json({ success: true, active: true, presence });
});

app.post('/api/activity/sync', (req, res) => {
  const auth = requireAuthenticatedUser(req, res);
  if (!auth) return;

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const clientId = sanitizeActivityClientId(body.clientId);
  if (!clientId) {
    return res.status(400).json({ success: false, message: 'معرف الجلسة غير متوفر' });
  }

  const context = normalizeActivityContext(body.context || body, req.get('referer') || req.originalUrl);
  const signal = addActivitySignal({
    auth,
    clientId,
    context,
    signal: body.signal || body
  });

  return res.json({ success: true, signal });
});

app.get('/api/activity/active-users', (req, res) => {
  const auth = requireAdminUser(req, res);
  if (!auth) return;

  res.json({
    success: true,
    users: listActiveClients(),
    generatedAt: new Date().toISOString()
  });
});

app.get('/api/activity/roster', (req, res) => {
  const auth = requireAuthenticatedUser(req, res);
  if (!auth) return;

  if (!isSuperSecretaryRole(auth.user) && !canViewActivityHistory(auth.user)) {
    return res.status(403).json({ success: false, message: 'صلاحيات غير كافية' });
  }

  if (!isAdminRole(auth.user)) {
    return res.json({
      success: true,
      accountColorOnly: true,
      users: listAccountColorRoster(),
      activeUsers: [],
      generatedAt: new Date().toISOString()
    });
  }

  const activeUsers = listActiveClients();
  res.json({
    success: true,
    users: listPresenceRoster(activeUsers),
    activeUsers,
    generatedAt: new Date().toISOString()
  });
});

app.get('/api/delete-approvals/pending', (req, res) => {
  const auth = requireDeleteApprovalReviewer(req, res);
  if (!auth) return;

  const requests = deleteApprovalStore.listPendingDeleteApprovals();
  return res.json({
    success: true,
    count: requests.length,
    requests,
    generatedAt: new Date().toISOString()
  });
});

app.get('/api/delete-approvals/mine', (req, res) => {
  const auth = requireAuthenticatedUser(req, res);
  if (!auth) return;

  try {
    const requests = deleteApprovalStore.listRequesterDeleteApprovals(auth.user);
    return res.json({
      success: true,
      count: requests.length,
      requests,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      success: false,
      message: error?.message || 'تعذر تحميل طلبات الحذف الخاصة بك'
    });
  }
});

app.post('/api/delete-approvals/:id/resubmit', (req, res) => {
  const auth = requireAuthenticatedUser(req, res);
  if (!auth) return;

  try {
    const result = deleteApprovalStore.resubmitDeleteApproval(req.params.id, auth.user);
    return res.json({
      success: true,
      request: result.request
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      success: false,
      code: error?.code || null,
      message: error?.message || 'تعذر إعادة إرسال الطلب'
    });
  }
});

app.post('/api/delete-approvals/:id/dismiss', (req, res) => {
  const auth = requireAuthenticatedUser(req, res);
  if (!auth) return;

  try {
    const result = deleteApprovalStore.dismissRequesterDeleteApproval(req.params.id, auth.user);
    return res.json({
      success: true,
      request: result.request
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      success: false,
      message: error?.message || 'تعذر إخفاء الطلب'
    });
  }
});

app.post('/api/delete-approvals/:id/approve', async (req, res) => {
  const auth = requireDeleteApprovalReviewer(req, res);
  if (!auth) return;

  try {
    const result = await deleteApprovalStore.approveDeleteApproval(req.params.id, auth.user);
    return res.json({
      success: true,
      stale: Boolean(result.stale),
      request: result.request
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      success: false,
      code: error?.code || null,
      message: error?.message || 'تعذر تنفيذ طلب الحذف'
    });
  }
});

app.post('/api/delete-approvals/:id/items/:itemId/approve', async (req, res) => {
  const auth = requireDeleteApprovalReviewer(req, res);
  if (!auth) return;

  try {
    const result = await deleteApprovalStore.approveDeleteApprovalItem(req.params.id, req.params.itemId, auth.user);
    return res.json({
      success: true,
      stale: Boolean(result.stale),
      request: result.request,
      item: result.item
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      success: false,
      code: error?.code || null,
      message: error?.message || 'تعذر تنفيذ طلب حذف السجل'
    });
  }
});

app.post('/api/delete-approvals/:id/deny', async (req, res) => {
  const auth = requireDeleteApprovalReviewer(req, res);
  if (!auth) return;

  try {
    const result = await deleteApprovalStore.denyDeleteApproval(req.params.id, auth.user);
    return res.json({
      success: true,
      stale: Boolean(result.stale),
      request: result.request
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      success: false,
      code: error?.code || null,
      message: error?.message || 'تعذر رفض طلب الحذف'
    });
  }
});

app.post('/api/delete-approvals/:id/items/:itemId/deny', async (req, res) => {
  const auth = requireDeleteApprovalReviewer(req, res);
  if (!auth) return;

  try {
    const result = await deleteApprovalStore.denyDeleteApprovalItem(req.params.id, req.params.itemId, auth.user);
    return res.json({
      success: true,
      stale: Boolean(result.stale),
      request: result.request,
      item: result.item
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      success: false,
      code: error?.code || null,
      message: error?.message || 'تعذر رفض سجل الحذف'
    });
  }
});

app.get('/api/activity/presence', (req, res) => {
  const auth = requireAuthenticatedUser(req, res);
  if (!auth) return;

  res.json({
    success: true,
    users: listActiveClients(),
    signals: listRecentActivitySignals(),
    generatedAt: new Date().toISOString()
  });
});

app.get('/api/activity/logs', (req, res) => {
  const auth = requireActivityReviewer(req, res);
  if (!auth) return;

  const page = readActivityPage({
    username: req.query && req.query.username,
    limit: req.query && req.query.limit,
    cursor: req.query && req.query.cursor,
    query: req.query && req.query.query
  });
  return res.json({
    success: true,
    logs: page.entries,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    generatedAt: new Date().toISOString()
  });
});
app.get('/api/activity/users/:username/logs', (req, res) => {
  const auth = requireActivityReviewer(req, res);
  if (!auth) return;

  const username = sanitizeActivityText(req.params.username, 64);
  if (!username) {
    return res.status(400).json({ success: false, message: 'اسم المستخدم غير صالح' });
  }

  const store = loadUsers();
  const user = store.users.find((entry) => entry.username === username);
  if (!user) {
    return res.status(404).json({ success: false, message: 'الفرد غير موجود' });
  }

  const page = readActivityPage({
    username,
    limit: req.query && req.query.limit,
    cursor: req.query && req.query.cursor
  });

  const activeSessions = listActiveClients().filter((entry) => entry.username === username);

  res.json({
    success: true,
    user: sanitizeUser(user),
    activeSessions,
    logs: page.entries,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore
  });
});

app.get('/api/settings/theme', (req, res) => {
  const settings = loadThemeSettings();
  res.json({ success: true, theme: settings.theme, updatedAt: settings.updatedAt });
});

app.put('/api/settings/theme', (req, res) => {
  const auth = requireAuthenticatedUser(req, res);
  if (!auth) return;

  const desiredTheme = req.body && typeof req.body.theme === 'string' ? req.body.theme : 'light';
  const saved = saveThemeSettings({ theme: desiredTheme });
  logActivityEvent({
    user: auth.user,
    token: auth.token,
    source: 'server',
    eventType: 'theme:update',
    message: saved.theme === 'dark' ? 'تم تفعيل الوضع الداكن' : 'تم تفعيل الوضع الفاتح',
    context: { programKey: 'settings', path: req.originalUrl, pageName: 'الإعدادات' },
    details: { theme: saved.theme }
  });
  res.json({ success: true, theme: saved.theme, updatedAt: saved.updatedAt });
});

app.get('/api/app-config', (req, res) => {
  const auth = requireAuthenticatedUser(req, res);
  if (!auth) return;
  const config = loadAppConfig();
  res.json({ success: true, apps: config.apps, updatedAt: config.updatedAt });
});

app.put('/api/app-config', (req, res) => {
  const auth = requireAppCatalogManager(req, res);
  if (!auth) return;

  const apps = req.body && Array.isArray(req.body.apps) ? req.body.apps : null;
  if (!apps) {
    return res.status(400).json({ success: false, message: 'يرجى إرسال قائمة التطبيقات بشكل صحيح' });
  }

  const saved = saveAppConfig({ apps });
  logActivityEvent({
    user: auth.user,
    token: auth.token,
    source: 'server',
    eventType: 'app-config:update',
    message: 'تم تحديث بطاقات البرامج في اللوحة الرئيسية',
    context: { programKey: 'settings', path: req.originalUrl, pageName: 'الإعدادات' }
  });
  res.json({ success: true, apps: saved.apps, updatedAt: saved.updatedAt });
});

app.get('/api/action-approval-policy', (req, res) => {
  const auth = requireAuthenticatedUser(req, res);
  if (!auth) return;

  if (!isAdminRole(auth.user)) {
    return res.status(403).json({ success: false, message: 'صلاحيات غير كافية' });
  }

  const policy = deleteApprovalStore.loadActionApprovalPolicy();
  res.json({
    success: true,
    policy,
    actions: deleteApprovalStore.APPROVAL_ACTIONS,
    actionLabels: deleteApprovalStore.ACTION_LABELS,
    updatedAt: policy.updatedAt
  });
});

app.put('/api/action-approval-policy', (req, res) => {
  const auth = requireAdminUser(req, res);
  if (!auth) return;

  try {
    const saved = deleteApprovalStore.saveActionApprovalPolicy(req.body || {});
    logActivityEvent({
      user: auth.user,
      token: auth.token,
      source: 'server',
      eventType: 'action-approval-policy:update',
      message: 'تم تحديث قيود اعتماد إجراءات البرامج',
      context: { programKey: 'settings', path: req.originalUrl, pageName: 'الإعدادات' }
    });
    return res.json({
      success: true,
      policy: saved,
      actions: deleteApprovalStore.APPROVAL_ACTIONS,
      actionLabels: deleteApprovalStore.ACTION_LABELS,
      updatedAt: saved.updatedAt
    });
  } catch (error) {
    console.error('action approval policy update error:', error);
    return res.status(500).json({ success: false, message: 'تعذر حفظ قيود اعتماد الإجراءات' });
  }
});

app.get('/api/reference-data', (req, res) => {
  const auth = authenticateRequest(req);
  const data = sanitizeReferenceDataForClient(loadReferenceData());
  res.json({
    success: true,
    data,
    updatedAt: data.updatedAt,
    canEdit: Boolean(auth && canManageReferenceData(auth.user))
  });
});

app.put('/api/reference-data', (req, res) => {
  const auth = requireAuthenticatedUser(req, res);
  if (!auth) return;
  if (!canManageReferenceData(auth.user)) {
    return res.status(403).json({ success: false, message: 'صلاحيات غير كافية لتعديل البيانات المشتركة' });
  }

  try {
    const payload = req.body && req.body.data && typeof req.body.data === 'object'
      ? req.body.data
      : (req.body && typeof req.body === 'object' ? req.body : null);
    if (!payload) {
      return res.status(400).json({ success: false, message: 'بيانات غير صالحة' });
    }

    const saved = sanitizeReferenceDataForClient(saveReferenceData(payload));
    logActivityEvent({
      user: auth.user,
      token: auth.token,
      source: 'server',
      eventType: 'reference-data:update',
      message: 'تم تحديث البيانات المشتركة',
      context: { programKey: 'settings', path: req.originalUrl, pageName: 'الإعدادات' }
    });

    return res.json({ success: true, data: saved, updatedAt: saved.updatedAt, canEdit: true });
  } catch (error) {
    console.error('reference data update error:', error);
    return res.status(500).json({ success: false, message: 'تعذر حفظ البيانات المشتركة' });
  }
});

app.get('/api/users', (req, res) => {
  const auth = requireUserViewer(req, res);
  if (!auth) return;
  const store = loadUsers();
  const appConfig = loadAppConfig();
  res.json({ success: true, users: store.users.map(sanitizeUser), apps: appConfig.apps.map((entry) => entry.key) });
});

app.post('/api/users', (req, res) => {
  const auth = requireManagedUserCreator(req, res);
  if (!auth) return;

  try {
    const { username, password, displayName, room, role, allowedApps } = req.body || {};
    const requestedSectors = extractSectorPayload(req.body);
    const stationPayload = extractStationPayload(req.body);
    const requestedPermissions = normalizePermissionsValue(req.body && req.body.permissions ? req.body.permissions : req.body, role);
    if (!isAdminRole(auth.user)) {
      requestedPermissions.viewActivityHistory = false;
      requestedPermissions.editRenewalDocuments = false;
    }
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'اسم المستخدم وكلمة المرور مطلوبة' });
    }

    const normalizedPassword = typeof password === 'string' ? password.trim() : '';
    if (normalizedPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `كلمة المرور يجب أن تحتوي على ${MIN_PASSWORD_LENGTH} رموز على الأقل`
      });
    }

    const normalizedUsername = String(username).trim();
    if (!/^[\w.-]{3,32}$/.test(normalizedUsername)) {
      return res.status(400).json({ success: false, message: 'اسم المستخدم يجب أن يكون من 3 إلى 32 رمزاً بدون مسافات' });
    }

    const store = loadUsers();
    if (store.users.some((u) => u.username && u.username.toLowerCase() === normalizedUsername.toLowerCase())) {
      return res.status(409).json({ success: false, message: 'اسم المستخدم مسجل بالفعل' });
    }

    const normalizedRole = normalizeRoleValue(role);
    if (!canCreateUserRole(auth.user, normalizedRole)) {
      return res.status(403).json({ success: false, message: 'لا يمكن لهذا الدور إنشاء هذا النوع من الحسابات' });
    }

    const newUser = {
      username: normalizedUsername,
      displayName: displayName && String(displayName).trim() ? String(displayName).trim() : normalizedUsername,
      role: normalizedRole,
      allowedApps: Array.isArray(allowedApps) ? allowedApps : [],
      permissions: requestedPermissions,
      passwordHash: hashPassword(normalizedPassword),
      createdAt: new Date().toISOString()
    };

    let sectors = requestedSectors;
    if (!sectors.length && room) {
      sectors = normalizeSectorList([room]);
    }

    if (newUser.role === ADMIN_ROLE || newUser.role === SUPERSECRETARY_ROLE || newUser.role === SECRETARY_ROLE) {
      sectors = [ADMIN_SECTOR_VALUE];
    } else if (!sectors.length) {
      return res.status(400).json({ success: false, message: 'يرجى تحديد قطاع واحد على الأقل للفرد' });
    }

    newUser.rooms = sectors;
    newUser.room = sectors[0] || '';
    newUser.stationAccess = stationPayload;
    normalizeUserSectors(newUser);

    newUser.allowedApps = resolveAllowedApps(newUser);

    store.users.push(newUser);
    saveUsers(store);
    logActivityEvent({
      user: auth.user,
      token: auth.token,
      source: 'server',
      eventType: 'user:create',
      message: `تم إنشاء فرد جديد: ${newUser.displayName || newUser.username}`,
      context: { programKey: 'settings', path: req.originalUrl, pageName: 'الإعدادات' },
      details: {
        targetUsername: newUser.username,
        targetRole: normalizeRoleValue(newUser.role)
      }
    });

    res.status(201).json({ success: true, user: sanitizeUser(newUser) });
  } catch (error) {
    console.error('create user error:', error);
  res.status(500).json({ success: false, message: 'خطأ في إنشاء الفرد' });
  }
});

app.get('/api/users/:username', (req, res) => {
  const auth = requireUserViewer(req, res);
  if (!auth) return;

  const targetUsername = req.params.username;
  const store = loadUsers();
  const user = store.users.find((u) => u.username === targetUsername);
  if (!user) {
  return res.status(404).json({ success: false, message: 'الفرد غير موجود' });
  }

  res.json({ success: true, user: sanitizeUser(user) });
});

app.put('/api/users/:username', (req, res) => {
  const auth = requireAdminUser(req, res);
  if (!auth) return;

  try {
    const targetUsername = req.params.username;
    const { displayName, room, role, allowedApps, password } = req.body || {};
    const requestedSectors = extractSectorPayload(req.body);
    const sectorFieldProvided = req.body && (
      Object.prototype.hasOwnProperty.call(req.body, 'sectors') ||
      Object.prototype.hasOwnProperty.call(req.body, 'rooms') ||
      Object.prototype.hasOwnProperty.call(req.body, 'room') ||
      Object.prototype.hasOwnProperty.call(req.body, 'sector')
    );
    const stationPayload = extractStationPayload(req.body);
    const stationFieldProvided = req.body && (
      Object.prototype.hasOwnProperty.call(req.body, 'stationAccess') ||
      Object.prototype.hasOwnProperty.call(req.body, 'stations')
    );
    const permissionsFieldProvided = Boolean(req.body && (
      Object.prototype.hasOwnProperty.call(req.body, 'permissions') ||
      Object.prototype.hasOwnProperty.call(req.body, 'manageReferenceData') ||
      Object.prototype.hasOwnProperty.call(req.body, 'referenceDataEditor') ||
      Object.prototype.hasOwnProperty.call(req.body, 'referenceDataWrite') ||
      Object.prototype.hasOwnProperty.call(req.body, 'canManageReferenceData') ||
      Object.prototype.hasOwnProperty.call(req.body, 'customizeDashboardApps') ||
      Object.prototype.hasOwnProperty.call(req.body, 'dashboardAppCustomization') ||
      Object.prototype.hasOwnProperty.call(req.body, 'canCustomizeDashboardApps') ||
      Object.prototype.hasOwnProperty.call(req.body, 'viewActivityHistory') ||
      Object.prototype.hasOwnProperty.call(req.body, 'editRenewalDocuments')
    ));

    const store = loadUsers();
    const idx = store.users.findIndex((u) => u.username === targetUsername);
    if (idx === -1) {
  return res.status(404).json({ success: false, message: 'الفرد غير موجود' });
    }

  const user = store.users[idx];
  if (isProtectedAdminEdit({ actor: auth.user, target: user })) {
    return res.status(403).json({ success: false, message: 'لا يمكن لمدير تعديل حساب مدير آخر' });
  }

  const updates = { ...user };
  updates.role = normalizeRoleValue(updates.role);

    const normalizedPassword = typeof password === 'string' ? password.trim() : '';

    if (displayName !== undefined) {
      updates.displayName = String(displayName || '').trim() || user.username;
    }

    if (password !== undefined && password !== null) {
      if (!normalizedPassword) {
        return res.status(400).json({ success: false, message: 'يرجى إدخال كلمة مرور صحيحة' });
      }
      if (normalizedPassword.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `كلمة المرور يجب أن تحتوي على ${MIN_PASSWORD_LENGTH} رموز على الأقل`
        });
      }
      updates.passwordHash = hashPassword(normalizedPassword);
    }

    const requestedRole = role ? normalizeRoleValue(role) : updates.role;
    if (requestedRole !== updates.role) {
      if (requestedRole === ADMIN_ROLE) {
        updates.role = ADMIN_ROLE;
      } else {
        const storeAdmins = store.users.filter((u) => normalizeRoleValue(u.role) === ADMIN_ROLE);
        const isLastAdmin = storeAdmins.length <= 1 && normalizeRoleValue(user.role) === ADMIN_ROLE;
        if (isLastAdmin) {
          return res.status(400).json({ success: false, message: 'لا يمكن إزالة آخر مدير للنظام' });
        }
        updates.role = requestedRole === SUPERSECRETARY_ROLE
          ? SUPERSECRETARY_ROLE
          : requestedRole === SECRETARY_ROLE
            ? SECRETARY_ROLE
            : USER_ROLE;
      }
    }

    if (updates.role === ADMIN_ROLE) {
      updates.rooms = [ADMIN_SECTOR_VALUE];
      updates.room = ADMIN_SECTOR_VALUE;
      updates.allowedApps = ALL_APP_KEYS.slice();
      updates.permissions = normalizePermissionsValue({ manageReferenceData: true }, updates.role);
      updates.stationAccess = {};
    } else {
      if (updates.role === SUPERSECRETARY_ROLE || updates.role === SECRETARY_ROLE) {
        updates.rooms = [ADMIN_SECTOR_VALUE];
        updates.room = ADMIN_SECTOR_VALUE;
        updates.stationAccess = {};
      }
      if (Array.isArray(allowedApps)) {
        updates.allowedApps = allowedApps;
      }
      if (permissionsFieldProvided || updates.permissions == null) {
        const source = req.body && req.body.permissions ? req.body.permissions : req.body;
        updates.permissions = normalizePermissionsValue(source, updates.role);
      }
      if (updates.role === USER_ROLE && sectorFieldProvided) {
        let sectors = requestedSectors;
        if (!sectors.length && room !== undefined) {
          sectors = normalizeSectorList([room]);
        }
        if (!sectors.length) {
          return res.status(400).json({ success: false, message: 'يرجى اختيار قطاع واحد على الأقل للفرد' });
        }
        updates.rooms = sectors;
        updates.room = sectors[0] || '';
      }
      if (updates.role === USER_ROLE && stationFieldProvided) {
        updates.stationAccess = stationPayload;
      }
      updates.allowedApps = resolveAllowedApps(updates);
    }

    normalizeUserSectors(updates);

    const revokedApps = getRevokedAllowedApps(user, updates);
    store.users[idx] = updates;
    saveUsers(store);
    broadcastAccessRevoked(updates.username, revokedApps);
    logActivityEvent({
      user: auth.user,
      token: auth.token,
      source: 'server',
      eventType: 'user:update',
      message: `تم تعديل بيانات ${updates.displayName || updates.username}`,
      context: { programKey: 'settings', path: req.originalUrl, pageName: 'الإعدادات' },
      details: {
        targetUsername: updates.username,
        targetRole: normalizeRoleValue(updates.role)
      }
    });

    res.json({ success: true, user: sanitizeUser(updates) });
  } catch (error) {
    console.error('update user error:', error);
  res.status(500).json({ success: false, message: 'تعذر تحديث الفرد' });
  }
});

app.put('/api/users/:username/password', (req, res) => {
  const auth = requireAuthenticatedUser(req, res);
  if (!auth) return;

  try {
    const targetUsername = req.params.username;
    const requester = auth.user;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const passwordCandidate = typeof body.newPassword === 'string' ? body.newPassword : '';
    const normalizedPassword = passwordCandidate.trim();
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';

    if (!normalizedPassword) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال كلمة المرور الجديدة' });
    }

    if (normalizedPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `كلمة المرور يجب أن تحتوي على ${MIN_PASSWORD_LENGTH} رموز على الأقل`
      });
    }

    const store = loadUsers();
    const targetUser = store.users.find((user) => user.username === targetUsername);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'الفرد غير موجود' });
    }

    const requesterIsAdmin = isAdminRole(requester);
    const isSelfChange = requester && requester.username === targetUsername;

    if (!requesterIsAdmin) {
      if (!isSelfChange) {
        return res.status(403).json({ success: false, message: 'لا تملك الصلاحيات لتغيير كلمة المرور لهذا الحساب' });
      }
      if (!currentPassword || targetUser.passwordHash !== hashPassword(currentPassword)) {
        return res.status(400).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة' });
      }
    } else if (isSelfChange && currentPassword) {
      if (targetUser.passwordHash !== hashPassword(currentPassword)) {
        return res.status(400).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة' });
      }
    }

    targetUser.passwordHash = hashPassword(normalizedPassword);
    targetUser.passwordChangedAt = new Date().toISOString();
    saveUsers(store);
    logActivityEvent({
      user: requester,
      token: auth.token,
      source: 'server',
      eventType: 'user:password',
      message: requester.username === targetUsername
        ? 'تم تغيير كلمة المرور'
        : `تم تغيير كلمة مرور ${targetUser.displayName || targetUser.username}`,
      context: {
        programKey: requesterIsAdmin ? 'settings' : 'profile',
        path: req.originalUrl,
        pageName: requesterIsAdmin ? 'الإعدادات' : 'الملف الشخصي'
      },
      details: {
        targetUsername: targetUser.username
      }
    });

    const payload = { success: true, message: 'تم تحديث كلمة المرور بنجاح' };
    if (isSelfChange) {
      payload.user = sanitizeUser(targetUser);
    }

    return res.json(payload);
  } catch (error) {
    console.error('update password error:', error);
    return res.status(500).json({ success: false, message: 'تعذر تحديث كلمة المرور' });
  }
});

app.delete('/api/users/:username', (req, res) => {
  const auth = requireAdminUser(req, res);
  if (!auth) return;

  try {
    const targetUsername = req.params.username;
    const store = loadUsers();
    const idx = store.users.findIndex((u) => u.username === targetUsername);
    if (idx === -1) {
  return res.status(404).json({ success: false, message: 'الفرد غير موجود' });
    }

    const targetUser = store.users[idx];
    if (isProtectedAdminEdit({ actor: auth.user, target: targetUser })) {
      return res.status(403).json({ success: false, message: 'لا يمكن لمدير حذف حساب مدير آخر' });
    }

    const isTargetAdmin = isAdminRole(targetUser);
    if (isTargetAdmin) {
      const adminCount = store.users.filter((u) => isAdminRole(u)).length;
      if (adminCount <= 1) {
        return res.status(400).json({ success: false, message: 'لا يمكن حذف آخر مدير للنظام' });
      }
    }

    if (auth.user && auth.user.username === targetUsername) {
      return res.status(400).json({ success: false, message: 'لا يمكن حذف حسابك الحالي أثناء تسجيل الدخول' });
    }

    const [removedUser] = store.users.splice(idx, 1);
    const revokedApps = getRevokedAllowedApps(removedUser, null);
    saveUsers(store);
    broadcastAccessRevoked(removedUser.username, revokedApps);
    logActivityEvent({
      user: auth.user,
      token: auth.token,
      source: 'server',
      eventType: 'user:delete',
      message: `تم حذف ${removedUser.displayName || removedUser.username}`,
      context: { programKey: 'settings', path: req.originalUrl, pageName: 'الإعدادات' },
      details: {
        targetUsername: removedUser.username,
        targetRole: normalizeRoleValue(removedUser.role)
      }
    });

    res.json({ success: true, user: sanitizeUser(removedUser) });
  } catch (error) {
    console.error('delete user error:', error);
  res.status(500).json({ success: false, message: 'تعذر حذف الفرد' });
  }
});

// Graceful shutdown endpoint
app.post('/api/shutdown', (req, res) => {
  const auth = authenticateRequest(req);
  if (auth) {
    logActivityEvent({
      user: auth.user,
      token: auth.token,
      source: 'server',
      eventType: 'system:shutdown',
      message: 'تم طلب إيقاف الخادم',
      context: { programKey: 'dashboard', path: req.originalUrl, pageName: 'اللوحة الرئيسية' }
    });
  }
  try {
    res.json({ success: true });
  } catch (_) {}
  // Delay a tick to allow response to flush
  setTimeout(() => {
    try {
      console.log('🔻 Received shutdown request. Stopping server...');
      process.exit(0);
    } catch (e) {
      process.exit(0);
    }
  }, 100);
});

// ========== PROGRAM API ROUTES ==========
// App APIs are loaded on first request so one program's data/dependencies do not slow the dashboard or other apps.
app.use('/api/weapons', requireAppAccessMiddleware('weapons'), createLazyRouter(
  path.join(__dirname, '..', '..', 'Weapons', 'backend', 'api-routes.js'),
  {
    successMessage: '✅ Weapons API routes loaded at /api/weapons',
    failureMessage: '⚠️  Weapons API routes not found:'
  }
));

app.use('/api/report', requireAppAccessMiddleware('report'), createLazyRouter(
  path.join(__dirname, '..', '..', 'Report', 'backend', 'api-routes.js'),
  {
    createHandler: (factory) => factory(express),
    successMessage: '✅ Report API routes loaded at /api/report',
    failureMessage: '⚠️ Report API not loaded:'
  }
));

app.use('/api/request', requireAppAccessMiddleware('request'), createLazyRouter(
  path.join(__dirname, '..', '..', 'Request', 'backend', 'api-routes.js'),
  {
    successMessage: '✅ Request API routes loaded at /api/request',
    failureMessage: '⚠️  Request API routes not found:'
  }
));

app.use('/api/seized', requireAppAccessMiddleware('seized'), createLazyRouter(
  path.join(__dirname, '..', '..', 'Seized', 'Backend', 'api-routes.js'),
  {
    successMessage: '✅ Seized API routes loaded at /api/seized',
    failureMessage: '⚠️  Seized API routes not found:'
  }
));

app.use('/api/accept', requireAppAccessMiddleware('accept'), createLazyRouter(
  path.join(__dirname, '..', '..', 'Accept', 'backend', 'api-routes.js'),
  {
    successMessage: '✅ Accept API routes loaded at /api/accept',
    failureMessage: '⚠️  Accept API routes not found:'
  }
));

app.use('/api/storage', requireAppAccessMiddleware('storage'), createLazyRouter(
  path.join(__dirname, '..', '..', 'Storage', 'backend', 'api-routes.js'),
  {
    createHandler: (factory) => factory(express, { logActivityEvent }),
    successMessage: '✅ Storage API routes loaded at /api/storage',
    failureMessage: '⚠️  Storage API routes not found:'
  }
));

const renewalApi = createLazyRouter(
  path.join(__dirname, '..', '..', 'Renewal', 'backend', 'api-routes.js'),
  {
    successMessage: '✅ Renewal API routes loaded at /api/renewal and /api/renewal2',
    failureMessage: '⚠️  Renewal API routes not found:'
  }
);
app.use('/api/renewal', requireAppAccessMiddleware('renewal'), renewalApi);
app.use('/api/renewal2', requireAppAccessMiddleware('renewal'), renewalApi);

// ========== ERROR HANDLING ==========

// 404 handler
app.use((req, res) => {
  res.status(404);
  sendFrontendHtml(res, 'index.html');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ========== START SERVER ==========

function startServer() {
  const server = http.createServer(app);
  server.listen(PORT, '127.0.0.1', () => {
    console.log('Administrative Integrated System — fictional local demo');
    console.log(`Open http://127.0.0.1:${PORT}/login`);
  });
  return server;
}
if (process.env.DEMO_NO_LISTEN !== '1') startServer();

module.exports = app;
