import type vscode from 'vscode';
import { IDisposable, Event } from '@opensumi/ide-core-common';
import { Uri } from './ext-types';
import { SaveReason, IEditorDocumentModelContentChange } from '@opensumi/ide-editor';

export interface IModelChangedEvent {
  /**
   * The actual changes.
   */
  readonly changes: IEditorDocumentModelContentChange[];
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
  $unregisterDocumentProviderWithScheme(scheme: string);
  $registerDocumentProviderWithScheme(scheme: string);
  $tryCreateDocument(options?: { language?: string; content?: string; }): Promise<string>;
  $tryOpenDocument(uri: string): Promise<void>;
  $trySaveDocument(uri: string): Promise<boolean>;

  // internal
  $fireTextDocumentChangedEvent(path: string, content: string): Promise<void>;
}

// tslint:disable-next-line:no-empty-interface
export interface ExtensionDocumentDataManager extends IExtensionHostDocService {
  getDocument(resource: Uri | string): vscode.TextDocument | undefined;
  getDocumentData(resource: Uri | string): any;
  getAllDocument(): vscode.TextDocument[];
  openTextDocument(path: Uri | string): Promise<vscode.TextDocument | undefined>;
  registerTextDocumentContentProvider(scheme: string, provider: vscode.TextDocumentContentProvider): IDisposable;
  onDidOpenTextDocument: Event<vscode.TextDocument>;
  onDidCloseTextDocument: Event<vscode.TextDocument>;
  onDidChangeTextDocument: Event<vscode.TextDocumentChangeEvent>;
  onWillSaveTextDocument: Event<vscode.TextDocumentWillSaveEvent>;
  onDidSaveTextDocument: Event<vscode.TextDocument>;
  setWordDefinitionFor(modeId: string, wordDefinition: RegExp | undefined): void;

}

export interface IExtensionDocumentModelChangedEvent {
  changes: IEditorDocumentModelContentChange[];
  uri: string;
  versionId: number;
  eol: string;
  dirty: boolean;
}

export interface IExtensionDocumentModelOptionsChangedEvent {
  uri: string;
  encoding?: string;
  languageId?: string;
}

export interface IExtensionDocumentModelOpenedEvent {
  uri: string;
  lines: string[];
  eol: string;
  versionId: number;
  languageId: string;
  dirty: boolean;
}

export interface IExtensionDocumentModelRemovedEvent {
  uri: string;
}

export interface IExtensionDocumentModelSavedEvent {
  uri: string;
}

export interface IExtensionDocumentModelWillSaveEvent {
  uri: string;
  reason: SaveReason;
}

export const ExtensionDocumentManagerProxy = Symbol('ExtensionDocumentManagerProxy');

export interface IExtensionHostDocService {
  $fireModelOptionsChangedEvent(event: IExtensionDocumentModelOptionsChangedEvent): void;
  $fireModelChangedEvent(event: IExtensionDocumentModelChangedEvent): void;
  $fireModelOpenedEvent(event: IExtensionDocumentModelOpenedEvent): void;
  $fireModelRemovedEvent(event: IExtensionDocumentModelRemovedEvent): void;
  $fireModelSavedEvent(event: IExtensionDocumentModelSavedEvent): void;
  $fireModelWillSaveEvent(e: IExtensionDocumentModelWillSaveEvent): Promise<void>;
  $provideTextDocumentContent(path: string, encoding?: string): Promise<string>;
}
