'use strict';

// cPanel/Passenger startup file.
// The webhook server also serves the static CRM files and listens on the
// PORT assigned by cPanel (or 4173 when run locally).
require('./process-safety.cjs').installProcessSafety();
require('./webhook-server.cjs');
