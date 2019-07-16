import { BasicEvent, URI } from '@ali/ide-core-browser';
import { IDocumentModelContentChange, Version } from '../common';

export class DocModelContentChangedEvent extends BasicEvent<IDocModelContentChangedEventPayload> {}

export interface IDocModelContentChangedEventPayload {
  uri: URI;
  dirty: boolean;
  changes: IDocumentModelContentChange[];
  eol: string;
  version: Version;
}

export class DocModelLanguageChangeEvent extends BasicEvent<IDocModelLanguageChangeEventPayload> {}

export interface IDocModelLanguageChangeEventPayload {
  uri: URI;
  languageId: string;
}

export class ExtensionDocumentModelChangingEvent extends BasicEvent<IExtensionDocumentModelChangingEvent> {}

export interface IExtensionDocumentModelChangingEvent {
  changes: IDocumentModelContentChange[];
  uri: string;
  eol: string;
  versionId: number;
  dirty: boolean;
}

export class ExtensionDocumentModelOpeningEvent extends BasicEvent<IExtensionDocumentModelOpeningEvent> {}

export interface IExtensionDocumentModelOpeningEvent {
  uri: string;
  lines: string[];
  eol: string;
  versionId: number;
  languageId: string;
  dirty: boolean;
}

export class ExtensionDocumentModelRemovingEvent extends BasicEvent<IExtensionDocumentModelRemovingEvent> {}

export interface IExtensionDocumentModelRemovingEvent {
  uri: string;
}

export class ExtensionDocumentModelSavingEvent extends BasicEvent<IExtensionDocumentModelSavingEvent> {}

export interface IExtensionDocumentModelSavingEvent {
  uri: string;
}
