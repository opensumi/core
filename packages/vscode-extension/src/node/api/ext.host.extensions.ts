import * as vscode from 'vscode';
import * as path from 'path';

export interface ExtenstionContextOptions {
  extensionPath: string;
}

export class ExtenstionContext implements vscode.ExtensionContext {

  readonly subscriptions: { dispose(): any }[] = [];

  readonly extensionPath: string;

  // TODO
  readonly workspaceState: vscode.Memento;

  // TODO
  readonly globalState: vscode.Memento;

  // TODO
  readonly storagePath: string | undefined;

  // TODO
  readonly globalStoragePath: string;

  // TODO
  readonly logPath: string;

  constructor(options: ExtenstionContextOptions) {
    const { extensionPath } = options;

    this.extensionPath = extensionPath;
  }

  asAbsolutePath(relativePath: string): string {
    return path.join(this.extensionPath, relativePath);
  }
}
