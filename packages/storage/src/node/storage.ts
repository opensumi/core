import { IStorageServer, IUpdateRequest, IStoragePathServer, StorageChange } from '../common';
import { Injectable, Autowired } from '@ali/common-di';
import { IFileService } from '@ali/ide-file-service';
import { Deferred, URI, Emitter, Event } from '@ali/ide-core-common';
import * as path from 'path';

@Injectable()
export class WorkspaceStorageServer implements IStorageServer {

  @Autowired(IFileService)
  protected readonly fileSystem: IFileService;

  @Autowired(IStoragePathServer)
  protected readonly dataStoragePathServer: IStoragePathServer;

  private deferredStorageDirPath = new Deferred<string>();
  private databaseStorageDirPath: string | undefined;

  private storageName: string;
  private workspaceNamespace: string | undefined;
  private _cache: any = {};

  private onDidChangeEmiter = new Emitter<StorageChange>();
  readonly onDidChange: Event<StorageChange> = this.onDidChangeEmiter.event;

  public async init(workspaceNamespace?: string) {
    this.workspaceNamespace = workspaceNamespace;
    return await this.setupDirectories();
  }

  private async setupDirectories() {
    const storagePath = await this.dataStoragePathServer.provideWorkspaceStorageDirPath();
    this.deferredStorageDirPath.resolve(storagePath);
    this.databaseStorageDirPath = storagePath;
    return storagePath;
  }

  private async getStoragePath(storageName: string): Promise<string | undefined> {
    if (!this.databaseStorageDirPath) {
      await this.deferredStorageDirPath.promise;
    }
    const hasSlash = storageName.indexOf('/') >= 0;

    const storagePath = await this.dataStoragePathServer.getLastWorkspaceStoragePath();

    if (hasSlash) {
      const storagePaths = storageName.split('/');
      storageName = storagePaths[storagePaths.length - 1];
      const subDirPaths = storagePaths.slice(0, -1);
      const subDir = path.join(storagePath || '', ...subDirPaths);
      const uriString = new URI(storagePath).withScheme('file').toString();
      if (!await this.fileSystem.exists(uriString)) {
        await this.fileSystem.createFolder(uriString);
      }
      return storagePath ? path.join(subDir, `${storageName}.json`) : undefined;
    }

    return storagePath ? path.join(storagePath, `${storageName}.json`) : undefined;
  }

  async getItems(storageName: string) {
    let items = {};
    const workspaceNamespace = this.workspaceNamespace;
    const storagePath = await this.getStoragePath(storageName);

    if (!storagePath) {
      console.error(`Storage [${this.storageName}] is invalid.`);
    } else {
      const uriString = new URI(storagePath).withScheme('file').toString();
      if (await this.fileSystem.exists(uriString)) {
        const data = await this.fileSystem.resolveContent(uriString);
        try {
          items = JSON.parse(data.content);
        } catch (error) {
          items = {};
          console.error(error);
        }
      }
    }
    this._cache[storageName] = items;
    if (!!workspaceNamespace) {
      items = items[workspaceNamespace] || {};
    }
    return items;
  }

  async updateItems(storageName: string, request: IUpdateRequest) {
    let raw = {};
    const workspaceNamespace = this.workspaceNamespace;
    if (this._cache[storageName]) {
      raw = this._cache[storageName];
    } else {
      raw = await this.getItems(storageName);
      if (!!workspaceNamespace) {
        raw = raw[workspaceNamespace];
      }
    }
    // INSERT
    if (request.insert) {
      if (workspaceNamespace) {
        raw[workspaceNamespace] = {
          ...raw[workspaceNamespace],
          ...request.insert,
        };
      } else {
        raw = {
          ...raw,
          ...request.insert,
        };
      }
    }

    // DELETE
    if (request.delete && request.delete.length > 0) {
      const deleteSet = new Set(request.delete);
      deleteSet.forEach((key) => {
        if (!!workspaceNamespace) {
          if (raw[workspaceNamespace][key]) {
            delete raw[workspaceNamespace][key];
          }
        } else {
          if (raw[key]) {
            delete raw[key];
          }
        }
      });
    }

    this._cache[storageName] = raw;

    const storagePath = await this.getStoragePath(storageName);

    if (storagePath) {
      const uriString = new URI(storagePath).withScheme('file').toString();
      let storageFile = await this.fileSystem.getFileStat(uriString);
      if (!storageFile) {
        storageFile = await this.fileSystem.createFile(uriString);
      }
      await this.fileSystem.setContent(storageFile, JSON.stringify(raw));
      const change: StorageChange = {
        path: storageFile.uri,
        data: JSON.stringify(raw),
      };
      this.onDidChangeEmiter.fire(change);
    }
  }

  async close(recovery?: () => Map<string, string>) {
    // do nothing
  }
}

@Injectable()
export class GlobalStorageServer implements IStorageServer {

  @Autowired(IFileService)
  protected readonly fileSystem: IFileService;

  @Autowired(IStoragePathServer)
  protected readonly dataStoragePathServer: IStoragePathServer;

  private deferredStorageDirPath = new Deferred<string>();
  private databaseStorageDirPath: string | undefined;

  private storageName: string;
  private _cache: any = {};

  private onDidChangeEmiter = new Emitter<StorageChange>();
  readonly onDidChange: Event<StorageChange> = this.onDidChangeEmiter.event;

  public async init() {
    return await this.setupDirectories();
  }

  private async setupDirectories() {
    const storagePath = await this.dataStoragePathServer.provideGlobalStorageDirPath();
    this.deferredStorageDirPath.resolve(storagePath);
    this.databaseStorageDirPath = storagePath;
    return storagePath;
  }

  private async getStoragePath(storageName: string): Promise<string | undefined> {
    if (!this.databaseStorageDirPath) {
      await this.deferredStorageDirPath.promise;
    }
    const hasSlash = storageName.indexOf('/') >= 0;

    const storagePath = await this.dataStoragePathServer.getLastGlobalStoragePath();

    if (hasSlash) {
      const storagePaths = storageName.split('/');
      storageName = storagePaths[storagePaths.length - 1];
      const subDirPaths = storagePaths.slice(0, -1);
      const subDir = path.join(...subDirPaths);
      const uriString = new URI(storagePath).resolve(subDir).withScheme('file').toString();
      if (!await this.fileSystem.exists(uriString)) {
        await this.fileSystem.createFolder(uriString);
      }
      return storagePath ? new URI(uriString).resolve(`${storageName}.json`).toString() : undefined;
    }

    return storagePath ? new URI(storagePath).resolve(`${storageName}.json`).toString() : undefined;
  }

  async getItems(storageName: string) {
    let items = {};
    const storagePath = await this.getStoragePath(storageName);

    if (!storagePath) {
      console.error(`Storage [${this.storageName}] is invalid.`);
    } else {
      const uriString = new URI(storagePath).withScheme('file').toString();
      if (await this.fileSystem.exists(uriString)) {
        const data = await this.fileSystem.resolveContent(uriString);
        try {
          items = JSON.parse(data.content);
        } catch (error) {
          items = {};
          console.error(error);
        }
      }
    }
    this._cache[storageName] = items;
    return items;
  }

  async updateItems(storageName: string, request: IUpdateRequest) {
    let raw = {};
    if (this._cache[storageName]) {
      raw = this._cache[storageName];
    } else {
      raw = await this.getItems(storageName);
    }
    // INSERT
    if (request.insert) {
      raw = {
        ...raw,
        ...request.insert,
      };
    }

    // DELETE
    if (request.delete && request.delete.length > 0) {
      const deleteSet = new Set(request.delete);
      deleteSet.forEach((key) => {
        if (raw[key]) {
          delete raw[key];
        }
      });
    }

    this._cache[storageName] = raw;
    const storagePath = await this.getStoragePath(storageName);

    if (storagePath) {
      let storageFile = await this.fileSystem.getFileStat(storagePath);
      if (!storageFile) {
        storageFile = await this.fileSystem.createFile(storagePath, {content: ''});
      }
      await this.fileSystem.setContent(storageFile, JSON.stringify(raw));
      const change: StorageChange = {
        path: storageFile.uri,
        data: JSON.stringify(raw),
      };
      this.onDidChangeEmiter.fire(change);
    }
  }

  async close(recovery?: () => Map<string, string>) {
    // do nothing
  }
}
