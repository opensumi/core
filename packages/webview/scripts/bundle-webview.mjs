/* eslint-disable no-console */
import { mkdir, readFile, writeFile } from 'fs/promises';

import debug from 'debug';
import * as esbuild from 'esbuild';

const log = debug('webview:bundle-webview');

const result = await esbuild.build({
  entryPoints: ['src/webview-host/web-preload-builtin.ts'],
  sourcemap: false,
  write: false,
  bundle: true,
});

log(
  'build result',
  result.outputFiles.map((v) => ({
    path: v.path,
    length: v.text.length,
  })),
);

const output = result.outputFiles[0].text;

function simpleReplace(str, from, to) {
  const index = str.indexOf(from);
  if (index === -1) {
    return str;
  }

  return str.slice(0, index) + to + str.slice(index + from.length);
}

const html = await readFile('src/webview-host/webview.html', 'utf8');
const htmlWithScript = simpleReplace(
  html,
  '<!-- | REPLACE_BY_SCRIPT_TAG | -->',
  `<script>
${output}
</script>`,
);

const toWrite = /** javascript */ `
/* prettier-ignore */
/* eslint-disable arrow-body-style */
/* eslint-disable no-template-curly-in-string */

const htmlContent: string = ${JSON.stringify(htmlWithScript)};

export const createHTML = (channelId: string) => {
  const text = 'window.channelId = ' + JSON.stringify(channelId) + ';';
  return htmlContent.replace('// | REPLACE_BY_CHANNEL_ID |', text);
};
`.trimStart();

await writeFile('src/browser/iframe/prebuilt.ts', toWrite);

console.log('Successfully bundled webview, write to src/browser/iframe/prebuilt.ts');

if (process.env.DEBUG) {
  try {
    await mkdir('lib/prebuilt', { recursive: true });
    await writeFile('lib/prebuilt/output.js', output);
    await writeFile('lib/prebuilt/webview.html', htmlWithScript);
  } catch (error) {
    console.log('===== ~ error:', error);
  }
}
