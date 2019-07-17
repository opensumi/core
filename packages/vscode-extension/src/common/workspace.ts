import { IDisposable, WorkspaceRootsChangeEvent } from './ext-types';
import * as vscode from 'vscode';

export interface IMainThreadWorkspace extends IDisposable {
  $getWorkspaceFolders(): Promise<vscode.WorkspaceFolder[]>;
  // $updateWorkspaceFolders(start: number, deleteCount?: number, ...rootsToAdd: string[]): Promise<void>;
}

export interface IExtHostWorkspace {
  $onWorkspaceFoldersChanged(event: WorkspaceRootsChangeEvent): void;
}
