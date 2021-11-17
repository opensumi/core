import retry from 'async-retry';
import { shell } from 'execa';

(async () => {
  // lerna bootstrap --hoist 偶先会报错，使用 retry 重试三次
  // https://github.com/lerna/lerna/issues/789#issuecomment-386128096
  try {
    await retry(async () => {
      await shell('lerna clean --yes && lerna bootstrap --hoist', {
        stdio: 'inherit',
      });
    }, {
      retries: 3,
    })
  } catch (err) {
    console.trace(err);
    process.exit(1);
  }
})();
