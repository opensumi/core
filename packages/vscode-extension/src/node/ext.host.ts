import * as path from 'path';
import {ExtensionScanner} from '@ali/ide-feature-extension';
import {RPCProtocol} from '@ali/ide-connection';
import {createApiFactory} from './api/ext.host.api.impl';
import {MainThreadAPIIdentifier, IExtensionProcessService} from '../common';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ExtenstionContext } from './api/ext.host.extensions';

export default class ExtensionProcessServiceImpl implements IExtensionProcessService {
  public rpcProtocol: RPCProtocol;
  private readonly apiFactory: any;
  // TODO: extension 封装
  private extensions: any[];
  private extApiImpl: Map<string, any>;

  private _ready: Promise<void>;

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
    this.extensions = await this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadExtensionServie).$getCandidates(); // await this.getCandidates();
    this.defineAPI();
  }

  private findExtension(filePath: string) {
    return this.extensions.find((extension) => filePath.startsWith(extension.path));
  }
  // FIXME: 插件进程中需要获取所有的 VSCode 插件信息，临时处理方法
  private async getCandidates() {
    const scaner = new ExtensionScanner([path.join(__dirname, '../../test/fixture')], [], {});
    const candidates = await scaner.run();

    return candidates.map((candidate) => {
      return {
        id: path.basename(candidate.path).split('-')[0],
        ...candidate,
      };
    });

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
      console.log('defineAPI extension', extension);

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
  public async $activateExtension(modulePath: string) {
    console.log('=====> $activateExtension !!!!!');
    await this._ready;
    console.log('==>require ', modulePath);
    const extensionModule = require(modulePath);
    // TODO: 调用链路
    console.log('==>activate ', modulePath);
    if (extensionModule.activate) {
      // TODO: 支持销毁 context.subscriptions
      const context = new ExtenstionContext({
        extensionPath: modulePath,
      });
      extensionModule.activate(context);
    }
  }
  public $getExtension() {
    return this.extensions;
  }
}
