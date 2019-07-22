import * as vscode from 'vscode';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { IMainThreadEnv, IExtHostEnv, ExtHostAPIIdentifier } from '../../common/';
import {
  ClientAppConfigProvider,
} from '@ali/ide-core-browser';
import {
  getLanguageAlias,
} from '@ali/ide-core-common';

@Injectable()
export class MainThreadEnv implements IMainThreadEnv {
  private readonly proxy: IExtHostEnv;

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostEnv);

    this.proxy.$setEnvValues({
      appName: ClientAppConfigProvider.get().applicationName,
      uriScheme: ClientAppConfigProvider.get().uriScheme,
      language: getLanguageAlias(),
    });
  }

  $clipboardReadText() {
    return navigator.clipboard.readText();
  }

  $clipboardWriteText(text): Thenable<void> {
    return navigator.clipboard.writeText(text);
  }

  $openExternal(target: vscode.Uri): Thenable<boolean> {
    window.open(target.toString());
    return Promise.resolve(true);
  }
}
