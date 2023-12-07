import { command } from 'execa';

export async function run(cmd: string, options?: { stdio?: 'inherit' | 'pipe' }) {
  console.log(`[RUN]: ${cmd}`);
  return command(cmd, { stdio: options?.stdio ?? 'inherit', shell: true });
}
