import glob from 'glob';
import path from 'path';
import { run } from './fn/shell';
import { copy } from 'fs-extra';
import ParcelWatcher from '@parcel/watcher';

let handler: ParcelWatcher.AsyncSubscription;
(async () => {
  // await run('npm run clean');

  const filePattern = '*/src/**/!(*.ts|*.tsx)';

  console.log(`[COPY]: ${filePattern}`);
  const cwd = path.join(__dirname, '../packages');
  const files = glob.sync(filePattern, { cwd, nodir: true });
  const fileSet = new Set();
  for (const file of files) {
    await copyOneFile(file, cwd);
    fileSet.add(path.join(cwd, file));
  }

  handler = await ParcelWatcher.subscribe(cwd, (err, e) => {
    e.forEach((e) => {
      if (e.type === 'create' || e.type === 'update' || e.type === 'delete') {
        const filePath = e.path;
        if (fileSet.has(filePath)) {
          console.log('non-ts change detected:', filePath);
          copyOneFile(path.relative(cwd, filePath), cwd);
        }
      }
    });
  });

  // build webview resources
  await run('npx tsc --build configs/ts/tsconfig.build.json -w');
})().catch((e) => {
  console.trace(e);
  handler.unsubscribe();
  process.exit(128);
});

async function copyOneFile(file, cwd) {
  const from = path.join(cwd, file);
  const to = path.join(cwd, file.replace(/\/src\//, '/lib/'));
  await copy(from, to);
}
