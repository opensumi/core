import { tmpdir } from 'os';
import { isWindows } from '../platform';
import { join } from 'path';
import { uuid } from '../uuid';
import { isOSX } from './os';
import { ensureFileSync } from 'fs-extra';

export function normalizedIpcHandlerPath(name: string, uuidSuffix: boolean = false) {
  let handler;
  const temp = tmpdir();
  if (!isWindows) {
    handler = join(temp, 'kaitian-ipc',
      `${name}${ uuidSuffix? uuid() : ''}.sock`);
    if(isOSX) {
      // mac下需要保证存在, 但linux不需要
      ensureFileSync(handler);
    }
  } else {
    handler = `\\\\.\\pipe\\${name}${ uuidSuffix? uuid() : ''}`;
  }
  return handler;
}