// console.log('worker load');

// onmessage = (e) => {
//   console.log('worker message run', e.data);
//   postMessage('work msg');
// };

import { Emitter } from '@ali/ide-core-common';
import {
  RPCProtocol, ProxyIdentifier,
} from '@ali/ide-connection';
import { IExtension, IExtensionWorkerHost, EXTENSION_EXTEND_SERVICE_PREFIX } from '../common';
import { createAPIFactory as createKaiTianAPIFactory } from './api/kaitian/ext.host.api.impl';
import { MainThreadAPIIdentifier } from '../common/vscode';

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

protocol.set({serviceId: 'testWorkerService'} as any, {
  $hello: (str) => {
    return `hello ${str}`;
  },
});

class ExtensionWorkerHost implements IExtensionWorkerHost {
  private extensions: IExtension[];
  private rpcProtocol: RPCProtocol;

  private kaitianAPIFactory: any;
  private kaitianExtAPIImpl: Map<string, any> = new Map();

  constructor(rpcProtocol: RPCProtocol) {
    this.rpcProtocol = rpcProtocol;

    this.kaitianAPIFactory = createKaiTianAPIFactory(this.rpcProtocol, this, 'worker');

  }

  public init() {
    this.defineAPI();
  }

  public async $initExtensions() {
    this.extensions = await this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadExtensionServie).$getExtensions();
    this.extensions.forEach((extension) => {
      extension.workerVarId = extension.id.replace(/\./g, '_').replace(/-/g, '_');
      console.log('extension.workerVarId', extension.workerVarId);
    });
    console.log('worker $initExtensions', this.extensions.map((extension) => {
      return extension.packageJSON.name;
    }));
  }

  private findExtensionByVarId(workerVarId: string) {
    console.log('find this.extensions', this.extensions);
    return this.extensions.find((extension) => extension.workerVarId === workerVarId );
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

    console.log('extension extend service worker', extension.id, 'service', service);
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
    return this.activateExtension(id);
  }

  public async activateExtension(id: string) {
    const extension = this.extensions.find((extension) => extension.id === id );

    if (!extension) {
      console.error(`extension worker not found ${id} `);
      return;
    }

    console.log(`extension worker start activate ${id} ${extension.workerScriptPath}`);

    const extendConfig = extension.extendConfig;
    if (extendConfig.worker && extendConfig.worker.main && extension.workerScriptPath) {
      importScripts(extension.workerScriptPath);

      if (
        self[`kaitian_extend_browser_worker_${extension.workerVarId}`] &&
        self[`kaitian_extend_browser_worker_${extension.workerVarId}`].activate
      ) {
        const workerExtContext = this.loadContext(extension);
        self[`kaitian_extend_browser_worker_${extension.workerVarId}`].activate(workerExtContext);
      }
    } else {
      console.log('extension worker activate error', extension);
    }
  }

  public defineAPI() {
    // @ts-ignore
    self.kaitian = new Proxy(Object.create(null), {
      get: (target: any, prop: string) => {
        console.log('worker api prop', prop);
        const workerVarId = prop;
        const extension = this.findExtensionByVarId(workerVarId);

        console.log('worker api prop not found', prop);
        if (!extension) {
          return;
        }

        let kaitianAPIImpl = this.kaitianExtAPIImpl.get(extension.id);

        if (!kaitianAPIImpl) {
          try {
            kaitianAPIImpl =  this.kaitianAPIFactory(extension);

            console.log('kaitianAPIImpl', kaitianAPIImpl);
            this.kaitianExtAPIImpl.set(extension.id, kaitianAPIImpl);
          } catch (e) {
            console.log('worker error');
            console.log(e);
          }
        }

        return kaitianAPIImpl;
      },
    });
  }
}

const host = new ExtensionWorkerHost(protocol);
host.init();
