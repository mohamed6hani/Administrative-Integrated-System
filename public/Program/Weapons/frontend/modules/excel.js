/**
 * Print page + Excel export controller.
 * Extracted from the legacy monolithic script so print.html can stay lean.
 */
(function initWeaponsExcel() {
  if (window.__WeaponsExcelInitialized) return;
  window.__WeaponsExcelInitialized = true;

  const buildWeaponsApiUrl = typeof window.buildWeaponsApiUrl === 'function'
    ? window.buildWeaponsApiUrl
    : (path) => path;

  function ensureWeaponsWeaponTextUtilsModule() {
    if (window.WeaponsWeaponTextUtils && typeof window.WeaponsWeaponTextUtils.createApi === 'function') {
      return Promise.resolve(window.WeaponsWeaponTextUtils);
    }
    if (window.__WeaponsWeaponTextUtilsModulePromise) {
      return window.__WeaponsWeaponTextUtilsModulePromise;
    }

    window.__WeaponsWeaponTextUtilsModulePromise = new Promise((resolve, reject) => {
      const baseUrl = (document.currentScript && document.currentScript.src)
        ? document.currentScript.src
        : window.location.href;
      const scriptUrl = new URL('weapon-text-utils.js', baseUrl).href;
      const existing = document.querySelector(`script[src="${scriptUrl}"]`);

      if (existing) {
        existing.addEventListener('load', () => resolve(window.WeaponsWeaponTextUtils), { once: true });
        existing.addEventListener('error', () => reject(new Error('Failed to load Weapons weapon text utils module')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = false;
      script.addEventListener('load', () => resolve(window.WeaponsWeaponTextUtils), { once: true });
      script.addEventListener('error', () => reject(new Error('Failed to load Weapons weapon text utils module')), { once: true });
      (document.head || document.documentElement || document.body).appendChild(script);
    });

    return window.__WeaponsWeaponTextUtilsModulePromise;
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.body) return;
    const isDeclaredPrintPage = document.body.classList.contains('print-page');
    const hasPrintMarkers = Boolean(
      document.getElementById('previewTable') ||
      document.getElementById('btnOpenExcel') ||
      document.getElementById('btnBrowserPrint') ||
      /print/i.test(location.pathname || '')
    );
    if (!isDeclaredPrintPage && !hasPrintMarkers) return;

    // Preview paging state (100 per page by default)
    const pvState = {
      headers: [],
      rows: [],
  serials: [],
  top: [],
  bottom: [],
      page: 1,
      size: 100,
      rowMerge: null,
      groupedRows: null
    };
    // Active print preset cache for consistent application across renders
    let pvPreset = null;
    const EXPORT_META_STORAGE_KEY = 'weaponsExportMeta';
    let currentExportMeta = null;
    let weaponTextUtils = null;
    const SHARED_REFERENCE_DATA = window.AdministrativeSharedReferenceData || null;
    const sectorStations = window.WeaponsData?.sectorStations || window.sectorStations || {};

    function getWeaponTextUtils() {
      if (weaponTextUtils) return weaponTextUtils;
      const api = window.WeaponsWeaponTextUtils;
      if (!api || typeof api.createApi !== 'function') {
        throw new Error('Weapons weapon text utils module is not loaded');
      }
      weaponTextUtils = api.createApi({
        toLatinDigits,
        toArabicDigits: typeof window.toArabicDigits === 'function' ? window.toArabicDigits : undefined
      });
      return weaponTextUtils;
    }

    function detectStatusCodeFromLine(line) {
      return getWeaponTextUtils().detectWithdrawalStatusCode(line);
    }

    function countWeaponsForGroup(group, row, piecesColIdx) {
      return getWeaponTextUtils().countWeaponsForGroup(group, row, piecesColIdx);
    }

    function readStoredExportMeta() {
      try {
        const raw = localStorage.getItem(EXPORT_META_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : null;
      } catch (_) {
        return null;
      }
    }

    function escapeFooterHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function normalizeArabicStationSource(value) {
      const raw = String(value ?? '').trim();
      if (!raw) return '';
      if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.normalizeArabicForMatch === 'function') {
        return SHARED_REFERENCE_DATA.normalizeArabicForMatch(raw);
      }
      return toLatinDigits(raw)
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

    function resolveStationFooterDisplayName(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.resolveStationName === 'function') {
        const resolved = SHARED_REFERENCE_DATA.resolveStationName(raw);
        const resolvedText = String(resolved || '').trim();
        if (resolvedText) return resolvedText;
      }
      const targetKey = buildStationLooseMatchKey(raw);
      if (!targetKey) return raw;
      const seen = new Set();
      for (const list of Object.values(sectorStations)) {
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

    function normalizeStationFooterName(value) {
      const resolved = resolveStationFooterDisplayName(value);
      return resolved || 'بدون قسم';
    }

    function buildStationFooterColumns(statusValue) {
      const columns = [
        { key: 'station', label: 'القسم' },
        { key: 'totalRecords', label: 'إجمالي السجلات' },
        { key: 'totalWeapons', label: 'إجمالي عدد الأسلحة' }
      ];
      if (statusValue === 'got') {
        columns.push({ key: 'withdrawnWeapons', label: 'إجمالي الأسلحة المسحوبة' });
      } else if (statusValue === 'not') {
        columns.push({ key: 'notWithdrawnWeapons', label: 'إجمالي الأسلحة الغير مسحوبة' });
      } else {
        columns.push({ key: 'withdrawnWeapons', label: 'إجمالي الأسلحة المسحوبة' });
        columns.push({ key: 'notWithdrawnWeapons', label: 'إجمالي الأسلحة الغير مسحوبة' });
      }
      return columns;
    }

    function buildStationFooterColumnWidths(columns) {
      const count = Array.isArray(columns) ? columns.length : 0;
      if (count === 5) return ['28%', '12%', '22%', '19%', '19%'];
      if (count === 4) return ['32%', '14%', '27%', '27%'];
      if (count === 3) return ['40%', '20%', '40%'];
      return new Array(Math.max(0, count)).fill((count > 0 ? (100 / count) : 100) + '%');
    }

    function appendFooterTotals(target, weaponCount, statusText, statusValue) {
      const safeTarget = target || { totalWeapons: 0, withdrawnWeapons: 0, notWithdrawnWeapons: 0 };
      safeTarget.totalWeapons += weaponCount;

      if (statusValue === 'got') {
        safeTarget.withdrawnWeapons += weaponCount;
        return safeTarget;
      }
      if (statusValue === 'not') {
        safeTarget.notWithdrawnWeapons += weaponCount;
        return safeTarget;
      }

      const codes = String(statusText || '')
        .split(/\r?\n/)
        .map((line) => detectStatusCodeFromLine(line))
        .filter((code) => code !== 'unknown');
      if (!codes.length) {
        safeTarget.notWithdrawnWeapons += weaponCount;
        return safeTarget;
      }

      const gotCount = codes.filter((code) => code === 'got').length;
      const partialCount = codes.filter((code) => code === 'partial').length;
      const weightedGot = gotCount + (partialCount * 0.5);
      const ratio = weightedGot <= 0 ? 0 : Math.min(1, weightedGot / codes.length);
      const withdrawnPart = Math.round(weaponCount * ratio);
      safeTarget.withdrawnWeapons += withdrawnPart;
      safeTarget.notWithdrawnWeapons += Math.max(0, weaponCount - withdrawnPart);
      return safeTarget;
    }

    function computeFooterTotalsFromGroups(groups, rows, statusValue) {
      const totals = { totalWeapons: 0, withdrawnWeapons: 0, notWithdrawnWeapons: 0 };
      for (const group of groups) {
        const row = rows[group.startIndex] || [];
        const weaponCount = countWeaponsForGroup(group, row);
        appendFooterTotals(totals, weaponCount, group?.statusText || '', statusValue);
      }
      return totals;
    }

    function normalizeOverallSummaryLabel(value) {
      const trimmed = String(value || '').trim();
      return trimmed || 'الإجمالي العام';
    }

    function sanitizeStationFooterSummaries(value) {
      if (!Array.isArray(value)) return [];
      return value
        .map((item) => ({
          station: normalizeStationFooterName(item?.station),
          totalRecords: Math.max(0, Number(item?.totalRecords) || 0),
          totalWeapons: Math.max(0, Number(item?.totalWeapons) || 0),
          withdrawnWeapons: Math.max(0, Number(item?.withdrawnWeapons) || 0),
          notWithdrawnWeapons: Math.max(0, Number(item?.notWithdrawnWeapons) || 0)
        }))
        .sort((left, right) => left.station.localeCompare(right.station, 'ar', { sensitivity: 'base' }));
    }

    function computeStationFooterSummariesFromGroups(groups, rows, headers, statusValue) {
      const stationIdx = headers.findIndex((header) => {
        const name = String(header || '').trim();
        return name === 'القسم' || name === 'القسم التابع';
      });
      if (stationIdx === -1) return [];

      const buckets = new Map();
      for (const group of groups) {
        const row = rows[group.startIndex] || [];
        const station = normalizeStationFooterName(row[stationIdx]);
        if (!buckets.has(station)) {
          buckets.set(station, {
            station,
            totalRecords: 0,
            totalWeapons: 0,
            withdrawnWeapons: 0,
            notWithdrawnWeapons: 0
          });
        }
        const bucket = buckets.get(station);
        bucket.totalRecords += 1;
        const weaponCount = countWeaponsForGroup(group, row);
        appendFooterTotals(bucket, weaponCount, group?.statusText || '', statusValue);
      }

      return Array.from(buckets.values()).sort((left, right) => left.station.localeCompare(right.station, 'ar', { sensitivity: 'base' }));
    }

    function buildFooterSummaryState(groups, rows, headers) {
      const selectedStatusValue = (currentExportMeta && typeof currentExportMeta.statusValue === 'string')
        ? currentExportMeta.statusValue
        : 'both';
      const metaTotals = (currentExportMeta && typeof currentExportMeta.totals === 'object') ? currentExportMeta.totals : null;
      const computedTotals = computeFooterTotalsFromGroups(groups, rows, selectedStatusValue);
      const overallTotals = metaTotals
        ? {
            totalRecords: Math.max(0, Number(metaTotals.records) || groups.length),
            totalWeapons: Math.max(0, Number(metaTotals.weaponsTotal) || 0),
            withdrawnWeapons: Math.max(0, Number(metaTotals.withdrawnWeapons) || 0),
            notWithdrawnWeapons: Math.max(0, Number(metaTotals.notWithdrawnWeapons) || 0)
          }
        : {
            totalRecords: groups.length,
            totalWeapons: computedTotals.totalWeapons,
            withdrawnWeapons: computedTotals.withdrawnWeapons,
            notWithdrawnWeapons: computedTotals.notWithdrawnWeapons
          };
      const overallSummaryLabel = normalizeOverallSummaryLabel(currentExportMeta?.overallSummaryLabel);
      const stationSummariesFromMeta = sanitizeStationFooterSummaries(currentExportMeta?.stationFooterSummaries);
      const usePerStation = currentExportMeta?.hasSelectedStation === false;
      const stationSummaries = usePerStation
        ? (stationSummariesFromMeta.length ? stationSummariesFromMeta : computeStationFooterSummariesFromGroups(groups, rows, headers, selectedStatusValue))
        : [];

      if (usePerStation && stationSummaries.length) {
        return {
          usePerStation: true,
          stationSummaries,
          selectedStatusValue,
          overallTotals,
          overallSummaryLabel,
          footerLines: []
        };
      }

      const footerLines = ['الإجمالي (السجلات): ' + groups.length, 'إجمالي عدد الأسلحة: ' + overallTotals.totalWeapons];
      if (selectedStatusValue === 'got') {
        footerLines.push('إجمالي الأسلحة المسحوبة: ' + overallTotals.withdrawnWeapons);
      } else if (selectedStatusValue === 'not') {
        footerLines.push('إجمالي الأسلحة الغير مسحوبة: ' + overallTotals.notWithdrawnWeapons);
      } else {
        footerLines.push('إجمالي الأسلحة المسحوبة: ' + overallTotals.withdrawnWeapons);
        footerLines.push('إجمالي الأسلحة الغير مسحوبة: ' + overallTotals.notWithdrawnWeapons);
      }
      return {
        usePerStation: false,
        stationSummaries: [],
        selectedStatusValue,
        overallTotals,
        overallSummaryLabel,
        footerLines
      };
    }

    function buildStationSummaryTableHtml(stationSummaries, statusValue, overallTotals, overallSummaryLabel) {
      const summaries = sanitizeStationFooterSummaries(stationSummaries);
      if (!summaries.length) return '';
      const columns = buildStationFooterColumns(statusValue);
      const widths = buildStationFooterColumnWidths(columns);
      const safeTotals = {
        totalRecords: Math.max(0, Number(overallTotals?.totalRecords) || 0),
        totalWeapons: Math.max(0, Number(overallTotals?.totalWeapons) || 0),
        withdrawnWeapons: Math.max(0, Number(overallTotals?.withdrawnWeapons) || 0),
        notWithdrawnWeapons: Math.max(0, Number(overallTotals?.notWithdrawnWeapons) || 0)
      };
      const colgroupHtml = widths
        .map((width) => '<col style="width:' + escapeFooterHtml(width) + ';">')
        .join('');
      const headerHtml = columns
        .map((column) => '<th style="border:1px solid #000;padding:8px 10px;background:#111;color:#fff;text-align:center;vertical-align:middle;white-space:normal;word-break:break-word;overflow-wrap:anywhere;">' + escapeFooterHtml(column.label) + '</th>')
        .join('');
      const bodyHtml = summaries
        .map((row) => {
          return '<tr>' + columns.map((column) => {
            const rawValue = column.key === 'station' ? row.station : row[column.key];
            const text = column.key === 'station' ? normalizeStationFooterName(rawValue) : String(Math.max(0, Number(rawValue) || 0));
            return '<td style="border:1px solid #000;padding:8px 10px;text-align:center;vertical-align:middle;font-weight:700;white-space:normal;word-break:break-word;overflow-wrap:anywhere;">' + escapeFooterHtml(text) + '</td>';
          }).join('') + '</tr>';
        })
        .join('');
      const totalRowHtml = '<tr>' + columns.map((column) => {
        const rawValue = column.key === 'station' ? normalizeOverallSummaryLabel(overallSummaryLabel) : safeTotals[column.key];
        const text = column.key === 'station' ? normalizeOverallSummaryLabel(rawValue) : String(Math.max(0, Number(rawValue) || 0));
        return '<td style="border:2px solid #000;padding:8px 10px;text-align:center;vertical-align:middle;font-weight:700;background:#f3f4f6;white-space:normal;word-break:break-word;overflow-wrap:anywhere;">' + escapeFooterHtml(text) + '</td>';
      }).join('') + '</tr>';
      return '' +
        '<div style="margin-top:8px;">' +
          '<div style="padding:6px 8px;border:2px solid #000;border-bottom:none;text-align:center;font-weight:700;background:#fff;">ملخص حسب القسم</div>' +
          '<table style="width:100%;border-collapse:collapse;table-layout:fixed;direction:rtl;">' +
            '<colgroup>' + colgroupHtml + '</colgroup>' +
            '<thead><tr>' + headerHtml + '</tr></thead>' +
            '<tbody>' + bodyHtml + totalRowHtml + '</tbody>' +
          '</table>' +
        '</div>';
    }

    // ===== Excel preset helpers (based on user's guide) =====
    function defaultExcelPreset() {
      return {
        rtl: true,
        tableStyle: 'TableStyleMedium15',
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        font: { name: 'Calibri', size: 17 }
      };
    }

    function getExcelPreset() {
      try {
        const local = JSON.parse(localStorage.getItem('excelPreset') || '{}');
        return { ...defaultExcelPreset(), ...(local || {}) };
      } catch (_) {
        return defaultExcelPreset();
      }
    }

    function saveExcelPreset(preset) {
      const merged = { ...defaultExcelPreset(), ...(preset || {}) };
      localStorage.setItem('excelPreset', JSON.stringify(merged));
      fetch(buildWeaponsApiUrl('/api/print-preset'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged)
      }).catch(() => {});
    }

    // Measure approximate pixels-per-character for the active font/size to convert px->Excel char units more accurately
    function measurePxPerChar() {
      try {
        const tbl = document.getElementById('previewTable');
        const sample = document.createElement('span');
        const COUNT = 40;
        const text = '0'.repeat(COUNT);
        sample.textContent = text;
        sample.style.visibility = 'hidden';
        sample.style.position = 'absolute';
        sample.style.whiteSpace = 'nowrap';
        const fontCtrl = document.getElementById('fontNameControl');
        const sizeCtrl = document.getElementById('fontSizeControl');
        const fontFamily = fontCtrl?.value || 'Calibri';
        const fontSize = parseInt(sizeCtrl?.value || '17', 10) || 17;
        sample.style.fontFamily = fontFamily;
        sample.style.fontSize = fontSize + 'px';
        (tbl || document.body).appendChild(sample);
        const w = sample.offsetWidth || 0;
        sample.remove();
        let pxc = w > 0 ? (w / COUNT) : 0;
        if (!pxc || !isFinite(pxc)) pxc = 8.5;
        pxc = Math.max(6, Math.min(10, pxc));
        return pxc;
      } catch (_) {
        return 8.5;
      }
    }

    function readVisibleColumnWidthsChars() {
      const ths = document.querySelectorAll('#csvPreview thead th, #previewTable thead th');
      if (!ths || !ths.length) return null;
      const pxc = measurePxPerChar();
      return Array.from(ths).map((th) => {
        const px = th.offsetWidth || 0;
        const ch = Math.max(6, Math.min(120, Math.round(px / pxc)));
        return ch;
      });
    }

    async function loadServerPreset() {
      try {
        const r = await fetch(buildWeaponsApiUrl('/api/print-preset'), { cache: 'no-store' });
        if (!r.ok) throw 0;
        const j = await r.json();
        return j.preset || {};
      } catch (_) {
        return {};
      }
    }

    function loadLocalPreset() {
      try {
        return JSON.parse(localStorage.getItem('printPreset') || '{}');
      } catch (_) {
        return {};
      }
    }

    function saveLocalPreset(preset) {
      localStorage.setItem('printPreset', JSON.stringify(preset || {}));
    }

    async function saveServerPreset(preset) {
      try {
        await fetch(buildWeaponsApiUrl('/api/print-preset'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(preset || {})
        });
      } catch (_) {}
    }

    function applyPresetDefaults(preset) {
      const p = preset || {};
      p.rtl = typeof p.rtl === 'boolean' ? p.rtl : true;
      p.alignment = p.alignment || {};
      if (typeof p.alignment.wrapText !== 'boolean') p.alignment.wrapText = true;
      if (!p.alignment.vertical) p.alignment.vertical = 'middle';
      if (!p.alignment.horizontal) p.alignment.horizontal = 'right';
      p.tableStyle = p.tableStyle || 'TableStyleMedium15';
      const fontCtrl = document.getElementById('fontNameControl');
      p.font = p.font || { name: fontCtrl?.value || 'Calibri', size: 17 };
      return p;
    }

    function gatherPresetFromForm() {
      const rtl = document.getElementById('rtl')?.checked ?? true;
      const wrapText = document.getElementById('wrap')?.checked ?? true;
      const horizontal = document.getElementById('hAlign')?.value || 'right';
      const vertical = document.getElementById('vAlign')?.value || 'middle';
      const fontNameField = document.getElementById('fontName');
      const fontSizeField = document.getElementById('fontSize');
      const font = {
        name: (fontNameField?.value || 'Calibri').trim(),
        size: parseInt(fontSizeField?.value, 10) || 12
      };
      const tableStyle = document.getElementById('tableStyle')?.value || 'TableStyleMedium15';
      const colInputs = Array.from(document.querySelectorAll('#colWrap input'));
      const columnWidths = colInputs
        .map((input) => parseInt(input.value, 10))
        .map((val) => (isNaN(val) ? undefined : val));
      return { rtl, tableStyle, font, alignment: { horizontal, vertical, wrapText }, columnWidths };
    }

    function setPreviewColWidths(widths) {
      const tbl = document.getElementById('previewTable');
      if (!tbl) return;
      const headCells = Array.from(tbl.querySelectorAll('thead th'));
      const bodyRows = Array.from(tbl.querySelectorAll('tbody tr'));
      const colCount = headCells.length;
      const applied = new Array(colCount);
      const serialDefaultCh = 8;
      if (Array.isArray(widths) && widths.length === colCount) {
        for (let i = 0; i < colCount; i++) applied[i] = widths[i];
      } else if (Array.isArray(widths) && widths.length === colCount - 1) {
        applied[0] = serialDefaultCh;
        for (let i = 1; i < colCount; i++) applied[i] = widths[i - 1];
      }
      headCells.forEach((th, i) => {
        const w = applied[i];
        const px = typeof w === 'number' ? Math.max(40, Math.round(w * 8)) : null;
        th.style.width = th.style.minWidth = th.style.maxWidth = px ? px + 'px' : '';
        th.style.whiteSpace = 'normal';
        th.style.wordBreak = 'break-word';
        th.style.textAlign = 'center';
        th.style.verticalAlign = 'middle';
      });
      bodyRows.forEach((tr) => {
        Array.from(tr.children).forEach((td, i) => {
          const w = applied[i];
          const px = typeof w === 'number' ? Math.max(40, Math.round(w * 8)) : null;
          td.style.width = td.style.minWidth = td.style.maxWidth = px ? px + 'px' : '';
          td.style.whiteSpace = 'normal';
          td.style.wordBreak = 'break-word';
          td.style.textAlign = 'center';
          td.style.verticalAlign = 'middle';
        });
      });
    }

    function makeColumnsResizable(preset) {
      const tbl = document.getElementById('previewTable');
      const colGroup = document.getElementById('previewColGroup');
      const headCells = Array.from(tbl?.querySelectorAll('thead th') || []);
      let widths = preset && Array.isArray(preset.columnWidths) ? preset.columnWidths.slice() : [];
      if (widths.length === headCells.length - 1) widths = [8, ...widths];
      if (widths.length < headCells.length) {
        while (widths.length < headCells.length) widths.push(undefined);
      }
      headCells.forEach((th) => th.querySelectorAll('.col-resizer').forEach((n) => n.remove()));

      function ensureColCount(n) {
        if (!colGroup) return;
        while (colGroup.children.length < n) colGroup.appendChild(document.createElement('col'));
        while (colGroup.children.length > n) colGroup.removeChild(colGroup.lastElementChild);
      }

      ensureColCount(headCells.length);
      if (colGroup) {
        headCells.forEach((th, i) => {
          const px = th.offsetWidth || 0;
          const col = colGroup.children[i];
          if (col && px) {
            col.style.width = px + 'px';
            col.style.maxWidth = px + 'px';
          }
        });
      }

      function attachHandle(th, index, side) {
        th.style.position = 'relative';
        const handle = document.createElement('div');
        handle.className = 'col-resizer';
        const baseCss = 'position:absolute;top:0;bottom:0;width:10px;cursor:col-resize;z-index:5;background:transparent;';
        handle.style.cssText = baseCss + (side === 'right' ? 'right:0;' : 'left:0;');
        th.appendChild(handle);
        let startX = 0;
        let startW = th.offsetWidth;
        const dir = side === 'right' ? 1 : -1;
        const onMove = (ev) => {
          const dx = dir * (ev.clientX - startX);
          const newPx = Math.max(40, startW + dx);
          th.style.width = th.style.minWidth = th.style.maxWidth = newPx + 'px';
          Array.from(tbl.querySelectorAll(`tbody tr td:nth-child(${index + 1})`)).forEach((td) => {
            td.style.width = td.style.minWidth = td.style.maxWidth = newPx + 'px';
          });
          try {
            const col = colGroup && colGroup.children[index];
            if (col) {
              col.style.width = newPx + 'px';
              col.style.maxWidth = newPx + 'px';
            }
          } catch (_) {}
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          const px = th.offsetWidth;
          const pxc = measurePxPerChar();
          const ch = Math.max(6, Math.min(120, Math.round(px / pxc)));
          widths[index] = ch;
          preset.columnWidths = widths.slice();
          saveLocalPreset(preset);
          saveServerPreset(preset);
          try {
            th.style.outline = 'transparent solid 0';
            setTimeout(() => {
              th.style.outline = '';
            }, 0);
          } catch (_) {}
        };
        handle.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          startX = ev.clientX;
          startW = th.offsetWidth;
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
      }

      headCells.forEach((th, i) => {
        attachHandle(th, i, 'right');
        attachHandle(th, i, 'left');
      });
    }

    function readPreviewColWidths() {
      const ths = Array.from(document.querySelectorAll('#previewTable thead th'));
      const pxc = measurePxPerChar();
      return ths.map((th) => {
        const px = th.offsetWidth || 0;
        const ch = Math.max(6, Math.min(120, Math.round(px / pxc)));
        return ch;
      });
    }

    function computePreviewGroups(headers, rows) {
      const ser = new Array(rows.length);
      const top = new Array(rows.length).fill(false);
      const bottom = new Array(rows.length).fill(false);
      const idx = headers.indexOf('القسم') !== -1 ? headers.indexOf('القسم') : headers.indexOf('القسم التابع');
      let prev = null;
      let count = 0;
      for (let i = 0; i < rows.length; i++) {
        const st = idx !== -1 ? rows[i][idx] || '' : '';
        if (i === 0 || st !== prev) {
          count = 1;
          if (i !== 0) top[i] = true;
          prev = st;
        } else {
          count++;
        }
        ser[i] = count;
      }
      for (let i = 0; i < rows.length; i++) {
        const cur = idx !== -1 ? rows[i][idx] || '' : '';
        const nxt = i + 1 < rows.length ? rows[i + 1][idx] || '' : null;
        if (i === rows.length - 1 || cur !== nxt) bottom[i] = true;
      }
      return { ser, top, bottom };
    }

    function normalizeHeaderName(header) {
      return String(header || '').replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '').trim();
    }

    function findHeaderIndexLoose(headers, ...names) {
      if (!Array.isArray(headers) || !headers.length) return -1;
      const normalizedTargets = names
        .map((name) => normalizeHeaderName(name))
        .filter((name) => !!name);
      const targetSet = new Set(normalizedTargets);
      for (let i = 0; i < headers.length; i++) {
        const headerName = normalizeHeaderName(headers[i]);
        if (targetSet.has(headerName)) return i;
      }
      return -1;
    }

    function buildRowSignature(row, headers, skipSet) {
      if (!Array.isArray(row) || !Array.isArray(headers)) return null;
      const parts = [];
      for (let i = 0; i < headers.length; i++) {
        if (skipSet && skipSet.has(i)) continue;
        const cell = row[i];
        parts.push(cell == null ? '' : String(cell));
      }
      return parts.join('\u0001');
    }

    function computeRowMergeState(headers, rows) {
      const weaponColIdx = findHeaderIndexLoose(headers, 'بيانات السلاح', 'بيان السلاح', 'السلاح');
      const statusColIdx = findHeaderIndexLoose(headers, 'حالة السحب');
      const skipColumns = new Set();
      if (weaponColIdx !== -1) skipColumns.add(weaponColIdx);
      if (statusColIdx !== -1) skipColumns.add(statusColIdx);
      const spans = Array.isArray(rows) ? new Array(rows.length).fill(1) : [];
      const firstRowFlags = Array.isArray(rows) ? new Array(rows.length).fill(true) : [];
      const result = {
        enabled: false,
        weaponColIdx,
        statusColIdx,
        skipColumns,
        spans,
        firstRowFlags,
        signatures: []
      };
      if (!Array.isArray(rows) || !rows.length) return result;
      if (weaponColIdx === -1) return result;
      const signatures = rows.map((row) => buildRowSignature(row, headers, skipColumns));
      let hasGroups = false;
      let i = 0;
      while (i < rows.length) {
        const sig = signatures[i];
        if (sig == null) {
          spans[i] = 1;
          firstRowFlags[i] = true;
          i += 1;
          continue;
        }
        let j = i + 1;
        while (j < rows.length && signatures[j] === sig) j += 1;
        const span = j - i;
        if (span > 1) hasGroups = true;
        for (let k = i; k < j; k++) {
          spans[k] = span;
          firstRowFlags[k] = k === i;
        }
        i = j;
      }
      result.enabled = hasGroups;
      result.signatures = signatures;
      return result;
    }

    function extractIndividualWeaponStatuses(weaponText, weaponUtils) {
      if (!weaponText || !weaponUtils || typeof weaponUtils.splitWeaponSegments !== 'function') {
        return null;
      }
      const segments = weaponUtils.splitWeaponSegments(weaponText);
      if (!segments.length) return null;
      return segments.map((segment) => {
        const isWithdrawn = /\(\s*(?:ال)?مسحوب\s*\)/.test(segment);
        return isWithdrawn ? 'مسحوب' : 'غير مسحوب';
      });
    }

    function computeStatusTextForPartialGroup(weaponText, statusLines, span, weaponUtils) {
      const allPartial = statusLines.length > 0 && statusLines.every((line) => String(line).includes('سحب جزئي'));
      if (!allPartial || span <= 1 || !weaponText) {
        return statusLines.length ? statusLines.join('\n') : '';
      }
      const weaponCount = String(weaponText).split('\n').filter((line) => String(line).trim().length).length;
      if (weaponCount <= 1) {
        return statusLines.length ? statusLines.join('\n') : '';
      }
      const individualStatuses = extractIndividualWeaponStatuses(weaponText, weaponUtils);
      if (!individualStatuses || !Array.isArray(individualStatuses)) {
        return statusLines.length ? statusLines.join('\n') : '';
      }
      return individualStatuses.join('\n');
    }

    function buildGroupedRows(headers, rows, mergeState) {
      const safeRows = Array.isArray(rows) ? rows : [];
      if (!safeRows.length) return { groups: [], logicalSerials: [] };
      const spans = Array.isArray(mergeState?.spans) ? mergeState.spans : new Array(safeRows.length).fill(1);
      const firstFlags = Array.isArray(mergeState?.firstRowFlags)
        ? mergeState.firstRowFlags
        : new Array(safeRows.length).fill(true);
      const weaponIdx = mergeState?.weaponColIdx ?? findHeaderIndexLoose(headers, 'بيانات السلاح', 'بيان السلاح', 'السلاح');
      const statusIdx = mergeState?.statusColIdx ?? findHeaderIndexLoose(headers, 'حالة السحب');
      const groups = [];
      const logicalSerials = new Array(safeRows.length).fill('');
      let serialCounter = 0;
      for (let i = 0; i < safeRows.length; i++) {
        const isGroupStart = mergeState?.enabled ? Boolean(firstFlags[i]) : true;
        if (!isGroupStart) continue;
        serialCounter += 1;
        const span = Math.max(1, spans[i] || 1);
        const chunk = [];
        const weaponLines = [];
        const statusLines = [];
        for (let k = 0; k < span && i + k < safeRows.length; k++) {
          const row = safeRows[i + k] || [];
          chunk.push(row);
          logicalSerials[i + k] = serialCounter;
          if (weaponIdx !== -1) {
            const weaponVal = row[weaponIdx];
            if (weaponVal != null && String(weaponVal).trim().length) {
              weaponLines.push(String(weaponVal).trim());
            }
          }
          if (statusIdx !== -1) {
            const statusVal = row[statusIdx];
            if (statusVal != null && String(statusVal).trim().length) {
              statusLines.push(String(statusVal).trim());
            }
          }
        }
        const bottomIndex = Math.min(pvState.bottom.length - 1, i + span - 1);
        const weaponText = weaponLines.length
          ? weaponLines.join('\n')
          : (weaponIdx !== -1 ? String(chunk[0]?.[weaponIdx] ?? '') : '');
        let statusText = statusLines.length
          ? statusLines.join('\n')
          : (statusIdx !== -1 ? String(chunk[0]?.[statusIdx] ?? '') : '');
        const weaponUtils = getWeaponTextUtils();
        statusText = computeStatusTextForPartialGroup(weaponText, statusLines, span, weaponUtils) || statusText;
        groups.push({
          startIndex: i,
          span,
          rows: chunk,
          serial: serialCounter,
          top: Boolean(pvState.top[i]),
          bottom: Boolean(pvState.bottom[bottomIndex]),
          weaponValues: weaponIdx !== -1 ? chunk.map((row) => row[weaponIdx]) : [],
          statusValues: statusIdx !== -1 ? chunk.map((row) => row[statusIdx]) : [],
          weaponText,
          statusText
        });
      }
      for (let i = 0; i < safeRows.length; i++) {
        if (logicalSerials[i]) continue;
        const prev = i > 0 ? logicalSerials[i - 1] : null;
        if (prev) logicalSerials[i] = prev;
        else {
          serialCounter += 1;
          logicalSerials[i] = serialCounter;
        }
      }
      return { groups, logicalSerials };
    }

    function getDisplayGroups() {
      if (!Array.isArray(pvState.groupedRows) || !pvState.groupedRows.length) {
        const mergeState = pvState.rowMerge || computeRowMergeState(pvState.headers, pvState.rows);
        const rebuilt = buildGroupedRows(pvState.headers, pvState.rows, mergeState);
        pvState.rowMerge = mergeState;
        pvState.groupedRows = rebuilt.groups;
        pvState.logicalSerials = rebuilt.logicalSerials;
      }
      return pvState.groupedRows || [];
    }

    function resolveSerialText(rowIndex) {
      if (
        Array.isArray(pvState.logicalSerials) &&
        rowIndex >= 0 &&
        rowIndex < pvState.logicalSerials.length
      ) {
        return String(pvState.logicalSerials[rowIndex] || '');
      }
      return String(pvState.serials[rowIndex] || '');
    }

    function toLatinDigits(val) {
      return String(val)
        .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
        .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06F0));
    }

    function pad2(n) {
      const num = Number(n) || 0;
      return (num < 10 ? '0' : '') + num;
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
      h ^= h << 13;
      h >>>= 0;
      h ^= h >> 17;
      h >>>= 0;
      h ^= h << 5;
      h >>>= 0;
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

    const toArabicDigits = typeof window.toArabicDigits === 'function'
      ? window.toArabicDigits
      : (s) => String(s).replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)));

    const DEPOSIT_NUMBER_STRONG_TOKEN_RE = /[0-9\u0660-\u0669\u06F0-\u06F9]{1,6}\s*[/\\]\s*[A-Za-z\u0621-\u064A]+/g;
    const DEPOSIT_NUMBER_LOOSE_TOKEN_RE = /[0-9\u0660-\u0669\u06F0-\u06F9]{1,6}\s*(?:[/\\]\s*[A-Za-z\u0621-\u064A]+|[A-Za-z\u0621-\u064A]+)?/g;
    const DEPOSIT_DATE_TOKEN_RE = /[0-9\u0660-\u0669\u06F0-\u06F9]{1,4}\s*[/-]\s*[0-9\u0660-\u0669\u06F0-\u06F9]{1,2}\s*[/-]\s*[0-9\u0660-\u0669\u06F0-\u06F9]{1,4}/g;

    function normalizeDepositNumberToken(raw, nextChar = '') {
      let token = String(raw || '').trim().replace(/\s*([/\\])\s*/g, '$1').replace(/\s+/g, '');
      if (/^[0-9\u0660-\u0669\u06F0-\u06F9]+\u0648$/.test(token) && /^[0-9\u0660-\u0669\u06F0-\u06F9]/.test(String(nextChar || ''))) {
        token = token.slice(0, -1);
      }
      return token;
    }

    function collectDepositNumberMatches(text, regex) {
      const matches = [];
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const raw = match[0];
        const token = normalizeDepositNumberToken(raw, text.charAt(match.index + raw.length));
        if (token) matches.push({ raw, index: match.index, token });
      }
      return matches;
    }

    function residueWithoutDepositMatches(text, matches) {
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
      const strongMatches = collectDepositNumberMatches(source, DEPOSIT_NUMBER_STRONG_TOKEN_RE);
      if (strongMatches.length > 1) return strongMatches.map((match) => match.token);
      const looseMatches = collectDepositNumberMatches(source, DEPOSIT_NUMBER_LOOSE_TOKEN_RE);
      if (looseMatches.length <= 1) return [];
      if (residueWithoutDepositMatches(source, looseMatches)) return [];
      return looseMatches.map((match) => match.token);
    }

    function extractDepositDateParts(text) {
      const parts = [];
      DEPOSIT_DATE_TOKEN_RE.lastIndex = 0;
      let match;
      while ((match = DEPOSIT_DATE_TOKEN_RE.exec(String(text || ''))) !== null) {
        parts.push(String(match[0] || '').replace(/\s*([/-])\s*/g, '$1').trim());
      }
      return parts;
    }

    function splitExplicitPerWeaponField(text) {
      const value = String(text || '').trim();
      if (!value) return [];
      if (!/[|+\r\n]/.test(value)) return [value];
      return value.split(/[ \t]*\|[ \t]*|[ \t]*\+[ \t]*|\r?\n/).map((part) => part.trim()).filter(Boolean);
    }

    function splitDepositNumberField(text) {
      const parts = splitExplicitPerWeaponField(text);
      if (parts.length !== 1) return parts;
      const tokens = extractDepositNumberParts(parts[0]);
      return tokens.length > 1 ? tokens : parts;
    }

    function splitDepositDateField(text) {
      const parts = splitExplicitPerWeaponField(text);
      if (parts.length !== 1) return parts;
      const tokens = extractDepositDateParts(parts[0]);
      return tokens.length > 1 ? tokens : parts;
    }

    function maybeFormatDate(header, value) {
      const headerStr = String(header || '');
      const cellValue = value == null ? '' : value;
      const normalizedHeader = normalizeHeaderName(headerStr);
      const isDepositNumberHeader = normalizedHeader === 'رقم الايداع' || normalizedHeader === 'رقم الإيداع';
      const isPerWeaponDateHeader = normalizedHeader === 'تاريخ الايداع'
        || normalizedHeader === 'تاريخ الإيداع';
      if (isDepositNumberHeader || isPerWeaponDateHeader) {
        const parts = isDepositNumberHeader
          ? splitDepositNumberField(cellValue)
          : splitDepositDateField(cellValue);
        if (parts.length > 1) {
          return parts.map((part) => {
            if (!isPerWeaponDateHeader) return part;
            const parsedPart = parseDateSmart(part);
            return parsedPart ? toArabicDigits(formatYYYYMMDD(parsedPart)) : part;
          }).join('\n────────\n');
        }
        if (isDepositNumberHeader) return String(cellValue);
      }
      const isPrintPage = Boolean(document.body?.classList?.contains('print-page'));
      if (/تاريخ|date/i.test(headerStr)) {
        const parsed = parseDateSmart(cellValue);
        if (parsed) {
          if (headerStr === 'تاريخ الايداع' || headerStr === 'تاريخ قرار اللغاء') {
            return toArabicDigits(formatYYYYMMDD(parsed));
          }
          return formatYYYYMMDD(parsed);
        }
        return isPrintPage ? '' : String(cellValue);
      }
      return String(cellValue);
    }

    function isPerWeaponPrintFieldHeader(header) {
      const normalizedHeader = normalizeHeaderName(header);
      return normalizedHeader === 'رقم الايداع'
        || normalizedHeader === 'رقم الإيداع'
        || normalizedHeader === 'تاريخ الايداع'
        || normalizedHeader === 'تاريخ الإيداع';
    }

    function renderPreviewPage() {
      const tblEl = document.getElementById('previewTable');
      const fnCtrl0 = document.getElementById('fontNameControl');
      const fontName0 = (fnCtrl0?.value || 'Mudir MT').trim();
      const fsCtrl0 = document.getElementById('fontSizeControl');
      const fs0 = parseInt(fsCtrl0?.value || '17', 10);
      if (tblEl) {
        if (!isNaN(fs0)) tblEl.style.fontSize = fs0 + 'pt';
        tblEl.style.fontFamily = `${fontName0}, 'Segoe UI', Tahoma, sans-serif`;
      }
      const thead = document.querySelector('#previewTable thead');
      const tbody = document.querySelector('#previewTable tbody');
      if (!thead || !tbody) return;
      thead.innerHTML = '';
      tbody.innerHTML = '';
      const trHead = document.createElement('tr');
      const serTh = document.createElement('th');
      serTh.textContent = 'م';
      trHead.appendChild(serTh);
      pvState.headers.forEach((h) => {
        const th = document.createElement('th');
        th.textContent = h;
        trHead.appendChild(th);
      });
      thead.appendChild(trHead);
      const groups = getDisplayGroups();
      const total = groups.length;
      const pageSize = Math.max(1, pvState.size || 1);
      const pages = Math.max(1, Math.ceil(total / pageSize));
      if (pvState.page > pages) pvState.page = pages;
      const start = (pvState.page - 1) * pageSize;
      const end = Math.min(start + pageSize, total);
      const mergeState = pvState.rowMerge || null;
      const weaponColIdx = mergeState?.weaponColIdx ?? -1;
      const statusColIdx = mergeState?.statusColIdx ?? -1;
      if (end <= start) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="${pvState.headers.length + 1}" style="text-align:center;color:#b00;font-weight:700;font-size:1.15em;">لا يوجد بيانات</td>`;
        tbody.appendChild(tr);
      } else {
        for (let gi = start; gi < end; gi++) {
          const group = groups[gi];
          const baseRow = pvState.rows[group.startIndex] || [];
          const tr = document.createElement('tr');
          if (group.top) tr.style.borderTop = '4px solid #000';
          if (group.bottom) tr.style.borderBottom = '4px solid #000';
          const serTd = document.createElement('td');
          serTd.textContent = group.serial != null ? String(group.serial) : resolveSerialText(group.startIndex);
          tr.appendChild(serTd);
          pvState.headers.forEach((header, ci) => {
            const td = document.createElement('td');
            let cellValue = '';
            if (ci === weaponColIdx) cellValue = group.weaponText || '';
            else if (ci === statusColIdx) cellValue = group.statusText || '';
            else cellValue = maybeFormatDate(header, baseRow[ci]);
            td.textContent = cellValue;
            td.style.whiteSpace = ci === weaponColIdx || ci === statusColIdx || isPerWeaponPrintFieldHeader(header) ? 'pre-line' : 'normal';
            td.style.wordBreak = 'break-word';
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        }
      }
      const labelId = 'searchNoExactLabel';
      let label = document.getElementById(labelId);
      if (!label) {
        label = document.createElement('div');
        label.id = labelId;
        label.style.cssText = 'text-align:center;color:#b00;font-weight:700;font-size:1.08em;margin-bottom:8px;display:none;';
        const pvTable = document.getElementById('previewTable');
        if (pvTable && pvTable.parentNode) pvTable.parentNode.insertBefore(label, pvTable);
      }
      let showNoExact = false;
      const licInput = document.getElementById('licenseNumberFilter')?.value?.trim();
      if (licInput) {
        const idxLic = pvState.headers.indexOf('رقم');
        if (idxLic !== -1) {
          const exact = pvState.rows.some((r) => (r[idxLic] || '').trim() === licInput);
          if (!exact && pvState.rows.length > 0) showNoExact = true;
        }
      }
      label.style.display = showNoExact ? 'block' : 'none';
      label.textContent = showNoExact ? `لا يوجد تطابق للمدخل (المطبع: ${licInput})` : '';
      const countEl = document.getElementById('itemCount');
      if (countEl) countEl.textContent = String(total);
      try {
        const summaryState = buildFooterSummaryState(groups, pvState.rows, pvState.headers);
        const mainLine = summaryState.usePerStation ? '' : (summaryState.footerLines[0] || '');
        const extraLines = summaryState.usePerStation ? [] : summaryState.footerLines.slice(1);
        const totalCell = document.getElementById('printTotalCell');
        if (totalCell) {
          totalCell.textContent = mainLine;
          totalCell.style.whiteSpace = 'normal';
          if (totalCell.parentElement) totalCell.parentElement.style.display = summaryState.usePerStation ? 'none' : '';
        }
        const totalVal = document.getElementById('printTotalVal');
        if (totalVal) {
          totalVal.textContent = mainLine;
          totalVal.style.whiteSpace = 'normal';
          const parent = totalVal.parentElement;
          if (parent) {
            parent.style.whiteSpace = 'normal';
            parent.style.display = summaryState.usePerStation ? 'none' : '';
          }
        }
        try {
          const table = document.getElementById('previewTable');
          const host = table && table.parentElement ? table.parentElement : null;
          if (host) {
            let forcedBlock = document.getElementById('afterTableTotals');
            if (!forcedBlock) {
              forcedBlock = document.createElement('div');
              forcedBlock.id = 'afterTableTotals';
              host.appendChild(forcedBlock);
            }
            forcedBlock.innerHTML = summaryState.usePerStation
              ? buildStationSummaryTableHtml(summaryState.stationSummaries, summaryState.selectedStatusValue, summaryState.overallTotals, summaryState.overallSummaryLabel)
              : extraLines
                .map((line) => '<div style="padding:6px 8px;border-top:1px solid #000;text-align:right;font-weight:700;">' + escapeFooterHtml(String(line || '')) + '</div>')
                .join('');
            forcedBlock.style.whiteSpace = 'normal';
            forcedBlock.style.fontWeight = '700';
            forcedBlock.style.textAlign = 'right';
            forcedBlock.style.marginTop = summaryState.usePerStation ? '8px' : '0';
            forcedBlock.style.padding = '0';
            forcedBlock.style.borderTop = summaryState.usePerStation ? '0' : '2px solid #000';
            forcedBlock.style.color = '#111';
            forcedBlock.style.background = '#fff';
            forcedBlock.style.display = summaryState.usePerStation || extraLines.length ? 'block' : 'none';
          }
        } catch (_) {}
        if (!summaryState.usePerStation) try {
          const footerText = summaryState.footerLines.join('\n');
          const candidates = document.querySelectorAll('td, th, div, span, p, strong');
          candidates.forEach((el) => {
            const text = String(el?.textContent || '').trim();
            if (!text) return;
            if (!/السجلات/.test(text)) return;
            if (!/(الإجمالي|الاجمالي)/.test(text)) return;
            if (/إجمالي عدد الأسلحة|اجمالي عدد الاسلحة/.test(text)) return;
            if (el.children && el.children.length > 1) return;
            el.textContent = footerText;
            if (el.style) el.style.whiteSpace = 'pre-line';
          });
        } catch (_) {}
      } catch (_) {}
      const pageInfo = document.getElementById('pageInfoPreview');
      if (pageInfo) pageInfo.textContent = `صفحة ${pvState.page} / ${pages}`;
      const prevBtn = document.getElementById('btnPrevPreview');
      if (prevBtn) prevBtn.disabled = pvState.page <= 1;
      const nextBtn = document.getElementById('btnNextPreview');
      if (nextBtn) nextBtn.disabled = pvState.page >= pages;
      const preset = pvPreset || getExcelPreset();
      setPreviewColWidths(preset.columnWidths);
      makeColumnsResizable(preset);
      convertDigitsToArabicInPreview();
    }

    function convertDigitsToArabicInPreview() {
      try {
        const targets = [
          document.getElementById('previewTable'),
          document.getElementById('afterTableTotals'),
          document.getElementById('printTotalCell'),
          document.getElementById('printTotalVal'),
          document.getElementById('pageInfoPreview')
        ].filter(Boolean);
        const toArDigit = (d) => String.fromCharCode(0x0660 + Number(d));
        targets.forEach((root) => {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
          let node;
          while ((node = walker.nextNode())) {
            if (node.nodeValue && /[0-9]/.test(node.nodeValue)) {
              node.nodeValue = node.nodeValue.replace(/[0-9]/g, toArDigit);
            }
          }
        });
      } catch (_) {}
    }

    function renderAllRowsForPrint() {
      const tblEl = document.getElementById('previewTable');
      const thead = tblEl?.querySelector('thead');
      const tbody = tblEl?.querySelector('tbody');
      if (!tblEl || !thead || !tbody) return () => {};
      const prev = { page: pvState.page, size: pvState.size, bodyHtml: tbody.innerHTML };
      tbody.innerHTML = '';
      const groups = getDisplayGroups();
      const mergeState = pvState.rowMerge || null;
      const weaponColIdx = mergeState?.weaponColIdx ?? -1;
      const statusColIdx = mergeState?.statusColIdx ?? -1;
      for (const group of groups) {
        const row = pvState.rows[group.startIndex] || [];
        const tr = document.createElement('tr');
        if (group.top) tr.style.borderTop = '4px solid #000';
        if (group.bottom) tr.style.borderBottom = '4px solid #000';
        const serTd = document.createElement('td');
        serTd.textContent = group.serial != null ? String(group.serial) : resolveSerialText(group.startIndex);
        tr.appendChild(serTd);
        pvState.headers.forEach((header, ci) => {
          const td = document.createElement('td');
          let cellValue = '';
          if (ci === weaponColIdx) cellValue = group.weaponText || '';
          else if (ci === statusColIdx) cellValue = group.statusText || '';
          else cellValue = maybeFormatDate(header, row[ci]);
          td.textContent = cellValue;
          td.style.whiteSpace = ci === weaponColIdx || ci === statusColIdx || isPerWeaponPrintFieldHeader(header) ? 'pre-line' : 'normal';
          td.style.wordBreak = 'break-word';
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      }
      convertDigitsToArabicInPreview();
      return () => {
        pvState.page = prev.page;
        pvState.size = prev.size;
        renderPreviewPage();
      };
    }

    function renderPreviewFromCsv(csvText) {
      const SEP = /,(?=(?:[^"]*"[^"]*")*[^"]*$)|;|\t/;
      const rows = (csvText || '')
        .split(/\r?\n/)
        .filter((line) => line.trim().length)
        .map((line) => line.split(SEP).map((c) => c.replace(/^\uFEFF?\s*["']?|["']\s*$/g, '').replace(/""/g, '"')));
      const headers = rows[0] || [];
      const data = rows.slice(1);
      pvState.headers = headers;
      pvState.rows = data;
      const groups = computePreviewGroups(headers, data);
      pvState.serials = groups.ser;
      pvState.top = groups.top;
      pvState.bottom = groups.bottom;
  pvState.rowMerge = computeRowMergeState(headers, data);
  const grouping = buildGroupedRows(headers, data, pvState.rowMerge);
  pvState.groupedRows = grouping.groups;
  pvState.logicalSerials = grouping.logicalSerials;
      pvState.page = 1;
      renderPreviewPage();
    }

    window.renderAllRowsForPrint = renderAllRowsForPrint;
    window.preparePrintFullTable = function preparePrintFullTable() {
      const prev = { page: pvState.page, size: pvState.size };
      pvState.page = 1;
  pvState.size = getDisplayGroups().length || 100000;
      renderPreviewPage();
      return function restore() {
        pvState.page = prev.page;
        pvState.size = prev.size;
        renderPreviewPage();
      };
    };

    (function wireBrowserPrint() {
      const btn = document.getElementById('btnBrowserPrint');
      const tableEl = document.getElementById('previewTable');
      const totalSpan = document.getElementById('printTotalVal');
      const countSpan = document.getElementById('itemCount');
      if (!btn || !tableEl) return;
      btn.addEventListener('click', () => {
        try {
          renderPreviewPage();
          if (totalSpan) totalSpan.style.whiteSpace = 'pre-line';
        } catch (_) {}
        let restoreAll = null;
        try {
          if (window.preparePrintFullTable) restoreAll = window.preparePrintFullTable();
        } catch (_) {}
        try {
          const src = document.getElementById('previewTable');
          if (!src) {
            window.print();
            return;
          }
          const clone = src.cloneNode(true);
          const liveFS = getComputedStyle(src).fontSize;
          if (liveFS) clone.style.fontSize = liveFS;
          try {
            clone.style.width = 'auto';
          } catch (_) {}
          clone.querySelectorAll('.col-resizer').forEach((n) => n.remove());
          const tf = clone.querySelector('tfoot');
          const tb = clone.querySelector('tbody');
          const ths = clone.querySelectorAll('thead th');
          let summaryFooterHtml = '';
          if (tf && tb) {
            const tr = tf.querySelector('tr');
            if (tr) {
              const totalTd = tr.querySelector('td') || tr.querySelector('th');
              if (totalTd) {
                totalTd.colSpan = ths.length || totalTd.colSpan || 1;
                try {
                  const headers = Array.isArray(pvState.headers) ? pvState.headers : [];
                  const rows = Array.isArray(pvState.rows) ? pvState.rows : [];
                  const groups = getDisplayGroups();
                  const summaryState = buildFooterSummaryState(groups, rows, headers);

                  if (!summaryState.usePerStation) {
                    totalTd.textContent = summaryState.footerLines[0] || '';
                    totalTd.style.whiteSpace = 'normal';
                    const extraLines = summaryState.footerLines.slice(1);
                    extraLines.forEach((line) => {
                      const extraTr = document.createElement('tr');
                      const extraTd = document.createElement('td');
                      extraTd.colSpan = ths.length || totalTd.colSpan || 1;
                      extraTd.textContent = String(line || '');
                      extraTd.style.borderTop = '1px solid #000';
                      extraTd.style.borderBottom = '1px solid #000';
                      extraTd.style.padding = '6px 8px';
                      extraTd.style.textAlign = 'right';
                      extraTd.style.fontWeight = '700';
                      extraTr.appendChild(extraTd);
                      tb.appendChild(extraTr);
                    });
                    tb.appendChild(tr);
                  } else {
                    summaryFooterHtml = buildStationSummaryTableHtml(summaryState.stationSummaries, summaryState.selectedStatusValue, summaryState.overallTotals, summaryState.overallSummaryLabel);
                  }
                } catch (_) {
                  tb.appendChild(tr);
                }
              }
            }
            tf.remove();
          }
          const w = window.open('', '_blank');
          if (!w) {
            if (restoreAll) restoreAll();
            window.print();
            return;
          }
          const doc = w.document;
          doc.open();
          doc.write(`<!doctype html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8" />
<title> </title>
<style>
  @page { size: A4 landscape; margin: 6mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { direction: rtl; font-family: Mudir MT, 'Segoe UI', Tahoma, sans-serif; }
  :root { --padScale: 1; }
  #wrap { width: 100%; }
  table { border-collapse: collapse; table-layout: auto; width: auto; border: 2px solid #000; }
  thead { display: table-header-group; }
  th, td { border: 1px solid #000; padding: calc(4px * var(--padScale)) calc(6px * var(--padScale)); text-align: center; width:auto !important; min-width:0 !important; max-width:none !important; white-space: normal; word-break: break-word; }
  thead th { border-top: 2px solid #000; border-bottom: 2px solid #000; background: #000 !important; color: #fff !important; }
  tbody tr:nth-child(even) td { background: #f7f7f7; }
  #printTotalCell { border-top: 2px solid #000 !important; background: #fff !important; font-weight: 700; }
  tr { page-break-inside: avoid; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head><body>
<div id="wrap"></div>
<script>
window.addEventListener('load', function(){
  setTimeout(function(){
    setTimeout(function(){ window.print(); setTimeout(function(){ window.close(); }, 60); }, 30);
  }, 40);
});
<\/script>
</body></html>`);
          doc.close();
          const mount = w.document.getElementById('wrap');
          if (mount) {
            mount.appendChild(clone);
            try {
              if (summaryFooterHtml) {
                const summaryHost = w.document.createElement('div');
                summaryHost.innerHTML = summaryFooterHtml;
                mount.appendChild(summaryHost);
              } else {
                const srcAfterTotals = document.getElementById('afterTableTotals');
                if (srcAfterTotals && srcAfterTotals.innerHTML.trim()) {
                  const extra = srcAfterTotals.cloneNode(true);
                  mount.appendChild(extra);
                }
              }
            } catch (_) {}
            try {
              const walker = w.document.createTreeWalker(mount, NodeFilter.SHOW_TEXT, null);
              const toArDigit = (d) => String.fromCharCode(0x0660 + Number(d));
              let node;
              while ((node = walker.nextNode())) {
                if (node.nodeValue && /[0-9]/.test(node.nodeValue)) {
                  node.nodeValue = node.nodeValue.replace(/[0-9]/g, toArDigit);
                }
              }
            } catch (_) {}
          }
        } catch (err) {
          console.error(err);
          if (restoreAll) try { restoreAll(); } catch (_) {}
          window.print();
        } finally {
          if (restoreAll) try { restoreAll(); } catch (_) {}
        }
      });
    })();

    window.buildPrintTableHtml = function buildPrintTableHtml(opts) {
      const options = opts || {};
      const headers = Array.isArray(pvState.headers) ? pvState.headers : [];
  const rows = Array.isArray(pvState.rows) ? pvState.rows : [];
  const groups = getDisplayGroups();
  const mergeState = pvState.rowMerge || null;
  const weaponColIdx = mergeState?.weaponColIdx ?? -1;
  const statusColIdx = mergeState?.statusColIdx ?? -1;
      const fontPt = parseInt(options.fontPt || (document.getElementById('fontSizeControl')?.value || '17'), 10);
      const pt = isNaN(fontPt) ? 17 : fontPt;
      const colCount = headers.length + 1;
      let widthsPx = [];
      try {
        const ths = Array.from(document.querySelectorAll('#previewTable thead th'));
        if (ths && ths.length) {
          widthsPx = ths.slice(0, colCount).map((th) => th.offsetWidth || 0);
        }
      } catch (_) {}
      if (!Array.isArray(widthsPx) || widthsPx.length === 0) {
        let widths = [];
        try {
          if (typeof readPreviewColWidths === 'function') widths = readPreviewColWidths();
        } catch (_) {}
        if (!Array.isArray(widths) || !widths.length) {
          const preset = typeof getExcelPreset === 'function' ? getExcelPreset() : {};
          widths = Array.isArray(preset?.columnWidths) ? preset.columnWidths.slice() : [];
        }
        const serialDefaultCh = 8;
        if (widths.length === colCount - 1) widths = [serialDefaultCh, ...widths];
        if (widths.length < colCount) {
          while (widths.length < colCount) widths.push(undefined);
        }
        if (widths.length > colCount) widths = widths.slice(0, colCount);
        widthsPx = widths.map((wch) => (typeof wch === 'number' && !isNaN(wch)) ? Math.max(40, Math.round(wch * 8)) : 0);
      } else if (widthsPx.length < colCount) {
        while (widthsPx.length < colCount) widthsPx.push(0);
      } else if (widthsPx.length > colCount) {
        widthsPx = widthsPx.slice(0, colCount);
      }
    let html = '';
      html += '<table dir="rtl" style="width:100%;border-collapse:collapse;table-layout:fixed;font-family:Calibri,"Segoe UI",Tahoma,sans-serif;font-size:' + pt + 'pt;">';
      html += '<colgroup>';
      for (let i = 0; i < colCount; i++) {
        const px = parseInt(widthsPx[i] || 0, 10);
        if (px && px > 0) html += '<col style="width:' + px + 'px;min-width:' + px + 'px;max-width:' + px + 'px;">';
        else html += '<col>';
      }
      html += '</colgroup>';
      html += '<thead><tr>';
      html += '<th style="border:1px solid #000;padding:4px 6px;text-align:center;">م</th>';
      for (const h of headers) html += '<th style="border:1px solid #000;padding:4px 6px;text-align:center;">' + String(h || '') + '</th>';
      html += '</tr></thead>';
      html += '<tbody>';
      for (const group of groups) {
        const row = rows[group.startIndex] || [];
        const bt = group.bottom ? 'border-bottom:4px solid #000;' : '';
        const tp = group.top ? 'border-top:4px solid #000;' : '';
        html += '<tr style="' + tp + bt + '">';
        const serialVal = group.serial != null ? String(group.serial) : resolveSerialText(group.startIndex);
        html += '<td style="border:1px solid #000;padding:4px 6px;text-align:center;">' + serialVal + '</td>';
        for (let ci = 0; ci < headers.length; ci++) {
          let val = '';
          if (ci === weaponColIdx) val = group.weaponText || '';
          else if (ci === statusColIdx) val = group.statusText || '';
          else val = maybeFormatDate(headers[ci], row[ci]);
          const whiteSpace = ci === weaponColIdx || ci === statusColIdx || isPerWeaponPrintFieldHeader(headers[ci]) ? 'pre-line' : 'normal';
          html += '<td style="border:1px solid #000;padding:4px 6px;text-align:center;white-space:' + whiteSpace + ';word-break:break-word;">' + String(val || '') + '</td>';
        }
        html += '</tr>';
      }
      const summaryState = buildFooterSummaryState(groups, rows, headers);
      if (!summaryState.usePerStation) {
        html += '<tr><td colspan="' + (headers.length + 1) + '" style="border-top:3px solid #000;border-bottom:1px solid #000;padding:6px 8px;text-align:center;font-weight:700;">' + escapeFooterHtml(String(summaryState.footerLines[0] || '')) + '</td></tr>';
        for (let fi = 1; fi < summaryState.footerLines.length; fi++) {
          html += '<tr><td colspan="' + (headers.length + 1) + '" style="border-top:1px solid #000;border-bottom:1px solid #000;padding:6px 8px;text-align:right;font-weight:700;">' + escapeFooterHtml(String(summaryState.footerLines[fi] || '')) + '</td></tr>';
        }
      }
      html += '</tbody>';
      html += '</table>';
      if (summaryState.usePerStation) {
        html += buildStationSummaryTableHtml(summaryState.stationSummaries, summaryState.selectedStatusValue, summaryState.overallTotals, summaryState.overallSummaryLabel);
      }
      return html;
    };

    async function exportWithPreset(preset) {
      let csvText = await getCsvPreferFiltered().catch(() => null);
      if (!csvText) {
        alert('تعذر تحميل البيانات');
        return;
      }
      csvText = reformatCsvDatesText(csvText);
      const options = applyPresetDefaults(preset || {});
      saveLocalPreset(options);
      saveServerPreset(options);
      const requestOptions = currentExportMeta ? { ...options, exportMeta: currentExportMeta } : options;
      try {
        const res = await fetch(buildWeaponsApiUrl('/api/open-temp-xlsx-opts'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json;charset=utf-8' },
          body: JSON.stringify({ csvText, options: requestOptions })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
      } catch (_) {
        alert('تعذر إنشاء ملف Excel بالإعدادات');
      }
    }

    async function openExcelFiltered() {
      try {
        let csvText = await getCsvPreferFiltered().catch(() => null);
        if (!csvText) {
          alert('تعذر تحميل البيانات');
          return;
        }
        csvText = reformatCsvDatesText(csvText);
        const preset = { ...getExcelPreset() };
        preset.rtl = true;
        preset.tableStyle = 'TableStyleMedium15';
        preset.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        preset.headerAlign = { horizontal: 'center', vertical: 'middle', wrapText: true };
        pvPreset = preset;
        const fsCtrl = document.getElementById('fontSizeControl');
        const fnCtrl = document.getElementById('fontNameControl');
        const fs = parseInt(fsCtrl?.value || '17', 10);
        const fname = (fnCtrl?.value || (preset.font && preset.font.name) || 'Calibri').trim();
        preset.font = { ...(preset.font || {}), name: fname, size: isNaN(fs) ? 17 : fs };
        preset.pageSetup = { orientation: 'landscape', paperSize: 8 };
        let widths = null;
        try {
          widths = readPreviewColWidths();
        } catch (_) {}
        if (!widths || !widths.length) {
          try {
            widths = readVisibleColumnWidthsChars();
          } catch (_) {}
        }
        if (widths && widths.length) preset.columnWidths = widths;
        const meta = currentExportMeta;
        saveExcelPreset(preset);
        const requestOptions = meta ? { ...preset, exportMeta: meta } : preset;
        let res = await fetch(buildWeaponsApiUrl('/api/open-temp-xlsx-opts-print'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json;charset=utf-8' },
          body: JSON.stringify({ csvText, options: requestOptions })
        });
        if (!res.ok) {
          res = await fetch(buildWeaponsApiUrl('/api/open-temp-xlsx'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json;charset=utf-8' },
            body: JSON.stringify({ csvText, options: requestOptions })
          });
        }
        if (res.ok) return;
        if (res.status === 501) {
          const rCsv = await fetch(buildWeaponsApiUrl('/api/open-temp-csv'), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: csvText
          });
          if (rCsv.ok) return;
        }
        try {
          const saveRes = await fetch(buildWeaponsApiUrl('/api/save-temp-csv'), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: csvText
          });
          if (saveRes.ok) {
            let url = null;
            const loc = saveRes.headers.get('Location');
            if (loc) url = new URL(loc, location.href).href;
            else {
              const ct = (saveRes.headers.get('Content-Type') || '').toLowerCase();
              if (ct.includes('application/json')) {
                const j = await saveRes.json().catch(() => null);
                if (j && j.url) url = new URL(j.url, location.href).href;
              }
              if (!url) {
                const t = await saveRes.text().catch(() => null);
                if (t) url = new URL(t, location.href).href;
              }
            }
            if (url) {
              const iframe = document.createElement('iframe');
              iframe.style.display = 'none';
              document.body.appendChild(iframe);
              const timer = setTimeout(() => {
                try {
                  window.open(url, '_blank');
                } catch (_) {}
                try {
                  document.body.removeChild(iframe);
                } catch (_) {}
              }, 1200);
              iframe.src = 'ms-excel:ofe|u|' + url;
              window.addEventListener('blur', () => {
                clearTimeout(timer);
                try {
                  document.body.removeChild(iframe);
                } catch (_) {}
              }, { once: true });
              return;
            }
          }
        } catch (_) {}
        throw new Error('open failed');
      } catch (err) {
        console.error(err);
        alert('تعذر فتح Excel بالإعدادات. تأكد أن الخادم يعمل بشكل صحيح');
      }
    }

    (async () => {
      await ensureWeaponsWeaponTextUtilsModule().catch(() => null);
      try { getWeaponTextUtils(); } catch (_) {}
      const preset = applyPresetDefaults(Object.assign({}, getExcelPreset(), loadLocalPreset(), await loadServerPreset()));
      pvPreset = preset;
      const fsCtrl = document.getElementById('fontSizeControl');
      if (fsCtrl) {
        const szRaw = preset && preset.font && preset.font.size ? parseInt(preset.font.size, 10) : 17;
        fsCtrl.value = String(isNaN(szRaw) ? 17 : szRaw);
      }
      const csv = await getCsvPreferFiltered().catch(() => null);
      if (csv) {
        renderPreviewFromCsv(csv);
        setPreviewColWidths(preset.columnWidths);
        makeColumnsResizable(preset);
      }
      saveLocalPreset(preset);
      saveServerPreset(preset);
    })();

    document.getElementById('btnOpenExcel')?.addEventListener('click', openExcelFiltered);
    window.openExcelFiltered = openExcelFiltered;
    document.getElementById('btnPrevPreview')?.addEventListener('click', () => {
      pvState.page = Math.max(1, pvState.page - 1);
      renderPreviewPage();
    });
    document.getElementById('btnNextPreview')?.addEventListener('click', () => {
      const groups = getDisplayGroups();
      const pageSize = Math.max(1, pvState.size || 1);
      const pages = Math.max(1, Math.ceil(groups.length / pageSize));
      pvState.page = Math.min(pages, pvState.page + 1);
      renderPreviewPage();
    });
    const fsCtrlLive = document.getElementById('fontSizeControl');
    const fnCtrlLive = document.getElementById('fontNameControl');
    const applyFontControls = () => {
      const name = (fnCtrlLive?.value || 'Calibri').trim();
      const val = parseInt(fsCtrlLive?.value, 10);
      const size = isNaN(val) ? 17 : val;
      const tbl = document.getElementById('previewTable');
      if (tbl) {
        tbl.style.fontSize = size + 'pt';
        tbl.style.fontFamily = `${name}, 'Segoe UI', Tahoma, sans-serif`;
      }
      const preset = getExcelPreset();
      preset.font = { ...(preset.font || {}), name, size };
      saveExcelPreset(preset);
      pvPreset = { ...(pvPreset || {}), font: { ...(pvPreset?.font || {}), name, size } };
    };
    fsCtrlLive && fsCtrlLive.addEventListener('input', applyFontControls);
    fsCtrlLive && fsCtrlLive.addEventListener('change', applyFontControls);
    fnCtrlLive && fnCtrlLive.addEventListener('change', applyFontControls);
    document.getElementById('btnSavePreset')?.addEventListener('click', async () => {
      const preset = getExcelPreset();
      const widths = readVisibleColumnWidthsChars();
      if (widths && widths.length) preset.columnWidths = widths;
      saveExcelPreset(preset);
      try {
        await fetch(buildWeaponsApiUrl('/api/print-preset'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(preset)
        });
      } catch (_) {}
      pvPreset = { ...(pvPreset || {}), ...preset };
      alert('تم حفظ الإعدادات');
    });
    document.getElementById('btnCleanupTemp')?.addEventListener('click', async () => {
      try {
        const res = await fetch(buildWeaponsApiUrl('/api/cleanup-temp'), { method: 'POST' });
        const j = await res.json().catch(() => ({ ok: false }));
        if (j && j.ok) alert(`تم حذف ${j.deleted || 0} ملف/ملفات مؤقتة`);
        else alert('تعذر حذف الملفات المؤقتة');
      } catch (_) {
        alert('تعذر حذف الملفات المؤقتة');
      }
    });

    function reformatCsvDatesText(csvText) {
      try {
        if (!csvText) return csvText;
        const rows = csvText.split(/\r?\n/);
        if (!rows.length) return csvText;
        const headers = rows[0].split(',');
        const idxDecision = headers.indexOf('تاريخ قرار اللغاء');
        const idxDeposit = headers.indexOf('تاريخ الايداع');
        let updated = [rows[0]];
        for (let i = 1; i < rows.length; i++) {
          const raw = rows[i];
          if (!raw.trim()) continue;
          const cells = raw.split(',');
          if (idxDecision !== -1 && cells[idxDecision]) {
            const parsed = parseDateSmart(cells[idxDecision]);
            if (parsed) cells[idxDecision] = formatYYYYMMDD(parsed);
          }
          if (idxDeposit !== -1 && cells[idxDeposit]) {
            const parts = splitDepositDateField(cells[idxDeposit]);
            if (parts.length > 1) {
              cells[idxDeposit] = parts.map((part) => {
                const parsed = parseDateSmart(part);
                return parsed ? formatYYYYMMDD(parsed) : part;
              }).join(' + ');
            } else {
              const parsed = parseDateSmart(cells[idxDeposit]);
              if (parsed) cells[idxDeposit] = formatYYYYMMDD(parsed);
            }
          }
          updated.push(cells.join(','));
        }
        return updated.join('\n');
      } catch (_) {
        return csvText;
      }
    }

    return;
  });
})();
