/**
 * Hostinger's entry file: MoorMove's server lives in backend/ (it reads
 * backend/.env when present; on Hostinger the settings come from hPanel).
 */
const path = require('path');

process.chdir(path.join(__dirname, 'backend'));
require('./backend/server.js');
