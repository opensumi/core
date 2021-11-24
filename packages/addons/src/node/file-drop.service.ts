import fs from 'fs';
import path from 'path';
import { Uri } from '@opensumi/ide-core-common';
import { Injectable } from '@opensumi/common-di';

import { IFileDropBackendService } from '../common';
@Injectable()
export class FileDropService implements IFileDropBackendService {
  private writeableStreams: Map<string, fs.WriteStream> = new Map();

  async ensureFileExist(fileName: string, targetDir: string): Promise<boolean> {
    const targetPath = Uri.file(path.join(targetDir, fileName)).path;
    this.writeableStreams.set(targetPath, fs.createWriteStream(targetPath));
    return true;
  }

  writeStream(chunk: string | ArrayBuffer, fileName: string, targetDir: string, done: boolean): Promise<void> {
    const targetPath = Uri.file(path.join(targetDir, fileName)).path;
    const stream = this.writeableStreams.get(targetPath);
    return new Promise((resolve, reject) => {
      stream?.write(chunk, 'binary', (err) => {
        if (err) {
          reject(err);
        }
        resolve();
        if (done) {
          stream.close();
          this.writeableStreams.delete(targetPath);
        }
      });
    });
  }
}
