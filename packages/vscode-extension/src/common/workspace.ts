import * as vscode from 'vscode';
import { IDisposable } from '@ali/ide-core-common';

export interface IMainThreadWorkspace extends IDisposable {
  $getWorkspaceFolders(): Promise<vscode.WorkspaceFolder[]>;
  // $updateWorkspaceFolders(start: number, deleteCount?: number, ...rootsToAdd: string[]): Promise<void>;
}

export interface IExtHostWorkspace {
  $onWorkspaceFoldersChanged(event: any): void;
}
