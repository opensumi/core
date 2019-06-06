import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { TextmateService } from './textmate-service';
import { MonacoThemeRegistry } from './theme-registry';
import { loadMonaco, loadVsRequire } from './monaco-loader';
import { MonacoService } from '../common';

@Injectable()
export default class MonacoServiceImpl extends Disposable implements MonacoService  {

  @Autowired()
  private textmateService!: TextmateService;

  @Autowired()
  private themeRegistry!: MonacoThemeRegistry;

  private loadingPromise!: Promise<any>;

  private themeActivated = false;

  constructor() {
    super();
  }

  public async createCodeEditor(
    monacoContainer: HTMLElement,
    options?: monaco.editor.IEditorConstructionOptions,
  ): Promise<monaco.editor.IStandaloneCodeEditor> {
    await this.loadMonaco();
    await this.activateTheme();
    const editor =  monaco.editor.create(monacoContainer, {
      glyphMargin: true,
      lightbulb: {
        enabled: true,
      },
      model: null,
      automaticLayout: true,
      renderLineHighlight: 'none',
      ...options,
    });
    return editor;
  }

  private activateTheme() {
    if (!this.themeActivated) {
      this.themeActivated = true;
      const currentTheme = this.themeRegistry.register(require('./themes/dark_plus.json'), {
        './dark_defaults.json': require('./themes/dark_defaults.json'),
        './dark_vs.json': require('./themes/dark_vs.json'),
      }, 'dark-plus', 'vs-dark').name as string;
      monaco.editor.setTheme(currentTheme);
      return this.textmateService.initialize(this.themeRegistry.getTheme(currentTheme));
    }
  }
  /**
   * 加载monaco代码，加载过程只会执行一次
   */
  public async loadMonaco() {
    if (!this.loadingPromise) {
      this.loadingPromise = loadVsRequire(window).then((vsRequire) => {
        return loadMonaco(vsRequire);
      });
    }
    return this.loadingPromise;
  }

}
