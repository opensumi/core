import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { MonacoService } from '@ali/ide-monaco';
import {
  BrowserDocumentModel,
  BrowserDocumentModelManager,
} from '@ali/ide-doc-model/lib/browser/doc-model';
import { URI } from '@ali/ide-core-common';
import { servicePath, INodeDocumentService } from '@ali/ide-doc-model/lib/common';
import { IEditor } from '../common';
import { IRange } from '@ali/ide-doc-model/lib/common/doc';

@Injectable()
export class EditorCollectionServiceImpl {
  @Autowired()
  private monacoService!: MonacoService;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  private collection: Map<string, IEditor> = new Map();

  async createEditor(uid: string, dom: HTMLElement, options?: any): Promise<IEditor> {
    const monacoCodeEditor = await this.monacoService.createCodeEditor(dom, options);
    const editor = this.injector.get(BrowserEditor, [uid, monacoCodeEditor]);
    return editor;
  }
}

export class BrowserEditor implements IEditor {
  @Autowired()
  documentModelManager: BrowserDocumentModelManager;
  currentDocumentModel: BrowserDocumentModel;

  @Autowired(servicePath)
  private docService: INodeDocumentService;

  private editorState: Map<string, monaco.editor.ICodeEditorViewState> = new Map();

  private currentUri: URI | null;

  constructor(
    public readonly uid: string,
    private editor: monaco.editor.IStandaloneCodeEditor,
  ) {
    // 防止浏览器后退前进手势
    const disposer = editor.onDidChangeModel(() => {
      bindPreventNavigation(this.editor.getDomNode()!);
      disposer.dispose();
    });

  }

  layout(): void {
    this.editor.layout();
  }

  saveCurrentState() {
    if (this.currentUri) {
      const state = this.editor.saveViewState();
      if (state) {
        this.editorState.set(this.currentUri.toString(), state);
        // TODO store in storage
      }
    }
  }

  restoreState() {
    if (this.currentUri) {
      const state = this.editorState.get(this.currentUri.toString());
      if (state) {
        this.editor.restoreViewState(state);
      }
    }
  }

  async open(uri: URI, range?: IRange): Promise<void> {
    this.saveCurrentState();
    const res = await this.documentModelManager.resolve(uri);
    if (res) {
      this.currentDocumentModel = res as BrowserDocumentModel;
      const model = res.toEditor();
      this.currentUri = model.uri;
      this.editor.setModel(model);
      this.restoreState();
    }
  }

  async save(uri: URI): Promise<boolean> {
    const doc = await this.documentModelManager.resolve(uri);
    if (doc) {
      const mirror = doc.toMirror();
      return !!this.docService.saveContent(mirror);
    }
    return false;
  }

  dispose() {
    this.saveCurrentState();
  }
}

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
