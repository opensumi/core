import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { LanguageRegistry } from './language-registry';
import { MonacoThemeRegistry } from './theme-registry';

const initValue = `
function test() {
  console.log('hello world');
}
`;

@Injectable()
export default class MonacoService extends Disposable {

  private editor!: monaco.editor.IStandaloneCodeEditor;

  @Autowired()
  private languageRegistry!: LanguageRegistry;

  @Autowired()
  private themeRegistry!: MonacoThemeRegistry;

  constructor() {
    super();
  }

  async initMonaco(monacoContainer: HTMLElement) {
    this.editor = monaco.editor.create(monacoContainer, {
      model: monaco.editor.createModel(
        initValue,
        'typescript',
        monaco.Uri.parse('inmemory://test.ts'),
      ),
      glyphMargin: true,
      lightbulb: {
        enabled: true,
      },
      automaticLayout: true,
    });
    const currentTheme = this.themeRegistry.register(require('./themes/dark_plus.json'), {
      './dark_defaults.json': require('./themes/dark_defaults.json'),
      './dark_vs.json': require('./themes/dark_vs.json'),
    }, 'dark-plus', 'vs-dark').name as string;
    monaco.editor.setTheme(currentTheme);
    await this.languageRegistry.initialize(this.themeRegistry.getTheme(currentTheme));
  }
}
