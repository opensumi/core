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

  constructor() {
    super();
  }

  public async createCodeEditor(
    monacoContainer: HTMLElement,
    options?: monaco.editor.IEditorConstructionOptions,
  ): Promise<monaco.editor.IStandaloneCodeEditor> {
    await this.loadMonaco();
    const editor =  monaco.editor.create(monacoContainer, {
      glyphMargin: true,
      lightbulb: {
        enabled: true,
      },
      model: null,
      automaticLayout: true,
      ...options,
    });
    const currentTheme = this.themeRegistry.register(require('./themes/dark_plus.json'), {
      './dark_defaults.json': require('./themes/dark_defaults.json'),
      './dark_vs.json': require('./themes/dark_vs.json'),
    }, 'dark-plus', 'vs-dark').name as string;
    monaco.editor.setTheme(currentTheme);
    await this.textmateService.initialize(this.themeRegistry.getTheme(currentTheme));
    // TODO 设置Model的逻辑需要与modelService关联
    setTimeout(() => {
      // console.log('setModel to typescript');
      editor.setModel(monaco.editor.createModel('const hello: string = "this is typescript"', 'typescript'));
    }, 1000);
    setTimeout(() => {
      // console.log('setModel to html');
      editor.setModel(monaco.editor.createModel(`
<html>
  <head>
      <title>CloudIDE</title>
      <style>
          p{
              color: '#ccc';
          }
      </style>
  </head>
  <body>
      <p>this is html</p>
      <div>ssdas</div>
  </body>
</html>
      `, 'html'));
    }, 3000);
    return editor;
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
