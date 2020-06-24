import { observable, action } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { URI, CommandRegistry, Emitter, Event } from '@ali/ide-core-common';
import { IEditorDocumentModelService, IEditorDocumentModelContentProvider } from '@ali/ide-editor/lib/browser';
import { EditorCollectionService } from '@ali/ide-editor';
import { DebugConsoleSession } from '../console/debug-console-session';

import throttle = require('lodash.throttle');
import { IContextKeyService } from '@ali/ide-core-browser';
import { DEBUG_CONSOLE_CONTAINER_ID } from '../../common';

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
  },
  lineDecorationsWidth: 0,
  overviewRulerBorder: false,
  scrollBeyondLastLine: false,
  renderLineHighlight: 'none',
  fixedOverflowWidgets: true,
  acceptSuggestionOnEnter: 'smart',
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

  @observable.shallow
  nodes: any[] = [];

  protected _consoleModel: monaco.editor.ITextModel;
  protected _consoleEditor: monaco.editor.ICodeEditor;
  protected _isCommandOrCtrl: boolean = false;
  protected _element: HTMLDivElement | null = null;

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

  private _handleKeyDown(e: monaco.IKeyboardEvent, model: monaco.editor.ITextModel) {
    switch (e.code) {
      case 'Enter':
        e.preventDefault();
        this.execute(model.getValue());
        model.setValue('');
        break;
      default:
        break;
    }
  }

  private _handleKeyUp() {
    this._isCommandOrCtrl = false;
  }

  set element(e: HTMLDivElement | null) {
    this._element = e;
    this.editorService.createCodeEditor(this._element!, { ...options }).then((codeEditor) => {
      const editor = codeEditor.monacoEditor;
      editor.onKeyDown((e) => {
        this._handleKeyDown(e, this._consoleModel);
      });
      editor.onKeyUp(() => {
        this._handleKeyUp();
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
    return await this._createConsoleInput();
  }

  disable() {
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
