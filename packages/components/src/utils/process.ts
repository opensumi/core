// Modify from @ide-framework/ide-core-common/src/process.ts
import { isWindows, isOSX } from './os';

interface IProcess {
  platform: string;
  env: object;
  cwd(): string;
}

declare const process: IProcess;
const safeProcess: IProcess = (typeof process === 'undefined') ? {
  cwd(): string { return '/'; },
  env: Object.create(null),
  get platform(): string { return isWindows ? 'win32' : isOSX ? 'darwin' : 'linux'; },
} : process;

export namespace Process {
  export const cwd = safeProcess.cwd;
  export const env = safeProcess.env;
  export const platform = safeProcess.platform;
}
