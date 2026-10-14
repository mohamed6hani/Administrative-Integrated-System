const ALWAYS_ALLOWED_ROLES = new Set(['admin', 'supersecretary']);

function normalizeRole(value) {
  const role = value && typeof value === 'object' ? value.role : value;
  return String(role || 'user').trim().toLowerCase();
}

function readRenewalDocumentEditPermission(value) {
  const source = value && typeof value === 'object'
    ? (value.permissions && typeof value.permissions === 'object' ? value.permissions : value)
    : {};
  return Boolean(source.editRenewalDocuments);
}

function canEditRenewalDocuments(user) {
  if (ALWAYS_ALLOWED_ROLES.has(normalizeRole(user))) return true;
  return readRenewalDocumentEditPermission(user);
}

module.exports = {
  canEditRenewalDocuments,
  normalizeRole,
  readRenewalDocumentEditPermission
};
