import { Injectable } from '@ali/common-di';

export class CommonCls {
  add(a: number, b: number) {
    return a + b;
  }
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

}

@Injectable()
export abstract class EditorCollectionService {

  public abstract async createEditor(uid: string, dom: HTMLElement, options?: any): Promise<IEditor>;

  constructor () {
    debugger;
  }

}

export interface IEditorGroup {

  name: string;

  createEditor: (dom: HTMLElement) => Promise<void>;

  codeEditor: IEditor;

}

@Injectable()
export abstract class WorkbenchEditorService {
  // TODO
  editorGroups: IEditorGroup[];

  createMainEditorGroup: () => Promise<void>;
}