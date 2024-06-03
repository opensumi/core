import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { warning } from '@opensumi/ide-components/lib/utils';
import { BaseConnection } from '@opensumi/ide-connection/lib/common/connection';
import { MessagePortConnection } from '@opensumi/ide-connection/lib/common/connection/drivers/message-port';
import { RawMessageIO } from '@opensumi/ide-connection/lib/common/rpc';
import { IRPCProtocol, SumiConnectionMultiplexer } from '@opensumi/ide-connection/lib/common/rpc/multiplexer';
import { AppConfig, Deferred, IExtensionProps, ILogger, URI } from '@opensumi/ide-core-browser';
import { Disposable, DisposableStore, path, toDisposable } from '@opensumi/ide-core-common';

import { IExtension, IExtensionWorkerHost, WorkerHostAPIIdentifier } from '../common';
import { ActivatedExtensionJSON } from '../common/activator';
import { AbstractWorkerExtProcessService } from '../common/extension.service';

import { getWorkerBootstrapUrl } from './loader';
import { createSumiAPIFactory } from './sumi/main.thread.api.impl';
import { initWorkerThreadAPIProxy } from './vscode/api/main.thread.api.impl';
import { initSharedAPIProxy } from './vscode/api/main.thread.api.shared-impl';
import { startInsideIframe } from './workerHostIframe';

const { posix } = path;

@Injectable()
export class WorkerExtProcessService
  extends Disposable
  implements AbstractWorkerExtProcessService<IExtensionWorkerHost>
{
  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  public ready: Deferred<void> = new Deferred();
  private _extHostUpdated: Deferred<void> = new Deferred();

  private extensions: IExtension[] = [];

  public protocol: IRPCProtocol;

  private apiFactoryDisposable = new DisposableStore();

  public disposeApiFactory() {
    this.apiFactoryDisposable.clear();
    if (this.protocol) {
      (this.protocol as SumiConnectionMultiplexer).dispose?.();
    }
    if (this.connection) {
      this.connection.dispose();
    }
  }

  public disposeProcess() {
    this.disposeApiFactory();
  }

  public async activate(ignoreCors?: boolean): Promise<IRPCProtocol> {
    this.protocol = await this.createExtProcess(ignoreCors);

    if (this.protocol) {
      this.ready.resolve();
      this.logger.log('[Worker Host] init worker thread api proxy');
      const apiProxy = initSharedAPIProxy(this.protocol, this.injector);
      this.apiFactoryDisposable.add(apiProxy);
      this.apiFactoryDisposable.add(toDisposable(initWorkerThreadAPIProxy(this.protocol, this.injector, this)));
      this.apiFactoryDisposable.add(toDisposable(createSumiAPIFactory(this.protocol, this.injector)));

      await apiProxy.setup();
      await this.getProxy().$updateExtHostData();
      this._extHostUpdated.resolve();
    }
    return this.protocol;
  }

  public async activeExtension(extension: IExtension, isWebExtension: boolean): Promise<void> {
    const { extendConfig, packageJSON, id } = extension;
    // 对使用 kaitian.js 的老插件兼容
    // 因为可能存在即用了 kaitian.js 作为入口，又注册了 sumiContributes 贡献点的插件
    if (extendConfig?.worker?.main) {
      warning(
        false,
        `[Deprecated warning]: ${id}: kaitian.js is deprecated, please use \`package.json#sumiContributes\` instead`,
      );
      await this.doActivateExtension(extension);
      return;
    }

    if (
      // 激活 workerMain 相关部分
      (packageJSON.sumiContributes && extension.contributes?.workerMain) ||
      // 激活 packageJSON.browser 相关部分
      (isWebExtension && packageJSON.browser)
    ) {
      await this.doActivateExtension(extension);
    }
  }

  private async doActivateExtension(extension: IExtension) {
    if (this.appConfig.extWorkerHost) {
      // 只有当 proxy.$updateExtHostData 调用之后才可以开始激活插件
      await this._extHostUpdated.promise;
      await this.getProxy().$activateExtension(extension.id);
    }
  }

  public async updateExtensionData(extensions: IExtension[]): Promise<void> {
    this.extensions = extensions;
    if (this.protocol) {
      this.getProxy().$updateExtHostData();
    }
  }

  public getExtension(extensionId: string): IExtension | undefined {
    return this.extensions.find((e) => e.id === extensionId);
  }

  // 以下三个方法是给插件进程调用的 rpc call
  public async $activateExtension(extensionPath: string): Promise<void> {
    const extension = this.extensions.find((n) => n.workerScriptPath === extensionPath);
    if (extension) {
      await extension.activate();
    }
  }

  public async $getExtensions(): Promise<IExtensionProps[]> {
    return this.extensions.map((extension) => {
      if (extension.contributes && extension.contributes.workerMain) {
        return this.getWorkerExtensionProps(extension, extension.contributes.workerMain);
      } else if (extension.packageJSON.browser) {
        return this.getWorkerExtensionProps(extension, extension.packageJSON.browser);
      } else if (extension.extendConfig && extension.extendConfig.worker && extension.extendConfig.worker.main) {
        return this.getWorkerExtensionProps(extension, extension.extendConfig.worker.main);
      } else {
        return extension.toJSON();
      }
    });
  }

  public async $getStaticServicePath() {
    return this.appConfig.staticServicePath || `http://${window.location.hostname}:8000`;
  }

  private async createExtProcess(ignoreCors?: boolean) {
    const workerSrc = getWorkerBootstrapUrl(this.appConfig.extWorkerHost!, 'ExtensionWorkerHost', ignoreCors);
    return await this.initWorkerProtocol(workerSrc);
  }

  private async initWorkerProtocol(workerUrl: string): Promise<IRPCProtocol> {
    this.logger.log('[Worker Host] init web worker extension host');

    return new Promise((resolve, reject) => {
      const ready = new Deferred<MessagePort>();

      if (this.appConfig.useIframeWrapWorkerHost) {
        const { iframe, extHostUuid } = startInsideIframe(workerUrl);
        window.addEventListener('message', (event) => {
          if (event.source !== iframe.contentWindow) {
            return;
          }

          if (event.data.kaitianWebWorkerExtHostId !== extHostUuid) {
            return;
          }

          if (event.data.data instanceof MessagePort) {
            ready.resolve(event.data.data);
            return;
          }
        });

        ready.promise.then((port) => {
          resolve(this.createProtocol(port));
        });
      } else {
        try {
          const extendWorkerHost = new Worker(workerUrl, { name: 'KaitianWorkerExtensionHost' });
          this.addDispose({
            dispose: () => extendWorkerHost.terminate(),
          });
          extendWorkerHost.onmessage = (e) => {
            if (e.data instanceof MessagePort) {
              ready.resolve(e.data);
            }
          };

          extendWorkerHost.onerror = (err) => {
            reject(err);
          };

          ready.promise.then((port) => {
            resolve(this.createProtocol(port));
          });
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  connection: BaseConnection<Uint8Array>;
  private createProtocol(port: MessagePort) {
    this.connection = new MessagePortConnection(port);

    const protocol = new SumiConnectionMultiplexer(this.connection, {
      timeout: this.appConfig.rpcMessageTimeout,
      name: 'worker-ext-host',
      io: new RawMessageIO(),
    });

    this.logger.log('[Worker Host] web worker extension host ready');
    return protocol;
  }

  getActivatedExtensions(): Promise<ActivatedExtensionJSON[]> {
    return this.getProxy().$getActivatedExtensions();
  }

  public getProxy() {
    return this.protocol.getProxy<IExtensionWorkerHost>(WorkerHostAPIIdentifier.ExtWorkerHostExtensionService);
  }

  private getWorkerExtensionProps(extension: IExtension, workerMain: string) {
    let entryScript = workerMain;

    // 有部分 web extension 在申明 browser 入口字段的时候，不会带上文件后缀，导致 fetch 获取文件 404
    if (!entryScript.endsWith('.js')) {
      entryScript += '.js';
    }

    // 这里路径遵循 posix 方式，fsPath 会自动根据平台转换
    const workerScriptPath = new URI(
      extension.extensionLocation.with({
        path: posix.join(extension.extensionLocation.path, entryScript),
      }),
    ).toString();

    return Object.assign({}, extension.toJSON(), { workerScriptPath });
  }

  dispose(): void {
    super.dispose();
    this.disposeApiFactory();
  }
}
