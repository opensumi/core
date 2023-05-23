import type vscode from 'vscode';

import { Injectable, Optional, Autowired } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { IOpenerService, IClipboardService, IExternalUriService, AppConfig } from '@opensumi/ide-core-browser';
import { HttpOpener } from '@opensumi/ide-core-browser/lib/opener/http-opener';
import { getCodeLanguage, URI, firstSessionDateStorageKey, IApplicationService } from '@opensumi/ide-core-common';
import { ILoggerManagerClient } from '@opensumi/ide-logs/lib/browser';

import { IMainThreadEnv, IExtHostEnv, ExtHostAPIIdentifier } from '../../../common/vscode';
import { UIKind, UriComponents } from '../../../common/vscode/ext-types';

import { MainThreadStorage } from './main.thread.storage';

@Injectable({ multiple: true })
export class MainThreadEnv implements IMainThreadEnv {
  @Autowired(ILoggerManagerClient)
  loggerManger: ILoggerManagerClient;

  private eventDispose;
  private readonly proxy: IExtHostEnv;

  @Autowired(IOpenerService)
  private readonly openerService: IOpenerService;

  @Autowired(IClipboardService)
  private readonly clipboardService: IClipboardService;

  @Autowired(IExternalUriService)
  private readonly externalUriService: IExternalUriService;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(IApplicationService)
  protected readonly applicationService: IApplicationService;

  // 检测下支持的协议，以防打开内部协议
  // 支持 http/https/mailto/projectScheme 协议
  private isSupportedLink(uri: URI) {
    return HttpOpener.standardSupportedLinkSchemes.has(uri.scheme) || uri.scheme === this.appConfig.uriScheme;
  }

  constructor(@Optional(IRPCProtocol) private rpcProtocol: IRPCProtocol, private storage: MainThreadStorage) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostEnv);

    this.eventDispose = this.loggerManger.onDidChangeLogLevel((level) => {
      this.proxy.$fireChangeLogLevel(level);
    });
    this.setLogLevel();

    this.setEnvValues();
  }

  async setEnvValues() {
    const { appName, uriScheme, appHost, appRoot } = this.appConfig;
    const firstSessionDateValue = await this.storage.$getValue(true, firstSessionDateStorageKey);

    this.proxy.$setEnvValues({
      appName,
      uriScheme,
      appHost,
      appRoot,
      language: getCodeLanguage(),
      uiKind: this.appConfig.isElectronRenderer ? UIKind.Desktop : UIKind.Web,
      firstSessionDate: firstSessionDateValue?.date,
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
    return new Promise<void>(async (resolve) => {
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

  private getWindowId() {
    return this.applicationService.clientId;
  }

  async $asExternalUri(target: vscode.Uri): Promise<UriComponents> {
    const { uriScheme } = this.appConfig;
    const uri = URI.from(target);
    // 如果是 appUriScheme，则在 query 加入当前 windowId
    if (uri.scheme === uriScheme) {
      const windowId = this.getWindowId();
      let query = uri.query;
      if (!query) {
        query = `windowId=${windowId}`;
      } else {
        query += `&windowId=${windowId}`;
      }
      return uri.withQuery(query).codeUri;
    }
    const externalUri = this.externalUriService.resolveExternalUri(uri);
    return externalUri.codeUri;
  }
}
