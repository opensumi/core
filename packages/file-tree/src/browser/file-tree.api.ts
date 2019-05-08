import { FileTreeAPI } from '../common/file-tree.defination';
import { BasicClientAPI, createApiClass } from '@ali/ide-core-browser';
import { Injectable } from '@ali/common-di';

const Parent = createApiClass(
  BasicClientAPI,
  FileTreeAPI,
  [
    'getFiles',
    'createFile',
    'deleteFile',
  ],
);

@Injectable()
export class FileTreeAPIImpl extends Parent implements FileTreeAPI {
  // nothing
}
