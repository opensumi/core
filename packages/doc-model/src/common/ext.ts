import { IDocumentModelContentChange } from './doc';

export interface ExtensionDocumentModelChangedEvent {
  changes: IDocumentModelContentChange[];
  uri: string;
  versionId: number;
  eol: string;
  dirty: boolean;
}

export interface ExtensionDocumentModelOpenedEvent {
  uri: string;
  lines: string[];
  eol: string;
  versionId: number;
  languageId: string;
  dirty: boolean;
}

export interface ExtensionDocumentModelRemovedEvent {
  uri: string;
}

export interface ExtensionDocumentModelSavedEvent {
  uri: string;
}

export const ExtensionDocumentManagerProxy = Symbol('ExtensionDocumentManagerProxy');

export interface ExtensionDocumentDataManager {
  $fireModelChangedEvent(event: ExtensionDocumentModelChangedEvent): void;
  $fireModelOpenedEvent(event: ExtensionDocumentModelOpenedEvent): void;
  $fireModelRemovedEvent(event: ExtensionDocumentModelRemovedEvent): void;
  $fireModelSavedEvent(event: ExtensionDocumentModelSavedEvent): void;
}
