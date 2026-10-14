// Settings sidebar and duplicate-records frame
(function(){
  const buildWeaponsApiUrl = (typeof window !== 'undefined' && typeof window.buildWeaponsApiUrl === 'function')
    ? window.buildWeaponsApiUrl
    : (path) => path;
  function escapeHtml(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  let settingsUiInitialized = false;

  function toggleSettingsSidebar(forceOpen){
    const el = document.getElementById('settingsSidebar');
    if (!el) return;
    const willOpen = (typeof forceOpen === 'boolean') ? forceOpen : !el.classList.contains('open');
    if (willOpen) el.classList.add('open'); else el.classList.remove('open');
  }

  function toLatinSafe(s) {
    return String(s || '')
      .replace(/[\u0660-\u0669]/g, ch => String(ch.charCodeAt(0) - 0x0660))
      .replace(/[\u06F0-\u06F9]/g, ch => String(ch.charCodeAt(0) - 0x06F0));
  }

  function normalizeLicenseKey(license) {
    return toLatinSafe(String(license || '')).replace(/\s+/g, '').trim();
  }

  function normalizeNameKey(name) {
    return String(name || '').trim().toLowerCase();
  }

  function normalizeWeaponKey(value) {
    return toLatinSafe(String(value || '').toLowerCase()).replace(/[^0-9a-z\u0621-\u064a]+/g, '');
  }

  function splitWeaponNames(text) {
    return String(text || '')
      .split(/\+|،|,|\/|;|\||\n/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function renameScore(oldName, newName) {
    const a = normalizeWeaponKey(oldName);
    const b = normalizeWeaponKey(newName);
    if (!a || !b) return null;
    if (a === b) return 0;
    if (a.length >= 3 && b.includes(a)) return b.length - a.length;
    if (b.length >= 3 && a.includes(b)) return a.length - b.length;
    const maxLen = Math.max(a.length, b.length);
    if (!maxLen) return null;
    const dist = levenshteinDistance(a, b);
    const ratio = dist / maxLen;
    if (dist <= 2 || ratio <= 0.25) return dist;
    return null;
  }

  function levenshteinDistance(a, b) {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    const prev = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      let prevDiag = prev[0];
      prev[0] = i;
      for (let j = 1; j <= n; j++) {
        const temp = prev[j];
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        const insert = prev[j] + 1;
        const remove = prev[j - 1] + 1;
        const replace = prevDiag + cost;
        prev[j] = Math.min(insert, remove, replace);
        prevDiag = temp;
      }
    }
    return prev[n];
  }

  async function ensureCsvDataset() {
    let headers = Array.isArray(window.csvHeaders) ? window.csvHeaders : [];
    let rows = Array.isArray(window.csvAll) ? window.csvAll : [];

    if (!headers.length || !rows.length) {
      try {
        const res = await fetch(buildWeaponsApiUrl('/api/records'), { cache: 'no-store' });
        if (res.ok) {
          const j = await res.json().catch(() => null);
          if (j && j.ok && Array.isArray(j.headers) && Array.isArray(j.rows)) {
            headers = j.headers;
            rows = j.rows;
            if (Array.isArray(j.meta)) window.csvRowMeta = j.meta;
          }
        }
      } catch (_) {}
    }

    if (headers.length && rows.length) {
      window.csvHeaders = headers;
      window.csvAll = rows;
    }

    return { headers, rows };
  }

async function openDuplicateChecker(mode) {
  const frame = document.getElementById('dupFrame');
  const content = document.getElementById('dupFrameContent');
  if (!frame || !content) return;
  const titleEl = document.getElementById('dupFrameTitle');
  const setTitle = (text) => { if (titleEl) titleEl.textContent = text; };

  const wireFocusButtons = () => {
    setTimeout(() => {
      const focusButtons = content.querySelectorAll('button.dup-focus-btn');
      focusButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          // Push the duplicate's name/license into the main filters, then show that row in the table
          const nameVal = btn.getAttribute('data-dup-name') || '';
          const licVal = btn.getAttribute('data-dup-license') || '';
          const nameInput = document.getElementById('filterInput');
          const licenseInput = document.getElementById('licenseNumberFilter');
          if (nameInput) {
            nameInput.value = nameVal;
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (licenseInput) {
            licenseInput.value = licVal;
            licenseInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          try {
            if (typeof window.applyFilter === 'function') window.applyFilter();
            else if (typeof window.applyAllFilters === 'function') window.applyAllFilters();
          } catch (err) {
            console.warn('duplicate focus apply error', err);
          }
          frame.style.display = 'none';
          try { toggleSettingsSidebar(false); } catch (_) {}
          setTimeout(() => {
            const container = document.getElementById('csvPreviewContainer');
            if (container) { try { container.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) { container.scrollTop = 0; } }
          }, 50);
        });
      });
    }, 20);
  };

  const applyDuplicateIssueFocus = (indices, label) => {
    const uniqueIndices = Array.from(new Set((Array.isArray(indices) ? indices : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0)))
      .sort((left, right) => left - right);
    if (!uniqueIndices.length) {
      alert('لا توجد سجلات مطابقة للفحص الحالي.');
      return;
    }
    try {
      if (typeof window.resetSheetFilters === 'function') {
        window.resetSheetFilters({ skipApply: true });
      }
    } catch (_) {}
    window.__auditFocusSet = new Set(uniqueIndices);
    window.__auditFocusLabel = label || 'فحص المتكرر';
    window.__auditFocusMode = label === 'فحص التكرار الرخصة' ? 'duplicate-license' : '';
    try {
      if (typeof window.applyFilter === 'function') window.applyFilter();
      else if (typeof window.applyAllFilters === 'function') window.applyAllFilters();
    } catch (err) {
      console.warn('duplicate issue focus apply error', err);
    }
    frame.style.display = 'none';
    try { toggleSettingsSidebar(false); } catch (_) {}
    setTimeout(() => {
      const container = document.getElementById('csvPreviewContainer');
      if (container) { try { container.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) { container.scrollTop = 0; } }
    }, 50);
  };

  if (!mode) {
    frame.style.display = 'block';
    setTitle('اختر نوع فحص التكرار');
    content.innerHTML = `
      <div class="dup-choice-grid">
        <button id="dupChoiceFull" class="dup-choice-btn primary">فحص التكرار الكلي</button>
        <div class="dup-choice-desc">يتأكد من وجود سجلات تتطابق في الاسم ورقم القيد وبيانات السلاح معاً.</div>
        <button id="dupChoiceLicense" class="dup-choice-btn">فحص التكرار الرخصة</button>
        <div class="dup-choice-desc">يتأكد من وجود سجلات تتطابق في الاسم مع رقم القيد فقط.</div>
      </div>
    `;
    setTimeout(() => {
      document.getElementById('dupChoiceFull')?.addEventListener('click', () => openDuplicateChecker('full'));
      document.getElementById('dupChoiceLicense')?.addEventListener('click', () => openDuplicateChecker('license'));
    }, 20);
    return;
  }

  frame.style.display = 'block';
  setTitle(mode === 'full' ? 'نتائج فحص التكرار الكلي' : 'نتائج فحص التكرار الرخصة');
  content.innerHTML = '<div style="padding:16px;text-align:center;font-weight:700;color:#475569;">جاري تحليل السجلات...</div>';

  try {
    const { headers, rows } = await ensureCsvDataset();
    if (!headers.length || !rows.length) {
      content.innerHTML = '<div style="padding:18px;text-align:center;color:#b91c1c;font-weight:700;">لا توجد بيانات لتحليلها.</div>';
      return;
    }

    const stripSortGlyphs = (s) => String(s || '').replace(/[⇅↑↓↕⇧▼▲]/g, '').trim();
    const cleanHeader = (s) => String(s || '').replace(/^\uFEFF/, '').trim();
    const normalizedHeaders = headers.map(h => cleanHeader(stripSortGlyphs(h)));
    const normalizedLower = normalizedHeaders.map(h => h.toLowerCase());

    const findIdx = (names) => {
      const lowers = names.map(n => String(n || '').trim().toLowerCase());
      for (let i = 0; i < normalizedLower.length; i++) {
        const candidate = normalizedLower[i];
        if (!candidate) continue;
        for (const name of lowers) {
          if (!name) continue;
          if (candidate === name) return i;
          if (candidate.includes(name)) return i;
        }
      }
      return -1;
    };

    const licenseIdx = findIdx(['رقم القيد', 'رقم']);
    const nameIdx = findIdx(['الاسم']);
    if (licenseIdx === -1 || nameIdx === -1) {
      content.innerHTML = '<div style="padding:18px;text-align:center;color:#b91c1c;font-weight:700;">تعذر تحديد عمودي الاسم أو رقم القيد في CSV.</div>';
      return;
    }

    if (mode === 'license') {
      const groupsMap = new Map();
      rows.forEach((row, idx) => {
        const licenseRaw = String(row[licenseIdx] || '').trim();
        const nameRaw = String(row[nameIdx] || '').trim();
        const licenseKey = normalizeLicenseKey(licenseRaw);
        const nameKey = normalizeNameKey(nameRaw);
        if (!licenseKey || !nameKey) return;
        const key = `${licenseKey}::${nameKey}`;
        if (!groupsMap.has(key)) groupsMap.set(key, { indices: [], license: licenseRaw, name: nameRaw });
        const entry = groupsMap.get(key);
        entry.indices.push(idx);
        if (!entry.license && licenseRaw) entry.license = licenseRaw;
        if (!entry.name && nameRaw) entry.name = nameRaw;
      });

      const groups = Array.from(groupsMap.values())
        .filter(g => g.indices.length > 1)
        .sort((a, b) => b.indices.length - a.indices.length);

      if (!groups.length) {
        content.innerHTML = '<div style="padding:18px;text-align:center;color:#0f172a;font-weight:700;">لا توجد سجلات مكررة بالاسم ورقم القيد.</div>';
        return;
      }

      const sectorIdx = findIdx(['القطاع', 'قطاع', 'نوع القاطع']);
      const stationIdx = findIdx(['القسم التابع', 'القسم', 'القسم التابع ', 'القسم التابع']);
      const sectorSet = new Set();
      const stationSet = new Set();

      const preparedGroups = groups.map(group => {
        const firstRow = rows[group.indices[0]] || [];
        const repLicense = String(firstRow[licenseIdx] || group.license || '');
        const repName = String(firstRow[nameIdx] || group.name || '');
        const rowsMeta = group.indices.map(rowIdx => {
          const row = rows[rowIdx] || [];
          const sectorVal = sectorIdx !== -1 ? String(row[sectorIdx] || '').trim() : '';
          const stationVal = stationIdx !== -1 ? String(row[stationIdx] || '').trim() : '';
          if (sectorVal) sectorSet.add(sectorVal);
          if (stationVal) stationSet.add(stationVal);
          return { rowIdx, sector: sectorVal, station: stationVal };
        });
        return { indices: group.indices, license: repLicense, name: repName, rowsMeta };
      });

      const sortedSectors = Array.from(sectorSet).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ar', { sensitivity: 'base' }));
      const sortedStations = Array.from(stationSet).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ar', { sensitivity: 'base' }));

      let filtersMarkup = '';
      if ((sectorIdx !== -1 && sortedSectors.length) || (stationIdx !== -1 && sortedStations.length)) {
        filtersMarkup += '<div class="dup-filter-row">';
        if (sectorIdx !== -1 && sortedSectors.length) {
          filtersMarkup += '<label for="dupLicenseSectorSelect">القطاع:</label>';
          filtersMarkup += '<select id="dupLicenseSectorSelect" class="dup-filter-select"><option value="">كل القطاعات</option>';
          sortedSectors.forEach(val => { filtersMarkup += '<option value="' + escapeHtml(val) + '">' + escapeHtml(val) + '</option>'; });
          filtersMarkup += '</select>';
        }
        if (stationIdx !== -1 && sortedStations.length) {
          filtersMarkup += '<label for="dupLicenseStationSelect">القسم:</label>';
          filtersMarkup += '<select id="dupLicenseStationSelect" class="dup-filter-select"><option value="">كل الأقسام</option>';
          sortedStations.forEach(val => { filtersMarkup += '<option value="' + escapeHtml(val) + '">' + escapeHtml(val) + '</option>'; });
          filtersMarkup += '</select>';
        }
        filtersMarkup += '</div>';
      }

      content.innerHTML = `
        <div class="dup-mode-banner" id="dupLicenseBanner"></div>
        <div class="dup-top-actions" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:10px 0 12px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
          <div style="font-weight:700;color:#0f172a;">عرض كل سجلات فحص التكرار الرخصة في الجدول</div>
          <button id="dupLicenseFocusAllBtn" class="dup-focus-all-btn" style="padding:8px 16px;border-radius:8px;border:none;background:#0f172a;color:#fff;cursor:pointer;font-weight:800;">فحص</button>
        </div>
        <div class="dup-warning dup-warning-orange">⚠️ الأسلحة قد تكون مختلفة بين السجلات المتكررة.</div>
        ${filtersMarkup}
        <div id="dupLicenseResults"></div>
      `;

      const bannerEl = document.getElementById('dupLicenseBanner');
      const resultsEl = document.getElementById('dupLicenseResults');
      const sectorSelect = document.getElementById('dupLicenseSectorSelect');
      const stationSelect = document.getElementById('dupLicenseStationSelect');
      const focusAllBtn = document.getElementById('dupLicenseFocusAllBtn');
      let activeDuplicateLicenseIndices = [];

      const renderFiltered = () => {
        const sectorFilter = sectorSelect ? sectorSelect.value : '';
        const stationFilter = stationSelect ? stationSelect.value : '';
        const filteredGroups = preparedGroups.filter(group => {
          return group.rowsMeta.some(meta => {
            if (sectorFilter && meta.sector !== sectorFilter) return false;
            if (stationFilter && meta.station !== stationFilter) return false;
            return true;
          });
        });
        activeDuplicateLicenseIndices = Array.from(new Set(filteredGroups.flatMap(group => group.indices)))
          .sort((left, right) => left - right);
        if (focusAllBtn) {
          focusAllBtn.disabled = activeDuplicateLicenseIndices.length === 0;
          focusAllBtn.style.opacity = activeDuplicateLicenseIndices.length ? '1' : '0.55';
          focusAllBtn.style.cursor = activeDuplicateLicenseIndices.length ? 'pointer' : 'not-allowed';
        }

        if (bannerEl) {
          if (filteredGroups.length) {
            const summary = sectorFilter || stationFilter ? 'بعد تطبيق التصفية' : 'حسب الاسم ورقم القيد';
            bannerEl.textContent = 'تم العثور على ' + filteredGroups.length + ' مجموعة مكررة ' + summary + '.';
          } else {
            bannerEl.textContent = 'لا توجد نتائج مطابقة للتصفية الحالية.';
          }
        }

        if (!filteredGroups.length) {
          resultsEl.innerHTML = '<div class="dup-empty">لا توجد سجلات مكررة ضمن هذه التصفية.</div>';
          return;
        }

        let html = '<div class="dup-results-scroll">';
        filteredGroups.forEach(group => {
          const firstRow = rows[group.indices[0]] || [];
          const repLicense = String(firstRow[licenseIdx] || group.license || '');
          const repName = String(firstRow[nameIdx] || group.name || '');
          html += '<div class="dup-group-box" style="border:1px solid #e6e6e6;padding:10px;border-radius:8px;background:#fff;">';
          html += '<div class="dup-group-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:12px;flex-wrap:wrap;">';
          html += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">';
          html += '<div style="font-weight:700;color:#111;">' + escapeHtml(repName) + ' — رقم القيد: ' + escapeHtml(repLicense) + '</div>';
          html += '<button class="dup-focus-btn" data-dup-name="' + escapeHtml(repName) + '" data-dup-license="' + escapeHtml(repLicense) + '">فحص</button>';
          html += '</div>';
          html += '<div style="color:#666;font-size:0.95em">عدد السجلات: ' + group.indices.length + '</div>';
          html += '</div>';
          html += '<div style="overflow:auto;max-width:100%;">';
          html += '<table class="excel dup-table" style="width:100%;border-collapse:collapse;">';
          html += '<thead><tr>';
          for (const h of headers) {
            html += '<th style="padding:8px;border-bottom:2px solid #eee;background:#fafafa;text-align:right;white-space:nowrap;">' + escapeHtml(h) + '</th>';
          }
          html += '</tr></thead><tbody>';
          group.indices.forEach(rowIdx => {
            const row = rows[rowIdx] || [];
            html += '<tr style="vertical-align:top;">';
            for (let ci = 0; ci < headers.length; ci++) {
              const cell = String(row[ci] || '');
              html += '<td style="padding:8px;border:1px solid #f6f6f6;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(cell) + '</td>';
            }
            html += '</tr>';
          });
          html += '</tbody></table></div></div>';
        });
        html += '</div>';
        resultsEl.innerHTML = html;
        wireFocusButtons();
      };

      renderFiltered();
      if (focusAllBtn) {
        focusAllBtn.addEventListener('click', () => {
          applyDuplicateIssueFocus(activeDuplicateLicenseIndices, 'فحص التكرار الرخصة');
        });
      }
      if (sectorSelect) sectorSelect.addEventListener('change', renderFiltered);
      if (stationSelect) stationSelect.addEventListener('change', renderFiltered);
      return;
    }

    const weaponsIdx = findIdx(['بيانات السلاح', 'بيان السلاح', 'السلاح']);
    if (weaponsIdx === -1) {
      content.innerHTML = '<div style="padding:18px;text-align:center;color:#b91c1c;font-weight:700;">تعذر تحديد عمود "بيانات السلاح".</div>';
      return;
    }

    const tripletMap = new Map();
    rows.forEach((row, idx) => {
      const licenseRaw = String(row[licenseIdx] || '').trim();
      const nameRaw = String(row[nameIdx] || '').trim();
      const weaponRaw = String(row[weaponsIdx] || '').trim();
      if (!licenseRaw || !nameRaw || !weaponRaw) return;
      const licenseKey = normalizeLicenseKey(licenseRaw);
      const nameKey = normalizeNameKey(nameRaw);
      const weaponKey = normalizeWeaponKey(weaponRaw);
      if (!licenseKey || !nameKey || !weaponKey) return;
      const key = `${licenseKey}::${nameKey}::${weaponKey}`;
      if (!tripletMap.has(key)) tripletMap.set(key, { indices: [], license: licenseRaw, name: nameRaw, weapon: weaponRaw });
      tripletMap.get(key).indices.push(idx);
    });

    const tripletGroups = Array.from(tripletMap.values())
      .filter(g => g.indices.length > 1)
      .sort((a, b) => b.indices.length - a.indices.length);

    if (!tripletGroups.length) {
      content.innerHTML = '<div style="padding:18px;text-align:center;color:#0f172a;font-weight:700;">لا توجد سجلات تتطابق في الاسم ورقم القيد وبيانات السلاح معاً.</div>';
      return;
    }

    let html = '<div class="dup-mode-banner">تم العثور على ' + tripletGroups.length + ' مجموعة طبق الأصل (الاسم + رقم القيد + بيانات السلاح).</div>';
    html += '<div class="dup-results-scroll">';
    tripletGroups.forEach(group => {
      const repLicense = group.license || '';
      const repName = group.name || '';
      const repWeapon = group.weapon || '';
      html += '<div class="dup-group-box" style="border:1px solid #e6e6e6;padding:10px;border-radius:8px;background:#fff;">';
      html += '<div class="dup-group-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:12px;flex-wrap:wrap;">';
      html += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">';
      html += '<div style="font-weight:700;color:#111;">' + escapeHtml(repName) + ' — رقم القيد: ' + escapeHtml(repLicense) + '</div>';
      html += '<button class="dup-focus-btn" data-dup-name="' + escapeHtml(repName) + '" data-dup-license="' + escapeHtml(repLicense) + '">فحص</button>';
      html += '</div>';
      html += '<div style="color:#666;font-size:0.95em">عدد السجلات: ' + group.indices.length + '</div>';
      html += '</div>';
      html += '<div class="dup-weapon-line">بيانات السلاح: <span>' + escapeHtml(repWeapon) + '</span></div>';
      html += '<div style="overflow:auto;max-width:100%;">';
      html += '<table class="dup-mini-table" style="width:100%;border-collapse:collapse;">';
      html += '<thead><tr><th>#</th><th>رقم القيد</th><th>الاسم</th><th>بيانات السلاح</th></tr></thead><tbody>';
      group.indices.slice(0, 200).forEach((rowIdx) => {
        const row = rows[rowIdx] || [];
        const displayLicense = String(row[licenseIdx] || '');
        const displayName = String(row[nameIdx] || '');
        const displayWeapon = String(row[weaponsIdx] || '');
        html += '<tr>';
        html += '<td>' + escapeHtml(String(rowIdx + 1)) + '</td>';
        html += '<td>' + escapeHtml(displayLicense) + '</td>';
        html += '<td>' + escapeHtml(displayName) + '</td>';
        html += '<td>' + escapeHtml(displayWeapon) + '</td>';
        html += '</tr>';
      });
      if (group.indices.length > 200) {
        html += '<tr><td colspan="4" style="text-align:center;color:#64748b;">عرض أول 200 سجل فقط...</td></tr>';
      }
      html += '</tbody></table></div></div>';
    });
    html += '</div>';
    content.innerHTML = html;
    wireFocusButtons();
  } catch (e) {
    content.innerHTML = '<div style="padding:12px;color:#b00;">حدث خطأ أثناء فحص التكرار</div>';
    frame.style.display = 'block';
    console.error('dup-check error', e);
  }
}


  function closeDupFrame(){ const frame = document.getElementById('dupFrame'); if (frame) frame.style.display = 'none'; }

  function openWithdrawOptionsFrame(){ const frame = document.getElementById('withdrawOptionsFrame'); if (frame) frame.style.display = 'flex'; }

  function closeWithdrawOptionsFrame(){ const frame = document.getElementById('withdrawOptionsFrame'); if (frame) frame.style.display = 'none'; }

  function runStandardWithdrawAudit(){
    closeWithdrawOptionsFrame();
    try {
      if (typeof window.resetSheetFilters === 'function') {
        window.resetSheetFilters();
      }
    } catch (_) {}
    const frame = document.getElementById('withdrawFrame');
    const titleEl = frame ? frame.querySelector('h3') : null;
    if (titleEl) titleEl.textContent = 'نتائج فحص الاسلحة المسحوبة';
    try {
      if (typeof window.filterWithdrawnMissingDeposit === 'function') {
        window.filterWithdrawnMissingDeposit();
        return;
      }
    } catch (_) {}
    openWithdrawnChecker();
  }

  function runOppositeWithdrawAudit(){
    closeWithdrawOptionsFrame();
    try {
      if (typeof window.resetSheetFilters === 'function') {
        window.resetSheetFilters();
      }
    } catch (_) {}
    openNonWithdrawnWithDepositsChecker();
  }

  async function openCoreFieldsAudit() {
    const frame = document.getElementById('coreAuditFrame');
    const content = document.getElementById('coreAuditContent');
    if (!frame || !content) return;
    frame.style.display = 'block';
    content.innerHTML = '<div style="padding:16px;text-align:center;font-weight:700;color:#475569;">جاري تدقيق الحقول الأساسية...</div>';
    try {
      const { headers, rows } = await ensureCsvDataset();
      if (!headers.length || !rows.length) {
        content.innerHTML = '<div style="padding:18px;text-align:center;color:#b91c1c;font-weight:700;">تعذر تحميل بيانات CSV.</div>';
        return;
      }

      const normalizedHeaders = headers.map(h => String(h || '').replace(/^\uFEFF/, '').trim());
      const normalizedLower = normalizedHeaders.map(h => h.toLowerCase());
      const findIdx = (names) => {
        const lc = names.map(n => String(n || '').trim().toLowerCase());
        for (let i = 0; i < normalizedLower.length; i++) {
          const candidate = normalizedLower[i];
          if (!candidate) continue;
          for (const name of lc) {
            if (!name) continue;
            if (candidate === name) return i;
            if (candidate.includes(name)) return i;
          }
        }
        return -1;
      };

      const licenseIdx = findIdx(['رقم القيد', 'رقم']);
      const nameIdx = findIdx(['الاسم']);
      const addressIdx = findIdx(['العنوان']);
      const weaponsIdx = findIdx(['بيانات السلاح', 'بيان السلاح', 'السلاح']);
      const decisionIdx = findIdx(['تاريخ قرار اللغاء']);

      const warnings = [];
      if (nameIdx === -1) warnings.push('⚠️ عمود "الاسم" غير موجود.');
      if (addressIdx === -1) warnings.push('⚠️ عمود "العنوان" غير موجود.');
      if (weaponsIdx === -1) warnings.push('⚠️ عمود "بيانات السلاح" غير موجود.');
      if (decisionIdx === -1) warnings.push('⚠️ عمود "تاريخ قرار اللغاء" غير موجود.');

      const categories = [];
      if (nameIdx !== -1) categories.push({ id: 'missing-name', title: 'سجلات بلا اسم', focusLabel: 'الاسم مفقود', indices: [], samples: [] });
      if (addressIdx !== -1) categories.push({ id: 'missing-address', title: 'سجلات بلا عنوان', focusLabel: 'العنوان مفقود', indices: [], samples: [] });
      if (weaponsIdx !== -1) categories.push({ id: 'missing-weapons', title: 'سجلات بلا بيانات سلاح', focusLabel: 'بيانات السلاح مفقودة', indices: [], samples: [] });
      if (decisionIdx !== -1) categories.push({ id: 'missing-decision', title: 'سجلات بلا تاريخ قرار اللغاء', focusLabel: 'تاريخ القرار مفقود', indices: [], samples: [] });

      if (!categories.length) {
        content.innerHTML = '<div style="padding:18px;text-align:center;color:#b91c1c;font-weight:700;">لا يمكن إجراء التدقيق لغياب الأعمدة المطلوبة.</div>';
        return;
      }

      const categoryById = new Map(categories.map(c => [c.id, c]));
      rows.forEach((row, idx) => {
        const licenseVal = licenseIdx !== -1 ? String(row[licenseIdx] || '').trim() : '';
        const entry = {
          license: licenseVal,
          name: nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '',
          address: addressIdx !== -1 ? String(row[addressIdx] || '').trim() : '',
          weapons: weaponsIdx !== -1 ? String(row[weaponsIdx] || '').trim() : '',
          decision: decisionIdx !== -1 ? String(row[decisionIdx] || '').trim() : ''
        };

        if (nameIdx !== -1 && !entry.name) {
          const cat = categoryById.get('missing-name');
          cat.indices.push(idx);
          if (cat.samples.length < 6) cat.samples.push(entry);
        }
        if (addressIdx !== -1 && !entry.address) {
          const cat = categoryById.get('missing-address');
          cat.indices.push(idx);
          if (cat.samples.length < 6) cat.samples.push(entry);
        }
        if (weaponsIdx !== -1) {
          const parts = splitWeaponNames(entry.weapons);
          if (!parts.length) {
            const cat = categoryById.get('missing-weapons');
            cat.indices.push(idx);
            if (cat.samples.length < 6) cat.samples.push(entry);
          }
        }
        if (decisionIdx !== -1 && !entry.decision) {
          const cat = categoryById.get('missing-decision');
          cat.indices.push(idx);
          if (cat.samples.length < 6) cat.samples.push(entry);
        }
      });

      const activeCategories = categories.filter(c => c.indices.length);
      if (!activeCategories.length) {
        let html = '<div style="padding:18px;text-align:center;color:#0f172a;font-weight:700;">لا توجد نواقص في الحقول المحددة.</div>';
        if (warnings.length) {
          html += '<div style="margin-top:10px;color:#b91c1c;font-weight:600;">' + warnings.map(escapeHtml).join('<br/>') + '</div>';
        }
        content.innerHTML = html;
        return;
      }

      let html = '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:12px;">';
      html += `<div style=\"font-weight:700;color:#0f172a;\">الفئات التي تحتاج مراجعة: ${activeCategories.length}</div>`;
      html += '<div class="audit-actions">';
      html += '<button id="btnAuditClearFocus" style="padding:8px 14px;border-radius:8px;border:none;background:#0f172a;color:#fff;font-weight:600;cursor:pointer;">إظهار كل السجلات</button>';
      html += '</div></div>';
      if (warnings.length) {
        html += '<div style="margin-bottom:12px;color:#b91c1c;font-weight:600;">' + warnings.map(escapeHtml).join('<br/>') + '</div>';
      }

      const sampleColumns = [
        { key: 'license', label: 'رقم القيد', visible: licenseIdx !== -1 },
        { key: 'name', label: 'الاسم', visible: nameIdx !== -1 },
        { key: 'address', label: 'العنوان', visible: addressIdx !== -1 },
        { key: 'weapons', label: 'بيانات السلاح', visible: weaponsIdx !== -1 },
        { key: 'decision', label: 'تاريخ القرار', visible: decisionIdx !== -1 }
      ].filter(col => col.visible);

      html += '<div style="display:flex;flex-direction:column;gap:12px;">';
      activeCategories.forEach(cat => {
        html += '<div class="audit-card">';
        html += '<div class="audit-header">';
        html += `<div style=\"font-weight:700;color:#0f172a;\">${escapeHtml(cat.title)}</div>`;
        html += '<div class="audit-actions">';
        html += `<span class=\"audit-count\">${cat.indices.length}</span>`;
        html += `<button class=\"audit-run-btn\" data-audit=\"${escapeHtml(cat.id)}\" style=\"padding:6px 10px;border-radius:6px;border:none;background:#0f172a;color:#fff;cursor:pointer;\">فحص</button>`;
        html += '</div></div>';
        html += '<div class="audit-samples">';
        html += '<table><thead><tr>';
        sampleColumns.forEach(col => { html += `<th>${escapeHtml(col.label)}</th>`; });
        html += '</tr></thead><tbody>';
        cat.samples.forEach(sample => {
          html += '<tr>';
          sampleColumns.forEach(col => { html += `<td>${escapeHtml(sample[col.key] || '')}</td>`; });
          html += '</tr>';
        });
        if (!cat.samples.length) {
          html += `<tr><td colspan="${sampleColumns.length}" style="text-align:center;color:#64748b;">لا توجد عينات للعرض</td></tr>`;
        }
        html += '</tbody></table>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';

      content.innerHTML = html;
      setTimeout(() => {
        const clearBtn = document.getElementById('btnAuditClearFocus');
        if (clearBtn) clearBtn.addEventListener('click', () => {
          window.__auditFocusSet = null;
          window.__auditFocusLabel = '';
          try {
            if (typeof window.applyFilter === 'function') window.applyFilter();
            else if (typeof window.applyAllFilters === 'function') window.applyAllFilters();
          } catch (_) {}
        });
        document.querySelectorAll('.audit-run-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-audit');
            const target = activeCategories.find(c => c.id === id);
            if (!target) return;
            window.__auditFocusSet = new Set(target.indices);
            window.__auditFocusLabel = target.focusLabel || target.title;
            try {
              if (typeof window.applyFilter === 'function') window.applyFilter();
              else if (typeof window.applyAllFilters === 'function') window.applyAllFilters();
            } catch (_) {}
            frame.style.display = 'none';
          });
        });
      }, 20);
    } catch (e) {
      content.innerHTML = `<div style=\"padding:18px;text-align:center;color:#b91c1c;font-weight:700;\">حدث خطأ أثناء التدقيق: ${escapeHtml(e && e.message ? e.message : String(e || ''))}</div>`;
    }
  }

  async function openNoNumberWeaponsAudit() {
    const frame = document.getElementById('noNumberWeaponsFrame');
    const content = document.getElementById('noNumberWeaponsContent');
    if (!frame || !content) return;
    frame.style.display = 'block';
    content.innerHTML = '<div style="padding:16px;text-align:center;font-weight:700;color:#475569;">جاري فحص بيانات السلاح...</div>';
    try {
      const { headers, rows } = await ensureCsvDataset();
      if (!headers.length || !rows.length) {
        content.innerHTML = '<div style="padding:18px;text-align:center;color:#b91c1c;font-weight:700;">تعذر تحميل بيانات CSV.</div>';
        return;
      }

      const normalizedHeaders = headers.map(h => String(h || '').replace(/^\uFEFF/, '').trim());
      const normalizedLower = normalizedHeaders.map(h => h.toLowerCase());
      const findIdx = (names) => {
        const lc = names.map(n => String(n || '').trim().toLowerCase());
        for (let i = 0; i < normalizedLower.length; i++) {
          const candidate = normalizedLower[i];
          if (!candidate) continue;
          for (const name of lc) {
            if (!name) continue;
            if (candidate === name) return i;
            if (candidate.includes(name)) return i;
          }
        }
        return -1;
      };

      const licenseIdx = findIdx(['رقم القيد', 'رقم']);
      const nameIdx = findIdx(['الاسم']);
      const weaponsIdx = findIdx(['بيانات السلاح', 'بيان السلاح', 'السلاح']);
      if (weaponsIdx === -1) {
        content.innerHTML = '<div style="padding:18px;text-align:center;color:#b91c1c;font-weight:700;">تعذر تحديد عمود "بيانات السلاح".</div>';
        return;
      }
      const sectorIdx = findIdx(['القطاع']);
      const stationIdx = findIdx(['القسم', 'القسم التابع']);

      const digitRegex = /[0-9\u0660-\u0669\u06F0-\u06F9]/;
      const DECORATIVE_KEYWORDS = ['للزينة', 'للزينه', 'زينة', 'زينه', 'سيف', 'خنجر', 'سكين', 'سكينة', 'رمح', 'حربة', 'سهم', 'قوس', 'عصا', 'هراوة', 'درع'];
      const isDecorativeWeapon = (text) => {
        if (!text) return false;
        const lower = String(text).toLowerCase();
        return DECORATIVE_KEYWORDS.some(kw => lower.includes(kw));
      };
      const records = [];
      const sectorBuckets = new Map();
      const globalStationBucket = { stations: new Set(), hasMissing: false };
      const sectorLabelMap = (window.WeaponsData && window.WeaponsData.sectorKeyToLabel && Object.keys(window.WeaponsData.sectorKeyToLabel).length)
        ? window.WeaponsData.sectorKeyToLabel
        : { east: 'الشرق', west: 'الغرب', south: 'الجنوب', north: 'الشمال', sectorfive: 'القطاع التجريبي الخامس' };
      const labelToKey = (window.WeaponsData && window.WeaponsData.sectorLabelToKey && Object.keys(window.WeaponsData.sectorLabelToKey).length)
        ? window.WeaponsData.sectorLabelToKey
        : Object.fromEntries(Object.entries(sectorLabelMap).map(([k, v]) => [v, k]));
      const sectorOptionsMap = new Map();

      const ensureSectorBucket = (value) => {
        if (!sectorBuckets.has(value)) sectorBuckets.set(value, { stations: new Set(), hasMissing: false });
        return sectorBuckets.get(value);
      };

      const registerSectorOption = (value, label) => {
        if (!sectorOptionsMap.has(value)) {
          sectorOptionsMap.set(value, { label: label || 'بدون قطاع' });
        }
      };

      rows.forEach((row, idx) => {
        const raw = String(row[weaponsIdx] || '').trim();
        if (!raw) return;
        if (digitRegex.test(raw)) return;
        if (isDecorativeWeapon(raw)) return; // Skip decorative weapons (swords, daggers, etc.)
        const sectorRaw = sectorIdx !== -1 ? String(row[sectorIdx] || '').trim() : '';
        const stationRaw = stationIdx !== -1 ? String(row[stationIdx] || '').trim() : '';
        let sectorKey = null;
        try {
          if (typeof window.determineSectorKeyFromValue === 'function') {
            sectorKey = window.determineSectorKeyFromValue(sectorRaw);
          }
        } catch (_) {}
        if (!sectorKey && stationRaw) {
          try {
            if (typeof window.detectSectorKeyForStationName === 'function') {
              sectorKey = window.detectSectorKeyForStationName(stationRaw);
            }
          } catch (_) {}
        }
        if (!sectorKey && sectorRaw) {
          const cleaned = sectorRaw.replace(/^قطاع\s+/u, '').trim();
          sectorKey = labelToKey[sectorRaw] || labelToKey[cleaned] || null;
        }
        const sectorLabel = sectorKey ? (sectorLabelMap[sectorKey] || sectorRaw || 'غير محدد') : (sectorRaw || 'غير محدد');
        const sectorValue = sectorKey ? `key|${sectorKey}` : (sectorRaw ? `raw|${sectorRaw}` : 'none');
        registerSectorOption(sectorValue, sectorValue === 'none' ? 'بدون قطاع' : sectorLabel);
        const bucket = ensureSectorBucket(sectorValue);
        if (stationRaw) bucket.stations.add(stationRaw); else bucket.hasMissing = true;
        if (stationRaw) globalStationBucket.stations.add(stationRaw); else globalStationBucket.hasMissing = true;
        const entry = {
          index: idx,
          license: licenseIdx !== -1 ? String(row[licenseIdx] || '').trim() : '',
          name: nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '',
          weapons: raw,
          sectorValue,
          sectorLabel,
          sectorKey,
          sectorRaw,
          station: stationRaw,
          stationValue: stationRaw ? `station|${stationRaw}` : 'station_none'
        };
        records.push(entry);
      });

      if (!records.length) {
        content.innerHTML = '<div style="padding:18px;text-align:center;color:#0f172a;font-weight:700;">لا توجد سجلات تحتوي على بيانات سلاح بلا أرقام.</div>';
        return;
      }

      const totalCount = records.length;
      const sectorOptionsArray = Array.from(sectorOptionsMap.entries()).map(([value, info]) => ({ value, label: info.label || 'بدون قطاع' }));
      sectorOptionsArray.sort((a, b) => a.label.localeCompare(b.label, 'ar', { sensitivity: 'base' }));

      let html = '<div class="nonum-actions">';
      html += '<span id="nonumBadge" class="nonum-badge">عدد السجلات: ' + totalCount + '</span>';
      html += '<button id="btnNonumShowTable" style="padding:8px 14px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-weight:600;cursor:pointer;">إظهار في الجدول</button>';
      html += '<button id="btnNonumClearFocus" style="padding:8px 14px;border-radius:8px;border:1px solid #cbd5f5;background:#ffffff;color:#0f172a;font-weight:600;cursor:pointer;">إظهار كل السجلات</button>';
      html += '</div>';

      html += '<div class="nonum-filters" style="display:flex;gap:12px;flex-wrap:wrap;margin:12px 0;">';
      html += '<label style="display:flex;flex-direction:column;gap:6px;font-weight:600;color:#0f172a;">';
      html += '<span>تصفية بالقطاع</span>';
      html += '<select id="nonumSectorFilter" style="min-width:200px;padding:6px 10px;border-radius:8px;border:1px solid #d0d7ee;"></select>';
      html += '</label>';
      html += '<label style="display:flex;flex-direction:column;gap:6px;font-weight:600;color:#0f172a;">';
      html += '<span>تصفية بالقسم</span>';
      html += '<select id="nonumStationFilter" style="min-width:200px;padding:6px 10px;border-radius:8px;border:1px solid #d0d7ee;"></select>';
      html += '</label>';
      html += '</div>';

      html += '<div class="nonum-card">';
      html += '<div class="nonum-header">';
      html += '<div style="font-weight:700;color:#0f172a;">السجلات ذات بيانات سلاح بلا أرقام</div>';
      html += '</div>';
      html += '<div id="nonumTableWrapper" style="overflow:auto;"></div>';
      html += '</div>';

      content.innerHTML = html;

      const badgeEl = document.getElementById('nonumBadge');
      const tableWrapper = document.getElementById('nonumTableWrapper');
      const sectorSelect = document.getElementById('nonumSectorFilter');
      const stationSelect = document.getElementById('nonumStationFilter');
      const showBtn = document.getElementById('btnNonumShowTable');
      const clearBtn = document.getElementById('btnNonumClearFocus');

      const renderTable = (list) => {
        if (!tableWrapper) return;
        if (!list.length) {
          tableWrapper.innerHTML = '<div style="padding:18px;text-align:center;color:#b91c1c;font-weight:700;">لا توجد سجلات مطابقة لخيارات التصفية الحالية.</div>';
          return;
        }
        const includeSector = sectorIdx !== -1;
        const includeStation = stationIdx !== -1;
        const colCount = (licenseIdx !== -1 ? 1 : 0) + (nameIdx !== -1 ? 1 : 0) + (includeSector ? 1 : 0) + (includeStation ? 1 : 0) + 1;
        let tableHtml = '<table class="nonum-matrix"><thead><tr>';
        if (licenseIdx !== -1) tableHtml += '<th>رقم القيد</th>';
        if (nameIdx !== -1) tableHtml += '<th>الاسم</th>';
        if (includeSector) tableHtml += '<th>القطاع</th>';
        if (includeStation) tableHtml += '<th>القسم</th>';
        tableHtml += '<th>بيانات السلاح</th>';
        tableHtml += '</tr></thead><tbody>';
        list.slice(0, 200).forEach(rec => {
          tableHtml += '<tr>';
          if (licenseIdx !== -1) tableHtml += '<td>' + escapeHtml(rec.license || '') + '</td>';
          if (nameIdx !== -1) tableHtml += '<td>' + escapeHtml(rec.name || '') + '</td>';
          if (includeSector) tableHtml += '<td>' + escapeHtml(rec.sectorLabel || '') + '</td>';
          if (includeStation) tableHtml += '<td>' + escapeHtml(rec.station || '') + '</td>';
          tableHtml += '<td>' + escapeHtml(rec.weapons || '') + '</td>';
          tableHtml += '</tr>';
        });
        if (list.length > 200) {
          tableHtml += `<tr><td colspan="${colCount}" style="text-align:center;color:#64748b;">عرض أول 200 سجل فقط...</td></tr>`;
        }
        tableHtml += '</tbody></table>';
        tableWrapper.innerHTML = tableHtml;
      };

      const updateBadge = (count) => {
        if (!badgeEl) return;
        if (count === totalCount) {
          badgeEl.textContent = `عدد السجلات: ${totalCount}`;
        } else {
          badgeEl.textContent = `عدد السجلات: ${count} / ${totalCount}`;
        }
      };

      if (sectorSelect) {
        const optionFragments = ['<option value="all">جميع القطاعات</option>'];
        sectorOptionsArray.forEach(opt => {
          optionFragments.push(`<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`);
        });
        sectorSelect.innerHTML = optionFragments.join('');
        sectorSelect.value = 'all';
      }

      const rebuildStationOptions = (sectorValue) => {
        if (!stationSelect) return;
        const target = sectorValue === 'all'
          ? globalStationBucket
          : (sectorBuckets.get(sectorValue) || { stations: new Set(), hasMissing: false });
        const opts = ['<option value="station_all">جميع الأقسام</option>'];
        if (target.hasMissing) opts.push('<option value="station_none">بدون قسم</option>');
        const stationsSorted = Array.from(target.stations || [])
          .sort((a, b) => a.localeCompare(b, 'ar', { sensitivity: 'base' }));
        stationsSorted.forEach(st => {
          opts.push(`<option value="${'station|' + escapeHtml(st)}">${escapeHtml(st)}</option>`);
        });
        stationSelect.innerHTML = opts.join('');
        stationSelect.value = 'station_all';
        stationSelect.disabled = opts.length <= 1;
      };

      rebuildStationOptions('all');

      let activeRecords = records.slice();

      const applyFilters = () => {
        const sectorValue = sectorSelect ? (sectorSelect.value || 'all') : 'all';
        const stationValue = stationSelect ? (stationSelect.value || 'station_all') : 'station_all';
        activeRecords = records.filter(rec => {
          let sectorMatch = true;
          if (sectorValue === 'none') sectorMatch = rec.sectorValue === 'none';
          else if (sectorValue !== 'all') sectorMatch = rec.sectorValue === sectorValue;
          if (!sectorMatch) return false;
          if (stationValue === 'station_all') return true;
          if (stationValue === 'station_none') return rec.stationValue === 'station_none';
          return rec.stationValue === stationValue;
        });
        renderTable(activeRecords);
        updateBadge(activeRecords.length);
      };

      if (sectorSelect) {
        sectorSelect.addEventListener('change', () => {
          const selected = sectorSelect.value || 'all';
          rebuildStationOptions(selected);
          applyFilters();
        });
      }

      if (stationSelect) {
        stationSelect.addEventListener('change', () => {
          applyFilters();
        });
      }

      applyFilters();

      if (showBtn) {
        showBtn.addEventListener('click', () => {
          if (!activeRecords.length) {
            alert('لا توجد سجلات مطابقة حالياً.');
            return;
          }
          try {
            if (typeof window.resetSheetFilters === 'function') {
              window.resetSheetFilters({ skipApply: true });
            }
          } catch (_) {}
          const focusSet = new Set(activeRecords.map(r => r.index));
          window.__auditFocusSet = focusSet;
          window.__auditFocusLabel = 'أسلحة غير مرقمة';
          try {
            if (typeof window.applyFilter === 'function') window.applyFilter();
            else if (typeof window.applyAllFilters === 'function') window.applyAllFilters();
          } catch (_) {}
          frame.style.display = 'none';
        });
      }

      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          window.__auditFocusSet = null;
          window.__auditFocusLabel = '';
          try {
            if (typeof window.applyFilter === 'function') window.applyFilter();
            else if (typeof window.applyAllFilters === 'function') window.applyAllFilters();
          } catch (_) {}
        });
      }
    } catch (e) {
      content.innerHTML = `<div style="padding:18px;text-align:center;color:#b91c1c;font-weight:700;">حدث خطأ أثناء الفحص: ${escapeHtml(e && e.message ? e.message : String(e || ''))}</div>`;
    }
  }

  let importCsvText = '';
  let importPreviewState = null;

  function readImportFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('failed to read file'));
      reader.readAsText(file, 'utf-8');
    });
  }

  async function postImportJson(path, payload) {
    const response = await fetch(buildWeaponsApiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json || json.ok === false) {
      const message = json && json.message ? json.message : `HTTP ${response.status}`;
      const error = new Error(message);
      error.payload = json;
      throw error;
    }
    return json;
  }

  function collectImportMapping() {
    const selects = Array.from(document.querySelectorAll('.sql-import-map-select'));
    const mapping = {};
    selects.forEach((select) => {
      const key = select.getAttribute('data-key');
      const value = select.value;
      if (!key || value === '') return;
      const numeric = Number(value);
      mapping[key] = Number.isInteger(numeric) ? numeric : value;
    });
    return mapping;
  }

  function setImportMessage(text, color = '#475569') {
    const el = document.getElementById('sqlImportMessage');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = color;
  }

  function updateImportRequiredState() {
    const btn = document.getElementById('sqlImportReplaceBtn');
    const requiredWarning = document.getElementById('sqlImportRequiredWarning');
    if (!btn || !importPreviewState) return;
    const mapping = collectImportMapping();
    const missing = (importPreviewState.schema?.columns || [])
      .filter((column) => column.required && (mapping[column.key] == null || mapping[column.key] === ''))
      .map((column) => column.label);
    btn.disabled = missing.length > 0;
    if (requiredWarning) {
      requiredWarning.textContent = missing.length
        ? 'يجب ربط الأعمدة المطلوبة: ' + missing.join('، ')
        : '';
    }
  }

  function renderImportMappedPreview(preview) {
    const holder = document.getElementById('sqlImportPreviewTable');
    if (!holder) return;
    const columns = importPreviewState?.schema?.columns || [];
    const rows = Array.isArray(preview?.mappedPreview) ? preview.mappedPreview : [];
    if (!rows.length) {
      holder.innerHTML = '<div class="sql-import-empty">لا توجد صفوف معاينة.</div>';
      return;
    }
    const visibleColumns = columns.filter((column) => {
      const select = document.querySelector(`.sql-import-map-select[data-key="${column.key}"]`);
      return select && select.value !== '';
    });
    const columnsToRender = visibleColumns.length ? visibleColumns : columns;
    let html = '<table class="sql-import-preview-table"><thead><tr>';
    columnsToRender.forEach((column) => { html += `<th>${escapeHtml(column.label)}</th>`; });
    html += '</tr></thead><tbody>';
    rows.forEach((row) => {
      html += '<tr>';
      columnsToRender.forEach((column) => {
        html += `<td>${escapeHtml(row && row[column.key] != null ? row[column.key] : '')}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    holder.innerHTML = html;
  }

  async function refreshImportPreviewFromMapping() {
    if (!importCsvText) return;
    try {
      const result = await postImportJson('/api/import/preview', {
        csvText: importCsvText,
        mapping: collectImportMapping()
      });
      importPreviewState = {
        schema: result.schema,
        preview: result.preview
      };
      renderImportMappedPreview(result.preview);
      updateImportRequiredState();
    } catch (error) {
      setImportMessage('فشل تحديث المعاينة: ' + error.message, '#b91c1c');
    }
  }

  function renderSqlImportMapper(schema, preview) {
    const mapper = document.getElementById('sqlImportMapper');
    const meta = document.getElementById('sqlImportMeta');
    if (!mapper || !schema || !preview) return;
    const headers = Array.isArray(preview.headers) ? preview.headers : [];
    const suggested = preview.suggestedMapping || {};
    if (meta) {
      meta.innerHTML = `
        <div class="sql-import-stat"><span>صفوف CSV</span><strong>${escapeHtml(preview.totalRows || 0)}</strong></div>
        <div class="sql-import-stat"><span>أعمدة CSV</span><strong>${escapeHtml(headers.length)}</strong></div>
        <div class="sql-import-stat"><span>أعمدة SQL</span><strong>${escapeHtml((schema.columns || []).length)}</strong></div>
      `;
    }
    const sourceOptions = headers.map((header, index) =>
      `<option value="${index}">${escapeHtml(index + 1)} - ${escapeHtml(header || '(بدون اسم)')}</option>`
    ).join('');
    let html = `
      <div class="sql-import-note">اربط كل عمود في SQL بعمود CSV المناسب. الأعمدة غير المربوطة ستدخل فارغة.</div>
      <div class="sql-import-grid-head">
        <span>#</span>
        <span>عمود SQL</span>
        <span>عمود CSV</span>
        <span>مطلوب</span>
      </div>
    `;
    (schema.columns || []).forEach((column, index) => {
      const selected = suggested[column.key];
      html += `
        <div class="sql-import-map-row">
          <div class="sql-import-map-index">${escapeHtml(index + 1)}</div>
          <div class="sql-import-sql-col">
            <strong>${escapeHtml(column.label)}</strong>
            <span>${escapeHtml(column.key)}</span>
          </div>
          <select class="sql-import-map-select" data-key="${escapeHtml(column.key)}">
            <option value="">لا يستورد</option>
            ${sourceOptions}
          </select>
          <div class="sql-import-required">${column.required ? 'نعم' : ''}</div>
        </div>
      `;
    });
    mapper.innerHTML = html;
    mapper.querySelectorAll('.sql-import-map-select').forEach((select) => {
      const key = select.getAttribute('data-key');
      if (Object.prototype.hasOwnProperty.call(suggested, key)) {
        select.value = String(suggested[key]);
      }
      select.addEventListener('change', () => {
        updateImportRequiredState();
        refreshImportPreviewFromMapping();
      });
    });
    renderImportMappedPreview(preview);
    updateImportRequiredState();
  }

  async function openSqlImportFrame() {
    const frame = document.getElementById('sqlImportFrame');
    const content = document.getElementById('sqlImportContent');
    if (!frame || !content) return;
    frame.style.display = 'block';
    importCsvText = '';
    importPreviewState = null;
    content.innerHTML = '<div class="sql-import-loading">جاري تحميل إعدادات الاستيراد...</div>';

    try {
      const schemaResponse = await fetch(buildWeaponsApiUrl('/api/import/schema'), { cache: 'no-store' });
      const schemaPayload = await schemaResponse.json().catch(() => null);
      if (!schemaResponse.ok || !schemaPayload || schemaPayload.ok === false) {
        throw new Error(schemaPayload?.message || `HTTP ${schemaResponse.status}`);
      }
      const schema = schemaPayload.schema;
      const stats = schemaPayload.stats || {};
      content.innerHTML = `
        <div class="sql-import-layout">
          <div class="sql-import-toolbar">
            <div>
              <div class="sql-import-title">استيراد CSV إلى قاعدة SQL</div>
              <div class="sql-import-subtitle">البيانات الحالية في SQL: ${escapeHtml(stats.totalRows || 0)} سجل.</div>
            </div>
            <label class="sql-import-file-btn">
              اختيار CSV
              <input id="sqlImportFileInput" type="file" accept=".csv,text/csv" />
            </label>
          </div>
          <div id="sqlImportMessage" class="sql-import-message">اختر ملف CSV ثم اربط الأعمدة قبل الاستبدال.</div>
          <div id="sqlImportMeta" class="sql-import-meta"></div>
          <div id="sqlImportMapper" class="sql-import-mapper"></div>
          <div id="sqlImportRequiredWarning" class="sql-import-required-warning"></div>
          <div class="sql-import-actions">
            <button id="sqlImportReplaceBtn" class="sql-import-replace" disabled>استبدال بيانات SQL بهذا CSV</button>
          </div>
          <div class="sql-import-preview-title">معاينة البيانات بعد الربط</div>
          <div id="sqlImportPreviewTable" class="sql-import-preview-table-wrap"></div>
        </div>
      `;

      const fileInput = document.getElementById('sqlImportFileInput');
      fileInput?.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        try {
          setImportMessage('جاري قراءة الملف...');
          importCsvText = await readImportFileAsText(file);
          const result = await postImportJson('/api/import/preview', { csvText: importCsvText });
          importPreviewState = { schema: result.schema || schema, preview: result.preview };
          renderSqlImportMapper(result.schema || schema, result.preview);
          setImportMessage(`تم قراءة ${file.name}. راجع الربط ثم اضغط الاستبدال.`, '#047857');
        } catch (error) {
          importCsvText = '';
          importPreviewState = null;
          document.getElementById('sqlImportMapper').innerHTML = '';
          document.getElementById('sqlImportPreviewTable').innerHTML = '';
          setImportMessage('فشل قراءة أو تحليل CSV: ' + error.message, '#b91c1c');
        }
      });

      document.getElementById('sqlImportReplaceBtn')?.addEventListener('click', async () => {
        if (!importCsvText || !importPreviewState) return;
        updateImportRequiredState();
        const btn = document.getElementById('sqlImportReplaceBtn');
        if (btn.disabled) return;
        const ok = confirm('سيتم استبدال كل بيانات SQL الحالية بالبيانات المستوردة. سيتم إنشاء نسخة CSV احتياطية قبل الاستبدال. هل تريد المتابعة؟');
        if (!ok) return;
        btn.disabled = true;
        btn.textContent = 'جاري الاستيراد...';
        try {
          const result = await postImportJson('/api/import/replace', {
            csvText: importCsvText,
            mapping: collectImportMapping(),
            confirm: 'replace'
          });
          setImportMessage(`${result.message || 'تم الاستيراد'} - تم إنشاء نسخة احتياطية.`, '#047857');
          if (typeof window.refreshWeaponsSheetFromServer === 'function') {
            await window.refreshWeaponsSheetFromServer({ force: true, preservePage: false, preserveScroll: false });
          }
        } catch (error) {
          const missing = error.payload && Array.isArray(error.payload.missingRequired)
            ? ' (' + error.payload.missingRequired.join('، ') + ')'
            : '';
          setImportMessage('فشل الاستيراد: ' + error.message + missing, '#b91c1c');
        } finally {
          btn.textContent = 'استبدال بيانات SQL بهذا CSV';
          updateImportRequiredState();
        }
      });
    } catch (error) {
      content.innerHTML = `<div style="padding:18px;text-align:center;color:#b91c1c;font-weight:700;">تعذر فتح الاستيراد: ${escapeHtml(error.message || String(error))}</div>`;
    }
  }

  function initWeaponsSettingsUi() {
    if (settingsUiInitialized) return;
    settingsUiInitialized = true;
    // Wire settings toggle
    const settingsToggle = document.getElementById('settingsToggle');
    if (settingsToggle) settingsToggle.addEventListener('click', (e) => { e.preventDefault(); toggleSettingsSidebar(); });

    // Create settings sidebar DOM if not present (inject to body)
    if (!document.getElementById('settingsSidebar')) {
      const sb = document.createElement('div');
      sb.id = 'settingsSidebar';
      sb.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <strong>الإعدادات</strong>
          <button id="settingsClose" style="background:#000000ff;border:none;padding:6px 8px;border-radius:6px;">✖</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
            <button id="btnDupCheck" class="settings-btn" style="background:#000000ff;border:1px solid #000000ff;padding:10px;border-radius:8px;font-weight:700;">فحص المتكرر</button>
            <div style="font-size:0.95em;color:#666;padding-top:6px;">اظهار السجلات التي لها نفس الاسم ونفس رقم القيد</div>
            <hr/>
            <button id="btnWithdrawCheck" class="settings-btn" style="background:#006400ff;border:1px solid #006400ff;padding:10px;border-radius:8px;font-weight:700;color:#fff;">فحص الاسلحة المسحوبة</button>
            <div style="font-size:0.95em;color:#666;padding-top:6px;">اظهار الاسلحة التي ليس لديها تاريخ/رقم الايداع او ملاحظات (يعتبر مسحوباً)</div>
      <hr/>
      <button id="btnCoreAudit" class="settings-btn" style="background:#0f172a;border:1px solid #0f172a;padding:10px;border-radius:8px;font-weight:700;color:#fff;">تدقيق الحقول الأساسية</button>
      <div style="font-size:0.95em;color:#666;padding-top:6px;">البحث عن السجلات التي تفتقد الاسم أو العنوان أو بيانات السلاح أو تاريخ قرار اللغاء مع إمكانية عرضها مباشرةً.</div>
      <hr/>
      <button id="btnNoNumberWeapons" class="settings-btn" style="background:#2563eb;border:1px solid #1d4ed8;padding:10px;border-radius:8px;font-weight:700;color:#fff;">فحص عن اسلحة غير مرقمة</button>
      <div style="font-size:0.95em;color:#666;padding-top:6px;">اكتشاف السجلات التي تحتوي على بيانات سلاح بلا أرقام أو تدوين رقمي.</div>
      <hr/>
      <button id="btnModelSettings" class="settings-btn" style="background:#7c3aed;border:1px solid #6d28d9;padding:10px;border-radius:8px;font-weight:700;color:#fff;">⚙️ إعدادات نظام التحذيرات</button>
      <div style="font-size:0.95em;color:#666;padding-top:6px;">التحكم في نظام التحذيرات الذكية وما يُعرض منها في الجدول.</div>
      <hr/>
      <button id="btnSqlImport" class="settings-btn" style="background:#0f766e;border:1px solid #115e59;padding:10px;border-radius:8px;font-weight:700;color:#fff;">استيراد CSV إلى SQL</button>
      <div style="font-size:0.95em;color:#666;padding-top:6px;">استبدال بيانات قاعدة SQL بملف CSV بعد ربط الأعمدة يدوياً.</div>
        </div>
      `;
      document.body.appendChild(sb);
      // sidebar styles
      const st = document.createElement('style'); st.id = 'settings-sidebar-style';
      st.textContent = `
        #settingsSidebar{position:fixed;top:0;right:0;height:100%;max-height:100vh;width:320px;box-sizing:border-box;overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable;overscroll-behavior:contain;transform:translateX(100%);transition:transform .22s ease;z-index:2200;background:#fff;border-left:1px solid #e6e6e6;padding:18px;box-shadow:-8px 0 30px rgba(0,0,0,0.08);}
        #settingsSidebar.open{transform:translateX(0);} #settingsSidebar .settings-btn{cursor:pointer}
      `; document.head.appendChild(st);
    }

    // dup frame: modal-like wide frame
    if (!document.getElementById('dupFrame')) {
      const df = document.createElement('div'); df.id = 'dupFrame'; df.style.display='none'; df.style.position='fixed'; df.style.zIndex='3000'; df.style.left='2%'; df.style.right='2%'; df.style.top='4%'; df.style.bottom='4%'; df.style.background='#fff'; df.style.padding='12px'; df.style.boxShadow='0 30px 80px rgba(0,0,0,0.35)'; df.style.borderRadius='10px'; df.style.overflow='auto';
      df.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <h3 id="dupFrameTitle" style="margin:0;">فحص التكرار</h3>
          <div style="display:flex;gap:8px;align-items:center;"><button id="dupFrameClose" style="padding:6px 8px;border-radius:6px;border:none;background:#000000ff;">إغلاق</button></div>
        </div>
        <div id="dupFrameContent"></div>
      `;
      document.body.appendChild(df);
      // small CSS for group sep
  const s2 = document.createElement('style'); s2.textContent = '.dup-table th{background:#fafafa;text-align:right;padding:8px;border-bottom:1px solid #eee}.dup-table td{padding:6px;border-bottom:1px solid #f6f6f6} .dup-group-sep td{padding:0;border:none} .dup-focus-btn{padding:6px 12px;border-radius:8px;border:1px solid #1d4ed8;background:#2563eb;color:#fff;font-weight:600;cursor:pointer;transition:background .15s ease,transform .15s ease;} .dup-focus-btn:hover{background:#1d4ed8;transform:translateY(-1px);} .dup-choice-grid{display:flex;flex-direction:column;gap:16px;padding:24px 12px;} .dup-choice-btn{padding:14px 18px;border-radius:10px;border:1px solid #0f172a;background:#ffffff;color:#0f172a;font-weight:700;font-size:1.05em;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;} .dup-choice-btn.primary{background:#0f172a;color:#ffffff;} .dup-choice-btn:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(15,23,42,0.18);} .dup-choice-desc{color:#475569;font-size:0.95em;} .dup-mode-banner{margin-bottom:12px;padding:10px 14px;border-radius:10px;background:#e0f2fe;color:#0f172a;font-weight:600;} .dup-warning{padding:8px 12px;border-radius:10px;font-weight:600;margin-bottom:12px;} .dup-warning-orange{background:#fff7ed;color:#b45309;border:1px solid #fdba74;} .dup-filter-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:12px;} .dup-filter-row label{font-weight:600;color:#0f172a;} .dup-filter-select{padding:6px 10px;border-radius:8px;border:1px solid #cbd5f5;background:#ffffff;min-width:170px;} .dup-filter-select:focus{outline:2px solid #2563eb;outline-offset:2px;} .dup-results-scroll{display:flex;flex-direction:column;gap:12px;max-height:76vh;overflow:auto;padding:6px 4px;} .dup-empty{padding:16px;text-align:center;color:#475569;font-weight:600;background:#f8fafc;border-radius:10px;border:1px dashed #cbd5f5;} .dup-weapon-line{padding:6px 10px;border-radius:8px;background:#f8fafc;margin-bottom:10px;font-weight:600;color:#0f172a;} .dup-weapon-line span{color:#1d4ed8;} .dup-mini-table th{background:#f1f5f9;padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;} .dup-mini-table td{padding:6px 8px;border-bottom:1px solid #f1f5f9;}'; document.head.appendChild(s2);
    }

    // withdrawn frame: modal-like wide frame for withdrawn weapons
    if (!document.getElementById('withdrawFrame')) {
      const wf = document.createElement('div'); wf.id = 'withdrawFrame'; wf.style.display='none'; wf.style.position='fixed'; wf.style.zIndex='3000'; wf.style.left='2%'; wf.style.right='2%'; wf.style.top='4%'; wf.style.bottom='4%'; wf.style.background='#fff'; wf.style.padding='12px'; wf.style.boxShadow='0 30px 80px rgba(0,0,0,0.35)'; wf.style.borderRadius='10px'; wf.style.overflow='auto';
      wf.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <h3 style="margin:0;">نتائج فحص الاسلحة المسحوبة</h3>
          <div style="display:flex;gap:8px;align-items:center;"><button id="withdrawFrameClose" style="padding:6px 8px;border-radius:6px;border:none;background:#000000ff;color:#fff;">إغلاق</button></div>
        </div>
        <div id="withdrawFrameContent"></div>
      `;
      document.body.appendChild(wf);
      const s3 = document.createElement('style'); s3.textContent = '.withdraw-table th{background:#fafafa;text-align:right;padding:8px;border-bottom:1px solid #eee}.withdraw-table td{padding:6px;border-bottom:1px solid #f6f6f6}'; document.head.appendChild(s3);
    }

    if (!document.getElementById('withdrawOptionsFrame')) {
      const of = document.createElement('div');
      of.id = 'withdrawOptionsFrame';
      of.style.display = 'none';
      of.style.position = 'fixed';
      of.style.zIndex = '3200';
      of.style.left = '0';
      of.style.top = '0';
      of.style.right = '0';
      of.style.bottom = '0';
      of.style.background = 'rgba(15,23,42,0.35)';
      of.style.display = 'none';
      of.style.alignItems = 'center';
      of.style.justifyContent = 'center';
      of.innerHTML = `
        <div style="background:#ffffff;padding:18px;border-radius:12px;box-shadow:0 18px 50px rgba(15,23,42,0.28);min-width:260px;display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
            <strong style="color:#0f172a;font-size:1em;">اختر نوع الفحص</strong>
            <button id="withdrawOptionsClose" style="width:30px;height:30px;border-radius:8px;border:none;background:#e2e8f0;color:#0f172a;font-weight:700;cursor:pointer;">✖</button>
          </div>
          <button id="withdrawOptionMissing" style="padding:12px 16px;border:none;border-radius:10px;background:#16a34a;color:#fff;font-weight:700;cursor:pointer;">فحص الاسلحة المسحوبة وهي غير مسحوبة</button>
          <button id="withdrawOptionInverse" style="padding:12px 16px;border:none;border-radius:10px;background:#dc2626;color:#fff;font-weight:700;cursor:pointer;">فحص الاسلحة الغير مسحوبة وهي مسحوبة</button>
        </div>
      `;
      document.body.appendChild(of);
      of.addEventListener('click', (event) => { if (event.target === of) closeWithdrawOptionsFrame(); });
      setTimeout(() => {
        const closeBtn = document.getElementById('withdrawOptionsClose'); if (closeBtn) closeBtn.addEventListener('click', () => closeWithdrawOptionsFrame());
        const optionMissing = document.getElementById('withdrawOptionMissing'); if (optionMissing) optionMissing.addEventListener('click', () => { closeWithdrawOptionsFrame(); runStandardWithdrawAudit(); });
        const optionInverse = document.getElementById('withdrawOptionInverse'); if (optionInverse) optionInverse.addEventListener('click', () => runOppositeWithdrawAudit());
      }, 20);
    }

    if (!document.getElementById('coreAuditFrame')) {
      const af = document.createElement('div'); af.id = 'coreAuditFrame'; af.style.display='none'; af.style.position='fixed'; af.style.zIndex='3000'; af.style.left='2%'; af.style.right='2%'; af.style.top='4%'; af.style.bottom='4%'; af.style.background='#fff'; af.style.padding='14px'; af.style.boxShadow='0 30px 80px rgba(0,0,0,0.35)'; af.style.borderRadius='10px'; af.style.overflow='auto';
      af.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;">
          <h3 style="margin:0;">تدقيق الحقول الأساسية</h3>
          <div style="display:flex;gap:8px;align-items:center;">
            <button id="coreAuditClose" style="padding:6px 10px;border-radius:6px;border:none;background:#0f172a;color:#fff;">إغلاق</button>
          </div>
        </div>
        <div id="coreAuditContent"></div>
      `;
      document.body.appendChild(af);
      const s5 = document.createElement('style');
      s5.textContent = `
        .audit-card{border:1px solid #e5e7eb;border-radius:10px;padding:12px;background:#ffffff;display:flex;flex-direction:column;gap:10px;}
        .audit-header{display:flex;align-items:center;justify-content:space-between;gap:10px;}
        .audit-count{background:#fee2e2;color:#9f1239;padding:4px 10px;border-radius:999px;font-size:0.85em;}
        .audit-samples{overflow:auto;}
        .audit-samples table{width:100%;border-collapse:collapse;font-size:0.9em;}
        .audit-samples th{background:#f8fafc;font-weight:600;padding:6px 8px;border-bottom:1px solid #e2e8f0;}
        .audit-samples td{padding:6px 8px;border-bottom:1px solid #f1f5f9;}
        .audit-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
      `;
      document.head.appendChild(s5);
    }

    if (!document.getElementById('noNumberWeaponsFrame')) {
      const nf = document.createElement('div'); nf.id = 'noNumberWeaponsFrame'; nf.style.display='none'; nf.style.position='fixed'; nf.style.zIndex='3000'; nf.style.left='2%'; nf.style.right='2%'; nf.style.top='4%'; nf.style.bottom='4%'; nf.style.background='#fff'; nf.style.padding='14px'; nf.style.boxShadow='0 30px 80px rgba(0,0,0,0.35)'; nf.style.borderRadius='10px'; nf.style.overflow='auto';
      nf.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;">
          <h3 style="margin:0;">أسلحة بلا أرقام</h3>
          <div style="display:flex;gap:8px;align-items:center;">
            <button id="noNumberWeaponsClose" style="padding:6px 10px;border-radius:6px;border:none;background:#2563eb;color:#fff;">إغلاق</button>
          </div>
        </div>
        <div id="noNumberWeaponsContent"></div>
      `;
      document.body.appendChild(nf);
      const s6 = document.createElement('style');
      s6.textContent = `
        .nonum-card{border:1px solid #e5e7eb;border-radius:10px;padding:12px;background:#ffffff;display:flex;flex-direction:column;gap:10px;}
        .nonum-header{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}
        .nonum-badge{background:#dbeafe;color:#1d4ed8;padding:4px 10px;border-radius:999px;font-size:0.85em;}
        .nonum-matrix{width:100%;border-collapse:collapse;font-size:0.9em;}
        .nonum-matrix th{background:#f8fafc;font-weight:600;padding:6px 8px;border-bottom:1px solid #e2e8f0;}
        .nonum-matrix td{padding:6px 8px;border-bottom:1px solid #f1f5f9;}
        .nonum-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px;}
      `;
      document.head.appendChild(s6);
    }

    if (!document.getElementById('sqlImportFrame')) {
      const sif = document.createElement('div');
      sif.id = 'sqlImportFrame';
      sif.style.display = 'none';
      sif.style.position = 'fixed';
      sif.style.zIndex = '3300';
      sif.style.left = '1.5%';
      sif.style.right = '1.5%';
      sif.style.top = '3%';
      sif.style.bottom = '3%';
      sif.style.background = '#fff';
      sif.style.padding = '14px';
      sif.style.boxShadow = '0 30px 80px rgba(0,0,0,0.35)';
      sif.style.borderRadius = '10px';
      sif.style.overflow = 'auto';
      sif.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;">
          <h3 style="margin:0;">استيراد CSV إلى SQL</h3>
          <div style="display:flex;gap:8px;align-items:center;">
            <button id="sqlImportClose" style="padding:6px 10px;border-radius:6px;border:none;background:#0f766e;color:#fff;">إغلاق</button>
          </div>
        </div>
        <div id="sqlImportContent"></div>
      `;
      document.body.appendChild(sif);
      const s7 = document.createElement('style');
      s7.textContent = `
        .sql-import-loading{padding:20px;text-align:center;color:#475569;font-weight:700;}
        .sql-import-layout{display:grid;gap:14px;color:#0f172a;}
        .sql-import-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;}
        .sql-import-title{font-weight:800;font-size:1.08em;}
        .sql-import-subtitle{margin-top:4px;color:#64748b;font-size:0.94em;}
        .sql-import-file-btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;border-radius:8px;background:#0f766e;color:#fff;font-weight:800;cursor:pointer;}
        .sql-import-file-btn input{display:none;}
        .sql-import-message{min-height:22px;color:#475569;font-weight:700;}
        .sql-import-meta{display:flex;gap:10px;flex-wrap:wrap;}
        .sql-import-stat{display:grid;gap:4px;min-width:130px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;}
        .sql-import-stat span{color:#64748b;font-size:0.88em;}
        .sql-import-stat strong{font-size:1.15em;color:#0f172a;}
        .sql-import-note{padding:10px 12px;border-radius:8px;background:#ecfeff;border:1px solid #a5f3fc;color:#155e75;font-weight:700;}
        .sql-import-mapper{display:grid;gap:8px;}
        .sql-import-grid-head,.sql-import-map-row{display:grid;grid-template-columns:54px minmax(190px,1fr) minmax(280px,1.3fr) 80px;gap:8px;align-items:center;}
        .sql-import-grid-head{font-weight:800;color:#475569;padding:0 8px;}
        .sql-import-map-row{padding:8px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;}
        .sql-import-map-index{font-weight:900;text-align:center;color:#0f766e;}
        .sql-import-sql-col{display:grid;gap:2px;}
        .sql-import-sql-col span{font-size:0.82em;color:#64748b;direction:ltr;text-align:right;}
        .sql-import-map-select{width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font-family:inherit;}
        .sql-import-required{color:#b91c1c;font-weight:800;text-align:center;}
        .sql-import-required-warning{min-height:20px;color:#b91c1c;font-weight:800;}
        .sql-import-actions{display:flex;justify-content:flex-end;}
        .sql-import-replace{padding:10px 18px;border:none;border-radius:8px;background:#b91c1c;color:#fff;font-weight:900;cursor:pointer;}
        .sql-import-replace:disabled{opacity:.45;cursor:not-allowed;}
        .sql-import-preview-title{font-weight:900;color:#0f172a;}
        .sql-import-preview-table-wrap{overflow:auto;max-height:34vh;border:1px solid #e2e8f0;border-radius:8px;background:#fff;}
        .sql-import-preview-table{width:100%;border-collapse:collapse;font-size:.9em;}
        .sql-import-preview-table th{position:sticky;top:0;background:#f8fafc;padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;}
        .sql-import-preview-table td{padding:8px;border-bottom:1px solid #f1f5f9;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .sql-import-empty{padding:16px;text-align:center;color:#64748b;font-weight:700;}
        @media (max-width: 800px){
          .sql-import-grid-head{display:none;}
          .sql-import-map-row{grid-template-columns:44px 1fr;align-items:start;}
          .sql-import-map-select{grid-column:1 / -1;}
          .sql-import-required{grid-column:1 / -1;text-align:right;}
        }
      `;
      document.head.appendChild(s7);
    }

    // Wire sidebar buttons
    // Model Settings Frame
    if (!document.getElementById('modelSettingsFrame')) {
      const msf = document.createElement('div');
      msf.id = 'modelSettingsFrame';
      msf.style.cssText = 'display:none;position:fixed;z-index:3200;left:0;top:0;right:0;bottom:0;background:rgba(15,23,42,0.5);align-items:center;justify-content:center;';
      msf.innerHTML = `
        <div style="background:#fff;padding:20px;border-radius:14px;box-shadow:0 20px 60px rgba(15,23,42,0.3);max-width:500px;width:94%;max-height:85vh;overflow:auto;direction:rtl;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <h3 style="margin:0;color:#0f172a;">⚙️ إعدادات نظام التحذيرات</h3>
            <button id="modelSettingsClose" style="width:32px;height:32px;border-radius:8px;border:none;background:#e2e8f0;color:#0f172a;font-weight:700;cursor:pointer;">✖</button>
          </div>
          
          <div class="model-setting-master" style="background:#f1f5f9;padding:14px;border-radius:10px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-weight:700;color:#0f172a;font-size:1.05em;">تفعيل نظام التحذيرات</div>
                <div style="font-size:0.9em;color:#64748b;margin-top:4px;">إيقاف هذا الخيار يُعطّل جميع التحذيرات</div>
              </div>
              <label class="model-toggle">
                <input type="checkbox" id="modelMasterToggle" checked />
                <span class="model-toggle-slider"></span>
              </label>
            </div>
          </div>
          
          <div id="modelSettingsOptions" style="display:flex;flex-direction:column;gap:12px;">
            <div class="model-setting-item" style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;">
              <div>
                <div style="font-weight:600;color:#0f172a;">تحذير العنوان المفقود</div>
                <div style="font-size:0.85em;color:#64748b;">إظهار تنبيه عند عدم وجود عنوان</div>
              </div>
              <label class="model-toggle">
                <input type="checkbox" id="modelWarnMissingAddress" checked />
                <span class="model-toggle-slider"></span>
              </label>
            </div>
            
            <div class="model-setting-item" style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;">
              <div>
                <div style="font-weight:600;color:#0f172a;">تحذير أرقام السلاح المفقودة</div>
                <div style="font-size:0.85em;color:#64748b;">إظهار تنبيه عند عدم وجود أرقام في بيانات السلاح</div>
              </div>
              <label class="model-toggle">
                <input type="checkbox" id="modelWarnMissingWeaponNumbers" checked />
                <span class="model-toggle-slider"></span>
              </label>
            </div>
            
            <div class="model-setting-item" style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;">
              <div>
                <div style="font-weight:600;color:#0f172a;">تحذير العيار الخاطئ</div>
                <div style="font-size:0.85em;color:#64748b;">إظهار تنبيه عند وجود عيار يبدو خاطئاً</div>
              </div>
              <label class="model-toggle">
                <input type="checkbox" id="modelWarnCaliberIssues" checked />
                <span class="model-toggle-slider"></span>
              </label>
            </div>
            
            <div class="model-setting-item" style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;">
              <div>
                <div style="font-weight:600;color:#0f172a;">تحذير رقم الإيداع المفقود</div>
                <div style="font-size:0.85em;color:#64748b;">إظهار تنبيه عند سحب سلاح بلا رقم إيداع</div>
              </div>
              <label class="model-toggle">
                <input type="checkbox" id="modelWarnMissingDeposit" checked />
                <span class="model-toggle-slider"></span>
              </label>
            </div>
            
            <div class="model-setting-item" style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;">
              <div>
                <div style="font-weight:600;color:#0f172a;">تحذير حالة الحرز</div>
                <div style="font-size:0.85em;color:#64748b;">إظهار تنبيه عند وجود حرز بدون تمييز مسحوب</div>
              </div>
              <label class="model-toggle">
                <input type="checkbox" id="modelWarnHarzStatus" checked />
                <span class="model-toggle-slider"></span>
              </label>
            </div>
          </div>
          
          <div style="margin-top:16px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:10px;">
            <button id="modelSettingsReset" style="padding:10px 16px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#64748b;font-weight:600;cursor:pointer;">إعادة التعيين</button>
            <button id="modelSettingsSave" style="padding:10px 20px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer;">حفظ</button>
          </div>
        </div>
      `;
      document.body.appendChild(msf);
      
      // Toggle styles
      const toggleStyles = document.createElement('style');
      toggleStyles.textContent = `
        .model-toggle{position:relative;display:inline-block;width:50px;height:26px;}
        .model-toggle input{opacity:0;width:0;height:0;}
        .model-toggle-slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:#cbd5e1;transition:.25s;border-radius:26px;}
        .model-toggle-slider:before{position:absolute;content:"";height:20px;width:20px;right:3px;bottom:3px;background:#fff;transition:.25s;border-radius:50%;}
        .model-toggle input:checked + .model-toggle-slider{background:#2563eb;}
        .model-toggle input:checked + .model-toggle-slider:before{transform:translateX(-24px);}
        .model-toggle input:disabled + .model-toggle-slider{opacity:0.5;cursor:not-allowed;}
        #modelSettingsOptions.disabled{opacity:0.5;pointer-events:none;}
      `;
      document.head.appendChild(toggleStyles);
      
      // Click outside to close
      msf.addEventListener('click', (e) => { if (e.target === msf) closeModelSettingsFrame(); });
    }
    
    // Model Settings Functions
    function getModelSettings() {
      const defaults = {
        enabled: true,
        warnMissingAddress: true,
        warnMissingWeaponNumbers: true,
        warnCaliberIssues: true,
        warnMissingDeposit: true,
        warnHarzStatus: true
      };
      try {
        const stored = localStorage.getItem('weaponsModelSettings');
        if (stored) {
          const parsed = JSON.parse(stored);
          return { ...defaults, ...parsed };
        }
      } catch (_) {}
      return defaults;
    }

    // Seed settings from setting.json if nothing stored yet
    async function seedModelSettingsFromFile() {
      try {
        const stored = localStorage.getItem('weaponsModelSettings');
        if (stored) return; // already set by user
        const res = await fetch('modules/model/setting.json', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data || typeof data !== 'object') return;
        const defaults = getModelSettings();
        const merged = { ...defaults, ...data };
        localStorage.setItem('weaponsModelSettings', JSON.stringify(merged));
      } catch (_) {}
    }
    
    function saveModelSettings(settings) {
      try {
        localStorage.setItem('weaponsModelSettings', JSON.stringify(settings));
        window.WeaponsModelSettings = settings;
        // Dispatch event for table to react
        document.dispatchEvent(new CustomEvent('model:settings-changed', { detail: settings }));
      } catch (_) {}
    }
    
    // Initialize global settings (seed from file then load)
    seedModelSettingsFromFile().then(() => {
      window.WeaponsModelSettings = getModelSettings();
    });
    // Also set immediately for early callers (may be updated after seeding)
    window.WeaponsModelSettings = getModelSettings();
    
    function openModelSettingsFrame() {
      const frame = document.getElementById('modelSettingsFrame');
      if (!frame) return;
      frame.style.display = 'flex';
      
      // Load current settings into toggles
      const settings = getModelSettings();
      const masterToggle = document.getElementById('modelMasterToggle');
      const optionsContainer = document.getElementById('modelSettingsOptions');
      
      if (masterToggle) masterToggle.checked = settings.enabled;
      if (optionsContainer) optionsContainer.classList.toggle('disabled', !settings.enabled);
      
      const toggleMap = {
        'modelWarnMissingAddress': 'warnMissingAddress',
        'modelWarnMissingWeaponNumbers': 'warnMissingWeaponNumbers',
        'modelWarnCaliberIssues': 'warnCaliberIssues',
        'modelWarnMissingDeposit': 'warnMissingDeposit',
        'modelWarnHarzStatus': 'warnHarzStatus'
      };
      
      for (const [elementId, settingKey] of Object.entries(toggleMap)) {
        const el = document.getElementById(elementId);
        if (el) {
          el.checked = settings[settingKey];
          el.disabled = !settings.enabled;
        }
      }
    }
    
    function closeModelSettingsFrame() {
      const frame = document.getElementById('modelSettingsFrame');
      if (frame) frame.style.display = 'none';
    }
    
    // Wire up model settings events
    setTimeout(() => {
      const closeBtn = document.getElementById('modelSettingsClose');
      if (closeBtn) closeBtn.addEventListener('click', closeModelSettingsFrame);
      
      const masterToggle = document.getElementById('modelMasterToggle');
      const optionsContainer = document.getElementById('modelSettingsOptions');
      if (masterToggle) {
        masterToggle.addEventListener('change', () => {
          const isEnabled = masterToggle.checked;
          if (optionsContainer) optionsContainer.classList.toggle('disabled', !isEnabled);
          // Disable/enable sub-toggles
          optionsContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.disabled = !isEnabled;
          });
        });
      }
      
      const saveBtn = document.getElementById('modelSettingsSave');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          const settings = {
            enabled: document.getElementById('modelMasterToggle')?.checked ?? true,
            warnMissingAddress: document.getElementById('modelWarnMissingAddress')?.checked ?? true,
            warnMissingWeaponNumbers: document.getElementById('modelWarnMissingWeaponNumbers')?.checked ?? true,
            warnCaliberIssues: document.getElementById('modelWarnCaliberIssues')?.checked ?? true,
            warnMissingDeposit: document.getElementById('modelWarnMissingDeposit')?.checked ?? true,
            warnHarzStatus: document.getElementById('modelWarnHarzStatus')?.checked ?? true
          };
          saveModelSettings(settings);
          closeModelSettingsFrame();
          // Trigger table re-render
          if (typeof window.rerenderWeaponsTable === 'function') {
            window.rerenderWeaponsTable({ preserveScroll: true });
          } else if (typeof window.applyFilter === 'function') {
            window.applyFilter();
          }
          alert('تم حفظ الإعدادات بنجاح!');
        });
      }
      
      const resetBtn = document.getElementById('modelSettingsReset');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          const defaults = {
            enabled: true,
            warnMissingAddress: true,
            warnMissingWeaponNumbers: true,
            warnCaliberIssues: true,
            warnMissingDeposit: true,
            warnHarzStatus: true
          };
          saveModelSettings(defaults);
          openModelSettingsFrame(); // Refresh UI
          alert('تم إعادة تعيين الإعدادات!');
        });
      }
    }, 50);
    
    const modelSettingsBtn = document.getElementById('btnModelSettings');
    if (modelSettingsBtn) modelSettingsBtn.addEventListener('click', () => { toggleSettingsSidebar(false); openModelSettingsFrame(); });
    
    const sqlImportBtn = document.getElementById('btnSqlImport');
    if (sqlImportBtn) sqlImportBtn.addEventListener('click', () => { toggleSettingsSidebar(false); openSqlImportFrame(); });
    
    const dupBtn = document.getElementById('btnDupCheck'); if (dupBtn) dupBtn.addEventListener('click', () => { toggleSettingsSidebar(false); openDuplicateChecker(); });
    const withdrawBtn = document.getElementById('btnWithdrawCheck'); if (withdrawBtn) withdrawBtn.addEventListener('click', () => {
      toggleSettingsSidebar(false);
      openWithdrawOptionsFrame();
    });
    const coreAuditBtn = document.getElementById('btnCoreAudit'); if (coreAuditBtn) coreAuditBtn.addEventListener('click', () => { toggleSettingsSidebar(false); openCoreFieldsAudit(); });
    const nonumBtn = document.getElementById('btnNoNumberWeapons'); if (nonumBtn) nonumBtn.addEventListener('click', () => { toggleSettingsSidebar(false); openNoNumberWeaponsAudit(); });
    const settingsClose = document.getElementById('settingsClose'); if (settingsClose) settingsClose.addEventListener('click', () => toggleSettingsSidebar(false));
  const dupClose = document.getElementById('dupFrameClose'); if (dupClose) dupClose.addEventListener('click', () => closeDupFrame());
  const withdrawClose = document.getElementById('withdrawFrameClose'); if (withdrawClose) withdrawClose.addEventListener('click', () => closeWithdrawFrame());
    const coreAuditClose = document.getElementById('coreAuditClose'); if (coreAuditClose) coreAuditClose.addEventListener('click', () => { const frame = document.getElementById('coreAuditFrame'); if (frame) frame.style.display = 'none'; });
    const nonumClose = document.getElementById('noNumberWeaponsClose'); if (nonumClose) nonumClose.addEventListener('click', () => { const frame = document.getElementById('noNumberWeaponsFrame'); if (frame) frame.style.display = 'none'; });
    const sqlImportClose = document.getElementById('sqlImportClose'); if (sqlImportClose) sqlImportClose.addEventListener('click', () => { const frame = document.getElementById('sqlImportFrame'); if (frame) frame.style.display = 'none'; });
  }

  window.initWeaponsSettingsUi = initWeaponsSettingsUi;
  window.toggleWeaponsSettingsSidebar = toggleSettingsSidebar;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWeaponsSettingsUi, { once: true });
  } else {
    initWeaponsSettingsUi();
  }



// --- Withdrawn checker implementation (uses the shared in-memory table dataset + عمود حالة السحب + empty deposit filter) ---
async function openWithdrawnChecker() {
  const frame = document.getElementById('withdrawFrame');
  const content = document.getElementById('withdrawFrameContent');
  if (!frame || !content) return;

  const escapeHtml = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const _toLatin = (typeof toLatinDigits === 'function')
    ? toLatinDigits
    : (s) => String(s || '')
        .replace(/[\u0660-\u0669]/g, ch => String(ch.charCodeAt(0) - 0x0660))
        .replace(/[\u06F0-\u06F9]/g, ch => String(ch.charCodeAt(0) - 0x06F0));

  // Use the existing dataset in memory, or fetch it if the table has not loaded yet.
  let headers = Array.isArray(window.csvHeaders) ? window.csvHeaders.map(h => String(h).trim()) : [];
  let dataRows = Array.isArray(window.csvAll) ? window.csvAll : [];
  // If table data is not available in memory yet, load SQL-backed records.
  if (!headers.length || !dataRows.length) {
    try {
      const apiRes = await fetch(buildWeaponsApiUrl('/api/records'), { cache: 'no-store' });
      if (apiRes.ok) {
        const j = await apiRes.json().catch(() => null);
        if (j && j.ok && Array.isArray(j.headers) && Array.isArray(j.rows)) {
          window.csvHeaders = j.headers;
          window.csvAll = j.rows;
          if (Array.isArray(j.meta)) window.csvRowMeta = j.meta;
          headers = window.csvHeaders.map(h => String(h).trim());
          dataRows = window.csvAll;
        }
      }
    } catch (e) { /* ignore and show the empty-state below */ }
  }
  if (!headers.length || !dataRows.length) {
    content.innerHTML = `<div style="padding:18px;text-align:center;color:#b00;font-weight:700;">⚠️ البيانات لم تُحمّل بعد — الرجاء فتح صفحة السجلات أولاً.</div>`;
    frame.style.display = 'block';
    return;
  }

  // === Identify key column indices ===
  const findIdx = (names) => {
    for (const n of names) {
      const i = headers.findIndex(h => h.includes(n));
      if (i !== -1) return i;
    }
    return -1;
  };

  const licenseIdx = findIdx(['رقم', 'رقم القيد']);
  const depositDateIdx = findIdx(['تاريخ الايداع', 'تاريخ الإيداع']);
  const depositNumIdx = findIdx(['رقم الايداع', 'رقم الإيداع']);
  const notesIdx = findIdx(['ملاحظات', 'ملاحظة']);
  const statusIdx = findIdx(['حالة السحب']);

  if (licenseIdx === -1) {
    content.innerHTML = `<div style="padding:18px;text-align:center;color:#b00;font-weight:700;">تعذر تحديد عمود رقم القيد.</div>`;
    frame.style.display = 'block';
    return;
  }
  if (statusIdx === -1) {
    content.innerHTML = `<div style="padding:18px;text-align:center;color:#b00;font-weight:700;">لا يمكن إجراء الفحص دون عمود "حالة السحب" داخل البيانات.</div>`;
    frame.style.display = 'block';
    return;
  }

  // === Step 1: Collect rows that have missing deposit info (these are candidates we want to inspect) ===
  const rowsMissingDeposit = [];
  dataRows.forEach((row, rowIdx) => {
    const dDate = depositDateIdx !== -1 ? String(row[depositDateIdx] || '').trim() : '';
    const dNum = depositNumIdx !== -1 ? String(row[depositNumIdx] || '').trim() : '';
    const notes = notesIdx !== -1 ? String(row[notesIdx] || '').trim() : '';
    if (!dDate && !dNum && !notes) {
      rowsMissingDeposit.push({ row, rowIdx });
    }
  });

  const rowsWithStatus = rowsMissingDeposit.map(({ row, rowIdx }) => {
    const statusRaw = String(row[statusIdx] || '').trim();
    const statusLabel = statusRaw === 'مسحوب' ? 'تم السحب' : 'لم يتم السحب';
    return { row, rowIdx, statusLabel };
  });

  if (!rowsWithStatus.length) {
    content.innerHTML = `<div style="padding:18px;text-align:center;color:#444;font-weight:700;">لا توجد سجلات ذات بيانات ايداع مفقودة.</div>`;
    frame.style.display = 'block';
    return;
  }
  // === Step 3: Build table with selection and add-to-withdraw actions ===
  let html = `
    <div style="overflow:auto;max-height:76vh;padding:6px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;">
        <div style="font-weight:700;">السجلات ذات بيانات الإيداع/الملاحظات المفقودة: ${rowsWithStatus.length}</div>
        <div style="display:flex;gap:8px;">
          <button id="btnSelectAllMissing" style="padding:6px 10px;border-radius:6px;background:#006400;color:#fff;border:none;cursor:pointer;">تحديد الكل</button>
          <button id="btnClearSelectionMissing" style="padding:6px 10px;border-radius:6px;background:#888;color:#fff;border:none;cursor:pointer;">مسح التحديد</button>
          <button id="btnAddSelectedWithdraw" style="padding:6px 10px;border-radius:6px;background:#0047ab;color:#fff;border:none;cursor:pointer;">تمييز المحدد كمسحوب</button>
        </div>
      </div>
      <table class="excel withdraw-table" style="width:100%;border-collapse:collapse;">
        <thead><tr>`;
  // checkbox column
  html += `<th style="padding:8px;border-bottom:2px solid #eee;background:#fafafa;text-align:center;">اختيار</th>`;
  for (const h of headers)
    html += `<th style="padding:8px;border-bottom:2px solid #eee;background:#fafafa;text-align:right;">${escapeHtml(h)}</th>`;
  html += `<th style="padding:8px;border-bottom:2px solid #eee;background:#fafafa;text-align:center;">حالة السحب</th>`;
  html += `</tr></thead><tbody>`;

  for (let idx = 0; idx < rowsWithStatus.length; idx++) {
    const item = rowsWithStatus[idx];
    const r = item.row;
    const statusLabel = String(item.statusLabel || 'مجهول');
    html += `<tr>`;
    html += `<td style="padding:8px;border:1px solid #f6f6f6;text-align:center;"><input type="checkbox" class="withdraw-missing-checkbox" data-idx="${idx}" /></td>`;
    for (let c = 0; c < headers.length; c++) {
      const cell = String(r[c] || '');
      html += `<td style="padding:8px;border:1px solid #f6f6f6;">${escapeHtml(cell)}</td>`;
    }
  const color = statusLabel === 'تم السحب' ? '#16a34a' : '#dc2626';
    html += `<td style="padding:8px;border:1px solid #f6f6f6;text-align:center;font-weight:700;color:${color};">${escapeHtml(statusLabel)}</td>`;
    html += `</tr>`;
  }

  html += `</tbody></table></div>`;
  content.innerHTML = html;
  frame.style.display = 'block';

  // wire selection buttons and add action
  setTimeout(() => {
    const selectAllBtn = document.getElementById('btnSelectAllMissing');
    const clearBtn = document.getElementById('btnClearSelectionMissing');
    const addBtn = document.getElementById('btnAddSelectedWithdraw');
    const checkboxes = () => Array.from(document.querySelectorAll('.withdraw-missing-checkbox'));
    if (selectAllBtn) selectAllBtn.addEventListener('click', () => { checkboxes().forEach(cb => cb.checked = true); });
    if (clearBtn) clearBtn.addEventListener('click', () => { checkboxes().forEach(cb => cb.checked = false); });
    if (addBtn) addBtn.addEventListener('click', async () => {
      const cbs = checkboxes().filter(x => x.checked);
      if (!cbs.length) { alert('اختر سجلاً واحداً على الأقل'); return; }
      addBtn.disabled = true; addBtn.textContent = 'جارٍ التحديث...';
      try {
        let updatedCount = 0;
        cbs.forEach((cb) => {
          const idx = Number(cb.getAttribute('data-idx'));
          if (Number.isNaN(idx)) return;
          const item = rowsWithStatus[idx];
          if (!item) return;
          const globalRow = dataRows[item.rowIdx];
          if (!globalRow) return;
          if (String(globalRow[statusIdx] || '').trim() === 'مسحوب') return;
          globalRow[statusIdx] = 'مسحوب';
          if (Array.isArray(window.csvAll) && window.csvAll[item.rowIdx]) {
            window.csvAll[item.rowIdx][statusIdx] = 'مسحوب';
          }
          updatedCount += 1;
        });
        if (updatedCount) {
          try { if (window.UnsavedGuard && typeof window.UnsavedGuard.markDirty === 'function') window.UnsavedGuard.markDirty(); } catch (_) {}
          try {
            if (typeof window.applyAllFilters === 'function') window.applyAllFilters();
            else if (typeof window.applyFilter === 'function') window.applyFilter();
          } catch (_) {}
        }
        const message = updatedCount
          ? `تم تمييز ${updatedCount} سجل/سجلات كمسحوبة.`
          : 'جميع السجلات المحددة معلّمة مسبقاً كمسحوبة.';
        alert(message);
        openWithdrawnChecker();
      } finally {
        addBtn.disabled = false;
        addBtn.textContent = 'تمييز المحدد كمسحوب';
      }
    });
  }, 50);
}


async function openNonWithdrawnWithDepositsChecker() {
  const applyGridFocus = () => {
    try {
      if (typeof window.applyFilter === 'function') window.applyFilter();
      else if (typeof window.applyAllFilters === 'function') window.applyAllFilters();
    } catch (_) {}
  };

  try {
    const { headers, rows } = await ensureCsvDataset();
    if (!headers.length || !rows.length) {
      alert('لا توجد بيانات CSV لتحليلها. الرجاء تحميل السجلات أولاً.');
      return;
    }

    const findIdx = (candidates) => {
      for (const c of candidates) {
        const idx = headers.findIndex(h => h && String(h).includes(c));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const licenseIdx = findIdx(['رقم القيد', 'رقم', 'license']);
    if (licenseIdx === -1) {
      alert('تعذر تحديد عمود رقم القيد داخل CSV.');
      return;
    }
    const nameIdx = findIdx(['الاسم', 'name']);
    const weaponIdx = findIdx(['بيانات السلاح', 'بيان السلاح', 'نوع السلاح', 'السلاح']);
    const depositDateIdx = findIdx(['تاريخ الايداع', 'تاريخ الإيداع']);
    const depositNumIdx = findIdx(['رقم الايداع', 'رقم الإيداع']);
  const notesIdx = findIdx(['ملاحظات', 'ملاحظة']);
    const statusIdx = findIdx(['حالة السحب']);

    if (statusIdx === -1) {
      alert('لا يمكن تنفيذ هذا الفحص بدون عمود "حالة السحب" داخل CSV.');
      return;
    }

    const anomalies = [];

    rows.forEach((row, idx) => {
      if (!Array.isArray(row)) return;
      const licenseValue = String(row[licenseIdx] || '').trim();
      if (!licenseValue) return;
    const depositDate = depositDateIdx !== -1 ? String(row[depositDateIdx] || '').trim() : '';
  const depositNumber = depositNumIdx !== -1 ? String(row[depositNumIdx] || '').trim() : '';
  if (!depositDate && !depositNumber) return;
    const weaponCellRaw = weaponIdx !== -1 ? String(row[weaponIdx] || '').trim() : '';
      const statusRaw = String(row[statusIdx] || '').trim();
      const isMarkedWithdrawn = statusRaw === 'مسحوب';
      if (isMarkedWithdrawn) return;

      const statusText = 'العمود لا يشير إلى أن السجل مسحوب';
      anomalies.push({
        idx,
        licenseValue,
        name: nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '',
        weaponCell: weaponCellRaw,
        depositDate,
        depositNumber,
        statusText
      });
    });

    if (!anomalies.length) {
      window.__auditFocusSet = null;
      window.__auditFocusLabel = '';
      applyGridFocus();
      alert('لا توجد سجلات بها بيانات إيداع بينما العمود لا يشير إلى أنها مسحوبة.');
      return;
    }

    window.__auditFocusSet = new Set(anomalies.map(item => item.idx));
    window.__auditFocusLabel = 'إيداع بدون تمييز مسحوب';
    applyGridFocus();
    setTimeout(() => {
      const container = document.getElementById('csvPreviewContainer');
      if (container) { try { container.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) { container.scrollTop = 0; } }
    }, 50);
    alert(`تم تحديد ${anomalies.length} سجل يحتوي على بيانات إيداع رغم أن عمود "حالة السحب" لا يحتوي على "مسحوب". تم تركيز الجدول عليها.`);
  } catch (err) {
    const message = err && err.message ? err.message : String(err || '');
    alert('حدث خطأ أثناء الفحص العكسي: ' + message);
  }
}


  function closeWithdrawFrame(){ const frame = document.getElementById('withdrawFrame'); if (frame) frame.style.display = 'none'; }

})();
