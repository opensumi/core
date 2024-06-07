import os from 'os';
import path from 'path';

import * as fs from 'fs-extra';
import semver from 'semver';

import { PromiseTasks, Uri, getDebugLogger, getNodeRequire } from '@opensumi/ide-core-node';

import { IExtensionMetaData, IExtraMetaData } from '../common';

import { mergeContributes } from './merge-contributes';

function resolvePath(path) {
  if (path[0] === '~') {
    return path.join(os.homedir(), path.slice(1));
  }
  return path;
}

const debugLogger = getDebugLogger();

async function readJSONIfExists(filePath?: string): Promise<
  | { exists: true; json: any }
  | {
      exists: false;
    }
> {
  if (!filePath) {
    return { exists: false };
  }

  try {
    const exists = await fs.pathExists(filePath);
    if (exists) {
      return { exists: true, json: await fs.readJSON(filePath) };
    }
  } catch (e) {
    debugLogger.error('read file error', e);
  }
  return { exists: false };
}

export class ExtensionScanner {
  static async getExtension(
    extensionPath: string,
    languageId: string,
    extraMetaData?: IExtraMetaData,
  ): Promise<IExtensionMetaData | undefined> {
    // Electron 中，extensionPath 可能为一个 `.asar` 结尾的路径，这种情况下，fs-extra 的 pathExists 会判断为不存在
    try {
      await fs.stat(extensionPath);
    } catch (e) {
      debugLogger.error(`extension path ${extensionPath} does not exist`);
      return;
    }

    const pkgPath = path.join(extensionPath, 'package.json');
    const defaultPkgNlsPath = path.join(extensionPath, 'package.nls.json');
    const pkgNlsPath = await ExtensionScanner.getLocalizedExtraMetadataPath(
      'package.nls',
      extensionPath,
      languageId,
      '.json',
    );
    const extendPath = path.join(extensionPath, 'kaitian.js');

    const [pkgData, pkgNlsData, defaultPkgNlsData, extendExists] = await Promise.all([
      readJSONIfExists(pkgPath),
      readJSONIfExists(pkgNlsPath),
      readJSONIfExists(defaultPkgNlsPath),
      fs.pathExists(extendPath),
    ]);

    let pkgCheckResult = pkgData.exists;

    if (pkgData.exists) {
      if (!pkgData.json.engines) {
        pkgCheckResult = false;
      } else if (!(pkgData.json.engines.vscode || pkgData.json.engines.kaitian || pkgData.json.engines.opensumi)) {
        pkgCheckResult = false;
      }
    }

    const pkgNlsJSON = pkgNlsData.exists ? pkgNlsData.json : undefined;
    const defaultPkgNlsJSON = defaultPkgNlsData.exists ? defaultPkgNlsData.json : undefined;

    if (!(pkgCheckResult || extendExists)) {
      return;
    }

    const extensionExtraMetaData = {};
    const packageJSON = pkgData.exists ? pkgData.json : {};
    try {
      if (extraMetaData) {
        const tasks = new PromiseTasks<void>();

        for (const extraField of Object.keys(extraMetaData)) {
          try {
            const basename = path.basename(extraMetaData[extraField]);
            const suffix = path.extname(extraMetaData[extraField]);
            const prefix = basename.substr(0, basename.length - suffix.length);

            tasks.add(async () => {
              const extraFieldFilePath = await ExtensionScanner.getLocalizedExtraMetadataPath(
                prefix,
                extensionPath,
                languageId,
                suffix,
              );

              extensionExtraMetaData[extraField] = await fs.readFile(
                extraFieldFilePath || path.join(extensionPath, extraMetaData[extraField]),
                'utf-8',
              );
            });
          } catch (e) {
            extensionExtraMetaData[extraField] = null;
          }
        }

        await tasks.allSettled();
      }
    } catch (e) {
      debugLogger.error(e);
      return;
    }

    let extendConfig = {};
    if (extendExists) {
      try {
        // 这里必须clear cache, 不然每次都一样
        delete getNodeRequire().cache[extendPath];
        extendConfig = getNodeRequire()(extendPath);
      } catch (e) {
        debugLogger.error(e);
      }
    }

    // compatible with `kaitianContributes` declare
    if (!packageJSON.sumiContributes && packageJSON.kaitianContributes) {
      packageJSON.sumiContributes = packageJSON.kaitianContributes;
    }

    // merge for `sumiContributes` and `contributes`
    packageJSON.contributes = mergeContributes(packageJSON.sumiContributes, packageJSON.contributes);

    const extension = {
      // vscode 规范
      id: `${packageJSON.publisher}.${packageJSON.name}`,
      // 使用插件市场的 id
      // 从插件市场下载的插件命名规范为 ${publisher}.${name}-${version}
      extensionId: this.getExtensionIdByExtensionPath(extensionPath, packageJSON.version),
      extendConfig,
      path: extensionPath,
      packageJSON,
      defaultPkgNlsJSON,
      packageNlsJSON: pkgNlsJSON,
      extraMetadata: extensionExtraMetaData,
      realPath: await fs.realpath(extensionPath),
      uri: Uri.file(extensionPath),
    };
    return extension as IExtensionMetaData;
  }

  /**
   * 通过文件夹名获取插件 id
   * 文件夹名目前有两种：
   *  1. ${publisher}.${name}-${version} (推荐)
   *  2. ${extensionId}-${name}-${version}
   *  以上两种
   * @param extensionPath
   * @param version 可能有用户使用非 semver 的规范，所以传进来
   */
  static getExtensionIdByExtensionPath(extensionPath: string, version?: string) {
    const regExp = version ? new RegExp(`^(.+?)\\.(.+?)-(${version})$`) : /^(.+?)\.(.+?)-(\d+\.\d+\.\d+)$/;
    const baseName = path.basename(extensionPath);
    const nameStr = baseName.endsWith('.asar') ? baseName.split('.asar').shift()! : baseName;
    const match = regExp.exec(nameStr);

    if (match == null) {
      // 按照第二种方式返回
      return nameStr.split('-')[0];
    }

    const [, publisher, name] = match;
    return `${publisher}.${name}`;
  }

  private results: Map<string, IExtensionMetaData> = new Map();

  private availableExtensions: Map<string, IExtensionMetaData> = new Map();

  constructor(
    private scan: string[],
    private localization: string,
    private extensionCandidate: string[],
    private extraMetaData: IExtraMetaData,
  ) {}

  public async run(): Promise<IExtensionMetaData[]> {
    const scan = this.scan.map((dir) => resolvePath(dir));

    await Promise.all(
      scan
        .map((dir) => this.scanDir(dir))
        .concat(
          this.extensionCandidate.map(async (extension) => {
            await this.getExtension(extension, this.localization);
          }),
        ),
    );

    return Array.from(this.availableExtensions.values());
  }
  private async scanDir(dir: string): Promise<void> {
    debugLogger.info('scan directory: ', dir);
    try {
      const extensionDirArr = await fs.readdir(dir);
      await Promise.all(
        extensionDirArr.map((extensionDir) => {
          const extensionPath = path.join(dir, extensionDir);
          return this.getExtension(extensionPath, this.localization);
        }),
      );
    } catch (e) {
      debugLogger.error(e);
    }
  }

  static async getLocalizedExtraMetadataPath(
    prefix: string,
    extensionPath: string,
    languageId: string,
    suffix: string,
  ): Promise<string | undefined> {
    const lowerCasePrefix = prefix.toLowerCase();
    const lowerCaseLanguageId = languageId.toLowerCase();
    const maybeExist = [
      `${prefix}.${languageId}${suffix}`, // {prefix}.zh-CN{suffix}
      `${lowerCasePrefix}.${languageId}${suffix}`,
      `${prefix}.${lowerCaseLanguageId}${suffix}`, // {prefix}.zh-cn{suffix}
      `${lowerCasePrefix}.${lowerCaseLanguageId}${suffix}`,
      `${prefix}.${languageId.split('-')[0]}${suffix}`, // {prefix}.zh{suffix}
      `${lowerCasePrefix}.${languageId.split('-')[0]}${suffix}`,
    ];

    const tasks = new PromiseTasks<string | undefined>();

    for (const maybe of maybeExist) {
      const filepath = path.join(extensionPath, maybe);
      tasks.addPromise(fs.pathExists(filepath).then((exists) => (exists ? filepath : undefined)));
    }

    return await tasks.race();
  }

  private isLatestVersion(extension: IExtensionMetaData): boolean {
    if (this.availableExtensions.has(extension.id)) {
      const existedExtension = this.availableExtensions.get(extension.id)!;
      if (!existedExtension.packageJSON) {
        return true;
      }

      const existedPkgJson = existedExtension.packageJSON;
      const incomingPkgJson = extension.packageJSON;
      const compared = semver.compare(existedPkgJson.version, incomingPkgJson.version);

      if (compared === 0) {
        return false;
        // v1 greater
      } else if (compared === 1) {
        return false;
      } else {
        // v2 greater
        return true;
      }
    }

    return true;
  }

  public async getExtension(
    extensionPath: string,
    languageId: string,
    extraMetaData?: IExtraMetaData,
  ): Promise<IExtensionMetaData | undefined> {
    if (this.results.has(extensionPath)) {
      return;
    }

    const extension = await ExtensionScanner.getExtension(extensionPath, languageId, {
      ...this.extraMetaData,
      ...extraMetaData,
    });

    if (extension) {
      const latest = this.isLatestVersion(extension);
      if (latest) {
        this.availableExtensions.set(extension.id, extension);
      }

      this.results.set(extensionPath, extension);
      return extension;
    }
  }
}
