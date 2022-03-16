import type vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection';
import { Emitter, Event, IExtensionProps } from '@opensumi/ide-core-common';

import {
  ExtensionIdentifier,
  IExtHostSecret,
  IMainThreadSecret,
  MainThreadAPIIdentifier,
} from '../../../common/vscode';

export class ExtensionSecrets implements vscode.SecretStorage {
  protected readonly _id: string;
  private readonly _secret: ExtHostSecret;

  private _onDidChange = new Emitter<vscode.SecretStorageChangeEvent>();
  readonly onDidChange: Event<vscode.SecretStorageChangeEvent> = this._onDidChange.event;

  constructor(extensionDescription: IExtensionProps, secret: ExtHostSecret) {
    this._id = ExtensionIdentifier.toKey(extensionDescription.id);
    this._secret = secret;

    this._secret.onDidChangePassword((e) => {
      if (e.extensionId === this._id) {
        this._onDidChange.fire({ key: e.key });
      }
    });
  }

  get(key: string): Promise<string | undefined> {
    return this._secret.get(this._id, key);
  }

  store(key: string, value: string): Promise<void> {
    return this._secret.store(this._id, key, value);
  }

  delete(key: string): Promise<void> {
    return this._secret.delete(this._id, key);
  }
}

export class ExtHostSecret implements IExtHostSecret {
  private _proxy: IMainThreadSecret;
  private _onDidChangePassword = new Emitter<{ extensionId: string; key: string }>();
  readonly onDidChangePassword = this._onDidChangePassword.event;

  constructor(rpc: IRPCProtocol) {
    this._proxy = rpc.getProxy(MainThreadAPIIdentifier.MainThreadSecret);
  }

  async $onDidChangePassword(e: { extensionId: string; key: string }): Promise<void> {
    this._onDidChangePassword.fire(e);
  }

  get(extensionId: string, key: string): Promise<string | undefined> {
    return this._proxy.$getPassword(extensionId, key);
  }

  store(extensionId: string, key: string, value: string): Promise<void> {
    return this._proxy.$setPassword(extensionId, key, value);
  }

  delete(extensionId: string, key: string): Promise<void> {
    return this._proxy.$deletePassword(extensionId, key);
  }
}
