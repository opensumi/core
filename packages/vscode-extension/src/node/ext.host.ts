import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionScanner } from '@ali/ide-feature-extension';
import { IFeatureExtension } from '@ali/ide-feature-extension/src/browser/types';
import { getLogger, Emitter } from '@ali/ide-core-common';
import {RPCProtocol} from '@ali/ide-connection';
import {createApiFactory} from './api/ext.host.api.impl';
import {MainThreadAPIIdentifier, IExtensionProcessService} from '../common';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ExtenstionContext } from './api/ext.host.extensions';
import { VSCExtension } from './vscode.extension';
import { ExtensionsActivator, ActivatedExtension } from './ext.host.activator';

const log = getLogger();

export default class ExtensionProcessServiceImpl implements IExtensionProcessService {
  public rpcProtocol: RPCProtocol;
  private readonly apiFactory: any;
  // TODO: extension 封装
  private extensions: IFeatureExtension[];
  private extApiImpl: Map<string, any>;

  private _ready: Promise<void>;

  private extentionsActivator: ExtensionsActivator;
  readonly extensionsChangeEmitter: Emitter<string> = new Emitter<string>();

  constructor(rpcProtocol: RPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.apiFactory = createApiFactory(
      this.rpcProtocol,
      this,
    ); // this.createApiFactory();
    this.extApiImpl = new Map();
    this._ready = this.init();
  }

  public async init() {
    if (this._ready) {
      return this._ready;
    }
    this.extentionsActivator = new ExtensionsActivator(this);
    this.extensions = await this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadExtensionServie).$getFeatureExtensions();
    log.log('ExtensionProcess extensions', this.extensions.map((extension) => {
      return extension.packageJSON.name;
    }));
    this.defineAPI();
  }

  public getExtension(extensionId: string): vscode.Extension<any> | undefined {
    let result: vscode.Extension<any> | undefined;
    let featureExtension;

    this.extensions.some((extension: IFeatureExtension) => {
      if (extensionId === extension.id) {
        featureExtension = extension;
        return true;
      }
    });

    if (featureExtension) {
      result = new VSCExtension(featureExtension, this);
    }

    return result;
  }

  private findExtension(filePath: string) {
    return this.extensions.find((extension) => filePath.startsWith(extension.path));
  }

  private defineAPI() {
    const module = require('module');
    const originalLoad = module._load;
    const findExtension = this.findExtension.bind(this);
    const extApiImpl = this.extApiImpl;
    const apiFactory = this.apiFactory.bind(this);

    module._load = function load(request: string, parent: any, isMain: any) {
      if (request !== 'vscode') {
        return originalLoad.apply(this, arguments);
      }
      const extension = findExtension(parent.filename);

      if (!extension) {
        return;
      }

      let apiImpl = extApiImpl.get(extension.id);
      if (!apiImpl) {
        try {
          apiImpl = apiFactory(extension);
        } catch (e) {
          console.log(e);
        }
        extApiImpl.set(extension.id, apiImpl);
      }
      return apiImpl;
    };
  }
  public $activateByEvent(activationEvent: string) {

  }

  public async activateExtension(id: string) {
    log.log('=====> $activateExtension !!!!!', id);
    await this._ready;
    let modulePath;

    this.extensions.some((ext) => {
      if (ext.id === id) {
        modulePath = ext.path;
        return true;
      }
    });

    log.log('==>require ', modulePath);

    const extensionModule: any = require(modulePath);
    log.log('==>activate ', modulePath);
    if (extensionModule.activate) {
      const context = new ExtenstionContext({
        extensionPath: modulePath,
      });
      try {
        const exportsData = await extensionModule.activate(context);
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
        // 输出执行错误日志
        console.log(e);
      }
    }
  }

  public async $activateExtension(id: string) {
    return this.activateExtension(id);
  }

  public getExtensions(): IFeatureExtension[] {
    return this.extensions;
  }

  public $getExtensions(): IFeatureExtension[] {
    return this.getExtensions().map((ext) => {
      return ext.toJSON();
    });
  }
}
