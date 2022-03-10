import { observable, action, runInAction } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import { URI, WithEventBus, OnEvent, IContextKeyService, IReporterService, Schemas } from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { ICodeEditor, EditorCollectionService, getSimpleEditorOptions } from '@opensumi/ide-editor';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { WorkspaceEditDidRenameFileEvent, WorkspaceEditDidDeleteFileEvent } from '@opensumi/ide-workspace-edit';

import { DEBUG_REPORT_NAME, CONTEXT_IN_DEBUG_MODE_KEY, IDebugBreakpoint } from '../../../common';
import { IDebugSessionManager } from '../../../common/debug-session';
import {
  DebugBreakpoint,
  DebugExceptionBreakpoint,
  isDebugBreakpoint,
  isDebugExceptionBreakpoint,
  BreakpointManager,
  DebugDecorator,
} from '../../breakpoint';
import { DebugSessionManager } from '../../debug-session-manager';
import { DebugViewModel } from '../debug-view-model';

import { BreakpointItem } from './debug-breakpoints.view';

@Injectable()
export class DebugBreakpointsService extends WithEventBus {
  @Autowired(DebugViewModel)
  protected readonly model: DebugViewModel;

  @Autowired(IWorkspaceService)
  protected readonly workspaceService: IWorkspaceService;

  @Autowired(BreakpointManager)
  protected readonly breakpoints: BreakpointManager;

  @Autowired(IDebugSessionManager)
  protected readonly sessions: DebugSessionManager;

  @Autowired(LabelService)
  protected readonly labelProvider: LabelService;

  @Autowired(IContextKeyService)
  protected readonly contextKeyService: IContextKeyService;

  @Autowired(IReporterService)
  protected readonly reporterService: IReporterService;

  @Autowired(EditorCollectionService)
  protected readonly editorService: EditorCollectionService;

  @Autowired(IEditorDocumentModelService)
  protected readonly documentService: IEditorDocumentModelService;

  private _inputEditor: ICodeEditor;

  public get inputEditor(): ICodeEditor {
    return this._inputEditor;
  }

  @observable
  public nodes: BreakpointItem[] = [];

  @observable
  public enable: boolean;

  @observable
  public inDebugMode: boolean;

  public roots: URI[];

  constructor() {
    super();
    this.init();
  }

  async init() {
    await this.updateRoots();
    this.updateBreakpoints();
    this.workspaceService.onWorkspaceChanged(async () => {
      await this.updateRoots();
      this.updateBreakpoints();
    });
    this.breakpoints.onDidChangeBreakpoints(() => {
      this.updateBreakpoints();
    });
    this.breakpoints.onDidChangeExceptionsBreakpoints(() => {
      this.updateBreakpoints();
    });
    this.contextKeyService.onDidChangeContext((e) => {
      if (e.payload.affectsSome(new Set([CONTEXT_IN_DEBUG_MODE_KEY]))) {
        runInAction(() => {
          this.inDebugMode = this.contextKeyService.getContextValue(CONTEXT_IN_DEBUG_MODE_KEY) || false;
        });
      }
    });
  }

  public getBreakpointDecoration(breakpoint: IDebugBreakpoint, isDebugMode = false, enabled = true) {
    return new DebugDecorator().getDecoration(breakpoint, isDebugMode, enabled);
  }

  @OnEvent(WorkspaceEditDidRenameFileEvent)
  onRenameFile(e: WorkspaceEditDidRenameFileEvent) {
    this.removeBreakpoints(e.payload.oldUri);
  }

  @OnEvent(WorkspaceEditDidDeleteFileEvent)
  onDeleteFile(e: WorkspaceEditDidDeleteFileEvent) {
    this.removeBreakpoints(e.payload.oldUri);
  }

  private removeBreakpoints(uri: URI) {
    this.breakpoints.cleanAllMarkers(uri);
    this.updateBreakpoints();
  }

  @action
  async updateRoots() {
    this.enable = this.breakpoints.breakpointsEnabled;
    this.inDebugMode = this.contextKeyService.getContextValue(CONTEXT_IN_DEBUG_MODE_KEY) || false;
    const roots = await this.workspaceService.roots;
    this.roots = roots.map((file) => new URI(file.uri));
  }

  @action.bound
  toggleBreakpointEnable(data: IDebugBreakpoint | DebugExceptionBreakpoint) {
    if (isDebugBreakpoint(data)) {
      const real = this.breakpoints.getBreakpoint(URI.parse(data.uri), {
        lineNumber: data.raw.line,
        column: data.raw.column,
      });
      if (real) {
        real.enabled = !real.enabled;
        this.breakpoints.updateBreakpoint(real);
      }
    }
    if (isDebugExceptionBreakpoint(data)) {
      this.breakpoints.updateExceptionBreakpoints(data.filter, !data.default);
    }
  }

  extractNodes(items: (DebugExceptionBreakpoint | IDebugBreakpoint)[]) {
    const nodes: BreakpointItem[] = [];
    items.forEach((item) => {
      if (isDebugBreakpoint(item)) {
        const uri = URI.parse(item.uri);
        const parent = this.roots.filter((root) => root.isEqualOrParent(uri))[0];
        nodes.push({
          id: item.id,
          name: uri.displayName,
          description: parent && parent.relative(uri)!.toString(),
          breakpoint: item,
        });
      }
      if (isDebugExceptionBreakpoint(item)) {
        nodes.push({
          id: item.filter,
          name: item.label,
          description: '',
          breakpoint: item,
        });
      }
    });
    return nodes;
  }

  @action
  private updateBreakpoints() {
    this.nodes = this.extractNodes([
      ...this.breakpoints.getExceptionBreakpoints(),
      ...this.breakpoints.getBreakpoints(),
    ]);
  }

  removeAllBreakpoints() {
    this.breakpoints.clearBreakpoints();
  }

  delBreakpoint(bp: IDebugBreakpoint): void {
    this.breakpoints.delBreakpoint(bp);
  }

  @action
  toggleBreakpoints() {
    this.breakpoints.breakpointsEnabled = !this.breakpoints.breakpointsEnabled;
    this.enable = this.breakpoints.breakpointsEnabled;

    if (this.enable) {
      this.reporterService.point(DEBUG_REPORT_NAME?.DEBUG_BREAKPOINT, 'enabled');
    } else {
      this.reporterService.point(DEBUG_REPORT_NAME?.DEBUG_BREAKPOINT, 'unenabled');
    }
  }

  public async createBreakpointInput(container: HTMLElement): Promise<ICodeEditor> {
    this._inputEditor = await this.editorService.createCodeEditor(container!, {
      ...getSimpleEditorOptions(),
      scrollbar: {
        horizontal: 'hidden',
        vertical: 'hidden',
        handleMouseWheel: false,
      },
      acceptSuggestionOnEnter: 'on',
      renderIndentGuides: false,
    });
    const docModel = await this.documentService.createModelReference(
      new URI('debug/breakpoint/expression/input').withScheme(Schemas.walkThroughSnippet),
    );

    const model = docModel.instance.getMonacoModel();
    model.updateOptions({ tabSize: 2 });
    this._inputEditor.monacoEditor.setModel(model);
    return Promise.resolve(this.inputEditor);
  }
}
