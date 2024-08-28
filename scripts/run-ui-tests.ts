import { argv } from '../packages/core-common/src/node/cli';

import { run } from './fn/shell';

const folderName = 'tools/playwright';

(async () => {
  if (argv.ci) {
    await run(`cd ${folderName} && yarn run ui-tests-ci`);
  } else if (argv.headful) {
    // 默认 playwright 会开启 headless
    await run(`cd ${folderName} && yarn run ui-tests-headful`);
  } else if (argv.report) {
    await run(`cd ${folderName} && yarn run ui-tests-report`);
  } else {
    await run(`cd ${folderName} && yarn run ui-tests`);
  }
})();
