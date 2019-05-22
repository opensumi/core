import { Injectable } from '@ali/common-di';
import { URI } from '@ali/ide-core-common';
export * from './commands';

export class CommonCls {
  add(a: number, b: number) {
    return a + b;
  }
}

export interface IResource {
  name: string;
  uri: URI;
}

export interface IEditor {

  /**
   * editor的UID
   */
  uid: string;

  /**
   * editor中打开的documentModel
   */
  currentDocumentModel: any;

  layout(): void;

  open(uri: URI): Promise<void>;

}

@Injectable()
export abstract class EditorCollectionService {
  public abstract async createEditor(uid: string, dom: HTMLElement, options?: any): Promise<IEditor>;
}

export interface IEditorGroup {

  name: string;

  createEditor: (dom: HTMLElement) => Promise<void>;

  codeEditor: IEditor;

}

export abstract class WorkbenchEditorService {
  // TODO
  editorGroups: IEditorGroup[];

  abstract async openResource(resource: IResource): Promise<void>;
}
