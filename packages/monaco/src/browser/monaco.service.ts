import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { Disposable, SuggestEvent } from '@ali/ide-core-browser';
import { loadMonaco } from './monaco-loader';
import { MonacoService, ServiceNames } from '../common';
import { Emitter as EventEmitter, Event, IEventBus } from '@ali/ide-core-common';
import { TextmateService } from './textmate.service';

@Injectable()
export default class MonacoServiceImpl extends Disposable implements MonacoService  {
  @Autowired(INJECTOR_TOKEN)
  protected injector: Injector;

  @Autowired()
  private textMateService: TextmateService;

  @Autowired(IEventBus)
  private eventBus: IEventBus;

  private loadingPromise!: Promise<any>;

  private _onMonacoLoaded = new EventEmitter<boolean>();

  public onMonacoLoaded: Event<boolean> = this._onMonacoLoaded.event;

  private overrideServices = {};

  constructor() {
    super();
  }

  public async createCodeEditor(
    monacoContainer: HTMLElement,
    options?: monaco.editor.IEditorConstructionOptions,
    overrides: {[key: string]: any} = {},
  ): Promise<monaco.editor.IStandaloneCodeEditor> {
    const editor =  monaco.editor.create(monacoContainer, options, { ...this.overrideServices, ...overrides});

    this.listenSuggestWidget(editor);
    return editor;
  }

  public async createDiffEditor(
    monacoContainer: HTMLElement,
    options?: monaco.editor.IDiffEditorConstructionOptions,
    overrides: {[key: string]: any} = {},
  ): Promise<monaco.editor.IDiffEditor> {
    const editor =  monaco.editor.createDiffEditor(monacoContainer, options, { ...this.overrideServices, ...overrides});
    return editor;
  }

  public registerOverride(serviceName: ServiceNames, service: any) {
    this.overrideServices[serviceName] = service;
  }

  public getOverride(serviceName: ServiceNames) {
    return this.overrideServices[serviceName];
  }

  /**
   * 加载monaco代码，加载过程只会执行一次
   */
  public async loadMonaco() {
    if (!this.loadingPromise) {
      this.loadingPromise = loadMonaco().then(() => {
        // TODO 改成eventbus
        this._onMonacoLoaded.fire(true);
      });
    }
    return this.loadingPromise;
  }

  public testTokenize(text: string, languageId: string) {
    this.textMateService.testTokenize(text, languageId);
  }

  private listenSuggestWidget(editor: monaco.editor.IStandaloneCodeEditor) {
    const suggestWidget = ((editor.getContribution('editor.contrib.suggestController') as monaco.suggestController.SuggestController)._widget as any).getValue();
    // FIXME 仅通过鼠标选中会走onDidSelect事件，键盘会过acceptSelectedSuggestionOnEnter这个command
    suggestWidget.onDidSelect((e) => {
      this.eventBus.fire(new SuggestEvent({
        eventType: 'onDidSelect',
        data: e,
      }));
    });
    suggestWidget.onDidHide((e) => {
      this.eventBus.fire(new SuggestEvent({
        eventType: 'onDidHide',
        data: e,
      }));
    });
    suggestWidget.onDidShow((e) => {
      this.eventBus.fire(new SuggestEvent({
        eventType: 'onDidShow',
        data: e,
      }));
    });
    suggestWidget.onDidFocus((e) => {
      this.eventBus.fire(new SuggestEvent({
        eventType: 'onDidFocus',
        data: e,
      }));
    });
  }

}
