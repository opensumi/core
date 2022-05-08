import { command } from 'execa';

export async function run(cmd: string) {
  // tslint:disable-next-line
  console.log(`[RUN]: ${cmd}`);
  return command(cmd, { stdio: 'inherit', shell: true });
}
