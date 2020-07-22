import { Emitter, Deferred, IExtensionProps } from '@ali/ide-core-common';
import {
  RPCProtocol, ProxyIdentifier,
} from '@ali/ide-connection';
import { IExtensionWorkerHost, EXTENSION_EXTEND_SERVICE_PREFIX } from '../common';
import { createAPIFactory as createKaitianAPIFactory } from './api/worker/worker.host.api.impl';
import { MainThreadAPIIdentifier, KTWorkerExtensionService } from '../common/vscode';
import { ExtensionLogger } from './extension-log';
import { KTWorkerExtension } from './vscode.extension';
import { KTWorkerExtensionContext } from './api/vscode/ext.host.extensions';
import { ActivatedExtension } from './ext.host.activator';
import { ExtHostStorage } from './api/vscode/ext.host.storage';

function initRPCProtocol() {
  const onMessageEmitter = new Emitter<string>();
  const onMessage = onMessageEmitter.event;
  self.onmessage = (e) => {
    onMessageEmitter.fire(e.data);
  };

  const extProtocol = new RPCProtocol({
    onMessage,
    send: postMessage.bind(self),
  });

  return extProtocol;
}

const protocol = initRPCProtocol();

class ExtensionWorkerHost implements IExtensionWorkerHost {
  private extensions: IExtensionProps[];
  private rpcProtocol: RPCProtocol;

  private kaitianAPIFactory: any;
  private kaitianExtAPIImpl: Map<string, any> = new Map();
  private logger: ExtensionLogger;

  private initDeferred =  new Deferred();

  private activatedExtensions: Map<string, ActivatedExtension> = new Map<string, ActivatedExtension>();

  private mainThreadExtensionService: KTWorkerExtensionService;

  readonly extensionsChangeEmitter: Emitter<void> = new Emitter<void>();

  public staticServicePath: string;

  public storage: ExtHostStorage;

  constructor(rpcProtocol: RPCProtocol) {
    this.rpcProtocol = rpcProtocol;

    this.kaitianAPIFactory = createKaitianAPIFactory(this.rpcProtocol, this, 'worker');
    this.mainThreadExtensionService = this.rpcProtocol.getProxy<KTWorkerExtensionService>(MainThreadAPIIdentifier.MainThreadExtensionService);
    this.logger = new ExtensionLogger(rpcProtocol);
    this.storage = new ExtHostStorage(rpcProtocol);
  }

  private async init() {
    this.staticServicePath = await this.mainThreadExtensionService.$getStaticServicePath();
  }

  getExtensionExports(id: string) {
    return this.activatedExtensions.get(id)?.exports;
  }

  getExtensions(): KTWorkerExtension[] {
    return this.extensions.map((ext) => {
      return new KTWorkerExtension(
        ext,
        this,
        this.mainThreadExtensionService,
        this.getExtensionExports(ext.id),
      );
    })
    .filter((e) => !!e.workerScriptPath);

  }

  getExtension(extensionId: string) {
    const extension = this.extensions.find((e) => e.id === extensionId);
    const activated = this.activatedExtensions.get(extensionId);
    if (extension) {
      return new KTWorkerExtension(extension, this, this.mainThreadExtensionService, activated?.exports);
    }
  }

  isActivated(id: string): boolean {
    return this.activatedExtensions.has(id);
  }

  static workerApiNamespace: string[] = ['kaitian', 'kaitian-worker', 'vscode'];

  public async $initExtensions() {
    await this.init();

    this.extensions = await this.mainThreadExtensionService.$getExtensions();
    this.logger.verbose('worker $initExtensions', this.extensions.map((extension) => {
      return extension.packageJSON.name;
    }));

    this.initDeferred.resolve();
  }

  private getExtendModuleProxy(extension: IExtensionProps) {
    const extendProxy = {};
    if (
      extension.extendConfig &&
      extension.extendConfig.browser &&
      extension.extendConfig.browser.componentId
    ) {
      const componentIdArr = extension.extendConfig.browser.componentId;
      for (let i = 0, len = componentIdArr.length; i < len; i++) {
        const id = componentIdArr[i];
        extendProxy[id] = this.rpcProtocol.getProxy({
          serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extension.id}:${id}`,
        } as ProxyIdentifier<any>);

        extendProxy[id] = new Proxy(extendProxy[id], {
          get: (obj, prop) => {
            if (typeof prop === 'symbol') {
              return obj[prop];
            }

            return obj[`$${prop}`];
          },
        });
      }
    }

    return extendProxy;
  }

  private registerExtendModuleService(exportsData, extension: IExtensionProps) {
    const service = {};
    for (const key in exportsData) {
      if (exportsData.hasOwnProperty(key)) {
        if (typeof exportsData[key] === 'function') {
          service[`$${key}`] = exportsData[key];
        }
      }
    }

    this.rpcProtocol.set({serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extension.id}`} as ProxyIdentifier<any>, service);
  }

  private loadContext(extension: IExtensionProps) {
    const componentProxy = this.getExtendModuleProxy(extension);
    const registerExtendFn = (exportsData) => {
      return this.registerExtendModuleService(exportsData, extension);
    };
    return new KTWorkerExtensionContext({
      extendProxy: componentProxy,
      registerExtendModuleService: registerExtendFn,
      extensionPath: extension.realPath,
      staticServicePath: this.staticServicePath,
      storage: this.storage,
    });
  }

  public async $activateExtension(id: string) {
    await this.initDeferred.promise;
    return this.activateExtension(id);
  }

  public async activateExtension(id: string) {
    const extension = this.extensions.find((extension) => extension.id === id );

    if (!extension) {
      this.logger.error(`[Worker-Host] extension worker not found ${id} `);
      return;
    }

    this.logger.verbose(`[Worker-Host] extension worker start activate ${id} ${extension.workerScriptPath}`);

    if (extension.workerScriptPath) {
      const response = await fetch(extension.workerScriptPath);

      if (response.status !== 200) {
        this.logger.error(response.statusText);
        return;
      }

      const initFn = new Function('module', 'exports', 'require', 'window', await response.text());
      const _exports = {};
      const _module = { exports: _exports };
      const _require = (request: string) => {
        if (ExtensionWorkerHost.workerApiNamespace.includes(request)) {
          let kaitianAPIImpl = this.kaitianExtAPIImpl.get(id);
          if (!kaitianAPIImpl) {
            try {
              kaitianAPIImpl =  this.kaitianAPIFactory(extension);
              this.kaitianExtAPIImpl.set(id, kaitianAPIImpl);
            } catch (e) {
              this.logger.error('[Worker-Host] worker error');
              this.logger.error(e);
            }
          }
          return kaitianAPIImpl;
        }
      };

      try {
        initFn(_module, _exports, _require, self);
      } catch (err) {
        this.logger.error(`[Worker-Host] failed to initialize extension ${extension.id} \n`, err);
      }

      let extensionActivateFailed;
      let moduleExports;
      if (_module.exports && (_module.exports as any).activate) {
        const workerExtContext = this.loadContext(extension);
        try {
          moduleExports = (_module.exports as any).activate(Object.freeze(workerExtContext));
        } catch (err) {
          extensionActivateFailed = err;
          this.logger.error(`[Worker-Host] failed to activate extension ${extension.id} \n\n ${err.message}`);
        }
        const activatedExtension = new ActivatedExtension(
          !!extensionActivateFailed,
          extensionActivateFailed,
          _module.exports,
          moduleExports,
          workerExtContext.subscriptions,
          undefined,
          undefined,
          undefined,
        );

        this.activatedExtensions.set(id, activatedExtension);
      }
    } else {
      this.logger.error('[Worker-Host] extension worker activate error', extension);
    }
  }
}

new ExtensionWorkerHost(protocol);
