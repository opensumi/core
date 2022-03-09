import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import {
  IContextKeyService,
  MonacoOverrideServiceRegistry,
  ServiceNames,
  localize,
  StorageProvider,
} from '@opensumi/ide-core-browser';
import { Schemas, URI, CommandRegistry, Emitter, Event, STORAGE_NAMESPACE } from '@opensumi/ide-core-common';
import { EditorCollectionService, IDecorationApplyOptions } from '@opensumi/ide-editor';
import {
  IEditorDocumentModelService,
  IEditorDocumentModelContentProvider,
  ICodeEditor,
  getSimpleEditorOptions,
} from '@opensumi/ide-editor/lib/browser';
import { MonacoCodeService } from '@opensumi/ide-editor/lib/browser/editor.override';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { transparent, editorForeground, IThemeService } from '@opensumi/ide-theme';
import { IHistoryNavigationWidget } from '@opensumi/monaco-editor-core/esm/vs/base/browser/history';
import { HistoryNavigator } from '@opensumi/monaco-editor-core/esm/vs/base/common/history';
import { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import {
  DEBUG_CONSOLE_CONTAINER_ID,
  IDebugSessionManager,
  CONTEXT_IN_DEBUG_MODE_KEY,
  DebugState,
} from '../../../common';
import { DebugSessionManager } from '../../debug-session-manager';

import { DebugContextKey } from './../../contextkeys/debug-contextkey.service';
import { DebugConsoleModelService } from './debug-console-tree.model.service';


const DECORATION_KEY = 'consoleinputdecoration';
const HISTORY_STORAGE_KEY = 'debug.console.history';

const firstUpperCase = (str: string) => str.replace(/^\S/, (s) => s.toUpperCase());

const consoleInputMonacoOptions: monaco.editor.IEditorOptions = {
  ...getSimpleEditorOptions(),
  scrollbar: {
    horizontal: 'visible',
    vertical: 'hidden',
    handleMouseWheel: true,
  },
  acceptSuggestionOnEnter: 'on',
  readOnly: true,
};

@Injectable()
export class DebugConsoleService implements IHistoryNavigationWidget {
  @Autowired(DebugConsoleModelService)
  protected readonly debugConsoleModelService: DebugConsoleModelService;

  @Autowired(IMainLayoutService)
  protected readonly mainLayoutService: IMainLayoutService;

  @Autowired(IEditorDocumentModelService)
  protected readonly documentService: IEditorDocumentModelService;

  @Autowired(EditorCollectionService)
  protected readonly editorService: EditorCollectionService;

  @Autowired(CommandRegistry)
  protected readonly commands: CommandRegistry;

  @Autowired(IContextKeyService)
  protected readonly contextKeyService: IContextKeyService;

  @Autowired(IDebugSessionManager)
  protected readonly manager: DebugSessionManager;

  @Autowired(IThemeService)
  protected readonly themeService: IThemeService;

  @Autowired(MonacoOverrideServiceRegistry)
  private readonly overrideServicesRegistry: MonacoOverrideServiceRegistry;

  @Autowired(StorageProvider)
  private readonly storageProvider: StorageProvider;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  private debugContextKey: DebugContextKey;

  protected history: HistoryNavigator<string>;
  protected _consoleInputElement: HTMLDivElement | null = null;
  protected _updateDisposable: monaco.IDisposable | null = null;
  protected _consoleModel: ITextModel;
  protected get _isReadonly(): boolean {
    const session = this.manager.currentSession;
    if (session && session.state !== DebugState.Inactive) {
      return false;
    }

    return true;
  }

  private inputEditor?: ICodeEditor;

  public static keySet = new Set([CONTEXT_IN_DEBUG_MODE_KEY]);

  constructor() {
    this.contextKeyService.onDidChangeContext((e) => {
      if (e.payload.affectsSome(DebugConsoleService.keySet)) {
        const inDebugMode = this.contextKeyService.match(CONTEXT_IN_DEBUG_MODE_KEY);
        if (inDebugMode) {
          this.updateReadOnly(false);
          this.updateInputDecoration();
          this.debugContextKey.contextInDdebugMode.set(true);
        } else {
          this.updateReadOnly(true);
          if (this.debugContextKey) {
            this.debugContextKey.contextInDdebugMode.set(false);
          }
        }
      }
    });
  }

  private _onConsoleInputValueChange = new Emitter<URI>();
  public onConsoleInputValueChange: Event<URI> = this._onConsoleInputValueChange.event;

  private _onInputHeightChange = new Emitter<number>();
  public onInputHeightChange: Event<number> = this._onInputHeightChange.event;

  public get isVisible() {
    const bottomPanelHandler = this.mainLayoutService.getTabbarHandler(DEBUG_CONSOLE_CONTAINER_ID);
    return bottomPanelHandler && bottomPanelHandler.isVisible;
  }

  public get consoleModel(): DebugConsoleModelService {
    return this.debugConsoleModelService;
  }

  public activate() {
    const bottomPanelHandler = this.mainLayoutService.getTabbarHandler(DEBUG_CONSOLE_CONTAINER_ID);
    if (bottomPanelHandler && !bottomPanelHandler.isVisible) {
      bottomPanelHandler.activate();
    }
  }

  public focusInput(): void {
    if (this.inputEditor) {
      this.inputEditor.monacoEditor.focus();
    }
  }

  public async init(e: HTMLDivElement | null) {
    if (!e) {
      return;
    }

    const storage = await this.storageProvider(STORAGE_NAMESPACE.DEBUG);
    this.history = new HistoryNavigator(storage.get(HISTORY_STORAGE_KEY, []), 50);

    this._consoleInputElement = e;
    this.inputEditor = this.editorService.createCodeEditor(this._consoleInputElement!, {
      ...consoleInputMonacoOptions,
    });

    this.debugContextKey = this.injector.get(DebugContextKey, [
      (this.inputEditor.monacoEditor as any)._contextKeyService,
    ]);

    this.registerDecorationType();
    await this.createConsoleInput();
    this.setMode();
  }

  public get contextInDebugRepl() {
    return this.debugContextKey.contextInDebugRepl;
  }

  public get consoleInputValue() {
    return (this._consoleModel && this._consoleModel.getValue()) || '';
  }

  public showPreviousValue(): void {
    if (!this._isReadonly) {
      this.navigateHistory(true);
    }
  }

  public showNextValue(): void {
    if (!this._isReadonly) {
      this.navigateHistory(false);
    }
  }

  public async runExecute(): Promise<void> {
    if (!this.inputEditor) {
      return;
    }

    const editor = this.inputEditor.monacoEditor;
    const value = editor.getValue();
    await this.consoleModel.execute(value);
    this.history.add(value);
    editor.setValue('');
  }

  private navigateHistory(previous: boolean): void {
    const historyInput = previous ? this.history.previous() : this.history.next();
    if (historyInput && this.inputEditor && this.inputEditor.monacoEditor) {
      const { monacoEditor } = this.inputEditor;
      monacoEditor.setValue(historyInput);
      monacoEditor.setPosition({ lineNumber: 1, column: historyInput.length + 1 });
    }
  }

  private get consoleInputUri() {
    return new URI('debug/console/input').withScheme(Schemas.walkThroughSnippet);
  }

  private async createConsoleInput() {
    if (!this.inputEditor?.monacoEditor) {
      return;
    }

    const { monacoEditor } = this.inputEditor;

    const docModel = await this.documentService.createModelReference(this.consoleInputUri);
    const model = docModel.instance.getMonacoModel();
    model.updateOptions({ tabSize: 2 });
    this._consoleModel = model;
    monacoEditor.setModel(model);

    setTimeout(() => {
      this.layoutBody();
    }, 0);

    monacoEditor.onDidFocusEditorText(() => {
      this.contextInDebugRepl.set(true);
      this.updateInputDecoration();
    });
    monacoEditor.onDidBlurEditorText(() => {
      this.contextInDebugRepl.set(false);
      this.updateInputDecoration();
    });
    monacoEditor.onDidChangeModelContent(() => {
      const lineNum = monacoEditor.getModel()!.getLineCount();
      this.layoutBody(lineNum * 18);
    });

    this.manager.onDidChangeActiveDebugSession(() => {
      this.registerCompletion();
      this.setMode();
    });

    await this.updateInputDecoration();
  }

  private layoutBody(height?: number, width?: number): void {
    if (!this.inputEditor) {
      return;
    }

    const { monacoEditor } = this.inputEditor;

    const h = Math.max(height || 26, monacoEditor.getContentHeight());

    monacoEditor.layout({
      width: width || this._consoleInputElement?.offsetWidth!,
      height: h,
    });

    this._onInputHeightChange.fire(h);
  }

  private updateReadOnly(readOnly: boolean): void {
    if (this.inputEditor) {
      this.inputEditor.monacoEditor.updateOptions({ readOnly });
    }
  }

  private async updateInputDecoration(): Promise<void> {
    if (!this.inputEditor) {
      return;
    }

    const decorations: IDecorationApplyOptions[] = [];
    if (this._isReadonly && this.inputEditor.monacoEditor.hasTextFocus() && !this.inputEditor.monacoEditor.getValue()) {
      const transparentForeground = transparent(editorForeground, 0.4)(await this.themeService.getCurrentTheme());
      decorations.push({
        range: {
          startLineNumber: 0,
          endLineNumber: 0,
          startColumn: 0,
          endColumn: 1,
        },
        renderOptions: {
          after: {
            contentText: localize('debug.console.input.placeholder'),
            color: transparentForeground ? transparentForeground.toString() : undefined,
          },
        },
      });
    }

    this.inputEditor.monacoEditor.setDecorations('debug-console-input', DECORATION_KEY, decorations as any[]);
  }

  private setMode(): void {
    if (!this.inputEditor) {
      return;
    }

    const session = this.manager.currentSession;
    if (!session) {
      return;
    }

    const model = session.currentEditor();

    if (model) {
      this.inputEditor.monacoEditor.getModel()!.setMode(model.getModel()?.getLanguageIdentifier()!);
    }
  }

  private registerDecorationType(): void {
    const codeEditorService = this.overrideServicesRegistry.getRegisteredService(
      ServiceNames.CODE_EDITOR_SERVICE,
    ) as MonacoCodeService;
    codeEditorService.registerDecorationType('console-input-decoration', DECORATION_KEY, {});
  }

  private registerCompletion(): void {
    if (this._updateDisposable) {
      this._updateDisposable.dispose();
      this._updateDisposable = null;
    }

    const session = this.manager.currentSession;
    if (!session) {
      return;
    }

    const model = session.currentEditor();
    if (!model) {
      return;
    }

    this._updateDisposable = monaco.languages.registerCompletionItemProvider(
      model.getModel()?.getLanguageIdentifier().language!,
      {
        triggerCharacters: ['.'],
        provideCompletionItems: async (model, position, ctx) => {
          //  仅在支持自动补全查询的调试器中启用补全逻辑
          if (!this.manager.currentSession?.capabilities.supportsCompletionsRequest) {
            return;
          }
          if (model.uri.toString() !== this.consoleInputUri.toString()) {
            return null;
          }

          const session = this.manager.currentSession;
          const { triggerCharacter } = ctx;

          /**
           * 代码字符串处理
           */
          let value = model.getWordAtPosition(position);
          if (value && session) {
            const { word, startColumn, endColumn } = value;
            const res = await session.sendRequest('completions', {
              text: word,
              column: endColumn,
              frameId: session.currentFrame && session.currentFrame.raw.id,
            });
            return {
              suggestions: res.body.targets.map((item) => ({
                label: item.label,
                insertText: item.text || item.label,
                sortText: item.sortText,
                kind: monaco.languages.CompletionItemKind[firstUpperCase(item.type || 'property')],
                range: {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn,
                  endColumn,
                },
              })),
            } as monaco.languages.CompletionList;
          }

          /**
           * 特殊字符处理
           */
          value = model.getWordAtPosition({
            lineNumber: position.lineNumber,
            column: position.column - 1,
          });
          if (value && session && triggerCharacter) {
            const { word, endColumn } = value;

            const res = await session.sendRequest('completions', {
              text: word + triggerCharacter,
              column: endColumn + 1,
              frameId: session.currentFrame && session.currentFrame.raw.id,
            });
            return {
              suggestions: res.body.targets.map((item) => ({
                label: item.label,
                insertText: item.text || item.label,
                sortText: item.sortText,
                kind: monaco.languages.CompletionItemKind[firstUpperCase(item.type || 'property')],
                range: {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: endColumn + 1,
                  endColumn: endColumn + 1,
                },
              })),
            } as monaco.languages.CompletionList;
          }

          return null;
        },
      },
    );
  }

  disable() {
    if (this._updateDisposable) {
      this._updateDisposable.dispose();
      this._updateDisposable = null;
    }
    this.inputEditor?.monacoEditor.setValue('');
    this.inputEditor?.monacoEditor.setModel(null);
  }
}

// 不可保存，因此不需要设置 saveDocumentModel
@Injectable()
export class DebugConsoleInputDocumentProvider implements IEditorDocumentModelContentProvider {
  @Autowired(DebugConsoleService)
  private readonly debugConsole: DebugConsoleService;

  handlesScheme(scheme: string) {
    return scheme === Schemas.walkThroughSnippet;
  }

  async provideEditorDocumentModelContent() {
    return this.debugConsole.consoleInputValue;
  }

  isReadonly(): boolean {
    return false;
  }

  get onDidChangeContent() {
    return this.debugConsole.onConsoleInputValueChange;
  }

  preferLanguageForUri() {
    return 'plaintext';
  }
}
