import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import { getLogger } from '@ali/ide-core-node';
import { IExtensionMetaData } from '../common';

function resolvePath(path) {
  if (path[0] === '~') {
      return path.join(os.homedir(), path.slice(1));
  }
  return path;
}

export class ExtensionScanner {

  private results: Map<string, IExtensionMetaData> = new Map();

  constructor(
    private scan: string[],
    private extenionCandidate: string[],
    private extraMetaData: {[key: string]: string},
  ) { }

  public async run(): Promise<IExtensionMetaData[]> {

    const scan = this.scan.map((dir) => {
      return resolvePath(dir);
    });

    await Promise.all(

      scan.map((dir) => {
        return this.scanDir(dir);
      }).concat(
        this.extenionCandidate.map((extension) => {
          return this.getExtension(extension);
        }),
      ),
    );

    return Array.from(this.results.values());
  }
  private async scanDir(dir: string): Promise<void> {
    getLogger().info('kaitian scanDir', dir);
    try {
      const extensionDirArr = await fs.readdir(dir);
      await Promise.all(extensionDirArr.map((extensionDir) => {
        const extensionPath = path.join(dir, extensionDir);
        return this.getExtension(extensionPath);
      }));
    } catch (e) {
      getLogger().error(e);
    }
  }

  private async getExtension(extensionPath: string): Promise<void> {

    if (this.results.has(extensionPath)) {
      return;
    }

    const pkgPath = path.join(extensionPath, 'package.json');
    if (!await fs.pathExists(pkgPath)) {
      return;
    }

    const extensionExtraMetaData = {};
    let packageJSON = {};
    try {
      packageJSON = await fs.readJSON(pkgPath);
      for (const extraField of Object.keys(this.extraMetaData)) {
        try {
          extensionExtraMetaData[extraField] = await fs.readFile(path.join(extensionPath, this.extraMetaData[extraField]), 'utf-8');
        } catch (e) {
          extensionExtraMetaData[extraField] = null;
        }
      }
    } catch (e) {
      getLogger().error(e);
      return;
    }

    const extendPath = path.join(extensionPath, 'kaitian.js');
    let extendConfig = {};
    if (await fs.pathExists(extendPath)) {
      try {
        extendConfig = require(extendPath);
      } catch (e) {
        getLogger().error(e);
      }
    }

    this.results.set(extensionPath, {
      extendConfig,
      path: extensionPath,
      packageJSON,
      extraMetadata: extensionExtraMetaData,
      realPath: await fs.realpath(extensionPath),
    });
  }
}
