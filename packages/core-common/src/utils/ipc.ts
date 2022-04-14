import { tmpdir } from 'os';
import { join, dirname } from 'path';

import { ensureDirSync, ensureDir } from 'fs-extra';

import { isWindows } from '../platform';
import { uuid } from '../uuid';

export function normalizedIpcHandlerPath(name: string, uuidSuffix = false, ipcPath = tmpdir()) {
  let handler: string;
  if (!isWindows) {
    handler = join(ipcPath, 'sumi-ipc', `sumi-ipc-${name}${uuidSuffix ? uuid() : ''}.sock`);
    ensureDirSync(dirname(handler));
  } else {
    handler = `\\\\.\\pipe\\sumi-ipc-${name}${uuidSuffix ? uuid() : ''}`;
  }
  return handler;
}

export async function normalizedIpcHandlerPathAsync(name: string, uuidSuffix = false, ipcPath = tmpdir()) {
  let handler: string;
  if (!isWindows) {
    handler = join(ipcPath, 'sumi-ipc', `sumi-ipc-${name}${uuidSuffix ? uuid() : ''}.sock`);
    await ensureDir(dirname(handler));
  } else {
    handler = `\\\\.\\pipe\\sumi-ipc-${name}${uuidSuffix ? uuid() : ''}`;
  }
  return handler;
}
