(function storageApp() {
  'use strict';

  const API_BASE = '/api/storage';
  const SESSION_USER_KEY = 'general.auth.user';
  const SESSION_TOKEN_KEY = 'general.auth.token';
  const VIEW_STORAGE_KEY = 'storage.viewMode';
  const FOLDERS_STORAGE_KEY = 'storage.folders';
  const FILE_FOLDERS_STORAGE_KEY = 'storage.fileFolders';
  const ROLE_LABELS = {
    admin: 'مدير',
    supersecretary: 'سيكرتير أول',
    secretary: 'سكرتير',
    user: 'فرد'
  };
  const STATUS_LABELS = {
    active: 'نشط',
    archived: 'مؤرشف',
    deleted: 'محذوف'
  };
  const ROLE_RANKS = {
    superadmin: 0,
    admin: 1,
    supersecretary: 2,
    secretary: 3,
    user: 4
  };

  const state = {
    files: [],
    folders: getStoredFolders(),
    fileFolders: getStoredFileFolders(),
    stats: null,
    user: getStoredUser(),
    selectedIds: new Set(),
    contextMenuRecordId: '',
    currentFolderId: '',
    draggedFileId: '',
    expandedFolders: new Set(),
    sortKey: 'name',
    sortDirection: '',
    viewMode: getStoredViewMode(),
    browseUser: '',
    sectorFilter: '',
    portalUsers: null,
    portalUsersLoaded: false,
    filters: {
      scope: 'public',
      status: 'active',
      query: ''
    }
  };

  const els = {};
  let suppressListClicksUntil = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function getStoredUser() {
    try {
      const raw = sessionStorage.getItem(SESSION_USER_KEY) || localStorage.getItem(SESSION_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function getStoredToken() {
    try {
      return sessionStorage.getItem(SESSION_TOKEN_KEY) || localStorage.getItem(SESSION_TOKEN_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  function getStoredViewMode() {
    try {
      return localStorage.getItem(VIEW_STORAGE_KEY) === 'tiles' ? 'tiles' : 'details';
    } catch (_) {
      return 'details';
    }
  }

  function getStoredFolders() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FOLDERS_STORAGE_KEY) || '[]');
      return Array.isArray(parsed)
        ? parsed.filter((folder) => folder && folder.id && folder.name).map((folder) => ({
          ...folder,
          id: String(folder.id),
          name: String(folder.name),
          parentId: String(folder.parentId || '')
        }))
        : [];
    } catch (_) {
      return [];
    }
  }

  function persistFolders() {
    try {
      localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(state.folders));
    } catch (_) {}
  }

  function getStoredFileFolders() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FILE_FOLDERS_STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function persistFileFolders() {
    try {
      localStorage.setItem(FILE_FOLDERS_STORAGE_KEY, JSON.stringify(state.fileFolders));
    } catch (_) {}
  }
  function getCurrentFolderId() {
    return String(state.currentFolderId || '');
  }

  function findFolder(id) {
    const key = String(id || '');
    if (!key) return null;
    return state.folders.find((folder) => String(folder.id) === key) || null;
  }

  function folderExists(id) {
    const key = String(id || '');
    return !key || Boolean(findFolder(key));
  }

  function getCurrentFolderPath(folderId = getCurrentFolderId()) {
    const path = [];
    const seen = new Set();
    let folder = findFolder(folderId);
    while (folder && !seen.has(String(folder.id))) {
      seen.add(String(folder.id));
      path.unshift(folder);
      folder = findFolder(folder.parentId);
    }
    return path;
  }

  function getFolderPathLabel(folder) {
    const path = getCurrentFolderPath(folder && folder.id);
    return path.length ? path.map((item) => item.name).join(' \\ ') : String(folder && folder.name || '');
  }

  function setCurrentFolder(id) {
    state.currentFolderId = folderExists(id) ? String(id || '') : '';
    state.selectedIds.clear();
    closeContextMenu();
    renderFiles();
  }

  function openFolder(folder) {
    const target = folder && folder.id ? folder : findFolder(folder);
    if (!target) return;
    setCurrentFolder(target.id);
  }

  function isFolderDescendant(folderId, ancestorId) {
    const targetId = String(folderId || '');
    const rootId = String(ancestorId || '');
    if (!targetId || !rootId) return false;
    let current = findFolder(targetId);
    const seen = new Set();
    while (current && !seen.has(String(current.id))) {
      if (String(current.parentId || '') === rootId) return true;
      seen.add(String(current.id));
      current = findFolder(current.parentId);
    }
    return false;
  }

  function pruneFolderState() {
    if (state.currentFolderId && !folderExists(state.currentFolderId)) {
      state.currentFolderId = '';
    }
  }

  function getFileFolderId(record) {
    const folderId = String(record && record.folderId || '');
    return folderExists(folderId) ? folderId : '';
  }

  function isPersonalFolder(folder) {
    return Boolean(folder) && String(folder.scope || 'public').toLowerCase() === 'mine';
  }

  // Anything filed inside a personal tree belongs to the account that owns the tree,
  // no matter who uploaded it — that is how a file gets handed to another user
  function getPersonalFolderOwner(folderId) {
    let root = findFolder(folderId);
    if (!isPersonalFolder(root)) return null;
    const seen = new Set();
    while (root && !seen.has(String(root.id))) {
      seen.add(String(root.id));
      const parent = findFolder(root.parentId);
      if (!isPersonalFolder(parent)) break;
      root = parent;
    }
    const username = String(root.createdBy || '');
    if (!username) return null;
    return {
      username,
      display: String(root.createdByDisplay || username),
      role: String(root.createdByRole || '')
    };
  }

  function recordBelongsToUser(record, username) {
    const key = String(username || '');
    if (!key) return false;
    if (String(record && record.uploadedBy || '') === key) return true;
    const owner = getPersonalFolderOwner(getFileFolderId(record));
    return Boolean(owner && owner.username === key);
  }

  async function setFileFolder(recordId, folderId) {
    const id = String(recordId || '');
    const targetId = folderExists(folderId) ? String(folderId || '') : '';
    if (!id) return null;
    const payload = await apiJson(`${API_BASE}/files/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId: targetId })
    });
    const updated = payload.file || null;
    if (updated) {
      const index = state.files.findIndex((record) => String(record.id) === String(updated.id));
      if (index >= 0) state.files[index] = updated;
    }
    return updated;
  }
  function getVisibleFiles() {
    const currentFolderId = getCurrentFolderId();
    if (isUsersBrowse()) {
      if (!state.browseUser) return [];
      const owned = getBrowseUserFolderIds();
      return state.files.filter((record) => {
        if (!recordBelongsToUser(record, state.browseUser)) return false;
        const folderId = getFileFolderId(record);
        const level = owned.has(folderId) ? folderId : '';
        return level === currentFolderId;
      });
    }
    return state.files.filter((record) => getFileFolderId(record) === currentFolderId);
  }

  function getFolderChildSummary(folder) {
    const folderId = String(folder && folder.id || '');
    // While browsing one user, the summary counts what opening the folder will actually show
    const owned = isUsersBrowse() ? getBrowseUserFolderIds() : null;
    const folderCount = state.folders.filter((child) => String(child.parentId || '') === folderId
      && (!owned || owned.has(String(child.id)))).length;
    const fileCount = state.files.filter((record) => getFileFolderId(record) === folderId
      && (!owned || String(record.uploadedBy || '') === state.browseUser)).length;
    const parts = [];
    if (folderCount) parts.push(`${formatCount(folderCount)} مجلد`);
    if (fileCount) parts.push(`${formatCount(fileCount)} ملف`);
    return parts.length ? parts.join('، ') : 'فارغ';
  }
  function getMoveFolderCandidates(excludedFolderId = '', scope = '') {
    const excludedId = String(excludedFolderId || '');
    const wantedScope = String(scope || '').toLowerCase();
    return state.folders.filter((folder) => {
      const folderId = String(folder.id || '');
      if (excludedId && folderId === excludedId) return false;
      if (excludedId && isFolderDescendant(folderId, excludedId)) return false;
      if (wantedScope && String(folder.scope || 'public').toLowerCase() !== wantedScope) return false;
      return true;
    });
  }

  function promptFolderDestination(options = {}) {
    const scope = String(options.scope || '').toLowerCase();
    const currentId = String(options.currentId || '');
    const choices = [
      { id: '', label: 'الجذر' },
      ...getMoveFolderCandidates(options.excludedFolderId, scope).map((folder) => ({
        id: String(folder.id),
        label: getFolderPathLabel(folder)
      }))
    ];
    const defaultIndex = Math.max(0, choices.findIndex((choice) => choice.id === currentId));
    const lines = choices.map((choice, index) => `${index}. ${choice.label}`);
    const raw = window.prompt(`اختر رقم المجلد:\n${lines.join('\n')}`, String(defaultIndex));
    if (raw == null) return null;
    const index = Number.parseInt(String(raw).trim(), 10);
    if (!Number.isInteger(index) || index < 0 || index >= choices.length) {
      showToast('اختيار المجلد غير صحيح.', 'error');
      return null;
    }
    return choices[index].id;
  }

  async function moveFileToFolder(record, targetFolderId) {
    if (!record) return false;
    if (!canMoveFiles()) {
      showToast('نقل الملفات متاح للمسؤولين والسكرتير الأول فقط.', 'error');
      return false;
    }
    const destination = arguments.length > 1
      ? String(targetFolderId || '')
      : promptFolderDestination({ currentId: getFileFolderId(record) });
    if (destination == null) return false;
    await setFileFolder(record.id, destination);
    state.selectedIds.clear();
    state.selectedIds.add(String(record.id));
    renderFiles();
    const destinationFolder = findFolder(destination);
    showToast(destinationFolder ? `تم نقل الملف إلى ${destinationFolder.name}.` : 'تم نقل الملف إلى الجذر.', 'success');
    return true;
  }

  async function moveFolderToFolder(folder, targetFolderId) {
    if (!folder) return false;
    if (!canModifyFolder(folder)) {
      warnFolderNotModifiable(folder);
      return false;
    }
    const scope = String(folder.scope || 'public').toLowerCase();
    const destination = arguments.length > 1
      ? String(targetFolderId || '')
      : promptFolderDestination({ currentId: folder.parentId, excludedFolderId: folder.id, scope });
    if (destination == null) return false;
    if (destination === String(folder.id) || isFolderDescendant(destination, folder.id)) {
      showToast('لا يمكن نقل المجلد داخل نفسه.', 'error');
      return false;
    }
    const payload = await apiJson(`${API_BASE}/folders/${encodeURIComponent(folder.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: destination })
    });
    const updated = payload.folder || null;
    if (updated) {
      const index = state.folders.findIndex((item) => String(item.id) === String(updated.id));
      if (index >= 0) state.folders[index] = updated;
    }
    state.selectedIds.clear();
    state.selectedIds.add(folderSelectionId(updated || folder));
    renderFiles();
    const destinationFolder = findFolder(destination);
    showToast(destinationFolder ? `تم نقل المجلد إلى ${destinationFolder.name}.` : 'تم نقل المجلد إلى الجذر.', 'success');
    return true;
  }
  function rememberUploadedFileFolder(record) {
    if (!record || !record.id) return;
    const index = state.files.findIndex((item) => String(item.id) === String(record.id));
    if (index >= 0) state.files[index] = record;
  }
  function normalizeRole(user) {
    const raw = user && typeof user === 'object' ? user.role : user;
    const normalized = String(raw || 'user').trim().toLowerCase();
    if (normalized === 'superadmin' || normalized === 'super-admin' || normalized === 'super_admin') return 'superadmin';
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

  function isAdmin() {
    const role = normalizeRole(state.user);
    return role === 'admin' || role === 'superadmin';
  }

  function canManageAvailability() {
    const role = normalizeRole(state.user);
    return role === 'admin' || role === 'superadmin';
  }

  function canMoveFiles() {
    const role = normalizeRole(state.user);
    return role === 'admin' || role === 'superadmin' || role === 'supersecretary';
  }

  function canManageSharedFolders() {
    const role = normalizeRole(state.user);
    return role === 'admin' || role === 'superadmin' || role === 'supersecretary';
  }

  // Normal users only build folders inside their own "ملفاتي" tree
  function canCreateFolderHere() {
    if (isUsersRoot()) return false;
    if (canManageSharedFolders()) return true;
    const parent = findFolder(getCurrentFolderId());
    if (parent) return String(parent.scope || 'public').toLowerCase() === 'mine';
    return String(state.filters.scope || 'public').toLowerCase() === 'mine';
  }

  function isUsersBrowse() {
    return isAdmin() && state.filters.scope === 'users';
  }

  function isUsersRoot() {
    return isUsersBrowse() && !state.browseUser;
  }

  // The user view mirrors the real tree: folders they created, folders holding their
  // files (wherever an admin filed them), and the ancestors that lead back to the root
  function getBrowseUserFolderIds() {
    const owner = String(state.browseUser || '');
    const ids = new Set();
    if (!owner) return ids;
    const includeBranch = (folderId) => {
      let folder = findFolder(folderId);
      while (folder && !ids.has(String(folder.id))) {
        if (folder.status === 'deleted') return;
        ids.add(String(folder.id));
        folder = findFolder(folder.parentId);
      }
    };
    state.folders.forEach((folder) => {
      if (folder.status === 'deleted') return;
      const personalOwner = getPersonalFolderOwner(folder.id);
      if (String(folder.createdBy || '') === owner || (personalOwner && personalOwner.username === owner)) {
        includeBranch(folder.id);
      }
    });
    state.files.forEach((record) => {
      if (!recordBelongsToUser(record, owner)) return;
      includeBranch(getFileFolderId(record));
    });
    return ids;
  }

  async function loadPortalUsers() {
    if (!isAdmin() || state.portalUsersLoaded) return;
    state.portalUsersLoaded = true;
    try {
      const data = await apiJson('/api/users');
      state.portalUsers = Array.isArray(data.users) ? data.users : [];
    } catch (_) {
      state.portalUsers = [];
    }
    renderFiles();
  }

  function getPortalUserEntry(username) {
    const key = String(username || '');
    if (!key || !Array.isArray(state.portalUsers)) return null;
    return state.portalUsers.find((user) => String(user && user.username || '') === key) || null;
  }

  function getPortalUserSectors(portalUser) {
    if (!portalUser) return [];
    if (Array.isArray(portalUser.sectors) && portalUser.sectors.length) return uniqueTextValues(portalUser.sectors);
    if (Array.isArray(portalUser.rooms) && portalUser.rooms.length) return uniqueTextValues(portalUser.rooms);
    return uniqueTextValues(portalUser.room ? [portalUser.room] : []);
  }

  function getUserFolderEntries(options = {}) {
    const entries = new Map();
    const ensure = (username, display, role) => {
      const key = String(username || '').trim();
      if (!key) return null;
      if (!entries.has(key)) {
        entries.set(key, {
          username: key,
          display: String(display || '').trim() || key,
          role: String(role || '').trim(),
          fileCount: 0,
          folderCount: 0,
          bytes: 0,
          latestUpload: '',
          fileSectors: new Set()
        });
      }
      return entries.get(key);
    };

    const addFile = (entry, record) => {
      if (!entry) return;
      entry.fileCount += 1;
      entry.bytes += Number(record.size || 0);
      const uploadedAt = String(record.uploadedAt || '');
      if (uploadedAt > entry.latestUpload) entry.latestUpload = uploadedAt;
      getAvailabilitySectorValues(record).forEach((sector) => entry.fileSectors.add(sector));
    };

    state.files.forEach((record) => {
      if (record.status && record.status !== 'active') return;
      addFile(ensure(record.uploadedBy, record.uploadedByDisplay, record.uploadedByRole), record);
      // a file handed over into someone's personal folder counts for that owner too
      const owner = getPersonalFolderOwner(getFileFolderId(record));
      if (owner && owner.username !== String(record.uploadedBy || '')) {
        addFile(ensure(owner.username, owner.display, owner.role), record);
      }
    });

    state.folders.forEach((folder) => {
      if (folder.status === 'deleted') return;
      const entry = ensure(folder.createdBy, folder.createdByDisplay, folder.createdByRole);
      if (entry) entry.folderCount += 1;
    });

    const query = String(state.filters.query || '').trim().toLowerCase();
    const sectorFilter = options.skipSectorFilter ? '' : String(state.sectorFilter || '');

    return Array.from(entries.values()).map((entry) => {
      const portalUser = getPortalUserEntry(entry.username);
      if (portalUser && portalUser.displayName) entry.display = String(portalUser.displayName);
      if (portalUser && portalUser.role) entry.role = String(portalUser.role);
      const portalSectors = getPortalUserSectors(portalUser);
      entry.sectors = portalSectors.length ? portalSectors : uniqueTextValues(Array.from(entry.fileSectors));
      return entry;
    }).filter((entry) => {
      if (sectorFilter === '__none__') {
        if (entry.sectors.length) return false;
      } else if (sectorFilter && !entry.sectors.includes(sectorFilter)) {
        return false;
      }
      if (!query) return true;
      const nameMatch = entry.display.toLowerCase().includes(query)
        || entry.username.toLowerCase().includes(query);
      return nameMatch || entry.fileCount > 0;
    }).sort((a, b) => a.display.localeCompare(b.display, 'ar', { sensitivity: 'base', numeric: true }));
  }

  function getBrowseUserLabel() {
    const portalUser = getPortalUserEntry(state.browseUser);
    if (portalUser && portalUser.displayName) return String(portalUser.displayName);
    const fromFiles = state.files.find((record) => String(record.uploadedBy || '') === state.browseUser);
    if (fromFiles && fromFiles.uploadedByDisplay) return String(fromFiles.uploadedByDisplay);
    const fromFolders = state.folders.find((folder) => String(folder.createdBy || '') === state.browseUser);
    if (fromFolders && fromFolders.createdByDisplay) return String(fromFolders.createdByDisplay);
    return String(state.browseUser || '');
  }

  function openUserFolder(username) {
    const key = String(username || '').trim();
    if (!key) return;
    suppressListClicksUntil = Date.now() + 500;
    state.browseUser = key;
    state.currentFolderId = '';
    state.selectedIds.clear();
    closeContextMenu();
    renderFiles();
  }

  function exitUserFolder() {
    state.browseUser = '';
    state.currentFolderId = '';
    state.selectedIds.clear();
    closeContextMenu();
    renderFiles();
  }

  function getReferenceHelper() {
    return window.AdministrativeSharedReferenceData || null;
  }

  function uniqueTextValues(values) {
    const result = [];
    const seen = new Set();
    (Array.isArray(values) ? values : [values]).forEach((value) => {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      result.push(text);
    });
    return result;
  }

  function getUserSectorValues() {
    const user = state.user || {};
    if (Array.isArray(user.sectors) && user.sectors.length) return uniqueTextValues(user.sectors);
    if (Array.isArray(user.rooms) && user.rooms.length) return uniqueTextValues(user.rooms);
    return uniqueTextValues(user.room ? [user.room] : []);
  }

  function getAvailabilitySectorOptions() {
    const helper = getReferenceHelper();
    if (helper && typeof helper.getSectorChoices === 'function') {
      const choices = helper.getSectorChoices('label');
      if (Array.isArray(choices) && choices.length) {
        return choices.map((choice) => {
          const value = String(choice && (choice.value || choice.label) || '').trim();
          const label = String(choice && (choice.label || choice.value) || '').trim();
          return value && label ? { value, label } : null;
        }).filter(Boolean);
      }
    }
    return getUserSectorValues().map((value) => ({ value, label: value }));
  }
  function getAvailabilitySectorValues(record) {
    if (record && Array.isArray(record.availabilitySectors) && record.availabilitySectors.length) {
      return uniqueTextValues(record.availabilitySectors);
    }
    if (record && record.availabilitySector) return uniqueTextValues([record.availabilitySector]);
    return [];
  }

  function getAvailabilitySectorOptionValues() {
    return uniqueTextValues(getAvailabilitySectorOptions().map((option) => option.value));
  }

  function formatAvailabilitySectors(record) {
    const sectors = getAvailabilitySectorValues(record);
    if (!sectors.length) return 'لا يوجد قطاع';

    const allSectorValues = getAvailabilitySectorOptionValues();
    const selectedSet = new Set(sectors);
    if (
      allSectorValues.length
      && selectedSet.size === allSectorValues.length
      && allSectorValues.every((sector) => selectedSet.has(sector))
    ) {
      return 'كل القطاعات';
    }

    return sectors.join('، ');
  }
  function setAvailabilitySectorsValue(form, sectors) {
    if (!form || !form.elements.availabilitySectors) return;
    form.elements.availabilitySectors.value = JSON.stringify(uniqueTextValues(sectors));
  }

  function getSelectedAvailabilitySectors(form) {
    if (!form) return [];
    return uniqueTextValues(Array.from(form.querySelectorAll('[data-availability-sector-option]:checked'))
      .map((input) => input.value));
  }

  function renderAvailabilitySectorOptions(form, selectedValues, settings = {}) {
    const list = form && form.querySelector('[data-availability-sector-list]');
    if (!list) return;

    const selected = uniqueTextValues(selectedValues);
    const options = getAvailabilitySectorOptions();
    const optionValues = new Set(options.map((option) => option.value));
    selected.forEach((value) => {
      if (!optionValues.has(value)) {
        options.push({ value, label: value });
        optionValues.add(value);
      }
    });

    const checkedValues = selected.length
      ? selected
      : (settings.defaultAll ? options.map((option) => option.value) : []);
    const checkedSet = new Set(checkedValues);

    if (!options.length) {
      list.innerHTML = '<span class="availability-sector-empty">لا توجد قطاعات متاحة.</span>';
      setAvailabilitySectorsValue(form, []);
      return;
    }

    list.innerHTML = options.map((option) => `
      <label class="availability-sector-option">
        <input type="checkbox" data-availability-sector-option value="${escapeHtml(option.value)}" ${checkedSet.has(option.value) ? 'checked' : ''} />
        <span>${escapeHtml(option.label)}</span>
      </label>
    `).join('');
    setAvailabilitySectorsValue(form, checkedValues);
  }
  function selectAllAvailabilitySectors(form) {
    if (!form || !canManageAvailability()) return;
    form.querySelectorAll('[data-availability-sector-option]').forEach((input) => {
      input.checked = true;
    });
    const selected = getSelectedAvailabilitySectors(form);
    setAvailabilitySectorsValue(form, selected);
  }
  function renderAvailabilityControls(form, record) {
    if (!form) return;
    const canManage = canManageAvailability();
    const sectorsInput = form.elements.availabilitySectors;
    const sectorList = form.querySelector('[data-availability-sector-list]');
    form.querySelectorAll('[data-availability-field]').forEach((field) => {
      field.hidden = !canManage;
    });
    form.querySelectorAll('[data-select-all-availability-sectors]').forEach((button) => {
      button.disabled = !canManage;
    });
    if (sectorsInput) sectorsInput.disabled = !canManage;
    if (!canManage) {
      if (sectorsInput) sectorsInput.value = '';
      if (sectorList) sectorList.innerHTML = '';
      return;
    }

    renderAvailabilitySectorOptions(form, getAvailabilitySectorValues(record), { defaultAll: !record });
  }

  function getAvailabilityPayload(form) {
    if (!canManageAvailability() || !form) return {};
    return {
      availabilitySectors: getSelectedAvailabilitySectors(form)
    };
  }
  function getRoleRank(value) {
    const role = normalizeRole(value);
    return Object.prototype.hasOwnProperty.call(ROLE_RANKS, role) ? ROLE_RANKS[role] : ROLE_RANKS.user;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    const formatter = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 1 });
    if (bytes >= 1024 * 1024 * 1024) return `${formatter.format(bytes / (1024 * 1024 * 1024))} جيجابايت`;
    if (bytes >= 1024 * 1024) return `${formatter.format(bytes / (1024 * 1024))} ميجابايت`;
    if (bytes >= 1024) return `${formatter.format(bytes / 1024)} كيلوبايت`;
    return `${formatter.format(bytes)} بايت`;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  function showToast(message, type) {
    els.toast.textContent = message;
    els.toast.className = `toast ${type || 'info'}`;
    els.toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      els.toast.hidden = true;
    }, 3200);
  }

  async function apiJson(url, options = {}) {
    const response = await fetch(url, {
      cache: 'no-store',
      ...options
    });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : null;
    if (!response.ok || (payload && payload.success === false)) {
      throw new Error(payload && payload.message || `HTTP ${response.status}`);
    }
    return payload || {};
  }

  function buildQuery() {
    const params = new URLSearchParams();
    Object.entries(state.filters).forEach(([key, value]) => {
      if (!value) return;
      params.set(key, key === 'scope' && value === 'users' ? 'all' : value);
    });
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  function applyInitialUrlQuery() {
    const params = new URLSearchParams(window.location.search || '');
    const query = params.get('query') || params.get('name') || params.get('license') || '';
    if (query) state.filters.query = query.trim();
  }

  function buildFolderQuery() {
    const params = new URLSearchParams();
    const scope = state.filters.scope === 'users' ? 'all' : (state.filters.scope || 'public');
    params.set('scope', scope);
    params.set('status', state.filters.status || 'active');
    const query = params.toString();
    return query ? `?${query}` : '';
  }
  async function loadStats() {
    const data = await apiJson(`${API_BASE}/stats`);
    state.stats = data.stats || null;
    renderStats();
  }

  async function loadFolders() {
    const data = await apiJson(`${API_BASE}/folders${buildFolderQuery()}`);
    state.folders = Array.isArray(data.folders) ? data.folders : [];
    pruneFolderState();
    renderFiles();
  }
  async function loadFiles() {
    els.tableStatus.textContent = 'جاري تحميل الملفات...';
    const data = await apiJson(`${API_BASE}/files${buildQuery()}`);
    state.files = Array.isArray(data.files) ? data.files : [];
    pruneFolderState();
    renderFiles();
  }

  async function refreshAll() {
    try {
      await Promise.all([loadStats(), loadFiles(), loadFolders(), loadPortalUsers()]);
    } catch (error) {
      els.tableStatus.textContent = error.message || 'تعذر تحميل الملفات';
      showToast(els.tableStatus.textContent, 'error');
    }
  }

  function renderStats() {
    const stats = state.stats || {};
    const cards = [
      { label: 'الملفات النشطة', value: stats.totalFiles || 0, tone: 'green' },
      { label: 'المؤرشفة', value: stats.archivedFiles || 0, tone: 'amber' },
      { label: 'المساحة', value: formatBytes(stats.totalBytes || 0), tone: 'blue' },
      { label: 'الملفات العامة', value: stats.publicFiles ?? stats.visibleFiles ?? 0, tone: 'gray' }
    ];
    els.statsGrid.innerHTML = cards.map((card) => `
      <article class="stat-card ${card.tone}">
        <span>${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.value)}</strong>
      </article>
    `).join('');
    renderStorageNav();
    renderDetailsPane();
  }

  function formatCount(value) {
    return new Intl.NumberFormat('ar-EG').format(Number(value || 0));
  }

  function getScopeLabel(scope) {
    const labels = {
      public: 'ملفات العامة',
      general: 'ملفات العامة',
      visible: 'ملفات العامة',
      mine: 'ملفاتي',
      all: 'كل الملفات',
      users: 'ملفات المستخدمين'
    };
    return labels[scope] || scope || 'ملفات العامة';
  }

  function getStatusFilterLabel(status) {
    const labels = {
      active: 'نشط',
      archived: 'الأرشيف',
      deleted: 'محذوف',
      all: 'كل الحالات'
    };
    return labels[status] || status || 'نشط';
  }

  // Admins open on the per-user browse view, everyone else opens inside their own "ملفاتي"
  function getLandingScope() {
    if (isAdmin()) return state.filters.query ? 'all' : 'users';
    return state.filters.query ? 'public' : 'mine';
  }

  function getStorageNavItems() {
    const stats = state.stats || {};
    const items = [];
    const myFilesItem = {
      label: 'ملفاتي',
      description: 'نشط',
      scope: 'mine',
      status: 'active',
      count: null
    };

    if (isAdmin()) {
      items.push({
        label: 'ملفات المستخدمين',
        description: 'حسب المستخدم',
        scope: 'users',
        status: 'active',
        count: null
      }, myFilesItem);
    } else {
      // the landing view heads the list for normal users
      items.push(myFilesItem, {
        label: 'ملفات العامة',
        description: 'نشط',
        scope: 'public',
        status: 'active',
        count: stats.publicFiles ?? stats.visibleFiles
      });
    }

    items.push({
      label: 'الأرشيف',
      description: 'مؤرشف',
      scope: 'public',
      status: 'archived',
      count: stats.archivedFiles
    });

    if (isAdmin()) {
      items.push(
        {
          label: 'كل الملفات',
          description: 'نشط',
          scope: 'all',
          status: 'active',
          count: stats.totalFiles
        },
        {
          label: 'المحذوفات',
          description: 'محذوف',
          scope: 'all',
          status: 'deleted',
          count: null
        }
      );
    }

    return items;
  }

  function renderStorageNav() {
    if (!els.storageNav) return;
    els.storageNav.innerHTML = getStorageNavItems().map((item) => {
      const active = state.filters.scope === item.scope && state.filters.status === item.status;
      const count = item.count == null ? '' : `<span class="nav-count">${escapeHtml(formatCount(item.count))}</span>`;
      return `
        <button type="button" class="storage-nav-item${active ? ' active' : ''}" data-nav-scope="${escapeHtml(item.scope)}" data-nav-status="${escapeHtml(item.status)}" aria-current="${active ? 'page' : 'false'}">
          <span class="folder-glyph" aria-hidden="true"></span>
          <span class="nav-text">
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(item.description)}</small>
          </span>
          ${count}
        </button>
      `;
    }).join('');
  }

  function renderFolderTree() {
    if (!els.folderTree) return;
    if (isUsersRoot()) {
      if (els.folderTreeSection) els.folderTreeSection.hidden = true;
      els.folderTree.innerHTML = '';
      return;
    }
    const browsing = isUsersBrowse();
    const owned = browsing ? getBrowseUserFolderIds() : null;
    const currentId = getCurrentFolderId();
    const byParent = new Map();
    state.folders.forEach((folder) => {
      if (folder.status === 'deleted') return;
      if (browsing && !owned.has(String(folder.id))) return;
      let parent = String(folder.parentId || '');
      if (browsing && !owned.has(parent)) parent = '';
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent).push(folder);
    });
    byParent.forEach((list) => {
      list.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar', { sensitivity: 'base', numeric: true }));
    });

    const renderLevel = (parentId, depth) => (byParent.get(parentId) || []).map((folder) => {
      const id = String(folder.id);
      const hasChildren = byParent.has(id);
      const expanded = state.expandedFolders.has(id);
      const children = hasChildren && expanded ? renderLevel(id, depth + 1).join('') : '';
      return `
        <div class="tree-node" style="--depth:${depth}">
          <button type="button" class="tree-toggle" data-tree-toggle="${escapeHtml(id)}" ${hasChildren ? '' : 'disabled'} aria-label="${expanded ? 'طي' : 'توسيع'}">${hasChildren ? (expanded ? '▾' : '◃') : ''}</button>
          <button type="button" class="tree-label${currentId === id ? ' active' : ''}" data-tree-folder-id="${escapeHtml(id)}" title="${escapeHtml(folder.name)}">
            <span class="folder-glyph" aria-hidden="true"></span>
            <span class="tree-name">${escapeHtml(folder.name)}</span>
          </button>
        </div>
        ${children}
      `;
    });

    const html = renderLevel('', 0).join('');
    if (els.folderTreeSection) els.folderTreeSection.hidden = !html.trim();
    els.folderTree.innerHTML = html;
  }

  function handleFolderTreeClick(event) {
    const toggle = event.target.closest('[data-tree-toggle]');
    if (toggle && !toggle.disabled) {
      const id = String(toggle.getAttribute('data-tree-toggle') || '');
      if (state.expandedFolders.has(id)) {
        state.expandedFolders.delete(id);
      } else {
        state.expandedFolders.add(id);
      }
      renderFolderTree();
      return;
    }
    const label = event.target.closest('[data-tree-folder-id]');
    if (!label) return;
    const id = String(label.getAttribute('data-tree-folder-id') || '');
    getCurrentFolderPath(id).forEach((folder) => state.expandedFolders.add(String(folder.id)));
    setCurrentFolder(id);
  }

  function renderBreadcrumbs() {
    if (!els.breadcrumbBar) return;
    const path = getCurrentFolderPath();
    const crumbs = [];
    if (isUsersBrowse()) {
      crumbs.push({ label: getScopeLabel('users'), usersRoot: true });
      if (state.browseUser) {
        crumbs.push({ label: getBrowseUserLabel(), folderId: '' });
      }
    } else {
      crumbs.push({ label: getScopeLabel(state.filters.scope), folderId: '' });
    }
    crumbs.push(...path.map((folder) => ({ label: folder.name, folderId: String(folder.id) })));
    if (state.filters.status !== 'active') {
      crumbs.push({ label: getStatusFilterLabel(state.filters.status), static: true });
    }
    if (state.filters.query) {
      crumbs.push({ label: `بحث: ${state.filters.query}`, static: true });
    }
    els.breadcrumbBar.innerHTML = crumbs.map((crumb, index) => {
      const current = index === crumbs.length - 1;
      if (crumb.static) {
        return `<span class="breadcrumb-part${current ? ' current' : ''}">${escapeHtml(crumb.label)}</span>`;
      }
      if (crumb.usersRoot) {
        return `
          <button type="button" class="breadcrumb-part${current ? ' current' : ''}" data-breadcrumb-users-root ${current ? 'aria-current="page"' : ''}>
            ${escapeHtml(crumb.label)}
          </button>
        `;
      }
      return `
        <button type="button" class="breadcrumb-part${current ? ' current' : ''}" data-breadcrumb-folder-id="${escapeHtml(crumb.folderId)}" ${current ? 'aria-current="page"' : ''}>
          ${escapeHtml(crumb.label)}
        </button>
      `;
    }).join('');
  }
  function renderSectorFilter() {
    const select = els.sectorFilterSelect;
    const wrap = els.sectorFilterWrap;
    if (!select || !wrap) return;
    const show = isUsersRoot();
    wrap.hidden = !show;
    if (!show) return;

    const values = new Set(getAvailabilitySectorOptionValues());
    getUserFolderEntries({ skipSectorFilter: true }).forEach((entry) => {
      (entry.sectors || []).forEach((sector) => values.add(sector));
    });
    const sorted = Array.from(values).sort((a, b) => a.localeCompare(b, 'ar', { sensitivity: 'base', numeric: true }));
    const html = [
      `<option value="">كل القطاعات</option>`,
      ...sorted.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`),
      `<option value="__none__">بدون قطاع</option>`
    ].join('');
    if (select.dataset.renderedOptions !== html) {
      select.innerHTML = html;
      select.dataset.renderedOptions = html;
    }
    if (state.sectorFilter && state.sectorFilter !== '__none__' && !sorted.includes(state.sectorFilter)) {
      state.sectorFilter = '';
    }
    select.value = state.sectorFilter;
  }

  function setViewMode(mode, options = {}) {
    const nextMode = mode === 'tiles' ? 'tiles' : 'details';
    state.viewMode = nextMode;
    if (els.filesBody) els.filesBody.dataset.view = nextMode;
    if (els.fileListHeader) els.fileListHeader.hidden = nextMode !== 'details';
    document.querySelectorAll('[data-view-mode]').forEach((button) => {
      const active = button.getAttribute('data-view-mode') === nextMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (!options.skipPersist) {
      try {
        localStorage.setItem(VIEW_STORAGE_KEY, nextMode);
      } catch (_) {}
    }
  }

  function applyNavPreset(event) {
    const button = event.target.closest('[data-nav-scope]');
    if (!button) return;
    state.filters.scope = button.getAttribute('data-nav-scope') || 'public';
    state.filters.status = button.getAttribute('data-nav-status') || 'active';
    state.currentFolderId = '';
    state.browseUser = '';

    renderStorageNav();
    renderBreadcrumbs();
    refreshAll().catch((error) => {
      els.tableStatus.textContent = error.message || 'تعذر تحميل الملفات';
      showToast(els.tableStatus.textContent, 'error');
    });
  }

  function getSelectedRecords() {
    return Array.from(state.selectedIds).map((id) => findFile(id)).filter(Boolean);
  }

  function getSelectedFolders() {
    return Array.from(state.selectedIds).map((id) => {
      const key = String(id || '');
      return key.startsWith('folder:') ? findFolder(key.slice(7)) : null;
    }).filter(Boolean);
  }

  function renderDetailsPane() {
    if (!els.detailsPane) return;
    const selected = getSelectedRecords();
    const selectedFolders = getSelectedFolders();
    if (!selected.length && selectedFolders.length === 1) {
      const folder = selectedFolders[0];
      els.detailsPane.innerHTML = `
        <div class="details-file">
          <div class="details-icon folder-large-icon" aria-hidden="true"></div>
          <h2>${escapeHtml(folder.name)}</h2>
          <p>${escapeHtml(getFolderPathLabel(folder) || folder.name)}</p>
          <dl class="details-list">
            <div><dt>النوع</dt><dd>مجلد</dd></div>
            <div><dt>المحتوى</dt><dd>${escapeHtml(getFolderChildSummary(folder))}</dd></div>
            <div><dt>المنشئ</dt><dd>${escapeHtml(folder.createdByDisplay || folder.createdBy || '—')}</dd></div>
            <div><dt>تاريخ الإنشاء</dt><dd>${escapeHtml(formatDate(folder.createdAt))}</dd></div>
          </dl>
        </div>
      `;
      return;
    }
    if (!selected.length) {
      const stats = state.stats || {};
      els.detailsPane.innerHTML = `
        <div class="details-empty">
          <h2>تفاصيل التخزين</h2>
          <dl class="details-list">
            <div><dt>النشطة</dt><dd>${escapeHtml(formatCount(stats.totalFiles || 0))}</dd></div>
            <div><dt>المؤرشفة</dt><dd>${escapeHtml(formatCount(stats.archivedFiles || 0))}</dd></div>
            <div><dt>المساحة</dt><dd>${escapeHtml(formatBytes(stats.totalBytes || 0))}</dd></div>
          </dl>
        </div>
      `;
      return;
    }

    if (selected.length > 1) {
      const totalBytes = selected.reduce((sum, record) => sum + Number(record.size || 0), 0);
      els.detailsPane.innerHTML = `
        <div class="details-empty">
          <h2>${escapeHtml(formatCount(selected.length))} عناصر محددة</h2>
          <dl class="details-list">
            <div><dt>الحجم الإجمالي</dt><dd>${escapeHtml(formatBytes(totalBytes))}</dd></div>
          </dl>
        </div>
      `;
      return;
    }

    const record = selected[0];
    const displayPath = String(record.sourcePath || record.displayPath || '').trim();
    const notes = String(record.description || '').trim();
    els.detailsPane.innerHTML = `
      <div class="details-file-icon"><span>${escapeHtml(getFileExtension(record))}</span></div>
      <h2 title="${escapeHtml(record.title || record.originalName)}">${escapeHtml(record.title || record.originalName)}</h2>
      <p class="details-subtitle">${escapeHtml(record.originalName || '')}</p>
      <dl class="details-list">
        <div><dt>الحالة</dt><dd>${escapeHtml(STATUS_LABELS[record.status] || record.status || 'نشط')}</dd></div>
        <div><dt>الحجم</dt><dd>${escapeHtml(formatBytes(record.size))}</dd></div>
        <div><dt>الرافع</dt><dd>${escapeHtml(record.uploadedByDisplay || record.uploadedBy || '—')}</dd></div>
        <div><dt>تاريخ الرفع</dt><dd>${escapeHtml(formatDate(record.uploadedAt))}</dd></div>
        <div><dt>القطاعات</dt><dd>${escapeHtml(formatAvailabilitySectors(record))}</dd></div>
        ${displayPath ? `<div><dt>المسار</dt><dd class="details-path">${escapeHtml(displayPath)}</dd></div>` : ''}
        <div><dt>ملاحظات</dt><dd>${notes ? escapeHtml(notes) : '—'}</dd></div>
      </dl>
    `;
  }
  function canArchive(record) {
    if (!record || record.status !== 'active') return false;
    return isAdmin() || record.uploadedBy === (state.user && state.user.username);
  }

  function canEdit(record) {
    if (!record || record.status === 'deleted') return false;
    return isAdmin() || record.uploadedBy === (state.user && state.user.username);
  }

  function canDelete(record) {
    if (!record || !isAdmin()) return false;
    const username = String(state.user && state.user.username || '');
    if (username && record.uploadedBy === username) return true;
    const uploadedByRole = String(record.uploadedByRole || '').trim();
    return uploadedByRole ? getRoleRank(state.user) < getRoleRank(uploadedByRole) : false;
  }

  function canRestore(record) {
    return Boolean(record) && record.status !== 'active' && isAdmin();
  }

  function getFileExtension(record) {
    const name = String(record && (record.originalName || record.storedName || record.title) || '');
    const match = name.match(/\.([a-z0-9]{1,8})$/i);
    return match ? match[1].toUpperCase() : 'FILE';
  }

  const IMAGE_EXTENSIONS = new Set(['JPG', 'JPEG', 'PNG', 'GIF', 'BMP', 'WEBP']);

  function renderFileThumb(record) {
    if (record.status === 'deleted' || !IMAGE_EXTENSIONS.has(getFileExtension(record))) return '';
    return `<img class="file-thumb" loading="lazy" alt="" src="${escapeHtml(getPreviewUrl(record))}" onerror="this.remove()" />`;
  }

  function renderStatus(record) {
    if (!record || record.status === 'active') return '';
    return `<span class="status-badge">${escapeHtml(STATUS_LABELS[record.status] || record.status)}</span>`;
  }

  function renderNotes(record) {
    const notes = String(record && record.description || '').trim();
    const value = notes
      ? escapeHtml(notes).replace(/\n/g, '<br>')
      : '<span class="muted">لا توجد ملاحظات</span>';
    return `
      <div class="file-detail-row file-notes">
        <span>ملاحظات:</span>
        <p>${value}</p>
      </div>
    `;
  }

  function renderDisplayPath(record) {
    const displayPath = String(record && (record.sourcePath || record.displayPath) || '').trim();
    if (!displayPath) return '';
    return `
      <div class="file-detail-row file-path">
        <span>مسار الرفع:</span>
        <code>${escapeHtml(displayPath)}</code>
      </div>
    `;
  }

  function syncSelectedIds() {
    const visibleIds = new Set([
      ...getVisibleFiles().map((record) => String(record.id)),
      ...getVisibleFolders().map((folder) => folderSelectionId(folder))
    ]);
    Array.from(state.selectedIds).forEach((id) => {
      if (!visibleIds.has(id)) state.selectedIds.delete(id);
    });
  }

  function renderSelectionStatus() {
    if (!els.selectionStatus) return;
    const count = state.selectedIds.size;
    els.selectionStatus.textContent = count
      ? `تم تحديد ${new Intl.NumberFormat('ar-EG').format(count)} عنصر`
      : 'لم يتم تحديد عناصر';
    renderSelectionToolbar();
  }

  function renderSelectionToolbar() {
    if (!els.selectionToolbar) return;
    const records = getSelectedRecords();
    const folders = getSelectedFolders();
    const totalCount = records.length + folders.length;
    if (!totalCount) {
      els.selectionToolbar.hidden = true;
      els.selectionToolbar.innerHTML = '';
      return;
    }

    const buttons = [];
    const pushButton = (action, label, tone = '') => {
      buttons.push(`<button type="button" class="toolbar-action${tone ? ` ${tone}` : ''}" data-bulk-action="${action}">${label}</button>`);
    };

    if (records.some((record) => record.status !== 'deleted')) pushButton('download', 'تنزيل');
    if (canMoveFiles() && records.some((record) => record.status === 'active')) pushButton('move', 'نقل إلى...');
    if (records.some(canArchive)) pushButton('archive', 'أرشفة');
    if (records.some(canRestore)) pushButton('restore', 'استعادة');
    if (records.some(canDelete)) {
      pushButton('delete', state.filters.status === 'deleted' ? 'حذف نهائي' : 'حذف', 'danger');
    }

    els.selectionToolbar.innerHTML = `
      <span class="selection-count">${escapeHtml(new Intl.NumberFormat('ar-EG').format(totalCount))} محدد</span>
      ${buttons.join('')}
      <button type="button" class="toolbar-action ghost" data-bulk-action="clear">إلغاء التحديد</button>
    `;
    els.selectionToolbar.hidden = false;
  }

  async function executeBulkAction(action) {
    const records = getSelectedRecords();
    try {
      if (action === 'clear') {
        state.selectedIds.clear();
        updateSelectedItems();
        return;
      }
      if (action === 'download') {
        const targets = records.filter((record) => record.status !== 'deleted');
        for (const record of targets) {
          await downloadFile(record);
        }
        return;
      }
      if (action === 'move') {
        if (!canMoveFiles()) return;
        const targets = records.filter((record) => record.status === 'active');
        if (!targets.length) return;
        const destination = promptFolderDestination({ currentId: getCurrentFolderId() });
        if (destination == null) return;
        for (const record of targets) {
          await setFileFolder(record.id, destination);
        }
        showToast(`تم نقل ${new Intl.NumberFormat('ar-EG').format(targets.length)} ملف.`, 'success');
        await refreshAll();
        return;
      }
      if (action === 'archive') {
        const targets = records.filter(canArchive);
        for (const record of targets) {
          await patchStatus(record.id, 'archived');
        }
        showToast('تمت الأرشفة.', 'success');
        await refreshAll();
        return;
      }
      if (action === 'restore') {
        const targets = records.filter(canRestore);
        for (const record of targets) {
          await patchStatus(record.id, 'active');
        }
        showToast('تمت الاستعادة.', 'success');
        await refreshAll();
        return;
      }
      if (action === 'delete') {
        const targets = records.filter(canDelete);
        if (!targets.length) return;
        const isTrashView = state.filters.status === 'deleted';
        const count = new Intl.NumberFormat('ar-EG').format(targets.length);
        const message = isTrashView
          ? `حذف ${count} ملف نهائياً؟ لا يمكن التراجع.`
          : `نقل ${count} ملف إلى المحذوفات؟`;
        if (!window.confirm(message)) return;
        for (const record of targets) {
          await deleteFile(record.id);
        }
        showToast(isTrashView ? 'تم الحذف نهائياً.' : 'تم النقل إلى المحذوفات.', 'success');
        await refreshAll();
      }
    } catch (error) {
      showToast(error.message || 'تعذر تنفيذ الإجراء', 'error');
    }
  }

  function handleSelectionToolbarClick(event) {
    const button = event.target.closest('[data-bulk-action]');
    if (!button) return;
    executeBulkAction(button.getAttribute('data-bulk-action'));
  }

  function updateSelectedItems() {
    els.filesBody.querySelectorAll('.file-item').forEach((item) => {
      const selected = state.selectedIds.has(String(item.dataset.id || ''));
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    renderSelectionStatus();
    renderDetailsPane();
  }

  function selectFile(id, event) {
    const key = String(id || '');
    if (!key) return;
    if (event && (event.ctrlKey || event.metaKey)) {
      if (state.selectedIds.has(key)) {
        state.selectedIds.delete(key);
      } else {
        state.selectedIds.add(key);
      }
    } else {
      state.selectedIds.clear();
      state.selectedIds.add(key);
    }
    updateSelectedItems();
  }

  function getFileActions(record) {
    if (record.status === 'deleted') {
      if (!isAdmin()) return [];
      return [
        { action: 'restore', label: 'استعادة', tone: '' },
        { action: 'delete', label: 'حذف نهائي', tone: 'danger' }
      ];
    }
    const actions = [
      { action: 'download', label: 'تنزيل', tone: '' }
    ];
    if (canMoveFiles()) {
      actions.push({ action: 'move', label: 'نقل إلى...', tone: '' });
    }
    if (canEdit(record)) {
      actions.push({ action: 'edit', label: 'تعديل', tone: '' });
    }
    if (canArchive(record)) {
      actions.push({ action: 'archive', label: 'أرشفة', tone: 'warn' });
    }
    if (isAdmin() && record.status === 'archived') {
      actions.push({ action: 'restore', label: 'استعادة', tone: '' });
    }
    if (canDelete(record)) {
      actions.push({ action: 'delete', label: 'نقل إلى المحذوفات', tone: 'danger' });
    }
    return actions;
  }

  function renderActions(record) {
    return getFileActions(record).map((item) => `
      <button type="button" class="context-menu-item ${escapeHtml(item.tone)}" role="menuitem" data-action="${escapeHtml(item.action)}" data-id="${escapeHtml(record.id)}">
        ${escapeHtml(item.label)}
      </button>
    `).join('');
  }

  function folderSelectionId(folder) {
    return `folder:${folder.id}`;
  }

  function getFolderTreeIds(folderId) {
    const rootId = String(folderId || '');
    if (!rootId) return [];
    return [rootId, ...state.folders
      .filter((folder) => folder.status !== 'deleted' && isFolderDescendant(String(folder.id), rootId))
      .map((folder) => String(folder.id))];
  }

  // Mirrors the server: admins manage any folder, everyone else only the ones they created
  function canManageFolder(folder) {
    if (!folder) return false;
    if (isAdmin()) return true;
    const username = String(state.user && state.user.username || '');
    return Boolean(username) && String(folder.createdBy || '') === username;
  }

  function folderHoldsOtherUsersItems(folder) {
    const username = String(state.user && state.user.username || '');
    const treeIds = getFolderTreeIds(folder && folder.id);
    return state.folders.some((child) => child.status !== 'deleted'
      && treeIds.includes(String(child.id))
      && String(child.createdBy || '') !== username)
      || state.files.some((record) => record.status !== 'deleted'
        && treeIds.includes(getFileFolderId(record))
        && String(record.uploadedBy || '') !== username);
  }

  // A shared folder holding anyone else's work is not the owner's to rename, move or remove
  function canModifyFolder(folder) {
    if (!canManageFolder(folder)) return false;
    if (canManageSharedFolders() || isPersonalFolder(folder)) return true;
    return !folderHoldsOtherUsersItems(folder);
  }

  function getFolderActions(folder) {
    if (!folder) return [];
    const actions = [{ action: 'open-folder', label: 'فتح', tone: '' }];
    if (canModifyFolder(folder)) {
      actions.push(
        { action: 'rename-folder', label: 'إعادة تسمية', tone: '' },
        { action: 'move-folder', label: 'نقل إلى...', tone: '' },
        { action: 'delete-folder', label: 'حذف المجلد', tone: 'danger' }
      );
    }
    return actions;
  }

  function renderFolderActions(folder) {
    return getFolderActions(folder).map((item) => `
      <button type="button" class="context-menu-item ${escapeHtml(item.tone)}" role="menuitem" data-folder-action="${escapeHtml(item.action)}" data-folder-id="${escapeHtml(folder.id)}">
        ${escapeHtml(item.label)}
      </button>
    `).join('');
  }
  function getVisibleFolders() {
    if (state.filters.status !== 'active') return [];
    const query = String(state.filters.query || '').trim().toLowerCase();
    if (isUsersBrowse()) {
      if (!state.browseUser) return [];
      const owned = getBrowseUserFolderIds();
      const currentFolderId = getCurrentFolderId();
      return state.folders.filter((folder) => {
        if (folder.status === 'deleted') return false;
        if (!owned.has(String(folder.id))) return false;
        const parentId = String(folder.parentId || '');
        const level = owned.has(parentId) ? parentId : '';
        if (level !== currentFolderId) return false;
        if (!query) return true;
        return String(folder.name || '').toLowerCase().includes(query);
      });
    }
    const scope = String(state.filters.scope || 'public').toLowerCase();
    const currentUsername = String(state.user && state.user.username || '');
    const currentFolderId = getCurrentFolderId();
    return state.folders.filter((folder) => {
      const folderScope = String(folder.scope || 'public').toLowerCase();
      const createdBy = String(folder.createdBy || '');
      const inScope = scope === 'all'
        ? true
        : scope === 'mine'
          ? folderScope === 'mine' || createdBy === currentUsername
          : folderScope === 'public';
      if (!inScope) return false;
      if (String(folder.parentId || '') !== currentFolderId) return false;
      if (!query) return true;
      return String(folder.name || '').toLowerCase().includes(query);
    });
  }

  function getSortValue(item, key) {
    if (item.kind === 'folder') {
      const folder = item.folder;
      if (key === 'date') return folder.createdAt || '';
      if (key === 'uploader') return folder.createdByDisplay || folder.createdBy || '';
      if (key === 'size') return -1;
      return folder.name || '';
    }
    const record = item.record;
    if (key === 'date') return record.uploadedAt || '';
    if (key === 'uploader') return record.uploadedByDisplay || record.uploadedBy || '';
    if (key === 'size') return Number(record.size || 0);
    return record.title || record.originalName || '';
  }

  function getUserSortValue(entry, key) {
    if (key === 'size') return Number(entry.bytes || 0);
    if (key === 'date') return entry.latestUpload || '';
    return entry.display || entry.username || '';
  }

  function getDisplayItems() {
    if (isUsersRoot()) {
      const users = getUserFolderEntries().map((entry) => ({ kind: 'user', entry }));
      if (!state.sortDirection) return users;
      const direction = state.sortDirection === 'desc' ? -1 : 1;
      const key = state.sortKey || 'name';
      return users.sort((a, b) => {
        const aValue = getUserSortValue(a.entry, key);
        const bValue = getUserSortValue(b.entry, key);
        if (typeof aValue === 'number' || typeof bValue === 'number') {
          return (Number(aValue) - Number(bValue)) * direction;
        }
        return String(aValue).localeCompare(String(bValue), 'ar', { sensitivity: 'base', numeric: true }) * direction;
      });
    }
    const items = [
      ...getVisibleFolders().map((folder) => ({ kind: 'folder', folder })),
      ...getVisibleFiles().map((record) => ({ kind: 'file', record }))
    ];
    if (!state.sortDirection) return items;
    const direction = state.sortDirection === 'desc' ? -1 : 1;
    const key = state.sortKey || 'name';
    return items.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      const aValue = getSortValue(a, key);
      const bValue = getSortValue(b, key);
      if (typeof aValue === 'number' || typeof bValue === 'number') {
        return (Number(aValue) - Number(bValue)) * direction;
      }
      return String(aValue).localeCompare(String(bValue), 'ar', { sensitivity: 'base', numeric: true }) * direction;
    });
  }

  function setSort(key) {
    if (state.sortKey === key && state.sortDirection) {
      state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortKey = key;
      state.sortDirection = key === 'date' ? 'desc' : 'asc';
    }
    renderFiles();
  }

  function renderSortIndicators() {
    if (!els.fileListHeader) return;
    els.fileListHeader.querySelectorAll('[data-sort-key]').forEach((button) => {
      const active = state.sortDirection && (state.sortKey || 'name') === button.getAttribute('data-sort-key');
      if (active) {
        button.setAttribute('data-sort-active', state.sortDirection);
      } else {
        button.removeAttribute('data-sort-active');
      }
    });
  }

  function handleSortHeaderClick(event) {
    const button = event.target.closest('[data-sort-key]');
    if (!button) return;
    setSort(button.getAttribute('data-sort-key'));
  }
  function renderFolderItem(folder) {
    const id = folderSelectionId(folder);
    const selected = state.selectedIds.has(id);
    return `
      <article class="file-item folder-item${selected ? ' selected' : ''}" role="option" tabindex="0" aria-selected="${selected ? 'true' : 'false'}" data-kind="folder" data-id="${escapeHtml(id)}" data-folder-id="${escapeHtml(folder.id)}">
        <div class="file-name-cell">
          <div class="folder-large-icon" aria-hidden="true"></div>
          <div class="file-title">
            <strong>${escapeHtml(folder.name)}</strong>
            <span>${escapeHtml(getFolderChildSummary(folder))}</span>
          </div>
        </div>
        <div class="file-uploader uploader">
          <strong>${escapeHtml(folder.createdByDisplay || folder.createdBy || '—')}</strong>
          <span>مجلد محلي</span>
        </div>
        <div class="file-size-cell">—</div>
        <div class="file-availability-cell">—</div>
        <div class="file-date-cell">${escapeHtml(formatDate(folder.createdAt))}</div>
        <div class="file-details"></div>
      </article>
    `;
  }
  function renderUserFolderItem(entry) {
    const contentParts = [];
    if (entry.fileCount) contentParts.push(`${formatCount(entry.fileCount)} ملف`);
    if (entry.folderCount) contentParts.push(`${formatCount(entry.folderCount)} مجلد`);
    const contents = contentParts.length ? contentParts.join('، ') : 'لا يوجد محتوى';
    const role = normalizeRole(entry.role);
    const roleLabel = ROLE_LABELS[role] || (role === 'superadmin' ? ROLE_LABELS.admin : ROLE_LABELS.user);
    const sectors = entry.sectors && entry.sectors.length ? entry.sectors.join('، ') : 'لا يوجد قطاع';
    const initial = String(entry.display || entry.username || '').trim().charAt(0) || '؟';
    return `
      <article class="file-item folder-item user-folder" role="option" tabindex="0" aria-selected="false" data-kind="user-folder" data-user="${escapeHtml(entry.username)}" title="${escapeHtml(entry.display)}">
        <div class="file-name-cell">
          <div class="folder-large-icon user-folder-icon" aria-hidden="true"><span>${escapeHtml(initial)}</span></div>
          <div class="file-title">
            <strong>${escapeHtml(entry.display)}</strong>
            <span>${escapeHtml(contents)}</span>
          </div>
        </div>
        <div class="file-uploader uploader">
          <strong>${escapeHtml(roleLabel)}</strong>
          <span>${escapeHtml(entry.username)}</span>
        </div>
        <div class="file-size-cell">${escapeHtml(entry.fileCount ? formatBytes(entry.bytes) : '—')}</div>
        <div class="file-availability-cell" title="${escapeHtml(sectors)}">${escapeHtml(sectors)}</div>
        <div class="file-date-cell">${escapeHtml(entry.latestUpload ? formatDate(entry.latestUpload) : '—')}</div>
        <div class="file-details"></div>
      </article>
    `;
  }

  function renderFileItem(record) {
    return `
      <article class="file-item${state.selectedIds.has(String(record.id)) ? ' selected' : ''}" role="option" tabindex="0" aria-selected="${state.selectedIds.has(String(record.id)) ? 'true' : 'false'}" data-kind="file" data-id="${escapeHtml(record.id)}" draggable="${canMoveFiles() ? 'true' : 'false'}">
        <div class="file-name-cell">
          ${renderFileThumb(record)}
          <div class="file-icon" aria-hidden="true"><span>${escapeHtml(getFileExtension(record))}</span></div>
          <div class="file-title">
            <strong>${escapeHtml(record.title || record.originalName)}</strong>
            <span>${escapeHtml(record.originalName)}</span>
            ${renderDisplayPath(record)}
          </div>
        </div>
        <div class="file-uploader uploader">
          <strong>${escapeHtml(record.uploadedByDisplay || record.uploadedBy)}</strong>
          <span>${escapeHtml(ROLE_LABELS[record.uploadedByRole] || record.uploadedByRole || '')}</span>
        </div>
        <div class="file-size-cell">${escapeHtml(formatBytes(record.size))}</div>
        <div class="file-availability-cell" title="${escapeHtml(formatAvailabilitySectors(record))}">${escapeHtml(formatAvailabilitySectors(record))}</div>
        <div class="file-date-cell">${escapeHtml(formatDate(record.uploadedAt))}</div>
        <div class="file-details">
          ${renderStatus(record)}
          ${renderNotes(record)}
        </div>
      </article>
    `;
  }

  function renderFiles() {
    syncSelectedIds();
    renderSelectionStatus();
    renderBreadcrumbs();
    renderFolderTree();
    renderSectorFilter();
    renderSortIndicators();
    setViewMode(state.viewMode, { skipPersist: true });

    if (isUsersRoot()) {
      const users = getDisplayItems();
      if (!users.length) {
        els.tableStatus.textContent = 'لا يوجد مستخدمون مطابقون.';
        els.filesBody.innerHTML = '<div class="empty-cell">لا يوجد مستخدمون مطابقون.</div>';
      } else {
        els.tableStatus.textContent = `تم عرض ${formatCount(users.length)} مستخدم.`;
        els.filesBody.innerHTML = users.map((item) => renderUserFolderItem(item.entry)).join('');
      }
      renderDetailsPane();
      return;
    }

    const trashNote = state.filters.status === 'deleted' ? ' — تُحذف العناصر نهائياً بعد ٣٠ يوماً.' : '';
    const items = getDisplayItems();
    if (!items.length) {
      els.tableStatus.textContent = `لا توجد عناصر مطابقة.${trashNote}`;
      els.filesBody.innerHTML = `
        <div class="empty-cell">لا توجد عناصر مطابقة.</div>
      `;
      renderDetailsPane();
      return;
    }

    const fileCount = getVisibleFiles().length;
    const folderCount = getVisibleFolders().length;
    els.tableStatus.textContent = `تم عرض ${formatCount(fileCount)} ملف و ${formatCount(folderCount)} مجلد.${trashNote}`;
    els.filesBody.innerHTML = items.map((item) => item.kind === 'folder'
      ? renderFolderItem(item.folder)
      : renderFileItem(item.record)
    ).join('');
    updateSelectedItems();
  }

  function openModal(modal) {
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeModals() {
    document.querySelectorAll('.modal').forEach((modal) => modal.setAttribute('aria-hidden', 'true'));
    document.body.classList.remove('modal-open');
  }

  function findFile(id) {
    return state.files.find((record) => String(record.id) === String(id));
  }

  function openEditModal(record) {
    if (!record) return;
    els.editForm.elements.id.value = record.id;
    els.editForm.elements.title.value = record.title || record.originalName || '';
    els.editForm.elements.description.value = record.description || '';
    renderAvailabilityControls(els.editForm, record);
    openModal(els.editModal);
  }

  function getUploadFileInput(form = els.uploadForm) {
    return form && (form.elements.files || form.elements.file);
  }

  function getPathFileName(value) {
    const name = String(value || '').trim().split(/[\\/]/).pop() || '';
    return name || 'file';
  }

  function getFileSourcePath(fileInput, file) {
    const candidates = [
      file && file.path,
      file && file.webkitRelativePath,
      fileInput && fileInput.value
    ];
    for (const candidate of candidates) {
      const value = String(candidate || '').trim();
      if (!value || /^C:\\fakepath\\/i.test(value)) continue;
      if (file && value === file.name) continue;
      return value;
    }
    return '';
  }

  function getSelectedSourcePath(fileInput) {
    const file = fileInput && fileInput.files && fileInput.files[0];
    return getFileSourcePath(fileInput, file);
  }

  function getBrowserUploadFiles(fileInput) {
    return Array.from(fileInput && fileInput.files ? fileInput.files : []).map((file) => ({
      file,
      fileName: getPathFileName(file && file.name),
      sourcePath: getFileSourcePath(fileInput, file)
    }));
  }

  function completeSourcePath(sourcePath, fileName) {
    const raw = String(sourcePath || '').trim().replace(/^"+|"+$/g, '');
    const selectedName = String(fileName || '').trim();
    if (!raw || !selectedName) return raw;

    const trimmed = raw.replace(/[\\/]+$/g, '');
    const lowerTrimmed = trimmed.toLowerCase();
    const lowerName = selectedName.toLowerCase();
    if (
      lowerTrimmed === lowerName ||
      lowerTrimmed.endsWith(`\\${lowerName}`) ||
      lowerTrimmed.endsWith(`/${lowerName}`)
    ) {
      return trimmed;
    }

    const lastSegment = trimmed.split(/[\\/]/).pop() || '';
    const looksLikeFile = /\.[^\\/.\s]+$/.test(lastSegment);
    if (looksLikeFile) return trimmed;
    return `${trimmed}\\${selectedName}`;
  }

  function renderUploadFileList(items = []) {
    const rows = Array.isArray(items) && items.length > 1 ? items : [];
    const titleField = els.uploadForm && els.uploadForm.querySelector('[data-single-upload-title]');
    if (titleField) titleField.hidden = rows.length > 0;
    if (!els.uploadFileList) return;
    els.uploadFileList.hidden = rows.length === 0;
    if (!rows.length) {
      els.uploadFileList.innerHTML = '';
      return;
    }
    els.uploadFileList.innerHTML = `
      <div class="upload-file-list-head">
        <span>أسماء الملفات قبل الرفع</span>
        <strong>${rows.length}</strong>
      </div>
      ${rows.map((item, index) => {
        const fileName = item.fileName || getPathFileName(item.sourcePath);
        const title = item.title || fileName;
        return `
          <label class="upload-file-row">
            <span class="upload-file-source" dir="ltr" title="${escapeHtml(item.sourcePath || fileName)}">${escapeHtml(fileName)}</span>
            <input type="text" data-upload-file-title="${index}" value="${escapeHtml(title)}" placeholder="الاسم" />
          </label>
        `;
      }).join('')}
    `;
  }

  function collectUploadFileTitles(items = []) {
    if (!Array.isArray(items) || items.length <= 1) return [];
    return items.map((item, index) => {
      const input = els.uploadFileList && els.uploadFileList.querySelector(`[data-upload-file-title="${index}"]`);
      const fallback = item.title || item.fileName || getPathFileName(item.sourcePath);
      const title = String((input && input.value) || fallback || '').trim();
      if (!title) throw new Error('اكتب اسماً لكل ملف قبل الرفع.');
      return title;
    });
  }

  function setUploadProgress(ratio) {
    if (!els.uploadProgress) return;
    if (ratio == null) {
      els.uploadProgress.hidden = true;
      return;
    }
    const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    els.uploadProgress.hidden = false;
    if (els.uploadProgressFill) els.uploadProgressFill.style.width = `${percent}%`;
    if (els.uploadProgressText) {
      els.uploadProgressText.textContent = `${new Intl.NumberFormat('ar-EG').format(percent)}٪`;
    }
  }

  function sendUploadRequest(formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/files`);
      xhr.responseType = 'json';
      const token = getStoredToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && typeof onProgress === 'function') {
          onProgress(event.loaded / event.total);
        }
      });
      xhr.addEventListener('load', () => {
        const payload = xhr.response && typeof xhr.response === 'object' ? xhr.response : {};
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(payload);
        } else {
          reject(new Error(payload.message || 'تعذر رفع الملف'));
        }
      });
      xhr.addEventListener('error', () => reject(new Error('تعذر الاتصال بالخادم')));
      xhr.addEventListener('abort', () => reject(new Error('تم إلغاء الرفع')));
      xhr.send(formData);
    });
  }

  function updateUploadSummary(items = []) {
    if (!els.uploadSelectionSummary) return;
    els.uploadSelectionSummary.textContent = !items.length
      ? 'لم يتم اختيار ملف'
      : items.length === 1
        ? items[0].fileName
        : `تم اختيار ${new Intl.NumberFormat('ar-EG').format(items.length)} ملفات`;
    if (els.uploadDropzone) els.uploadDropzone.classList.toggle('has-files', items.length > 0);
  }

  function resetUploadSelection() {
    const fileInput = getUploadFileInput();
    if (fileInput) fileInput.value = '';
    updateUploadSummary([]);
    renderUploadFileList([]);
    setUploadProgress(null);
  }

  function openUploadModal() {
    els.uploadForm.reset();
    resetUploadSelection();
    renderAvailabilityControls(els.uploadForm);
    openModal(els.uploadModal);
  }

  function getUploadResultFiles(result) {
    if (result && Array.isArray(result.files) && result.files.length) return result.files;
    return result && result.file ? [result.file] : [];
  }

  async function finishUpload(result, form) {
    const uploadedFiles = getUploadResultFiles(result);
    uploadedFiles.forEach(rememberUploadedFileFolder);
    form.reset();
    resetUploadSelection();
    closeModals();
    showToast(uploadedFiles.length > 1 ? `تم رفع ${uploadedFiles.length} ملفات.` : 'تم رفع الملف.', 'success');
    await refreshAll();
  }

  function handleBrowserUploadSelection() {
    const items = getBrowserUploadFiles(getUploadFileInput());
    if (items.length === 1 && !els.uploadForm.elements.title.value) {
      els.uploadForm.elements.title.value = items[0].fileName;
    }
    updateUploadSummary(items);
    renderUploadFileList(items);
  }

  async function uploadFile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');

    const fileInput = getUploadFileInput(form);
    const browserFiles = getBrowserUploadFiles(fileInput);
    if (!browserFiles.length) {
      showToast('اختر ملفاً أولاً.', 'error');
      return;
    }

    let fileTitles = [];
    try {
      fileTitles = collectUploadFileTitles(browserFiles);
    } catch (error) {
      showToast(error.message || 'راجع أسماء الملفات', 'error');
      return;
    }

    const formData = new FormData();
    browserFiles.forEach((item) => {
      formData.append('files', item.file, item.fileName || item.file.name);
    });
    if (browserFiles.length === 1) {
      formData.set('title', form.elements.title.value);
      const sourcePath = completeSourcePath(getSelectedSourcePath(fileInput), browserFiles[0].fileName);
      if (sourcePath) formData.set('sourcePath', sourcePath);
    } else {
      formData.set('fileTitles', JSON.stringify(fileTitles));
      formData.set('sourcePaths', JSON.stringify(browserFiles.map((item) => item.sourcePath || '')));
    }
    formData.set('description', form.elements.description.value);
    formData.set('folderId', getCurrentFolderId());
    Object.entries(getAvailabilityPayload(form)).forEach(([key, value]) => {
      formData.set(key, Array.isArray(value) ? JSON.stringify(value) : value);
    });

    submit.disabled = true;
    setUploadProgress(0);
    try {
      const result = await sendUploadRequest(formData, setUploadProgress);
      setUploadProgress(1);
      await finishUpload(result, form);
    } catch (error) {
      showToast(error.message || 'تعذر رفع الملف', 'error');
    } finally {
      submit.disabled = false;
      setUploadProgress(null);
    }
  }

  async function saveEdit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.elements.id.value;
    const payload = {
      title: form.elements.title.value,
      description: form.elements.description.value,
      ...getAvailabilityPayload(form)
    };

    try {
      await apiJson(`${API_BASE}/files/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      closeModals();
      showToast('تم حفظ التعديل.', 'success');
      await refreshAll();
    } catch (error) {
      showToast(error.message || 'تعذر حفظ التعديل', 'error');
    }
  }

  async function patchStatus(id, status) {
    await apiJson(`${API_BASE}/files/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
  }

  async function deleteFile(id) {
    await apiJson(`${API_BASE}/files/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }

  async function downloadFile(record) {
    const response = await fetch(`${API_BASE}/files/${encodeURIComponent(record.id)}/download`, {
      cache: 'no-store'
    });
    if (!response.ok) {
      let message = 'تعذر تنزيل الملف';
      try {
        const payload = await response.json();
        if (payload && payload.message) message = payload.message;
      } catch (_) {}
      throw new Error(message);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = record.originalName || record.title || 'download';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function getPreviewUrl(record) {
    return `${API_BASE}/files/${encodeURIComponent(record.id)}/preview`;
  }

  async function openFilePreview(record) {
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      showToast('تعذر فتح المعاينة في تبويب جديد.', 'error');
      return;
    }

    try {
      previewWindow.document.title = record.originalName || record.title || 'معاينة الملف';
      previewWindow.document.body.dir = 'rtl';
      previewWindow.document.body.style.fontFamily = 'Tahoma, Arial, sans-serif';
      previewWindow.document.body.style.padding = '24px';
      previewWindow.document.body.textContent = 'جاري فتح المعاينة...';
      previewWindow.opener = null;
    } catch (_) {}

    try {
      const response = await fetch(getPreviewUrl(record), { cache: 'no-store' });
      if (!response.ok) {
        let message = 'تعذر فتح المعاينة';
        try {
          const payload = await response.clone().json();
          if (payload && payload.message) message = payload.message;
        } catch (_) {}
        try { previewWindow.close(); } catch (_) {}
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      previewWindow.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    } catch (error) {
      try { previewWindow.close(); } catch (_) {}
      showToast(error.message || 'تعذر فتح المعاينة', 'error');
    }
  }

  function closeContextMenu() {
    if (!els.fileContextMenu) return;
    els.fileContextMenu.hidden = true;
    els.fileContextMenu.innerHTML = '';
    state.contextMenuRecordId = '';
  }

  function positionContextMenu(clientX, clientY) {
    const menu = els.fileContextMenu;
    if (!menu) return;
    const padding = 8;
    const rect = menu.getBoundingClientRect();
    const width = rect.width || 180;
    const height = rect.height || 120;
    const left = Math.max(padding, Math.min(clientX, window.innerWidth - width - padding));
    const top = Math.max(padding, Math.min(clientY, window.innerHeight - height - padding));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function openContextMenu(record, event) {
    if (!record || !els.fileContextMenu) return;
    const actions = renderActions(record);
    if (!actions.trim()) return;
    state.contextMenuRecordId = String(record.id || '');
    els.fileContextMenu.innerHTML = actions;
    els.fileContextMenu.hidden = false;
    positionContextMenu(event.clientX || 0, event.clientY || 0);
  }

  function openFolderContextMenu(folder, event) {
    if (!folder || !els.fileContextMenu) return;
    const actions = renderFolderActions(folder);
    if (!actions.trim()) return;
    state.contextMenuRecordId = folderSelectionId(folder);
    els.fileContextMenu.innerHTML = actions;
    els.fileContextMenu.hidden = false;
    positionContextMenu(event.clientX || 0, event.clientY || 0);
  }
  function renderBackgroundActions() {
    return `
      ${canCreateFolderHere() ? '<button type="button" class="context-menu-item" role="menuitem" data-background-action="new-folder">مجلد جديد</button>' : ''}
      ${getCurrentFolderId() ? '<button type="button" class="context-menu-item" role="menuitem" data-background-action="go-up">الرجوع للمجلد الأعلى</button>' : ''}
      <button type="button" class="context-menu-item" role="menuitem" data-background-action="refresh">تحديث</button>
      <button type="button" class="context-menu-item" role="menuitem" data-background-action="sort-asc">ترتيب تصاعدي</button>
      <button type="button" class="context-menu-item" role="menuitem" data-background-action="sort-desc">ترتيب تنازلي</button>
    `;
  }

  function openBackgroundContextMenu(event) {
    if (!els.fileContextMenu) return;
    state.selectedIds.clear();
    updateSelectedItems();
    state.contextMenuRecordId = '';
    els.fileContextMenu.innerHTML = renderBackgroundActions();
    els.fileContextMenu.hidden = false;
    positionContextMenu(event.clientX || 0, event.clientY || 0);
  }

  async function createNewFolder() {
    if (state.filters.status !== 'active') {
      showToast('يمكن إنشاء المجلدات داخل الملفات النشطة فقط.', 'error');
      return;
    }
    if (!canCreateFolderHere()) {
      showToast('إنشاء المجلدات خارج «ملفاتي» متاح للمسؤولين والسكرتير الأول فقط.', 'error');
      return;
    }
    const name = window.prompt('اسم المجلد الجديد', 'مجلد جديد');
    const folderName = String(name || '').trim();
    if (!folderName) return;
    try {
      const payload = await apiJson(`${API_BASE}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: folderName,
          parentId: getCurrentFolderId(),
          scope: state.filters.scope === 'mine' ? 'mine' : 'public'
        })
      });
      const folder = payload.folder;
      if (folder) {
        state.folders.push(folder);
        state.selectedIds.clear();
        state.selectedIds.add(folderSelectionId(folder));
      }
      renderFiles();
      showToast('تم إنشاء المجلد.', 'success');
    } catch (error) {
      showToast(error.message || 'تعذر إنشاء المجلد', 'error');
    }
  }
  async function executeBackgroundAction(action) {
    closeContextMenu();
    if (action === 'new-folder') {
      await createNewFolder();
    } else if (action === 'go-up') {
      const current = findFolder(getCurrentFolderId());
      setCurrentFolder(current && current.parentId || '');
    } else if (action === 'refresh') {
      await refreshAll();
    } else if (action === 'sort-asc') {
      state.sortKey = 'name';
      state.sortDirection = 'asc';
      renderFiles();
    } else if (action === 'sort-desc') {
      state.sortKey = 'name';
      state.sortDirection = 'desc';
      renderFiles();
    }
  }
  async function executeFileAction(action, id) {
    const record = findFile(id);
    if (!record && action !== 'delete') return;

    try {
      closeContextMenu();
      if (action === 'download') {
        await downloadFile(record);
      } else if (action === 'move') {
        await moveFileToFolder(record);
      } else if (action === 'edit') {
        openEditModal(record);
      } else if (action === 'archive') {
        await patchStatus(id, 'archived');
        showToast('تمت أرشفة الملف.', 'success');
        await refreshAll();
      } else if (action === 'restore') {
        await patchStatus(id, 'active');
        showToast('تمت استعادة الملف.', 'success');
        await refreshAll();
      } else if (action === 'delete') {
        const isTrashed = record && record.status === 'deleted';
        const message = isTrashed
          ? 'حذف الملف نهائياً؟ لا يمكن التراجع عن هذا الإجراء.'
          : 'نقل الملف إلى المحذوفات؟ يمكن للمسؤول استعادته خلال ٣٠ يوماً.';
        if (!window.confirm(message)) return;
        await deleteFile(id);
        showToast(isTrashed ? 'تم حذف الملف نهائياً.' : 'تم نقل الملف إلى المحذوفات.', 'success');
        await refreshAll();
      }
    } catch (error) {
      showToast(error.message || 'تعذر تنفيذ الإجراء', 'error');
    }
  }

  function warnFolderNotModifiable(folder) {
    showToast(canManageFolder(folder)
      ? 'لا يمكن تعديل مجلد عام يحتوي على عناصر لمستخدمين آخرين.'
      : 'هذا المجلد ليس من إنشائك.', 'error');
  }

  async function renameFolder(folder) {
    if (!canModifyFolder(folder)) {
      warnFolderNotModifiable(folder);
      return;
    }
    const name = window.prompt('اسم المجلد الجديد', folder && folder.name || '');
    const folderName = String(name || '').trim();
    if (!folderName || !folder) return;
    const payload = await apiJson(`${API_BASE}/folders/${encodeURIComponent(folder.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: folderName })
    });
    const updated = payload.folder || null;
    if (updated) {
      const index = state.folders.findIndex((item) => String(item.id) === String(updated.id));
      if (index >= 0) state.folders[index] = updated;
    }
    renderFiles();
    showToast('تمت إعادة تسمية المجلد.', 'success');
  }

  async function deleteFolder(folder) {
    if (!folder) return;
    if (!canModifyFolder(folder)) {
      warnFolderNotModifiable(folder);
      return;
    }
    if (!window.confirm('حذف هذا المجلد؟')) return;
    const deleteContents = window.confirm('هل تريد حذف العناصر داخل المجلد أيضاً؟\nموافق: حذف المجلد والعناصر داخله.\nإلغاء: حذف المجلد فقط وإرجاع العناصر للجذر.');
    const mode = deleteContents ? 'with-contents' : 'folder-only';
    await apiJson(`${API_BASE}/folders/${encodeURIComponent(folder.id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    if (state.currentFolderId === String(folder.id)) state.currentFolderId = '';
    state.selectedIds.clear();
    showToast(deleteContents ? 'تم حذف المجلد والعناصر داخله.' : 'تم حذف المجلد وإرجاع العناصر للجذر.', 'success');
    await refreshAll();
  }

  async function executeFolderAction(action, id) {
    const folder = findFolder(id);
    if (!folder) return;
    closeContextMenu();
    try {
      if (action === 'open-folder') {
        openFolder(folder);
      } else if (action === 'rename-folder') {
        await renameFolder(folder);
      } else if (action === 'move-folder') {
        await moveFolderToFolder(folder);
      } else if (action === 'delete-folder') {
        await deleteFolder(folder);
      }
    } catch (error) {
      showToast(error.message || 'تعذر تنفيذ إجراء المجلد', 'error');
    }
  }
  async function handleContextMenuClick(event) {
    const backgroundButton = event.target.closest('[data-background-action]');
    if (backgroundButton) {
      event.preventDefault();
      await executeBackgroundAction(backgroundButton.getAttribute('data-background-action'));
      return;
    }
    const folderButton = event.target.closest('[data-folder-action]');
    if (folderButton) {
      event.preventDefault();
      await executeFolderAction(folderButton.getAttribute('data-folder-action'), folderButton.getAttribute('data-folder-id'));
      return;
    }
    const button = event.target.closest('[data-action]');
    if (!button) return;
    event.preventDefault();
    await executeFileAction(button.getAttribute('data-action'), button.getAttribute('data-id'));
  }
  function handleFilesContextMenu(event) {
    const item = event.target.closest('.file-item');
    event.preventDefault();
    if (!item) {
      openBackgroundContextMenu(event);
      return;
    }
    if (item.dataset.kind === 'user-folder') return;
    const id = item.dataset.id;
    if (!state.selectedIds.has(String(id || ''))) {
      state.selectedIds.clear();
      state.selectedIds.add(String(id || ''));
      updateSelectedItems();
    }
    if (item.dataset.kind === 'file') {
      openContextMenu(findFile(id), event);
    } else if (item.dataset.kind === 'folder') {
      openFolderContextMenu(findFolder(item.dataset.folderId), event);
    }
  }
  async function handleTableClick(event) {
    if (Date.now() < suppressListClicksUntil) return;
    const button = event.target.closest('[data-action]');
    if (button) {
      await executeFileAction(button.getAttribute('data-action'), button.getAttribute('data-id'));
      return;
    }
    const item = event.target.closest('.file-item');
    if (!item) return;
    if (item.dataset.kind === 'user-folder') {
      openUserFolder(item.dataset.user);
      return;
    }
    selectFile(item.dataset.id, event);
  }

  async function handleFilesDoubleClick(event) {
    if (Date.now() < suppressListClicksUntil) return;
    if (event.target.closest('[data-action]')) return;
    const item = event.target.closest('.file-item');
    if (!item) return;
    if (item.dataset.kind === 'user-folder') {
      openUserFolder(item.dataset.user);
      return;
    }
    if (item.dataset.kind === 'folder') {
      const folder = findFolder(item.dataset.folderId);
      if (folder) openFolder(folder);
      return;
    }
    if (item.dataset.kind !== 'file') return;
    const record = findFile(item.dataset.id);
    if (!record) return;
    openFilePreview(record);
  }

  function selectAllVisibleItems() {
    state.selectedIds = new Set([
      ...getVisibleFolders().map((folder) => folderSelectionId(folder)),
      ...getVisibleFiles().map((record) => String(record.id))
    ]);
    updateSelectedItems();
  }

  async function handleFilesKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'a') {
      event.preventDefault();
      selectAllVisibleItems();
      return;
    }
    if (event.key === 'Delete' && state.selectedIds.size) {
      event.preventDefault();
      await executeBulkAction('delete');
      return;
    }
    if (event.key === 'F2' && state.selectedIds.size === 1) {
      event.preventDefault();
      const selectedFolders = getSelectedFolders();
      if (selectedFolders.length === 1) {
        await renameFolder(selectedFolders[0]).catch((error) => showToast(error.message || 'تعذر إعادة التسمية', 'error'));
        return;
      }
      const selectedRecords = getSelectedRecords();
      if (selectedRecords.length === 1 && canEdit(selectedRecords[0])) {
        openEditModal(selectedRecords[0]);
      }
      return;
    }
    const item = event.target.closest('.file-item');
    if (!item) return;
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      if (item.dataset.kind === 'user-folder') return;
      selectFile(item.dataset.id, event);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (item.dataset.kind === 'user-folder') {
        openUserFolder(item.dataset.user);
        return;
      }
      if (item.dataset.kind === 'folder') {
        const folder = findFolder(item.dataset.folderId);
        if (folder) openFolder(folder);
        return;
      }
      const record = findFile(item.dataset.id);
      if (!record) return;
      openFilePreview(record);
      return;
    }
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      if (item.dataset.kind === 'user-folder') return;
      const rect = item.getBoundingClientRect();
      selectFile(item.dataset.id, event);
      const point = {
        clientX: rect.left + Math.min(80, rect.width / 2),
        clientY: rect.top + Math.min(34, rect.height / 2)
      };
      if (item.dataset.kind === 'folder') {
        openFolderContextMenu(findFolder(item.dataset.folderId), point);
      } else {
        openContextMenu(findFile(item.dataset.id), point);
      }
    }
  }

  function getDraggedFileId(event) {
    if (!event.dataTransfer) return state.draggedFileId;
    return String(
      event.dataTransfer.getData('text/storage-file-id')
      || event.dataTransfer.getData('text/plain')
      || state.draggedFileId
      || ''
    );
  }

  function handleFileDragStart(event) {
    const item = event.target.closest('.file-item[data-kind="file"]');
    if (!item) return;
    const id = String(item.dataset.id || '');
    if (!id) return;
    state.draggedFileId = id;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/storage-file-id', id);
      event.dataTransfer.setData('text/plain', id);
    }
    item.classList.add('dragging');
  }

  function clearDropTargets() {
    els.filesBody.querySelectorAll('.drop-target, .dragging').forEach((item) => {
      item.classList.remove('drop-target', 'dragging');
    });
  }

  function handleFileDragEnd() {
    state.draggedFileId = '';
    clearDropTargets();
  }

  function handleFolderDragOver(event) {
    const folderItem = event.target.closest('.folder-item[data-folder-id]');
    if (!folderItem) return;
    const record = findFile(getDraggedFileId(event));
    if (!record) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    folderItem.classList.add('drop-target');
  }

  function handleFolderDragLeave(event) {
    const folderItem = event.target.closest('.folder-item[data-folder-id]');
    if (!folderItem) return;
    if (event.relatedTarget && folderItem.contains(event.relatedTarget)) return;
    folderItem.classList.remove('drop-target');
  }

  function handleFolderDrop(event) {
    const folderItem = event.target.closest('.folder-item[data-folder-id]');
    if (!folderItem) return;
    event.preventDefault();
    const record = findFile(getDraggedFileId(event));
    const folderId = String(folderItem.dataset.folderId || '');
    state.draggedFileId = '';
    clearDropTargets();
    if (!record || !folderId) return;
    moveFileToFolder(record, folderId).catch((error) => {
      showToast(error.message || 'تعذر نقل الملف', 'error');
    });
  }
  function isExternalFileDrag(event) {
    const types = event.dataTransfer && event.dataTransfer.types;
    if (!types) return false;
    const list = Array.from(types);
    return list.includes('Files') && !list.includes('text/storage-file-id');
  }

  function handleExternalDragOver(event) {
    if (!isExternalFileDrag(event) || state.filters.status !== 'active') return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    els.filesBody.classList.add('upload-drop-active');
  }

  function handleExternalDragLeave(event) {
    if (event.relatedTarget && els.filesBody.contains(event.relatedTarget)) return;
    els.filesBody.classList.remove('upload-drop-active');
  }

  function handleExternalDrop(event) {
    if (!isExternalFileDrag(event) || state.filters.status !== 'active') return;
    event.preventDefault();
    els.filesBody.classList.remove('upload-drop-active');
    const dropped = event.dataTransfer && event.dataTransfer.files;
    if (!dropped || !dropped.length) return;
    openUploadModal();
    const fileInput = getUploadFileInput();
    if (!fileInput) return;
    fileInput.files = dropped;
    handleBrowserUploadSelection();
  }

  function handleAvailabilitySectorChange(event) {
    if (!event.target.matches('[data-availability-sector-option]')) return;
    const form = event.target.closest('form');
    setAvailabilitySectorsValue(form, getSelectedAvailabilitySectors(form));
  }

  function handleBreadcrumbClick(event) {
    const usersRootButton = event.target.closest('[data-breadcrumb-users-root]');
    if (usersRootButton) {
      exitUserFolder();
      return;
    }
    const button = event.target.closest('[data-breadcrumb-folder-id]');
    if (!button) return;
    setCurrentFolder(button.getAttribute('data-breadcrumb-folder-id') || '');
  }
  function applyFilters(event) {
    event.preventDefault();
    state.filters.query = els.searchInput.value.trim();

    renderStorageNav();
    renderBreadcrumbs();
    refreshAll().catch((error) => {
      els.tableStatus.textContent = error.message || 'تعذر تحميل الملفات';
      showToast(els.tableStatus.textContent, 'error');
    });
  }

  function bindDom() {
    [
      'statsGrid',
      'storageNav',
      'breadcrumbBar',
      'detailsPane',
      'fileContextMenu',
      'refreshBtn',
      'backBtn',
      'openUploadBtn',
      'filterForm',
      'searchInput',

      'tableStatus',
      'selectionStatus',
      'selectionToolbar',
      'sectorFilterWrap',
      'sectorFilterSelect',
      'folderTree',
      'folderTreeSection',
      'filesBody',
      'uploadModal',
      'uploadDropzone',
      'uploadSelectionSummary',
      'uploadProgress',
      'uploadProgressFill',
      'uploadProgressText',
      'uploadFileList',
      'uploadForm',
      'editModal',
      'editForm',
      'toast'
    ].forEach((id) => {
      els[id] = $(id);
    });
    els.fileListHeader = document.querySelector('.file-list-header');
  }

  function bindEvents() {
    els.refreshBtn.addEventListener('click', refreshAll);
    els.backBtn.addEventListener('click', () => {
      window.location.href = '/main.html';
    });
    els.openUploadBtn.addEventListener('click', openUploadModal);
    els.filterForm.addEventListener('submit', applyFilters);
    els.storageNav.addEventListener('click', applyNavPreset);
    els.breadcrumbBar.addEventListener('click', handleBreadcrumbClick);
    if (els.fileListHeader) els.fileListHeader.addEventListener('click', handleSortHeaderClick);
    if (els.selectionToolbar) els.selectionToolbar.addEventListener('click', handleSelectionToolbarClick);
    if (els.sectorFilterSelect) {
      els.sectorFilterSelect.addEventListener('change', () => {
        state.sectorFilter = els.sectorFilterSelect.value;
        renderFiles();
      });
    }
    if (els.folderTree) {
      els.folderTree.addEventListener('click', handleFolderTreeClick);
      els.folderTree.addEventListener('dragover', (event) => {
        const label = event.target.closest('[data-tree-folder-id]');
        if (!label || !findFile(getDraggedFileId(event))) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        label.classList.add('drop-target');
      });
      els.folderTree.addEventListener('dragleave', (event) => {
        const label = event.target.closest('[data-tree-folder-id]');
        if (!label) return;
        if (event.relatedTarget && label.contains(event.relatedTarget)) return;
        label.classList.remove('drop-target');
      });
      els.folderTree.addEventListener('drop', (event) => {
        const label = event.target.closest('[data-tree-folder-id]');
        if (!label) return;
        event.preventDefault();
        label.classList.remove('drop-target');
        const record = findFile(getDraggedFileId(event));
        state.draggedFileId = '';
        if (!record) return;
        moveFileToFolder(record, label.getAttribute('data-tree-folder-id') || '').catch((error) => {
          showToast(error.message || 'تعذر نقل الملف', 'error');
        });
      });
    }
    document.querySelectorAll('[data-view-mode]').forEach((button) => {
      button.addEventListener('click', () => setViewMode(button.getAttribute('data-view-mode')));
    });
    document.querySelectorAll('[data-availability-sector-list]').forEach((list) => {
      list.addEventListener('change', handleAvailabilitySectorChange);
    });
    document.querySelectorAll('[data-select-all-availability-sectors]').forEach((button) => {
      button.addEventListener('click', () => selectAllAvailabilitySectors(button.closest('form')));
    });
    els.uploadForm.addEventListener('submit', uploadFile);
    const uploadFileInput = getUploadFileInput();
    if (uploadFileInput) uploadFileInput.addEventListener('change', handleBrowserUploadSelection);
    if (els.uploadDropzone && uploadFileInput) {
      els.uploadDropzone.addEventListener('click', (event) => {
        if (event.target === uploadFileInput) return;
        uploadFileInput.click();
      });
      els.uploadDropzone.addEventListener('dragover', (event) => {
        event.preventDefault();
        els.uploadDropzone.classList.add('drag-active');
      });
      els.uploadDropzone.addEventListener('dragleave', () => {
        els.uploadDropzone.classList.remove('drag-active');
      });
      els.uploadDropzone.addEventListener('drop', (event) => {
        event.preventDefault();
        els.uploadDropzone.classList.remove('drag-active');
        const dropped = event.dataTransfer && event.dataTransfer.files;
        if (dropped && dropped.length) {
          uploadFileInput.files = dropped;
          handleBrowserUploadSelection();
        }
      });
    }
    els.editForm.addEventListener('submit', saveEdit);
    els.filesBody.addEventListener('click', handleTableClick);
    els.filesBody.addEventListener('contextmenu', handleFilesContextMenu);
    els.filesBody.addEventListener('dblclick', handleFilesDoubleClick);
    els.filesBody.addEventListener('keydown', handleFilesKeydown);
    els.filesBody.addEventListener('dragstart', handleFileDragStart);
    els.filesBody.addEventListener('dragend', handleFileDragEnd);
    els.filesBody.addEventListener('dragover', handleFolderDragOver);
    els.filesBody.addEventListener('dragleave', handleFolderDragLeave);
    els.filesBody.addEventListener('drop', handleFolderDrop);
    els.filesBody.addEventListener('dragover', handleExternalDragOver);
    els.filesBody.addEventListener('dragleave', handleExternalDragLeave);
    els.filesBody.addEventListener('drop', handleExternalDrop);
    els.fileContextMenu.addEventListener('click', handleContextMenuClick);
    document.querySelectorAll('[data-close-modal]').forEach((button) => {
      button.addEventListener('click', closeModals);
    });
    document.querySelectorAll('.modal').forEach((modal) => {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModals();
      });
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('#fileContextMenu')) closeContextMenu();
    });
    window.addEventListener('resize', closeContextMenu);
    document.addEventListener('scroll', closeContextMenu, true);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeContextMenu();
        closeModals();
      }
    });
  }

  function init() {
    bindDom();
    applyInitialUrlQuery();
    state.filters.scope = getLandingScope();
    els.searchInput.value = state.filters.query;

    renderStorageNav();
    renderBreadcrumbs();
    setViewMode(state.viewMode);
    bindEvents();
    refreshAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
