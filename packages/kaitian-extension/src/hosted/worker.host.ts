import { Emitter, Deferred } from '@ali/ide-core-common';
import {
  RPCProtocol, ProxyIdentifier,
} from '@ali/ide-connection';
import { IExtension, IExtensionWorkerHost, EXTENSION_EXTEND_SERVICE_PREFIX } from '../common';
import { createAPIFactory as createKaitianAPIFactory } from './api/worker/worker.host.api.impl';
import { MainThreadAPIIdentifier } from '../common/vscode';
import { ExtensionLogger } from './extension-log';

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
  private extensions: IExtension[];
  private rpcProtocol: RPCProtocol;

  private kaitianAPIFactory: any;
  private kaitianExtAPIImpl: Map<string, any> = new Map();
  private logger: ExtensionLogger;

  private initDeferred =  new Deferred();

  constructor(rpcProtocol: RPCProtocol) {
    this.rpcProtocol = rpcProtocol;

    this.kaitianAPIFactory = createKaitianAPIFactory(this.rpcProtocol, this, 'worker');
    this.logger = new ExtensionLogger(rpcProtocol);
  }

  public init() {
    // TODO config?.loader
    // try {
    //   importScripts('http://127.0.0.1:8080/loader.js');
    // } catch (err) {
    //   this.logger.error(`[Worker-Host] ${err.message}`);
    // }
  }

  public async $initExtensions() {
    this.extensions = await this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadExtensionService).$getExtensions();
    this.logger.verbose('worker $initExtensions', this.extensions.map((extension) => {
      return extension.packageJSON.name;
    }));

    this.initDeferred.resolve();
  }

  private getExtendModuleProxy(extension: IExtension) {
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

  private registerExtendModuleService(exportsData, extension: IExtension) {
    const service = {};
    for (const key in exportsData) {
      if (exportsData.hasOwnProperty(key)) {
        if (typeof exportsData[key] === 'function') {
          service[`$${key}`] = exportsData[key];
        }
      }
    }

    // console.log('extension extend service worker', extension.id, 'service', service);
    this.rpcProtocol.set({serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extension.id}`} as ProxyIdentifier<any>, service);
  }

  private loadContext(extension: IExtension) {
    const componentProxy = this.getExtendModuleProxy(extension);
    const registerExtendFn = (exportsData) => {
      return this.registerExtendModuleService(exportsData, extension);
    };

    return {
      componentProxy,
      registerExtendModuleService: registerExtendFn,
    };
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

    const extendConfig = extension.extendConfig;
    if (extendConfig.worker && extendConfig.worker.main && extension.workerScriptPath) {
      const response = await fetch(extension.workerScriptPath);

      if (response.status !== 200) {
        this.logger.error(response.statusText);
        return;
      }

      const initFn = new Function('module', 'exports', 'require', 'window', await response.text());
      const _exports = {};
      const _module = { exports: _exports };
      const _require = (request: string) => {
        if (request === 'kaitian') {
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
        this.logger.error(`[Worker-Host] failed to initialize extension ${extension.id}`);
      }

      if (_module.exports && (_module.exports as any).activate) {
        const workerExtContext = this.loadContext(extension);
        try {
          /**
           * @TODO
           * @example
           * function activate() {
           *   return {
           *    // api...
           *   }
           * }
           * extension.getExtension(id).?
           */
          // tslint:disable-next-line
          const exports = (_module.exports as any).activate(workerExtContext);
        } catch (err) {
          this.logger.error(`[Worker-Host] failed to activate extension ${extension.id} \n\n ${err.message}`);
        }
      }
    } else {
      this.logger.error('[Worker-Host] extension worker activate error', extension);
    }
  }
}

const host = new ExtensionWorkerHost(protocol);
host.init();
