import { Injectable } from '@ali/common-di';
import { URI } from '@ali/ide-core-common';
import { IResource } from './resource';
import { DocumentModel } from '@ali/ide-doc-model';

export interface IEditor {

  /**
   * editor的UID
   */
  uid: string;

  /**
   * editor中打开的documentModel
   */
  currentDocumentModel: DocumentModel;

  layout(): void;

  open(uri: URI): Promise<void>;

}

@Injectable()
export abstract class EditorCollectionService {
  public abstract async createEditor(uid: string, dom: HTMLElement, options?: any): Promise<IEditor>;
}

export interface IEditorGroup {

  name: string;

  codeEditor: IEditor;

  open(uri: URI): Promise<void>;

}

export abstract class WorkbenchEditorService {
  // TODO
  editorGroups: IEditorGroup[];

  currentEditor: IEditor | undefined;

  abstract async open(uri: URI): Promise<void>;
}
