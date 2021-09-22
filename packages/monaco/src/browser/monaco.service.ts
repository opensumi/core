import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { Disposable, KeybindingRegistry, MonacoOverrideServiceRegistry, ServiceNames, ILogger } from '@ali/ide-core-browser';
import { Deferred, Emitter as EventEmitter, Event } from '@ali/ide-core-common';
import { IEditorConstructionOptions, isDiffEditor, MouseTargetType } from '@ali/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { IDiffEditorConstructionOptions } from '@ali/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';
import { SimpleKeybinding } from '@ali/monaco-editor-core/esm/vs/base/common/keyCodes';
import { Range } from '@ali/monaco-editor-core/esm/vs/editor/editor.main';
import { IDisposable } from '@ali/monaco-editor-core/esm/vs/base/common/lifecycle';

import { ITextmateTokenizer, ITextmateTokenizerService } from './contrib/tokenizer';
import { ICodeEditor, IDiffEditor } from './monaco-api/types';
import { monaco } from './monaco-api';
import { MonacoResolvedKeybinding } from './monaco.resolved-keybinding';
import { MonacoService } from '../common';

@Injectable()
export default class MonacoServiceImpl extends Disposable implements MonacoService {
  @Autowired(INJECTOR_TOKEN)
  protected injector: Injector;

  @Autowired(ITextmateTokenizer)
  private textMateService: ITextmateTokenizerService;

  @Autowired(MonacoOverrideServiceRegistry)
  private readonly overrideServiceRegistry: MonacoOverrideServiceRegistry;

  @Autowired(KeybindingRegistry)
  private readonly keybindingRegistry: KeybindingRegistry;

  @Autowired(ILogger)
  private readonly logger: ILogger;

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

  public createCodeEditor(
    monacoContainer: HTMLElement,
    options?: IEditorConstructionOptions,
    overrides: {[key: string]: any} = {},
  ): ICodeEditor {
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
    }, { ...this.overrideServiceRegistry.all(), ...overrides });
    this.overrideMonacoKeybindingService(editor);

    this.addClickEventListener(editor);
    return editor;
  }

  private doAddClickEventListener(editor: ICodeEditor) {
    this.addDispose(editor.onMouseDown((e) => {
      if (e.target.type === MouseTargetType.GUTTER_LINE_NUMBERS) {
        const lineNumber = e.target.position?.lineNumber || e.target.range?.startLineNumber;
        if (!lineNumber) {
          return;
        }

        editor.setSelection(
          new Range(
            lineNumber,
            e.target.range?.startColumn || e.target.position?.column || 0,
            lineNumber + 1,
            e.target.range?.startColumn || e.target.position?.column || 0,
          ),
        );
      }
    }));
  }

  private addClickEventListener(editor: IDiffEditor | ICodeEditor) {
    if (isDiffEditor(editor)) {
      const originalEditor = editor.getOriginalEditor();
      const modifiedEditor = editor.getModifiedEditor();

      this.doAddClickEventListener(originalEditor);
      this.doAddClickEventListener(modifiedEditor);
    } else {
      this.doAddClickEventListener(editor);
    }
  }

  public createDiffEditor(
    monacoContainer: HTMLElement,
    options?: IDiffEditorConstructionOptions,
    overrides: {[key: string]: any} = {},
  ): IDiffEditor {
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
    } as any, { ...this.overrideServiceRegistry.all(), ...overrides });
    this.overrideMonacoKeybindingService(editor);
    this.addClickEventListener(editor);
    return editor;
  }

  private overrideMonacoKeybindingService(editor: IDiffEditor | ICodeEditor) {
    this.removeMonacoKeybindingListener(editor);
    this.overrideKeybindingResolver(editor);
  }

  /**
   * 移除 Monaco 中默认的快捷键
   * 防止用户修改编辑器快捷键后依然会命中默认的快捷键
   * @param editor
   */
  private removeMonacoKeybindingListener(editor: IDiffEditor | ICodeEditor) {
    let keydownListener: IDisposable | undefined;
    const keybindingService = editor['_standaloneKeybindingService'];
    if (!keybindingService) {
      return;
    }
    for (const listener of keybindingService._store._toDispose) {
      if ('_type' in listener && listener['_type'] === 'keydown') {
        keydownListener = listener;
        break;
      }
    }
    if (keydownListener) {
      keydownListener.dispose();
    }
  }

  /**
   * 重载 Monaco 中 `_standaloneKeybindingService` 对应处理快捷键及快捷键事件的方法
   * @param editor
   */
  private overrideKeybindingResolver(editor: IDiffEditor | ICodeEditor) {
    const keybindingService = editor['_standaloneKeybindingService'];
    if (!keybindingService) {
      return;
    }
    keybindingService.resolveKeybinding = (keybinding) => [new MonacoResolvedKeybinding(MonacoResolvedKeybinding.keySequence(keybinding), this.keybindingRegistry)];
    keybindingService.resolveKeyboardEvent = (keyboardEvent) => {
      const keybinding = new SimpleKeybinding(
        keyboardEvent.ctrlKey,
        keyboardEvent.shiftKey,
        keyboardEvent.altKey,
        keyboardEvent.metaKey,
        keyboardEvent.keyCode,
      ).toChord();
      return new MonacoResolvedKeybinding(MonacoResolvedKeybinding.keySequence(keybinding), this.keybindingRegistry);
    };
  }

  public registerOverride(serviceName: ServiceNames, service: any) {
    this.logger.warn(
      true,
      `MonacoService#getOverride will be deprecated, please use MonacoOverrideServiceRegistry#getRegisteredService instead.`,
    );
    this.overrideServiceRegistry.registerOverrideService(serviceName, service);
  }

  public getOverride(serviceName: ServiceNames) {
    this.logger.warn(
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
