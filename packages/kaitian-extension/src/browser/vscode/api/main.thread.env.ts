import * as vscode from 'vscode';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { IMainThreadEnv, IExtHostEnv, ExtHostAPIIdentifier } from '../../../common/vscode';
import {
  ClientAppConfigProvider,
} from '@ali/ide-core-browser';
import {
  getLanguageId,
} from '@ali/ide-core-common';

@Injectable()
export class MainThreadEnv implements IMainThreadEnv {
  private readonly proxy: IExtHostEnv;

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostEnv);

    this.proxy.$setEnvValues({
      appName: ClientAppConfigProvider.get().applicationName,
      uriScheme: ClientAppConfigProvider.get().uriScheme,
      language: getLanguageId(),
    });
  }

  async $clipboardReadText() {
    try {
      const value = await navigator.clipboard.readText();
      return value;
    } catch (e) {
      return '';
    }
  }

  $clipboardWriteText(text): Thenable<void> {
    return new Promise(async (resolve) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {}
      resolve();
    });
  }

  $openExternal(target: vscode.Uri): Thenable<boolean> {
    window.open(`${target.scheme}:${target.authority || ''}${target.path || ''}`);
    return Promise.resolve(true);
  }
}
