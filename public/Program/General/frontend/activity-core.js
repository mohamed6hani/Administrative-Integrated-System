(function initActivityCore() {
  'use strict';

  if (window.__activityCoreInitialized) return;
  window.__activityCoreInitialized = true;

  const STORAGE_KEYS = {
    token: 'general.auth.token',
    user: 'general.auth.user',
    clientId: 'general.activity.clientId',
    navigationIntent: 'general.activity.navigationIntent'
  };

  const API_ENDPOINTS = {
    heartbeat: '/api/activity/heartbeat',
    events: '/api/activity/events'
  };

  const HEARTBEAT_INTERVAL_MS = 30000;
  const IDLE_TIMEOUT_MS = 60 * 1000;
  const PANEL_RE = /panel|modal|popup|overlay|drawer|sidebar|frame|card/i;
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

  let heartbeatTimer = 0;
  let accessCheckTimer = 0;
  let lastInteractionAt = Date.now();
  let lastState = 'active';
  let navigationIntentClearHandle = 0;
  let stopped = false;
  let signedOutOverlayShown = false;
  let accessRevokedOverlayShown = false;
  var panelTriggerMap = {};
  var latestClickSeq = 0;

  function trimText(value, maxLength) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return maxLength ? text.slice(0, maxLength) : text;
  }

  function safeJsonParse(value) {
    try { return value ? JSON.parse(value) : null; } catch (_) { return null; }
  }

  function getStoredSession() {
    const token = sessionStorage.getItem(STORAGE_KEYS.token) || localStorage.getItem(STORAGE_KEYS.token);
    const rawUser = sessionStorage.getItem(STORAGE_KEYS.user) || localStorage.getItem(STORAGE_KEYS.user);
    if (!token || !rawUser) return null;
    const user = safeJsonParse(rawUser);
    return user && typeof user === 'object' ? { token, user } : null;
  }

  function createClientId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
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
    const inferred = inferProgram(window.location.pathname || '/');
    const pageName = trimText(document.title || inferred.name, 120);
    return {
      programKey: inferred.key,
      programName: inferred.name,
      pageName,
      path: (window.location.pathname || '/') + (window.location.search || '')
    };
  }

  function postJson(url, payload, options) {
    if (stopped) return Promise.resolve(false);
    const session = getStoredSession();
    if (!session || !session.token || typeof window.fetch !== 'function') return Promise.resolve(false);
    return window.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + session.token
      },
      body: JSON.stringify(payload),
      keepalive: Boolean(options && options.keepalive)
    }).then(() => true).catch(() => false);
  }

  function normalizeState(value) {
    const state = trimText(value, 16).toLowerCase();
    if (state === 'inactive' || state === 'closing' || state === 'offline') return state;
    return 'active';
  }

  function getCurrentState() {
    if (document.visibilityState && document.visibilityState !== 'visible') return 'inactive';
    return Date.now() - lastInteractionAt >= IDLE_TIMEOUT_MS ? 'inactive' : 'active';
  }

  function sendHeartbeat(state, options) {
    const normalized = normalizeState(state || getCurrentState());
    lastState = normalized;
    if (stopped) return Promise.resolve(false);
    const session = getStoredSession();
    if (!session || !session.token || typeof window.fetch !== 'function') return Promise.resolve(false);
    return window.fetch(API_ENDPOINTS.heartbeat, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ state: normalized, clientId: ensureClientId(), context: buildContext() }),
      keepalive: Boolean(options && options.keepalive)
    }).then(function(response) {
      if (response.status === 401) return false;
      return response.json().then(function(data) {
        if (data && data.accessRevoked) showAccessRevokedOverlay();
        return true;
      }).catch(function() { return true; });
    }).catch(function() { return false; });
  }

  function sendEvent(eventType, message, details, options) {
    return postJson(API_ENDPOINTS.events, {
      eventType: trimText(eventType, 80) || 'event',
      message: trimText(message, 240),
      clientId: ensureClientId(),
      context: buildContext(),
      details: details && typeof details === 'object' ? details : {}
    }, options || {});
  }

  function rememberInteraction() {
    lastInteractionAt = Date.now();
    if (lastState === 'inactive' && document.visibilityState !== 'hidden') {
      void sendHeartbeat('active');
    }
  }

  function markNavigationIntent(reason) {
    try {
      if (navigationIntentClearHandle) clearTimeout(navigationIntentClearHandle);
      sessionStorage.setItem(STORAGE_KEYS.navigationIntent, trimText(reason || 'navigate', 32) || 'navigate');
      navigationIntentClearHandle = window.setTimeout(() => {
        if (document.visibilityState === 'visible') {
          sessionStorage.removeItem(STORAGE_KEYS.navigationIntent);
        }
      }, 1500);
    } catch (_) {}
  }

  function getNavigationIntent() {
    try { return trimText(sessionStorage.getItem(STORAGE_KEYS.navigationIntent), 32); } catch (_) { return ''; }
  }

  function isPanelVisible(el) {
    if (el.hidden) return false;
    if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false;
    try { return window.getComputedStyle(el).display !== 'none'; } catch (_) { return false; }
  }

  const APP_KEYS = ['weapons', 'renewal', 'report', 'accept', 'request', 'seized', 'storage', 'company'];

  function startAccessCheck() {
    const programKey = inferProgram(window.location.pathname).key;
    if (APP_KEYS.indexOf(programKey) === -1) return;
    const session = getStoredSession();
    if (!session || !session.token || typeof window.EventSource !== 'function') return;

    var src = new window.EventSource('/api/auth/access-events?token=' + encodeURIComponent(session.token));

    src.onmessage = function(e) {
      try {
        var data = JSON.parse(e.data);
        if (data && Array.isArray(data.apps) && data.apps.indexOf(programKey) !== -1) {
          src.close();
          showAccessRevokedOverlay();
        }
      } catch (_) {}
    };

    src.onerror = function() {
      // Let EventSource perform its built-in reconnect; heartbeat remains the fallback.
    };

    // Store close handle so stop() can clean it up
    accessCheckTimer = { close: function() { src.close(); } };
  }

  function getVisiblePanelKeys() {
    var keys = [];
    document.querySelectorAll('[id]').forEach(function(el) {
      if (!PANEL_RE.test(el.id)) return;
      if (!isPanelVisible(el)) return;
      keys.push('id:' + el.id);
    });
    try {
      document.querySelectorAll('[class*="overlay"]:not([id]),[class*="modal"]:not([id]),[class*="popup"]:not([id])').forEach(function(el) {
        if (!isPanelVisible(el)) return;
        var cls = typeof el.className === 'string' ? el.className.split(' ')[0] : (el.getAttribute('class') || '').split(' ')[0];
        if (cls) keys.push('cls:' + cls);
      });
    } catch (_) {}
    return keys;
  }

  function start() {
    const context = buildContext();
    void sendHeartbeat('active');
    void sendEvent('page:view', 'فتح ' + (context.pageName || context.programName), {
      pageName: context.pageName,
      programName: context.programName
    });

    ['pointerdown', 'keydown'].forEach((eventName) => {
      document.addEventListener(eventName, rememberInteraction, true);
    });

    // Track which element triggered each panel open (before/after diff on click).
    // Panels can open asynchronously (lazy module load + server fetch can take a
    // second or more), so sample several times over a few seconds instead of once.
    // latestClickSeq makes the most recent click "own" any panel that appears, so a
    // slow earlier open can't be mis-attributed to a later click.
    document.addEventListener('click', function(e) {
      var trigger = (e.target && e.target.id) ? e.target
        : (e.target && e.target.closest ? e.target.closest('[id]') : null);
      if (!trigger || !trigger.id) return;
      var triggerId = trigger.id;
      var mySeq = ++latestClickSeq;
      var before = getVisiblePanelKeys();
      [250, 700, 1500, 3000].forEach(function(delay) {
        setTimeout(function() {
          if (mySeq !== latestClickSeq) return; // superseded by a newer click
          var after = getVisiblePanelKeys();
          after.forEach(function(key) {
            if (before.indexOf(key) === -1) panelTriggerMap[key] = triggerId;
          });
          before.forEach(function(key) {
            if (after.indexOf(key) === -1) delete panelTriggerMap[key];
          });
        }, delay);
      });
    }, true);

    heartbeatTimer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    document.addEventListener('visibilitychange', () => {
      void sendHeartbeat(document.visibilityState === 'visible' ? undefined : 'inactive');
    });

    startAccessCheck();
    attemptRestore();

    window.addEventListener('beforeunload', () => {
      const context = buildContext();
      if (!getNavigationIntent()) {
        void sendEvent('page:leave', 'إغلاق ' + (context.pageName || context.programName), {
          pageName: context.pageName,
          programName: context.programName
        }, { keepalive: true });
      }
      void sendHeartbeat('closing', { keepalive: true });
    });
  }

  function stop() {
    stopped = true;
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = 0; }
    if (accessCheckTimer) {
      try { accessCheckTimer.close(); } catch (_) {}
      accessCheckTimer = 0;
    }
  }

  function clearStoredSession() {
    try {
      sessionStorage.removeItem(STORAGE_KEYS.token);
      sessionStorage.removeItem(STORAGE_KEYS.user);
      localStorage.removeItem(STORAGE_KEYS.token);
      localStorage.removeItem(STORAGE_KEYS.user);
    } catch (_) {}
  }

  function showSignedOutOverlay() {
    if (signedOutOverlayShown) return;
    if (inferProgram(window.location.pathname).key === 'login') return;
    signedOutOverlayShown = true;

    var session = getStoredSession();
    var accountName = (session && session.user && (session.user.displayName || session.user.username)) || '';

    try {
      localStorage.setItem('session.restore.url', window.location.href);
      var snap = {};
      document.querySelectorAll('input[id], select[id], textarea[id]').forEach(function(el) {
        if (el.type === 'password') return;
        if (el.type === 'checkbox') { snap[el.id] = el.checked; }
        else if (el.type === 'radio') { if (el.checked) snap[el.id] = el.value; }
        else if (el.value) { snap[el.id] = el.value; }
      });
      var nameIdx = {};
      document.querySelectorAll('[name]:not([id])').forEach(function(el) {
        if (!el.name || el.type === 'password') return;
        nameIdx[el.name] = (nameIdx[el.name] || 0) + 1;
        var key = '__n:' + el.name + ':' + nameIdx[el.name];
        if (el.type === 'checkbox') { snap[key] = el.checked; }
        else if (el.type === 'radio') { if (el.checked) snap[key] = el.value; }
        else if (el.value) { snap[key] = el.value; }
      });
      var openPanels = [];
      document.querySelectorAll('[id]').forEach(function(el) {
        if (!PANEL_RE.test(el.id)) return;
        if (!isPanelVisible(el)) return;
        // Skip panels opted out of restore (e.g. transient validation overlays
        // whose "trigger" is a submit button — reopening would re-submit).
        if (el.closest && el.closest('[data-no-restore]')) return;
        var key = 'id:' + el.id;
        openPanels.push({ key: key, trigger: panelTriggerMap[key] || null });
      });
      try {
        document.querySelectorAll('[class*="overlay"]:not([id]),[class*="modal"]:not([id]),[class*="popup"]:not([id])').forEach(function(el) {
          if (!isPanelVisible(el)) return;
          if (el.closest && el.closest('[data-no-restore]')) return;
          var cls = typeof el.className === 'string' ? el.className.split(' ')[0] : (el.getAttribute('class') || '').split(' ')[0];
          if (!cls) return;
          var key = 'cls:' + cls;
          openPanels.push({ key: key, trigger: panelTriggerMap[key] || null });
        });
      } catch (_) {}
      if (openPanels.length) snap.__panels = openPanels;
      localStorage.setItem('session.restore.fields', JSON.stringify(snap));
    } catch (_) {}

    stop();
    clearStoredSession();

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:16px;padding:40px 32px;max-width:400px;width:90%;text-align:center;border-top:5px solid #dc2626;box-shadow:0 20px 60px rgba(220,38,38,0.25);display:flex;flex-direction:column;align-items:center;gap:14px;">' +
        '<div style="font-size:2.8rem;line-height:1;">⚠️</div>' +
        '<p style="color:#1f2937;font-size:1rem;font-weight:600;margin:0;line-height:1.7;">' +
          'هذا الحساب ' +
          (accountName ? '<span style="color:#dc2626;font-weight:700;">' + accountName + '</span> ' : '') +
          'قد تم تسجيل خروجه.' +
        '</p>' +
        '<p style="color:#6b7280;font-size:0.9rem;margin:0;">برجاء تسجيل الدخول</p>' +
        '<button id="__signedOutLoginBtn" style="margin-top:10px;background:#dc2626;color:#fff;border:none;border-radius:10px;padding:12px 36px;font-size:1rem;font-weight:700;cursor:pointer;">تسجيل الدخول</button>' +
      '</div>';

    var inject = function() {
      (document.body || document.documentElement).appendChild(overlay);
      var btn = document.getElementById('__signedOutLoginBtn');
      if (btn) {
        btn.addEventListener('mouseover', function() { btn.style.background = '#b91c1c'; });
        btn.addEventListener('mouseout',  function() { btn.style.background = '#dc2626'; });
        btn.addEventListener('click',     function() {
          try { localStorage.setItem('session.restore.active', '1'); } catch (_) {}
          window.location.href = '/';
        });
      }
    };
    if (document.body) { inject(); } else { document.addEventListener('DOMContentLoaded', inject); }
  }

  function showAccessRevokedOverlay() {
    if (accessRevokedOverlayShown) return;
    if (inferProgram(window.location.pathname).key === 'login') return;
    accessRevokedOverlayShown = true;

    stop();

    var session = getStoredSession();
    var accountName = (session && session.user && (session.user.displayName || session.user.username)) || '';

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:16px;padding:40px 32px;max-width:400px;width:90%;text-align:center;border-top:5px solid #dc2626;box-shadow:0 20px 60px rgba(220,38,38,0.25);display:flex;flex-direction:column;align-items:center;gap:14px;">' +
        '<div style="font-size:2.8rem;line-height:1;">🚫</div>' +
        '<p style="color:#1f2937;font-size:1rem;font-weight:600;margin:0;line-height:1.7;">' +
          'صلاحية الحساب ' +
          (accountName ? '<span style="color:#dc2626;font-weight:700;">' + accountName + '</span> ' : '') +
          'لهاذا البرنامج قد اغلقت' +
        '</p>' +
        '<button id="__accessRevokedExitBtn" style="margin-top:10px;background:#dc2626;color:#fff;border:none;border-radius:10px;padding:12px 36px;font-size:1rem;font-weight:700;cursor:pointer;">خروج</button>' +
      '</div>';

    var inject = function() {
      (document.body || document.documentElement).appendChild(overlay);
      var btn = document.getElementById('__accessRevokedExitBtn');
      if (btn) {
        btn.addEventListener('mouseover', function() { btn.style.background = '#b91c1c'; });
        btn.addEventListener('mouseout',  function() { btn.style.background = '#dc2626'; });
        btn.addEventListener('click',     function() { window.location.href = '/main.html'; });
      }
    };
    if (document.body) { inject(); } else { document.addEventListener('DOMContentLoaded', inject); }
  }

  function attemptRestore() {
    try {
      if (localStorage.getItem('session.restore.active') !== '1') return;
      var savedUrl = localStorage.getItem('session.restore.url') || '';
      var currentBase = window.location.href.split('?')[0].split('#')[0];
      var savedBase = savedUrl.split('?')[0].split('#')[0];
      if (!savedUrl || currentBase !== savedBase) return;
      var raw = localStorage.getItem('session.restore.fields');
      var fields = {};
      try { fields = raw ? JSON.parse(raw) : {}; } catch (_) {}
      localStorage.removeItem('session.restore.active');
      localStorage.removeItem('session.restore.url');
      localStorage.removeItem('session.restore.fields');

      var panels = Array.isArray(fields.__panels) ? fields.__panels : [];
      delete fields.__panels;

      function resolveEl(key) {
        if (key.startsWith('__n:')) {
          var parts = key.slice(4).split(':');
          var name = parts.slice(0, -1).join(':');
          var idx = parseInt(parts[parts.length - 1], 10) - 1;
          var els = document.querySelectorAll('[name="' + name + '"]:not([id])');
          return els[idx] || null;
        }
        return document.getElementById(key);
      }

      function applyField(key, val) {
        var el = resolveEl(key);
        if (!el) return;
        if (el.type === 'checkbox') { el.checked = Boolean(val); }
        else if (el.type === 'radio') { el.checked = el.value === String(val); }
        else { el.value = val; }
        try { el.dispatchEvent(new Event('input',  { bubbles: true })); } catch (_) {}
        try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
      }

      // Collect unique trigger button IDs from all open panels
      var triggerIds = [];
      panels.forEach(function(p) {
        if (p.trigger && triggerIds.indexOf(p.trigger) === -1) triggerIds.push(p.trigger);
      });

      // Phase 1 — click trigger buttons so the module's own open logic runs.
      // CSS fallback for any panel with no recorded trigger.
      setTimeout(function() {
        triggerIds.forEach(function(id) {
          var btn = document.getElementById(id);
          if (btn) { try { btn.click(); } catch (_) {} }
        });
        panels.forEach(function(p) {
          if (p.trigger) return;
          if (!p.key || !p.key.startsWith('id:')) return;
          var el = document.getElementById(p.key.slice(3));
          if (!el) return;
          el.hidden = false;
          el.removeAttribute('aria-hidden');
        });
      }, 700);

      // Phase 2 — restore all fields. Delay is generous to allow async modal opens
      // (e.g. Weapons create modal does a server fetch before rendering).
      setTimeout(function() {
        Object.keys(fields).forEach(function(key) { applyField(key, fields[key]); });
      }, 2000);

      // Phase 3 — retry selects (e.g. station populated after sector fires change)
      setTimeout(function() {
        Object.keys(fields).forEach(function(key) {
          var el = resolveEl(key);
          if (!el || el.tagName !== 'SELECT') return;
          if (el.value === String(fields[key])) return;
          applyField(key, fields[key]);
        });
      }, 3000);

      // Phase 4 — final retry of all fields for slow async opens
      setTimeout(function() {
        Object.keys(fields).forEach(function(key) {
          var el = resolveEl(key);
          if (!el) return;
          if (el.value === String(fields[key])) return;
          applyField(key, fields[key]);
        });
      }, 4500);
    } catch (_) {}
  }

  function installGlobalSearchReturnButton() {
    const storageKey = 'general.globalSearchReturnState';
    let state = null;
    try { state = safeJsonParse(sessionStorage.getItem(storageKey)); } catch (_) { return; }
    if (!state || state.source !== 'global-search') return;
    const currentProgram = inferProgram(window.location.pathname).key;
    if (!state.programKey || state.programKey !== currentProgram) return;
    const createdAt = Date.parse(state.createdAt || '');
    if (Number.isFinite(createdAt) && Date.now() - createdAt > 2 * 60 * 60 * 1000) {
      try { sessionStorage.removeItem(storageKey); } catch (_) {}
      return;
    }

    const style = document.createElement('style');
    style.id = 'global-search-return-style';
    style.textContent = `
      .global-search-return-button {
        position: fixed;
        top: 14px;
        left: 14px;
        z-index: 10000;
        min-width: 88px;
        min-height: 40px;
        padding: 8px 18px;
        border: 1px solid rgba(15, 23, 42, 0.28);
        border-radius: 10px;
        background: #ffffff;
        color: #111827;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.2);
        font: 800 14px/1.2 Tahoma, 'Segoe UI', Arial, sans-serif;
        cursor: pointer;
      }
      .global-search-return-button:hover,
      .global-search-return-button:focus-visible {
        border-color: #2563eb;
        background: #eff6ff;
        color: #1d4ed8;
        outline: none;
      }
    `;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'globalSearchReturnButton';
    button.className = 'global-search-return-button';
    button.textContent = 'عودة';
    button.setAttribute('aria-label', 'عودة إلى نتائج البحث العام');
    button.addEventListener('click', function() {
      markNavigationIntent('global-search-return');
      window.location.href = String(state.returnUrl || '/dashboard?globalSearchReturn=1');
    });
    document.head.appendChild(style);
    document.body.appendChild(button);
  }

  function patchFetchAuth() {
    if (typeof window.fetch !== 'function' || window.__fetchAuthPatched) return;
    window.__fetchAuthPatched = true;
    const _orig = window.fetch.bind(window);
    window.fetch = function authFetch(input, init) {
      const session = getStoredSession();
      if (!session || !session.token) return _orig(input, init);
      const next = Object.assign({}, init);
      const src = next.headers || (input instanceof Request ? input.headers : null);
      const hdrs = src instanceof Headers ? src : new Headers(src || {});
      if (!hdrs.has('Authorization')) hdrs.set('Authorization', 'Bearer ' + session.token);
      next.headers = hdrs;
      return _orig(input, next).then(function(response) {
        if (response.status === 401) showSignedOutOverlay();
        else if (response.status === 403) {
          response.clone().json().then(function(data) {
            if (data && data.accessRevoked) showAccessRevokedOverlay();
          }).catch(function() {});
        }
        return response;
      });
    };
  }

  window.__activityCoreStop = stop;
  window.__activityTracker = window.__activityTracker || {
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

  patchFetchAuth();
  installGlobalSearchReturnButton();
  start();
})();
