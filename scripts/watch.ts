import glob from 'glob';
import path from 'path';
import { run } from './fn/shell';
import { copy } from 'fs-extra';
import nsfw from 'nsfw';

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

  const watcher = await (nsfw as any)(cwd, (e) => {
    e.forEach((e) => {
      if (e.action === nsfw.actions.CREATED || e.action === nsfw.actions.MODIFIED || e.action === nsfw.actions.RENAMED) {
        const filePath = e.newFile ? path.join(e.directory, e.newFile!) : path.join(e.directory, e.file!);
        if (fileSet.has(filePath)) {
          console.log('non-ts change detected:', filePath);
          copyOneFile(path.relative(cwd, filePath), cwd);
        }
      }
    });
  });

  watcher.start();

  const configFile = path.join(__dirname, 'test/jest.config.js');
  const testFile = path.join(__dirname, 'test/build.js');

  // // await run(`npx jest ${testFile} -c ${configFile}`);

  // build webview resources
  // await run('cd ./packages/webview && npm run copy-resources');
  await run('npx tsc --build configs/ts/tsconfig.build.json -w');
})().catch((e) => {
  console.trace(e);
  process.exit(128);
});

async function copyOneFile(file, cwd) {
  const from = path.join(cwd, file);
  const to = path.join(cwd, file.replace(/\/src\//, '/lib/'));
  await copy(from, to);
}
