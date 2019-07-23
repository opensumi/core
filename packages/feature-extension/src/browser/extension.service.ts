import { FeatureExtensionManagerService, IFeatureExtension, IFeatureExtensionNodeProcess, ISandboxOption, FeatureExtensionCapabilityRegistry, IFeatureExtensionType, FeatureExtensionCapabilityContribution, FeatureExtensionCapability, JSONSchema , FeatureExtensionProcessManage} from './types';
import { IExtensionCandidate, ExtensionNodeService, ExtensionNodeServiceServerPath, MainThreadAPIIdentifier, ExtHostAPIIdentifier } from '../common';
import { Autowired, Injectable, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { getLogger, localize, ContributionProvider, Disposable, IDisposable, Deferred, Emitter } from '@ali/ide-core-common';
import { join } from 'path';
import {
  WSChanneHandler,
  RPCServiceCenter,
  initRPCService,
  createWebSocketConnection,
  createSocketConnection,
  RPCProtocol,
  ProxyIdentifier,
} from '@ali/ide-connection';
import {CommandRegistry, isElectronEnv} from '@ali/ide-core-browser';
import * as cp from 'child_process';
import {WorkbenchThemeService} from '@ali/ide-theme/lib/browser/workbench.theme.service';

@Injectable()
export class FeatureExtensionProcessManageImpl implements FeatureExtensionProcessManage {
  @Autowired(ExtensionNodeServiceServerPath)
  private extensionNodeService: ExtensionNodeService;

  public async create() {
    // await this.extensionNodeService.createExtProcess();
  }
  public async createProcess(name: string, preload: string, args?: string[], options?: cp.ForkOptions) {
    await this.extensionNodeService.createProcess(name, preload, args, options);
  }
  public async resolveConnection(name: string) {
    await this.extensionNodeService.resolveConnection(name);
  }
  public async resolveProcessInit(name: string) {
    await this.extensionNodeService.resolveProcessInit(name);
  }
}

@Injectable()
export class FeatureExtensionManagerServiceImpl implements FeatureExtensionManagerService {

  @Autowired(ExtensionNodeServiceServerPath)
  private extensionNodeService: ExtensionNodeService;

  @Autowired(FeatureExtensionCapabilityRegistry)
  registry: FeatureExtensionCapabilityRegistryImpl;

  @Autowired(FeatureExtensionProcessManageImpl)
  extProcessManager: FeatureExtensionProcessManageImpl;

  @Autowired(FeatureExtensionCapabilityContribution)
  private readonly contributions: ContributionProvider<FeatureExtensionCapabilityContribution>;

  @Autowired(WSChanneHandler)
  private wsChannelHandler: WSChanneHandler;

  @Autowired(CommandRegistry)
  private commandRegistry;

  @Autowired()
  themeService: WorkbenchThemeService;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  public extensions: Map<string, FeatureExtension> = new Map();
  private protocol: RPCProtocol;

  public async activate(): Promise<void> {
    for ( const contribution of this.contributions.getContributions()) {
      try {
        if (contribution.registerCapability) {
          await contribution.registerCapability(this.registry);
        }
      } catch (e) {
        getLogger().error(e);
      }
    }

    const candidates = await this.registry.getAllCandidatesFromFileSystem();
    for (const candidate of candidates) {
      for (const type of this.registry.getTypes()) {
        try {
          if (type.isThisType(candidate.packageJSON)) {
            // TODO: engine 匹配
            // if (this.extensions.has(candidate.packageJSON.name)) {
            //   throw new Error(localize('extension.exists', '插件已经存在') + candidate.packageJSON.name);
            // }
            const extension = new FeatureExtension(candidate, type, this);
            this.extensions.set(candidate.packageJSON.name, extension);
            break;
          }
        } catch (e) {
          getLogger().error(e);
        }
      }
    }

    getLogger().log('this.getFeatureExtensions()', this.getFeatureExtensions());

    // 启用拓展
    const promises: Promise<any>[] = [];
    this.extensions.forEach((extension) => {
      promises.push(extension.enable());
    });
    await Promise.all(promises);

    await this.themeService.initRegistedThemes();
    await this.themeService.applyTheme();

    for ( const contribution of this.contributions.getContributions()) {
      try {
        if (contribution.onWillEnableFeatureExtensions) {
          await contribution.onWillEnableFeatureExtensions(this);
        }
      } catch (e) {
        getLogger().error(e);
      }
    }

  }
  public async getCandidates() {
    return await this.registry.getAllCandidatesFromFileSystem();
  }
  private async initExtProtocol(name: string = 'ExtProtocol') {

    const mainThreadCenter = new RPCServiceCenter();

    if (isElectronEnv()) {
      const connectPath = await this.extensionNodeService.getElectronMainThreadListenPath(name);
      const connection = (window as any).createNetConnection(connectPath);
      mainThreadCenter.setConnection(createSocketConnection(connection));
    } else {
      const channel = await this.wsChannelHandler.openChannel(name);
      mainThreadCenter.setConnection(createWebSocketConnection(channel));
    }

    // const channel = await this.wsChannelHandler.openChannel(name);
    // mainThreadCenter.setConnection(createWebSocketConnection(channel));
    const {getRPCService} = initRPCService(mainThreadCenter);

    const service = getRPCService('ExtProtocol');
    const onMessageEmitter = new Emitter<string>();
    service.on('onMessage', (msg) => {
      onMessageEmitter.fire(msg);
    });
    const onMessage = onMessageEmitter.event;
    const send = service.onMessage;

    const mainThreadProtocol = new RPCProtocol({
      onMessage,
      send,
    });

    this.protocol = mainThreadProtocol;
  }

  public async setupAPI(setfn: (protocol: RPCProtocol) => void) {
    const protocol = this.protocol;
    setfn(protocol);
  }

  // public async createFeatureExtensionNodeProcess(name: string, preload: string, args?: string[] | undefined, options?: string[] | undefined)  {
  public async createFeatureExtensionNodeProcess(name: string, preload: string, args?: string[], options?: cp.ForkOptions, afterProtocol?: (protocol: RPCProtocol) => void)  {
    await this.extProcessManager.createProcess(name, preload, args, options);
    await this.initExtProtocol(name);
    if (afterProtocol) {
      afterProtocol(this.protocol);
    }
    await this.extProcessManager.resolveConnection(name);
    await this.extProcessManager.resolveProcessInit(name);

    console.log('createFeatureExtensionNodeProcess finish');
  }

  public getProxy<T>(identifier: ProxyIdentifier<T>): T {
    return this.protocol.getProxy(identifier);
  }

  public getFeatureExtensions(): IFeatureExtension[] {
    return Array.from(this.extensions.values());
  }

  public getFeatureExtension(name: string): IFeatureExtension {
    if (!this.extensions.has(name)) {
      throw new Error(localize('extension.not-exist-by-name', '插件不存在:') + name);
    }
    return this.extensions.get(name)!;
  }

  public getFeatureExtensionNodeProcess(name: string): IFeatureExtensionNodeProcess {
    throw new Error('Method not implemented.');
  }

  public runScriptInBrowser(scriptPath: string, sandboxOptions: ISandboxOption) {
    throw new Error('Method not implemented.');
  }

  public runScriptInNode(scriptPath: string, sandboxOptions: ISandboxOption) {
    throw new Error('Method not implemented.');
  }

}

@Injectable()
export class FeatureExtensionCapabilityRegistryImpl implements FeatureExtensionCapabilityRegistry {

  private extensionScanDir: string[] = []; // ['~/.vscode/extensions'];

  private extensionCandidate: string[] = [];

  private extraMetaData: {[key: string]: string} = {};

  @Autowired(ExtensionNodeServiceServerPath)
  private extensionNodeService: ExtensionNodeService;

  private types: Map<string, IFeatureExtensionType> = new Map();

  public async getAllCandidatesFromFileSystem(): Promise<IExtensionCandidate[]> {
    return this.extensionNodeService.getAllCandidatesFromFileSystem(this.extensionScanDir, this.extensionCandidate, this.extraMetaData);
  }

  public addExtraMetaData(fieldName: string, relativePath: string): IDisposable {
    this.extraMetaData[fieldName] = relativePath;
    return {
      dispose: () => {
        delete this.extraMetaData[fieldName];
      },
    };
  }

  public addFeatureExtensionScanDirectory(dir: string) {
    if (this.extensionScanDir.indexOf(dir) === -1) {
      this.extensionScanDir.push(dir);
    }
    return {
      dispose: () => {
        const index = this.extensionScanDir.indexOf(dir);
        if (index !== -1) {
          this.extensionScanDir.splice(index, 1);
        }
      },
    };
  }

  public addFeatureExtensionCandidate(dir: string) {
    this.extensionCandidate.push(dir);
    return {
      dispose: () => {
        const index = this.extensionCandidate.indexOf(dir);
        if (index !== -1) {
          this.extensionCandidate.splice(index, 1);
        }
      },
    };
  }

  public registerFeatureExtensionType(type: IFeatureExtensionType) {
    if (this.types.has(type.name)) {
      throw new Error(localize('extension.type-exists', '插件类型已经存在') + ': ' + type.name);
    }
    this.types.set(type.name, type);
    return {
      dispose: () => {
        this.types.delete(type.name);
      },
    };
  }

  public getTypes() {
    return this.types.values();
  }
}

class FeatureExtension implements IFeatureExtension {

  private _activated: boolean;

  private _enabled: boolean;

  public readonly name: string;

  public readonly id: string;

  private _enableDisposer: IDisposable | null;

  private _enabling: Promise<void> | null = null;

  private _activating: Promise<void> | null = null;

  private _activateDisposer: IDisposable | null;

  private capability: FeatureExtensionCapability;

  public readonly extraMetadata = {};

  public readonly packageJSON;

  public readonly path;

  constructor(candidate: IExtensionCandidate, public readonly type: IFeatureExtensionType, managerService: FeatureExtensionManagerService) {
    this.name = candidate.packageJSON.name;
    this.packageJSON = candidate.packageJSON;
    this.extraMetadata = candidate.extraMetaData;
    this.path = candidate.path;
    this.capability = type.createCapability(this);
    this.id = `${candidate.packageJSON.publisher}.${candidate.packageJSON.name}`;
  }

  get activated() {
    return this._activated;
  }

  get enabled() {
    return this._enabled;
  }

  async enable(): Promise<void> {
    // TODO dependency check
    if (this._enabled) {
      return ;
    }
    if (this._enabling) {
      return this._enabling;
    }
    this._enabling = this.capability.onEnable().then((disposer) => {
      this._enableDisposer = disposer ;
      this._enabled = true;
    }).catch((e) => {
      getLogger().error(e);
      this._enabling = null;
    });

  }

  async disable() {
    // TODO dependency
    await this.deactivate();
    if (!this._enabled) {
      if (!this._enabling) {
        return;
      } else {
        await this._enabling;
      }
    }
    this._enabled = false;
    if (this._enableDisposer) {
      try {
        await this._enableDisposer.dispose();
      } catch (e) {
        getLogger().error(e);
      }
      this._enableDisposer = null;
    }
  }

  async activate() {
    // TODO dependency check
    if (this._activated) {
      return ;
    }
    if (this._activating) {
      return this._activating;
    }

    try {
      const disposer = await this.capability.onActivate();
      this._activateDisposer = disposer ;
      this._activated = true;
    } catch (e) {
      getLogger().error(e);
      this._activating = null;
    }

    // this._activating = this.capability.onActivate().then((disposer) => {
    //   this._activateDisposer = disposer ;
    //   this._activated = true;
    // }).catch((e) => {
    //   getLogger().error(e);
    //   this._activating = null;
    // });
  }

  async deactivate() {
    // TODO dependency check
    if (!this._activated) {
      if (!this._activating) {
        return;
      } else {
        await this._activating;
      }
    }
    this._activated = false;
    if (this._activateDisposer) {
      try {
        await this._activateDisposer.dispose();
      } catch (e) {
        getLogger().error(e);
      }
      this._activateDisposer = null;
    }
  }

  async dispose() {
    await this.deactivate();
    await this.disable();
  }

  asAbsolute(relativePath: string) {
    return join(this.path, relativePath);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      activated: this.activated,
      enabled: this.enabled,
      packageJSON: this.packageJSON,
      type: this.type,
      path: this.path,
      extraMetaData: this.extraMetadata,
    };
  }

}
