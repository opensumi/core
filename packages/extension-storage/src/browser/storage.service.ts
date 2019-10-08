import { Injectable, Autowired } from '@ali/common-di';
import { ExtensionStoragePath, ExtensionStorageServerPath, IExtensionStorageService, KeysToAnyValues, KeysToKeysToAnyValue, IExtensionStorageServer } from '../common' ;
import { IWorkspaceService } from '@ali/ide-workspace';
import { FileStat } from '@ali/ide-file-service';

@Injectable()
export class ExtensionStorageService implements IExtensionStorageService {
  @Autowired(ExtensionStorageServerPath)
  extensionStorageServer: IExtensionStorageServer;

  @Autowired(IWorkspaceService)
  workspaceService: IWorkspaceService;

  private _init: Promise<ExtensionStoragePath>;
  private _extensionStoragePath: ExtensionStoragePath;

  constructor() {
    this._init = this.init();
  }

  get whenReady() {
    return this._init;
  }

  get extensionStoragePath() {
    return this._extensionStoragePath;
  }

  public async init(): Promise<ExtensionStoragePath> {
    const roots: FileStat[] = await this.workspaceService.roots;
    const workspace = this.workspaceService.workspace;
    this._extensionStoragePath = await this.extensionStorageServer.init(workspace, roots);
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
    console.log('ExtensionStorageService reConnectInit');
    const roots: FileStat[] = await this.workspaceService.roots;
    const workspace = this.workspaceService.workspace;
    this._extensionStoragePath = await this.extensionStorageServer.init(workspace, roots);
    console.log('ExtensionStorageService reConnectInit done');
    return this._extensionStoragePath;
  }
}
