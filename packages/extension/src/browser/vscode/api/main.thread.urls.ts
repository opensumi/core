import { Injectable, Optional, Autowired } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  IOpenerService,
  IDisposable,
  IOpener,
  URI,
  MaybePromise,
  ILogger,
  AppConfig,
} from '@opensumi/ide-core-browser';

import { IMainThreadUrls, IExtHostUrls, ExtHostAPIIdentifier } from '../../../common/vscode';
import { IActivationEventService } from '../../types';

class ExtennsionUrlHandler {
  constructor(
    private readonly proxy: IExtHostUrls,
    private readonly handle: number,
    private readonly extensionId: string,
  ) {}

  public async handleURL(uri: URI) {
    // 要执行的 uri 的authority 必须是当前 extension Id
    if (this.extensionId !== uri.authority) {
      return false;
    }
    await this.proxy.$handleExternalUri(this.handle, uri.codeUri);
    return true;
  }
}

@Injectable()
class ExtensionOpener implements IOpener, IDisposable {
  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(AppConfig)
  private readonly config: AppConfig;

  @Autowired()
  private activationEventService: IActivationEventService;

  private extensionUrlHandlers = new Map<string, ExtennsionUrlHandler>();

  async open(uri: URI): Promise<boolean> {
    let result = false;
    const extensionId = uri.authority;
    const handler = this.extensionUrlHandlers.get(extensionId);
    // 如果没有处理函数，则继续走下一个 opener 逻辑
    if (handler) {
      try {
        result = await handler.handleURL(uri);
      } catch (e) {
        this.logger.error(e);
      }
    }
    await this.activationEventService.fireEvent('onUri', extensionId);
    return result;
  }

  handleScheme(scheme: string): MaybePromise<boolean> {
    return scheme === this.config.uriScheme;
  }

  registerExtensionHandler(handle: number, extensionId: string, proxy: IExtHostUrls): IDisposable {
    const extensionUrlHandler = new ExtennsionUrlHandler(proxy, handle, extensionId);
    this.extensionUrlHandlers.set(extensionId, extensionUrlHandler);
    return {
      dispose: () => {
        this.extensionUrlHandlers.delete(extensionId);
      },
    };
  }

  dispose() {
    this.extensionUrlHandlers.clear();
  }
}

@Injectable({ multiple: true })
export class MainThreadUrls implements IMainThreadUrls {
  private readonly proxy: IExtHostUrls;

  @Autowired(IOpenerService)
  private readonly openerService: IOpenerService;

  @Autowired(ExtensionOpener)
  private readonly extensionOpener: ExtensionOpener;

  private handlers = new Map<number, IDisposable>();

  constructor(@Optional(IRPCProtocol) rpcProtocol: IRPCProtocol) {
    this.proxy = rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostUrls);
    this.openerService.registerOpener(this.extensionOpener);
  }

  async $registerUriHandler(handle: number, extensionId: string): Promise<void> {
    this.handlers.set(handle, this.extensionOpener.registerExtensionHandler(handle, extensionId, this.proxy));
  }

  async $unregisterUriHandler(handle: number): Promise<void> {
    const disposer = this.handlers.get(handle);

    if (disposer) {
      disposer.dispose();
      this.handlers.delete(handle);
    }
  }

  dispose(): void {
    this.handlers.clear();
    this.extensionOpener.dispose();
  }
}
