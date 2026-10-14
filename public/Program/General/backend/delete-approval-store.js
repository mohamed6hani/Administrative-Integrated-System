const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildRecordActivity, diffActivityRecords, extractRecordIdentity } = require('./activity-record-audit');
const {
  clearFileCache,
  readJsonCached
} = require('./file-data-cache');
const {
  PROGRAM_ROOT,
  appDataDir,
  dataFile,
  dataSubdir
} = require('./platform-paths');

const ADMIN_ROLE = 'admin';
const SUPERSECRETARY_ROLE = 'supersecretary';
const SECRETARY_ROLE = 'secretary';
const USER_ROLE = 'user';

const APPROVALS_FILE = dataFile('General', 'delete-approvals.json', [
  path.join(PROGRAM_ROOT, 'General', 'backend', 'data', 'delete-approvals.json')
]);
const ACTION_APPROVAL_POLICY_FILE = dataFile('General', 'action-approval-policy.json', [
  path.join(PROGRAM_ROOT, 'General', 'backend', 'data', 'action-approval-policy.json')
]);

const PROGRAM_NAMES = {
  weapons: 'برنامج الرخص الملغاة',
  renewal: 'برنامج الملفات التي لم ترد',
  report: 'برنامج القرارات',
  accept: 'موافقة شؤون الضباط',
  request: 'برنامج طلبات ترخيص اول مرة',
  seized: 'برنامج الأحراز',
  storage: 'التخزين الموحد',
  company: 'إدارة شركات الحراسة'
};
const APPROVAL_ACTIONS = ['add', 'edit', 'delete'];
const DEFAULT_ACTION_POLICY = Object.freeze({
  add: false,
  edit: false,
  delete: true
});
const ACTION_LABELS = {
  add: 'إضافة',
  edit: 'تعديل',
  delete: 'حذف'
};
const DELETE_EXECUTORS = new Map();
const APPROVAL_EXECUTION_LOCKS = new Set();
const APPROVAL_PROCESS_INSTANCE_ID = crypto.randomBytes(16).toString('hex');
const DELETE_EXECUTOR_MODULES = {
  accept: path.join(PROGRAM_ROOT, 'Accept', 'backend', 'api-routes.js'),
  company: path.join(PROGRAM_ROOT, 'Company', 'Backend', 'api-routes.js'),
  renewal: path.join(PROGRAM_ROOT, 'Renewal', 'backend', 'api-routes.js'),
  report: path.join(PROGRAM_ROOT, 'Report', 'backend', 'api-routes.js'),
  request: path.join(PROGRAM_ROOT, 'Request', 'backend', 'api-routes.js'),
  seized: path.join(PROGRAM_ROOT, 'Seized', 'Backend', 'api-routes.js'),
  weapons: path.join(PROGRAM_ROOT, 'Weapons', 'backend', 'api-routes.js')
};
const DELETE_EXECUTOR_TYPES = {
  'accept.delete-records': DELETE_EXECUTOR_MODULES.accept,
  'company.delete': DELETE_EXECUTOR_MODULES.company,
  'renewal.delete-records': DELETE_EXECUTOR_MODULES.renewal,
  'report.delete-records': DELETE_EXECUTOR_MODULES.report,
  'request.add': DELETE_EXECUTOR_MODULES.request,
  'request.edit': DELETE_EXECUTOR_MODULES.request,
  'request.delete': DELETE_EXECUTOR_MODULES.request,
  'seized.delete-records': DELETE_EXECUTOR_MODULES.seized,
  'weapons.delete-records': DELETE_EXECUTOR_MODULES.weapons
};
const DELETE_EXECUTOR_MODULE_INITIALIZERS = {
  [DELETE_EXECUTOR_MODULES.report]: (exported) => {
    if (typeof exported === 'function') {
      exported(require('express'));
    }
  }
};
const deleteExecutorModuleLoadAttempts = new Set();

let activityLogger = null;
let weaponsApprovalSqlStore = null;
let weaponsApprovalHydrationWarningShown = false;
const ARABIC_APPROVAL_DIGITS = Object.freeze({
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9'
});

function normalizeWeaponsApprovalValue(value) {
  return String(value == null ? '' : value).trim();
}

function toLatinApprovalDigits(value) {
  return String(value == null ? '' : value).replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_APPROVAL_DIGITS[digit] || digit);
}

function normalizeWeaponsApprovalName(value) {
  return normalizeWeaponsApprovalValue(value)
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeWeaponsApprovalLicense(value) {
  return toLatinApprovalDigits(value)
    .replace(/[^0-9a-zA-Z]/g, '')
    .toLowerCase();
}

function getWeaponsApprovalSnapshotId(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return '';
  return normalizeWeaponsApprovalValue(snapshot.__recordId ?? snapshot.id ?? snapshot.recordId);
}

function getWeaponsApprovalSnapshotLicense(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return '';
  return normalizeWeaponsApprovalValue(
    snapshot['رقم']
    ?? snapshot['رقم القيد']
    ?? snapshot.license
    ?? snapshot.licenseNumber
    ?? snapshot.license_number
  );
}

function getWeaponsApprovalSnapshotName(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return '';
  return normalizeWeaponsApprovalValue(snapshot['الاسم'] ?? snapshot.name);
}

function getWeaponsApprovalSnapshotIdentityKey(snapshot) {
  const name = normalizeWeaponsApprovalName(getWeaponsApprovalSnapshotName(snapshot));
  const license = normalizeWeaponsApprovalLicense(getWeaponsApprovalSnapshotLicense(snapshot));
  return name || license ? name + '::' + license : '';
}

function getWeaponsApprovalSqlStore() {
  if (weaponsApprovalSqlStore) return weaponsApprovalSqlStore;
  const { createWeaponsSqlStore } = require('../../Weapons/backend/sql-store');
  const legacyDataPath = path.join(PROGRAM_ROOT, 'Weapons', 'Data');
  const dataPath = appDataDir('Weapons', { legacyDirs: [legacyDataPath] });
  const csvPath = dataFile('Weapons', 'slah.csv', [path.join(legacyDataPath, 'slah.csv')]);
  weaponsApprovalSqlStore = createWeaponsSqlStore({
    dbPath: path.join(dataPath, 'weapons.sqlite'),
    csvPath,
    clearCsvCache: clearFileCache
  });
  if (typeof weaponsApprovalSqlStore.ensureInitialized === 'function') {
    weaponsApprovalSqlStore.ensureInitialized();
  }
  return weaponsApprovalSqlStore;
}

function getWeaponsApprovalSnapshotsLookup() {
  const lookup = { byId: new Map(), byIdentity: new Map() };
  let records;
  try {
    records = getWeaponsApprovalSqlStore().getRecords();
  } catch (error) {
    if (!weaponsApprovalHydrationWarningShown) {
      weaponsApprovalHydrationWarningShown = true;
      console.warn('Failed to hydrate weapons delete approval snapshots:', error.message);
    }
    return lookup;
  }

  const headers = Array.isArray(records?.headers) ? records.headers : [];
  const rows = Array.isArray(records?.rows) ? records.rows : [];
  const meta = Array.isArray(records?.meta) ? records.meta : [];
  rows.forEach((row, rowIndex) => {
    const snapshot = {};
    headers.forEach((header, index) => {
      const key = normalizeWeaponsApprovalValue(header);
      if (!key) return;
      snapshot[key] = row && row[index] != null ? String(row[index]) : '';
    });
    const rowMeta = meta[rowIndex] || {};
    if (rowMeta.id != null) snapshot.__recordId = rowMeta.id;
    if (rowMeta.rowOrder != null) snapshot.__rowOrder = rowMeta.rowOrder;
    if (rowMeta.updatedAt != null) snapshot.__updatedAt = rowMeta.updatedAt;

    const id = getWeaponsApprovalSnapshotId(snapshot);
    if (id && !lookup.byId.has(id)) lookup.byId.set(id, snapshot);
    const identityKey = getWeaponsApprovalSnapshotIdentityKey(snapshot);
    if (identityKey && !lookup.byIdentity.has(identityKey)) lookup.byIdentity.set(identityKey, snapshot);
  });
  return lookup;
}

function hydrateWeaponsApprovalSnapshot(snapshot, lookup) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return snapshot;
  const id = getWeaponsApprovalSnapshotId(snapshot);
  if (id && lookup.byId.has(id)) return cloneJson(lookup.byId.get(id), lookup.byId.get(id));
  const identityKey = getWeaponsApprovalSnapshotIdentityKey(snapshot);
  if (identityKey && lookup.byIdentity.has(identityKey)) {
    return cloneJson(lookup.byIdentity.get(identityKey), lookup.byIdentity.get(identityKey));
  }
  return snapshot;
}

function hydrateWeaponsApprovalSnapshotValue(value, lookup) {
  if (Array.isArray(value)) {
    return value.map((entry) => hydrateWeaponsApprovalSnapshotValue(entry, lookup));
  }
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value.records)) {
    return {
      ...value,
      records: value.records.map((entry) => hydrateWeaponsApprovalSnapshot(entry, lookup))
    };
  }
  return hydrateWeaponsApprovalSnapshot(value, lookup);
}

function hydrateWeaponsApprovalOperationRows(operation, lookup) {
  if (!operation || typeof operation !== 'object' || !Array.isArray(operation.rows)) return operation;
  return {
    ...operation,
    rows: operation.rows.map((row) => hydrateWeaponsApprovalSnapshot(row, lookup))
  };
}

function hydrateWeaponsApprovalRequestSnapshots(request) {
  if (!request || typeof request !== 'object') return request;
  const programKey = String(request.programKey || request.operation?.programKey || '').trim().toLowerCase();
  if (programKey !== 'weapons') return request;

  const lookup = getWeaponsApprovalSnapshotsLookup();
  if (!lookup.byId.size && !lookup.byIdentity.size) return request;

  const hydrated = cloneJson(request, { ...request });
  hydrated.recordSnapshot = hydrateWeaponsApprovalSnapshotValue(hydrated.recordSnapshot, lookup);
  hydrated.operation = hydrateWeaponsApprovalOperationRows(hydrated.operation, lookup);
  if (Array.isArray(hydrated.items)) {
    hydrated.items = hydrated.items.map((item) => {
      if (!item || typeof item !== 'object') return item;
      return {
        ...item,
        recordSnapshot: hydrateWeaponsApprovalSnapshotValue(item.recordSnapshot, lookup),
        operation: hydrateWeaponsApprovalOperationRows(item.operation, lookup)
      };
    });
  }
  return hydrated;
}


function configureActivityLogger(logger) {
  activityLogger = typeof logger === 'function' ? logger : null;
}

function getApprovalSnapshot(request, item) {
  const snapshot = item?.recordSnapshot ?? request?.recordSnapshot ?? {};
  if (!snapshot || typeof snapshot !== 'object') return {};
  if (snapshot.company && typeof snapshot.company === 'object') return snapshot.company;
  if (snapshot.after && typeof snapshot.after === 'object') return snapshot.after;
  if (snapshot.before && typeof snapshot.before === 'object') return snapshot.before;
  return snapshot;
}

function expandApprovalAuditItems(item) {
  const snapshot = item?.recordSnapshot;
  if (!snapshot || !Array.isArray(snapshot.records) || !snapshot.records.length) return [item];
  return snapshot.records.map((recordSnapshot, index) => ({
    ...item,
    id: `${item?.id || 'item'}:audit-${index + 1}`,
    recordId: recordSnapshot?.after?.id || recordSnapshot?.id || item?.recordId || String(index + 1),
    recordLabel: recordSnapshot?.after?.name || recordSnapshot?.name || item?.recordLabel || `سجل ${index + 1}`,
    recordSnapshot
  }));
}
function describeApprovalRecord(request, item) {
  const snapshot = getApprovalSnapshot(request, item);
  const identity = extractRecordIdentity(request?.programKey, snapshot, item?.recordId || request?.recordId);
  const parts = [];
  if (identity.name) parts.push(identity.name);
  if (identity.identifier?.value) parts.push(`${identity.identifier.label}: ${identity.identifier.value}`);
  return parts.join(' — ') || item?.recordLabel || request?.recordLabel || 'سجل';
}

function emitApprovalActivity(eventType, user, request, item, extraDetails = {}) {
  if (typeof activityLogger !== 'function' || !user || !request) return;
  try {
    const actorName = user.displayName || user.username || 'مستخدم';
    const action = normalizeApprovalAction(item?.action || item?.operation?.action || request.action);
    const recordText = describeApprovalRecord(request, item);
    const verb = eventType === 'approval:requested'
      ? 'طلب'
      : eventType === 'approval:approved'
        ? 'اعتمد'
        : 'رفض';
    const details = {
      requestId: request.id,
      itemId: item?.id || '',
      action,
      requestedBy: request.requester?.displayName || request.requester?.username || '',
      reviewer: request.reviewer?.displayName || request.reviewer?.username || '',
      recordLabel: recordText,
      ...extraDetails
    };
    const snapshot = item?.recordSnapshot ?? request.recordSnapshot;
    if (action === 'edit' && snapshot?.before && snapshot?.after) {
      details.changes = diffActivityRecords(snapshot.before, snapshot.after);
    }
    activityLogger({
      user,
      source: 'server',
      eventType,
      message: `${actorName} ${verb} ${getApprovalActionLabel(action)} في ${request.programName}: ${recordText}`,
      context: {
        programKey: request.programKey,
        programName: request.programName,
        pageName: request.programName,
        path: '/api/delete-approvals'
      },
      details
    });
  } catch (error) {
    console.warn('Failed to append approval activity:', error?.message || error);
  }
}

function emitApprovalRequestActivity(request) {
  const items = ensureRequestItems(request);
  items.flatMap(expandApprovalAuditItems).forEach((item) => emitApprovalActivity('approval:requested', request.requester, request, item));
}

function emitApprovedMutationActivity(request, item, reviewer) {
  if (typeof activityLogger !== 'function' || !request?.requester) return;
  try {
    const action = normalizeApprovalAction(item?.action || item?.operation?.action || request.action);
    const snapshot = item?.recordSnapshot ?? request.recordSnapshot ?? {};
    const before = snapshot?.before || (action === 'delete' ? getApprovalSnapshot(request, item) : undefined);
    const after = snapshot?.after || (action === 'add' ? getApprovalSnapshot(request, item) : getApprovalSnapshot(request, item));
    const built = buildRecordActivity({
      action,
      actorName: request.requester.displayName || request.requester.username || 'مستخدم',
      programKey: request.programKey,
      programName: request.programName,
      recordId: item?.recordId || request.recordId,
      record: getApprovalSnapshot(request, item),
      before,
      after
    });
    activityLogger({
      user: request.requester,
      source: 'server',
      eventType: built.eventType,
      message: `${built.message} — بعد اعتماد ${reviewer?.displayName || reviewer?.username || 'المراجع'}`,
      context: {
        programKey: request.programKey,
        programName: request.programName,
        pageName: request.programName,
        path: '/api/delete-approvals'
      },
      details: {
        ...built.details,
        requestId: request.id,
        approvedBy: reviewer?.displayName || reviewer?.username || ''
      }
    });
  } catch (error) {
    console.warn('Failed to append approved mutation activity:', error?.message || error);
  }
}
function normalizeRoleValue(value) {
  const normalized = String(value || USER_ROLE).trim().toLowerCase();
  if (normalized === ADMIN_ROLE) return ADMIN_ROLE;
  if (
    normalized === SUPERSECRETARY_ROLE
    || normalized === 'super-secretary'
    || normalized === 'super_secretary'
    || normalized === 'سيكرتير اول'
    || normalized === 'سيكرتير أول'
    || normalized === 'سكرتير اول'
    || normalized === 'سكرتير أول'
  ) return SUPERSECRETARY_ROLE;
  if (normalized === SECRETARY_ROLE) return SECRETARY_ROLE;
  return USER_ROLE;
}

function isDeleteApprovalRequired(req) {
  return isActionApprovalRequired(req, { action: 'delete' });
}

function canReviewDeleteApprovals(user) {
  const role = normalizeRoleValue(user?.role);
  return role === ADMIN_ROLE || role === SUPERSECRETARY_ROLE;
}

function normalizeApprovalAction(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'create' || normalized === 'insert' || normalized === 'new') return 'add';
  if (normalized === 'update' || normalized === 'modify') return 'edit';
  if (normalized === 'remove') return 'delete';
  return APPROVAL_ACTIONS.includes(normalized) ? normalized : 'delete';
}

function normalizeApprovalProgramKey(value) {
  const key = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(PROGRAM_NAMES, key) ? key : '';
}

function inferProgramKeyFromRequest(req, fallback = '') {
  const explicit = normalizeApprovalProgramKey(fallback);
  if (explicit) return explicit;

  const candidates = [
    req?.baseUrl,
    req?.originalUrl,
    req?.url,
    req?.path
  ].map((value) => String(value || '').trim().toLowerCase());

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate.includes('/api/weapons') || candidate.startsWith('/weapons')) return 'weapons';
    if (candidate.includes('/api/renewal') || candidate.includes('/api/renewal2') || candidate.startsWith('/renewal')) return 'renewal';
    if (candidate.includes('/api/report') || candidate.startsWith('/report')) return 'report';
    if (candidate.includes('/api/accept') || candidate.startsWith('/accept')) return 'accept';
    if (candidate.includes('/api/request') || candidate.startsWith('/request')) return 'request';
    if (candidate.includes('/api/seized') || candidate.startsWith('/seized')) return 'seized';
    if (candidate.includes('/api/storage') || candidate.startsWith('/storage')) return 'storage';
    if (candidate.includes('/company/api') || candidate.includes('/api/companies') || candidate.startsWith('/company')) return 'company';
  }

  return '';
}

function createDefaultActionApprovalPolicy() {
  const programs = {};
  Object.keys(PROGRAM_NAMES).forEach((programKey) => {
    programs[programKey] = {
      label: PROGRAM_NAMES[programKey],
      actions: { ...DEFAULT_ACTION_POLICY }
    };
  });
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    programs
  };
}

function normalizeActionApprovalPolicy(policy) {
  const source = policy && typeof policy === 'object' ? policy : {};
  const rawPrograms = source.programs && typeof source.programs === 'object' ? source.programs : source;
  const programs = {};

  Object.keys(PROGRAM_NAMES).forEach((programKey) => {
    const rawProgram = rawPrograms && typeof rawPrograms === 'object' ? rawPrograms[programKey] : null;
    const rawActions = rawProgram && typeof rawProgram === 'object' && rawProgram.actions && typeof rawProgram.actions === 'object'
      ? rawProgram.actions
      : (rawProgram && typeof rawProgram === 'object' ? rawProgram : {});
    const actions = {};
    APPROVAL_ACTIONS.forEach((action) => {
      actions[action] = Object.prototype.hasOwnProperty.call(rawActions, action)
        ? Boolean(rawActions[action])
        : DEFAULT_ACTION_POLICY[action];
    });
    programs[programKey] = {
      label: PROGRAM_NAMES[programKey],
      actions
    };
  });

  return {
    version: 1,
    updatedAt: String(source.updatedAt || new Date().toISOString()),
    programs
  };
}

function ensureActionApprovalPolicy() {
  const fallback = createDefaultActionApprovalPolicy();
  if (!fs.existsSync(ACTION_APPROVAL_POLICY_FILE)) {
    fs.mkdirSync(path.dirname(ACTION_APPROVAL_POLICY_FILE), { recursive: true });
    fs.writeFileSync(ACTION_APPROVAL_POLICY_FILE, JSON.stringify(fallback, null, 2), 'utf8');
    clearFileCache(ACTION_APPROVAL_POLICY_FILE);
    return fallback;
  }

  try {
    const parsed = readJsonCached(ACTION_APPROVAL_POLICY_FILE, fallback);
    const normalized = normalizeActionApprovalPolicy(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      fs.writeFileSync(ACTION_APPROVAL_POLICY_FILE, JSON.stringify(normalized, null, 2), 'utf8');
      clearFileCache(ACTION_APPROVAL_POLICY_FILE);
    }
    return normalized;
  } catch (_) {
    fs.writeFileSync(ACTION_APPROVAL_POLICY_FILE, JSON.stringify(fallback, null, 2), 'utf8');
    clearFileCache(ACTION_APPROVAL_POLICY_FILE);
    return fallback;
  }
}

function loadActionApprovalPolicy() {
  return ensureActionApprovalPolicy();
}

function saveActionApprovalPolicy(policy) {
  const normalized = normalizeActionApprovalPolicy({
    ...(policy && typeof policy === 'object' ? policy : {}),
    updatedAt: new Date().toISOString()
  });
  fs.mkdirSync(path.dirname(ACTION_APPROVAL_POLICY_FILE), { recursive: true });
  fs.writeFileSync(ACTION_APPROVAL_POLICY_FILE, JSON.stringify(normalized, null, 2), 'utf8');
  clearFileCache(ACTION_APPROVAL_POLICY_FILE);
  return normalized;
}

function isActionApprovalRequired(req, options = {}) {
  const user = req?.portalAuth?.user || req?.portalUser || null;
  if (normalizeRoleValue(user?.role) !== USER_ROLE) return false;
  const action = normalizeApprovalAction(options.action || options.type);
  const programKey = inferProgramKeyFromRequest(req, options.programKey || options.program);
  if (!programKey) return false;
  const policy = loadActionApprovalPolicy();
  return Boolean(policy.programs?.[programKey]?.actions?.[action]);
}

function getApprovalActionLabel(action) {
  return ACTION_LABELS[normalizeApprovalAction(action)] || ACTION_LABELS.delete;
}

function getApprovalRequiredMessage(action) {
  const label = getApprovalActionLabel(action);
  if (normalizeApprovalAction(action) === 'delete') {
    return 'تم إرسال طلب الحذف إلى المدير والسيكرتير الأول لاعتماده.';
  }
  return `تم إرسال طلب ${label} إلى المدير والسيكرتير الأول لاعتماده.`;
}

function sanitizeUser(user) {
  if (!user || typeof user !== 'object') {
    return { username: '', displayName: '', role: USER_ROLE };
  }
  return {
    username: String(user.username || '').trim(),
    displayName: String(user.displayName || user.username || '').trim(),
    role: normalizeRoleValue(user.role)
  };
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`
  );
  let handle = null;
  try {
    handle = fs.openSync(tempPath, 'wx');
    fs.writeFileSync(handle, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.fsyncSync(handle);
    fs.closeSync(handle);
    handle = null;
    fs.renameSync(tempPath, filePath);
    const destination = fs.openSync(filePath, 'r+');
    try {
      fs.fsyncSync(destination);
    } finally {
      fs.closeSync(destination);
    }
    let directoryHandle = null;
    try {
      directoryHandle = fs.openSync(path.dirname(filePath), 'r');
      fs.fsyncSync(directoryHandle);
    } catch (directoryError) {
      if (!['EACCES', 'EINVAL', 'EISDIR', 'ENOTSUP', 'EPERM'].includes(directoryError?.code)) throw directoryError;
    } finally {
      if (directoryHandle !== null) fs.closeSync(directoryHandle);
    }
  } catch (error) {
    if (handle !== null) {
      try { fs.closeSync(handle); } catch (_) {}
    }
    try { fs.unlinkSync(tempPath); } catch (_) {}
    throw error;
  }
}

function ensureApprovalStore() {
  if (fs.existsSync(APPROVALS_FILE)) return;
  writeJsonAtomic(APPROVALS_FILE, {
    version: 1,
    updatedAt: new Date().toISOString(),
    requests: []
  });
  clearFileCache(APPROVALS_FILE);
}

function readApprovalStore() {
  ensureApprovalStore();
  const parsed = readJsonCached(APPROVALS_FILE, null);
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.requests)) {
    return {
      version: Number(parsed.version) || 1,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      requests: parsed.requests.filter((entry) => entry && typeof entry === 'object')
    };
  }
  if (Array.isArray(parsed)) {
    return { version: 1, updatedAt: new Date().toISOString(), requests: parsed };
  }
  return { version: 1, updatedAt: new Date().toISOString(), requests: [] };
}

function writeApprovalStore(store) {
  const next = {
    version: Number(store?.version) || 1,
    updatedAt: new Date().toISOString(),
    requests: Array.isArray(store?.requests) ? store.requests : []
  };
  writeJsonAtomic(APPROVALS_FILE, next);
  clearFileCache(APPROVALS_FILE);
  return next;
}

function stableStringify(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function createApprovalId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `delete-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
}

function normalizeApprovalDecisionStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'approved') return 'approved';
  if (normalized === 'denied') return 'denied';
  if (normalized === 'failed') return 'failed';
  if (normalized === 'partial') return 'partial';
  return 'pending';
}

function normalizeExecutionClaim(value) {
  if (!value || typeof value !== 'object') return null;
  const id = String(value.id || '').trim();
  const state = String(value.state || '').trim().toLowerCase();
  if (!id || !['executing', 'completed', 'failed'].includes(state)) return null;
  return {
    id,
    state,
    processInstanceId: String(value.processInstanceId || '').trim(),
    reviewer: sanitizeUser(value.reviewer),
    claimedAt: value.claimedAt || null,
    completedAt: value.completedAt || null,
    reauthenticatedAt: value.reauthenticatedAt || null,
    previousClaimId: value.previousClaimId ? String(value.previousClaimId) : null
  };
}

function cloneJson(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch (_) {
    return fallback;
  }
}

function buildApprovalItem(rawItem, context = {}) {
  const now = context.now || new Date().toISOString();
  const programKey = String(context.programKey || rawItem?.programKey || '').trim().toLowerCase();
  const action = normalizeApprovalAction(context.action || rawItem?.action || rawItem?.operation?.action);
  const operation = cloneJson(rawItem?.operation || {}, {});
  const operationWithProgram = {
    ...operation,
    programKey: String(operation.programKey || programKey).trim().toLowerCase(),
    action: normalizeApprovalAction(operation.action || action)
  };
  const recordId = rawItem?.recordId ?? rawItem?.id ?? operationWithProgram.id ?? operationWithProgram.recordId
    ?? (Array.isArray(operationWithProgram.ids) && operationWithProgram.ids.length === 1 ? operationWithProgram.ids[0] : '');
  const snapshot = cloneJson(rawItem?.recordSnapshot || rawItem?.snapshot || {}, {});
  const fallbackLabel = recordId || (context.index != null ? `سجل ${Number(context.index) + 1}` : 'سجل');
  return {
    id: String(rawItem?.id || createApprovalId()),
    status: normalizeApprovalDecisionStatus(rawItem?.status),
    recordId: recordId == null ? '' : String(recordId),
    recordLabel: String(rawItem?.recordLabel || rawItem?.label || fallbackLabel),
    recordSnapshot: snapshot,
    attachments: cloneJson(Array.isArray(rawItem?.attachments) ? rawItem.attachments : [], []),
    action,
    operation: operationWithProgram,
    createdAt: rawItem?.createdAt || now,
    updatedAt: rawItem?.updatedAt || now,
    decidedAt: rawItem?.decidedAt || null,
    reviewer: rawItem?.reviewer || null,
    execution: rawItem?.execution || null,
    executionClaim: normalizeExecutionClaim(rawItem?.executionClaim),
    error: rawItem?.error || null
  };
}

function buildApprovalItems(details, context = {}) {
  const rawItems = Array.isArray(details?.items) ? details.items : [];
  if (rawItems.length) {
    return rawItems.map((item, index) => buildApprovalItem(item, { ...context, index }));
  }
  return [buildApprovalItem({
    recordId: details?.recordId,
    recordLabel: details?.recordLabel,
    recordSnapshot: details?.recordSnapshot,
    attachments: details?.attachments,
    operation: details?.operation,
    status: details?.status
  }, { ...context, index: 0 })];
}

function ensureRequestItems(request) {
  if (!request || typeof request !== 'object') return [];
  const programKey = String(request.programKey || request.operation?.programKey || '').trim().toLowerCase();
  const action = normalizeApprovalAction(request.action || request.operation?.action || request.type);
  const now = request.createdAt || request.updatedAt || new Date().toISOString();
  if (!Array.isArray(request.items) || !request.items.length) {
    request.items = [buildApprovalItem({
      id: `${String(request.id || 'request')}:item-1`,
      status: request.status || 'pending',
      recordId: request.recordId,
      recordLabel: request.recordLabel,
      recordSnapshot: request.recordSnapshot,
      attachments: request.attachments,
      action,
      operation: request.operation,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      decidedAt: request.decidedAt,
      reviewer: request.reviewer,
      execution: request.execution,
      error: request.error
    }, { programKey, action, now, index: 0 })];
    return request.items;
  }
  request.items = request.items.map((item, index) => buildApprovalItem({
    ...item,
    id: item?.id || `${String(request.id || 'request')}:item-${index + 1}`
  }, { programKey, action, now, index }));
  return request.items;
}

function isApprovalRequestPending(request) {
  if (!request || typeof request !== 'object') return false;
  if (request.status === 'pending') return true;
  return ensureRequestItems(request).some((item) => item.status === 'pending');
}

function finalizeRequestStatusFromItems(request, reviewer = null) {
  const items = ensureRequestItems(request);
  const now = new Date().toISOString();
  if (!items.length) {
    request.status = normalizeApprovalDecisionStatus(request.status);
    request.updatedAt = now;
    return request;
  }
  if (items.some((item) => item.status === 'pending')) {
    request.status = 'pending';
    request.updatedAt = now;
    request.execution = items.map((item) => ({ itemId: item.id, status: item.status, execution: item.execution || null, error: item.error || null }));
    if (reviewer) request.reviewer = reviewer;
    return request;
  }
  if (items.every((item) => item.status === 'approved')) {
    request.status = 'approved';
  } else if (items.every((item) => item.status === 'denied')) {
    request.status = 'denied';
  } else if (items.every((item) => item.status === 'failed')) {
    request.status = 'failed';
  } else {
    request.status = 'partial';
  }
  request.reviewer = reviewer || request.reviewer;
  request.execution = items.map((item) => ({ itemId: item.id, status: item.status, execution: item.execution || null, error: item.error || null }));
  request.decidedAt = now;
  request.updatedAt = now;
  return request;
}

function buildDedupeKey(requester, details) {
  const operation = details.operation || {};
  const programKey = String(details.programKey || operation.programKey || '').trim().toLowerCase();
  const action = normalizeApprovalAction(details.action || operation.action || operation.type);
  const recordIdentity = details.recordId || details.recordIdentity || operation.id || operation.recordId || operation.ids || operation.rows || operation.records || '';
  return [
    requester.username,
    programKey,
    action,
    String(operation.type || `${action}-record`).trim(),
    stableStringify(recordIdentity)
  ].join('|');
}

function createDeleteApprovalRequest(req, details = {}) {
  const requester = sanitizeUser(req?.portalAuth?.user || req?.portalUser || null);
  if (!requester.username) {
    const error = new Error('Authenticated user is required for delete approval requests.');
    error.status = 401;
    throw error;
  }

  const operation = cloneJson(details.operation || {}, {});
  const programKey = String(details.programKey || operation.programKey || '').trim().toLowerCase();
  const action = normalizeApprovalAction(details.action || operation.action || operation.type);
  const now = new Date().toISOString();
  const operationWithAction = { ...operation, action };
  const dedupeKey = details.dedupeKey || buildDedupeKey(requester, { ...details, programKey, action, operation: operationWithAction });
  const store = readApprovalStore();
  const existing = store.requests.find((entry) => isApprovalRequestPending(entry) && entry.dedupeKey === dedupeKey);
  if (existing) return { created: false, request: existing };

  const items = buildApprovalItems({ ...details, operation: operationWithAction }, { programKey, action, now });
  const itemAttachments = items.flatMap((item) => Array.isArray(item.attachments) ? item.attachments : []);
  const attachments = Array.isArray(details.attachments) && details.attachments.length
    ? cloneJson(details.attachments, [])
    : cloneJson(itemAttachments, []);
  const recordSnapshot = details.recordSnapshot !== undefined
    ? cloneJson(details.recordSnapshot || {}, {})
    : (items.length === 1 ? cloneJson(items[0].recordSnapshot || {}, {}) : { records: items.map((item) => item.recordSnapshot || {}) });

  const request = {
    id: createApprovalId(),
    type: action === 'delete' ? 'delete-record' : `${action}-record`,
    action,
    actionLabel: getApprovalActionLabel(action),
    status: 'pending',
    requester,
    programKey,
    programName: String(details.programName || PROGRAM_NAMES[programKey] || programKey || 'برنامج غير محدد'),
    recordId: details.recordId == null ? '' : String(details.recordId),
    recordLabel: String(details.recordLabel || details.recordId || 'سجل'),
    recordSnapshot,
    attachments,
    items,
    operation: { ...operationWithAction, programKey },
    dedupeKey,
    createdAt: now,
    updatedAt: now,
    decidedAt: null,
    reviewer: null,
    execution: null,
    requesterDismissedAt: null
  };

  store.requests.unshift(request);
  writeApprovalStore(store);
  emitApprovalRequestActivity(request);
  return { created: true, request };
}

function listPendingDeleteApprovals() {
  const store = readApprovalStore();
  return store.requests
    .filter((entry) => isApprovalRequestPending(entry))
    .sort((left, right) => String(left.createdAt || '').localeCompare(String(right.createdAt || '')))
    .map(hydrateWeaponsApprovalRequestSnapshots);
}

function sameRequester(request, user) {
  const requester = sanitizeUser(user);
  const requestUsername = String(request?.requester?.username || '').trim().toLowerCase();
  return Boolean(requestUsername && requester.username && requestUsername === requester.username.toLowerCase());
}

function listRequesterDeleteApprovals(user, options = {}) {
  const requester = sanitizeUser(user);
  if (!requester.username) {
    const error = new Error('يرجى تسجيل الدخول مرة أخرى');
    error.status = 401;
    throw error;
  }
  const includeDismissed = Boolean(options.includeDismissed);
  const store = readApprovalStore();
  return store.requests
    .filter((entry) => entry && sameRequester(entry, requester))
    .filter((entry) => includeDismissed || !entry.requesterDismissedAt)
    .sort((left, right) => String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || '')))
    .map(hydrateWeaponsApprovalRequestSnapshots);
}

function getRequesterOwnedRequest(store, id, user) {
  const index = findRequestIndex(store, id);
  if (index === -1) {
    const error = new Error('طلب الحذف غير موجود');
    error.status = 404;
    throw error;
  }
  const request = store.requests[index];
  if (!sameRequester(request, user)) {
    const error = new Error('صلاحيات غير كافية');
    error.status = 403;
    throw error;
  }
  return { request, index };
}

function dismissRequesterDeleteApproval(id, user) {
  const store = readApprovalStore();
  const { request, index } = getRequesterOwnedRequest(store, id, user);
  request.requesterDismissedAt = new Date().toISOString();
  request.updatedAt = request.requesterDismissedAt;
  store.requests[index] = request;
  writeApprovalStore(store);
  return { request };
}

function resubmitDeleteApproval(id, user) {
  const store = readApprovalStore();
  const { request, index } = getRequesterOwnedRequest(store, id, user);
  if (request.status !== 'denied' && request.status !== 'failed' && request.status !== 'partial') {
    const error = new Error('يمكن إعادة إرسال الطلبات المرفوضة فقط');
    error.status = 400;
    throw error;
  }
  const now = new Date().toISOString();
  ensureRequestItems(request).forEach((item) => {
    if (item.status !== 'approved') {
      item.status = 'pending';
      item.updatedAt = now;
      item.decidedAt = null;
      item.reviewer = null;
      item.execution = null;
      item.executionClaim = null;
      item.error = null;
    }
  });
  request.status = 'pending';
  request.createdAt = now;
  request.updatedAt = now;
  request.decidedAt = null;
  request.reviewer = null;
  request.execution = null;
  request.error = null;
  request.requesterDismissedAt = null;
  request.resubmittedAt = now;
  store.requests[index] = request;
  writeApprovalStore(store);
  return { request };
}

function readJsonArray(filePath) {
  try {
    const parsed = readJsonCached(filePath, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeJsonArray(filePath, records) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(Array.isArray(records) ? records : [], null, 2), 'utf8');
  clearFileCache(filePath);
}

function executeRequestDelete(operation) {
  const recordId = String(operation.id || operation.recordId || '').trim();
  if (!recordId) {
    const error = new Error('Request delete operation is missing record id.');
    error.status = 400;
    throw error;
  }

  const requestsFile = dataFile('Request', 'requests.json', [
    path.join(PROGRAM_ROOT, 'Request', 'data', 'requests.json')
  ]);
  const tmpDir = dataSubdir('Request', 'tmp', {
    legacyDirs: [path.join(PROGRAM_ROOT, 'Request', 'tmp')]
  });
  const undoFile = path.join(tmpDir, 'undo.json');
  const requests = readJsonArray(requestsFile);
  const index = requests.findIndex((record) => String(record?.id) === recordId);
  if (index === -1) {
    const error = new Error('تعذر العثور على السجل المطلوب حذفه.');
    error.status = 404;
    throw error;
  }

  const [deletedRecord] = requests.splice(index, 1);
  const deletedWithMeta = {
    ...deletedRecord,
    deletedAt: new Date().toISOString()
  };
  const undoRecords = readJsonArray(undoFile);
  undoRecords.unshift(deletedWithMeta);

  writeJsonArray(requestsFile, requests);
  writeJsonArray(undoFile, undoRecords);

  return { deleted: 1, deletedRecord: deletedWithMeta };
}

function registerDeleteApprovalExecutor(type, executor) {
  const key = String(type || '').trim();
  if (!key || typeof executor !== 'function') return false;
  DELETE_EXECUTORS.set(key, executor);
  return true;
}

function getDeleteExecutorModulePath(operation) {
  const operationType = String(operation?.type || '').trim();
  if (DELETE_EXECUTOR_TYPES[operationType]) {
    return DELETE_EXECUTOR_TYPES[operationType];
  }
  const programKey = String(
    operation?.programKey || operationType.split('.')[0] || ''
  ).trim().toLowerCase();
  return DELETE_EXECUTOR_MODULES[programKey] || '';
}

function loadRegisteredDeleteExecutor(operation) {
  const operationType = String(operation?.type || '').trim();
  if (!operationType) return null;

  const registered = DELETE_EXECUTORS.get(operationType);
  if (registered) return registered;

  const modulePath = getDeleteExecutorModulePath(operation);
  if (!modulePath) return null;

  const attemptKey = `${operationType}:${modulePath}`;
  if (!deleteExecutorModuleLoadAttempts.has(attemptKey)) {
    deleteExecutorModuleLoadAttempts.add(attemptKey);
    try {
      if (fs.existsSync(modulePath)) {
        const exported = require(modulePath);
        const initializeModule = DELETE_EXECUTOR_MODULE_INITIALIZERS[modulePath];
        if (typeof initializeModule === 'function') {
          initializeModule(exported);
        }
      }
    } catch (error) {
      console.warn(`Failed to load delete approval executor for ${operationType}:`, error.message);
    }
  }

  return DELETE_EXECUTORS.get(operationType) || null;
}

async function executeDeleteOperation(request, operationOverride = null, executionContext = {}) {
  const operation = operationOverride || request?.operation || {};
  const registered = loadRegisteredDeleteExecutor(operation);
  if (registered) {
    return registered(operation, request, executionContext);
  }

  switch (operation.type) {
    case 'request.delete':
      return executeRequestDelete(operation);
    default: {
      const error = new Error(`Unsupported approval operation: ${operation.type || 'unknown'}`);
      error.status = 400;
      throw error;
    }
  }
}

async function withApprovalExecutionLock(requestId, operation) {
  const key = String(requestId || '').trim();
  if (!key) {
    const error = new Error('معرّف طلب الاعتماد غير صالح');
    error.status = 400;
    throw error;
  }
  if (APPROVAL_EXECUTION_LOCKS.has(key)) {
    const error = new Error('يجري تنفيذ قرار آخر لهذا الطلب الآن');
    error.status = 409;
    error.code = 'APPROVAL_EXECUTION_BUSY';
    throw error;
  }
  APPROVAL_EXECUTION_LOCKS.add(key);
  try {
    return await operation();
  } finally {
    APPROVAL_EXECUTION_LOCKS.delete(key);
  }
}

function findRequestIndex(store, id) {
  const requestId = String(id || '').trim();
  return store.requests.findIndex((entry) => String(entry?.id) === requestId);
}

function findApprovalItem(request, itemId) {
  const targetId = String(itemId || '').trim();
  return ensureRequestItems(request).find((item) => String(item?.id || '') === targetId) || null;
}

function createApprovalExecutionClaim(reviewer, executionContext = {}, previousClaim = null) {
  const claimedAt = new Date().toISOString();
  return {
    id: createApprovalId(),
    state: 'executing',
    processInstanceId: APPROVAL_PROCESS_INSTANCE_ID,
    reviewer,
    claimedAt,
    completedAt: null,
    previousClaimId: previousClaim?.id || null
  };
}

function createApprovalRecoveryError() {
  const error = new Error('تعذر تغيير القرار لأن تنفيذًا سابقًا يحتاج إلى مراجعة أو استكمال.');
  error.status = 409;
  error.code = 'APPROVAL_RECOVERY_REQUIRED';
  return error;
}

function claimApprovalItemForExecution(id, itemId, reviewerUser, executionContext = {}) {
  const reviewer = sanitizeUser(reviewerUser);
  if (!canReviewDeleteApprovals(reviewer)) {
    const error = new Error('صلاحيات غير كافية');
    error.status = 403;
    throw error;
  }

  const store = readApprovalStore();
  const index = findRequestIndex(store, id);
  if (index === -1) {
    const error = new Error('طلب الحذف غير موجود');
    error.status = 404;
    throw error;
  }

  const request = store.requests[index];
  const items = ensureRequestItems(request);
  const targetItem = itemId == null
    ? items.find((item) => item.status === 'pending')
    : findApprovalItem(request, itemId);
  if (!targetItem) {
    if (itemId != null) {
      const error = new Error('السجل المطلوب داخل طلب الحذف غير موجود');
      error.status = 404;
      throw error;
    }
    return { request, item: null, stale: true };
  }
  if (targetItem.status !== 'pending') {
    return { request, item: targetItem, stale: true };
  }

  const previousClaim = normalizeExecutionClaim(targetItem.executionClaim);
  if (previousClaim?.state === 'executing') {
    throw createApprovalRecoveryError();
  }

  const claim = createApprovalExecutionClaim(reviewer, executionContext, previousClaim);
  targetItem.executionClaim = claim;
  targetItem.updatedAt = claim.claimedAt;
  request.updatedAt = claim.claimedAt;
  request.reviewer = reviewer;
  store.requests[index] = request;
  writeApprovalStore(store);
  return {
    request: cloneJson(request, {}),
    item: cloneJson(targetItem, {}),
    claim,
    stale: false
  };
}

function settleClaimedApprovalItem(id, itemId, claimId, reviewerUser, outcome = {}) {
  const reviewer = sanitizeUser(reviewerUser);
  const store = readApprovalStore();
  const index = findRequestIndex(store, id);
  if (index === -1) {
    const error = new Error('طلب الحذف غير موجود');
    error.status = 404;
    throw error;
  }

  const request = store.requests[index];
  const item = findApprovalItem(request, itemId);
  if (!item) {
    const error = new Error('السجل المطلوب داخل طلب الحذف غير موجود');
    error.status = 404;
    throw error;
  }
  const persistedClaim = normalizeExecutionClaim(item.executionClaim);
  if (item.status !== 'pending' || persistedClaim?.id !== String(claimId || '')) {
    throw createApprovalRecoveryError();
  }

  const now = new Date().toISOString();
  const approved = outcome.status === 'approved';
  item.status = approved ? 'approved' : 'failed';
  item.execution = approved ? (outcome.execution ?? null) : null;
  item.error = approved ? null : String(outcome.error || 'تعذر تنفيذ الحذف.');
  item.reviewer = reviewer;
  item.decidedAt = now;
  item.updatedAt = now;
  item.executionClaim = {
    ...persistedClaim,
    state: approved ? 'completed' : 'failed',
    completedAt: now
  };
  if (!approved) {
    request.error = item.error;
  }
  finalizeRequestStatusFromItems(request, reviewer);
  if (request.status === 'approved') request.error = null;
  store.requests[index] = request;
  writeApprovalStore(store);
  return { request, item };
}

async function executeClaimedApprovalItem(claimed, reviewerUser, executionContext = {}) {
  let execution;
  try {
    execution = await executeDeleteOperation(
      claimed.request,
      claimed.item.operation,
      { ...executionContext, reviewer: reviewerUser }
    );
  } catch (error) {
    settleClaimedApprovalItem(
      claimed.request.id,
      claimed.item.id,
      claimed.claim.id,
      reviewerUser,
      { status: 'failed', error: error.message || 'تعذر تنفيذ الحذف.' }
    );
    throw error;
  }

  const settled = settleClaimedApprovalItem(
    claimed.request.id,
    claimed.item.id,
    claimed.claim.id,
    reviewerUser,
    { status: 'approved', execution }
  );
  const reviewer = sanitizeUser(reviewerUser);
  expandApprovalAuditItems(settled.item).forEach((auditItem) => {
    emitApprovalActivity('approval:approved', reviewer, settled.request, auditItem);
    emitApprovedMutationActivity(settled.request, auditItem, reviewer);
  });
  return settled;
}

async function approveDeleteApprovalUnlocked(id, reviewerUser, executionContext = {}) {
  let executedAny = false;
  while (true) {
    const claimed = claimApprovalItemForExecution(id, null, reviewerUser, executionContext);
    if (claimed.stale) {
      return { request: claimed.request, stale: !executedAny };
    }
    await executeClaimedApprovalItem(claimed, reviewerUser, executionContext);
    executedAny = true;
  }
}

async function approveDeleteApproval(id, reviewerUser, executionContext = {}) {
  return withApprovalExecutionLock(id, () => approveDeleteApprovalUnlocked(id, reviewerUser, executionContext));
}

async function approveDeleteApprovalItemUnlocked(id, itemId, reviewerUser, executionContext = {}) {
  const claimed = claimApprovalItemForExecution(id, itemId, reviewerUser, executionContext);
  if (claimed.stale) {
    return { request: claimed.request, item: claimed.item, stale: true };
  }
  const settled = await executeClaimedApprovalItem(claimed, reviewerUser, executionContext);
  return { ...settled, stale: false };
}

async function approveDeleteApprovalItem(id, itemId, reviewerUser, executionContext = {}) {
  return withApprovalExecutionLock(id, () => approveDeleteApprovalItemUnlocked(id, itemId, reviewerUser, executionContext));
}

function denyDeleteApprovalUnlocked(id, reviewerUser) {
  const reviewer = sanitizeUser(reviewerUser);
  if (!canReviewDeleteApprovals(reviewer)) {
    const error = new Error('صلاحيات غير كافية');
    error.status = 403;
    throw error;
  }

  const store = readApprovalStore();
  const index = findRequestIndex(store, id);
  if (index === -1) {
    const error = new Error('طلب الحذف غير موجود');
    error.status = 404;
    throw error;
  }

  const request = store.requests[index];
  const items = ensureRequestItems(request);
  const pendingItems = items.filter((item) => item.status === 'pending');
  if (!pendingItems.length) {
    return { request, stale: true };
  }
  if (pendingItems.some((item) => normalizeExecutionClaim(item.executionClaim)?.state === 'executing')) {
    throw createApprovalRecoveryError();
  }

  const now = new Date().toISOString();
  pendingItems.forEach((item) => {
    item.status = 'denied';
    item.reviewer = reviewer;
    item.decidedAt = now;
    item.updatedAt = now;
    item.error = null;
    expandApprovalAuditItems(item).forEach((auditItem) => emitApprovalActivity('approval:denied', reviewer, request, auditItem));
  });
  finalizeRequestStatusFromItems(request, reviewer);
  store.requests[index] = request;
  writeApprovalStore(store);
  return { request, stale: false };
}

async function denyDeleteApproval(id, reviewerUser) {
  return withApprovalExecutionLock(id, () => denyDeleteApprovalUnlocked(id, reviewerUser));
}

function denyDeleteApprovalItemUnlocked(id, itemId, reviewerUser) {
  const reviewer = sanitizeUser(reviewerUser);
  if (!canReviewDeleteApprovals(reviewer)) {
    const error = new Error('صلاحيات غير كافية');
    error.status = 403;
    throw error;
  }

  const store = readApprovalStore();
  const index = findRequestIndex(store, id);
  if (index === -1) {
    const error = new Error('طلب الحذف غير موجود');
    error.status = 404;
    throw error;
  }

  const request = store.requests[index];
  const item = findApprovalItem(request, itemId);
  if (!item) {
    const error = new Error('السجل المطلوب داخل طلب الحذف غير موجود');
    error.status = 404;
    throw error;
  }
  if (item.status !== 'pending') {
    return { request, item, stale: true };
  }
  if (normalizeExecutionClaim(item.executionClaim)?.state === 'executing') {
    throw createApprovalRecoveryError();
  }

  const now = new Date().toISOString();
  item.status = 'denied';
  item.reviewer = reviewer;
  item.decidedAt = now;
  item.updatedAt = now;
  item.error = null;
  emitApprovalActivity('approval:denied', reviewer, request, item);
  finalizeRequestStatusFromItems(request, reviewer);
  store.requests[index] = request;
  writeApprovalStore(store);
  return { request, item, stale: false };
}

async function denyDeleteApprovalItem(id, itemId, reviewerUser) {
  return withApprovalExecutionLock(id, () => denyDeleteApprovalItemUnlocked(id, itemId, reviewerUser));
}

module.exports = {
  ACTION_LABELS,
  configureActivityLogger,
  APPROVAL_ACTIONS,
  canReviewDeleteApprovals,
  createDeleteApprovalRequest,
  dismissRequesterDeleteApproval,
  denyDeleteApproval,
  denyDeleteApprovalItem,
  getApprovalRequiredMessage,
  isActionApprovalRequired,
  approveDeleteApproval,
  approveDeleteApprovalItem,
  loadActionApprovalPolicy,
  isDeleteApprovalRequired,
  listRequesterDeleteApprovals,
  listPendingDeleteApprovals,
  normalizeRoleValue,
  saveActionApprovalPolicy,
  resubmitDeleteApproval,
  registerDeleteApprovalExecutor
};
