import { command } from 'execa';

export async function run(cmd: string) {
  console.log(`[RUN]: ${cmd}`);
  return command(cmd, { stdio: 'inherit', shell: true });
}
