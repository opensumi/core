import * as vscode from 'vscode';
import {
  IDocumentModelContentChange,
  ExtensionDocumentDataManager as ExtensionDocumentDataManagerProxy,
} from '@ali/ide-doc-model/lib/common';
import { IDisposable, Event } from '@ali/ide-core-common';
import URI from 'vscode-uri';

export interface IModelChangedEvent {
  /**
	 * The actual changes.
	 */
  readonly changes: IDocumentModelContentChange[];
  /**
	 * The (new) end-of-line character.
	 */
  readonly eol: string;
  /**
	 * The new version id the model has transitioned to.
	 */
  readonly versionId: number;
}

export interface IMainThreadDocumentsShape extends IDisposable {
  $tryCreateDocument(options?: { language?: string; content?: string; }): Promise<string>;
  $tryOpenDocument(uri: string): Promise<void>;
  $trySaveDocument(uri: string): Promise<boolean>;
}

// tslint:disable-next-line:no-empty-interface
export interface ExtensionDocumentDataManager extends ExtensionDocumentDataManagerProxy {
  getDocument(resource: URI | string): vscode.TextDocument | undefined;
  getDocumentData(resource: URI | string): any;
  openTextDocument(path: URI | string): Promise<vscode.TextDocument | undefined>;
  onDidOpenTextDocument: Event<vscode.TextDocument>;
  onDidCloseTextDocument: Event<vscode.TextDocument>;
  onDidChangeTextDocument: Event<vscode.TextDocumentChangeEvent>;
  onWillSaveTextDocument: Event<vscode.TextDocument>;
  onDidSaveTextDocument: Event<vscode.TextDocument>;
}
