
import { Injectable, Inject } from '@ali/common-di';
// import {servicePath as FileServicePath} from '@ali/ide-file-service';
// import {servicePath as FileServicePath} from '@ali/ide-file-service/lib/common';

import { FileTreeAPI, IFileTreeItem } from '../common/file-tree.defination';
import { URI } from '@ali/ide-core-common';

const mockFilesItem: IFileTreeItem[] = [
  {
    id: 0,
    uri: new URI(`file:///path/to/filetree-test-demo`),
    filestat: {
      uri: new URI(`file:///path/to/filetree-test-demo`),
      lastModification: new Date().getTime(),
      isDirectory: true,
      children: [],
      size: 200,
    },
    name: `filetree-test-demo`,
    icon: ``,
    parent: null,
    children: [
      {
        id: 2,
        uri: new URI(`file:///path/to/src`),
        filestat: {
          uri: new URI(`file:///path/to/src`),
          lastModification: new Date().getTime(),
          isDirectory: true,
          children: [],
          size: 200,
        },
        name: `src`,
        icon: ``,
        parent: 0,
        children: [...Array(1000)].map((item, key) => {
          return {
            id: key + 3,
            uri: new URI(`path/to/src/index_${key}.js`),
            filestat: {
              uri: new URI(`path/to/src/index_${key}.js`),
              lastModification: new Date().getTime(),
              isDirectory: false,
              children: [],
              size: 200,
            },
            name: `index_${key}.js`,
            icon: ``,
            parent: 2,
          };
        }),
      },
    ],
  },
];

/**
 * TODO: 依赖 Connection 模块定义好之后实现这个模块
 */
@Injectable()
export class FileTreeAPIImpl implements FileTreeAPI {

  constructor(
    // @Inject(FileServicePath) protected readonly fileSevice
    ) {}

  async getFiles(...paths: string[]) {
    // const {content} = await this.fileSevice.resolveContent('/Users/franklife/work/ide/ac/ide-framework/README.md');

    // console.log('content', content);
    // loop to create files
    const files: IFileTreeItem[] = mockFilesItem;
    return files;

  }

  async createFile(file: IFileTreeItem) {
    return file;
  }

  async deleteFile(file: IFileTreeItem) {
    return;
  }
}
