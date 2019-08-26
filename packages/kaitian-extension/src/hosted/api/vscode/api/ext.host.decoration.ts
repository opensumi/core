import * as vscode from 'vscode';
import URI from 'vscode-uri';
import { CancellationToken } from '@ali/ide-core-common';
import { Disposable, toDisposable } from '@ali/ide-core-common/lib/disposable';
import { asArray } from '@ali/ide-core-common/lib/utils/arrays';
import { IRPCProtocol } from '@ali/ide-connection';
import { getLogger } from '@ali/ide-core-common';

import {
  IMainThreadDecorationsShape, DecorationRequest, DecorationReply,
  DecorationData, IExtHostDecorationsShape,
} from '../../../../common/vscode/decoration';
import { MainThreadAPIIdentifier } from '../../../../common/vscode';

interface ProviderData {
  provider: vscode.DecorationProvider;
  extensionId: string;
}

export class ExtHostDecorations implements IExtHostDecorationsShape {
  protected readonly proxy: IMainThreadDecorationsShape;
  protected readonly logger = getLogger();

  private static _handlePool = 0;

  private readonly _provider = new Map<number, ProviderData>();

  constructor(rpcProtocol: IRPCProtocol) {
    this.proxy = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadDecorations);
  }

  registerDecorationProvider(provider: vscode.DecorationProvider, extensionId: string): vscode.Disposable {
    this.logger.log('ExtHostDecoration#registerDecorationProvider', provider, extensionId);
    const handle = ExtHostDecorations._handlePool++;
    this._provider.set(handle, { provider, extensionId });
    this.proxy.$registerDecorationProvider(handle, extensionId);

    const listener = provider.onDidChangeDecorations((e) => {
      this.proxy.$onDidChange(handle, !e ? null : asArray(e));
    });

    return new Disposable(toDisposable(() => {
      listener.dispose();
      this.proxy.$unregisterDecorationProvider(handle);
      this._provider.delete(handle);
    }));
  }

  $provideDecorations(requests: DecorationRequest[], token: CancellationToken): Promise<DecorationReply> {
    const result: DecorationReply = Object.create(null);
    return Promise.all(requests.map((request) => {
      const { handle, uri, id } = request;
      const entry = this._provider.get(handle);
      if (!entry) {
        // might have been unregistered in the meantime
        return undefined;
      }
      const { provider, extensionId } = entry;
      return Promise.resolve(provider.provideDecoration(URI.revive(uri), token)).then((data) => {
        if (data && data.letter && data.letter.length !== 1) {
          console.warn(`INVALID decoration from extension '${extensionId}'. The 'letter' must be set and be one character, not '${data.letter}'.`);
        }
        if (data) {
          result[id] = [
            data.priority,
            data.bubble,
            data.title,
            data.letter,
            data.color,
            data.source,
          ] as DecorationData;
        }
      }, (err) => {
        console.error(err);
      });

    })).then(() => {
      return result;
    });
  }
}
