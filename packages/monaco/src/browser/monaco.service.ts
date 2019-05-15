import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';

@Injectable()
export default class MonacoService extends Disposable {

  private editor!: monaco.editor.IStandaloneCodeEditor;

  constructor() {
    super();
  }

  async initMonaco(monacoContainer: HTMLElement) {
    this.editor = monaco.editor.create(monacoContainer, {
      model: monaco.editor.createModel(
        'console.log("hello world")',
        'typescript',
        monaco.Uri.parse('inmemory://test.ts'),
      ),
      glyphMargin: true,
      lightbulb: {
        enabled: true,
      },
      automaticLayout: true,
    });
  }
}
