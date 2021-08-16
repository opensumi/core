import { Emitter, Deferred, IExtensionProps, Uri } from '@ali/ide-core-common';
import {
  RPCProtocol, ProxyIdentifier,
} from '@ali/ide-connection';
import { IExtensionWorkerHost, EXTENSION_EXTEND_SERVICE_PREFIX } from '../common';
import { createAPIFactory as createKaitianAPIFactory } from './api/worker/worker.host.api.impl';
import { MainThreadAPIIdentifier, ExtHostAPIIdentifier, KaitianWorkerExtensionService } from '../common/vscode';
import { ExtensionLogger } from './extension-log';
import { KTWorkerExtension } from './vscode.extension';
import { ExtensionContext } from './api/vscode/ext.host.extensions';
import { ExtHostStorage } from './api/vscode/ext.host.storage';
import { ActivatedExtension, ActivatedExtensionJSON } from '../common/activator';

export function initRPCProtocol() {
  const onMessageEmitter = new Emitter<string>();
  const channel = new MessageChannel();

  self.postMessage(channel.port2, [channel.port2]);

  channel.port1.onmessage = (e) => {
    onMessageEmitter.fire(e.data);
  };
  const onMessage = onMessageEmitter.event;

  const extProtocol = new RPCProtocol({
    onMessage,
    send: (data) => {
      channel.port1.postMessage(data);
    },
  });

  return extProtocol;
}

export class ExtensionWorkerHost implements IExtensionWorkerHost {
  private extensions: IExtensionProps[];
  private rpcProtocol: RPCProtocol;

  private kaitianAPIFactory: any;
  private kaitianExtAPIImpl: Map<string, any> = new Map();
  public logger: ExtensionLogger;

  private initDeferred =  new Deferred();

  private activatedExtensions: Map<string, ActivatedExtension> = new Map<string, ActivatedExtension>();

  private mainThreadExtensionService: KaitianWorkerExtensionService;

  readonly extensionsChangeEmitter: Emitter<void> = new Emitter<void>();

  public staticServicePath: string;

  public storage: ExtHostStorage;

  constructor(rpcProtocol: RPCProtocol) {
    this.rpcProtocol = rpcProtocol;

    this.kaitianAPIFactory = createKaitianAPIFactory(this.rpcProtocol, this, 'worker');
    this.mainThreadExtensionService = this.rpcProtocol.getProxy<KaitianWorkerExtensionService>(MainThreadAPIIdentifier.MainThreadExtensionService);
    this.logger = new ExtensionLogger(rpcProtocol);
    this.storage = new ExtHostStorage(rpcProtocol);
    rpcProtocol.set(ExtHostAPIIdentifier.ExtHostStorage, this.storage);
  }

  async $getActivatedExtensions(): Promise<ActivatedExtensionJSON[]> {
    return Array.from(this.activatedExtensions.values()).map((e) => e.toJSON());
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
    });
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

  public async $updateExtHostData() {
    await this.init();

    const extensions = await this.mainThreadExtensionService.$getExtensions();
    this.extensions = extensions.map((ext) => ({
      ...ext,
      extensionLocation: Uri.from(ext.extensionLocation),
    }));
    this.logger.verbose('worker $handleExtHostCreated', this.extensions.map((extension) => {
      return extension.packageJSON.name;
    }));

    this.extendExtHostErrorStackTrace();

    this.initDeferred.resolve(undefined);
  }

  private _extHostErrorStackTraceExtended = false;
  private extendExtHostErrorStackTrace() {
    if (this._extHostErrorStackTraceExtended) {
      return;
    }
    this._extHostErrorStackTraceExtended = true;

    Error.stackTraceLimit = 100;
    Error.prepareStackTrace = (error: Error, stackTrace: any[]) => {
      let extension: IExtensionProps | undefined;
      let stackTraceMessage = '';

      for (const call of stackTrace) {
        stackTraceMessage += `\n\tat ${call.toString()}`;
        if (call.isEval() && !extension) {
          const scriptPath = call.getEvalOrigin();
          const maybeExtension = this.findExtensionFormScriptPath(scriptPath);
          if (maybeExtension) {
            extension = maybeExtension;
            const columnNumber = call.getColumnNumber();
            const lineNumber = call.getLineNumber();
            stackTraceMessage = `\n\tat ${extension.name} (${extension.workerScriptPath}:${lineNumber}:${columnNumber})` + stackTraceMessage;
          }
        }
      }

      if (extension) {
        const traceMessage = `${extension && extension.name} - ${error.name || 'Error'}: ${error.message || ''}${stackTraceMessage}`;
        // FIXME worker 线程需要接入 reporter
        this.logger.error(traceMessage);
        return traceMessage;
      }
      return error.stack;
    };
  }

  private findExtensionFormScriptPath(scriptPath: string) {
    return this.extensions.find((extension) => extension.workerScriptPath === scriptPath);
  }

  private getExtendModuleProxy(extension: IExtensionProps) {
    /**
     * @example
     * "kaitianContributes": {
     *  "viewsProxies": ["ViewComponentID"],
     * }
     */
    if (extension.packageJSON.kaitianContributes &&
      extension.packageJSON.kaitianContributes.viewsProxies
    ) {
      return this.getExtensionViewModuleProxy(extension, extension.packageJSON.kaitianContributes.viewsProxies);
    } else if (
      extension.extendConfig &&
      extension.extendConfig.browser &&
      extension.extendConfig.browser.componentId
    ) {
      return this.getExtensionViewModuleProxy(extension, extension.extendConfig.browser.componentId);
    } else {
      return {};
    }
  }

  private getExtensionViewModuleProxy(extension: IExtensionProps, viewsProxies: string[]) {
    return viewsProxies.reduce((proxies, viewId) => {
      proxies[viewId] = this.rpcProtocol.getProxy({
        serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extension.id}:${viewId}`,
      } as ProxyIdentifier<any>);

      proxies[viewId] = new Proxy(proxies[viewId], {
        get: (obj, prop) => {
          if (typeof prop === 'symbol') {
            return obj[prop];
          }

          return obj[`$${prop}`];
        },
      });
      return proxies;
    }, {});
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

  private async loadContext(extension: IExtensionProps) {
    const componentProxy = this.getExtendModuleProxy(extension);
    const registerExtendFn = (exportsData) => {
      return this.registerExtendModuleService(exportsData, extension);
    };

    const context = new ExtensionContext({
      extension,
      extensionId: extension.id,
      extendProxy: componentProxy,
      registerExtendModuleService: registerExtendFn,
      extensionPath: extension.realPath,
      storageProxy: this.storage,
      extensionLocation: extension.extensionLocation,
    });

    return Promise.all([
      context.globalState.whenReady,
      context.workspaceState.whenReady,
    ]).then(() => {
      return Object.freeze(context);
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
      const response = await fetch(decodeURIComponent(extension.workerScriptPath));

      if (response.status !== 200) {
        this.logger.error(response.statusText);
        return;
      }

      // https://developer.mozilla.org/en-US/docs/Tools/Debugger/How_to/Debug_eval_sources
      const initFn = new Function('module', 'exports', 'require', 'window', await response.text() + `\n//# sourceURL=${extension.workerScriptPath}`);
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
        const workerExtContext = await this.loadContext(extension);
        try {
          moduleExports = await (_module.exports as any).activate(Object.freeze(workerExtContext));
        } catch (err) {
          extensionActivateFailed = err;
          this.logger.error(`[Worker-Host] failed to activate extension ${extension.id} \n\n ${err.message}`);
        }
        const activatedExtension = new ActivatedExtension(
          id,
          extension.packageJSON.displayName || extension.name,
          extension.packageJSON.description || '',
          'worker',
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
