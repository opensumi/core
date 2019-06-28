import { ExtensionNodeService, IExtensionCandidate } from '../common';
import { Injectable } from '@ali/common-di';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { readdir, pathExists, readJSON, readFile } from 'fs-extra';
import { getLogger } from '@ali/ide-core-node';

@Injectable()
export class ExtensionNodeServiceImpl implements ExtensionNodeService {

  async getAllCandidatesFromFileSystem(scan: string[], candidates: string[], extraMetaData: {[key: string]: string; }): Promise<IExtensionCandidate[]> {
    return new ExtensionScanner(scan, candidates, extraMetaData).run();
  }

}

export class ExtensionScanner {

  private results: Map<string, IExtensionCandidate> = new Map();

  constructor(private scan: string[], private candidates: string[], private extraMetaData: {[key: string]: string; }) {

  }

  async run(): Promise<IExtensionCandidate[]> {
    await Promise.all(this.scan.map((dir) => this.scanDir(resolvePath(dir)))
    .concat(this.candidates.map((c) => this.getCandidate(resolvePath(c)))));
    return Array.from(this.results.values());
  }

  private async scanDir(dir: string): Promise<void> {
    try {
      const candidates: IExtensionCandidate[] = [];
      const files = await readdir(dir);
      await Promise.all(files.map((file) => {
        const path = join(dir, file);
        return this.getCandidate(path);
      }));
    } catch (e) {
      getLogger().error(e);
    }
  }

  private async getCandidate(path: string): Promise<void> {

    if (this.results.has(path)) {
      return;
    }

    if (!await pathExists(join(path, 'package.json'))) {
      return;
    } else {
      try {
        const packageJSON = await readJSON(join(path, 'package.json'));
        const extraMetaData = {};
        for (const extraField of Object.keys(this.extraMetaData)) {
          try {
            extraMetaData[extraField] = (await readFile(join(path, this.extraMetaData[extraField]))).toString();
          } catch (e) {
            extraMetaData[extraField] = null;
          }
        }
        this.results.set(path, {
          path,
          packageJSON,
          extraMetaData,
        });
      } catch (e) {
        getLogger().error(e);
        return;
      }
    }
  }

}
function resolvePath(path) {
    if (path[0] === '~') {
        return join(homedir(), path.slice(1));
    }
    return path;
}
