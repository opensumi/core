import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { Disposable, MonacoOverrideServiceRegistry, ServiceNames } from '@ali/ide-core-browser';
import { Deferred, Emitter as EventEmitter, Event } from '@ali/ide-core-common';

import { MonacoService } from '../common';
import { TextmateService } from './textmate.service';

@Injectable()
export default class MonacoServiceImpl extends Disposable implements MonacoService  {
  @Autowired(INJECTOR_TOKEN)
  protected injector: Injector;

  @Autowired()
  private textMateService: TextmateService;

  @Autowired(MonacoOverrideServiceRegistry)
  private readonly overrideServiceRegistry: MonacoOverrideServiceRegistry;

  private loadingPromise!: Promise<any>;

  private _onMonacoLoaded = new EventEmitter<boolean>();
  public onMonacoLoaded: Event<boolean> = this._onMonacoLoaded.event;

  private readonly _monacoLoaded = new Deferred<void>();
  get monacoLoaded(): Promise<void> {
    return this._monacoLoaded.promise;
  }

  constructor() {
    super();
  }

  public async createCodeEditor(
    monacoContainer: HTMLElement,
    options?: monaco.editor.IEditorConstructionOptions,
    overrides: {[key: string]: any} = {},
  ): Promise<monaco.editor.IStandaloneCodeEditor> {
    const editor =  monaco.editor.create(monacoContainer, {
      // @ts-ignore
      'semanticHighlighting.enabled': true,
      glyphMargin: true,
      lightbulb: {
        enabled: true,
      },
      automaticLayout: true,
      model: null,
      wordBasedSuggestions: false,
      renderLineHighlight: 'none',
      // @ts-ignore
      'editor.rename.enablePreview': true,
      ...options,
    }, { ...this.overrideServiceRegistry.all(), ...overrides});
    return editor;
  }

  public async createDiffEditor(
    monacoContainer: HTMLElement,
    options?: monaco.editor.IDiffEditorConstructionOptions,
    overrides: {[key: string]: any} = {},
  ): Promise<monaco.editor.IDiffEditor> {
    const editor =  monaco.editor.createDiffEditor(monacoContainer, {
      glyphMargin: true,
      lightbulb: {
        enabled: true,
      },
      automaticLayout: true,
      wordBasedSuggestions: false,
      renderLineHighlight: 'none',
      ignoreTrimWhitespace: false,
      ...options,
    } as any, { ...this.overrideServiceRegistry.all(), ...overrides});
    return editor;
  }

  public registerOverride(serviceName: ServiceNames, service: any) {
    // tslint:disable-next-line:no-console
    console.warn(
      true,
      `MonacoService#getOverride will be deprecated, please use MonacoOverrideServiceRegistry#getRegisteredService instead.`,
    );
    this.overrideServiceRegistry.registerOverrideService(serviceName, service);
  }

  public getOverride(serviceName: ServiceNames) {
    // tslint:disable-next-line:no-console
    console.warn(
      true,
      `MonacoService#getOverride will be deprecated, please use MonacoOverrideServiceRegistry#getRegisteredService instead.`,
    );
    return this.overrideServiceRegistry.getRegisteredService(serviceName);
  }

  /**
   * 加载monaco代码，这里只保留空实现
   */
  public async loadMonaco() {
    if (!this.loadingPromise) {
      this.loadingPromise = Promise.resolve();
      this._onMonacoLoaded.fire(true);
      this._monacoLoaded.resolve();
    }
    return this.loadingPromise;
  }

  public testTokenize(text: string, languageId: string) {
    this.textMateService.testTokenize(text, languageId);
  }
}
