/***********************
 * Unsaved State Guard
 ***********************/
(() => {
  const UnsavedGuard = (() => {
    const MESSAGE = 'هناك تعديلات لم يتم حفظها. احفظ التعديلات أولاً أو تابع للمغادرة دون حفظ.';
    let hasUnsavedChanges = false;
    let enabled = true;
    let dialogElement = null;
    let stylesInjected = false;

    const shouldWarn = () => {
      if (!enabled) return false;
      try {
        if (document?.body?.classList?.contains('print-page')) return false;
      } catch (_) {}
      return hasUnsavedChanges;
    };

    const markDirty = () => {
      if (!enabled) return;
      hasUnsavedChanges = true;
      try {
        document.body.classList.add('weapons-unsaved');
      } catch (_) {}
    };

    const clearDirty = () => {
      hasUnsavedChanges = false;
      try {
        document.body.classList.remove('weapons-unsaved');
      } catch (_) {}
    };

    const ensureStyles = () => {
      if (stylesInjected) return;
      try {
        const style = document.createElement('style');
        style.id = 'weapons-unsaved-exit-style';
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
        stylesInjected = true;
      } catch (_) {}
    };

    const ensureDialog = () => {
      if (dialogElement && document.body.contains(dialogElement)) return dialogElement;
      ensureStyles();
      const overlay = document.createElement('div');
      overlay.id = 'weaponsUnsavedDialog';
      overlay.className = 'unsaved-exit-overlay';
      overlay.tabIndex = -1;
      overlay.innerHTML = `
      <div class="unsaved-exit-modal" role="dialog" aria-modal="true" aria-labelledby="weapons-unsaved-title">
        <h2 id="weapons-unsaved-title">تأكيد الخروج</h2>
        <p class="unsaved-exit-message"></p>
        <div class="unsaved-exit-error" role="alert"></div>
        <div class="unsaved-exit-actions" dir="rtl">
          <button type="button" class="unsaved-exit-btn primary" data-action="save">💾 خروج مع الحفظ</button>
          <button type="button" class="unsaved-exit-btn secondary" data-action="discard">🚪 خروج من غير حفظ</button>
          <button type="button" class="unsaved-exit-btn ghost" data-action="stay">↩️ رجوع</button>
        </div>
      </div>`;
      document.body.appendChild(overlay);
      dialogElement = overlay;
      return overlay;
    };

    const showDialog = ({ message = MESSAGE, onSave, checkDirty } = {}) => {
      const overlay = ensureDialog();
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
    };

    const tryConfirmNavigation = async (options = {}) => {
      if (!shouldWarn()) return true;
      const { message = MESSAGE, onSave } = options || {};
      const result = await showDialog({
        message,
        onSave: typeof onSave === 'function' ? onSave : undefined,
        checkDirty: () => shouldWarn(),
      });
      if (result === 'save' || result === 'discard') {
        clearDirty();
        return true;
      }
      return false;
    };

    const beforeUnloadHandler = (event) => {
      if (!shouldWarn()) return;
      event.preventDefault();
      event.returnValue = MESSAGE;
    };

    return {
      MESSAGE,
      shouldWarn,
      markDirty,
      clearDirty,
      showDialog,
      tryConfirmNavigation,
      beforeUnloadHandler,
      disable() {
        enabled = false;
        clearDirty();
      },
      enable() { enabled = true; }
    };
  })();

  function snapshotViewport() {
    try {
      const container = document.getElementById('csvPreviewContainer');
      return {
        windowY: typeof window.scrollY === 'number' ? window.scrollY : window.pageYOffset || 0,
        containerY: container ? container.scrollTop : null
      };
    } catch (_) {
      return null;
    }
  }

  function restoreViewport(state) {
    if (!state) return;
    try {
      if (typeof state.windowY === 'number') {
        window.scrollTo({ top: state.windowY, behavior: 'auto' });
      }
      if (typeof state.containerY === 'number') {
        const container = document.getElementById('csvPreviewContainer');
        if (container) container.scrollTop = state.containerY;
      }
    } catch (_) {}
  }

  window.UnsavedGuard = UnsavedGuard;
  window.snapshotViewport = snapshotViewport;
  window.restoreViewport = restoreViewport;
})();
