import { observable, action } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { URI, Emitter, CommandRegistry } from '@ali/ide-core-common';
import { IEditorDocumentModelService, IEditorDocumentModelContentProvider } from '@ali/ide-editor/lib/browser';
import { EditorCollectionService } from '@ali/ide-editor';
import { DebugContribution } from '../debug-contribution';
import { DebugConsoleSession } from '../console/debug-console-session';

import throttle = require('lodash.throttle');

const options: monaco.editor.IEditorOptions = {
  lineNumbers: 'off',
  lineHeight: 24,
  lineDecorationsWidth: 0,
  glyphMargin: false,
  minimap: { enabled: false },
  scrollbar: {
    handleMouseWheel: false,
    vertical: 'hidden',
    horizontal: 'hidden',
  },
  hideCursorInOverviewRuler: true,
  overviewRulerLanes: 0,
  revealHorizontalRightPadding: 0,
  overviewRulerBorder: false,
  folding: false,
  wordWrap: 'off',
  matchBrackets: false,
  fixedOverflowWidgets: true,
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

  @observable.shallow
  nodes: any[] = [];

  protected _consoleModel: monaco.editor.ITextModel;
  protected _consoleEditor: monaco.editor.ICodeEditor;
  protected _isCommandOrCtrl: boolean = false;

  constructor() {
    this.debugConsole.onDidChange(() => {
      this.throttleUpdateNodes();
    });
  }

  throttleUpdateNodes = throttle(this.updateNodes, 200);

  private _onValueChange = new Emitter<URI>();
  public onValueChange = this._onValueChange.event;

  @action
  updateNodes() {
    this.nodes = this.debugConsole.getChildren();
  }

  get isVisible() {
    const bottomPanelHandler = this.mainlayoutService.getTabbarHandler(DebugContribution.DEBUG_CONSOLE_CONTAINER_ID);
    return bottomPanelHandler && bottomPanelHandler.isVisible;
  }

  activate() {
    const bottomPanelHandler = this.mainlayoutService.getTabbarHandler(DebugContribution.DEBUG_CONSOLE_CONTAINER_ID);
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

  @action.bound
  async createConsoleInput(container: HTMLDivElement) {
    const docModel = await this.documentService.createModelReference(this.consoleInputUri);
    const model = docModel.instance.getMonacoModel();
    model.updateOptions({ tabSize: 2 });
    model.onDidChangeContent(() => {
      if (model.getValue().indexOf('\n') > -1) {
        model.setValue(model.getValue().replace(/\n/g, ''));
      }
      this._onValueChange.fire(this.consoleInputUri);
    });
    this.editorService.createCodeEditor(container, { model, ...options }).then((codeEditor) => {
      const editor = codeEditor.monacoEditor;
      editor.layout();
      editor.onKeyDown((e) => {
        this._handleKeyDown(e, model);
      });
      editor.onKeyUp(() => {
        this._handleKeyUp();
      });
      this._consoleEditor = editor;
    });
    this._consoleModel = model;
  }

  get consoleInputValue() {
    return (this._consoleModel && this._consoleModel.getValue()) || '';
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
    return 'javascript';
  }

  saveDocumentModel() {
    return { state: 'success' } as any;
  }
}
