import type vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection';
import { arrays, strings, CancellationToken, Uri, toDisposable, getDebugLogger, path } from '@opensumi/ide-core-common';

import { MainThreadAPIIdentifier } from '../../../common/vscode';
import {
  IMainThreadDecorationsShape,
  DecorationRequest,
  DecorationReply,
  DecorationData,
  IExtHostDecorationsShape,
} from '../../../common/vscode/decoration';
import { FileDecoration } from '../../../common/vscode/ext-types';

const { asArray, groupBy } = arrays;
const { compare, count } = strings;
const { dirname } = path;

interface ProviderData {
  provider: vscode.FileDecorationProvider;
  extensionId: string;
}

function isFileDecorationProvider(provider: vscode.FileDecorationProvider): provider is vscode.FileDecorationProvider {
  return !!provider.onDidChangeFileDecorations || !!provider.provideFileDecoration;
}

export class ExtHostDecorations implements IExtHostDecorationsShape {
  protected readonly proxy: IMainThreadDecorationsShape;
  protected readonly logger = getDebugLogger();

  private static _handlePool = 0;
  private static _maxEventSize = 250;

  private readonly _provider = new Map<number, ProviderData>();

  constructor(rpcProtocol: IRPCProtocol) {
    this.proxy = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadDecorations);
  }

  registerFileDecorationProvider(provider: vscode.FileDecorationProvider, extensionId: string): vscode.Disposable {
    const handle = ExtHostDecorations._handlePool++;
    this._provider.set(handle, { provider, extensionId });
    this.proxy.$registerDecorationProvider(handle, extensionId);

    const listener =
      provider.onDidChangeFileDecorations &&
      provider.onDidChangeFileDecorations((e) => {
        if (!e) {
          this.proxy.$onDidChange(handle, null);
          return;
        }
        const array = asArray(e);
        if (array.length <= ExtHostDecorations._maxEventSize) {
          this.proxy.$onDidChange(handle, array);
          return;
        }

        // too many resources per event. pick one resource per folder, starting
        // with parent folders
        this.logger.warn('[Decorations] CAPPING events from decorations provider', extensionId, array.length);
        const mapped = array.map((uri) => ({ uri, rank: count(uri.path, '/') }));
        const groups = groupBy(mapped, (a, b) => a.rank - b.rank || compare(a.uri.path, b.uri.path));
        const picked: vscode.Uri[] = [];
        outer: for (const uris of groups) {
          let lastDirname: string | undefined;
          for (const obj of uris) {
            const myDirname = dirname(obj.uri.path);
            if (lastDirname !== myDirname) {
              lastDirname = myDirname;
              if (picked.push(obj.uri) >= ExtHostDecorations._maxEventSize) {
                break outer;
              }
            }
          }
        }
        this.proxy.$onDidChange(handle, picked);
      });

    return toDisposable(() => {
      listener?.dispose();
      this.proxy.$unregisterDecorationProvider(handle);
      this._provider.delete(handle);
    });
  }

  $provideFileDecorations(requests: DecorationRequest[], token: CancellationToken): Promise<DecorationReply> {
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
                this.logger.warn(`INVALID decoration from extension '${extensionId}': ${e}`);
              }
            },
            (err) => {
              this.logger.error(err);
            },
          );
        }
      }),
    ).then(() => result);
  }
}
