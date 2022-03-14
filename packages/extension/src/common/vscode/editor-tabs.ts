import type * as vscode from 'vscode';

import { Event, IDisposable, URI } from '@opensumi/ide-core-common';

export interface IEditorTabDto {
  group: number;
  name: string;
  resource: string;
  isActive: boolean;
}

export interface IExtHostEditorTabsShape {
  $acceptEditorTabs(tabs: IEditorTabDto[]): void;
}

export interface IEditorTab {
  name: string;
  group: number;
  resource: vscode.Uri;
  isActive: boolean;
}

export interface IExtHostEditorTabs extends IExtHostEditorTabsShape {
  readonly _serviceBrand: undefined;
  tabs: readonly IEditorTab[];
  onDidChangeTabs: Event<void>;
}

export type IMainThreadEditorTabsShape = IDisposable;

export const IExtHostEditorTabs = Symbol('IExtHostEditorTabs');
