import { Injectable } from '@ali/common-di';
import { URI, Event, BasicEvent, IDisposable, MaybeNull } from '@ali/ide-core-common';
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

  // TODO monaco.position和lsp的是不兼容的？
  onCursorPositionChanged: Event<monaco.Position | null>;

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
  onActiveResourceChange: Event<MaybeNull<IResource>>;

  onCursorChange: Event<MaybeNull<monaco.Position>>;

  // TODO
  editorGroups: IEditorGroup[];

  currentEditor: IEditor | null;

  abstract async open(uri: URI): Promise<void>;
}

export interface IResourceOpenOptions {
  range?: IRange;
  index?: number;
}

export interface Position {
  /**
   * Line position in a document (zero-based).
   * If a line number is greater than the number of lines in a document, it defaults back to the number of lines in the document.
   * If a line number is negative, it defaults to 0.
   */
  line: number;
  /**
   * Character offset on a line in a document (zero-based). Assuming that the line is
   * represented as a string, the `character` value represents the gap between the
   * `character` and `character + 1`.
   *
   * If the character value is greater than the line length it defaults back to the
   * line length.
   * If a line number is negative, it defaults to 0.
   */
  character: number;
}
