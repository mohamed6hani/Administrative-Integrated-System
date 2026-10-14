function applyLocalTestAccountPolicy(store) {
  const before = Array.isArray(store.users) ? store.users.length : 0;
  store.users = (store.users || []).filter((user) => user.username !== 'test');
  return { enabled: false, changed: before !== store.users.length, removed: before !== store.users.length };
}
module.exports = { applyLocalTestAccountPolicy, canUseLocalTestAccount: () => false, isLocalOnlyUser: () => false };
