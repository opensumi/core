import { IDocumentModelContentChange } from './doc';

export const ExtensionDocumentManagerProxy = Symbol('ExtensionDocumentManagerProxy');

export interface ExtensionDocumentDataManager {
  fireModelChangedEvent(event: ExtentionDocumentModelChangedEvent): void;
}

export interface ExtentionDocumentModelChangedEvent {
  changes: IDocumentModelContentChange[];
  uri: string;
  versionId: number;
  eol: string;
  dirty: boolean;
}
