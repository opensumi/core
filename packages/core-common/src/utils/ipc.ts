import { tmpdir } from 'os';
import { join, dirname } from 'path';

import { ensureDirSync } from 'fs-extra';

import { isWindows } from '../platform';
import { uuid } from '../uuid';


export function normalizedIpcHandlerPath(name: string, uuidSuffix = false, ipcPath = tmpdir()) {
  let handler;
  if (!isWindows) {
    handler = join(ipcPath, 'sumi-ipc', `sumi-ipc-${name}${uuidSuffix ? uuid() : ''}.sock`);
    ensureDirSync(dirname(handler));
  } else {
    handler = `\\\\.\\pipe\\sumi-ipc-${name}${uuidSuffix ? uuid() : ''}`;
  }
  return handler;
}
