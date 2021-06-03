import { Injectable, Autowired } from '@ali/common-di';
import { ExtensionStorageUri, IExtensionStorageService, KeysToAnyValues, KeysToKeysToAnyValue, IExtensionStorageServer, DEFAULT_EXTENSION_STORAGE_DIR_NAME } from '../common' ;
import { IWorkspaceService } from '@ali/ide-workspace';
import { FileStat } from '@ali/ide-file-service';
import { AppConfig } from '@ali/ide-core-browser';

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

  set(key: string, value: KeysToAnyValues, isGlobal: boolean) {
    return this.extensionStorageServer.set(key, value, isGlobal);
  }

  get(key: string, isGlobal: boolean): Promise<KeysToAnyValues> {
    return this.extensionStorageServer.get(key, isGlobal);
  }

  getAll(isGlobal: boolean = false): Promise<KeysToKeysToAnyValue> {
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
