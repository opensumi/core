import * as fs from 'fs';
import { Injectable } from '@ali/common-di';
import { FileTreeAPI, CloudFile } from '../common';
import { DefineAPIController } from '@ali/ide-core';
import { NodeController } from '@ali/ide-core-node';

@Injectable()
@DefineAPIController(FileTreeAPI)
export class FileTreeController extends NodeController implements FileTreeAPI {
  async getFiles(...paths: string[]) {
    const list = await fs.readdirSync(`${process.cwd()}/repo`);
    return list.map((item) => ({
      name: item,
      path: `${process.cwd()}/repo/${item}`,
    }));
  }

  async createFile(file: CloudFile) {
    const name = Date.now().toString();

    return {
      name,
      path: `${process.cwd()}/repo/${name}`,
    };
  }

  async deleteFile(file: CloudFile) {
    return;
  }
}
