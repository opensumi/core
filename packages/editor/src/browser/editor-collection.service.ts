import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { MonacoService } from '@ali/ide-monaco';
import {
  BrowserDocumentModel,
  BrowserDocumentModelManager,
} from '@ali/ide-doc-model/lib/browser/doc-model';
import { URI } from '@ali/ide-core-common';
import { servicePath, INodeDocumentService } from '@ali/ide-doc-model/lib/common';
import { IEditor } from '../common';

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

  constructor(
    public readonly uid: string,
    private editor: monaco.editor.IStandaloneCodeEditor,
  ) {
    const disposer = editor.onDidChangeModel(() => {
      bindPreventNavigation(this.editor.getDomNode()!);
      disposer.dispose();
    });

  }

  layout(): void {
    this.editor.layout();
  }

  async open(uri: URI): Promise<void> {
    const res = await this.documentModelManager.resolve(uri);
    if (res) {
      this.currentDocumentModel = res as BrowserDocumentModel;
      const model = res.toEditor();
      this.editor.setModel(model);
    }
  }

  async save(uri: URI): Promise<boolean> {
    const doc = await this.documentModelManager.resolve(uri);
    if (doc) {
      const mirror = doc.toMirror();
      const res = !!this.docService.saveContent(mirror);

      if (res) {
        const browserDoc = doc as BrowserDocumentModel;
        browserDoc.merged();
      }

      return res;
    }
    return false;
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
