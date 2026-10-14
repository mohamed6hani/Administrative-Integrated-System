(function initActivityOverlaysLoader() {
  'use strict';

  if (window.__activityOverlaysLoaderInitialized) return;
  window.__activityOverlaysLoaderInitialized = true;

  const APP_PATH_RE = /^\/(?:weapons|renewal|report|accept|request|seized|company)(?:\/|$)/i;
  const READY_EVENTS = ['activity:table-rendered', 'activity:overlays-ready', 'weapons:table-rendered'];
  const TRACKABLE_ROW_SELECTOR = [
    '[data-activity-row-id]',
    '.record-item',
    '.directorate-row',
    '#tbody tr',
    '#resultsBody tr',
    '#deletedRecordsBody tr',
    '#gridBody tr',
    '#harzTable tbody tr',
    '#filesTableBody tr',
    '#csvPreview tbody tr',
    '#previewTable tbody tr',
    'tr[data-id]',
    'tr[data-unique-id]',
    'tr[data-license]',
    'tr[data-index]',
    'tr[data-file-id]'
  ].join(', ');

  if (!APP_PATH_RE.test(window.location.pathname || '/')) return;

  let loadScheduled = false;
  let observer = null;
  let observerStopHandle = 0;

  function resolveAssetUrl(src) {
    if (typeof window.resolvePlatformAsset === 'function') {
      return window.resolvePlatformAsset(src);
    }
    return src;
  }

  function hasTrackableRows() {
    return !!document.querySelector(TRACKABLE_ROW_SELECTOR);
  }

  function stopWatching() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (observerStopHandle) {
      window.clearTimeout(observerStopHandle);
      observerStopHandle = 0;
    }
    READY_EVENTS.forEach((eventName) => {
      document.removeEventListener(eventName, scheduleLoadFromReadySignal, true);
    });
    document.removeEventListener('focusin', scheduleLoadFromInteraction, true);
    document.removeEventListener('pointerdown', scheduleLoadFromInteraction, true);
  }

  function loadFullTracker() {
    if (window.__activityTrackerInitialized) return;
    stopWatching();
    try {
      if (typeof window.__activityCoreStop === 'function') {
        window.__activityCoreStop();
      }
    } catch (_) {}

    const script = document.createElement('script');
    script.src = resolveAssetUrl('/activity-tracker.js');
    script.defer = true;
    script.dataset.activityOverlay = 'true';
    script.onerror = () => {
      if (window.console && typeof window.console.warn === 'function') {
        console.warn('Activity overlays failed to load.');
      }
    };
    document.head.appendChild(script);
  }

  function scheduleLoad() {
    if (loadScheduled || window.__activityTrackerInitialized) return;
    loadScheduled = true;
    const run = () => {
      if (document.visibilityState === 'hidden') {
        loadScheduled = false;
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') scheduleLoad();
        }, { once: true });
        return;
      }
      loadFullTracker();
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 3500 });
      return;
    }
    window.setTimeout(run, 900);
  }

  function scheduleLoadFromReadySignal() {
    if (hasTrackableRows()) scheduleLoad();
  }

  function scheduleLoadFromInteraction(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !target.closest(TRACKABLE_ROW_SELECTOR)) return;
    scheduleLoad();
  }

  function watchForTrackableRows() {
    if (hasTrackableRows()) {
      scheduleLoad();
      return;
    }

    READY_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, scheduleLoadFromReadySignal, true);
    });
    document.addEventListener('focusin', scheduleLoadFromInteraction, true);
    document.addEventListener('pointerdown', scheduleLoadFromInteraction, true);

    if ('MutationObserver' in window && document.body) {
      observer = new MutationObserver(() => {
        if (hasTrackableRows()) scheduleLoad();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      observerStopHandle = window.setTimeout(stopWatching, 30000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.requestAnimationFrame(watchForTrackableRows);
    }, { once: true });
  } else {
    window.requestAnimationFrame(watchForTrackableRows);
  }
})();
