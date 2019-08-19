import * as vscode from 'vscode';
import { RPCProtocol } from '@ali/ide-connection';
import { getLogger, Emitter } from '@ali/ide-core-common';
import { IExtension } from '../common';
import { ExtHostStorage } from './api/vscode/api/ext.host.storage';
import { createApiFactory } from './api/vscode/api/ext.host.api.impl';
import { MainThreadAPIIdentifier } from '../common/vscode';
import { ExtenstionContext } from './api/vscode/api/ext.host.extensions';
import { ExtensionsActivator, ActivatedExtension} from './ext.host.activator';

const logger = getLogger();

export default class ExtensionHostService {
  private extensions: IExtension[];
  private rpcProtocol: RPCProtocol;

  private vscodeAPIFactory: any;
  private vscodeExtAPIImpl: Map<string, any>;

  private kaitianAPIFactory: any;
  private kaitianExtAPIImpl: Map<string, any>;

  private extentionsActivator: ExtensionsActivator;

  private storage: ExtHostStorage;

  // TODO: 待实现 API
  // $activateExtension(id: string): Promise<void>;
  // activateExtension(id: string): Promise<void>;
  // getExtensions(): IFeatureExtension[];
  // $getExtensions(): IFeatureExtension[];
  // getExtension(extensionId: string): vscode.Extension<any> | undefined;

  extensionsChangeEmitter: Emitter<string>;

  constructor(rpcProtocol: RPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.storage = new ExtHostStorage(rpcProtocol);
    this.vscodeAPIFactory = createApiFactory(
      this.rpcProtocol,
      this as any,
    );
    this.vscodeExtAPIImpl = new Map();
  }

  public async init() {
    this.extensions = await this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadExtensionServie).$getExtensions();

    logger.log('kaitian extensions', this.extensions.map((extension) => {
      return extension.packageJSON.name;
    }));
    this.extentionsActivator = new ExtensionsActivator();
    this.defineAPI();
  }

  private findExtension(filePath: string) {
    return this.extensions.find((extension) => filePath.startsWith(extension.path));
  }
  private defineAPI() {
    const module = require('module');
    const originalLoad = module._load;
    const findExtension = this.findExtension.bind(this);
    const vscodeExtAPIImpl = this.vscodeExtAPIImpl;
    const vscodeAPIFactory = this.vscodeAPIFactory.bind(this);

    module._load = function load(request: string, parent: any, isMain: any) {
      if (request !== 'vscode') {
        return originalLoad.apply(this, arguments);
      }

      const extension = findExtension(parent.filename);

      if (!extension) {
        return;
      }

      let vscodeAPIImpl = vscodeExtAPIImpl.get(extension.id);
      if (!vscodeAPIImpl) {
        try {
          vscodeAPIImpl = vscodeAPIFactory(extension);
        } catch (e) {
          logger.error(e);
        }
      }

      return vscodeAPIImpl;
    };
  }

  private async activateExtension(id: string) {
    logger.log('kaitian exthost $activateExtension', id);
    // await this._ready
    let modulePath;

    this.extensions.some((ext) => {
      if (ext.id === id) {
        modulePath = ext.path;
        return true;
      }
    });
    if (!modulePath) {
      logger.error(`extension ${id}'s modulePath not found`);
      return;
    }
    logger.log('kaitian exthost $activateExtension path', modulePath);
    const extensionModule: any = require(modulePath);
    if (extensionModule.activate) {
      const context = await this.loadExtensionContext(id, modulePath, this.storage);
      try {
        const exportsData = await extensionModule.activate(context) || extensionModule;
        this.extentionsActivator.set(id, new ActivatedExtension(
          false,
          null,
          extensionModule,
          exportsData,
          context.subscriptions,
        ));
      } catch (e) {
        this.extentionsActivator.set(id, new ActivatedExtension(
          true,
          e,
          extensionModule,
          undefined,
          context.subscriptions,
        ));

        logger.error(e);
      }
    }
  }

  public async $activateExtension(id: string) {
    return this.activateExtension(id);
  }

  private async loadExtensionContext(extensionId: string, modulePath: string, storageProxy: ExtHostStorage) {
    const context = new ExtenstionContext({
      extensionId,
      extensionPath: modulePath,
      storageProxy,
    });

    return Promise.all([
      context.globalState.whenReady,
      context.workspaceState.whenReady,
    ]).then(() => {
      return Object.freeze(context as vscode.ExtensionContext);
    });
  }

}
