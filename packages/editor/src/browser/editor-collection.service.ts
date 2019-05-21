import { Injectable, Autowired } from '@ali/common-di';
import { MonacoService } from '@ali/ide-monaco';
import {
  BrowserDocumentModel,
  BrowserDocumentModelManager,
} from '@ali/ide-doc-model/lib/browser/doc-model';
import {
  RemoteProvider,
  EmptyProvider,
} from '@ali/ide-doc-model/lib/browser/provider';
import { IEditor } from '../common';

@Injectable()
export class EditorCollectionServiceImpl {
  @Autowired()
  private monacoService!: MonacoService;

  private collection: Map<string, IEditor> = new Map();

  async createEditor(uid: string, dom: HTMLElement, options?: any): Promise<IEditor> {
    const monacoCodeEditor = await this.monacoService.createCodeEditor(dom, options);
    const editor = new BrowserEditor(uid, monacoCodeEditor);
    return editor;
  }
}


class BrowserEditor implements IEditor {
  documentModelManager: BrowserDocumentModelManager = new BrowserDocumentModelManager();

  currentDocumentModel: BrowserDocumentModel;

  constructor(public readonly uid: string, private editor: monaco.editor.IStandaloneCodeEditor) {
    this.documentModelManager.registerDocModelContentProvider(new RemoteProvider());
    this.documentModelManager.registerDocModelContentProvider(new EmptyProvider());

    setTimeout(async () => {
      const res = await this.documentModelManager.open('http://127.0.0.1:8000/1.json');
      // const res = await this.documentModelManager.open('inmemory://empty');
      if (res) {
        // @ts-ignore
        this.currentDocumentModel = res;
        const model = res.toEditor();
        editor.setModel(model);
      }

    }, 1000);
  }

  layout(): void {
    this.editor.layout();
  }
}
