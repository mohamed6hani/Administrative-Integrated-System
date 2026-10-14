(function initWeaponsCreateFormModule() {
  if (window.WeaponsCreateForm) return;

  const CREATE_DRAFT_KEY = 'weaponsCreateDraft';
  const CREATE_DRAFT_FLAG_KEY = 'weaponsCreateRestoreOnce';
  const SHEET_FOCUS_KEY = 'weaponsSheetFocus';
  const DESIRED_HEADERS = [
    'رقم',
    'نوع الرخصة',
    'الاسم',
    'العنوان',
    'بيانات السلاح',
    'تاريخ قرار الالغاء',
    'سبب الالغاء',
    'القسم التابع',
    'القطاع',
    'عدد القطع',
    'رقم الايداع',
    'تاريخ الايداع',
    'ملاحظات'
  ];

  const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const toArabicDigits = (value) => String(value ?? '').replace(/[0-9]/g, (digit) => AR_DIGITS[Number(digit)] ?? digit);
  const toLatinDigits = (value) => String(value ?? '').replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660));

  function buildMarkup(options = {}) {
    const mode = options.mode === 'modal' ? 'modal' : 'page';
    const closeLabel = options.closeLabel || (mode === 'modal' ? 'إغلاق' : 'عودة');
    return `
      <section class="weapons-create-shell weapons-create-shell--${mode}" data-mode="${mode}">
        <div class="weapons-create-toolbar">
          <div class="weapons-create-toolbar-copy">
            <h2 class="weapons-create-dialog-title">ادراج سلاح جديد</h2>
          </div>
          <div class="weapons-create-toolbar-actions">
            <button type="button" class="weapons-create-action-btn weapons-create-action-btn--ghost" data-action="reset-form">تفريغ الحقول</button>
            <button type="button" class="weapons-create-action-btn" data-action="close-form">${closeLabel}</button>
          </div>
        </div>

        <form class="weapons-create-form" data-role="create-form" novalidate>
          <section class="weapons-create-section">
            <h3 class="weapons-create-section-title">بيانات الترخيص</h3>
            <div class="weapons-create-section-frame">
              <div class="weapons-create-stack weapons-create-stack--license">
                <label class="create-form-field weapons-create-field">
                  <span>رقم الرخصة</span>
                  <input type="number" name="recordNumber" data-field="recordNumber" inputmode="numeric" placeholder="رقم الرخصة" aria-label="رقم الرخصة" />
                </label>

                <label class="create-form-field weapons-create-field">
                  <span>الاسم الرباعي</span>
                  <input type="text" name="fullname" data-field="fullname" placeholder="الاسم الرباعي" aria-label="الاسم الرباعي" required />
                </label>

                <label class="create-form-field weapons-create-field">
                  <span>نوع الترخيص</span>
                  <select name="licenseType" data-field="licenseType" aria-label="نوع الترخيص">
                    <option value="" selected disabled>اختر نوع الترخيص</option>
                  </select>
                </label>

                <label class="create-form-field weapons-create-field">
                  <span>نوع القطاع</span>
                  <select name="sector" data-field="sector" aria-label="نوع القطاع">
                    <option value="" selected disabled>اختر القطاع</option>
                  </select>
                </label>

                <label class="create-form-field weapons-create-field">
                  <span>جهة الترخيص الحالية</span>
                  <select name="currentAuthority" data-field="currentAuthority" aria-label="جهة الترخيص الحالية" disabled>
                    <option value="" selected disabled>اختر القسم</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section class="weapons-create-section">
            <h3 class="weapons-create-section-title">بيانات الإلغاء</h3>
            <div class="weapons-create-section-frame">
              <div class="weapons-create-stack weapons-create-stack--cancel">
                <label class="create-form-field weapons-create-field">
                  <span>تاريخ قرار الالغاء</span>
                  <input type="text" name="cancelDate" data-field="cancelDate" class="date-mask" placeholder="تاريخ قرار الالغاء (يوم/شهر/سنة)" aria-label="تاريخ قرار الالغاء" dir="ltr" />
                </label>

                <label class="create-form-field weapons-create-field">
                  <span>سبب الالغاء</span>
                  <input type="text" name="cancelReason" data-field="cancelReason" placeholder="سبب الالغاء" aria-label="سبب الالغاء" />
                </label>

                <label class="create-form-field weapons-create-field">
                  <span>محل الاقامة</span>
                  <input type="text" name="address" data-field="address" placeholder="محل الاقامة" aria-label="محل الاقامة" />
                </label>

                <label class="create-form-field weapons-create-field">
                  <span>ملاحظات</span>
                  <textarea name="notes" data-field="notes" rows="3" class="create-notes weapons-create-notes" placeholder="ملاحظات" aria-label="ملاحظات"></textarea>
                </label>
              </div>
            </div>
          </section>

          <input type="hidden" name="piecesCount" data-field="piecesCount" />

          <section id="weaponEntriesSection" class="weapons-create-section weapons-create-section--weapons">
            <div class="weapons-create-section-head">
              <h3 class="weapons-create-section-title">بيانات الأسلحة</h3>
            </div>
            <div class="weapons-create-section-frame">
              <div class="weapon-entries-container" data-role="weaponEntriesContainer"></div>
            </div>
          </section>

          <div class="weapons-create-footer">
            <button type="submit" class="create-submit weapons-create-submit" data-role="submit-button" data-skip-cooldown="1">ادراج السجل</button>
            <p class="muted weapons-create-msg" data-role="message"></p>
          </div>
        </form>

        <div class="weapons-create-overlay" data-role="duplicate-overlay" data-no-restore hidden>
          <div class="weapons-create-overlay__panel weapons-create-overlay__panel--compact weapons-create-duplicate-panel">
            <div class="weapons-create-duplicate-alert">
              <div class="weapons-create-duplicate-alert__icon" aria-hidden="true">⚠️</div>
              <div class="weapons-create-duplicate-alert__copy">
                <h2>السجل موجود مسبقًا</h2>
                <p>هذا السجل مضاف بالفعل. راجع البيانات التالية قبل المتابعة.</p>
              </div>
            </div>
            <div class="weapons-create-duplicate-summary" data-role="duplicate-summary"></div>
            <div class="weapons-create-overlay__message" data-role="duplicate-message"></div>
            <div class="weapons-create-overlay__actions">
              <button type="button" class="weapons-create-overlay-btn weapons-create-overlay-btn--success" data-action="duplicate-force">اضافة علي اي حال</button>
              <button type="button" class="weapons-create-overlay-btn weapons-create-overlay-btn--ghost" data-action="duplicate-stay">رجوع</button>
              <button type="button" class="weapons-create-overlay-btn weapons-create-overlay-btn--primary" data-action="duplicate-inspect">فحص</button>
            </div>
          </div>
        </div>

        <div class="weapons-create-overlay" data-role="weapon-number-overlay" data-no-restore hidden>
          <div class="weapons-create-overlay__panel weapons-create-overlay__panel--compact">
            <h2>أضف رقم السلاح</h2>
            <p>
              بيان السلاح يحتاج شرطين:
              <br />• <strong>عيار/طول</strong> برقم يسبق كلمة <strong>مم</strong> أو حرف <strong>م</strong>.
              <br />• <strong>رقم سلاح</strong> يحتوي على أرقام واضحة ويمكن أن يضم حروفًا إنجليزية أيضًا.
              <br />بالأسفل ستظهر فقط الأجزاء الناقصة لكل سلاح.
            </p>
            <ul class="weapons-create-warning-list" data-role="weapon-number-list"></ul>
            <div class="weapons-create-overlay__actions">
              <button type="button" class="weapons-create-overlay-btn weapons-create-overlay-btn--ghost" data-action="weapon-number-back">رجوع</button>
              <button type="button" class="weapons-create-overlay-btn weapons-create-overlay-btn--warning" data-action="weapon-number-force">اضافة على اي حال</button>
            </div>
          </div>
        </div>
      </section>`;
  }

  function mount(host, options = {}) {
    if (!host) return null;

    const mode = options.mode === 'modal' ? 'modal' : 'page';
    host.innerHTML = buildMarkup({
      mode,
      closeLabel: options.closeLabel || (mode === 'modal' ? 'إغلاق' : 'عودة')
    });

    const root = host.querySelector('.weapons-create-shell');
    const getField = (name) => root.querySelector(`[data-field="${name}"]`);
    const refs = {
      form: root.querySelector('[data-role="create-form"]'),
      recordNumber: getField('recordNumber'),
      fullname: getField('fullname'),
      cancelReason: getField('cancelReason'),
      address: getField('address'),
      licenseType: getField('licenseType'),
      cancelDate: getField('cancelDate'),
      sector: getField('sector'),
      currentAuthority: getField('currentAuthority'),
      piecesCount: getField('piecesCount'),
      notes: getField('notes'),
      weaponEntriesContainer: root.querySelector('[data-role="weaponEntriesContainer"]'),
      message: root.querySelector('[data-role="message"]'),
      submitButton: root.querySelector('[data-role="submit-button"]'),
      duplicateOverlay: root.querySelector('[data-role="duplicate-overlay"]'),
      duplicateSummary: root.querySelector('[data-role="duplicate-summary"]'),
      duplicateMessage: root.querySelector('[data-role="duplicate-message"]'),
      weaponNumberOverlay: root.querySelector('[data-role="weapon-number-overlay"]'),
      weaponNumberList: root.querySelector('[data-role="weapon-number-list"]'),
      closeButton: root.querySelector('[data-action="close-form"]'),
      resetButton: root.querySelector('[data-action="reset-form"]'),
      duplicateStay: root.querySelector('[data-action="duplicate-stay"]'),
      duplicateForce: root.querySelector('[data-action="duplicate-force"]'),
      duplicateInspect: root.querySelector('[data-action="duplicate-inspect"]'),
      weaponNumberBack: root.querySelector('[data-action="weapon-number-back"]'),
      weaponNumberForce: root.querySelector('[data-action="weapon-number-force"]')
    };

    const buildWeaponsApiUrl = typeof window.buildWeaponsApiUrl === 'function'
      ? window.buildWeaponsApiUrl
      : (path) => path;
    const stationsMap = typeof sectorStations !== 'undefined'
      ? sectorStations
      : (window.sectorStations || {});
    const SHARED_REFERENCE_DATA = window.AdministrativeSharedReferenceData || null;
    const API_APPEND = buildWeaponsApiUrl('/api/append-csv');
    const wiredDateInputs = new WeakSet();

    let pendingDuplicateState = null;
    let restoredFromDraft = false;
    let allowMissingSerialOnce = false;

    function setMessage(text, color) {
      if (!refs.message) return;
      refs.message.textContent = text || '';
      refs.message.style.color = color || '';
      refs.message.classList.toggle('is-visible', !!text);
      refs.message.classList.toggle('is-success', !!text && color === '#15803d');
    }

    function clearStoredDraft() {
      try { localStorage.removeItem(CREATE_DRAFT_KEY); } catch (_) {}
      try { localStorage.removeItem(CREATE_DRAFT_FLAG_KEY); } catch (_) {}
      try { localStorage.removeItem(SHEET_FOCUS_KEY); } catch (_) {}
    }

    function escCsv(value) {
      return `"${String(value ?? '').replace(/"/g, '""')}"`;
    }

    function buildLineByOrder(order, record) {
      return order.map((header) => escCsv(record[header] ?? '')).join(',');
    }

    function resolveSectorValue(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      const keyToLabel = window.WeaponsData?.sectorKeyToLabel || {};
      if (Object.prototype.hasOwnProperty.call(keyToLabel, raw)) {
        return raw;
      }
      if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.resolveSectorKey === 'function') {
        const resolved = SHARED_REFERENCE_DATA.resolveSectorKey(raw);
        if (resolved) return resolved;
      }
      const labelToKey = window.WeaponsData?.sectorLabelToKey || {};
      return labelToKey[raw] || '';
    }

    function getSectorChoices() {
      const keyToLabel = window.WeaponsData?.sectorKeyToLabel || {};
      const keys = Array.isArray(window.WeaponsData?.allSectorKeys) && window.WeaponsData.allSectorKeys.length
        ? window.WeaponsData.allSectorKeys
        : Object.keys(keyToLabel);
      return keys
        .map((key) => ({ key, label: keyToLabel[key] || key }))
        .filter((entry) => entry.key);
    }

    function populateSectorOptions() {
      if (!refs.sector) return;
      const currentValue = resolveSectorValue(refs.sector.value);
      const choices = getSectorChoices();
      refs.sector.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.disabled = true;
      placeholder.selected = true;
      placeholder.textContent = 'اختر القطاع';
      refs.sector.appendChild(placeholder);
      choices.forEach(({ key, label }) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = label;
        refs.sector.appendChild(option);
      });
      if (currentValue && choices.some((entry) => entry.key === currentValue)) {
        refs.sector.value = currentValue;
        placeholder.selected = false;
      }
    }

    function populateLicenseTypes(types) {
      if (!refs.licenseType) return;
      const currentValue = refs.licenseType.value;
      const normalized = Array.isArray(types) ? types.filter((type) => String(type || '').trim()) : [];
      const unique = Array.from(new Set(normalized.map((type) => String(type).trim())));
      refs.licenseType.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.disabled = true;
      placeholder.selected = true;
      placeholder.textContent = 'اختر نوع الترخيص';
      refs.licenseType.appendChild(placeholder);
      unique.forEach((type) => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        refs.licenseType.appendChild(option);
      });
      if (currentValue && unique.includes(currentValue)) {
        refs.licenseType.value = currentValue;
      }
    }

    function syncAuthorityOptions() {
      if (!refs.currentAuthority || !refs.sector) return;
      const sector = refs.sector.value;
      refs.currentAuthority.innerHTML = '<option value="" selected disabled>اختر القسم</option>';
      const stations = stationsMap[sector] || [];
      if (stations.length) {
        stations.forEach((station) => {
          const option = document.createElement('option');
          option.value = station;
          option.textContent = station;
          refs.currentAuthority.appendChild(option);
        });
        refs.currentAuthority.disabled = false;
      } else {
        refs.currentAuthority.disabled = true;
      }
    }

    function clearMainFormFields() {
      [
        refs.recordNumber,
        refs.fullname,
        refs.cancelReason,
        refs.address,
        refs.licenseType,
        refs.cancelDate,
        refs.sector,
        refs.notes
      ].forEach((field) => {
        if (field) field.value = '';
      });
      syncAuthorityOptions();
    }

    const onlyDigits = (value) => toLatinDigits(String(value || '')).replace(/[^0-9]/g, '');
    const normalizeCaliberSource = (value) => toLatinDigits(String(value || '')).toLowerCase();
    const hasCaliberToken = (value) => {
      const normalized = normalizeCaliberSource(value);
      if (!normalized) return false;
      if (/\d+\s*مم/.test(normalized)) return true;
      if (/\d+\s*م(?!\s*م)(?=$|[^0-9a-z\u0621-\u064a])/.test(normalized)) return true;
      return /\d+\s*mm/.test(normalized);
    };
    const hasSerialToken = (value) => {
      const normalized = String(value || '').trim();
      if (!normalized) return false;
      const segmentMatch = normalized.match(/[A-Za-z0-9]{3,}/g);
      if (!segmentMatch) return false;
      return segmentMatch.some((segment) => {
        const hasLetter = /[A-Za-z]/.test(segment);
        const hasDigits = /[0-9]/.test(segment);
        return (hasLetter && hasDigits) || (!hasLetter && hasDigits);
      });
    };
    const analyzeWeaponText = (value) => ({
      hasCaliber: hasCaliberToken(value),
      hasSerial: hasSerialToken(value)
    });

    function showFieldTip(element, message) {
      try {
        const rect = element.getBoundingClientRect();
        const tip = document.createElement('div');
        tip.textContent = message || 'إدخال غير صحيح';
        tip.style.cssText = 'position:fixed;z-index:3000;background:#d00;color:#fff;padding:6px 10px;border-radius:8px;font-size:.9em;box-shadow:0 4px 16px rgba(0,0,0,.2);pointer-events:none;';
        const arrow = document.createElement('div');
        arrow.style.cssText = 'position:absolute;bottom:-6px;right:12px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid #d00;';
        tip.appendChild(arrow);
        document.body.appendChild(tip);
        tip.style.top = Math.max(6, rect.top - 30) + 'px';
        tip.style.left = Math.max(6, rect.left + (rect.width / 2) - 60) + 'px';
        setTimeout(() => {
          try { tip.remove(); } catch (_) {}
        }, 1600);
      } catch (_) {}
    }

    function showDateError(element, message = 'تاريخ فقط') {
      showFieldTip(element, message);
    }

    function clampDay(value) {
      let number = parseInt(value || '0', 10) || 0;
      if (number < 1) number = 1;
      if (number > 31) number = 31;
      return number < 10 ? '0' + number : String(number);
    }

    function clampMonth(value) {
      let number = parseInt(value || '0', 10) || 0;
      if (number < 1) number = 1;
      if (number > 12) number = 12;
      return number < 10 ? '0' + number : String(number);
    }

    function wireDateInput(element) {
      if (!element || wiredDateInputs.has(element)) return;
      wiredDateInputs.add(element);

      element.addEventListener('beforeinput', (event) => {
        const data = event.data || '';
        if (data && !/[0-9\u0660-\u0669\/]/.test(data)) {
          event.preventDefault();
          showDateError(element);
          return;
        }
        if (data === '/') {
          event.preventDefault();
          let value = toLatinDigits(String(element.value || ''));
          value = value.replace(/[^0-9\/]/g, '');
          if (!value.endsWith('/')) value += '/';
          let parts = value.split('/');
          const index = parts.length - 2;
          if (index >= 0) {
            parts[0] = (parts[0] || '').replace(/[^0-9]/g, '').slice(0, 2);
            parts[1] = (parts[1] || '').replace(/[^0-9]/g, '').slice(0, 2);
            if (index === 0) {
              parts[0] = clampDay(parts[0]);
            } else if (index === 1) {
              parts[1] = clampMonth(parts[1]);
            }
            parts = parts.slice(0, 3);
            if (parts.length < 2) parts[1] = '';
          }
          let nextValue = parts.join('/');
          if (!nextValue.endsWith('/')) nextValue += '/';
          element.value = nextValue;
        }
      });

      element.addEventListener('input', () => {
        const digits = onlyDigits(element.value).slice(0, 8);
        let output = '';
        if (digits.length >= 2) output += digits.slice(0, 2) + '/'; else output += digits;
        if (digits.length >= 4) output += digits.slice(2, 4) + '/'; else if (digits.length > 2) output += digits.slice(2);
        if (digits.length > 4) output += digits.slice(4);
        element.value = output;
      });

      element.addEventListener('paste', (event) => {
        try { event.preventDefault(); } catch (_) {}
        const text = event.clipboardData?.getData('text') || '';
        const value = onlyDigits(text).slice(0, 8);
        let output = '';
        if (value.length >= 2) output += value.slice(0, 2) + '/'; else output += value;
        if (value.length >= 4) output += value.slice(2, 4) + '/'; else if (value.length > 2) output += value.slice(2);
        if (value.length > 4) output += value.slice(4, 8);
        element.value = output;
      });

      element.addEventListener('blur', () => {
        const value = toLatinDigits(String(element.value || '').trim());
        if (!value) return;
        const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
        if (!match) {
          showDateError(element);
          return;
        }
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const year = parseInt(match[3], 10);
        const date = new Date(year, month - 1, day);
        const isValid = date && date.getFullYear() === year && date.getMonth() === (month - 1) && date.getDate() === day;
        if (!isValid) showDateError(element);
      });
    }

    function wireNameLettersOnly(element) {
      if (!element) return;
      element.addEventListener('beforeinput', (event) => {
        const data = event.data || '';
        if (/[0-9\u0660-\u0669]/.test(data)) {
          event.preventDefault();
          showFieldTip(element, 'حروف فقط');
        }
      });
      element.addEventListener('paste', (event) => {
        try { event.preventDefault(); } catch (_) {}
        const text = event.clipboardData?.getData('text') || '';
        const cleaned = String(text).replace(/[0-9\u0660-\u0669]/g, '');
        if (cleaned.length !== String(text).length) {
          showFieldTip(element, 'حروف فقط');
        }
        element.value = cleaned;
      });
      element.addEventListener('input', () => {
        if (/[0-9\u0660-\u0669]/.test(element.value)) {
          element.value = String(element.value).replace(/[0-9\u0660-\u0669]/g, '');
          showFieldTip(element, 'حروف فقط');
        }
      });
    }

    function getWeaponEntryElements() {
      return Array.from(refs.weaponEntriesContainer?.querySelectorAll('.weapon-entry') || []);
    }

    function updatePiecesCount() {
      const count = Math.max(getWeaponEntryElements().length, 0);
      if (refs.piecesCount) refs.piecesCount.value = count ? String(count) : '';
    }

    function addWeaponEntry(initial = {}) {
      if (!refs.weaponEntriesContainer) return null;
      const entry = document.createElement('div');
      entry.className = 'weapon-entry';
      entry.innerHTML = `
        <div class="weapon-field">
          <label>نوع السلاح والعيار</label>
          <input type="text" class="weapon-type-input" placeholder="نوع السلاح والعيار ورقم السلاح" aria-label="نوع السلاح والعيار ورقم السلاح" dir="rtl" />
        </div>
        <div class="weapon-field-grid">
          <div class="weapon-field">
            <label>رقم الإيداع (اختياري)</label>
            <input type="text" class="weapon-deposit-input" placeholder="رقم الإيداع" aria-label="رقم الإيداع" dir="rtl" />
          </div>
          <div class="weapon-field">
            <label>تاريخ الإيداع (يوم/شهر/سنة)</label>
            <input type="text" class="weapon-date-input date-mask" placeholder="تاريخ الإيداع (يوم/شهر/سنة)" aria-label="تاريخ الإيداع" dir="ltr" />
          </div>
        </div>`;

      refs.weaponEntriesContainer.appendChild(entry);

      const typeInput = entry.querySelector('.weapon-type-input');
      const depositInput = entry.querySelector('.weapon-deposit-input');
      const dateInput = entry.querySelector('.weapon-date-input');

      if (typeInput) typeInput.value = initial.type ? String(initial.type) : '';
      if (depositInput) depositInput.value = initial.deposit ? String(initial.deposit) : '';
      if (dateInput) dateInput.value = initial.depositDate ? String(initial.depositDate) : '';

      wireDateInput(dateInput);

      typeInput?.addEventListener('input', updatePiecesCount);

      updatePiecesCount();
      return entry;
    }

    function resetWeaponEntries(initialList = [{}]) {
      if (!refs.weaponEntriesContainer) return;
      refs.weaponEntriesContainer.innerHTML = '';
      (initialList.length ? initialList : [{}]).forEach((item) => addWeaponEntry(item));
      updatePiecesCount();
    }

    function renderDuplicateSummary(existingRow, newRow, headers) {
      if (!refs.duplicateSummary) return;
      refs.duplicateSummary.innerHTML = '';
      const safeExisting = existingRow && typeof existingRow === 'object' ? existingRow : {};
      const safeNew = newRow && typeof newRow === 'object' ? newRow : {};
      const preferredOrder = Array.isArray(headers) && headers.length
        ? headers.filter(Boolean)
        : ['الاسم', 'رقم', 'رقم القيد', 'نوع الرخصة', 'بيانات السلاح', 'العنوان', 'القسم التابع', 'القطاع', 'ملاحظات'];
      const visibleKeys = preferredOrder.filter((key, index, array) => {
        if (!key || array.indexOf(key) !== index) return false;
        return [safeExisting[key], safeNew[key]].some((value) => String(value ?? '').trim());
      });

      const buildCard = (title, data, tone) => {
        const card = document.createElement('section');
        card.className = `weapons-create-duplicate-card weapons-create-duplicate-card--${tone}`;

        const heading = document.createElement('h3');
        heading.className = 'weapons-create-duplicate-card__title';
        heading.textContent = title;
        card.appendChild(heading);

        visibleKeys.forEach((key) => {
          const row = document.createElement('div');
          row.className = 'weapons-create-duplicate-card__row';

          const label = document.createElement('span');
          label.className = 'weapons-create-duplicate-card__label';
          label.textContent = key;

          const value = document.createElement('span');
          value.className = 'weapons-create-duplicate-card__value';
          value.textContent = data && data[key] != null && String(data[key]).trim() ? String(data[key]) : '—';

          row.appendChild(label);
          row.appendChild(value);
          card.appendChild(row);
        });

        refs.duplicateSummary.appendChild(card);
      };

      buildCard('السجل الحالي', safeExisting, 'existing');
      buildCard('السجل الجديد', safeNew, 'new');
    }

    function hideDuplicateOverlay() {
      refs.duplicateOverlay?.setAttribute('hidden', '');
      if (refs.duplicateMessage) refs.duplicateMessage.textContent = '';
      pendingDuplicateState = null;
    }

    function showDuplicateOverlay(existingRow, newRow, headers, message) {
      renderDuplicateSummary(existingRow, newRow, headers);
      if (refs.duplicateMessage) refs.duplicateMessage.textContent = message || '';
      refs.duplicateOverlay?.removeAttribute('hidden');
    }

    function hideWeaponNumberOverlay() {
      refs.weaponNumberOverlay?.setAttribute('hidden', '');
    }

    function showWeaponNumberOverlay(entries = []) {
      allowMissingSerialOnce = false;
      if (refs.weaponNumberList) {
        refs.weaponNumberList.innerHTML = '';
        if (entries.length) {
          entries.forEach(({ index, text, missingSerial, missingCaliber }) => {
            const item = document.createElement('li');
            const label = typeof index === 'number' ? `السلاح رقم ${toArabicDigits(index + 1)}: ` : '';
            const reasons = [];
            if (missingCaliber) reasons.push('أضف العيار (رقم + مم)');
            if (missingSerial) reasons.push('أدخل رقم السلاح (أرقام واضحة أو حروف + أرقام)');
            const reasonText = reasons.length ? ` — ${reasons.join(' و ')}` : '';
            item.textContent = label + (text || '—') + reasonText;
            refs.weaponNumberList.appendChild(item);
          });
        } else {
          const item = document.createElement('li');
          item.textContent = 'أكمل الحقول الناقصة لكل سلاح قبل الحفظ.';
          refs.weaponNumberList.appendChild(item);
        }
      }
      refs.weaponNumberOverlay?.removeAttribute('hidden');
    }

    function captureFormState() {
      const entries = getWeaponEntryElements().map((entry) => ({
        type: entry.querySelector('.weapon-type-input')?.value || '',
        deposit: entry.querySelector('.weapon-deposit-input')?.value || '',
        depositDate: entry.querySelector('.weapon-date-input')?.value || ''
      }));
      return {
        recordNumber: refs.recordNumber?.value || '',
        fullname: refs.fullname?.value || '',
        cancelReason: refs.cancelReason?.value || '',
        address: refs.address?.value || '',
        licenseType: refs.licenseType?.value || '',
        cancelDate: refs.cancelDate?.value || '',
        sector: refs.sector?.value || '',
        currentAuthority: refs.currentAuthority?.value || '',
        notes: refs.notes?.value || '',
        weapons: entries
      };
    }

    function hasMeaningfulState(state) {
      if (!state || typeof state !== 'object') return false;
      const scalarValues = [
        state.recordNumber,
        state.fullname,
        state.cancelReason,
        state.address,
        state.licenseType,
        state.cancelDate,
        state.sector,
        state.currentAuthority,
        state.notes
      ];
      if (scalarValues.some((value) => String(value || '').trim())) return true;
      return Array.isArray(state.weapons) && state.weapons.some((weapon) => {
        if (!weapon || typeof weapon !== 'object') return false;
        return [weapon.type, weapon.deposit, weapon.depositDate].some((value) => String(value || '').trim());
      });
    }

    function restoreFormState(state) {
      if (!state || typeof state !== 'object') return;
      if (refs.recordNumber) refs.recordNumber.value = state.recordNumber || '';
      if (refs.fullname) refs.fullname.value = state.fullname || '';
      if (refs.cancelReason) refs.cancelReason.value = state.cancelReason || '';
      if (refs.address) refs.address.value = state.address || '';
      if (refs.licenseType) refs.licenseType.value = state.licenseType || '';
      if (refs.cancelDate) refs.cancelDate.value = state.cancelDate || '';
      if (refs.notes) refs.notes.value = state.notes || '';

      if (refs.sector) {
        refs.sector.value = resolveSectorValue(state.sector);
        syncAuthorityOptions();
        setTimeout(() => {
          if (!refs.currentAuthority || !state.currentAuthority) return;
          const resolvedAuthority = SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.resolveStationName === 'function'
            ? SHARED_REFERENCE_DATA.resolveStationName(state.currentAuthority, refs.sector?.value || '')
            : state.currentAuthority;
          refs.currentAuthority.value = resolvedAuthority || state.currentAuthority;
        }, 0);
      }

      const list = Array.isArray(state.weapons) ? state.weapons : [];
      resetWeaponEntries(list.length ? list : [{}]);
    }

    function resetFormState(options = {}) {
      refs.form?.reset();
      clearMainFormFields();
      if (!options.keepMessage) {
        setMessage('', '');
      }
      resetWeaponEntries();
      hideDuplicateOverlay();
      hideWeaponNumberOverlay();
      allowMissingSerialOnce = false;
      if (!options.keepDraft) {
        clearStoredDraft();
      }
    }

    async function appendRowToCsv(row, { force = false } = {}) {
      const payload = { ...row };
      if (force) payload.__forceAppend = true;
      const response = await fetch(API_APPEND, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        let payloadJson = null;
        try { payloadJson = await response.json(); } catch (_) {}
        if (payloadJson && payloadJson.approvalRequired) {
          return {
            ok: true,
            approvalRequired: true,
            message: payloadJson.message || 'تم إرسال طلب الإضافة إلى المدير والسيكرتير الأول لاعتماده.',
            request: payloadJson.request || null
          };
        }
        return { ok: true, message: payloadJson?.message || 'تم إدراج السجل بنجاح✅.' };
      }

      if (response.status === 409) {
        let payloadJson = null;
        try { payloadJson = await response.json(); } catch (_) {}
        return {
          ok: false,
          duplicate: true,
          message: payloadJson?.message || 'السجل موجود مسبقًا بنفس الاسم',
          existingRow: payloadJson?.existingRow || null,
          headers: payloadJson?.headers || null
        };
      }

      if (response.status === 423) {
        let payloadJson = null;
        try { payloadJson = await response.json(); } catch (_) {}
        return {
          ok: false,
          locked: true,
          message: payloadJson?.message || 'الملف مفتوح حاليًا، أغلقه ثم حاول مرة أخرى.'
        };
      }

      throw new Error(`HTTP ${response.status}`);
    }

    function isValidDMY(value) {
      const normalized = toLatinDigits(String(value || '').trim());
      const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized);
      if (!match) return false;
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      const date = new Date(year, month - 1, day);
      return date && date.getFullYear() === year && date.getMonth() === (month - 1) && date.getDate() === day;
    }

    function toYMD(dmy) {
      const normalized = toLatinDigits(String(dmy || '').trim());
      const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized);
      if (!match) return '';
      return `${match[3]}/${match[2]}/${match[1]}`;
    }

    function maybeRestoreDraft(force = false) {
      let shouldRestore = force;
      if (!shouldRestore) {
        try { shouldRestore = !!localStorage.getItem(CREATE_DRAFT_FLAG_KEY); } catch (_) {}
      }
      if (!shouldRestore) return false;
      let rawDraft = null;
      try { rawDraft = localStorage.getItem(CREATE_DRAFT_KEY); } catch (_) {}
      if (!rawDraft) {
        try { localStorage.removeItem(CREATE_DRAFT_FLAG_KEY); } catch (_) {}
        return false;
      }
      try {
        restoreFormState(JSON.parse(rawDraft));
        restoredFromDraft = true;
      } catch (error) {
        console.warn('failed to restore draft', error);
      }
      try { localStorage.removeItem(CREATE_DRAFT_FLAG_KEY); } catch (_) {}
      return restoredFromDraft;
    }

    function persistDraft() {
      const snapshot = captureFormState();
      if (!hasMeaningfulState(snapshot)) return false;
      try {
        localStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify(snapshot));
        return true;
      } catch (_) {
        return false;
      }
    }

    function requestClose() {
      hideDuplicateOverlay();
      hideWeaponNumberOverlay();
      if (typeof options.onClose === 'function') {
        options.onClose(api);
      }
    }

    function focusFirstField() {
      const target = refs.recordNumber || refs.fullname;
      setTimeout(() => {
        try { target?.focus(); } catch (_) {}
      }, 30);
    }

    function handleSuccessfulInsert(message) {
      const successMessage = '✔ ' + (message || 'تم إدراج السجل بنجاح.');
      resetFormState({ keepMessage: true });
      setMessage(successMessage, '#15803d');
      if (mode === 'modal' && typeof options.onSuccess === 'function') {
        options.onSuccess({ message: successMessage, api });
      }
      if (mode === 'modal') {
        requestClose();
      } else {
        focusFirstField();
      }
    }

    refs.weaponNumberBack?.addEventListener('click', (event) => {
      event.preventDefault();
      hideWeaponNumberOverlay();
    });

    refs.weaponNumberForce?.addEventListener('click', (event) => {
      event.preventDefault();
      allowMissingSerialOnce = true;
      hideWeaponNumberOverlay();
      refs.form?.requestSubmit();
    });

    refs.duplicateStay?.addEventListener('click', (event) => {
      event.preventDefault();
      hideDuplicateOverlay();
    });

    refs.duplicateForce?.addEventListener('click', async (event) => {
      event.preventDefault();
      if (!pendingDuplicateState) return;
      refs.duplicateForce.disabled = true;
      refs.duplicateInspect && (refs.duplicateInspect.disabled = true);
      refs.duplicateStay && (refs.duplicateStay.disabled = true);
      if (refs.duplicateMessage) refs.duplicateMessage.textContent = 'جارٍ الإضافة بالقوة...';
      try {
        const result = await appendRowToCsv(pendingDuplicateState.row, { force: true });
        if (result.ok) {
          handleSuccessfulInsert(result.message || 'تم إدراج السجل بنجاح✅.');
          hideDuplicateOverlay();
        } else if (result.duplicate) {
          showDuplicateOverlay(result.existingRow, pendingDuplicateState.row, result.headers, result.message);
          pendingDuplicateState.existingRow = result.existingRow;
        } else if (refs.duplicateMessage) {
          refs.duplicateMessage.textContent = result.message || 'تعذر الإضافة.';
        }
      } catch (error) {
        console.error('force append failed', error);
        if (refs.duplicateMessage) refs.duplicateMessage.textContent = 'حدث خطأ أثناء الإضافة.';
      } finally {
        refs.duplicateForce.disabled = false;
        refs.duplicateInspect && (refs.duplicateInspect.disabled = false);
        refs.duplicateStay && (refs.duplicateStay.disabled = false);
      }
    });

    refs.duplicateInspect?.addEventListener('click', (event) => {
      event.preventDefault();
      if (!pendingDuplicateState) return;
      const duplicateRow = pendingDuplicateState.row || {};
      const draftSaved = persistDraft();
      const focusPayload = {
        name: duplicateRow['الاسم'] || '',
        license: duplicateRow['رقم'] || duplicateRow['رقم القيد'] || '',
        timestamp: Date.now()
      };
      try { localStorage.setItem(SHEET_FOCUS_KEY, JSON.stringify(focusPayload)); } catch (_) {}
      hideDuplicateOverlay();

      if (mode === 'modal') {
        if (draftSaved) {
          try { localStorage.setItem(CREATE_DRAFT_FLAG_KEY, String(Date.now())); } catch (_) {}
        }
        if (typeof options.onInspectDuplicate === 'function') {
          options.onInspectDuplicate({ focusPayload, api, restored: draftSaved });
        } else if (typeof window.focusWeaponsSheetFilters === 'function') {
          window.focusWeaponsSheetFilters(focusPayload, { showReturnButton: true });
        }
        return;
      }

      window.location.href = 'sheet.html';
    });

    refs.closeButton?.addEventListener('click', (event) => {
      event.preventDefault();
      requestClose();
    });

    refs.resetButton?.addEventListener('click', (event) => {
      event.preventDefault();
      resetFormState();
      focusFirstField();
    });

    refs.sector?.addEventListener('change', syncAuthorityOptions);

    refs.form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (refs.submitButton) {
        refs.submitButton.disabled = true;
        refs.submitButton.textContent = 'جارٍ الحفظ...';
      }
      const resetSubmitButton = () => {
        if (refs.submitButton) {
          refs.submitButton.disabled = false;
          refs.submitButton.textContent = 'ادراج السجل';
        }
      };

      const recordNumber = String(refs.recordNumber?.value || '').trim();
      const fullname = String(refs.fullname?.value || '').trim();
      const weaponEntries = getWeaponEntryElements().map((entry) => ({
        entry,
        type: entry.querySelector('.weapon-type-input')?.value.trim() || '',
        deposit: entry.querySelector('.weapon-deposit-input')?.value.trim() || '',
        depositDate: entry.querySelector('.weapon-date-input')?.value.trim() || ''
      }));

      const incompleteWeapons = [];
      for (const [index, { entry, type, deposit, depositDate }] of weaponEntries.entries()) {
        if (!type && (deposit || depositDate)) {
          setMessage('يرجى كتابة نوع السلاح لكل إدخال قبل الحفظ.', '#ef4444');
          resetSubmitButton();
          const input = entry.querySelector('.weapon-type-input');
          input?.focus();
          return;
        }

        if (type) {
          const { hasCaliber, hasSerial } = analyzeWeaponText(type);
          if (!hasCaliber || !hasSerial) {
            incompleteWeapons.push({
              entry,
              index,
              text: type,
              missingCaliber: !hasCaliber,
              missingSerial: !hasSerial
            });
          }
        }
      }

      if (!allowMissingSerialOnce && incompleteWeapons.length) {
        setMessage('أكمل الأجزاء الناقصة لكل سلاح كما هو موضح في القائمة.', '#ef4444');
        resetSubmitButton();
        showWeaponNumberOverlay(incompleteWeapons);
        incompleteWeapons[0]?.entry?.querySelector('.weapon-type-input')?.focus();
        return;
      }
      allowMissingSerialOnce = false;

      const filledWeapons = [];
      for (const { type, deposit, depositDate, entry } of weaponEntries) {
        if (!type) continue;
        if (depositDate && !isValidDMY(depositDate)) {
          setMessage('تأكد من كتابة تاريخ الإيداع بشكل صحيح (يوم/شهر/سنة).', '#ef4444');
          resetSubmitButton();
          entry.querySelector('.weapon-date-input')?.focus();
          return;
        }
        filledWeapons.push({ type, deposit, depositDate });
      }

      if (!fullname || !recordNumber || filledWeapons.length === 0) {
        setMessage('يجب إدخال الاسم الرباعي، رقم الرخصة، وبيانات سلاح واحد على الأقل.', '#ef4444');
        resetSubmitButton();
        if (!fullname) refs.fullname?.focus();
        else if (!recordNumber) refs.recordNumber?.focus();
        else getWeaponEntryElements()[0]?.querySelector('.weapon-type-input')?.focus();
        return;
      }

      const notesValue = refs.notes?.value.trim() || '';
      const cancelDateRaw = refs.cancelDate?.value || '';
      if (cancelDateRaw && !isValidDMY(cancelDateRaw)) {
        setMessage('تأكد من كتابة تاريخ الإلغاء بشكل صحيح (يوم/شهر/سنة).', '#ef4444');
        resetSubmitButton();
        refs.cancelDate?.focus();
        return;
      }

      if (refs.piecesCount) {
        refs.piecesCount.value = String(filledWeapons.length);
      }

      const sectorText = refs.sector?.selectedOptions?.[0]?.textContent?.trim() || '';
      const weaponsSummary = filledWeapons.map((weapon, index) => {
        const prefix = filledWeapons.length > 1 ? `(${toArabicDigits(index + 1)}) ` : '';
        return prefix + toArabicDigits(weapon.type);
      }).join(' | ');

      const row = {
        'رقم': recordNumber,
        'نوع الرخصة': refs.licenseType?.value || '',
        'الاسم': fullname,
        'العنوان': refs.address?.value.trim() || '',
        'بيانات السلاح': weaponsSummary,
        'تاريخ قرار الالغاء': cancelDateRaw ? toArabicDigits(toYMD(cancelDateRaw)) : '',
        'سبب الالغاء': refs.cancelReason?.value.trim() || '',
        'القسم التابع': refs.currentAuthority?.disabled ? '' : (refs.currentAuthority?.value || ''),
        'القطاع': sectorText,
        'عدد القطع': toArabicDigits(refs.piecesCount?.value || String(filledWeapons.length)),
        'رقم الايداع': toArabicDigits(filledWeapons.map((weapon) => weapon.deposit).filter(Boolean).join(' | ')),
        'تاريخ الايداع': filledWeapons
          .map((weapon) => weapon.depositDate ? toArabicDigits(toYMD(weapon.depositDate)) : '')
          .filter(Boolean)
          .join(' | '),
        'ملاحظات': notesValue
      };

      try {
        const result = await appendRowToCsv(row, { force: false });
        if (result.ok) {
          handleSuccessfulInsert(result.message);
        } else if (result.duplicate) {
          pendingDuplicateState = { row, existingRow: result.existingRow, headers: result.headers };
          showDuplicateOverlay(result.existingRow, row, result.headers, result.message);
          setMessage(result.message || 'السجل موجود مسبقًا بنفس الاسم', '#ef4444');
        } else if (result.locked) {
          setMessage(result.message || 'لا يمكن الحفظ لأن ملف السجلات مفتوح الآن. أغلقه ثم أعد المحاولة.', '#ef4444');
        }
      } catch (error) {
        setMessage('فشل الإدراج: ' + (error?.message || error), '#ef4444');
      } finally {
        resetSubmitButton();
      }
    });

    const initialTypes = window.LICENSE_TYPES || window.WeaponsData?.licenseTypes || [];
    populateLicenseTypes(initialTypes);
    document.addEventListener('license-types:updated', (event) => {
      const types = event?.detail?.types || window.LICENSE_TYPES || [];
      populateLicenseTypes(types);
    });
    if (typeof window.fetchLicenseTypes === 'function') {
      window.fetchLicenseTypes().catch(() => {});
    }

    populateSectorOptions();
    window.addEventListener('reference-data:updated', () => {
      const previousSector = resolveSectorValue(refs.sector?.value);
      populateSectorOptions();
      if (refs.sector && previousSector) {
        refs.sector.value = previousSector;
        syncAuthorityOptions();
      }
    });

    wireDateInput(refs.cancelDate);
    wireNameLettersOnly(refs.fullname);

    maybeRestoreDraft();
    if (!restoredFromDraft) {
      resetWeaponEntries();
    } else {
      updatePiecesCount();
      restoredFromDraft = false;
    }
    syncAuthorityOptions();

    const api = {
      root,
      host,
      open(openOptions = {}) {
        maybeRestoreDraft(!!openOptions.restoreDraft);
        hideDuplicateOverlay();
        hideWeaponNumberOverlay();
        setMessage('', '');
        focusFirstField();
      },
      close() {
        requestClose();
      },
      reset(options = {}) {
        resetFormState(options);
      },
      captureState: captureFormState,
      persistDraft,
      restoreDraft() {
        return maybeRestoreDraft(true);
      }
    };

    return api;
  }

  window.WeaponsCreateForm = {
    mount,
    storageKeys: {
      draft: CREATE_DRAFT_KEY,
      draftFlag: CREATE_DRAFT_FLAG_KEY,
      sheetFocus: SHEET_FOCUS_KEY
    }
  };
})();
