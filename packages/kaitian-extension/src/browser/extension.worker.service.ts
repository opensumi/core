import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { IRPCProtocol, RPCProtocol } from '@ali/ide-connection/lib/common/rpcProtocol';
import { AppConfig, Deferred, Emitter, IExtensionProps, ILogger, URI } from '@ali/ide-core-browser';
import { UriComponents, Event, Disposable } from '@ali/ide-core-common';
import { posix } from '@ali/ide-core-common/lib/path';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';
import { IExtension, IExtensionWorkerHost, WorkerHostAPIIdentifier } from '../common';
import { ActivatedExtensionJSON } from '../common/activator';
import { AbstractExtensionService, IExtensionChangeEvent } from '../common/extension.service';
import { getWorkerBootstrapUrl } from './loader';
import { initWorkerTheadAPIProxy } from './vscode/api/main.thread.api.impl';
import { startInsideIframe } from './workerHostIframe';

@Injectable()
export class WorkerExtensionService extends Disposable implements AbstractExtensionService {

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired()
  private staticResourceService: StaticResourceService;

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  public protocol: IRPCProtocol;

  private onReady: Deferred<void> = new Deferred();

  private extensions: IExtension[] = [];

  async activate(ignoreCors?: boolean): Promise<IRPCProtocol> {
    const workerSrc = getWorkerBootstrapUrl(this.appConfig.extWorkerHost!, 'ExtensionWorkerHost', ignoreCors);
    this.protocol = await this.initWorkerProtocol(workerSrc);

    if (this.protocol) {
      this.onReady.resolve();
      this.logger.verbose('init worker thread api proxy', this.protocol);
      initWorkerTheadAPIProxy(this.protocol, this.injector, this)
        .then((dispose) => this.addDispose({ dispose }));

      await this.getProxy().$initExtensions();
    }
    return this.protocol;
  }

  private async initWorkerProtocol(workerUrl: string): Promise<IRPCProtocol> {
    this.logger.log('[Worker Host] init web worker extension host');

    return new Promise((resolve, reject) => {
      const ready = new Deferred<MessagePort>();
      const onMessageEmitter = new Emitter<any>();
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
          resolve(this.createProtocol(port, onMessageEmitter));
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
            resolve(this.createProtocol(port, onMessageEmitter));
          });
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  private createProtocol(port: MessagePort, emitter: Emitter<string>) {
    const onMessage = emitter.event;
    const protocol = new RPCProtocol({
      onMessage,
      send: port.postMessage.bind(port),
    }, this.logger);

    port.onmessage = (event) => {
      emitter.fire(event.data);
    };
    return protocol;
  }

  async initExtension(extensions: IExtension[]): Promise<void> {
    this.extensions = extensions;
    if (this.protocol) {
      this.getProxy().$initExtensions();
    }
  }

  async $activateExtension(extension: IExtension): Promise<void> {
    return await this.activeExtension(extension);
  }

  async activeExtension(extension: IExtension): Promise<void> {
    await this.onReady.promise;
    await this.getProxy().$activateExtension(extension.id);
  }

  onDidExtensionChange: Event<IExtensionChangeEvent>;

  getExtension(extensionId: string): IExtension | undefined {
    return this.extensions.find((e) => e.id === extensionId);
  }

  getActivatedExtensions(): Promise<ActivatedExtensionJSON[]> {
    return this.getProxy().$getActivatedExtensions();
  }

  private getProxy() {
    return this.protocol.getProxy<IExtensionWorkerHost>(WorkerHostAPIIdentifier.ExtWorkerHostExtensionService);
  }

  private getWorkerExtensionProps(extension: IExtension, workerMain: string) {
    // 这里路径遵循 posix 方式，fsPath 会自动根据平台转换
    const workerScriptURI = new URI(extension.extensionLocation.with({
      path: posix.join(extension.extensionLocation.path, workerMain),
    }));
    return Object.assign({}, extension.toJSON(), { workerScriptPath: workerScriptURI.toString() });
  }

  // RPC call
  $getExtensions(): IExtensionProps[] {
    return this.extensions.map((extension) => {
      if (extension.contributes && extension.contributes.workerMain) {
        return this.getWorkerExtensionProps(extension, extension.contributes.workerMain);
      } else if (
        extension.extendConfig &&
        extension.extendConfig.worker &&
        extension.extendConfig.worker.main
      ) {
        return this.getWorkerExtensionProps(extension, extension.extendConfig.worker.main);
      } else {
        return extension;
      }
    });
  }

  $getStaticServicePath() {
    return this.appConfig.staticServicePath || 'http://127.0.0.1:8000';
  }

  $resolveStaticResource(uri: UriComponents): UriComponents {
    return this.staticResourceService.resolveStaticResource(URI.from(uri)).codeUri;
  }
}
