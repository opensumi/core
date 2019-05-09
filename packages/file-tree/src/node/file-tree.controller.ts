import * as fs from 'fs';
import { Injectable, Autowired, ValueProvider } from '@ali/common-di';
import { FileTreeAPI, CloudFile } from '../common';
import { DefineAPIController } from '@ali/ide-core';
import { NodeController } from '@ali/ide-core-node';

const ROOT_DIR = Symbol('ROOT_DIR');

export function creatRootDirProvider(rootDir: string): ValueProvider {
  return {
    token: ROOT_DIR,
    useValue: rootDir,
  };
}

@Injectable()
@DefineAPIController(FileTreeAPI)
export class FileTreeController extends NodeController implements FileTreeAPI {
  @Autowired(ROOT_DIR)
  private rootDir!: string;

  async getFiles(...paths: string[]) {
    const list = await fs.readdirSync(this.rootDir);
    return list.map((item) => ({
      name: item,
      path: `${this.rootDir}/${item}`,
    }));
  }

  async createFile(file: CloudFile) {
    return {
      name: file.name,
      path: `${this.rootDir}/${file.name}`,
    };
  }

  async deleteFile(file: CloudFile) {
    return;
  }
}
