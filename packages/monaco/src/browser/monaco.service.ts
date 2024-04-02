import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  Disposable,
  KeybindingRegistry,
  MonacoOverrideServiceRegistry,
  ServiceNames,
  ILogger,
} from '@opensumi/ide-core-browser';
import { IMergeEditorEditor } from '@opensumi/ide-core-browser/lib/monaco/merge-editor-widget';
import { KeyCodeChord } from '@opensumi/monaco-editor-core/esm/vs/base/common/keybindings';
import { IDisposable } from '@opensumi/monaco-editor-core/esm/vs/base/common/lifecycle';
import { IEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/config/editorConfiguration';
import {
  IDiffEditorConstructionOptions,
  MouseTargetType,
  isDiffEditor,
} from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { ShowLightbulbIconMode } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/editor.main';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import { MonacoService } from '../common';

import { MergeEditorWidget } from './contrib/merge-editor/merge-editor-widget';
import { ITextmateTokenizer, ITextmateTokenizerService } from './contrib/tokenizer';
import { monaco } from './monaco-api';
import { ICodeEditor, IDiffEditor } from './monaco-api/types';
import { MonacoResolvedKeybinding } from './monaco.resolved-keybinding';

// const SUMI_OVERFLOW_WIDGETS_CONTAINER_ID = 'sumi-overflow-widgets-container';
type IEditorType = IDiffEditor | ICodeEditor | IMergeEditorEditor;

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

  get monacoBaseOptions() {
    return {
      glyphMargin: true,
      lightbulb: {
        // todo: add a setting to control this
        enabled: ShowLightbulbIconMode.OnCode,
      },
      automaticLayout: true,
      model: undefined,
      wordBasedSuggestions: 'off',
      renderLineHighlight: 'none',
    } as IStandaloneEditorConstructionOptions;
  }

  public createCodeEditor(
    monacoContainer: HTMLElement,
    options?: IEditorConstructionOptions,
    overrides: { [key: string]: any } = {},
  ): ICodeEditor {
    const editor = monaco.editor.create(
      monacoContainer,
      {
        ...this.monacoBaseOptions,
        ...options,
      },
      { ...this.overrideServiceRegistry.all(), ...overrides },
    );
    this.overrideMonacoKeybindingService(editor);

    this.addClickEventListener(editor);
    return editor;
  }

  private doAddClickEventListener(editor: ICodeEditor) {
    this.addDispose(
      editor.onMouseDown((e) => {
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
      }),
    );
  }

  private addClickEventListener(editor: IEditorType) {
    if (isDiffEditor(editor)) {
      const originalEditor = editor.getOriginalEditor();
      const modifiedEditor = editor.getModifiedEditor();

      this.doAddClickEventListener(originalEditor);
      this.doAddClickEventListener(modifiedEditor);
    } else {
      this.doAddClickEventListener(editor as ICodeEditor);
    }
  }

  public createDiffEditor(
    monacoContainer: HTMLElement,
    options?: IDiffEditorConstructionOptions,
    overrides: { [key: string]: any } = {},
  ): IDiffEditor {
    const editor = monaco.editor.createDiffEditor(
      monacoContainer,
      {
        ...this.monacoBaseOptions,
        ignoreTrimWhitespace: false,
        ...options,
      } as any,
      { ...this.overrideServiceRegistry.all(), ...overrides },
    );
    this.overrideMonacoKeybindingService(editor);
    this.addClickEventListener(editor);
    return editor;
  }

  public createMergeEditor(
    monacoContainer: HTMLElement,
    options?: IDiffEditorConstructionOptions,
    overrides: { [key: string]: any } = {},
  ): IMergeEditorEditor {
    return this.injector.get(MergeEditorWidget, [
      monacoContainer,
      options,
      { ...this.overrideServiceRegistry.all(), ...overrides },
    ]);
  }

  private overrideMonacoKeybindingService(editor: IEditorType) {
    this.removeMonacoKeybindingListener(editor);
    this.overrideKeybindingResolver(editor);
  }

  /**
   * 移除 Monaco 中默认的快捷键
   * 防止用户修改编辑器快捷键后依然会命中默认的快捷键
   * @param editor
   */
  private removeMonacoKeybindingListener(editor: IEditorType) {
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
  private overrideKeybindingResolver(editor: IEditorType) {
    const keybindingService = editor['_standaloneKeybindingService'];
    if (!keybindingService) {
      return;
    }
    keybindingService.resolveKeybinding = (keybinding) => [
      new MonacoResolvedKeybinding(MonacoResolvedKeybinding.keySequence(keybinding), this.keybindingRegistry),
    ];
    keybindingService.resolveKeyboardEvent = (keyboardEvent) => {
      const keybinding = new KeyCodeChord(
        keyboardEvent.ctrlKey,
        keyboardEvent.shiftKey,
        keyboardEvent.altKey,
        keyboardEvent.metaKey,
        keyboardEvent.keyCode,
      ).toKeybinding();
      return new MonacoResolvedKeybinding(MonacoResolvedKeybinding.keySequence(keybinding), this.keybindingRegistry);
    };
  }

  public registerOverride(serviceName: ServiceNames, service: any) {
    this.logger.warn(
      true,
      'MonacoService#getOverride will be deprecated, please use MonacoOverrideServiceRegistry#getRegisteredService instead.',
    );
    this.overrideServiceRegistry.registerOverrideService(serviceName, service);
  }

  public getOverride(serviceName: ServiceNames) {
    this.logger.warn(
      true,
      'MonacoService#getOverride will be deprecated, please use MonacoOverrideServiceRegistry#getRegisteredService instead.',
    );
    return this.overrideServiceRegistry.getRegisteredService(serviceName);
  }

  public testTokenize(text: string, languageId: string) {
    this.textMateService.testTokenize(text, languageId);
  }
}
