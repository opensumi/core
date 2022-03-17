import { Injectable, Autowired } from '@opensumi/di';
import { Deferred, URI, Emitter, Event, ILogger, STORAGE_SCHEMA } from '@opensumi/ide-core-common';
import { Path } from '@opensumi/ide-core-common/lib/path';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import { IStorageServer, IUpdateRequest, IStoragePathServer, StorageChange, StringKeyToAnyValue } from '../common';

@Injectable()
export abstract class StorageServer implements IStorageServer {
  @Autowired(IFileServiceClient)
  protected readonly fileSystem: IFileServiceClient;

  private storageExistPromises: Map<string, Promise<boolean>> = new Map();

  @Autowired(IStoragePathServer)
  protected readonly dataStoragePathServer: IStoragePathServer;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  abstract deferredStorageDirPath: Deferred<string | undefined>;
  abstract databaseStorageDirPath: string | undefined;

  public _cache: any = {};

  private cachedStoragePath = new Map<string, string | undefined>();

  public onDidChangeEmitter = new Emitter<StorageChange>();
  readonly onDidChange: Event<StorageChange> = this.onDidChangeEmitter.event;

  abstract init(storageDirName?: string, workspaceNamespace?: string): Promise<string | undefined>;
  abstract getItems(storageName: string): Promise<StringKeyToAnyValue>;
  abstract updateItems(storageName: string, request: IUpdateRequest): Promise<void>;

  async close(recovery?: () => Map<string, string>) {
    // do nothing
  }

  protected async asAccess(storagePath: string, force?: boolean) {
    if (force) {
      return await this.fileSystem.access(storagePath);
    }
    if (!this.storageExistPromises.has(storagePath)) {
      const promise = this.fileSystem.access(storagePath);
      this.storageExistPromises.set(storagePath, promise);
    }
    return await this.storageExistPromises.get(storagePath);
  }

  async setupDirectories(scope: string, storageDirName?: string) {
    if (!this.deferredStorageDirPath) {
      this.deferredStorageDirPath = new Deferred<string | undefined>();
      let fn;
      if (scope === STORAGE_SCHEMA.GLOBAL) {
        fn = this.dataStoragePathServer.provideGlobalStorageDirPath;
      } else {
        fn = this.dataStoragePathServer.provideWorkspaceStorageDirPath;
      }
      const storagePath = await fn.apply(this.dataStoragePathServer, [storageDirName]);
      this.deferredStorageDirPath.resolve(storagePath);
      this.databaseStorageDirPath = storagePath;
      return storagePath;
    }
    return this.databaseStorageDirPath;
  }

  async getStoragePath(scope: string, storageName): Promise<string | undefined> {
    if (!this.databaseStorageDirPath) {
      await this.deferredStorageDirPath.promise;
    }

    const hasSlash = storageName.indexOf(Path.separator) >= 0;

    let fn;
    if (scope === STORAGE_SCHEMA.GLOBAL) {
      fn = this.dataStoragePathServer.getLastGlobalStoragePath;
    } else {
      fn = this.dataStoragePathServer.getLastWorkspaceStoragePath;
    }

    const storagePath = await fn.apply(this.dataStoragePathServer);

    if (hasSlash) {
      const storagePaths = new Path(storageName);
      storageName = storagePaths.name;
      const uriString = new URI(storagePath!).resolve(storagePaths.dir).toString();
      if (!(await this.fileSystem.access(uriString))) {
        await this.fileSystem.createFolder(uriString);
      }
      return storagePath ? new URI(uriString).resolve(`${storageName}.json`).toString() : undefined;
    }

    return storagePath ? new URI(storagePath).resolve(`${storageName}.json`).toString() : undefined;
  }
}

@Injectable()
export class WorkspaceStorageServer extends StorageServer {
  private workspaceNamespace: string | undefined;
  public deferredStorageDirPath: Deferred<string | undefined>;
  public databaseStorageDirPath: string | undefined;

  public async init(storageDirName?: string, workspaceNamespace?: string) {
    this.workspaceNamespace = workspaceNamespace;
    return await this.setupDirectories(STORAGE_SCHEMA.SCOPE, storageDirName);
  }

  async getItems(storageName: string) {
    if (this._cache[storageName]) {
      return this._cache[storageName];
    }

    let items = {};
    const workspaceNamespace = this.workspaceNamespace;
    const storagePath = await this.getStoragePath(STORAGE_SCHEMA.SCOPE, storageName);

    if (!storagePath) {
      this.logger.error(`Storage [${storageName}] is invalid.`);
    } else {
      const uriString = new URI(storagePath).toString();
      if (await this.asAccess(uriString, true)) {
        const data = await this.fileSystem.readFile(uriString);
        try {
          items = JSON.parse(data.content.toString());
        } catch (error) {
          this.logger.error(`Storage [${storageName}] content can not be parse. Error: ${error.stack}`);
          items = {};
        }
      }
    }
    this._cache[storageName] = items;
    if (workspaceNamespace) {
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
      if (workspaceNamespace) {
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
        if (workspaceNamespace) {
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

    const storagePath = await this.getStoragePath(STORAGE_SCHEMA.SCOPE, storageName);

    if (storagePath) {
      const uriString = new URI(storagePath).toString();
      let storageFile = await this.fileSystem.getFileStat(uriString);
      if (!storageFile) {
        storageFile = await this.fileSystem.createFile(uriString);
      }
      await this.fileSystem.setContent(storageFile, JSON.stringify(raw));
      const change: StorageChange = {
        path: storageFile.uri,
        data: JSON.stringify(raw),
      };
      this.onDidChangeEmitter.fire(change);
    }
  }
}

@Injectable()
export class GlobalStorageServer extends StorageServer {
  public deferredStorageDirPath: Deferred<string | undefined>;
  public databaseStorageDirPath: string | undefined;

  public async init(storageDirName: string) {
    return await this.setupDirectories(STORAGE_SCHEMA.GLOBAL, storageDirName);
  }

  async getItems(storageName: string) {
    if (this._cache[storageName]) {
      return this._cache[storageName];
    }

    let items = {};
    const storagePath = await this.getStoragePath(STORAGE_SCHEMA.GLOBAL, storageName);

    if (!storagePath) {
      this.logger.error(`Storage [${storageName}] is invalid.`);
    } else {
      const uriString = new URI(storagePath).toString();
      if (await this.asAccess(uriString, true)) {
        const data = await this.fileSystem.readFile(uriString);
        try {
          items = JSON.parse(data.content.toString());
        } catch (error) {
          this.logger.error(`Storage [${storageName}] content can not be parse. Error: ${error.stack}`);
          items = {};
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
    const storagePath = await this.getStoragePath(STORAGE_SCHEMA.GLOBAL, storageName);

    if (storagePath) {
      let storageFile = await this.fileSystem.getFileStat(storagePath);
      if (!storageFile) {
        storageFile = await this.fileSystem.createFile(storagePath, { content: '' });
      }
      await this.fileSystem.setContent(storageFile, JSON.stringify(raw));
      const change: StorageChange = {
        path: storageFile.uri,
        data: JSON.stringify(raw),
      };
      this.onDidChangeEmitter.fire(change);
    }
  }
}
