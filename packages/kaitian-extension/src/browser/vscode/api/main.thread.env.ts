import * as vscode from 'vscode';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { ILoggerManagerClient } from '@ali/ide-logs/lib/browser';
import { IMainThreadEnv, IExtHostEnv, ExtHostAPIIdentifier } from '../../../common/vscode';
import { ClientAppConfigProvider, IOpenerService, IClipboardService } from '@ali/ide-core-browser';
import { getLanguageId, URI } from '@ali/ide-core-common';
import { HttpOpener } from '@ali/ide-core-browser/lib/opener/http-opener';

@Injectable({multiple: true})
export class MainThreadEnv implements IMainThreadEnv {
  @Autowired(ILoggerManagerClient)
  loggerManger: ILoggerManagerClient;

  private eventDispose;
  private readonly proxy: IExtHostEnv;

  @Autowired(IOpenerService)
  private readonly openerService: IOpenerService;

  @Autowired(IClipboardService)
  private readonly clipboardService: IClipboardService;

  // 检测下支持的协议，以防打开内部协议
  // 支持 http/https/mailto/projectScheme 协议
  private isSupportedLink(uri: URI) {
    return HttpOpener.standardSupportedLinkSchemes.has(uri.scheme) || uri.scheme === ClientAppConfigProvider.get().uriScheme;
  }

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostEnv);

    this.eventDispose = this.loggerManger.onDidChangeLogLevel((level) => {
      this.proxy.$fireChangeLogLevel(level);
    });
    this.setLogLevel();
    this.proxy.$setEnvValues({
      appName: ClientAppConfigProvider.get().applicationName,
      uriScheme: ClientAppConfigProvider.get().uriScheme,
      language: getLanguageId(),
    });
  }

  public dispose() {
    this.eventDispose.dispose();
  }

  private async setLogLevel() {
    const value = await this.loggerManger.getGlobalLogLevel();
    await this.proxy.$setLogLevel(value);
  }

  async $clipboardReadText() {
    try {
      const value = await this.clipboardService.readText();
      return value;
    } catch (e) {
      return '';
    }
  }

  $clipboardWriteText(text): Thenable<void> {
    return new Promise(async (resolve) => {
      try {
        await this.clipboardService.writeText(text);
      } catch (e) {}
      resolve();
    });
  }

  async $openExternal(target: vscode.Uri): Promise<boolean> {
    if (this.isSupportedLink(URI.from(target))) {
      return await this.openerService.open(target.toString(true));
    }
    return false;
  }
}
