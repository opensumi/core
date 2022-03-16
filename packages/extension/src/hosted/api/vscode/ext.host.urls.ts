import type vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection';
import { Uri, toDisposable, onUnexpectedError } from '@opensumi/ide-core-common';

import { IExtHostUrls, IMainThreadUrls, MainThreadAPIIdentifier } from '../../../common/vscode';
import { UriComponents } from '../../../common/vscode/ext-types';

export class ExtHostUrls implements IExtHostUrls {
  private static HandlePool = 0;
  private readonly _proxy: IMainThreadUrls;

  private handles = new Set<string>();
  private handlers = new Map<number, vscode.UriHandler>();

  constructor(rpcProtocol: IRPCProtocol) {
    this._proxy = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadUrls);
  }

  registerUriHandler(extensionId: string, handler: vscode.UriHandler): vscode.Disposable {
    if (this.handles.has(extensionId)) {
      throw new Error(`Protocol handler already registered for extension ${extensionId}`);
    }

    const handle = ExtHostUrls.HandlePool++;
    this.handles.add(extensionId);
    this.handlers.set(handle, handler);
    this._proxy.$registerUriHandler(handle, extensionId);

    return toDisposable(() => {
      this.handles.delete(extensionId);
      this.handlers.delete(handle);
      this._proxy.$unregisterUriHandler(handle);
    });
  }

  $handleExternalUri(handle: number, uri: UriComponents): Promise<void> {
    const handler = this.handlers.get(handle);
    if (!handler) {
      return Promise.resolve(undefined);
    }
    try {
      handler.handleUri(Uri.revive(uri));
    } catch (err) {
      onUnexpectedError(err);
    }

    return Promise.resolve(undefined);
  }
}
