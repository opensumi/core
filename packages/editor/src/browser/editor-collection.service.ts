import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { MonacoService } from '@ali/ide-monaco';
import {
  DocumentModel,
} from '@ali/ide-doc-model/lib/browser/doc-model';
import {
  DocumentModelManager,
} from '@ali/ide-doc-model/lib/browser/doc-manager';
import { URI, WithEventBus, OnEvent } from '@ali/ide-core-common';
import { documentService, INodeDocumentService } from '@ali/ide-doc-model/lib/common';
import { ICodeEditor, IEditor, EditorCollectionService, IDiffEditor, ResourceDecorationChangeEvent } from '../common';
import { IRange } from '@ali/ide-doc-model/lib/common/doc';
import { DocModelContentChangedEvent } from '@ali/ide-doc-model/lib/browser';

@Injectable()
export class EditorCollectionServiceImpl extends WithEventBus implements EditorCollectionService {

  @Autowired()
  private monacoService!: MonacoService;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired()
  protected documentModelManager: DocumentModelManager;

  private collection: Map<string, ICodeEditor> = new Map();

  private _editors: Set<IMonacoImplEditor> = new Set();

  async createCodeEditor(dom: HTMLElement, options?: any): Promise<ICodeEditor> {
    const monacoCodeEditor = await this.monacoService.createCodeEditor(dom, options);
    const editor = this.injector.get(BrowserCodeEditor, [monacoCodeEditor]);
    return editor;
  }

  public async createDiffEditor(dom: HTMLElement, options?: any): Promise<import('../common').IDiffEditor> {
    const monacoDiffEditor = await this.monacoService.createDiffEditor(dom, options);
    const editor = this.injector.get(BrowserDiffEditor, [monacoDiffEditor]);
    return editor;
  }
  public listEditors(): IMonacoImplEditor[] {
    return Array.from(this._editors.values());
  }

  public addEditors(editors: IMonacoImplEditor[]) {
    const beforeSize = this._editors.size;
    editors.forEach((editor) => {
      if (!this._editors.has(editor)) {
        this._editors.add(editor);
      }
    });
    if (this._editors.size !== beforeSize) {
      // fire event;
    }
  }

  public removeEditors(editors: IMonacoImplEditor[]) {
    const beforeSize = this._editors.size;
    editors.forEach((editor) => {
      this._editors.delete(editor);
    });
    if (this._editors.size !== beforeSize) {
      // fire event;
    }
  }

  // 将docModel的变更事件反映至resource的dirty装饰
  @OnEvent(DocModelContentChangedEvent)
  onDocModelContentChangedEvent(e: DocModelContentChangedEvent) {
    this.eventBus.fire(new ResourceDecorationChangeEvent({
      uri: e.payload.uri,
      decoration: {
        dirty: e.payload.dirty,
      },
    }));
  }

}

export interface IMonacoImplEditor extends IEditor {

  monacoEditor: monaco.editor.ICodeEditor;

}

export class BrowserCodeEditor implements ICodeEditor {

  @Autowired(EditorCollectionService)
  private collectionService: EditorCollectionServiceImpl;

  @Autowired()
  protected documentModelManager: DocumentModelManager;

  private editorState: Map<string, monaco.editor.ICodeEditorViewState> = new Map();

  public currentUri: URI | null;

  protected _currentDocumentModel: DocumentModel;

  public _disposed: boolean = false;

  public get currentDocumentModel() {
    return this._currentDocumentModel;
  }

  public getId() {
    return this.monacoEditor.getId();
  }

  constructor(
    public readonly monacoEditor: monaco.editor.IStandaloneCodeEditor,
  ) {
    this.collectionService.addEditors([this]);

    // 防止浏览器后退前进手势
    const disposer = monacoEditor.onDidChangeModel(() => {
      bindPreventNavigation(this.monacoEditor.getDomNode()!);
      disposer.dispose();
    });
  }

  layout(): void {
    this.monacoEditor.layout();
  }

  dispose() {
    this.saveCurrentState();
    this.collectionService.removeEditors([this]);
    this.monacoEditor.dispose();
    this._disposed = true;
  }

  protected saveCurrentState() {
    if (this.currentUri) {
      const state = this.monacoEditor.saveViewState();
      if (state) {
        this.editorState.set(this.currentUri.toString(), state);
        // TODO store in storage
      }
    }
  }

  protected restoreState() {
    if (this.currentUri) {
      const state = this.editorState.get(this.currentUri.toString());
      if (state) {
        this.monacoEditor.restoreViewState(state);
      }
    }
  }

  async open(uri: URI, range?: IRange): Promise<void> {
    this.saveCurrentState();
    const res = await this.documentModelManager.resolveModel(uri);
    if (res) {
      this._currentDocumentModel = res;
      const model = res.toEditor();
      this.currentUri = new URI(model.uri.toString());
      this.monacoEditor.setModel(model);
      this.restoreState();
    }
  }

  public async save(uri: URI): Promise<boolean> {
    return this.documentModelManager.savetModel(uri);
  }
}

export class BrowserDiffEditor implements IDiffEditor {

  @Autowired(EditorCollectionService)
  private collectionService: EditorCollectionServiceImpl;

  @Autowired()
  protected documentModelManager: DocumentModelManager;

  private originalDocModel: DocumentModel | null;

  private modifiedDocModel: DocumentModel | null;

  public originalEditor: IMonacoImplEditor;

  public modifiedEditor: IMonacoImplEditor;

  public _disposed: boolean;

  constructor(private monacoDiffEditor: monaco.editor.IDiffEditor) {
    this.wrapEditors();
  }

  async compare(original: URI, modified: URI) {
    return Promise.all([this.documentModelManager.resolveModel(original), this.documentModelManager.resolveModel(modified)])
      .then(([originalDocModel, modifiedDocModel]) => {
        if (!originalDocModel) {
          throw new Error('Cannot find Original Document');
        }
        if (!modifiedDocModel) {
          throw new Error('Cannot find Modified Document');
        }
        this.originalDocModel = originalDocModel;
        this.modifiedDocModel = modifiedDocModel;
        this.monacoDiffEditor.setModel({
          original: originalDocModel.toEditor(),
          modified: modifiedDocModel.toEditor(),
        });
      });
  }

  private wrapEditors() {
    const diffEditor = this;
    this.originalEditor = {
      getId() {
        return diffEditor.monacoDiffEditor.getOriginalEditor().getId();
      },
      get currentDocumentModel() {
        return diffEditor.originalDocModel;
      },
      get currentUri() {
        return diffEditor.originalDocModel ? diffEditor.originalDocModel.uri : null;
      },
      get monacoEditor() {
        return diffEditor.monacoDiffEditor.getOriginalEditor();
      },
    };
    this.modifiedEditor = {
      getId() {
        return diffEditor.monacoDiffEditor.getModifiedEditor().getId();
      },
      get currentDocumentModel() {
        return diffEditor.modifiedDocModel;
      },
      get currentUri() {
        return diffEditor.modifiedDocModel ? diffEditor.modifiedDocModel.uri : null;
      },
      get monacoEditor() {
        return diffEditor.monacoDiffEditor.getModifiedEditor();
      },
    };
    this.collectionService.addEditors([this.originalEditor, this.modifiedEditor]);
  }

  layout(): void {
    return this.monacoDiffEditor.layout();
  }

  dispose(): void {
    this.collectionService.removeEditors([this.originalEditor, this.modifiedEditor]);
    this.monacoDiffEditor.dispose();
    this._disposed = true;
  }

}

// utils

function bindPreventNavigation(div: HTMLElement) {
  div.addEventListener('mousewheel', preventNavigation as any);
}

function preventNavigation(this: HTMLDivElement, e: WheelEvent) {
  e.preventDefault();
  e.stopPropagation();
  if (this.offsetWidth + this.scrollLeft + e.deltaX > this.scrollWidth) {
    e.preventDefault();
    e.stopPropagation();
  } else if (this.scrollLeft + e.deltaX < 0) {
    e.preventDefault();
    e.stopPropagation();
  }
}
