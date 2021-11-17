import { shell } from 'execa';

export async function run(command: string) {
  // tslint:disable-next-line
  console.log(`[RUN]: ${command}`);
  return shell(command, { stdio: 'inherit' });
}
