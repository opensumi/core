import {
  IDocumentModelContentChange,
  ExtensionDocumentDataManager as ExtensionDocumentDataManagerProxy,
} from '@ali/ide-doc-model';
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

export const ExtensionDocumentDataManager = Symbol('ExtensionDocumentDataManager');

// tslint:disable-next-line:no-empty-interface
export interface ExtensionDocumentDataManager extends ExtensionDocumentDataManagerProxy {
  getDocumentData(resource: URI): any;
}
