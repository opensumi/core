import { Injectable, Autowired } from '@ali/common-di';
import { observable, action } from 'mobx';
import { DebugViewModel } from './debug-view-model';
import { DebugBreakpoint, DebugExceptionBreakpoint } from '../model';
import { IWorkspaceService } from '@ali/ide-workspace';
import { URI, WithEventBus, OnEvent, localize, IContextKeyService } from '@ali/ide-core-browser';
import { BreakpointItem } from './debug-breakpoints.view';
import { BreakpointManager } from '../breakpoint';
import { WorkspaceEditDidRenameFileEvent, WorkspaceEditDidDeleteFileEvent } from '@ali/ide-workspace-edit';
import { IDebugSessionManager } from '../../common/debug-session';
import { DebugSessionManager } from '../debug-session-manager';
import { LabelService } from '@ali/ide-core-browser/lib/services';

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

  @observable
  nodes: BreakpointItem[] = [];

  @observable
  enable: boolean = this.breakpoints.breakpointsEnabled;

  @observable
  inDebugMode: boolean = this.contextKeyService.getContextValue('inDebugMode') || false;

  roots: URI[];

  constructor() {
    super();
    this.init();
  }

  async init() {
    await this.updateRoots();
    this.workspaceService.onWorkspaceChanged(async () => {
      await this.updateRoots();
    });
    this.updateBreakpoints();
    this.sessions.onDidChangeBreakpoints(() => {
      this.updateBreakpoints();
    });
    this.sessions.onDidChangeActiveDebugSession(() => {
      this.updateBreakpoints();
    });
    this.contextKeyService.onDidChangeContext((e) => {
      if (e.payload.affectsSome(new Set(['inDebugMode']))) {
        this.inDebugMode = this.contextKeyService.getContextValue('inDebugMode') || false;
      }
    });
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
    const roots = await this.workspaceService.roots;
    this.roots = roots.map((file) => new URI(file.uri));
  }

  extractNodes(items: (DebugBreakpoint | DebugExceptionBreakpoint)[]) {
    const nodes: BreakpointItem[] = [];
    items.forEach((item) => {
      if (item) {
        if (item instanceof DebugBreakpoint) {
          const parent = this.roots.filter((root) => root.isEqualOrParent(item.uri))[0];
          nodes.push({
            id: item.id,
            name: item.uri.displayName,
            description: parent && parent.relative(item.uri)!.toString(),
            breakpoint: item,
          });
        } else if (item instanceof DebugExceptionBreakpoint) {
          nodes.push({
            id: item.id,
            name: item.label,
            description: '',
            breakpoint: item,
          });
        }
      }
    });
    return nodes;
  }

  @action
  updateBreakpoints() {
    this.nodes = this.extractNodes([...this.model.exceptionBreakpoints, ...this.model.breakpoints]);
  }

  removeAllBreakpoints() {
    this.breakpoints.cleanAllMarkers();
    this.updateBreakpoints();
  }

  toggleBreakpoints() {
    this.breakpoints.breakpointsEnabled = !this.breakpoints.breakpointsEnabled;
    this.enable = this.breakpoints.breakpointsEnabled;
  }
}
