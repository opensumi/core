import { Injectable, Autowired } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-browser';
import { firstSessionDateStorageKey } from '@opensumi/ide-core-common';
import { FileStat } from '@opensumi/ide-file-service';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import {
  ExtensionStorageUri,
  IExtensionStorageService,
  KeysToAnyValues,
  KeysToKeysToAnyValue,
  IExtensionStorageServer,
  DEFAULT_EXTENSION_STORAGE_DIR_NAME,
} from '../common';

@Injectable()
export class ExtensionStorageService implements IExtensionStorageService {
  @Autowired(IExtensionStorageServer)
  private readonly extensionStorageServer: IExtensionStorageServer;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  private _init: Promise<ExtensionStorageUri>;
  private _extensionStoragePath: ExtensionStorageUri;

  constructor() {
    this._init = this.init();

    this.updateEnvState();
  }

  get whenReady() {
    return this._init;
  }

  get extensionStoragePath() {
    return this._extensionStoragePath;
  }

  public async init(): Promise<ExtensionStorageUri> {
    const roots: FileStat[] = await this.workspaceService.roots;
    const workspace = this.workspaceService.workspace;
    const extensionStorageDirName = this.appConfig.extensionStorageDirName || DEFAULT_EXTENSION_STORAGE_DIR_NAME;
    this._extensionStoragePath = await this.extensionStorageServer.init(workspace, roots, extensionStorageDirName);
    return this._extensionStoragePath;
  }

  async updateEnvState() {
    const firstSessionDate = await this.get(firstSessionDateStorageKey, true);

    if (firstSessionDate === undefined) {
      await this.set(firstSessionDateStorageKey, { date: new Date().toUTCString() }, true);
    }
  }

  set(key: string, value: KeysToAnyValues, isGlobal: boolean) {
    return this.extensionStorageServer.set(key, value, isGlobal);
  }

  get(key: string, isGlobal: boolean): Promise<KeysToAnyValues> {
    return this.extensionStorageServer.get(key, isGlobal);
  }

  getAll(isGlobal = false): Promise<KeysToKeysToAnyValue> {
    return this.extensionStorageServer.getAll(isGlobal);
  }

  public async reConnectInit() {
    const roots: FileStat[] = await this.workspaceService.roots;
    const workspace = this.workspaceService.workspace;
    const extensionStorageDirName = this.appConfig.extensionStorageDirName || DEFAULT_EXTENSION_STORAGE_DIR_NAME;
    this._extensionStoragePath = await this.extensionStorageServer.init(workspace, roots, extensionStorageDirName);
    return this._extensionStoragePath;
  }
}
