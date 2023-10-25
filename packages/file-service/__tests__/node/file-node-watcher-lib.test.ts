import * as fse from 'fs-extra';
import temp from 'temp';

import { isMacintosh } from '@opensumi/ide-core-common';
import { FileUri } from '@opensumi/ide-core-node';

import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { DidFilesChangedParams, FileChangeType } from '../../src/common';
import { UnRecursiveFileSystemWatcher } from '../../src/node/un-recursive/file-node-watcher-lib';

function sleep(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
const sleepTime = 1000;

(isMacintosh ? describe.skip : describe)('watch directory delete/add/update', () => {
  it('delete file', () => {});
  it('add file', () => {});
  it('update file', () => {});
});
