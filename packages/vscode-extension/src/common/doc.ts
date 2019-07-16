import {
  IDocumentModelContentChange,
  ExtensionDocumentDataManager as ExtensionDocumentDataManagerProxy,
} from '@ali/ide-doc-model';
import { IDisposable } from '@ali/ide-core-common';

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

export const MainThreadDocumentsShape = Symbol('MainThreadDocumentsShape');

export interface MainThreadDocumentsShape extends IDisposable {
  $tryCreateDocument(options?: { language?: string; content?: string; }): Promise<string>;
  $tryOpenDocument(uri: string): Promise<void>;
  $trySaveDocument(uri: string): Promise<boolean>;
}

export const ExtensionDocumentDataManager = Symbol('ExtensionDocumentDataManager');

// tslint:disable-next-line:no-empty-interface
export interface ExtensionDocumentDataManager extends ExtensionDocumentDataManagerProxy {

}
