import { MonacoCodeService } from '@ali/ide-editor/lib/browser/editor.override';
import { DebugState } from './../../debug-session';
import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import { ITextModel } from '@ali/monaco-editor-core/esm/vs/editor/common/model';
import { Injectable, Autowired } from '@ali/common-di';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { Schemas, URI, CommandRegistry, Emitter, Event } from '@ali/ide-core-common';
import { IEditorDocumentModelService, IEditorDocumentModelContentProvider, ICodeEditor, getSimpleEditorOptions } from '@ali/ide-editor/lib/browser';
import { EditorCollectionService, IDecorationApplyOptions } from '@ali/ide-editor';
import { IContextKeyService, MonacoOverrideServiceRegistry, ServiceNames, localize } from '@ali/ide-core-browser';
import { DEBUG_CONSOLE_CONTAINER_ID, IDebugSessionManager, CONTEXT_IN_DEBUG_MODE_KEY } from '../../../common';
import { DebugSessionManager } from '../../debug-session-manager';
import { DebugConsoleModelService } from './debug-console-tree.model.service';
import { transparent, editorForeground, IThemeService } from '@ali/ide-theme';

const DECORATION_KEY = 'consoleinputdecoration';

const firstUpperCase = (str: string) => {
  return str.replace(/^\S/, (s) => s.toUpperCase());
};

const consoleInputMonacoOptions: monaco.editor.IEditorOptions = {
  ...getSimpleEditorOptions(),
  scrollbar: {
    horizontal: 'hidden',
    vertical: 'hidden',
    handleMouseWheel: false,
  },
  acceptSuggestionOnEnter: 'on',
  renderIndentGuides: false,
  readOnly: true,
};

@Injectable()
export class DebugConsoleService {
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

  protected _isCommandOrCtrl: boolean = false;
  protected _consoleInputElement: HTMLDivElement | null = null;
  protected _updateDisposable: monaco.IDisposable | null = null;
  protected _consoleModel: ITextModel;
  protected get _isReadonly(): boolean {
    const session = this.manager.currentSession;
    if (session && session.state !== DebugState.Inactive ) {
      return false;
    }

    return true;
  }

  private inputEditor?: ICodeEditor;

  static keySet = new Set([CONTEXT_IN_DEBUG_MODE_KEY]);

  constructor() {
    this.contextKeyService.onDidChangeContext((e) => {
      if (e.payload.affectsSome(DebugConsoleService.keySet)) {
        const inDebugMode = this.contextKeyService.match(CONTEXT_IN_DEBUG_MODE_KEY);
        if (inDebugMode) {
          this.updateReadOnly(false);
          this.updateInputDecoration();
        } else {
          this.updateReadOnly(true);
        }
      }
    });
  }

  private _onConsoleInputValueChange = new Emitter<URI>();
  public onConsoleInputValueChange: Event<URI> = this._onConsoleInputValueChange.event;

  get isVisible() {
    const bottomPanelHandler = this.mainLayoutService.getTabbarHandler(DEBUG_CONSOLE_CONTAINER_ID);
    return bottomPanelHandler && bottomPanelHandler.isVisible;
  }

  get tree(): DebugConsoleModelService {
    return this.debugConsoleModelService;
  }

  activate() {
    const bottomPanelHandler = this.mainLayoutService.getTabbarHandler(DEBUG_CONSOLE_CONTAINER_ID);
    if (bottomPanelHandler && !bottomPanelHandler.isVisible) {
      bottomPanelHandler.activate();
    }
  }

  execute = (value: string) => {
    return this.debugConsoleModelService.execute(value);
  }

  get consoleInputUri() {
    return new URI('debug/console/input').withScheme(Schemas.walkThroughSnippet);
  }

  get consoleInputElement() {
    return this._consoleInputElement;
  }

  public focusInput(): void {
    if (this.inputEditor) {
      this.inputEditor.monacoEditor.focus();
    }
  }

  public async initConsoleInputMonacoInstance(e: HTMLDivElement | null) {
    if (!e) {
      return;
    }
    this._consoleInputElement = e;
    this.inputEditor = await this.editorService.createCodeEditor(this._consoleInputElement!, { ...consoleInputMonacoOptions });
    const editor = this.inputEditor.monacoEditor;
    editor.onKeyDown(async (e: monaco.IKeyboardEvent) => {
      if (e.keyCode === monaco.KeyCode.Enter) {
        const value = editor.getValue();
        await this.execute(value);
        editor.setValue('');
      }
    });

    this.registerCompletion();
    this.registerDecorationType();
    await this.createConsoleInput();
  }

  private async createConsoleInput() {
    if (!this.inputEditor?.monacoEditor) {
      return;
    }

    const docModel = await this.documentService.createModelReference(this.consoleInputUri);
    const model = docModel.instance.getMonacoModel();
    model.updateOptions({ tabSize: 2 });
    this._consoleModel = model;
    this.inputEditor.monacoEditor.setModel(model);

    setTimeout(() => {
      this.inputEditor?.monacoEditor.layout();
    }, 0);

    this.inputEditor.monacoEditor.onDidFocusEditorText(() => this.updateInputDecoration());
    this.inputEditor.monacoEditor.onDidBlurEditorText(() => this.updateInputDecoration());

    await this.updateInputDecoration();
  }

  get consoleInputValue() {
    return (this._consoleModel && this._consoleModel.getValue()) || '';
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

    this.inputEditor.monacoEditor.setDecorations(DECORATION_KEY, decorations as any[]);
  }

  private registerDecorationType(): void {
    const codeEditorService = this.overrideServicesRegistry.getRegisteredService(ServiceNames.CODE_EDITOR_SERVICE) as MonacoCodeService;
    codeEditorService.registerDecorationType(DECORATION_KEY, {});
  }

  private registerCompletion(): void {
    this._updateDisposable = monaco.languages.registerCompletionItemProvider('plaintext', {
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
            suggestions: res.body.targets.map((item) => {
              return {
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
              };
            }),
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
            suggestions: res.body.targets.map((item) => {
              return {
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
              };
            }),
          } as monaco.languages.CompletionList;
        }

        return null;
      },
    });
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
// TODO: 统一的 walkThroughSnippet 的 provider，应挪走
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
