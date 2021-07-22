import { CancellationToken, IDisposable, UriComponents } from '@ali/ide-core-common';
import type * as vscode from 'vscode';

import { ThemeColor } from './ext-types';

export interface DecorationRequest {
  readonly id: number;
  readonly handle: number;
  readonly uri: UriComponents;
}

// 去掉了第一个 weight 字段和最后一个 source 字段
// type DecorationData = [number, boolean, string, string, ThemeColor, string];

export type DecorationData = [boolean, string, string, ThemeColor];
export interface DecorationReply {
  [id: number]: DecorationData;
}

export interface IExtHostDecorationsShape {
  registerFileDecorationProvider(provider: vscode.FileDecorationProvider | vscode.DecorationProvider, extensionId: string): vscode.Disposable;
  $provideDecorations(requests: DecorationRequest[], token: CancellationToken): Promise<DecorationReply>;
}

export interface IMainThreadDecorationsShape extends IDisposable {
  $registerDecorationProvider(handle: number, label: string): void;
  $unregisterDecorationProvider(handle: number): void;
  $onDidChange(handle: number, resources: UriComponents[] | null): void;
}
