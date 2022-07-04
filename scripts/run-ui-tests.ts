import { run } from './fn/shell';
import { argv } from '../packages/core-common/src/node/cli';

const folderName = 'tools/playwright';

(async () => {
  if (argv.ci) {
    await run(`cd ${folderName} && npm run ui-tests-cli`);
  } else if (argv.headful) {
    // 默认 playwright 会开启 headless
    await run(`cd ${folderName} && npm run ui-tests-headful`);
  } else if (argv.report) {
    await run(`cd ${folderName} && npm run ui-tests-report`);
  } else {
    await run(`cd ${folderName} && npm run ui-tests`);
  }
})();
