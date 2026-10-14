function normalizeRole(value) {
  const raw = value && typeof value === 'object' ? value.role : value;
  const normalized = String(raw || 'user').trim().toLowerCase();
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

function normalizeUsername(user) {
  return String(user && user.username || '').trim().toLowerCase();
}

function isTestAccount(user) {
  return Boolean(user && (user.testAccount === true || normalizeUsername(user) === 'test'));
}

function shouldLockAppSelectionForRole(role) {
  return normalizeRole(role) === 'admin';
}

function canUseGlobalSearch(user) {
  const role = normalizeRole(user);
  return role === 'admin' || role === 'supersecretary';
}

function isProtectedAdminEdit({ actor, target } = {}) {
  if (normalizeRole(actor) !== 'admin') return false;
  if (normalizeRole(target) !== 'admin') return false;
  if (isTestAccount(actor)) return false;
  const actorUsername = normalizeUsername(actor);
  const targetUsername = normalizeUsername(target);
  return Boolean(actorUsername && targetUsername && actorUsername !== targetUsername);
}

module.exports = {
  canUseGlobalSearch,
  isProtectedAdminEdit,
  isTestAccount,
  normalizeRole,
  shouldLockAppSelectionForRole
};
