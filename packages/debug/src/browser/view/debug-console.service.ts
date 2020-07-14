import { observable, action } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { URI, CommandRegistry, Emitter, Event } from '@ali/ide-core-common';
import { IEditorDocumentModelService, IEditorDocumentModelContentProvider } from '@ali/ide-editor/lib/browser';
import { EditorCollectionService } from '@ali/ide-editor';
import { DebugConsoleSession } from '../console/debug-console-session';

import throttle = require('lodash.throttle');
import { IContextKeyService } from '@ali/ide-core-browser';
import { DEBUG_CONSOLE_CONTAINER_ID, IDebugSessionManager } from '../../common';
import { DebugSessionManager } from '../debug-session-manager';

const options: monaco.editor.IEditorOptions = {
  wordWrap: 'on',
  overviewRulerLanes: 0,
  glyphMargin: false,
  lineNumbers: 'off',
  folding: false,
  selectOnLineNumbers: false,
  hideCursorInOverviewRuler: true,
  selectionHighlight: false,
  scrollbar: {
    horizontal: 'hidden',
    vertical: 'hidden',
    handleMouseWheel: false,
  },
  lineDecorationsWidth: 0,
  overviewRulerBorder: false,
  scrollBeyondLastLine: false,
  renderLineHighlight: 'none',
  fixedOverflowWidgets: true,
  acceptSuggestionOnEnter: 'on',
  minimap: {
    enabled: false,
  },
  renderIndentGuides: false,
};

@Injectable()
export class DebugConsoleService {
  @Autowired(DebugConsoleSession)
  protected readonly debugConsole: DebugConsoleSession;

  @Autowired(IMainLayoutService)
  protected readonly mainlayoutService: IMainLayoutService;

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

  @observable.shallow
  nodes: any[] = [];

  protected _consoleModel: monaco.editor.ITextModel;
  protected _consoleEditor: monaco.editor.ICodeEditor;
  protected _isCommandOrCtrl: boolean = false;
  protected _element: HTMLDivElement | null = null;
  protected _updateDisposable: monaco.IDisposable | null = null;

  static keySet = new Set(['inDebugMode']);

  constructor() {
    this.debugConsole.onDidChange(() => {
      this.throttleUpdateNodes();
    });
    this.contextKeyService.onDidChangeContext((e) => {
      if (e.payload.affectsSome(DebugConsoleService.keySet)) {
        const inDebugMode = this.contextKeyService.match('inDebugMode');
        if (inDebugMode) {
          this.enable();
        } else {
          this.disable();
        }
      }
    });
  }

  throttleUpdateNodes = throttle(this.updateNodes, 200);

  private _onValueChange = new Emitter<URI>();
  public onValueChange: Event<URI> = this._onValueChange.event;

  @action
  updateNodes() {
    this.nodes = this.debugConsole.getChildren();
  }

  get isVisible() {
    const bottomPanelHandler = this.mainlayoutService.getTabbarHandler(DEBUG_CONSOLE_CONTAINER_ID);
    return bottomPanelHandler && bottomPanelHandler.isVisible;
  }

  activate() {
    const bottomPanelHandler = this.mainlayoutService.getTabbarHandler(DEBUG_CONSOLE_CONTAINER_ID);
    if (bottomPanelHandler && !bottomPanelHandler.isVisible) {
      bottomPanelHandler.activate();
    }
  }

  execute = (value: string) => {
    this.debugConsole.execute(value);
  }

  get consoleInputUri() {
    return new URI('walkThroughSnippet://debug/console');
  }

  set element(e: HTMLDivElement | null) {
    this._element = e;
    this.editorService.createCodeEditor(this._element!, { ...options }).then((codeEditor) => {
      const editor = codeEditor.monacoEditor;

      editor.onDidChangeModelContent(({ changes }) => {
        const change = changes[0];
        if (change.text === '\n') {
          const value = editor.getValue();
          this.execute(value);
          editor.setValue('');
        }
      });

      this._consoleEditor = editor;
    });
  }

  get element() {
    return this._element;
  }

  @action.bound
  async _createConsoleInput() {
    if (!this._consoleEditor) {
      return;
    }

    const docModel = await this.documentService.createModelReference(this.consoleInputUri);
    const model = docModel.instance.getMonacoModel();
    model.updateOptions({ tabSize: 2 });
    model.onDidChangeContent(() => {
      if (model.getValue().indexOf('\n') > -1) {
        model.setValue(model.getValue().replace(/\n/g, ''));
      }
      this._onValueChange.fire(this.consoleInputUri);
    });
    this._consoleModel = model;
    this._consoleEditor.setModel(model);

    setTimeout(() => {
      this._consoleEditor.layout();
    }, 0);
  }

  get consoleInputValue() {
    return (this._consoleModel && this._consoleModel.getValue()) || '';
  }

  async enable() {
    this._updateDisposable = monaco.languages.registerCompletionItemProvider('plaintext', {
      triggerCharacters: ['.'],
      provideCompletionItems: async (model, position, ctx) => {
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
                kind: monaco.languages.CompletionItemKind.Property,
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
                kind: monaco.languages.CompletionItemKind.Property,
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

    return await this._createConsoleInput();
  }

  disable() {
    if (this._updateDisposable) {
      this._updateDisposable.dispose();
      this._updateDisposable = null;
    }
    this._consoleEditor.setValue('');
    this._consoleEditor.setModel(null);
  }
}

@Injectable()
export class DebugConsoleDocumentProvider implements IEditorDocumentModelContentProvider {
  @Autowired(DebugConsoleService)
  protected readonly debugConsole: DebugConsoleService;

  handlesScheme(scheme: string) {
    return scheme === this.debugConsole.consoleInputUri.scheme;
  }

  async provideEditorDocumentModelContent() {
    return this.debugConsole.consoleInputValue;
  }

  isReadonly(): boolean {
    return false;
  }

  onDidChangeContent = this.debugConsole.onValueChange;

  preferLanguageForUri() {
    return 'plaintext';
  }

  saveDocumentModel() {
    return { state: 'success' } as any;
  }
}
