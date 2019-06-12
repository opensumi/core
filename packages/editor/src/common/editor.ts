import { Injectable } from '@ali/common-di';
import { URI, Event, BasicEvent, IDisposable } from '@ali/ide-core-common';
import { IResource } from './resource';
import { DocumentModel } from '@ali/ide-doc-model';
import { IRange } from '@ali/ide-doc-model/lib/common/doc';

/**
 * 一个IEditor代表了一个最小的编辑器单元，可以是CodeEditor中的一个，也可以是DiffEditor中的两个
 */
export interface IEditor {

  getId(): string;
  /**
   * editor中打开的documentModel
   */

  currentDocumentModel: DocumentModel | null;

  currentUri: URI | null;

}

export interface ICodeEditor extends IEditor, IDisposable {

  layout(): void;

  /**
   * 打开一个uri
   * @param uri
   */
  open(uri: URI): Promise<void>;

}

/**
 * Diff 编辑器抽象
 */
export interface IDiffEditor extends IDisposable {

  compare(original: URI, modified: URI);

  originalEditor: IEditor;

  modifiedEditor: IEditor;

  layout(): void;

}

@Injectable()
export abstract class EditorCollectionService {
  public abstract async createCodeEditor(dom: HTMLElement, options?: any): Promise<ICodeEditor>;
  public abstract async createDiffEditor(dom: HTMLElement, options?: any): Promise<IDiffEditor>;
  public abstract listEditors(): IEditor[];
}

/**
 * 当前显示的Editor列表发生变化时
 */
export class CollectionEditorsUpdateEvent extends BasicEvent<IEditor[]> {}

/**
 * 当EditorGroup中打开的uri发生改变时
 */
export class DidChangeEditorGroupUriEvent extends BasicEvent<URI[][]> {}

export interface IEditorGroup {

  name: string;

  codeEditor: ICodeEditor;

  resources: IResource[];

  open(uri: URI): Promise<void>;

  close(uri: URI): Promise<void>;

}

export abstract class WorkbenchEditorService {
  onEditorOpenChange: Event<URI>;

  // TODO
  editorGroups: IEditorGroup[];

  currentEditor: IEditor | null;

  abstract async open(uri: URI): Promise<void>;
}

export interface IResourceOpenOptions {
  range?: IRange;
  index?: number;
}
