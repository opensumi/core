import { MonacoService } from '@ali/ide-monaco';
import { Injectable, Autowired } from '@ali/common-di';
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
  
  documentModel: any;

  constructor(public readonly uid: string, private editor: monaco.editor.IStandaloneCodeEditor) {

  }

  layout(): void {
    this.editor.layout();
  }
}
