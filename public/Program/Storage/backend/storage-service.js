const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Database = require('../../General/backend/sqlite-database');
const { appDataDir, DATA_ROOT, ensureDirSync: ensureDemoDir } = require('../../General/backend/platform-paths');
const {
  resolveSectorLabel,
  resolveStationName,
  getSectorChoicesByLabel
} = require('../../General/backend/reference-data-store');

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
const TRASH_RETENTION_DAYS = 30;
const DB_SNAPSHOT_KEEP = 14;
const VISIBILITIES = new Set(['all', 'secretaries', 'admins']);
const STATUSES = new Set(['active', 'archived', 'deleted']);
const MANAGEMENT_ROLES = new Set(['superadmin', 'admin', 'supersecretary', 'secretary']);
const AVAILABILITY_MANAGER_ROLES = new Set(['superadmin', 'admin']);
const FILE_MOVE_ROLES = new Set(['superadmin', 'admin', 'supersecretary']);
const SHARED_FOLDER_ROLES = new Set(['superadmin', 'admin', 'supersecretary']);
const ADMIN_SECTOR_VALUE = 'الإدارة';
const ROLE_RANKS = {
  superadmin: 0,
  admin: 1,
  supersecretary: 2,
  secretary: 3,
  user: 4
};
const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.webp',
  '.tif',
  '.tiff',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.txt',
  '.rtf',
  '.ppt',
  '.pptx',
  '.zip',
  '.7z',
  '.rar'
]);

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function normalizeRole(value) {
  const raw = value && typeof value === 'object' ? value.role : value;
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

function isAdminUser(user) {
  const role = normalizeRole(user);
  return role === 'admin' || role === 'superadmin';
}

function isManagementUser(user) {
  return MANAGEMENT_ROLES.has(normalizeRole(user));
}

function isAvailabilityManager(user) {
  return AVAILABILITY_MANAGER_ROLES.has(normalizeRole(user));
}

function canMoveFilesUser(user) {
  return FILE_MOVE_ROLES.has(normalizeRole(user));
}

// Everyone else is confined to their personal "ملفاتي" tree (scope = mine)
function canManageSharedFolders(user) {
  return SHARED_FOLDER_ROLES.has(normalizeRole(user));
}

function assertPersonalFolderScope(scope, user) {
  if (normalizeFolderScope(scope) === 'mine' || canManageSharedFolders(user)) return;
  throw createStorageError(
    'Only admins and super secretaries can create folders outside personal files',
    403,
    'personal_folder_required'
  );
}

function normalizeSectorValue(value) {
  const raw = normalizeText(value);
  if (!raw || raw === ADMIN_SECTOR_VALUE) return '';
  return resolveSectorLabel(raw) || raw;
}

function uniqueValues(values) {
  const result = [];
  const seen = new Set();
  (Array.isArray(values) ? values : [values]).forEach((value) => {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

function normalizeAvailabilitySectors(value) {
  let rawValues = value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) rawValues = parsed;
    } catch (_) {}
  }
  return uniqueValues(Array.isArray(rawValues) ? rawValues : [rawValues])
    .map(normalizeSectorValue)
    .filter(Boolean);
}

function readAvailabilitySectors(value) {
  return normalizeAvailabilitySectors(value);
}

function serializeAvailabilitySectors(value) {
  return JSON.stringify(normalizeAvailabilitySectors(value));
}

function getRawUserSectors(user) {
  if (!user || typeof user !== 'object') return [];
  if (Array.isArray(user.rooms)) return user.rooms;
  if (Array.isArray(user.sectors)) return user.sectors;
  return user.room ? [user.room] : [];
}

function getUserSectorList(user) {
  return normalizeAvailabilitySectors(getRawUserSectors(user));
}


function getAllAvailabilitySectorLabels() {
  return normalizeAvailabilitySectors(getSectorChoicesByLabel().map((choice) => choice.value || choice.label));
}

function getDefaultAvailabilitySectors(user) {
  const userSectors = getUserSectorList(user);
  return userSectors.length ? userSectors : getAllAvailabilitySectorLabels();
}
function userHasUnrestrictedAvailability(user) {
  if (isAvailabilityManager(user)) return true;
  return getRawUserSectors(user).some((sector) => normalizeText(sector) === ADMIN_SECTOR_VALUE);
}

function normalizeUserStationAccess(user) {
  const source = user && typeof user === 'object'
    ? (user.stationAccess && typeof user.stationAccess === 'object' ? user.stationAccess : user.stations)
    : null;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};

  const normalized = {};
  Object.entries(source).forEach(([sector, stations]) => {
    const normalizedSector = normalizeSectorValue(sector);
    if (!normalizedSector || !Array.isArray(stations)) return;
    const stationValues = uniqueValues(stations)
      .map((station) => normalizeAvailabilityStation(station, [normalizedSector]))
      .filter(Boolean);
    if (stationValues.length) normalized[normalizedSector] = stationValues;
  });
  return normalized;
}

function normalizeAvailabilityStation(value, sectors = []) {
  const raw = normalizeText(value);
  if (!raw) return '';
  const sector = Array.isArray(sectors) && sectors.length === 1 ? sectors[0] : '';
  return resolveStationName(raw, sector) || raw;
}

function hasAvailabilityPatch(body = {}) {
  return Object.prototype.hasOwnProperty.call(body, 'availabilitySector')
    || Object.prototype.hasOwnProperty.call(body, 'availabilitySectors')
    || Object.prototype.hasOwnProperty.call(body, 'availabilityStation');
}

function normalizeAvailabilityInput(body = {}, user, record = null) {
  const currentSectors = record ? record.availabilitySectors || [] : [];
  const currentStation = record ? record.availabilityStation || '' : '';
  const hasPatch = hasAvailabilityPatch(body);

  if (isAvailabilityManager(user)) {
    if (!hasPatch && record) return { sectors: currentSectors, station: currentStation };
    if (!hasPatch) return { sectors: getDefaultAvailabilitySectors(user), station: '' };
    const rawSectors = Object.prototype.hasOwnProperty.call(body, 'availabilitySectors')
      ? body.availabilitySectors
      : body.availabilitySector;
    const sectors = normalizeAvailabilitySectors(rawSectors);
    return {
      sectors,
      station: normalizeAvailabilityStation(body.availabilityStation, sectors)
    };
  }

  if (hasPatch && record) {
    throw createStorageError('Only admins and superadmins can change file availability', 403, 'availability_manager_required');
  }
  if (record) return { sectors: currentSectors, station: currentStation };
  return { sectors: getDefaultAvailabilitySectors(user), station: '' };
}

function canUserAccessAvailability(user, record) {
  const sectors = normalizeAvailabilitySectors(record && record.availabilitySectors);
  if (userHasUnrestrictedAvailability(user)) return true;

  const userSectors = getUserSectorList(user);
  if (!userSectors.length) return true;
  if (!sectors.length) return false;
  const matchingSectors = sectors.filter((sector) => userSectors.includes(sector));
  if (!matchingSectors.length) return false;

  const station = normalizeAvailabilityStation(record && record.availabilityStation, sectors);
  if (!station) return true;

  const stationAccess = normalizeUserStationAccess(user);
  return matchingSectors.some((sector) => {
    const allowedStations = stationAccess[sector];
    return !Array.isArray(allowedStations) || !allowedStations.length || allowedStations.includes(station);
  });
}

function normalizeUsername(user) {
  return String(user && user.username || '').trim();
}

function normalizeDisplayName(user) {
  return String(user && (user.displayName || user.username) || '').trim();
}

function getRoleRank(value) {
  const role = normalizeRole(value);
  return Object.prototype.hasOwnProperty.call(ROLE_RANKS, role) ? ROLE_RANKS[role] : ROLE_RANKS.user;
}

function normalizeVisibility(value) {
  const visibility = String(value || 'all').trim().toLowerCase();
  return VISIBILITIES.has(visibility) ? visibility : 'all';
}

function normalizeStatus(value, fallback = 'active') {
  const status = String(value || fallback).trim().toLowerCase();
  return STATUSES.has(status) ? status : fallback;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeFolderId(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
}

function normalizeFolderName(value) {
  return normalizeText(value).slice(0, 120);
}

function normalizeFolderScope(value) {
  const scope = String(value || '').trim().toLowerCase();
  return scope === 'mine' ? 'mine' : 'public';
}
function normalizeSourcePath(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f]/g, '')
    .trim();
}

function normalizeOriginalName(fileName) {
  const raw = String(fileName || '').trim();
  if (!raw) return 'file';
  let decoded = raw;
  if (!/[\u0600-\u06FF]/.test(raw)) {
    try {
      const candidate = Buffer.from(raw, 'latin1').toString('utf8').trim();
      if (candidate && /[\u0600-\u06FF]/.test(candidate)) decoded = candidate;
    } catch (_) {}
  }
  return decoded
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'file';
}

function parseTags(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map(normalizeText).filter(Boolean))).slice(0, 24);
  }
  return Array.from(new Set(String(value || '')
    .split(/[,\n،]+/)
    .map(normalizeText)
    .filter(Boolean)))
    .slice(0, 24);
}

function serializeTags(value) {
  return JSON.stringify(parseTags(value));
}

function readTags(value) {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parseTags(parsed) : [];
  } catch (_) {
    return [];
  }
}

function getUploadExtension(fileName) {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) ? ext : '';
}

function createStoredName(user, id, extension) {
  const accountName = normalizeOriginalName(normalizeDisplayName(user) || normalizeUsername(user) || 'account')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 90)
    .trim() || 'account';
  return `${accountName}-${id}${extension}`;
}

function isAllowedUploadName(fileName) {
  return Boolean(getUploadExtension(fileName));
}

function createStorageError(message, statusCode = 400, code = 'storage_error') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function assertUser(user) {
  if (!normalizeUsername(user)) {
    throw createStorageError('Authentication is required', 401, 'auth_required');
  }
}

function canUserViewRecord(user, record) {
  if (!record || normalizeStatus(record.status) === 'deleted') return false;
  if (isAdminUser(user)) return true;
  if (!canUserAccessAvailability(user, record)) return false;
  const visibility = normalizeVisibility(record.visibility);
  if (visibility === 'all') return true;
  if (visibility === 'secretaries') return isManagementUser(user);
  if (visibility === 'admins') return false;
  return false;
}

function assertVisibilityAllowedForUpload(user, visibility) {
  if (visibility === 'admins' && !isAdminUser(user)) {
    throw createStorageError('Only admins can upload admin-only files', 403, 'admin_visibility_required');
  }
  if (visibility === 'secretaries' && !isManagementUser(user)) {
    throw createStorageError('Only management users can upload secretary-only files', 403, 'management_visibility_required');
  }
}

function assertOwnerOrAdmin(record, user) {
  if (!record) throw createStorageError('File not found', 404, 'not_found');
  if (isAdminUser(user)) return;
  if (String(record.uploadedBy || record.uploaded_by || '') === normalizeUsername(user)) return;
  throw createStorageError('Only the uploader or an admin can change this file', 403, 'owner_or_admin_required');
}

function assertAdmin(user) {
  if (!isAdminUser(user)) {
    throw createStorageError('Only admin users can perform this action', 403, 'admin_required');
  }
}

function assertCanDeleteRecord(record, user) {
  assertAdmin(user);
  if (!record) throw createStorageError('File not found', 404, 'not_found');

  const actorUsername = normalizeUsername(user);
  if (actorUsername && String(record.uploadedBy || '') === actorUsername) return;

  const uploadedByRole = String(record.uploadedByRole || '').trim();
  if (uploadedByRole && getRoleRank(user) < getRoleRank(uploadedByRole)) return;

  throw createStorageError('Admins can only delete uploads from lower role accounts', 403, 'lower_role_required');
}

function moveFile(sourcePath, targetPath) {
  ensureDir(path.dirname(targetPath));
  try {
    fs.renameSync(sourcePath, targetPath);
  } catch (error) {
    if (error && error.code !== 'EXDEV') throw error;
    fs.copyFileSync(sourcePath, targetPath);
    fs.unlinkSync(sourcePath);
  }
}

function unlinkIfExists(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

function rowToRecord(row, dataDir) {
  if (!row) return null;
  const relativePath = String(row.relative_path || '').replace(/\\/g, '/');
  const trashPath = String(row.trash_path || '').replace(/\\/g, '/');
  return {
    id: String(row.id || ''),
    trashPath,
    trashAbsolutePath: trashPath ? path.join(dataDir, trashPath) : '',
    originalName: String(row.original_name || ''),
    storedName: String(row.stored_name || ''),
    relativePath,
    absolutePath: path.join(dataDir, relativePath),
    mimeType: String(row.mime_type || ''),
    size: Number(row.size || 0),
    title: String(row.title || ''),
    description: String(row.description || ''),
    sourcePath: String(row.source_path || ''),
    folderId: String(row.folder_id || ''),
    tags: readTags(row.tags_json),
    availabilitySectors: readAvailabilitySectors(row.availability_sectors_json),
    availabilitySector: readAvailabilitySectors(row.availability_sectors_json)[0] || '',
    availabilityStation: String(row.availability_station || ''),
    visibility: normalizeVisibility(row.visibility),
    status: normalizeStatus(row.status),
    uploadedBy: String(row.uploaded_by || ''),
    uploadedByDisplay: String(row.uploaded_by_display || row.uploaded_by || ''),
    uploadedByRole: String(row.uploaded_by_role || ''),
    uploadedAt: String(row.uploaded_at || ''),
    updatedAt: String(row.updated_at || ''),
    archivedAt: String(row.archived_at || ''),
    archivedBy: String(row.archived_by || ''),
    deletedAt: String(row.deleted_at || ''),
    deletedBy: String(row.deleted_by || ''),
    sourceProgram: String(row.source_program || ''),
    sourceRecordId: String(row.source_record_id || '')
  };
}

function rowToFolder(row) {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    name: String(row.name || ''),
    parentId: String(row.parent_id || ''),
    scope: normalizeFolderScope(row.scope),
    status: normalizeStatus(row.status),
    createdBy: String(row.created_by || ''),
    createdByDisplay: String(row.created_by_display || row.created_by || ''),
    createdByRole: String(row.created_by_role || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
    deletedAt: String(row.deleted_at || ''),
    deletedBy: String(row.deleted_by || '')
  };
}

function canUserManageFolder(folder, user) {
  if (!folder) return false;
  if (isAdminUser(user)) return true;
  return String(folder.createdBy || '') === normalizeUsername(user);
}

function folderMatchesScope(folder, user, scope = 'public', status = 'active', personalFolderIds = null) {
  if (!folder) return false;
  const normalizedStatus = String(status || 'active').toLowerCase() === 'all'
    ? 'all'
    : normalizeStatus(status);
  if (normalizedStatus !== 'all' && folder.status !== normalizedStatus) return false;

  const requestedScope = String(scope || 'public').trim().toLowerCase();
  const username = normalizeUsername(user);
  if (requestedScope === 'mine') {
    // Personal folders belong to whoever owns the tree, not to everyone with a "mine" folder
    return folder.createdBy === username
      || Boolean(personalFolderIds && personalFolderIds.has(folder.id));
  }
  if (requestedScope === 'all') return isAdminUser(user) || folder.createdBy === username || folder.scope === 'public';
  return folder.scope === 'public';
}
function recordMatchesQuery(record, query) {
  const text = normalizeText(query).toLowerCase();
  if (!text) return true;
  const haystack = [
    record.originalName,
    record.title,
    record.description,
    record.sourcePath,
    ...(Array.isArray(record.availabilitySectors) ? record.availabilitySectors : []),
    record.availabilityStation,
    record.uploadedBy,
    record.uploadedByDisplay,
    ...(Array.isArray(record.tags) ? record.tags : [])
  ].join(' ').toLowerCase();
  return text.split(/\s+/).filter(Boolean).every((part) => haystack.includes(part));
}

function stripAbsolutePath(record) {
  if (!record) return null;
  const { absolutePath, trashPath, trashAbsolutePath, ...clientRecord } = record;
  clientRecord.displayPath = clientRecord.sourcePath || '';
  return clientRecord;
}

function createStorageService(options = {}) {
  const dataDir = path.resolve(options.dataDir || appDataDir('Storage'));
  const relativeDataPath = path.relative(DATA_ROOT, dataDir);
  if (path.isAbsolute(relativeDataPath) || relativeDataPath === '..' || relativeDataPath.startsWith(`..${path.sep}`)) {
    throw new Error('Storage must remain inside the isolated demo data root.');
  }
  const filesDir = path.join(dataDir, 'files');
  const trashDir = path.join(dataDir, 'trash');
  const backupsDir = path.join(dataDir, 'backups');
  const tmpDir = path.join(dataDir, '_tmp_uploads');
  const dbPath = options.dbPath || path.join(dataDir, 'Storage.db');
  const relativeDbPath = path.relative(dataDir, path.resolve(dbPath));
  if (path.isAbsolute(relativeDbPath) || relativeDbPath === '..' || relativeDbPath.startsWith(`..${path.sep}`)) {
    throw new Error('Storage database must remain inside its isolated demo directory.');
  }
  ensureDemoDir(dataDir);
  ensureDemoDir(path.dirname(path.resolve(dbPath)));
  const now = typeof options.now === 'function' ? options.now : () => new Date();
  const idFactory = typeof options.idFactory === 'function' ? options.idFactory : () => crypto.randomUUID();
  const maxFileSize = Number.isFinite(Number(options.maxFileSize)) ? Number(options.maxFileSize) : MAX_UPLOAD_BYTES;
  const trashRetentionDays = Number.isFinite(Number(options.trashRetentionDays))
    ? Number(options.trashRetentionDays)
    : TRASH_RETENTION_DAYS;
  let db = null;

  function exec(sql, params = []) {
    return db.prepare(sql).run(...params);
  }

  function all(sql, params = []) {
    return db.prepare(sql).all(...params);
  }

  function get(sql, params = []) {
    return db.prepare(sql).get(...params) || null;
  }

  function ensureColumn(tableName, columnName, definition) {
    const columns = db.pragma(`table_info(${tableName})`);
    if (columns.some((column) => String(column.name || '') === columnName)) return;
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }

  function getFolder(id) {
    return rowToFolder(get('SELECT * FROM folders WHERE id = ?', [normalizeFolderId(id)]));
  }

  function requireFolder(id) {
    const folder = getFolder(id);
    if (!folder) throw createStorageError('Folder not found', 404, 'folder_not_found');
    return folder;
  }

  function assertFolderOwnerOrAdmin(folder, user) {
    if (!canUserManageFolder(folder, user)) {
      throw createStorageError('Only the folder creator or an admin can change this folder', 403, 'folder_owner_required');
    }
  }

  function normalizeTargetFolderId(value, user) {
    const folderId = normalizeFolderId(value);
    if (!folderId) return '';
    const folder = requireFolder(folderId);
    if (folder.status === 'deleted') throw createStorageError('Deleted folders cannot be used', 409, 'deleted_folder');
    if (!canMoveFilesUser(user)) assertFolderOwnerOrAdmin(folder, user);
    return folder.id;
  }

  // A personal tree is rooted at a folder its owner created; everything filed anywhere
  // inside it — including uploads from other accounts — belongs to that owner's "ملفاتي"
  function getPersonalFolderIdsForUser(user) {
    const username = normalizeUsername(user);
    const ids = new Set();
    if (!username) return ids;
    const folders = all("SELECT * FROM folders WHERE status != 'deleted'")
      .map(rowToFolder)
      .filter(Boolean);
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    folders.forEach((folder) => {
      if (normalizeFolderScope(folder.scope) !== 'mine') return;
      let root = folder;
      const seen = new Set();
      while (root && !seen.has(root.id)) {
        seen.add(root.id);
        const parent = root.parentId ? byId.get(root.parentId) : null;
        if (!parent || normalizeFolderScope(parent.scope) !== 'mine') break;
        root = parent;
      }
      if (root && root.createdBy === username) ids.add(folder.id);
    });
    return ids;
  }

  // Renaming, moving or removing a shared folder acts on whatever sits in it, so an owner
  // without shared-folder rights may only do it while every item inside is still their own
  function assertSharedFolderFullyOwned(folder, user) {
    if (canManageSharedFolders(user) || normalizeFolderScope(folder.scope) === 'mine') return;
    const username = normalizeUsername(user);
    const folderIds = [folder.id, ...getDescendantFolderIds(folder.id)];
    const placeholders = folderIds.map(() => '?').join(', ');
    const foreignFile = get(
      `SELECT id FROM files WHERE status != 'deleted' AND folder_id IN (${placeholders}) AND uploaded_by != ? LIMIT 1`,
      [...folderIds, username]
    );
    const foreignFolder = get(
      `SELECT id FROM folders WHERE status != 'deleted' AND id IN (${placeholders}) AND created_by != ? LIMIT 1`,
      [...folderIds, username]
    );
    if (foreignFile || foreignFolder) {
      throw createStorageError(
        'Shared folders holding other users items can only be changed by admins and super secretaries',
        403,
        'shared_folder_not_empty_of_others'
      );
    }
  }

  function userCanAccessRecord(record, user) {
    if (!record) return false;
    if (canUserViewRecord(user, record)) return true;
    if (String(record.uploadedBy || '') === normalizeUsername(user)) return true;
    const folderId = String(record.folderId || '');
    return Boolean(folderId && getPersonalFolderIdsForUser(user).has(folderId));
  }

  function getDescendantFolderIds(folderId) {
    const rootId = normalizeFolderId(folderId);
    const folders = all('SELECT * FROM folders').map(rowToFolder).filter(Boolean);
    const descendants = [];
    const pending = [rootId];
    while (pending.length) {
      const parentId = pending.shift();
      folders.forEach((folder) => {
        if (String(folder.parentId || '') === parentId && folder.status !== 'deleted' && !descendants.includes(folder.id)) {
          descendants.push(folder.id);
          pending.push(folder.id);
        }
      });
    }
    return descendants;
  }
  function getRecord(id) {
    return rowToRecord(get('SELECT * FROM files WHERE id = ?', [String(id || '')]), dataDir);
  }

  function requireRecord(id) {
    const record = getRecord(id);
    if (!record) throw createStorageError('File not found', 404, 'not_found');
    return record;
  }

  async function initialize() {
    ensureDir(dataDir);
    ensureDir(filesDir);
    ensureDir(trashDir);
    ensureDir(tmpDir);
    ensureDir(path.dirname(dbPath));
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        original_name TEXT NOT NULL DEFAULT '',
        stored_name TEXT NOT NULL DEFAULT '',
        relative_path TEXT NOT NULL DEFAULT '',
        mime_type TEXT NOT NULL DEFAULT '',
        size INTEGER NOT NULL DEFAULT 0,
        title TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        source_path TEXT NOT NULL DEFAULT '',
        folder_id TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        availability_sectors_json TEXT NOT NULL DEFAULT '[]',
        availability_station TEXT NOT NULL DEFAULT '',
        visibility TEXT NOT NULL DEFAULT 'all',
        status TEXT NOT NULL DEFAULT 'active',
        uploaded_by TEXT NOT NULL DEFAULT '',
        uploaded_by_display TEXT NOT NULL DEFAULT '',
        uploaded_by_role TEXT NOT NULL DEFAULT '',
        uploaded_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT '',
        archived_at TEXT NOT NULL DEFAULT '',
        archived_by TEXT NOT NULL DEFAULT '',
        deleted_at TEXT NOT NULL DEFAULT '',
        deleted_by TEXT NOT NULL DEFAULT '',
        source_program TEXT NOT NULL DEFAULT '',
        source_record_id TEXT NOT NULL DEFAULT ''
      );
    `);
    ensureColumn('files', 'source_path', "TEXT NOT NULL DEFAULT ''");
    ensureColumn('files', 'folder_id', "TEXT NOT NULL DEFAULT ''");
    ensureColumn('files', 'availability_sectors_json', "TEXT NOT NULL DEFAULT '[]'");
    ensureColumn('files', 'availability_station', "TEXT NOT NULL DEFAULT ''");
    ensureColumn('files', 'trash_path', "TEXT NOT NULL DEFAULT ''");
    db.exec(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        parent_id TEXT NOT NULL DEFAULT '',
        scope TEXT NOT NULL DEFAULT 'public',
        status TEXT NOT NULL DEFAULT 'active',
        created_by TEXT NOT NULL DEFAULT '',
        created_by_display TEXT NOT NULL DEFAULT '',
        created_by_role TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT '',
        deleted_at TEXT NOT NULL DEFAULT '',
        deleted_by TEXT NOT NULL DEFAULT ''
      );
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_storage_files_status ON files(status);
      CREATE INDEX IF NOT EXISTS idx_storage_files_visibility ON files(visibility);
      CREATE INDEX IF NOT EXISTS idx_storage_files_uploaded_by ON files(uploaded_by);
      CREATE INDEX IF NOT EXISTS idx_storage_files_folder_id ON files(folder_id);
      CREATE INDEX IF NOT EXISTS idx_storage_files_availability_station ON files(availability_station);
      CREATE INDEX IF NOT EXISTS idx_storage_folders_status ON folders(status);
      CREATE INDEX IF NOT EXISTS idx_storage_folders_parent_id ON folders(parent_id);
      CREATE INDEX IF NOT EXISTS idx_storage_folders_created_by ON folders(created_by);
    `);
    runMaintenance();
  }

  function ensureReady() {
    if (!db) throw createStorageError('Storage service is not initialized', 500, 'not_initialized');
  }

  function snapshotDatabase() {
    const stamp = now().toISOString().slice(0, 10);
    const snapshotPath = path.join(backupsDir, `Storage-${stamp}.db`);
    if (fs.existsSync(snapshotPath)) return;
    ensureDir(backupsDir);
    db.pragma('wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(dbPath, snapshotPath);
    const snapshots = fs.readdirSync(backupsDir)
      .filter((name) => /^Storage-\d{4}-\d{2}-\d{2}\.db$/.test(name))
      .sort();
    while (snapshots.length > DB_SNAPSHOT_KEEP) {
      unlinkIfExists(path.join(backupsDir, snapshots.shift()));
    }
  }

  function purgeExpiredTrash() {
    if (!(trashRetentionDays > 0)) return 0;
    const cutoff = new Date(now().getTime() - trashRetentionDays * 24 * 60 * 60 * 1000).toISOString();
    const expired = all(
      "SELECT * FROM files WHERE status = 'deleted' AND deleted_at != '' AND deleted_at < ?",
      [cutoff]
    ).map((row) => rowToRecord(row, dataDir));
    expired.forEach((record) => {
      unlinkIfExists(record.trashAbsolutePath);
      unlinkIfExists(record.absolutePath);
      exec('DELETE FROM files WHERE id = ?', [record.id]);
    });
    return expired.length;
  }

  function runMaintenance() {
    ensureReady();
    const purged = purgeExpiredTrash();
    try {
      snapshotDatabase();
    } catch (error) {
      console.warn('⚠️  Storage DB snapshot failed:', error.message);
    }
    return { purged };
  }

  async function createFileFromUpload({ file, body = {}, user }) {
    ensureReady();
    assertUser(user);
    if (!file || !file.path || !fs.existsSync(file.path)) {
      throw createStorageError('No file uploaded', 400, 'missing_file');
    }

    const originalName = normalizeOriginalName(file.originalname);
    const extension = getUploadExtension(originalName);
    const size = Number(file.size || 0);
    const visibility = normalizeVisibility(body.visibility);

    try {
      if (!extension) throw createStorageError('Unsupported file type', 400, 'unsupported_file_type');
      if (size > maxFileSize) throw createStorageError('File exceeds the maximum upload size', 413, 'file_too_large');
      assertVisibilityAllowedForUpload(user, visibility);
      const availability = normalizeAvailabilityInput(body, user);
      const folderId = normalizeTargetFolderId(body.folderId || body.folder_id, user);

      const timestamp = now().toISOString();
      const id = String(idFactory()).replace(/[^a-zA-Z0-9_-]/g, '') || crypto.randomUUID();
      const storedName = createStoredName(user, id, extension);
      const year = timestamp.slice(0, 4);
      const month = timestamp.slice(5, 7);
      const relativePath = path.join('files', year, month, storedName);
      const absolutePath = path.join(dataDir, relativePath);

      moveFile(file.path, absolutePath);

      const recordValues = [
        id,
        originalName,
        storedName,
        relativePath.replace(/\\/g, '/'),
        String(file.mimetype || 'application/octet-stream'),
        size,
        normalizeText(body.title) || normalizeText(normalizeDisplayName(user)) || originalName,
        normalizeText(body.description),
        normalizeSourcePath(body.sourcePath || body.source_path),
        folderId,
        serializeTags(body.tags),
        serializeAvailabilitySectors(availability.sectors),
        availability.station,
        visibility,
        'active',
        normalizeUsername(user),
        normalizeDisplayName(user),
        normalizeRole(user),
        timestamp,
        timestamp,
        '',
        '',
        '',
        '',
        normalizeText(body.sourceProgram),
        normalizeText(body.sourceRecordId)
      ];

      exec(`
        INSERT INTO files (
          id, original_name, stored_name, relative_path, mime_type, size, title, description, source_path, folder_id, tags_json,
          availability_sectors_json, availability_station, visibility, status, uploaded_by, uploaded_by_display, uploaded_by_role, uploaded_at, updated_at,
          archived_at, archived_by, deleted_at, deleted_by, source_program, source_record_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, recordValues);

      return requireRecord(id);
    } catch (error) {
      unlinkIfExists(file.path);
      throw error;
    }
  }

  async function listFiles({ user, scope = 'visible', query = '', visibility = '', status = 'active', limit = 0, offset = 0 } = {}) {
    ensureReady();
    assertUser(user);
    const normalizedStatus = String(status || 'active').toLowerCase() === 'all'
      ? 'all'
      : normalizeStatus(status);
    const normalizedVisibility = VISIBILITIES.has(String(visibility || '').toLowerCase())
      ? String(visibility || '').toLowerCase()
      : '';
    const requestedScope = String(scope || 'visible').trim().toLowerCase();
    const username = normalizeUsername(user);

    const where = [];
    const params = [];
    if (normalizedStatus !== 'all') {
      where.push('status = ?');
      params.push(normalizedStatus);
    }
    if (normalizedVisibility) {
      where.push('visibility = ?');
      params.push(normalizedVisibility);
    }
    if (requestedScope === 'mine') {
      const personalFolderIds = Array.from(getPersonalFolderIdsForUser(user));
      if (personalFolderIds.length) {
        where.push(`(uploaded_by = ? OR folder_id IN (${personalFolderIds.map(() => '?').join(', ')}))`);
        params.push(username, ...personalFolderIds);
      } else {
        where.push('uploaded_by = ?');
        params.push(username);
      }
    } else if (requestedScope === 'public' || requestedScope === 'general') {
      where.push('uploaded_by != ?');
      params.push(username);
    }

    const sql = `SELECT * FROM files${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY uploaded_at DESC, original_name ASC`;
    let records = all(sql, params).map((row) => rowToRecord(row, dataDir));

    if (requestedScope !== 'mine' && (requestedScope === 'public' || requestedScope === 'general' || !isAdminUser(user))) {
      records = records.filter((record) => canUserViewRecord(user, record));
    }
    records = records.filter((record) => recordMatchesQuery(record, query));

    const total = records.length;
    const safeOffset = Number(offset) > 0 ? Math.floor(Number(offset)) : 0;
    const safeLimit = Number(limit) > 0 ? Math.floor(Number(limit)) : 0;
    if (safeOffset) records = records.slice(safeOffset);
    if (safeLimit) records = records.slice(0, safeLimit);

    return { files: records, count: records.length, total };
  }

  async function getFile(id, user) {
    ensureReady();
    assertUser(user);
    const record = requireRecord(id);
    if (!userCanAccessRecord(record, user)) {
      throw createStorageError('You do not have access to this file', 403, 'forbidden');
    }
    return record;
  }

  async function listFolders({ user, scope = 'public', status = 'active' } = {}) {
    ensureReady();
    assertUser(user);
    const personalFolderIds = String(scope || '').trim().toLowerCase() === 'mine'
      ? getPersonalFolderIdsForUser(user)
      : null;
    const folders = all('SELECT * FROM folders ORDER BY created_at ASC, name ASC')
      .map(rowToFolder)
      .filter(Boolean)
      .filter((folder) => folderMatchesScope(folder, user, scope, status, personalFolderIds));
    return { folders, count: folders.length };
  }

  async function createFolder(body = {}, user) {
    ensureReady();
    assertUser(user);
    const name = normalizeFolderName(body.name);
    if (!name) throw createStorageError('Folder name is required', 400, 'folder_name_required');

    let parentId = normalizeFolderId(body.parentId || body.parent_id);
    let scope = normalizeFolderScope(body.scope);
    if (parentId) {
      const parent = requireFolder(parentId);
      if (parent.status === 'deleted') throw createStorageError('Deleted folders cannot contain new folders', 409, 'deleted_folder');
      assertFolderOwnerOrAdmin(parent, user);
      scope = parent.scope;
    }
    assertPersonalFolderScope(scope, user);

    const timestamp = now().toISOString();
    const id = normalizeFolderId(idFactory()) || crypto.randomUUID();
    exec(`
      INSERT INTO folders (
        id, name, parent_id, scope, status, created_by, created_by_display, created_by_role, created_at, updated_at, deleted_at, deleted_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      name,
      parentId,
      scope,
      'active',
      normalizeUsername(user),
      normalizeDisplayName(user),
      normalizeRole(user),
      timestamp,
      timestamp,
      '',
      ''
    ]);
    return requireFolder(id);
  }

  async function updateFolder(id, body = {}, user) {
    ensureReady();
    assertUser(user);
    const folder = requireFolder(id);
    if (folder.status === 'deleted') throw createStorageError('Deleted folders cannot be edited', 409, 'deleted_folder');
    assertFolderOwnerOrAdmin(folder, user);
    assertSharedFolderFullyOwned(folder, user);

    const name = body.name === undefined ? folder.name : normalizeFolderName(body.name);
    if (!name) throw createStorageError('Folder name is required', 400, 'folder_name_required');

    let parentId = body.parentId === undefined && body.parent_id === undefined
      ? folder.parentId
      : normalizeFolderId(body.parentId || body.parent_id);
    if (parentId) {
      const parent = requireFolder(parentId);
      if (parent.status === 'deleted') throw createStorageError('Deleted folders cannot contain folders', 409, 'deleted_folder');
      assertFolderOwnerOrAdmin(parent, user);
      if (parent.id === folder.id || getDescendantFolderIds(folder.id).includes(parent.id)) {
        throw createStorageError('Folder cannot be moved inside itself', 409, 'folder_cycle');
      }
      // Re-parenting must not smuggle a folder out of the personal tree either
      if (parentId !== folder.parentId) assertPersonalFolderScope(parent.scope, user);
    }

    const timestamp = now().toISOString();
    exec(`
      UPDATE folders
      SET name = ?, parent_id = ?, updated_at = ?
      WHERE id = ?
    `, [name, parentId, timestamp, folder.id]);
    return requireFolder(folder.id);
  }

  async function deleteFolder(id, options = {}, user) {
    ensureReady();
    assertUser(user);
    const folder = requireFolder(id);
    if (folder.status === 'deleted') return folder;
    assertFolderOwnerOrAdmin(folder, user);
    assertSharedFolderFullyOwned(folder, user);

    const mode = String(options.mode || options.deleteMode || '').trim().toLowerCase() === 'with-contents'
      ? 'with-contents'
      : 'folder-only';
    const timestamp = now().toISOString();
    const actor = normalizeUsername(user);
    const descendantIds = getDescendantFolderIds(folder.id);
    const affectedFolderIds = [folder.id, ...descendantIds];

    if (mode === 'with-contents') {
      const records = all('SELECT * FROM files').map((row) => rowToRecord(row, dataDir)).filter(Boolean)
        .filter((record) => affectedFolderIds.includes(String(record.folderId || '')) && record.status !== 'deleted');
      records.forEach((record) => assertCanDeleteRecord(record, user));
      const applyDelete = db.transaction(() => {
        records.forEach((record) => moveRecordToTrash(record, timestamp, actor));
        affectedFolderIds.forEach((folderId) => {
          exec(`
            UPDATE folders
            SET status = 'deleted', deleted_at = ?, deleted_by = ?, updated_at = ?
            WHERE id = ?
          `, [timestamp, actor, timestamp, folderId]);
        });
      });
      applyDelete();
      return { ...folder, status: 'deleted', deletedAt: timestamp, deletedBy: actor };
    }

    const applyDetach = db.transaction(() => {
      exec('UPDATE files SET folder_id = ?, updated_at = ? WHERE folder_id = ?', ['', timestamp, folder.id]);
      exec('UPDATE folders SET parent_id = ?, updated_at = ? WHERE parent_id = ?', ['', timestamp, folder.id]);
      exec(`
        UPDATE folders
        SET status = 'deleted', deleted_at = ?, deleted_by = ?, updated_at = ?
        WHERE id = ?
      `, [timestamp, actor, timestamp, folder.id]);
    });
    applyDetach();
    return { ...folder, status: 'deleted', deletedAt: timestamp, deletedBy: actor };
  }
  async function updateFile(id, body = {}, user) {
    ensureReady();
    assertUser(user);
    const record = requireRecord(id);
    if (record.status === 'deleted') throw createStorageError('Deleted files cannot be edited', 409, 'deleted_file');
    // A pure folder move only needs the move role; every other change keeps the owner-or-admin rule
    const isPureMove = (body.folderId !== undefined || body.folder_id !== undefined)
      && ['title', 'description', 'tags', 'visibility', 'availabilitySector', 'availabilitySectors', 'availabilityStation']
        .every((key) => body[key] === undefined);
    if (!(isPureMove && canMoveFilesUser(user))) {
      assertOwnerOrAdmin(record, user);
    }

    const currentVisibility = record.visibility;
    const nextVisibility = body.visibility === undefined ? currentVisibility : normalizeVisibility(body.visibility);
    if (nextVisibility !== currentVisibility) {
      assertAdmin(user);
    }

    const title = body.title === undefined ? record.title : (normalizeText(body.title) || record.originalName);
    const description = body.description === undefined ? record.description : normalizeText(body.description);
    const tagsJson = body.tags === undefined ? JSON.stringify(record.tags || []) : serializeTags(body.tags);
    const availability = normalizeAvailabilityInput(body, user, record);
    const nextFolderId = body.folderId === undefined && body.folder_id === undefined
      ? record.folderId
      : normalizeTargetFolderId(body.folderId || body.folder_id, user);
    if (String(nextFolderId || '') !== String(record.folderId || '') && !canMoveFilesUser(user)) {
      throw createStorageError('Only admins and super secretaries can move files', 403, 'move_role_required');
    }
    const timestamp = now().toISOString();

    exec(`
      UPDATE files
      SET title = ?, description = ?, tags_json = ?, availability_sectors_json = ?, availability_station = ?, visibility = ?, folder_id = ?, updated_at = ?
      WHERE id = ?
    `, [
      title,
      description,
      tagsJson,
      serializeAvailabilitySectors(availability.sectors),
      availability.station,
      nextVisibility,
      nextFolderId,
      timestamp,
      record.id
    ]);

    return requireRecord(record.id);
  }

  async function archiveFile(id, user) {
    ensureReady();
    assertUser(user);
    const record = requireRecord(id);
    if (record.status === 'deleted') throw createStorageError('Deleted files cannot be archived', 409, 'deleted_file');
    assertOwnerOrAdmin(record, user);
    const timestamp = now().toISOString();
    exec(`
      UPDATE files
      SET status = 'archived', archived_at = ?, archived_by = ?, updated_at = ?
      WHERE id = ?
    `, [timestamp, normalizeUsername(user), timestamp, record.id]);
    return requireRecord(record.id);
  }

  function trashRelativePath(record) {
    return path.posix.join('trash', record.storedName || `${record.id}${path.extname(record.relativePath || '')}`);
  }

  function moveRecordToTrash(record, timestamp, actor) {
    const trashPath = trashRelativePath(record);
    if (fs.existsSync(record.absolutePath)) {
      moveFile(record.absolutePath, path.join(dataDir, trashPath));
    }
    exec(`
      UPDATE files
      SET status = 'deleted', trash_path = ?, deleted_at = ?, deleted_by = ?, updated_at = ?
      WHERE id = ?
    `, [trashPath, timestamp, actor, timestamp, record.id]);
  }

  function purgeRecord(record) {
    unlinkIfExists(record.trashAbsolutePath);
    unlinkIfExists(record.absolutePath);
    exec('DELETE FROM files WHERE id = ?', [record.id]);
  }

  async function restoreFile(id, user) {
    ensureReady();
    assertUser(user);
    assertAdmin(user);
    const record = requireRecord(id);
    const timestamp = now().toISOString();

    if (record.status === 'deleted') {
      if (record.trashAbsolutePath && fs.existsSync(record.trashAbsolutePath)) {
        moveFile(record.trashAbsolutePath, record.absolutePath);
      } else if (!fs.existsSync(record.absolutePath)) {
        throw createStorageError('File content no longer exists and cannot be restored', 410, 'content_missing');
      }
      const targetFolder = record.folderId ? getFolder(record.folderId) : null;
      const folderId = targetFolder && targetFolder.status === 'active' ? targetFolder.id : '';
      exec(`
        UPDATE files
        SET status = 'active', trash_path = '', deleted_at = '', deleted_by = '',
            archived_at = '', archived_by = '', folder_id = ?, updated_at = ?
        WHERE id = ?
      `, [folderId, timestamp, record.id]);
      return requireRecord(record.id);
    }

    exec(`
      UPDATE files
      SET status = 'active', archived_at = '', archived_by = '', updated_at = ?
      WHERE id = ?
    `, [timestamp, record.id]);
    return requireRecord(record.id);
  }

  async function deleteFile(id, user) {
    ensureReady();
    assertUser(user);
    const record = requireRecord(id);
    assertCanDeleteRecord(record, user);
    if (record.status === 'deleted') {
      purgeRecord(record);
      return { ...record, purged: true };
    }
    const timestamp = now().toISOString();
    moveRecordToTrash(record, timestamp, normalizeUsername(user));
    return requireRecord(record.id);
  }

  async function getFileForDownload(id, user) {
    ensureReady();
    assertUser(user);
    const record = requireRecord(id);
    if (!userCanAccessRecord(record, user)) {
      throw createStorageError('You do not have access to this file', 403, 'forbidden');
    }
    if (record.status === 'deleted' || !fs.existsSync(record.absolutePath)) {
      throw createStorageError('File not found', 404, 'not_found');
    }
    return record;
  }

  async function getStats(user) {
    ensureReady();
    assertUser(user);
    const listed = await listFiles({
      user,
      scope: isAdminUser(user) ? 'all' : 'visible',
      status: 'all'
    });
    const activeFiles = listed.files.filter((record) => record.status === 'active');
    const archivedFiles = listed.files.filter((record) => record.status === 'archived');
    const username = normalizeUsername(user);
    const visibleActive = activeFiles.filter((record) => canUserViewRecord(user, record) || record.uploadedBy === username);
    const publicActive = activeFiles.filter((record) => canUserViewRecord(user, record) && record.uploadedBy !== username);
    const visibilityCounts = { all: 0, secretaries: 0, admins: 0 };
    let totalBytes = 0;
    activeFiles.forEach((record) => {
      visibilityCounts[record.visibility] = (visibilityCounts[record.visibility] || 0) + 1;
      totalBytes += Number(record.size || 0);
    });
    return {
      totalFiles: activeFiles.length,
      archivedFiles: archivedFiles.length,
      visibleFiles: visibleActive.length,
      publicFiles: publicActive.length,
      totalBytes,
      visibilityCounts,
      latest: activeFiles.slice(0, 5)
    };
  }

  function close() {
    if (db) {
      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch (_) {}
      db.close();
      db = null;
    }
  }

  return {
    dataDir,
    filesDir,
    trashDir,
    backupsDir,
    tmpDir,
    dbPath,
    initialize,
    close,
    runMaintenance,
    createFileFromUpload,
    listFiles,
    getFile,
    listFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    updateFile,
    archiveFile,
    restoreFile,
    deleteFile,
    getFileForDownload,
    getStats
  };
}

module.exports = {
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  VISIBILITIES,
  canUserViewRecord,
  createStorageError,
  createStorageService,
  isAdminUser,
  isAllowedUploadName,
  isManagementUser,
  normalizeVisibility,
  stripAbsolutePath
};
