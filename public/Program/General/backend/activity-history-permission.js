function normalizeRole(value) {
  const role = value && typeof value === 'object' ? value.role : value;
  const normalized = String(role || 'user').trim().toLowerCase();
  return normalized === 'admin' ? 'admin' : normalized;
}

function readActivityHistoryPermission(value) {
  const source = value && typeof value === 'object'
    ? (value.permissions && typeof value.permissions === 'object' ? value.permissions : value)
    : {};
  return Boolean(source.viewActivityHistory);
}

function canViewActivityHistory(user) {
  if (normalizeRole(user) === 'admin') return true;
  return readActivityHistoryPermission(user);
}

module.exports = {
  canViewActivityHistory,
  readActivityHistoryPermission
};