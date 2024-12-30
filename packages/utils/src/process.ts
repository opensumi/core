import { isMacintosh, isWindows, setImmediate } from './platform';

interface IProcess {
  platform: string;
  env: object;
  cwd(): string;
  nextTick(callback: (...args: any[]) => void): number;
}

declare const process: IProcess;

const _safeProcess = {
  cwd(): string {
    return '/';
  },
  env: Object.create(null),
  get platform(): string {
    return isWindows ? 'win32' : isMacintosh ? 'darwin' : 'linux';
  },
  nextTick(callback: (...args: any[]) => void): number {
    return setImmediate(callback);
  },
};

let safeProcess: IProcess;
if (typeof process === 'undefined') {
  safeProcess = _safeProcess;
} else {
  if (typeof process.cwd === 'undefined') {
    safeProcess = _safeProcess;
  } else {
    safeProcess = process;
  }
}

function detectExtFileType(): 'js' | 'ts' {
  if (typeof module === 'object' && module.filename) {
    if (module.filename.endsWith('.ts')) {
      return 'ts';
    }
    return 'js';
  }

  if (typeof __filename === 'string') {
    if (__filename.endsWith('.ts')) {
      return 'ts';
    }
    return 'js';
  }

  return 'js';
}

export const cwd = safeProcess.cwd;
export const env = safeProcess.env;
export const platform = safeProcess.platform;
export const nextTick = safeProcess.nextTick;
export const extFileType = detectExtFileType();
