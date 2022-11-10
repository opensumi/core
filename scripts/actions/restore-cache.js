const fs = require('fs');
const path = require('path');
const { TEMP_DIR } = require('./constants');
try {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
  }

  fs.copyFileSync(path.join(TEMP_DIR, 'yarn.lock'), 'yarn.lock');
} catch (e) {
  console.log('err', e);
}
