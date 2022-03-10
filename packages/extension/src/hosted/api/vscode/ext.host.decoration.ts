import type vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection';
import { Uri } from '@opensumi/ide-core-common';
import { CancellationToken } from '@opensumi/ide-core-common';
import { getDebugLogger } from '@opensumi/ide-core-common';
import { toDisposable } from '@opensumi/ide-core-common/lib/disposable';
import { asArray } from '@opensumi/ide-core-common/lib/utils/arrays';

import { MainThreadAPIIdentifier } from '../../../common/vscode';
import {
  IMainThreadDecorationsShape,
  DecorationRequest,
  DecorationReply,
  DecorationData,
  IExtHostDecorationsShape,
} from '../../../common/vscode/decoration';
import { FileDecoration } from '../../../common/vscode/ext-types';

interface ProviderData {
  provider: vscode.FileDecorationProvider | vscode.DecorationProvider;
  extensionId: string;
}

function isFileDecorationProvider(
  provider: vscode.FileDecorationProvider | vscode.DecorationProvider,
): provider is vscode.FileDecorationProvider {
  return (
    !!(provider as vscode.FileDecorationProvider).onDidChange ||
    !!(provider as vscode.FileDecorationProvider).onDidChangeFileDecorations ||
    !!(provider as vscode.FileDecorationProvider).provideFileDecoration
  );
}

export class ExtHostDecorations implements IExtHostDecorationsShape {
  protected readonly proxy: IMainThreadDecorationsShape;
  protected readonly logger = getDebugLogger();

  private static _handlePool = 0;

  private readonly _provider = new Map<number, ProviderData>();

  constructor(rpcProtocol: IRPCProtocol) {
    this.proxy = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadDecorations);
  }

  registerFileDecorationProvider(
    provider: vscode.FileDecorationProvider | vscode.DecorationProvider,
    extensionId: string,
  ): vscode.Disposable {
    const handle = ExtHostDecorations._handlePool++;
    this._provider.set(handle, { provider, extensionId });
    this.proxy.$registerDecorationProvider(handle, extensionId);

    // handle listener
    let listener: vscode.Disposable;
    if (isFileDecorationProvider(provider)) {
      this.logger.verbose('ExtHostDecoration#registerFileDecorationProvider', extensionId);
      if (provider.onDidChange) {
        listener = provider.onDidChange((e) => {
          this.proxy.$onDidChange(handle, !e ? null : asArray(e));
        });
      }
      // 1.55 API，后续被废弃掉了，为了兼容先保留
      if (provider.onDidChangeFileDecorations) {
        listener = provider.onDidChangeFileDecorations((e) => {
          this.proxy.$onDidChange(handle, !e ? null : asArray(e));
        });
      }
    } /* 这条分支后续可清理掉 */ else {
      this.logger.verbose('ExtHostDecoration#registerDecorationProvider', extensionId);
      listener =
        provider.onDidChangeDecorations &&
        provider.onDidChangeDecorations((e) => {
          this.proxy.$onDidChange(handle, !e ? null : asArray(e));
        });
    }

    return toDisposable(() => {
      listener?.dispose();
      this.proxy.$unregisterDecorationProvider(handle);
      this._provider.delete(handle);
    });
  }

  $provideDecorations(requests: DecorationRequest[], token: CancellationToken): Promise<DecorationReply> {
    const result: DecorationReply = Object.create(null);
    return Promise.all(
      requests.map((request) => {
        const { handle, uri, id } = request;
        const entry = this._provider.get(handle);
        if (!entry) {
          // might have been unregistered in the meantime
          return undefined;
        }
        const { provider, extensionId } = entry;
        if (isFileDecorationProvider(provider)) {
          return Promise.resolve(provider.provideFileDecoration(Uri.revive(uri), token)).then(
            (data) => {
              if (!data) {
                return;
              }

              try {
                FileDecoration.validate(data);
                result[id] = [data.propagate, data.tooltip, data.badge, data.color] as DecorationData;
              } catch (e) {
                getDebugLogger().warn(`INVALID decoration from extension '${extensionId}': ${e}`);
              }
            },
            (err) => {
              getDebugLogger().error(err);
            },
          );
        } /* 这条分支后续可清理掉, 兼容老的 DecorationProvider */ else {
          return Promise.resolve(provider.provideDecoration(Uri.revive(uri), token)).then(
            (data) => {
              if (data && data.letter && data.letter.length !== 1) {
                getDebugLogger().warn(
                  `INVALID decoration from extension '${extensionId}'. The 'letter' must be set and be one character, not '${data.letter}'.`,
                );
              }
              if (data) {
                result[id] = [data.bubble, data.title, data.letter, data.color] as DecorationData;
              }
            },
            (err) => {
              getDebugLogger().error(err);
            },
          );
        }
      }),
    ).then(() => result);
  }
}
