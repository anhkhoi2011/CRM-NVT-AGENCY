'use strict';

// Local-only server using in-memory demo data. Production starts app.js instead.
process.env.DEMO_MODE = '1';
require('../app.js');
