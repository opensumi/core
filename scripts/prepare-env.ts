import { run } from './fn/shell';
import os from 'os';
import { argv } from './fn/argv';

function wrapSudo(cmd: string) {
  if (argv.sudo) {
    return `sudo ${cmd}`;
  }
  return cmd;
}

async function main() {
  const release = os.release();
  if (release.includes('alios7')) {
    await run(`
      ${wrapSudo('yum')} -y install gcc-c++ libX11-devel libxkbfile-devel libsecret-devel
    `);
  }
}

main();
