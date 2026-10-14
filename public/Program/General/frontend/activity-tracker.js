(function () {
  'use strict';

  if (window.__activityTrackerInitialized) return;
  window.__activityTrackerInitialized = true;

  const STORAGE_KEYS = {
    token: 'general.auth.token',
    user: 'general.auth.user',
    clientId: 'general.activity.clientId',
    navigationIntent: 'general.activity.navigationIntent'
  };

  const API_ENDPOINTS = {
    heartbeat: '/api/activity/heartbeat',
    events: '/api/activity/events',
    activeUsers: '/api/activity/active-users',
    presence: '/api/activity/presence',
    draft: '/api/activity/draft',
    sync: '/api/activity/sync'
  };

  const PROGRAM_LABELS = {
    weapons: 'برنامج الرخص الملغاة',
    renewal: 'برنامج الملفات التي لم ترد',
    report: 'برنامج القرارات',
    accept: 'موافقة شؤون الضباط',
    request: 'برنامج طلبات ترخيص اول مرة',
    seized: 'برنامج الأحراز',
    storage: 'التخزين الموحد',
    company: 'إدارة شركات الحراسة',
    settings: 'الإعدادات',
    profile: 'الملف الشخصي',
    dashboard: 'اللوحة الرئيسية',
    login: 'تسجيل الدخول',
    general: 'المنصة العامة'
  };

  const HEARTBEAT_INTERVAL_MS = 30000;
  const HEARTBEAT_IDLE_TIMEOUT_MS = 60 * 1000;
  const ADMIN_PRESENCE_POLL_MS = 5000;
  const SHARED_PRESENCE_POLL_MS = 10000;
  const ROW_CONTEXT_SYNC_DELAY_MS = 180;
  const EVENT_DEBOUNCE_MS = 700;
  const DRAFT_SYNC_DEBOUNCE_MS = 350;
  const PRESENCE_DRAFT_GRACE_MS = 1800;
  const PRESENCE_SAVED_PREVIEW_HOLD_MS = 12000;
  const SYSTEM_API_PATTERNS = [
    /^\/api\/[^/]+\/tmp\/clear(?:$|[/?])/i,
    /^\/api\/[^/]+\/cleanup-tmp(?:$|[/?])/i,
    /^\/api\/[^/]+\/cleanup-temp(?:$|[/?])/i,
    /^\/api\/cleanup-tmp(?:$|[/?])/i,
    /^\/api\/cleanup-temp(?:$|[/?])/i
  ];
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
  const ACTIVITY_ROW_SELECTOR = [
    '[data-activity-row-id]',
    '.record-item',
    '.directorate-row',
    '#tbody tr',
    '#resultsBody tr',
    '#deletedRecordsBody tr',
    '#gridBody tr',
    '#usersTableBody tr',
    '#csvPreview tbody tr',
    '#previewTable tbody tr',
    '#filesTableBody tr',
    'tr[data-id]',
    'tr[data-unique-id]',
    'tr[data-license]',
    'tr[data-index]',
    'tr[data-file-id]'
  ].join(', ');
  const TRACKABLE_ROW_PROGRAM_KEYS = new Set(['weapons', 'renewal', 'report', 'accept', 'request', 'seized', 'storage', 'company']);
  const SIMPLE_ROW_ACTION_LABELS = new Set(['عرض', 'تعديل', 'حذف', 'عزل', 'فتح', 'اختيار', 'لا يلزم إجراء', '---', '—']);
  const TRACKER_BOOT_MS = Date.now();

  let lastEventSignature = '';
  let lastEventAt = 0;
  let lastHeartbeatState = 'active';
  let lastPresenceInteractionAt = TRACKER_BOOT_MS;
  let navigationIntentClearHandle = 0;
  let currentRowContext = null;
  let currentLocationContext = null;
  let currentDraftState = null;
  let currentDraftCellContext = null;
  let rowContextSyncHandle = 0;
  let adminPresencePollHandle = 0;
  let rowLockPollHandle = 0;
  let liveDraftPollHandle = 0;
  let rowLockGuardBound = false;
  let draftSyncHandle = 0;
  let lastDraftSignature = '';
  let initialPresenceSignalsLoaded = false;
  const seenPresenceSignalIds = new Set();
  const presenceDraftCache = new Map();

  function markNavigationIntent(reason) {
    try {
      if (navigationIntentClearHandle) {
        clearTimeout(navigationIntentClearHandle);
        navigationIntentClearHandle = 0;
      }
      sessionStorage.setItem(STORAGE_KEYS.navigationIntent, trimText(reason || 'navigate', 32) || 'navigate');
      navigationIntentClearHandle = window.setTimeout(() => {
        if (document.visibilityState === 'visible') {
          clearNavigationIntent();
        }
      }, 1500);
    } catch (_) {}
  }

  function getNavigationIntent() {
    try {
      return trimText(sessionStorage.getItem(STORAGE_KEYS.navigationIntent), 32);
    } catch (_) {
      return '';
    }
  }

  function clearNavigationIntent() {
    try {
      if (navigationIntentClearHandle) {
        clearTimeout(navigationIntentClearHandle);
        navigationIntentClearHandle = 0;
      }
      sessionStorage.removeItem(STORAGE_KEYS.navigationIntent);
    } catch (_) {}
  }

  function safeJsonParse(value) {
    try {
      return value ? JSON.parse(value) : null;
    } catch (_) {
      return null;
    }
  }

  function getStoredSession() {
    const token = sessionStorage.getItem(STORAGE_KEYS.token) || localStorage.getItem(STORAGE_KEYS.token);
    const rawUser = sessionStorage.getItem(STORAGE_KEYS.user) || localStorage.getItem(STORAGE_KEYS.user);
    if (!token || !rawUser) return null;
    const user = safeJsonParse(rawUser);
    if (!user || typeof user !== 'object') return null;
    return { token, user };
  }

  function getNormalizedRole(userOrRole) {
    const value = userOrRole && typeof userOrRole === 'object' ? userOrRole.role : userOrRole;
    const normalized = String(value || 'user').toLowerCase();
    if (normalized === 'admin') return 'admin';
    if (normalized === 'secretary') return 'secretary';
    return 'user';
  }

  function isAdminSession() {
    const session = getStoredSession();
    return Boolean(session && session.user && getNormalizedRole(session.user) === 'admin');
  }

  function createClientId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'client-' + Date.now() + '-' + Math.random().toString(16).slice(2, 10);
  }

  function ensureClientId() {
    let clientId = sessionStorage.getItem(STORAGE_KEYS.clientId);
    if (!clientId) {
      clientId = createClientId();
      sessionStorage.setItem(STORAGE_KEYS.clientId, clientId);
    }
    return clientId;
  }

  function trimText(value, maxLength) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    return typeof maxLength === 'number' ? normalized.slice(0, maxLength) : normalized;
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

  function inferProgram(pathname) {
    const lowered = String(pathname || '/').toLowerCase();
    if (lowered.startsWith('/weapons')) return { key: 'weapons', name: PROGRAM_LABELS.weapons };
    if (lowered.startsWith('/renewal')) return { key: 'renewal', name: PROGRAM_LABELS.renewal };
    if (lowered.startsWith('/report')) return { key: 'report', name: PROGRAM_LABELS.report };
    if (lowered.startsWith('/accept')) return { key: 'accept', name: PROGRAM_LABELS.accept };
    if (lowered.startsWith('/request')) return { key: 'request', name: PROGRAM_LABELS.request };
    if (lowered.startsWith('/seized')) return { key: 'seized', name: PROGRAM_LABELS.seized };
    if (lowered.startsWith('/storage')) return { key: 'storage', name: PROGRAM_LABELS.storage };
    if (lowered.startsWith('/company')) return { key: 'company', name: PROGRAM_LABELS.company };
    if (lowered.endsWith('/settings.html')) return { key: 'settings', name: PROGRAM_LABELS.settings };
    if (lowered.endsWith('/profile.html')) return { key: 'profile', name: PROGRAM_LABELS.profile };
    if (lowered.endsWith('/main.html') || lowered === '/dashboard') return { key: 'dashboard', name: PROGRAM_LABELS.dashboard };
    if (lowered.endsWith('/index.html') || lowered === '/' || lowered === '/login') return { key: 'login', name: PROGRAM_LABELS.login };
    return { key: 'general', name: PROGRAM_LABELS.general };
  }

  function buildContext() {
    const pathname = window.location.pathname || '/';
    const inferred = inferProgram(pathname);
    const title = trimText(document.title || '', 120);
    const bodyPage = trimText(document.body && document.body.dataset ? document.body.dataset.page : '', 80);
    const context = {
      programKey: inferred.key,
      programName: inferred.name,
      pageName: title || bodyPage || inferred.name,
      path: pathname + (window.location.search || '')
    };
    if (currentRowContext) {
      context.activeRow = currentRowContext;
    }
    const location = currentLocationContext || readCurrentHierarchyLocation();
    if (location) {
      context.location = location;
    }
    return context;
  }

  function sanitizeRowContext(rowContext) {
    if (!rowContext || typeof rowContext !== 'object') return null;
    const rowId = trimText(rowContext.rowId || rowContext.id, 160);
    const rowKey = trimText(rowContext.rowKey || rowContext.key, 40).toLowerCase();
    const rowLabel = trimText(rowContext.rowLabel || rowContext.label, 180);
    const rowType = trimText(rowContext.rowType || rowContext.type, 48).toLowerCase();
    if (!rowId && !rowLabel) return null;
    return {
      rowId,
      rowKey,
      rowLabel,
      rowType
    };
  }

  function isSameRowContext(left, right) {
    if (!left && !right) return true;
    if (!left || !right) return false;
    return left.rowId === right.rowId
      && left.rowKey === right.rowKey
      && left.rowLabel === right.rowLabel
      && left.rowType === right.rowType;
  }

  function normalizeMatchValue(value) {
    return trimText(value, 220)
      .replace(/[|•]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function getSharedReferenceApi() {
    if (window && window.AdministrativeSharedReferenceData && typeof window.AdministrativeSharedReferenceData === 'object') {
      return window.AdministrativeSharedReferenceData;
    }
    return null;
  }

  function normalizeHierarchyMatchValue(value) {
    const api = getSharedReferenceApi();
    if (api && typeof api.normalizeMatchKey === 'function') {
      return api.normalizeMatchKey(value);
    }
    return normalizeMatchValue(value);
  }

  function normalizeSectorLabel(value) {
    const raw = trimText(value, 120);
    if (!raw) return '';
    const api = getSharedReferenceApi();
    if (api && typeof api.resolveSectorLabel === 'function') {
      return trimText(api.resolveSectorLabel(raw) || raw, 120);
    }
    return raw;
  }

  function normalizeStationLabel(value, sectorValue) {
    const raw = trimText(value, 140);
    if (!raw) return '';
    const api = getSharedReferenceApi();
    if (api && typeof api.resolveStationName === 'function') {
      return trimText(api.resolveStationName(raw, sectorValue || '') || raw, 140);
    }
    return raw;
  }

  function sanitizeLocationContext(location) {
    const source = location && typeof location === 'object' ? location : {};
    const api = getSharedReferenceApi();
    let sector = normalizeSectorLabel(source.sector || source.room || source.sectorLabel || '');
    const stations = [];
    const seenStations = new Set();
    const rawStations = []
      .concat(Array.isArray(source.stations) ? source.stations : [])
      .concat([source.station || source.police || source.department || '']);

    rawStations.forEach((value) => {
      const station = normalizeStationLabel(value, sector);
      const matchKey = normalizeHierarchyMatchValue(station);
      if (!station || !matchKey || seenStations.has(matchKey)) return;
      seenStations.add(matchKey);
      stations.push(station);
    });

    if (!sector && stations.length && api && typeof api.detectSectorLabelFromStation === 'function') {
      sector = trimText(api.detectSectorLabelFromStation(stations[0]) || '', 120);
    }

    if (!sector && !stations.length) return null;
    return {
      sector,
      station: stations[0] || '',
      stations
    };
  }

  function isSameLocationContext(left, right) {
    const leftContext = sanitizeLocationContext(left);
    const rightContext = sanitizeLocationContext(right);
    if (!leftContext && !rightContext) return true;
    if (!leftContext || !rightContext) return false;
    if (normalizeHierarchyMatchValue(leftContext.sector) !== normalizeHierarchyMatchValue(rightContext.sector)) {
      return false;
    }
    const leftStations = (Array.isArray(leftContext.stations) ? leftContext.stations : [])
      .map((value) => normalizeHierarchyMatchValue(value))
      .filter(Boolean);
    const rightStations = (Array.isArray(rightContext.stations) ? rightContext.stations : [])
      .map((value) => normalizeHierarchyMatchValue(value))
      .filter(Boolean);
    if (leftStations.length !== rightStations.length) return false;
    return leftStations.every((value, index) => value === rightStations[index]);
  }

  function normalizeHeaderLabel(value) {
    return trimText(value, 180)
      .replace(/[\u2190-\u21FF\u2300-\u23FF]+/g, ' ')
      .replace(/[^\p{L}\p{N}\s._-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function extractElementText(element, maxLength) {
    if (!element) return '';
    if (typeof element === 'string') return trimText(element, maxLength);
    if (!(element instanceof Element)) return '';
    const raw = 'value' in element && typeof element.value === 'string'
      ? element.value
      : (element.innerText || element.textContent || '');
    return trimText(raw, maxLength);
  }

  function readTableCellByHeaders(row, headers) {
    if (!(row instanceof HTMLTableRowElement) || !Array.isArray(headers) || !headers.length) return '';
    const table = row.closest('table');
    const headerRow = table && table.tHead && table.tHead.rows && table.tHead.rows.length
      ? table.tHead.rows[table.tHead.rows.length - 1]
      : null;
    if (!(headerRow instanceof HTMLTableRowElement)) return '';

    const headerKeys = headers.map((value) => normalizeHeaderLabel(value)).filter(Boolean);
    if (!headerKeys.length) return '';

    const cells = Array.from(headerRow.cells || []);
    for (let index = 0; index < cells.length; index += 1) {
      const label = normalizeHeaderLabel(cells[index].textContent || '');
      if (!label || !headerKeys.includes(label)) continue;
      if (index >= row.cells.length) return '';
      return extractElementText(row.cells[index], 180);
    }
    return '';
  }

  function readRowValueBySelectors(row, selectors) {
    if (!(row instanceof Element) || !Array.isArray(selectors) || !selectors.length) return '';
    for (const selector of selectors) {
      const element = row.querySelector(selector);
      const value = extractElementText(element, 180);
      if (value) return value;
    }
    return '';
  }

  function describeLocationElement(row) {
    if (!(row instanceof Element)) return null;
    const sector = readRowValueBySelectors(row, [
      '[data-field="القطاع"]',
      '[data-field="قطاع"]',
      '[data-key="sector"]',
      '[data-key="room"]'
    ]) || readTableCellByHeaders(row, ['القطاع', 'قطاع', 'sector']);
    const station = readRowValueBySelectors(row, [
      '[data-field="القسم"]',
      '[data-field="القسم التابع"]',
      '[data-field="قسم الشرطة"]',
      '[data-key="station"]',
      '[data-key="police"]'
    ]) || readTableCellByHeaders(row, ['القسم التابع', 'القسم', 'قسم الشرطة', 'station', 'police']);
    return sanitizeLocationContext({ sector, station });
  }

  function readSelectedValue(selectEl) {
    if (!(selectEl instanceof HTMLSelectElement) || selectEl.disabled) return '';
    const selectedOption = selectEl.selectedOptions && selectEl.selectedOptions.length
      ? selectEl.selectedOptions[0]
      : selectEl.options[selectEl.selectedIndex] || null;
    if (selectedOption) {
      const optionText = extractElementText(selectedOption, 140);
      const optionValue = trimText(selectedOption.value, 140);
      return optionText || optionValue || '';
    }
    return trimText(selectEl.value, 140);
  }

  function readCurrentHierarchyLocation() {
    const activeSectorButton = document.querySelector(
      '[data-sector-stripe].is-active, [data-sector-stripe][aria-pressed="true"], button[data-sector].is-active, button[data-sector][aria-pressed="true"]'
    );
    let sector = '';
    if (activeSectorButton instanceof Element) {
      sector = trimText(activeSectorButton.getAttribute('data-sector') || activeSectorButton.textContent, 120);
    }
    if (!sector) {
      const sectorSelect = document.querySelector('select#filterSector, select#sectorSelect, select[name*="sector" i], select[id*="sector" i]');
      sector = readSelectedValue(sectorSelect);
    }

    let stations = Array.from(document.querySelectorAll(
      '#stationButtonsContainer .station-btn.is-selected, .station-btn.is-selected, button[data-station].is-active, button[data-station][aria-pressed="true"]'
    )).map((element) => (
      trimText(
        element.getAttribute('data-station')
        || element.getAttribute('data-value')
        || element.textContent,
        140
      )
    )).filter(Boolean);

    if (!stations.length) {
      const stationSelect = document.querySelector('select#filterStation, select[name*="station" i], select[id*="station" i]');
      const selectedStation = readSelectedValue(stationSelect);
      if (selectedStation) stations = [selectedStation];
    }

    if (!stations.length) {
      stations = Array.from(document.querySelectorAll(
        '#stationDropdownList input[type="checkbox"]:checked, .dropdown-list input[type="checkbox"]:checked, [data-station-checkbox]:checked'
      )).map((input) => trimText(input.value || input.getAttribute('data-value') || '', 140)).filter(Boolean);
    }

    return sanitizeLocationContext({ sector, stations });
  }

  function shouldTrackRowContext() {
    const context = inferProgram(window.location.pathname || '/');
    return TRACKABLE_ROW_PROGRAM_KEYS.has(context.key) && !!document.querySelector(ACTIVITY_ROW_SELECTOR);
  }

  function findActivityRowElement(target) {
    if (!(target instanceof Element)) return null;
    const row = target.closest(ACTIVITY_ROW_SELECTOR);
    return row instanceof Element ? row : null;
  }

  function getRowIdentifier(row) {
    const candidates = [
      { key: 'activity', value: row.getAttribute('data-activity-row-id') },
      { key: 'uniqueId', value: row.getAttribute('data-unique-id') },
      { key: 'id', value: row.getAttribute('data-id') },
      { key: 'license', value: row.getAttribute('data-license') },
      { key: 'fileId', value: row.getAttribute('data-file-id') },
      { key: 'row', value: row.getAttribute('data-row') },
      { key: 'origIdx', value: row.querySelector('[data-orig-idx]') ? row.querySelector('[data-orig-idx]').getAttribute('data-orig-idx') : '' },
      { key: 'fileId', value: row.querySelector('[data-file-id]') ? row.querySelector('[data-file-id]').getAttribute('data-file-id') : '' },
      { key: 'value', value: row.querySelector('input.row-select[value], input.row-checkbox[value]') ? row.querySelector('input.row-select[value], input.row-checkbox[value]').value : '' },
      { key: 'index', value: row.getAttribute('data-index') }
    ];
    for (const candidate of candidates) {
      const rowId = trimText(candidate && candidate.value, 160);
      if (rowId) {
        return { rowKey: candidate.key, rowId };
      }
    }
    return { rowKey: '', rowId: '' };
  }

  function extractRowLabel(row) {
    const preferredCandidates = [
      row.getAttribute('data-activity-row-label'),
      row.getAttribute('data-name'),
      row.querySelector('.record-name') ? row.querySelector('.record-name').textContent : '',
      row.querySelector('.file-name strong') ? row.querySelector('.file-name strong').textContent : '',
      row.querySelector('[data-field="الاسم"]') ? row.querySelector('[data-field="الاسم"]').textContent : '',
      row.querySelector('[data-key="name"]') ? row.querySelector('[data-key="name"]').textContent : '',
      row.querySelector('.file-path') ? row.querySelector('.file-path').textContent : ''
    ];
    for (const candidate of preferredCandidates) {
      const normalized = trimText(candidate, 140);
      if (normalized && !SIMPLE_ROW_ACTION_LABELS.has(normalized)) {
        return normalized;
      }
    }

    const parts = [];
    const childElements = row instanceof HTMLTableRowElement
      ? Array.from(row.cells)
      : Array.from(row.children);
    for (const child of childElements) {
      if (!(child instanceof Element)) continue;
      if (parts.length >= 3) break;
      const text = trimText(child.textContent, 80);
      if (!text || SIMPLE_ROW_ACTION_LABELS.has(text) || text === '—') continue;
      if (!/[A-Za-z\u0600-\u06FF]/.test(text) && parts.length === 0) continue;
      parts.push(text);
    }
    return trimText(parts.join(' • '), 180);
  }

  function describeRowElement(row) {
    if (!(row instanceof Element)) return null;
    const identifier = getRowIdentifier(row);
    const rowLabel = extractRowLabel(row);
    const rowType = trimText(row.getAttribute('data-activity-row-type'), 48) || (row.classList.contains('record-item')
      ? 'record-item'
      : row.classList.contains('directorate-row')
        ? 'directorate-row'
        : String(row.tagName || 'row').toLowerCase());
    return sanitizeRowContext({
      rowKey: identifier.rowKey,
      rowId: identifier.rowId,
      rowLabel,
      rowType
    });
  }

  function scheduleRowContextSync(delay) {
    if (rowContextSyncHandle) {
      clearTimeout(rowContextSyncHandle);
      rowContextSyncHandle = 0;
    }
    rowContextSyncHandle = window.setTimeout(() => {
      rowContextSyncHandle = 0;
      void sendHeartbeat('active');
    }, Math.max(Number(delay) || 0, 0));
  }

  function updateCurrentRowContext(nextContext, delay) {
    const safeContext = sanitizeRowContext(nextContext);
    if (isSameRowContext(currentRowContext, safeContext)) return;
    currentRowContext = safeContext;
    scheduleRowContextSync(delay);
  }

  function updateCurrentLocationContext(nextContext, delay) {
    const safeContext = sanitizeLocationContext(nextContext);
    if (isSameLocationContext(currentLocationContext, safeContext)) return;
    currentLocationContext = safeContext;
    scheduleRowContextSync(delay);
  }

  function sanitizeDraftValue(value, maxLength) {
    const normalized = String(value ?? '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!normalized) return '';
    return typeof maxLength === 'number' ? normalized.slice(0, maxLength) : normalized;
  }

  function sanitizeCellContext(cellContext) {
    if (!cellContext || typeof cellContext !== 'object') return null;
    const field = trimText(cellContext.field, 120);
    const key = trimText(cellContext.key, 64).toLowerCase();
    const header = trimText(cellContext.header, 160);
    const csvIndex = Number.parseInt(cellContext.csvIndex, 10);
    const cellIndex = Number.parseInt(cellContext.cellIndex, 10);
    const normalized = {};
    if (field) normalized.field = field;
    if (key) normalized.key = key;
    if (header) normalized.header = header;
    if (Number.isInteger(csvIndex) && csvIndex >= 0) normalized.csvIndex = csvIndex;
    if (Number.isInteger(cellIndex) && cellIndex >= 0) normalized.cellIndex = cellIndex;
    return Object.keys(normalized).length ? normalized : null;
  }

  function isSameCellContext(left, right) {
    const leftContext = sanitizeCellContext(left);
    const rightContext = sanitizeCellContext(right);
    if (!leftContext && !rightContext) return true;
    if (!leftContext || !rightContext) return false;
    return leftContext.field === rightContext.field
      && leftContext.key === rightContext.key
      && leftContext.header === rightContext.header
      && leftContext.csvIndex === rightContext.csvIndex
      && leftContext.cellIndex === rightContext.cellIndex;
  }

  function setCurrentDraftCellContext(nextContext) {
    const safeContext = sanitizeCellContext(nextContext);
    if (isSameCellContext(currentDraftCellContext, safeContext)) return;
    currentDraftCellContext = safeContext;
  }

  function readColumnHeaderLabel(cell) {
    const tableCell = cell instanceof HTMLTableCellElement
      ? cell
      : (cell instanceof Element ? cell.closest('td, th') : null);
    if (!(tableCell instanceof HTMLTableCellElement)) return '';
    const table = tableCell.closest('table');
    if (!(table instanceof HTMLTableElement)) return '';
    const headerRow = table.tHead && table.tHead.rows && table.tHead.rows.length
      ? table.tHead.rows[table.tHead.rows.length - 1]
      : null;
    if (!(headerRow instanceof HTMLTableRowElement)) return '';
    const headerCell = headerRow.cells[tableCell.cellIndex] || null;
    return trimText(headerCell ? headerCell.textContent : '', 160);
  }

  function resolveEditableCellHost(target) {
    if (!(target instanceof Element)) return null;
    const directCell = target.closest('td, th');
    if (directCell instanceof Element) return directCell;
    const carrier = target.closest('[data-field], [data-key], [data-csv-index], .editable-cell');
    return carrier instanceof Element ? carrier : null;
  }

  function describeCellElement(target) {
    if (!(target instanceof Element)) return null;
    const row = findActivityRowElement(target);
    const host = resolveEditableCellHost(target);
    if (!host || (row && !row.contains(host))) return null;
    const fieldSource = target.closest('[data-field]');
    const keySource = target.closest('[data-key]');
    const csvSource = target.closest('[data-csv-index]');
    return sanitizeCellContext({
      field: row && fieldSource && row.contains(fieldSource) ? fieldSource.getAttribute('data-field') : host.getAttribute('data-field'),
      key: row && keySource && row.contains(keySource) ? keySource.getAttribute('data-key') : host.getAttribute('data-key'),
      header: readColumnHeaderLabel(host),
      csvIndex: row && csvSource && row.contains(csvSource) ? csvSource.getAttribute('data-csv-index') : host.getAttribute('data-csv-index'),
      cellIndex: host instanceof HTMLTableCellElement ? host.cellIndex : -1
    });
  }

  function readLiveDraftValue(target) {
    if (target instanceof HTMLSelectElement) {
      const selectedOption = target.selectedOptions && target.selectedOptions.length
        ? target.selectedOptions[0]
        : target.options[target.selectedIndex] || null;
      return sanitizeDraftValue(
        selectedOption ? (selectedOption.textContent || selectedOption.value || '') : (target.value || ''),
        2400
      );
    }
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return sanitizeDraftValue(target.value || '', 2400);
    }
    const host = resolveEditableCellHost(target);
    const source = target instanceof HTMLElement && target.isContentEditable ? target : host;
    if (!(source instanceof Element)) return '';
    const raw = typeof source.innerText === 'string' ? source.innerText : source.textContent;
    return sanitizeDraftValue(raw || '', 2400);
  }

  function isDraftEditableTarget(target) {
    if (!(target instanceof Element)) return false;
    if (target instanceof HTMLInputElement) {
      const type = trimText(target.type, 32).toLowerCase();
      return type !== 'checkbox'
        && type !== 'radio'
        && type !== 'submit'
        && type !== 'button'
        && type !== 'file'
        && type !== 'reset';
    }
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
      return true;
    }
    if (target instanceof HTMLElement && target.isContentEditable) {
      return true;
    }
    const host = resolveEditableCellHost(target);
    return Boolean(
      host instanceof HTMLElement
      && (host.isContentEditable || host.matches('.editable-cell, .dropdown-cell, [data-field], [data-key], [data-csv-index]'))
    );
  }

  function buildDraftState(target) {
    if (!(target instanceof Element)) return null;
    if (!isDraftEditableTarget(target)) return null;
    const row = findActivityRowElement(target);
    if (!row) {
      const isSupportedExternalEditor = target instanceof HTMLSelectElement
        && (target.classList.contains('cell-dropdown') || target.hasAttribute('data-activity-draft-editor'));
      if (!isSupportedExternalEditor) {
        return null;
      }
    }
    const rowContext = row ? describeRowElement(row) : currentRowContext;
    const cell = row ? describeCellElement(target) : currentDraftCellContext;
    if (!rowContext || !cell) return null;
    return {
      rowContext,
      location: row ? describeLocationElement(row) : currentLocationContext,
      cell,
      value: readLiveDraftValue(target)
    };
  }

  function buildDraftSignature(draftState) {
    if (!draftState || !draftState.rowContext || !draftState.cell) return '';
    return JSON.stringify({
      rowKey: draftState.rowContext.rowKey || '',
      rowId: draftState.rowContext.rowId || '',
      rowLabel: draftState.rowContext.rowLabel || '',
      rowType: draftState.rowContext.rowType || '',
      field: draftState.cell.field || '',
      key: draftState.cell.key || '',
      header: draftState.cell.header || '',
      csvIndex: Number.isInteger(draftState.cell.csvIndex) ? draftState.cell.csvIndex : -1,
      cellIndex: Number.isInteger(draftState.cell.cellIndex) ? draftState.cell.cellIndex : -1,
      value: draftState.value || ''
    });
  }

  function isInteractiveTarget(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('button, a, input, textarea, select, [role="button"], [contenteditable="true"], [contenteditable=""]'));
  }

  function handleRowInteraction(target, delay) {
    if (!shouldTrackRowContext()) return;
    const row = findActivityRowElement(target);
    if (row) {
      updateCurrentRowContext(describeRowElement(row), delay);
      updateCurrentLocationContext(describeLocationElement(row), delay);
      return;
    }
    if (isInteractiveTarget(target)) {
      updateCurrentRowContext(null, delay);
      updateCurrentLocationContext(null, delay);
    }
  }

  function bindRowTracking() {
    document.addEventListener('pointerdown', (event) => {
      handleRowInteraction(event.target, ROW_CONTEXT_SYNC_DELAY_MS);
      const draftState = buildDraftState(event.target);
      if (draftState && draftState.cell) {
        setCurrentDraftCellContext(draftState.cell);
      }
    }, true);

    document.addEventListener('focusin', (event) => {
      handleRowInteraction(event.target, 0);
      const draftState = buildDraftState(event.target);
      if (draftState && draftState.cell) {
        setCurrentDraftCellContext(draftState.cell);
      }
    }, true);
  }

  function bindDraftTracking() {
    if (!shouldTrackRowContext()) return;

    const publishDraftFromEvent = (event, options) => {
      const target = event && event.target instanceof Element ? event.target : null;
      if (!target) return;
      const draftState = buildDraftState(target);
      if (!draftState) return;
      currentRowContext = draftState.rowContext;
      currentLocationContext = sanitizeLocationContext(draftState.location);
      setCurrentDraftCellContext(draftState.cell);
      void setCurrentDraftState(draftState, options || {});
    };

    document.addEventListener('input', (event) => {
      publishDraftFromEvent(event, { delay: DRAFT_SYNC_DEBOUNCE_MS });
    }, true);

    document.addEventListener('change', (event) => {
      publishDraftFromEvent(event, { delay: 0, force: true });
    }, true);
  }

  function mergeHeaders(sourceA, sourceB) {
    const headers = new Headers(sourceA || undefined);
    new Headers(sourceB || undefined).forEach((value, key) => {
      headers.set(key, value);
    });
    return headers;
  }

  function sanitizeDetails(details) {
    if (!details || typeof details !== 'object') return undefined;
    const next = {};
    Object.keys(details).forEach((key) => {
      const value = details[key];
      if (value === undefined || value === null) return;
      if (typeof value === 'string') {
        next[key] = trimText(value, 240);
        return;
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        next[key] = value;
      }
    });
    return Object.keys(next).length ? next : undefined;
  }

  function shouldSuppressEvent(signature) {
    const now = Date.now();
    if (signature && signature === lastEventSignature && (now - lastEventAt) < EVENT_DEBOUNCE_MS) {
      return true;
    }
    lastEventSignature = signature;
    lastEventAt = now;
    return false;
  }

  function postJson(url, payload, options) {
    const session = getStoredSession();
    if (!session || !session.token || typeof window.fetch !== 'function') {
      return Promise.resolve(false);
    }

    const headers = mergeHeaders({ 'Content-Type': 'application/json' }, { Authorization: 'Bearer ' + session.token });
    return window.fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      keepalive: Boolean(options && options.keepalive)
    }).then(() => true).catch(() => false);
  }

  function normalizeHeartbeatState(value) {
    const normalized = trimText(value, 16).toLowerCase();
    if (normalized === 'inactive') return 'inactive';
    if (normalized === 'closing' || normalized === 'closed' || normalized === 'offline') return normalized;
    return 'active';
  }

  function getCurrentPresenceState() {
    if (document.visibilityState && document.visibilityState !== 'visible') {
      return 'inactive';
    }
    return (Date.now() - lastPresenceInteractionAt) >= HEARTBEAT_IDLE_TIMEOUT_MS
      ? 'inactive'
      : 'active';
  }

  function rememberPresenceInteraction(options) {
    const now = Date.now();
    if (!options?.forceHeartbeat && lastHeartbeatState === 'active' && (now - lastPresenceInteractionAt) < 1500) {
      return;
    }
    lastPresenceInteractionAt = now;
    if (options && options.forceHeartbeat) {
      void sendHeartbeat('active');
      return;
    }
    if (lastHeartbeatState === 'inactive') {
      void sendHeartbeat('active');
    }
  }

  function sendHeartbeat(state, options) {
    const normalizedState = normalizeHeartbeatState(state || getCurrentPresenceState());
    lastHeartbeatState = normalizedState === 'closed' ? 'offline' : normalizedState;
    return postJson(API_ENDPOINTS.heartbeat, {
      state: normalizedState,
      clientId: ensureClientId(),
      context: buildContext()
    }, options || {});
  }

  function sendEvent(eventType, message, details, options) {
    const payload = {
      clientId: ensureClientId(),
      eventType: trimText(eventType, 48) || 'event',
      message: trimText(message, 220) || 'نشاط جديد',
      context: buildContext()
    };
    const safeDetails = sanitizeDetails(details);
    if (safeDetails) {
      payload.details = safeDetails;
    }
    return postJson(API_ENDPOINTS.events, payload, options || {});
  }

  function flushDraftSync(options) {
    if (draftSyncHandle) {
      clearTimeout(draftSyncHandle);
      draftSyncHandle = 0;
    }
    const draftState = currentDraftState;
    const signature = buildDraftSignature(draftState);
    if (!options || !options.force) {
      if (signature === lastDraftSignature) {
        return Promise.resolve(true);
      }
    }
    lastDraftSignature = signature;

    const context = buildContext();
    if (draftState && draftState.rowContext) {
      context.activeRow = draftState.rowContext;
    }
    if (draftState && draftState.location) {
      context.location = draftState.location;
    }

    return postJson(API_ENDPOINTS.draft, {
      clientId: ensureClientId(),
      context,
      draft: draftState ? {
        cell: draftState.cell,
        value: draftState.value || ''
      } : null,
      clear: !draftState
    }, options || {});
  }

  function scheduleDraftSync(delay, options) {
    if (draftSyncHandle) {
      clearTimeout(draftSyncHandle);
      draftSyncHandle = 0;
    }
    if (!delay) {
      return flushDraftSync(options);
    }
    draftSyncHandle = window.setTimeout(() => {
      draftSyncHandle = 0;
      void flushDraftSync(options);
    }, Math.max(Number(delay) || 0, 0));
    return Promise.resolve(true);
  }

  function setCurrentDraftState(nextState, options) {
    const safeState = nextState && nextState.rowContext && nextState.cell
      ? {
          rowContext: sanitizeRowContext(nextState.rowContext),
          location: sanitizeLocationContext(nextState.location),
          cell: sanitizeCellContext(nextState.cell),
          value: sanitizeDraftValue(nextState.value || '', 2400)
        }
      : null;
    const signature = buildDraftSignature(safeState);
    if ((!options || !options.force) && signature === buildDraftSignature(currentDraftState)) {
      return Promise.resolve(true);
    }
    currentDraftState = safeState;
    if (safeState && safeState.cell) {
      setCurrentDraftCellContext(safeState.cell);
    }
    return scheduleDraftSync(
      options && Object.prototype.hasOwnProperty.call(options, 'delay')
        ? options.delay
        : DRAFT_SYNC_DEBOUNCE_MS,
      options || {}
    );
  }

  function clearCurrentDraftState(options) {
    return setCurrentDraftState(null, Object.assign({ delay: 0 }, options || {}));
  }

  function createActivitySignalId() {
    return 'signal-' + Date.now() + '-' + Math.random().toString(16).slice(2, 10);
  }

  function rememberPresenceSignalId(signalId) {
    const normalized = trimText(signalId, 160);
    if (!normalized) return;
    if (seenPresenceSignalIds.size >= 240) {
      const first = seenPresenceSignalIds.values().next();
      if (!first.done) {
        seenPresenceSignalIds.delete(first.value);
      }
    }
    seenPresenceSignalIds.add(normalized);
  }

  function hasSeenPresenceSignal(signalId) {
    return seenPresenceSignalIds.has(trimText(signalId, 160));
  }

  function extractDatasetFromPath(pathValue) {
    const path = trimText(pathValue, 260);
    if (!path) return '';
    try {
      const url = new URL(path, window.location.origin);
      return trimText(url.searchParams.get('dataset'), 64);
    } catch (_) {
      return '';
    }
  }

  function getCurrentProgramDataset() {
    return extractDatasetFromPath((window.location.pathname || '/') + (window.location.search || ''));
  }

  function getPresenceEntryDataset(entry) {
    if (!entry || typeof entry !== 'object') return '';
    return trimText(entry.dataset, 64) || extractDatasetFromPath(entry.path);
  }

  function buildPresenceDraftCacheKey(entry) {
    const rowContext = sanitizeRowContext(entry && entry.activeRow);
    const cell = sanitizeCellContext(entry && entry.draft ? entry.draft.cell : null);
    const clientId = trimText(entry && entry.clientId, 128);
    const programKey = trimText(entry && entry.programKey, 64).toLowerCase();
    if (!rowContext || !cell || !clientId || !programKey) return '';
    return JSON.stringify({
      clientId,
      programKey,
      dataset: getPresenceEntryDataset(entry),
      rowContext,
      cell
    });
  }

  function cachePresenceDraftEntry(entry) {
    const key = buildPresenceDraftCacheKey(entry);
    if (!key) return null;
    const now = Date.now();
    const cached = presenceDraftCache.get(key);
    const next = {
      key,
      clientId: trimText(entry.clientId, 128),
      username: trimText(entry.username, 64),
      displayName: trimText(entry.displayName || '', 80),
      programKey: trimText(entry.programKey, 64).toLowerCase(),
      dataset: getPresenceEntryDataset(entry),
      activeRow: sanitizeRowContext(entry.activeRow),
      draft: {
        cell: sanitizeCellContext(entry.draft ? entry.draft.cell : null),
        value: sanitizeDraftValue(entry && entry.draft ? entry.draft.value || '' : '', 2400)
      },
      lastSeenAtMs: now,
      holdUntilAtMs: now + PRESENCE_DRAFT_GRACE_MS,
      savedUntilAtMs: cached && Number.isFinite(cached.savedUntilAtMs) ? cached.savedUntilAtMs : 0
    };
    presenceDraftCache.set(key, next);
    return next;
  }

  function purgePresenceDraftCache(now) {
    const currentTime = Number.isFinite(now) ? now : Date.now();
    presenceDraftCache.forEach((entry, key) => {
      if (
        !entry
        || !sanitizeRowContext(entry.activeRow)
        || !entry.draft
        || !sanitizeCellContext(entry.draft.cell)
      ) {
        presenceDraftCache.delete(key);
        return;
      }
      const holdUntilAtMs = Number(entry.holdUntilAtMs) || 0;
      const savedUntilAtMs = Number(entry.savedUntilAtMs) || 0;
      if (holdUntilAtMs >= currentTime || savedUntilAtMs >= currentTime) return;
      presenceDraftCache.delete(key);
    });
  }

  function holdSavedPresenceDraftPreviews(signal) {
    const clientId = trimText(signal && signal.clientId, 128);
    const programKey = trimText(signal && signal.programKey, 64).toLowerCase();
    const dataset = trimText(signal && signal.dataset, 64);
    if (!clientId || !programKey) return;
    const now = Date.now();
    presenceDraftCache.forEach((entry, key) => {
      if (!entry || entry.clientId !== clientId || entry.programKey !== programKey) return;
      if (dataset && entry.dataset && entry.dataset !== dataset) return;
      presenceDraftCache.set(key, Object.assign({}, entry, {
        holdUntilAtMs: Math.max(Number(entry.holdUntilAtMs) || 0, now + PRESENCE_DRAFT_GRACE_MS),
        savedUntilAtMs: Math.max(Number(entry.savedUntilAtMs) || 0, now + PRESENCE_SAVED_PREVIEW_HOLD_MS)
      }));
    });
  }

  function clearSavedPresenceDraftPreviews(context) {
    const programKey = trimText(context && context.programKey, 64).toLowerCase();
    const dataset = trimText(context && context.dataset, 64);
    const now = Date.now();
    if (!programKey) return;
    presenceDraftCache.forEach((entry, key) => {
      if (!entry || entry.programKey !== programKey) return;
      if (dataset && entry.dataset && entry.dataset !== dataset) return;
      const next = Object.assign({}, entry, { savedUntilAtMs: 0 });
      if ((Number(next.holdUntilAtMs) || 0) < now) {
        presenceDraftCache.delete(key);
        return;
      }
      presenceDraftCache.set(key, next);
    });
  }

  function getCachedPresenceDraftEntries(users) {
    const currentProgramKey = buildContext().programKey;
    const currentClientId = ensureClientId();
    const currentDataset = getCurrentProgramDataset();
    const now = Date.now();

    (Array.isArray(users) ? users : []).forEach((entry) => {
      if (!entry || entry.clientId === currentClientId) return;
      if (trimText(entry.programKey, 64).toLowerCase() !== currentProgramKey) return;
      if (!entry.activeRow || !entry.draft || !sanitizeCellContext(entry.draft.cell)) return;
      const entryDataset = getPresenceEntryDataset(entry);
      if (currentDataset && entryDataset && entryDataset !== currentDataset) return;
      cachePresenceDraftEntry(entry);
    });

    purgePresenceDraftCache(now);

    return Array.from(presenceDraftCache.values())
      .filter((entry) => {
        if (!entry || entry.clientId === currentClientId) return false;
        if (entry.programKey !== currentProgramKey) return false;
        if (currentDataset && entry.dataset && entry.dataset !== currentDataset) return false;
        return (Number(entry.holdUntilAtMs) || 0) >= now || (Number(entry.savedUntilAtMs) || 0) >= now;
      })
      .sort((left, right) => (
        Math.max(Number(right.savedUntilAtMs) || 0, Number(right.lastSeenAtMs) || 0)
        - Math.max(Number(left.savedUntilAtMs) || 0, Number(left.lastSeenAtMs) || 0)
      ));
  }

  function buildTrackedSaveSignal(requestUrl, method) {
    if (!(requestUrl instanceof URL)) return null;
    const methodValue = trimText(method, 16).toUpperCase();
    if (methodValue !== 'POST') return null;
    const pathname = requestUrl.pathname.toLowerCase();
    if (pathname === '/api/weapons/save-csv') {
      return {
        kind: 'save',
        scope: 'program',
        programKey: 'weapons',
        programName: PROGRAM_LABELS.weapons
      };
    }
    if (pathname === '/api/renewal/save-csv' || pathname === '/api/renewal2/save-csv') {
      return {
        kind: 'save',
        scope: 'program',
        programKey: 'renewal',
        programName: PROGRAM_LABELS.renewal
      };
    }
    if (pathname === '/api/report/data') {
      return {
        kind: 'save',
        scope: 'program',
        programKey: 'report',
        programName: PROGRAM_LABELS.report,
        dataset: trimText(requestUrl.searchParams.get('dataset'), 64)
      };
    }
    if (pathname === '/api/seized/records') {
      return {
        kind: 'save',
        scope: 'program',
        programKey: 'seized',
        programName: PROGRAM_LABELS.seized
      };
    }
    return null;
  }

  function buildTrackedDataLoadContext(requestUrl, method) {
    if (!(requestUrl instanceof URL)) return null;
    const methodValue = trimText(method, 16).toUpperCase();
    if (methodValue !== 'GET') return null;
    const pathname = requestUrl.pathname.toLowerCase();
    if (pathname === '/api/renewal/csv-data') {
      return { programKey: 'renewal' };
    }
    if (pathname === '/api/data') {
      if (trimText(requestUrl.searchParams.get('probe'), 8) === '1') return null;
      return {
        programKey: 'report',
        dataset: trimText(requestUrl.searchParams.get('dataset'), 64) || getCurrentProgramDataset()
      };
    }
    if (pathname.endsWith('/slah.csv') || pathname.includes('/data/slah.csv')) {
      return { programKey: 'weapons' };
    }
    if (pathname === '/api/seized/records') {
      return { programKey: 'seized' };
    }
    return null;
  }

  function responseHasJsonContent(response) {
    if (!(response instanceof Response)) return false;
    const contentType = trimText(response.headers.get('content-type'), 120).toLowerCase();
    return contentType.includes('application/json');
  }

  async function responseHasSuccessfulSaveState(response) {
    if (!(response instanceof Response) || !response.ok) return false;
    if (!responseHasJsonContent(response)) return true;
    try {
      const payload = await response.clone().json();
      if (payload && typeof payload === 'object') {
        if (payload.ok === false || payload.success === false) return false;
        if (Object.prototype.hasOwnProperty.call(payload, 'ok')) return Boolean(payload.ok);
        if (Object.prototype.hasOwnProperty.call(payload, 'success')) return Boolean(payload.success);
      }
    } catch (_) {}
    return true;
  }

  function sendActivitySignal(kind, details, options) {
    const extra = details && typeof details === 'object' ? details : {};
    const context = buildContext();
    if (extra.programKey) {
      context.programKey = trimText(extra.programKey, 64).toLowerCase() || context.programKey;
      context.programName = trimText(extra.programName, 120) || PROGRAM_LABELS[context.programKey] || context.programName;
    }
    const signal = {
      signalId: trimText(extra.signalId, 160) || createActivitySignalId(),
      kind: trimText(kind || extra.kind || 'save', 32).toLowerCase() || 'save',
      scope: trimText(extra.scope || 'program', 48).toLowerCase() || 'program',
      dataset: trimText(extra.dataset, 64),
      requestPath: trimText(extra.requestPath || extra.url, 260),
      message: trimText(extra.message, 220)
    };
    return postJson(API_ENDPOINTS.sync, {
      clientId: ensureClientId(),
      context,
      signal
    }, options || {});
  }

  function normalizePresenceSignal(signal) {
    const source = signal && typeof signal === 'object' ? signal : {};
    const id = trimText(source.id || source.signalId, 160);
    const kind = trimText(source.kind || source.type || '', 32).toLowerCase();
    const programKey = trimText(source.programKey, 64).toLowerCase();
    const dataset = trimText(source.dataset, 64);
    const createdAt = trimText(source.createdAt, 48);
    if (!id || !kind || !programKey || !createdAt) return null;
    return {
      id,
      clientId: trimText(source.clientId, 128),
      username: trimText(source.username, 64),
      displayName: trimText(source.displayName, 80),
      programKey,
      dataset,
      kind,
      scope: trimText(source.scope, 48).toLowerCase(),
      path: trimText(source.path, 260),
      requestPath: trimText(source.requestPath || source.url, 260),
      message: trimText(source.message, 220),
      createdAt
    };
  }

  function dispatchPresenceSignal(signal) {
    try {
      window.dispatchEvent(new CustomEvent('activity:external-save', {
        detail: signal
      }));
    } catch (_) {}
  }

  function processPresenceSignals(signals) {
    const normalizedSignals = (Array.isArray(signals) ? signals : [])
      .map((entry) => normalizePresenceSignal(entry))
      .filter(Boolean)
      .sort((left, right) => new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime());

    if (!initialPresenceSignalsLoaded) {
      normalizedSignals.forEach((entry) => {
        const createdAtMs = new Date(entry.createdAt || 0).getTime();
        rememberPresenceSignalId(entry.id);
        if (
          entry.kind === 'save'
          && entry.programKey === buildContext().programKey
          && entry.clientId !== ensureClientId()
          && Number.isFinite(createdAtMs)
          && createdAtMs >= TRACKER_BOOT_MS
        ) {
          holdSavedPresenceDraftPreviews(entry);
          dispatchPresenceSignal(entry);
        }
      });
      initialPresenceSignalsLoaded = true;
      return;
    }

    const currentProgramKey = buildContext().programKey;
    const currentClientId = ensureClientId();
    normalizedSignals.forEach((entry) => {
      if (hasSeenPresenceSignal(entry.id)) return;
      rememberPresenceSignalId(entry.id);
      if (entry.kind !== 'save') return;
      if (entry.clientId && entry.clientId === currentClientId) return;
      if (entry.programKey !== currentProgramKey) return;
      holdSavedPresenceDraftPreviews(entry);
      dispatchPresenceSignal(entry);
    });
  }

  async function maybeBroadcastTrackedSave(response, trackedSave, requestUrl) {
    if (!trackedSave || !(requestUrl instanceof URL)) return false;
    const successful = await responseHasSuccessfulSaveState(response);
    if (!successful) return false;
    if (currentDraftState) {
      await clearCurrentDraftState({ delay: 0, force: true });
    }
    return sendActivitySignal('save', {
      programKey: trackedSave.programKey,
      programName: trackedSave.programName,
      scope: trackedSave.scope || 'program',
      dataset: trackedSave.dataset,
      requestPath: requestUrl.pathname + requestUrl.search,
      message: trackedSave.message || 'تم حفظ البيانات'
    });
  }

  function resolveUrl(input) {
    try {
      const raw = input instanceof Request ? input.url : input;
      return new URL(String(raw || ''), window.location.href);
    } catch (_) {
      return null;
    }
  }

  function getMethod(input, init) {
    if (init && init.method) return String(init.method).toUpperCase();
    if (input instanceof Request && input.method) return String(input.method).toUpperCase();
    return 'GET';
  }

  function isSystemApiRequest(pathname, method) {
    const pathValue = trimText(pathname, 240);
    const methodValue = trimText(method, 16).toUpperCase();
    if (!pathValue || !methodValue) return false;
    return SYSTEM_API_PATTERNS.some((pattern) => pattern.test(pathValue));
  }

  function patchFetch() {
    if (typeof window.fetch !== 'function') return;

    const originalFetch = window.fetch.bind(window);
    window.fetch = function patchedFetch(input, init) {
      const session = getStoredSession();
      const requestUrl = resolveUrl(input);
      let nextInit = init ? Object.assign({}, init) : {};

      if (session && session.token && requestUrl && requestUrl.origin === window.location.origin && requestUrl.pathname.startsWith('/api/')) {
        const originalHeaders = input instanceof Request ? input.headers : undefined;
        const mergedHeaders = mergeHeaders(originalHeaders, nextInit.headers);
        if (!mergedHeaders.has('Authorization')) {
          mergedHeaders.set('Authorization', 'Bearer ' + session.token);
        }
        nextInit.headers = mergedHeaders;
      }

      const method = getMethod(input, nextInit);
      if (
        session &&
        session.token &&
        requestUrl &&
        requestUrl.origin === window.location.origin &&
        requestUrl.pathname.startsWith('/api/') &&
        !requestUrl.pathname.startsWith('/api/activity/') &&
        !isSystemApiRequest(requestUrl.pathname, method) &&
        method !== 'GET' &&
        method !== 'HEAD'
      ) {
        const shortUrl = requestUrl.pathname + requestUrl.search;
        const signature = 'api:' + method + ':' + shortUrl;
        if (!shouldSuppressEvent(signature)) {
          void sendEvent('api:request', method + ' ' + requestUrl.pathname, {
            method,
            url: shortUrl
          });
        }
      }

      const trackedSave = requestUrl ? buildTrackedSaveSignal(requestUrl, method) : null;
      const trackedDataLoad = requestUrl ? buildTrackedDataLoadContext(requestUrl, method) : null;

      return originalFetch(input, nextInit).then((response) => {
        if (
          trackedSave &&
          requestUrl &&
          requestUrl.origin === window.location.origin &&
          !requestUrl.pathname.startsWith('/api/activity/')
        ) {
          void maybeBroadcastTrackedSave(response, trackedSave, requestUrl);
        }
        if (trackedDataLoad && response && response.ok) {
          clearSavedPresenceDraftPreviews(trackedDataLoad);
        }
        return response;
      });
    };
  }

  function getElementLabel(element) {
    if (!(element instanceof Element)) return '';
    const explicit = trimText(
      element.getAttribute('aria-label')
      || element.getAttribute('title')
      || element.getAttribute('data-label')
      || element.value
      || element.textContent,
      120
    );
    if (explicit) return explicit;
    if (element.id) return trimText(element.id, 120);
    return trimText(element.tagName, 40);
  }

  function rowContextsMatch(left, right) {
    const leftContext = sanitizeRowContext(left);
    const rightContext = sanitizeRowContext(right);
    if (!leftContext || !rightContext) return false;

    const leftId = normalizeMatchValue(leftContext.rowId);
    const rightId = normalizeMatchValue(rightContext.rowId);
    const leftKey = normalizeMatchValue(leftContext.rowKey);
    const rightKey = normalizeMatchValue(rightContext.rowKey);
    if (leftId && rightId) {
      if (leftKey && rightKey) {
        return leftKey === rightKey && leftId === rightId;
      }
      if (leftId === rightId) {
        return true;
      }
    }

    const leftLabel = normalizeMatchValue(leftContext.rowLabel);
    const rightLabel = normalizeMatchValue(rightContext.rowLabel);
    if (leftLabel && rightLabel && leftLabel.length >= 6 && rightLabel.length >= 6) {
      return leftLabel === rightLabel;
    }

    return false;
  }

  function dedupePresenceUsers(users) {
    const unique = new Map();
    (Array.isArray(users) ? users : []).forEach((entry) => {
      if (!entry || !entry.username) return;
      const current = unique.get(entry.username);
      const currentTime = current ? new Date(current.lastSeenAt || 0).getTime() : 0;
      const nextTime = new Date(entry.lastSeenAt || 0).getTime();
      if (!current || nextTime >= currentTime) {
        unique.set(entry.username, entry);
      }
    });
    return Array.from(unique.values())
      .sort((left, right) => new Date(right.lastSeenAt || 0).getTime() - new Date(left.lastSeenAt || 0).getTime());
  }

  function applyPresenceStyle(element, color) {
    if (!(element instanceof HTMLElement) || !color) return;
    element.style.setProperty('--presence-color', color.hex);
    element.style.setProperty('--presence-rgb', color.rgb);
  }

  function clearPresenceStyle(element) {
    if (!(element instanceof HTMLElement)) return;
    element.style.removeProperty('--presence-color');
    element.style.removeProperty('--presence-rgb');
  }

  function ensureAdminPresenceStyles() {
    if (document.getElementById('activity-admin-presence-style')) return;
    const style = document.createElement('style');
    style.id = 'activity-admin-presence-style';
    style.textContent = `
      .activity-admin-row-highlight {
        position: relative;
        box-shadow: inset 0 0 0 2px rgba(var(--presence-rgb), .42), inset 8px 0 0 var(--presence-color);
        background: linear-gradient(90deg, rgba(var(--presence-rgb), .16), rgba(var(--presence-rgb), .05));
      }
      .activity-admin-presence-cell {
        position: relative;
        background-image: linear-gradient(0deg, rgba(var(--presence-rgb), .14), rgba(var(--presence-rgb), .14)) !important;
      }
      .activity-admin-presence-cell-start {
        box-shadow: inset 8px 0 0 var(--presence-color) !important;
      }
      .activity-admin-row-host {
        position: relative !important;
        overflow: visible;
      }
      .activity-admin-row-badges {
        position: absolute;
        top: -14px;
        inset-inline-start: 8px;
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        max-width: min(80vw, 420px);
        z-index: 40;
        pointer-events: none;
      }
      .activity-admin-row-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(var(--presence-rgb), .45);
        background: rgba(var(--presence-rgb), .18);
        color: #172033;
        font-size: 12px;
        font-weight: 800;
        line-height: 1.2;
        white-space: nowrap;
        box-shadow: 0 6px 14px rgba(15, 23, 42, .12);
        backdrop-filter: blur(6px);
      }
      .activity-admin-hierarchy-highlight {
        box-shadow: inset 0 0 0 2px rgba(var(--presence-rgb), .4), 0 0 0 3px rgba(var(--presence-rgb), .12);
        background-image: linear-gradient(180deg, rgba(var(--presence-rgb), .18), rgba(var(--presence-rgb), .08));
      }
      .activity-admin-hierarchy-host {
        position: relative !important;
        overflow: visible !important;
      }
      .activity-admin-hierarchy-badges {
        position: absolute;
        top: -14px;
        inset-inline-start: 8px;
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        max-width: min(78vw, 420px);
        z-index: 42;
        pointer-events: none;
      }
      .activity-admin-hierarchy-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(var(--presence-rgb), .45);
        background: rgba(var(--presence-rgb), .18);
        color: #172033;
        font-size: 12px;
        font-weight: 800;
        line-height: 1.2;
        white-space: nowrap;
        box-shadow: 0 6px 14px rgba(15, 23, 42, .12);
        backdrop-filter: blur(6px);
      }
    `;
    document.head.appendChild(style);
  }

  function clearAdminPresenceHighlights() {
    document.querySelectorAll('.activity-admin-row-badges').forEach((element) => {
      element.remove();
    });
    document.querySelectorAll('.activity-admin-row-highlight').forEach((element) => {
      element.classList.remove('activity-admin-row-highlight');
      clearPresenceStyle(element);
    });
    document.querySelectorAll('.activity-admin-presence-cell').forEach((element) => {
      element.classList.remove('activity-admin-presence-cell');
      clearPresenceStyle(element);
    });
    document.querySelectorAll('.activity-admin-presence-cell-start').forEach((element) => {
      element.classList.remove('activity-admin-presence-cell-start');
    });
    document.querySelectorAll('.activity-admin-row-host').forEach((element) => {
      element.classList.remove('activity-admin-row-host');
    });
  }

  function clearAdminHierarchyHighlights() {
    document.querySelectorAll('.activity-admin-hierarchy-badges').forEach((element) => {
      element.remove();
    });
    document.querySelectorAll('.activity-admin-hierarchy-highlight').forEach((element) => {
      element.classList.remove('activity-admin-hierarchy-highlight');
      clearPresenceStyle(element);
    });
    document.querySelectorAll('.activity-admin-hierarchy-host').forEach((element) => {
      element.classList.remove('activity-admin-hierarchy-host');
    });
  }

  function ensureRowLockStyles() {
    if (document.getElementById('activity-row-lock-style')) return;
    const style = document.createElement('style');
    style.id = 'activity-row-lock-style';
    style.textContent = `
      .activity-row-locked {
        position: relative;
        cursor: not-allowed !important;
        pointer-events: none !important;
        user-select: none !important;
        box-shadow: inset 0 0 0 2px rgba(var(--presence-rgb), .34), inset 8px 0 0 var(--presence-color);
        background: linear-gradient(90deg, rgba(var(--presence-rgb), .18), rgba(var(--presence-rgb), .07));
        opacity: .72;
      }
      .activity-row-locked-cell {
        position: relative;
        background-image: linear-gradient(0deg, rgba(var(--presence-rgb), .18), rgba(var(--presence-rgb), .18)) !important;
      }
      .activity-row-locked-cell-start {
        box-shadow: inset 8px 0 0 var(--presence-color) !important;
      }
      .activity-row-locked-host {
        position: relative !important;
        overflow: visible !important;
      }
      .activity-row-lock-badges {
        position: absolute;
        top: -14px;
        inset-inline-start: 8px;
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        max-width: min(78vw, 420px);
        z-index: 44;
        pointer-events: none;
      }
      .activity-row-lock-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(var(--presence-rgb), .45);
        background: rgba(var(--presence-rgb), .22);
        color: #172033;
        font-size: 12px;
        font-weight: 800;
        line-height: 1.2;
        white-space: nowrap;
        box-shadow: 0 6px 14px rgba(15, 23, 42, .12);
        backdrop-filter: blur(6px);
      }
    `;
    document.head.appendChild(style);
  }

  function clearPresenceRowLocks() {
    document.querySelectorAll('.activity-row-lock-badges').forEach((element) => {
      element.remove();
    });
    document.querySelectorAll('.activity-row-locked').forEach((element) => {
      element.classList.remove('activity-row-locked');
      clearPresenceStyle(element);
    });
    document.querySelectorAll('.activity-row-locked-cell').forEach((element) => {
      element.classList.remove('activity-row-locked-cell');
      clearPresenceStyle(element);
    });
    document.querySelectorAll('.activity-row-locked-cell-start').forEach((element) => {
      element.classList.remove('activity-row-locked-cell-start');
    });
    document.querySelectorAll('.activity-row-locked-host').forEach((element) => {
      element.classList.remove('activity-row-locked-host');
    });
  }

  function ensureLiveDraftStyles() {
    if (document.getElementById('activity-live-draft-style')) return;
    const style = document.createElement('style');
    style.id = 'activity-live-draft-style';
    style.textContent = `
      .activity-live-draft-host {
        position: relative !important;
        overflow: visible !important;
      }
      .activity-live-draft-overlay {
        position: absolute;
        inset: 2px;
        z-index: 46;
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 5px 7px;
        border-radius: 7px;
        border: 1px solid rgba(var(--presence-rgb), .34);
        background: rgba(var(--presence-rgb), .16);
        box-shadow: none;
        pointer-events: none;
        color: #172033;
        overflow: hidden;
      }
      .activity-live-draft-meta {
        font-size: 10.5px;
        font-weight: 800;
        line-height: 1.2;
        opacity: .78;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .activity-live-draft-value {
        font-size: 12.5px;
        font-weight: 700;
        line-height: 1.35;
        white-space: pre-wrap;
        word-break: break-word;
        unicode-bidi: plaintext;
      }
      .activity-live-draft-overlay.is-empty .activity-live-draft-value {
        min-height: 16px;
      }
    `;
    document.head.appendChild(style);
  }

  function clearPresenceDraftOverlays() {
    document.querySelectorAll('.activity-live-draft-overlay').forEach((element) => {
      element.remove();
    });
    document.querySelectorAll('.activity-live-draft-host').forEach((element) => {
      element.classList.remove('activity-live-draft-host');
      if (element instanceof HTMLElement) {
        delete element.dataset.activityLiveDraftSeen;
        delete element.dataset.activityLiveDraftSignature;
      }
    });
  }

  function getDirectDraftOverlays(element) {
    if (!(element instanceof Element)) return [];
    return Array.from(element.children).filter((child) => (
      child instanceof HTMLElement && child.classList.contains('activity-live-draft-overlay')
    ));
  }

  function getDirectDraftOverlay(element) {
    return getDirectDraftOverlays(element)[0] || null;
  }

  function markPresenceDraftHostsStale() {
    document.querySelectorAll('.activity-live-draft-host').forEach((element) => {
      if (element instanceof HTMLElement) {
        element.dataset.activityLiveDraftSeen = '0';
      }
    });
  }

  function sweepPresenceDraftHosts() {
    document.querySelectorAll('.activity-live-draft-host').forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      if (element.dataset.activityLiveDraftSeen === '1') return;
      element.classList.remove('activity-live-draft-host');
      delete element.dataset.activityLiveDraftSeen;
      delete element.dataset.activityLiveDraftSignature;
      getDirectDraftOverlays(element).forEach((overlay) => {
        overlay.remove();
      });
    });
  }

  function findElementsByDataValue(root, attributeName, value) {
    if (!(root instanceof Element)) return [];
    const expected = normalizeMatchValue(value);
    if (!expected) return [];
    return Array.from(root.querySelectorAll(`[${attributeName}]`)).filter((element) => (
      element instanceof Element
      && normalizeMatchValue(element.getAttribute(attributeName)) === expected
    ));
  }

  function findDraftTargetInRow(row, draft) {
    if (!(row instanceof Element) || !draft || typeof draft !== 'object') return null;
    const cell = sanitizeCellContext(draft.cell);
    if (!cell) return null;

    const candidates = [];
    if (cell.field) {
      candidates.push(...findElementsByDataValue(row, 'data-field', cell.field));
    }
    if (cell.key) {
      candidates.push(...findElementsByDataValue(row, 'data-key', cell.key));
    }
    if (Number.isInteger(cell.csvIndex) && cell.csvIndex >= 0) {
      candidates.push(...Array.from(row.querySelectorAll(`[data-csv-index="${cell.csvIndex}"]`)));
    }
    if (cell.header && row instanceof HTMLTableRowElement) {
      const headerKey = normalizeHeaderLabel(cell.header);
      const headerMatch = Array.from(row.cells || []).find((tableCell) => (
        normalizeHeaderLabel(readColumnHeaderLabel(tableCell)) === headerKey
      ));
      if (headerMatch) candidates.push(headerMatch);
    }
    if (Number.isInteger(cell.cellIndex) && cell.cellIndex >= 0) {
      if (row instanceof HTMLTableRowElement && row.cells[cell.cellIndex]) {
        candidates.push(row.cells[cell.cellIndex]);
      } else if (row.children[cell.cellIndex] instanceof Element) {
        candidates.push(row.children[cell.cellIndex]);
      }
    }

    for (const candidate of candidates) {
      const host = resolveEditableCellHost(candidate);
      if (host instanceof HTMLElement && row.contains(host)) {
        return host;
      }
    }
    return null;
  }

  function updatePresenceDraftOverlay(overlay, entry) {
    if (!(overlay instanceof HTMLElement) || !entry || !entry.username || !entry.draft) return;
    const color = getPresenceColor(entry.username);
    const displayName = trimText(entry.displayName || entry.username, 80) || entry.username;
    const draftValue = sanitizeDraftValue(entry && entry.draft ? entry.draft.value : '', 2400);
    overlay.classList.toggle('is-empty', !draftValue);
    applyPresenceStyle(overlay, color);

    let meta = overlay.querySelector('.activity-live-draft-meta');
    if (!(meta instanceof HTMLElement)) {
      meta = document.createElement('div');
      meta.className = 'activity-live-draft-meta';
      overlay.appendChild(meta);
    }
    if (meta.textContent !== displayName) {
      meta.textContent = displayName;
    }

    let value = overlay.querySelector('.activity-live-draft-value');
    if (!(value instanceof HTMLElement)) {
      value = document.createElement('div');
      value.className = 'activity-live-draft-value';
      overlay.appendChild(value);
    }
    if (value.textContent !== draftValue) {
      value.textContent = draftValue;
    }
  }

  function createPresenceDraftOverlay(entry) {
    const overlay = document.createElement('div');
    overlay.className = 'activity-live-draft-overlay';
    updatePresenceDraftOverlay(overlay, entry);
    return overlay;
  }

  function paintPresenceDraftCell(cell, entry) {
    if (!(cell instanceof HTMLElement) || !entry || !entry.username || !entry.draft) return;
    const signature = JSON.stringify({
      clientId: trimText(entry.clientId, 128),
      username: trimText(entry.username, 64),
      displayName: trimText(entry.displayName || '', 80),
      value: sanitizeDraftValue(entry.draft.value || '', 2400)
    });
    cell.dataset.activityLiveDraftSeen = '1';
    cell.classList.add('activity-live-draft-host');

    let overlay = getDirectDraftOverlay(cell);
    const extraOverlays = getDirectDraftOverlays(cell).slice(1);
    extraOverlays.forEach((extraOverlay) => {
      extraOverlay.remove();
    });

    if (!overlay) {
      overlay = createPresenceDraftOverlay(entry);
      cell.appendChild(overlay);
    }

    if (cell.dataset.activityLiveDraftSignature !== signature) {
      cell.dataset.activityLiveDraftSignature = signature;
    }
    updatePresenceDraftOverlay(overlay, entry);
  }

  function createRowLockBadges(users) {
    const container = document.createElement('div');
    container.className = 'activity-row-lock-badges';
    const seen = new Set();
    (Array.isArray(users) ? users : []).forEach((entry) => {
      if (!entry || !entry.username || seen.has(entry.username)) return;
      seen.add(entry.username);
      const badge = document.createElement('span');
      const color = getPresenceColor(entry.username);
      badge.className = 'activity-row-lock-badge';
      applyPresenceStyle(badge, color);
      badge.textContent = trimText(entry.displayName || entry.username, 80) || entry.username;
      container.appendChild(badge);
    });
    return container;
  }

  function releaseLockedRowFocus(row) {
    if (!(row instanceof Element)) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !row.contains(active)) return;
    try { active.blur(); } catch (_) {}
  }

  function paintPresenceLockedRow(row, users) {
    if (!(row instanceof Element)) return;
    const visibleUsers = (Array.isArray(users) ? users : []).filter((entry) => entry && entry.username);
    if (!visibleUsers.length) return;

    const primaryColor = getPresenceColor(visibleUsers[0].username);
    const tableCells = row instanceof HTMLTableRowElement
      ? Array.from(row.cells)
      : [];

    releaseLockedRowFocus(row);

    if (tableCells.length) {
      row.classList.add('activity-row-locked');
      applyPresenceStyle(row, primaryColor);
      tableCells.forEach((cell, index) => {
        if (!(cell instanceof HTMLElement)) return;
        cell.classList.add('activity-row-locked-cell');
        applyPresenceStyle(cell, primaryColor);
        if (index === 0) {
          cell.classList.add('activity-row-locked-cell-start', 'activity-row-locked-host');
          cell.appendChild(createRowLockBadges(visibleUsers));
        }
      });
      return;
    }

    if (row instanceof HTMLElement) {
      row.classList.add('activity-row-locked', 'activity-row-locked-host');
      applyPresenceStyle(row, primaryColor);
      row.appendChild(createRowLockBadges(visibleUsers));
    }
  }

  function bindRowLockGuards() {
    if (rowLockGuardBound) return;
    document.addEventListener('focusin', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const lockedRow = target ? target.closest('.activity-row-locked') : null;
      if (!lockedRow) return;
      if (target instanceof HTMLElement) {
        try { target.blur(); } catch (_) {}
      }
    }, true);
    document.addEventListener('keydown', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const lockedRow = target ? target.closest('.activity-row-locked') : null;
      if (!lockedRow) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);
    rowLockGuardBound = true;
  }

  function createAdminPresenceBadges(users) {
    const container = document.createElement('div');
    container.className = 'activity-admin-row-badges';
    dedupePresenceUsers(users).forEach((entry) => {
      const badge = document.createElement('span');
      const color = getPresenceColor(entry.username);
      badge.className = 'activity-admin-row-badge';
      applyPresenceStyle(badge, color);
      badge.textContent = trimText(entry.displayName || entry.username, 80) || entry.username;
      container.appendChild(badge);
    });
    return container;
  }

  function paintAdminPresenceRow(row, users) {
    if (!(row instanceof Element)) return;
    const visibleUsers = dedupePresenceUsers(users);
    if (!visibleUsers.length) return;

    const primaryColor = getPresenceColor(visibleUsers[0].username);
    const tableCells = row instanceof HTMLTableRowElement
      ? Array.from(row.cells)
      : [];

    if (tableCells.length) {
      row.classList.add('activity-admin-row-highlight');
      applyPresenceStyle(row, primaryColor);
      tableCells.forEach((cell, index) => {
        if (!(cell instanceof HTMLElement)) return;
        cell.classList.add('activity-admin-presence-cell');
        applyPresenceStyle(cell, primaryColor);
        if (index === 0) {
          cell.classList.add('activity-admin-presence-cell-start', 'activity-admin-row-host');
          cell.appendChild(createAdminPresenceBadges(visibleUsers));
        }
      });
      return;
    }

    if (row instanceof HTMLElement) {
      row.classList.add('activity-admin-row-highlight', 'activity-admin-row-host');
      applyPresenceStyle(row, primaryColor);
      row.appendChild(createAdminPresenceBadges(visibleUsers));
    }
  }

  function resolveHierarchyHost(element) {
    if (!(element instanceof Element)) return null;
    if (element.matches('button, [role="button"], .sector-stripe, .station-btn')) {
      return element;
    }
    return element.closest('.field, .filters-group, .record-heading-pill, .mdrop, .field-row__cell, .filter-control')
      || element.parentElement
      || element;
  }

  function createHierarchyBadges(items) {
    const container = document.createElement('div');
    container.className = 'activity-admin-hierarchy-badges';
    items.forEach((item) => {
      if (!item || !item.entry) return;
      const badge = document.createElement('span');
      const color = getPresenceColor(item.entry.username);
      badge.className = 'activity-admin-hierarchy-badge';
      applyPresenceStyle(badge, color);
      badge.textContent = trimText(item.label || item.entry.displayName || item.entry.username, 120) || item.entry.username;
      container.appendChild(badge);
    });
    return container;
  }

  function paintAdminHierarchyHost(host, items) {
    if (!(host instanceof HTMLElement)) return;
    const visibleItems = [];
    const seen = new Set();
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (!item || !item.entry || !item.entry.username) return;
      const key = `${item.entry.username}:${trimText(item.label || '', 120)}`;
      if (seen.has(key)) return;
      seen.add(key);
      visibleItems.push(item);
    });
    if (!visibleItems.length) return;
    const primaryColor = getPresenceColor(visibleItems[0].entry.username);
    host.classList.add('activity-admin-hierarchy-highlight', 'activity-admin-hierarchy-host');
    applyPresenceStyle(host, primaryColor);
    host.appendChild(createHierarchyBadges(visibleItems));
  }

  function getHierarchyElementValues(element, type) {
    const values = new Set();
    const pushValue = (value) => {
      const normalized = type === 'sector'
        ? normalizeSectorLabel(value)
        : normalizeStationLabel(value);
      const matchKey = normalizeHierarchyMatchValue(normalized);
      if (matchKey) values.add(matchKey);
    };

    if (!(element instanceof Element)) return values;

    if (element instanceof HTMLSelectElement) {
      pushValue(element.value);
      const selectedOption = element.selectedOptions && element.selectedOptions.length
        ? element.selectedOptions[0]
        : element.options[element.selectedIndex] || null;
      if (selectedOption) {
        pushValue(selectedOption.value);
        pushValue(selectedOption.textContent);
      }
      return values;
    }

    pushValue(element.getAttribute(type === 'sector' ? 'data-sector' : 'data-station'));
    pushValue(element.getAttribute('data-value'));
    pushValue('value' in element ? element.value : '');
    pushValue(element.textContent);
    return values;
  }

  function isHierarchyElementVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(element);
    if (!style || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 6 && rect.height > 6;
  }

  function collectHierarchyTargets(type) {
    const selector = type === 'sector'
      ? '#sectorStripes [data-sector-stripe], button[data-sector], select#sectorSelect, select#filterSector, select[name*="sector" i], select[id*="sector" i]'
      : '#stationButtonsContainer .station-btn, button[data-station], select#filterStation, select[name*="station" i], select[id*="station" i]';
    const seen = new Set();
    return Array.from(document.querySelectorAll(selector)).filter((element) => {
      if (!(element instanceof HTMLElement)) return false;
      if (seen.has(element)) return false;
      if (!isHierarchyElementVisible(element)) return false;
      seen.add(element);
      return true;
    });
  }

  function findHierarchyTargets(type, value) {
    const normalized = type === 'sector'
      ? normalizeHierarchyMatchValue(normalizeSectorLabel(value))
      : normalizeHierarchyMatchValue(normalizeStationLabel(value));
    if (!normalized) return [];
    return collectHierarchyTargets(type).filter((element) => getHierarchyElementValues(element, type).has(normalized));
  }

  function addHierarchyEntry(map, key, entry) {
    if (!key || !entry) return;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(entry);
  }

  function queueHierarchyHostPaint(queue, element, items) {
    const host = resolveHierarchyHost(element);
    if (!(host instanceof HTMLElement) || !Array.isArray(items) || !items.length) return;
    if (!queue.has(host)) {
      queue.set(host, []);
    }
    queue.get(host).push(...items);
  }

  function loadPresenceSnapshot() {
    const session = getStoredSession();
    if (!session || !session.token || typeof window.fetch !== 'function') {
      return Promise.resolve({ users: [], signals: [] });
    }

    return window.fetch(API_ENDPOINTS.presence, {
      method: 'GET',
      cache: 'no-store'
    }).then((response) => {
      if (!response.ok) return null;
      return response.json().catch(() => null);
    }).then((payload) => {
      if (!payload || !payload.success) return { users: [], signals: [] };
      return {
        users: Array.isArray(payload.users) ? payload.users : [],
        signals: Array.isArray(payload.signals) ? payload.signals : []
      };
    }).catch(() => ({ users: [], signals: [] }));
  }

  function loadAdminActiveUsers() {
    const session = getStoredSession();
    if (!session || getNormalizedRole(session.user) !== 'admin' || typeof window.fetch !== 'function') {
      return Promise.resolve([]);
    }

    return window.fetch(API_ENDPOINTS.activeUsers, {
      method: 'GET',
      cache: 'no-store'
    }).then((response) => {
      if (!response.ok) return [];
      return response.json().catch(() => null);
    }).then((payload) => {
      if (!payload || !payload.success || !Array.isArray(payload.users)) return [];
      return payload.users;
    }).catch(() => []);
  }

  function applyAdminPresenceHighlights(users) {
    clearAdminPresenceHighlights();

    const currentProgramKey = buildContext().programKey;
    const relevantUsers = dedupePresenceUsers(
      (Array.isArray(users) ? users : []).filter((entry) => (
        entry
        && entry.programKey === currentProgramKey
        && entry.activeRow
      ))
    );
    if (!relevantUsers.length) return;

    const rows = Array.from(document.querySelectorAll(ACTIVITY_ROW_SELECTOR))
      .filter((row, index, list) => row instanceof Element && list.indexOf(row) === index);
    if (!rows.length) return;

    const rowDetails = rows.map((row) => ({
      row,
      context: describeRowElement(row)
    })).filter((entry) => entry.context);

    const rowMatches = new Map();
    relevantUsers.forEach((userEntry) => {
      const match = rowDetails.find((rowEntry) => rowContextsMatch(userEntry.activeRow, rowEntry.context));
      if (!match) return;
      if (!rowMatches.has(match.row)) {
        rowMatches.set(match.row, []);
      }
      rowMatches.get(match.row).push(userEntry);
    });

    rowMatches.forEach((matchedUsers, row) => {
      paintAdminPresenceRow(row, matchedUsers);
    });
  }

  function applyPresenceRowLocks(users) {
    clearPresenceRowLocks();

    const currentProgramKey = buildContext().programKey;
    const currentClientId = ensureClientId();
    const relevantUsers = (Array.isArray(users) ? users : []).filter((entry) => (
      entry
      && entry.clientId !== currentClientId
      && entry.programKey === currentProgramKey
      && entry.activeRow
    ));
    if (!relevantUsers.length) return;

    const rows = Array.from(document.querySelectorAll(ACTIVITY_ROW_SELECTOR))
      .filter((row, index, list) => row instanceof Element && list.indexOf(row) === index);
    if (!rows.length) return;

    const rowDetails = rows.map((row) => ({
      row,
      context: describeRowElement(row)
    })).filter((entry) => entry.context);

    const rowMatches = new Map();
    relevantUsers.forEach((presenceEntry) => {
      const match = rowDetails.find((rowEntry) => rowContextsMatch(presenceEntry.activeRow, rowEntry.context));
      if (!match) return;
      if (!rowMatches.has(match.row)) {
        rowMatches.set(match.row, []);
      }
      rowMatches.get(match.row).push(presenceEntry);
    });

    rowMatches.forEach((matchedUsers, row) => {
      paintPresenceLockedRow(row, matchedUsers);
    });
  }

  function applyPresenceDrafts(users) {
    markPresenceDraftHostsStale();

    const relevantUsers = getCachedPresenceDraftEntries(users);
    if (!relevantUsers.length) {
      clearPresenceDraftOverlays();
      return;
    }

    const rows = Array.from(document.querySelectorAll(ACTIVITY_ROW_SELECTOR))
      .filter((row, index, list) => row instanceof Element && list.indexOf(row) === index);
    if (!rows.length) return;

    const rowDetails = rows.map((row) => ({
      row,
      context: describeRowElement(row)
    })).filter((entry) => entry.context);

    const paintedTargets = new Map();
    relevantUsers.forEach((entry) => {
      const match = rowDetails.find((rowEntry) => rowContextsMatch(entry.activeRow, rowEntry.context));
      if (!match) return;
      const target = findDraftTargetInRow(match.row, entry.draft);
      if (!target) return;
      if (paintedTargets.has(target)) return;
      paintedTargets.set(target, entry);
      paintPresenceDraftCell(target, entry);
    });
    sweepPresenceDraftHosts();
  }

  function applyAdminHierarchyHighlights(users) {
    clearAdminHierarchyHighlights();

    const currentProgramKey = buildContext().programKey;
    const relevantUsers = dedupePresenceUsers(
      (Array.isArray(users) ? users : []).filter((entry) => (
        entry
        && entry.programKey === currentProgramKey
        && sanitizeLocationContext(entry.location)
      ))
    );
    if (!relevantUsers.length) return;

    const hostQueue = new Map();
    relevantUsers.forEach((entry) => {
      const location = sanitizeLocationContext(entry.location);
      if (!location) return;
      const displayName = trimText(entry.displayName || entry.username, 80) || entry.username;
      const stations = Array.isArray(location.stations) && location.stations.length
        ? location.stations
        : (location.station ? [location.station] : []);
      let paintedStation = false;
      stations.forEach((station) => {
        const targets = findHierarchyTargets('station', station);
        if (!targets.length) return;
        paintedStation = true;
        targets.forEach((element) => {
          queueHierarchyHostPaint(hostQueue, element, [{ entry, label: displayName }]);
        });
      });
      if (paintedStation || !location.sector) return;
      findHierarchyTargets('sector', location.sector).forEach((element) => {
        queueHierarchyHostPaint(hostQueue, element, [{ entry, label: displayName }]);
      });
    });

    hostQueue.forEach((items, host) => {
      paintAdminHierarchyHost(host, items);
    });
  }

  function initAdminPresenceOverlay() {
    if (!isAdminSession() || !shouldTrackRowContext()) return;
    ensureAdminPresenceStyles();

    const refreshAdminPresence = () => {
      if (document.visibilityState === 'hidden') return;
      void loadAdminActiveUsers().then((users) => {
        applyAdminPresenceHighlights(users);
        applyAdminHierarchyHighlights(users);
      });
    };

    refreshAdminPresence();
    adminPresencePollHandle = window.setInterval(refreshAdminPresence, ADMIN_PRESENCE_POLL_MS);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        refreshAdminPresence();
      }
    });
  }

  function initRowLockOverlay() {
    if (!shouldTrackRowContext()) return;
    ensureRowLockStyles();
    bindRowLockGuards();

    const refreshRowLocks = () => {
      if (document.visibilityState === 'hidden') return;
      void loadPresenceSnapshot().then((snapshot) => {
        applyPresenceRowLocks(snapshot && Array.isArray(snapshot.users) ? snapshot.users : []);
      });
    };

    refreshRowLocks();
    rowLockPollHandle = window.setInterval(refreshRowLocks, ADMIN_PRESENCE_POLL_MS);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        refreshRowLocks();
      }
    });
  }

  function initLiveDraftOverlay() {
    if (!shouldTrackRowContext()) return;
    ensureLiveDraftStyles();

    const refreshDrafts = () => {
      if (document.visibilityState === 'hidden') return;
      void loadPresenceSnapshot().then((snapshot) => {
        const users = snapshot && Array.isArray(snapshot.users) ? snapshot.users : [];
        applyPresenceDrafts(users);
        processPresenceSignals(snapshot && Array.isArray(snapshot.signals) ? snapshot.signals : []);
      });
    };

    refreshDrafts();
    liveDraftPollHandle = window.setInterval(refreshDrafts, SHARED_PRESENCE_POLL_MS);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        refreshDrafts();
      }
    });
  }

  function isSaveActionLabel(label) {
    const normalized = normalizeMatchValue(label);
    return normalized.includes('حفظ') || normalized.includes('save');
  }

  function bindUiTracking() {
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element
        ? event.target.closest('button, a, [role="button"], input[type="submit"], input[type="button"]')
        : null;
      if (!target) return;

      const label = getElementLabel(target);
      if (!label) return;
      if (currentDraftState && isSaveActionLabel(label)) {
        void clearCurrentDraftState({ delay: 0, force: true });
      }
      const href = target instanceof HTMLAnchorElement ? trimText(target.getAttribute('href'), 200) : '';
      const signature = 'click:' + label + ':' + href;
      if (shouldSuppressEvent(signature)) return;

      const datasetTarget = trimText(target.getAttribute('data-target'), 200);
      const navigationTarget = href || datasetTarget;
      if (navigationTarget && !navigationTarget.startsWith('#')) {
        markNavigationIntent('navigate');
      }

      void sendEvent('ui:click', 'ضغط على ' + label, {
        label,
        target: href || trimText(target.id || target.className || target.tagName, 160)
      });
    }, true);

    document.addEventListener('submit', (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const label = getElementLabel(form);
      const signature = 'submit:' + label;
      if (currentDraftState) {
        void clearCurrentDraftState({ delay: 0, force: true });
      }
      if (shouldSuppressEvent(signature)) return;

      const action = trimText(form.getAttribute('action'), 200);
      if (action) {
        markNavigationIntent('submit');
      }

      void sendEvent('ui:submit', 'إرسال نموذج ' + label, {
        label,
        action
      });
    }, true);
  }

  function initLifecycle() {
    clearNavigationIntent();
    const context = buildContext();
    lastPresenceInteractionAt = Date.now();
    void sendHeartbeat('active');
    void sendEvent('page:view', 'فتح ' + (context.pageName || context.programName), {
      pageName: context.pageName,
      programName: context.programName
    });

    ['pointerdown', 'pointermove'].forEach((eventName) => {
      document.addEventListener(eventName, () => {
        rememberPresenceInteraction();
      }, true);
    });

    window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void sendHeartbeat();
        return;
      }
      void sendHeartbeat('inactive');
    });

    window.addEventListener('beforeunload', () => {
      const latestContext = buildContext();
      const navigationIntent = getNavigationIntent();
      if (!navigationIntent) {
        void sendEvent('page:leave', 'إغلاق ' + (latestContext.pageName || latestContext.programName), {
          pageName: latestContext.pageName,
          programName: latestContext.programName
        }, { keepalive: true });
      }
      void sendHeartbeat('closing', { keepalive: true });
    });

    initAdminPresenceOverlay();
    initRowLockOverlay();
    initLiveDraftOverlay();
  }

  patchFetch();
  bindUiTracking();
  bindRowTracking();
  bindDraftTracking();
  initLifecycle();

  window.__activityTracker = {
    log: function log(eventType, message, details) {
      return sendEvent(eventType, message, details);
    },
    heartbeat: function heartbeat(state) {
      return sendHeartbeat(state || 'active');
    },
    markNavigation: function markNavigation(reason) {
      markNavigationIntent(reason || 'navigate');
    }
  };
})();
