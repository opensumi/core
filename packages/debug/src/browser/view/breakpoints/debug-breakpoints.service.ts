import { Injectable, Autowired } from '@ali/common-di';
import { observable, action, runInAction } from 'mobx';
import { DebugViewModel } from '../debug-view-model';
import { DebugBreakpoint, DebugExceptionBreakpoint, isDebugBreakpoint, isDebugExceptionBreakpoint, BreakpointManager, DebugDecorator } from '../../breakpoint';
import { IWorkspaceService } from '@ali/ide-workspace';
import { URI, WithEventBus, OnEvent, IContextKeyService, IReporterService } from '@ali/ide-core-browser';
import { BreakpointItem } from './debug-breakpoints.view';
import { WorkspaceEditDidRenameFileEvent, WorkspaceEditDidDeleteFileEvent } from '@ali/ide-workspace-edit';
import { IDebugSessionManager } from '../../../common/debug-session';
import { DebugSessionManager } from '../../debug-session-manager';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { DEBUG_REPORT_NAME } from '../../../common';

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
      if (e.payload.affectsSome(new Set(['inDebugMode']))) {
        runInAction(() => {
          this.inDebugMode = this.contextKeyService.getContextValue('inDebugMode') || false;
        });
      }
    });
  }

  public getBreakpointDecoration(breakpoint: DebugBreakpoint, isDebugMode: boolean = false, enabled: boolean = true) {
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
    this.inDebugMode = this.contextKeyService.getContextValue('inDebugMode') || false;
    const roots = await this.workspaceService.roots;
    this.roots = roots.map((file) => new URI(file.uri));
  }

  @action.bound
  toggleBreakpointEnable(data: DebugBreakpoint | DebugExceptionBreakpoint) {
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

  extractNodes(items: (DebugExceptionBreakpoint | DebugBreakpoint)[]) {
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
    this.nodes = this.extractNodes([...this.breakpoints.getExceptionBreakpoints(), ...this.breakpoints.getBreakpoints()]);
  }

  removeAllBreakpoints() {
    this.breakpoints.clearBreakpoints();
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
}
