import { execaCommand } from 'execa';

export async function run(command: string) {
  // tslint:disable-next-line
  console.log(`[RUN]: ${command}`);
  return execaCommand(command, { stdio: 'inherit' });
}
