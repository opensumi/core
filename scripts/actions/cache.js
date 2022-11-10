const fs = require('fs');
const path = require('path');
const { TEMP_DIR } = require('./constants');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR);
}

fs.copyFileSync('yarn.lock', path.join(TEMP_DIR, 'yarn.lock'));
