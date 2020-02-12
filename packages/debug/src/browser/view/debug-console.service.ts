import { Injectable, Autowired } from '@ali/common-di';
import { DebugConsoleSession } from '../console/debug-console-session';
import { observable, action } from 'mobx';
import { DebugContribution } from '../debug-contribution';
import { IMainLayoutService } from '@ali/ide-main-layout';
import throttle = require('lodash.throttle');
import { URI, Emitter } from '@ali/ide-core-common';
import { MonacoService } from '@ali/ide-monaco';
import { IEditorDocumentModelService, IEditorDocumentModelContentProvider } from '@ali/ide-editor/lib/browser';

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

  @Autowired(MonacoService)
  protected readonly monacoService: MonacoService;

  @Autowired(IEditorDocumentModelService)
  protected readonly documentService: IEditorDocumentModelService;

  @observable.shallow
  nodes: any[] = [];

  protected _consoleModel: monaco.editor.ITextModel;
  protected _consoleEditor: monaco.editor.IStandaloneCodeEditor;

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
    this.monacoService.createCodeEditor(container, { model, ...options }).then((editor) => {
      editor.layout();
      editor.onKeyDown((e) => {
        if (e.code === 'Enter') {
          e.preventDefault();
          this.execute(model.getValue());
        }
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
