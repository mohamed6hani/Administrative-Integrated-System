/**
 * Shared frame/navigation helpers for Weapons frontend.
 * Handles global keyboard shortcuts, navigation safeguards, and
 * restores focus context when returning from create -> sheet flows.
 */
(function initWeaponsFrames() {
  if (window.__WeaponsFramesInitialized) return;
  window.__WeaponsFramesInitialized = true;

  const UnsavedGuard = window.UnsavedGuard || {};

  // Eager Ctrl+P handler: registered immediately at script load on `window`
  // with capture phase, so no cell editor, modal, or input focus can
  // preempt it — even after the user has been making changes.
  const eagerCtrlPHandler = (event) => {
    try {
      const isCtrlMod = event.ctrlKey || event.metaKey;
      if (!isCtrlMod) return;
      // Detect Ctrl+P by physical key, not character — so Arabic/other
      // non-Latin keyboard layouts (where the P key types 'ح', etc.) still trigger.
      const isPKey = event.code === 'KeyP'
        || event.keyCode === 80
        || event.which === 80
        || event.key === 'p' || event.key === 'P';
      if (!isPKey) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

      const body = document.body;
      if (body && body.classList.contains('print-page')) {
        try {
          let banner = document.getElementById('excelOpenBanner');
          if (!banner) {
            banner = document.createElement('div');
            banner.id = 'excelOpenBanner';
            banner.textContent = 'يتم فتح ال Excel';
            banner.style.cssText = 'position:sticky;top:0;z-index:9999;padding:10px 14px;background:#1b9c04;color:#fff;text-align:center;font-weight:700;font-family:inherit;';
            document.body.prepend(banner);
            setTimeout(() => { try { banner.remove(); } catch (_) {} }, 3000);
          }
        } catch (_) {}
        const excelBtn = document.getElementById('btnOpenExcel');
        if (excelBtn) excelBtn.click();
        else if (typeof window.openExcelFiltered === 'function') window.openExcelFiltered();
        return;
      }

      const printBtn = document.getElementById('btnPrintBrowser');
      if (printBtn) printBtn.click();
      else if (typeof window.printFilteredBrowser === 'function') window.printFilteredBrowser();
    } catch (_) {}
  };
  window.addEventListener('keydown', eagerCtrlPHandler, { capture: true });
  document.addEventListener('keydown', eagerCtrlPHandler, { capture: true });

  document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    if (!body) return;

    if (body.classList.contains('print-page')) {
      try { UnsavedGuard.disable?.(); } catch (_) {}
    }

    try { window.addEventListener('beforeunload', UnsavedGuard.beforeUnloadHandler); } catch (_) {}

    const createWeaponBtn = document.getElementById('openCreateWeaponModalBtn');
    if (createWeaponBtn) {
      createWeaponBtn.addEventListener('click', async (ev) => {
        try { ev.preventDefault(); ev.stopImmediatePropagation(); } catch (_) {}
        await requestCreateFormOpen({ restoreDraft: false });
      }, { capture: true });
    }

    handleSheetFocusNavigation();
  });

  ensureGlobalDateHelpers();

  function handleSheetFocusNavigation(attempt = 0) {
    const body = document.body;
    if (!body || !location.pathname.toLowerCase().includes('sheet.html')) return;

    let rawFocus = null;
    try { rawFocus = localStorage.getItem('weaponsSheetFocus'); } catch (_) {}
    if (!rawFocus) return;

    // Consume the stored focus request immediately so it only ever applies once —
    // otherwise every future reload of this page (even after a hard refresh or
    // server restart) would keep re-forcing the same name/license into the filters.
    try { localStorage.removeItem('weaponsSheetFocus'); } catch (_) {}

    let focusPayload = null;
    try { focusPayload = JSON.parse(rawFocus); } catch (_) { focusPayload = null; }
    if (!focusPayload || typeof focusPayload !== 'object') return;
    applySheetFocusPayload(focusPayload, { showReturnButton: true }, attempt);
  }

  window.focusWeaponsSheetFilters = function focusWeaponsSheetFilters(payload, options = {}) {
    applySheetFocusPayload(payload, options, 0);
  };

  async function requestCreateFormOpen(options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    if (typeof window.requestOpenWeaponsCreateModal === 'function') {
      const opened = await window.requestOpenWeaponsCreateModal({
        restoreDraft: !!opts.restoreDraft,
        requireCleanSheet: !Object.prototype.hasOwnProperty.call(opts, 'requireCleanSheet') || !!opts.requireCleanSheet
      });
      if (opened) return true;
      if (opened === false) return false;
    }
    try {
      if (typeof window.showToast === 'function') {
        window.showToast('تعذر فتح نافذة الإدراج الآن.', 'error');
      }
    } catch (_) {}
    return false;
  }

  function applySheetFocusPayload(payload, options = {}, attempt = 0) {
    const body = document.body;
    if (!body || !location.pathname.toLowerCase().includes('sheet.html')) return;
    const filterInput = document.getElementById('filterInput');
    const licenseInput = document.getElementById('licenseNumberFilter');
    if (!filterInput || !licenseInput) {
      if (attempt < 20) {
        setTimeout(() => applySheetFocusPayload(payload, options, attempt + 1), 150);
      }
      return;
    }

    const safePayload = payload && typeof payload === 'object' ? payload : {};
    const { name, license } = safePayload;
    if (typeof name === 'string') filterInput.value = name;
    if (typeof license === 'string') licenseInput.value = license;

    const applyFilters = window.applyFilter || window.applyAllFilters;
    if (typeof applyFilters !== 'function') {
      if (attempt < 20) {
        setTimeout(() => applySheetFocusPayload(payload, options, attempt + 1), 150);
      }
      return;
    }

    try { applyFilters(); } catch (_) {}
    ensureReturnToCreateButton(!!options.showReturnButton);
  }

  function ensureReturnToCreateButton(shouldShow) {
    const actionsContainer = document.querySelector('.table-actions-inline');
    if (!actionsContainer) return;
    let returnBtn = document.getElementById('returnToCreateBtn');
    if (!shouldShow) {
      try { returnBtn?.remove(); } catch (_) {}
      return;
    }

    if (!returnBtn) {
      returnBtn = document.createElement('button');
      returnBtn.id = 'returnToCreateBtn';
      returnBtn.textContent = 'استكمال الإدراج';
      returnBtn.style.background = '#f49a1d';
      returnBtn.style.color = '#fff';
      returnBtn.style.border = 'none';
      returnBtn.style.borderRadius = '8px';
      returnBtn.style.padding = '8px 14px';
      returnBtn.style.cursor = 'pointer';
      returnBtn.style.fontWeight = '600';
      returnBtn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        try { localStorage.setItem('weaponsCreateRestoreOnce', String(Date.now())); } catch (_) {}
        const opened = await requestCreateFormOpen({ restoreDraft: true });
        if (!opened) return;
        try { localStorage.removeItem('weaponsSheetFocus'); } catch (_) {}
        try { returnBtn.remove(); } catch (_) {}
      });
      actionsContainer.prepend(returnBtn);
    }
  }

  function ensureGlobalDateHelpers() {
    try {
      if (typeof window._maybeFormatDate === 'function' && typeof window._parseDateSmart === 'function') return;
    } catch (_) {}

    const toArabicDigits = ensureArabicDigitHelper();

    function toLatinDigits(s) {
      return String(s)
        .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
        .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06F0));
    }
    function pad2(n) { n = Number(n) || 0; return (n < 10 ? '0' : '') + n; }
    function formatDDMMYYYY(date) {
      const d = date.getDate();
      const m = date.getMonth() + 1;
      const y = date.getFullYear();
      return pad2(d) + '/' + pad2(m) + '/' + y;
    }
    function formatYYYYMMDD(date) {
      const d = date.getDate();
      const m = date.getMonth() + 1;
      const y = date.getFullYear();
      return y + '/' + pad2(m) + '/' + pad2(d);
    }
    function excelSerialToDate(n) {
      const num = Number(n);
      if (!isFinite(num)) return null;
      const days = num > 59 ? num - 1 : num;
      const base = new Date(1899, 11, 30);
      const ms = base.getTime() + days * 86400000;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    function seededRand01(str) {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      h ^= h << 13; h >>>= 0;
      h ^= h >> 17; h >>>= 0;
      h ^= h << 5; h >>>= 0;
      return (h >>> 0) / 0xFFFFFFFF;
    }
    function yearToDate(yearStr) {
      const y = Number(yearStr);
      if (!isFinite(y) || y < 1900 || y > 2099) return null;
      const r1 = seededRand01(String(yearStr) + '|m');
      const r2 = seededRand01(String(yearStr) + '|d');
      const month = Math.max(1, Math.min(12, Math.floor(r1 * 12) + 1));
      let maxDay = 28;
      if ([1, 3, 5, 7, 8, 10, 12].includes(month)) maxDay = 31;
      else if ([4, 6, 9, 11].includes(month)) maxDay = 30;
      const day = Math.max(1, Math.min(maxDay, Math.floor(r2 * maxDay) + 1));
      const d = new Date(y, month - 1, day);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    function parseDateSmart(val) {
      if (val == null) return null;
      const raw = toLatinDigits(String(val).trim());
      if (!raw) return null;

      if (/^\d{4,6}$/.test(raw)) {
        const n = parseInt(raw, 10);
        if (n >= 20000 && n <= 60000) {
          const d = excelSerialToDate(n);
          if (d) return d;
        }
      }

      if (/^\d{4}$/.test(raw)) {
        const y = parseInt(raw, 10);
        if (y >= 1900 && y <= 2099) {
          const d = yearToDate(raw);
          if (d) return d;
        }
      }

      let match = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/);
      if (match) {
        const dd = parseInt(match[1], 10);
        const MM = parseInt(match[2], 10);
        const yy = match[3];
        const yyyy = yy.length === 2 ? 2000 + parseInt(yy, 10) : parseInt(yy, 10);
        const d = new Date(yyyy, MM - 1, dd);
        if (d && d.getFullYear() === yyyy && d.getMonth() === MM - 1 && d.getDate() === dd) return d;
      }

      match = raw.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/);
      if (match) {
        const yyyy = parseInt(match[1], 10);
        const MM = parseInt(match[2], 10);
        const dd = parseInt(match[3], 10);
        const d = new Date(yyyy, MM - 1, dd);
        if (d && d.getFullYear() === yyyy && d.getMonth() === MM - 1 && d.getDate() === dd) return d;
      }

      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return d;
      return null;
    }
    function maybeFormatDate(header, value) {
      const headerStr = String(header || '');
      const cellValue = value == null ? '' : value;
      if (headerStr === '\u0631\u0642\u0645 \u0627\u0644\u0627\u064a\u062f\u0627\u0639') return String(cellValue);
      const isPrintPage = Boolean(document.body?.classList?.contains('print-page'));
      const headerLooksDate = /\u062a\u0627\u0631\u064a\u062e|date/i.test(headerStr);
      if (headerLooksDate) {
        const parsed = parseDateSmart(cellValue);
        if (parsed) {
          if (headerStr === '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0627\u064a\u062f\u0627\u0639' || headerStr === '\u062a\u0627\u0631\u064a\u062e \u0635\u062f\u0648\u0631 \u0627\u0644\u0642\u0631\u0627\u0631') {
            return toArabicDigits(formatYYYYMMDD(parsed));
          }
          return formatDDMMYYYY(parsed);
        }
        return isPrintPage ? '' : String(cellValue);
      }
      return String(cellValue);
    }

    try {
      window._maybeFormatDate = maybeFormatDate;
      window._parseDateSmart = parseDateSmart;
    } catch (_) {}
  }

  function ensureArabicDigitHelper() {
    if (typeof window.toArabicDigits === 'function') {
      return window.toArabicDigits;
    }
    const helper = (s) => String(s).replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)));
    try { window.toArabicDigits = helper; } catch (_) {}
    return helper;
  }
})();
