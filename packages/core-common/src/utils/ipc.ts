import { tmpdir } from 'os';
import { isWindows } from '../platform';
import { join, dirname } from 'path';
import { uuid } from '../uuid';
import { isOSX } from './os';
import { ensureDirSync } from 'fs-extra';

export function normalizedIpcHandlerPath(name: string, uuidSuffix: boolean = false) {
  let handler;
  const temp = tmpdir();
  if (!isWindows) {
    handler = join(temp, 'kaitian-ipc',
      `kaitian-ipc-${name}${ uuidSuffix? uuid() : ''}.sock`);
    ensureDirSync(dirname(handler));
  } else {
    handler = `\\\\.\\pipe\\kaitian-ipc-${name}${ uuidSuffix? uuid() : ''}`;
  }
  return handler;
}