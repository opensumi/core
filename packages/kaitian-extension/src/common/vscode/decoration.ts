import { CancellationToken, IDisposable } from '@ali/ide-core-common';
import { UriComponents } from 'vscode-uri';
import * as vscode from 'vscode';

import { ThemeColor } from './ext-types';
import { ExtensionIdentifier } from './extension';

export interface DecorationRequest {
  readonly id: number;
  readonly handle: number;
  readonly uri: UriComponents;
}

export type DecorationData = [number, boolean, string, string, ThemeColor, string];
export interface DecorationReply {
  [id: number]: DecorationData;
}

export interface IExtHostDecorationsShape {
  registerDecorationProvider(provider: vscode.DecorationProvider, extensionId: string): vscode.Disposable;
  $provideDecorations(requests: DecorationRequest[], token: CancellationToken): Promise<DecorationReply>;
}

export interface IMainThreadDecorationsShape extends IDisposable {
  $registerDecorationProvider(handle: number, label: string): void;
  $unregisterDecorationProvider(handle: number): void;
  $onDidChange(handle: number, resources: UriComponents[] | null): void;
}
