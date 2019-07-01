import { BasicEvent, URI } from '@ali/ide-core-browser';
import { IDocumentModelContentChange } from '../common';

export class DocModelContentChangedEvent extends BasicEvent<IDocModelContentChangedEventPayload> {}

export interface IDocModelContentChangedEventPayload {
  uri: URI;
  changes: IDocumentModelContentChange[];
  dirty: boolean;
}

export class DocModelLanguageChangeEvent extends BasicEvent<IDocModelLanguageChangeEventPayload> {}

export interface IDocModelLanguageChangeEventPayload {
  uri: URI;
  languageId: string;
}
