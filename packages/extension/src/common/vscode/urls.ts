import type vscode from 'vscode';

import { IDisposable } from '@opensumi/ide-core-common';

import { UriComponents } from './ext-types';

export interface IMainThreadUrls extends IDisposable {
  $registerUriHandler(handle: number, extensionId: string): Promise<void>;
  $unregisterUriHandler(handle: number): Promise<void>;
}

export interface IExtHostUrls {
  registerUriHandler(extensionId: string, handler: vscode.UriHandler): IDisposable;
  $handleExternalUri(handle: number, uri: UriComponents): Promise<void>;
}
