function disabledDesktopAutomation(command, options, callback) {
  const done = typeof options === 'function' ? options : callback;
  const error = new Error('Desktop automation is disabled in the public demo. Download the export instead.');
  error.code = 'DEMO_DESKTOP_AUTOMATION_DISABLED';
  if (typeof done === 'function') queueMicrotask(() => done(error, '', ''));
  return null;
}
module.exports = { disabledDesktopAutomation };
