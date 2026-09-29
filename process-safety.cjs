'use strict';
// Fatal errors are logged and handed back to Passenger/systemd. Continuing an
// unknown process state can corrupt subsequent requests; never silently swallow.
function installProcessSafety(target = process, logger = console) {
  let exiting = false;
  function fatal(kind, error) {
    if (exiting) return;
    exiting = true;
    logger.error('[fatal]', kind, error instanceof Error ? error.stack : String(error));
    target.exit(1);
  }
  target.on('uncaughtException', error => fatal('uncaughtException', error));
  target.on('unhandledRejection', error => fatal('unhandledRejection', error));
}
module.exports = { installProcessSafety };
