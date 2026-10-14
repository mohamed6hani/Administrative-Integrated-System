const IGNORED_EDIT_FIELDS = new Set([
  'createdat',
  'created_at',
  'updatedat',
  'updated_at',
  'deletedat',
  'deleted_at',
  '__recordid',
  '__roworder',
  '__updatedat'
]);

const FIELD_LABELS = {
  id: 'المعرف',
  recordid: 'معرف السجل',
  name: 'الاسم',
  fullname: 'الاسم',
  requestername: 'الاسم',
  company_name: 'اسم الشركة',
  companyname: 'اسم الشركة',
  license: 'رقم الرخصة',
  licensenumber: 'رقم الرخصة',
  license_number: 'رقم الرخصة',
  decisionnumber: 'رقم القرار',
  decision_number: 'رقم القرار'
};

const PROGRAM_ACTIONS = {
  add: 'أضاف',
  edit: 'عدّل',
  delete: 'حذف'
};

function cleanText(value, maxLength = 500) {
  const text = String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, maxLength);
}

function normalizeFieldKey(value) {
  return cleanText(value, 120)
    .replace(/[\s_-]+/g, '')
    .toLowerCase();
}

function getFieldLabel(field) {
  const raw = cleanText(field, 120);
  if (!raw) return 'حقل';
  if (/[\u0600-\u06ff]/.test(raw)) return raw;
  return FIELD_LABELS[raw.toLowerCase()] || FIELD_LABELS[normalizeFieldKey(raw)] || raw;
}

function displayValue(value) {
  if (value == null) return '';
  if (Array.isArray(value) || typeof value === 'object') {
    try {
      return cleanText(JSON.stringify(value), 500);
    } catch {
      return '';
    }
  }
  return cleanText(value, 500);
}

function comparableValue(value) {
  if (value == null) return '';
  if (Array.isArray(value) || typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value).trim();
}

function diffActivityRecords(before, after) {
  const left = before && typeof before === 'object' && !Array.isArray(before) ? before : {};
  const right = after && typeof after === 'object' && !Array.isArray(after) ? after : {};
  const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)]));
  return keys
    .filter((field) => !IGNORED_EDIT_FIELDS.has(normalizeFieldKey(field)))
    .filter((field) => comparableValue(left[field]) !== comparableValue(right[field]))
    .map((field) => ({
      field,
      label: getFieldLabel(field),
      before: displayValue(left[field]),
      after: displayValue(right[field])
    }));
}

function pickValue(record, candidates) {
  const source = record && typeof record === 'object' ? record : {};
  for (const key of candidates) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const value = cleanText(source[key], 220);
    if (value) return value;
  }
  const normalizedCandidates = new Set(candidates.map(normalizeFieldKey));
  for (const [key, rawValue] of Object.entries(source)) {
    if (!normalizedCandidates.has(normalizeFieldKey(key))) continue;
    const value = cleanText(rawValue, 220);
    if (value) return value;
  }
  return '';
}

function extractRecordIdentity(programKey, record, fallbackId) {
  const source = record && typeof record === 'object' ? record : {};
  const name = pickValue(source, [
    'الاسم',
    'الاســـــــم',
    'اسم',
    'name',
    'fullName',
    'requesterName',
    'company_name',
    'companyName',
    'اسم الشركة'
  ]);
  const license = pickValue(source, [
    'رقم الرخصة',
    'رقم الترخيص',
    'رقم القيد',
    'رقم',
    'license',
    'licenseNumber',
    'license_number'
  ]);
  const decision = programKey === 'report'
    ? pickValue(source, ['رقم القرار', 'decisionNumber', 'decision_number', 'id'])
    : '';
  const recordId = pickValue(source, [
    '__recordId',
    'recordId',
    'record_id',
    'id',
    'uniqueId',
    'unique_id'
  ]) || cleanText(fallbackId, 220);
  const identifier = license
    ? { label: 'رقم الرخصة', value: license }
    : decision
      ? { label: 'رقم القرار', value: decision }
      : recordId
        ? { label: 'المعرف', value: recordId }
        : null;
  return { name, identifier };
}

function describeIdentity(identity) {
  const parts = [];
  if (identity && identity.name) parts.push(identity.name);
  if (identity && identity.identifier && identity.identifier.value) {
    parts.push(`${identity.identifier.label}: ${identity.identifier.value}`);
  }
  return parts.join(' — ') || 'سجل';
}

function buildRecordActivity(options = {}) {
  const action = String(options.action || '').trim().toLowerCase();
  const programKey = String(options.programKey || '').trim().toLowerCase();
  const programName = cleanText(options.programName || programKey || 'البرنامج', 160);
  const actorName = cleanText(options.actorName || 'مستخدم', 120);
  const record = options.record || options.after || options.before || {};
  const identity = extractRecordIdentity(programKey, record, options.recordId);
  const details = {
    action,
    recordName: identity.name,
    identifierLabel: identity.identifier ? identity.identifier.label : '',
    identifierValue: identity.identifier ? identity.identifier.value : ''
  };

  if (action === 'edit') {
    const changes = diffActivityRecords(options.before, options.after);
    details.changes = changes;
    const changesText = changes.length
      ? changes.map((change) => `${change.label}: ${change.before || '—'} ← ${change.after || '—'}`).join('، ')
      : 'لم تتغير قيم الحقول';
    return {
      eventType: 'data:edit',
      message: `${actorName} عدّل في ${programName}: ${describeIdentity(identity)} — ${changesText}`,
      details
    };
  }

  return {
    eventType: action === 'delete' ? 'data:delete' : 'data:add',
    message: `${actorName} ${PROGRAM_ACTIONS[action] || 'نفّذ إجراءً'} في ${programName}: ${describeIdentity(identity)}`,
    details
  };
}

function logRecordActivity(req, options = {}) {
  const logger = req && req.app && req.app.locals && req.app.locals.logActivityEvent;
  const user = req && (req.portalUser || req.portalAuth?.user);
  if (typeof logger !== 'function' || !user) return null;
  const built = buildRecordActivity({
    ...options,
    actorName: user.displayName || user.username || 'مستخدم'
  });
  return logger({
    user,
    token: req.portalAuth?.token,
    source: 'server',
    eventType: built.eventType,
    message: built.message,
    context: {
      programKey: options.programKey,
      programName: options.programName,
      pageName: options.programName,
      path: req.originalUrl || req.url || ''
    },
    details: {
      ...built.details,
      requestMethod: req.method || ''
    }
  });
}

module.exports = {
  buildRecordActivity,
  diffActivityRecords,
  extractRecordIdentity,
  getFieldLabel,
  logRecordActivity
};
