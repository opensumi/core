import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Inject } from '@ali/common-di';
import { MonacoService } from '@ali/ide-monaco';
import {
  BrowserDocumentModel,
  BrowserDocumentModelManager,
} from '@ali/ide-doc-model/lib/browser/doc-model';
import { URI } from '@ali/ide-core-common';
import { servicePath, INodeDocumentService } from '@ali/ide-doc-model/lib/common';
import { IEditor } from '../common';
import { LanguageClient } from '@ali/ide-language/src/browser';

@Injectable()
export class EditorCollectionServiceImpl {
  @Autowired()
  private monacoService!: MonacoService;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  client: LanguageClient;

  private collection: Map<string, IEditor> = new Map();

  async createEditor(uid: string, dom: HTMLElement, options?: any): Promise<IEditor> {
    const monacoCodeEditor = await this.monacoService.createCodeEditor(dom, options);
    const editor = this.injector.get(BrowserEditor, [uid, monacoCodeEditor]);
    this.client = new LanguageClient(monacoCodeEditor);
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
  ) { }

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
      return !!this.docService.saveContent(mirror);
    }
    return false;
  }
}
