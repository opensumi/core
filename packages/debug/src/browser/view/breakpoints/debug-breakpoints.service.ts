import { observable, action, runInAction } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import {
  URI,
  WithEventBus,
  OnEvent,
  IContextKeyService,
  IReporterService,
  Schemes,
  Emitter,
  Event,
  IRange,
} from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { ICodeEditor, EditorCollectionService, getSimpleEditorOptions } from '@opensumi/ide-editor';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { WorkspaceEditDidRenameFileEvent, WorkspaceEditDidDeleteFileEvent } from '@opensumi/ide-workspace-edit';

import { DEBUG_REPORT_NAME, CONTEXT_IN_DEBUG_MODE_KEY, IDebugBreakpoint } from '../../../common';
import { IDebugSessionManager } from '../../../common/debug-session';
import {
  DebugExceptionBreakpoint,
  isDebugBreakpoint,
  isDebugExceptionBreakpoint,
  BreakpointManager,
  DebugDecorator,
  EXCEPTION_BREAKPOINT_URI,
} from '../../breakpoint';
import { DebugSessionManager } from '../../debug-session-manager';
import { DebugViewModel } from '../debug-view-model';

import { BreakpointsTreeNode } from './debug-breakpoints-tree.model';
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

  private readonly _onDidChangeBreakpointsTreeNode = new Emitter<Map<string, BreakpointsTreeNode[]>>();
  readonly onDidChangeBreakpointsTreeNode: Event<Map<string, BreakpointsTreeNode[]>> =
    this._onDidChangeBreakpointsTreeNode.event;

  private readonly _onDidFocusedBreakpoints = new Emitter<{ uri: URI; range: IRange }>();
  readonly onDidFocusedBreakpoints: Event<{ uri: URI; range: IRange }> = this._onDidFocusedBreakpoints.event;

  private _inputEditor: ICodeEditor;

  public get inputEditor(): ICodeEditor {
    return this._inputEditor;
  }

  public treeNodeMap: Map<string, BreakpointsTreeNode[]> = new Map();

  @observable
  public enable: boolean;

  @observable
  public inDebugMode: boolean;

  public roots: URI[];

  constructor() {
    super();
    this.init();
  }

  public launchFocusedBreakpoints(data: { uri: URI; range: IRange }): void {
    this._onDidFocusedBreakpoints.fire(data);
  }

  async init() {
    await this.updateRoots();
    this.workspaceService.onWorkspaceChanged(async () => {
      this.updateRoots();
      this.updateBreakpoints();
    });
    this.breakpoints.onDidChangeBreakpoints(() => {
      this.updateBreakpoints();
    });
    this.breakpoints.onDidChangeExceptionsBreakpoints(() => {
      this.updateBreakpoints();
    });
    this.breakpoints.whenReady.then(() => {
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

  extractNodes(item: DebugExceptionBreakpoint | IDebugBreakpoint): BreakpointItem | undefined {
    if (isDebugBreakpoint(item)) {
      return {
        id: item.id,
        name: '',
        description: '',
        onDescriptionChange: Event.None,
        breakpoint: item,
      };
    }
    if (isDebugExceptionBreakpoint(item)) {
      return {
        id: item.filter,
        name: item.label,
        onDescriptionChange: Event.None,
        description: '',
        breakpoint: item,
      };
    }
  }

  @action
  private async updateBreakpoints() {
    await this.breakpoints.whenReady;
    this.treeNodeMap.clear();

    const allBreakpoints = [...this.breakpoints.getExceptionBreakpoints(), ...this.breakpoints.getBreakpoints()];

    allBreakpoints.forEach((item) => {
      const extractNode = this.extractNodes(item);
      if (extractNode) {
        const uri = isDebugBreakpoint(item) ? URI.parse(item.uri) : EXCEPTION_BREAKPOINT_URI;
        const getTreeNodes = this.treeNodeMap.get(uri.toString()) || [];
        getTreeNodes.push(new BreakpointsTreeNode(uri, extractNode));
        this.treeNodeMap.set(uri.toString(), getTreeNodes);
      }
    });
    this._onDidChangeBreakpointsTreeNode.fire(this.treeNodeMap);
  }

  private async getDocumentModelRef(uri: URI) {
    const document = this.documentService.getModelReference(uri);
    if (!document) {
      return this.documentService.createModelReference(uri);
    }
    return document;
  }

  public async refreshBreakpointsInfo() {
    const treeNodeValues = this.treeNodeMap.values();
    const allTreeNodes: BreakpointsTreeNode[] = Array.from(treeNodeValues).reduce((acc, cur) => acc.concat(cur), []);

    for await (const node of allTreeNodes) {
      const { rawData, uri } = node;
      if (isDebugBreakpoint(rawData.breakpoint)) {
        const line = rawData.breakpoint.raw.line;
        const monacoModel = await this.getDocumentModelRef(uri);
        if (!monacoModel) {
          return;
        }
        const model = monacoModel.instance.getMonacoModel();
        const maxLineCount = model.getLineCount();
        if (line > maxLineCount) {
          return;
        }
        const getContent = model.getLineContent(line);
        node.fireDescriptionChange(getContent.trim());
      }
    }
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
      lineHeight: 21,
      scrollbar: {
        horizontal: 'hidden',
        vertical: 'hidden',
        handleMouseWheel: false,
      },
      acceptSuggestionOnEnter: 'on',
      renderIndentGuides: false,
    });
    const docModel = await this.documentService.createModelReference(
      new URI('debug/breakpoint/expression/input').withScheme(Schemes.walkThroughSnippet),
    );

    const model = docModel.instance.getMonacoModel();
    model.updateOptions({ tabSize: 2 });
    this._inputEditor.monacoEditor.setModel(model);
    return Promise.resolve(this.inputEditor);
  }
}
