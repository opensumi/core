import { command } from 'execa';
import childProcess from 'child_process';

export async function run(cmd: string) {
  cmd = cmd.trim();
  console.log(`[RUN]: ${cmd}`);
  return command(cmd, { stdio: 'inherit', shell: true });
}

export async function exec(cmd: string) {
  cmd = cmd.trim();
  console.log(`[RUN]: ${cmd}`);

  return new Promise<void>((resolve, reject) => {
    const cp = childProcess.spawn('bash', ['-c', cmd], {
      stdio: 'inherit',
    });
    cp.on('close', (code) => {
      if (!code) resolve();
      else reject({ code, msg: `${cmd} failed` });
    });
  });
}
