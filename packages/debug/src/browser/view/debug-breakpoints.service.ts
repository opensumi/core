import { Injectable, Autowired } from '@ali/common-di';
import { observable, action } from 'mobx';
import { DebugViewModel } from './debug-view-model';
import { DebugBreakpoint } from '../model';
import { IWorkspaceService } from '@ali/ide-workspace';
import { URI, WithEventBus, OnEvent, localize } from '@ali/ide-core-browser';
import { BreakpointItem } from './debug-breakpoints.view';
import { BreakpointManager } from '../breakpoint';
import { WorkspaceEditDidRenameFileEvent, WorkspaceEditDidDeleteFileEvent } from '@ali/ide-workspace-edit';

@Injectable()
export class DebugBreakpointsService extends WithEventBus {

  @Autowired(DebugViewModel)
  protected readonly model: DebugViewModel;

  @Autowired(IWorkspaceService)
  protected readonly workspaceService: IWorkspaceService;

  @Autowired(BreakpointManager)
  protected readonly breakpointsManager: BreakpointManager;

  @observable
  nodes: BreakpointItem[] = [];

  @observable
  enable: boolean = this.breakpointsManager.breakpointsEnabled;

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
    this.breakpointsManager.onDidChangeBreakpoints(() => {
      this.updateBreakpoints();
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
    this.breakpointsManager.cleanAllMarkers(uri);
    this.updateBreakpoints();
  }

  async updateRoots() {
    const roots = await this.workspaceService.roots;
    this.roots = roots.map((file) => new URI(file.uri));
  }

  extractNodes(items: DebugBreakpoint[]) {
    const nodes: BreakpointItem[] = [];
    items.forEach((item) => {
      if (item) {
        const parent = this.roots.filter((root) => root.isEqualOrParent(item.uri))[0];
        nodes.push({
          id: item.id,
          name: item.uri.displayName,
          description: parent && parent.relative(item.uri)!.toString(),
          breakpoint: item,
        });
      }
    });
    return nodes;
  }

  @action
  updateBreakpoints() {
    this.nodes = this.extractNodes(this.model.breakpoints);
  }

  removeAllBreakpoints() {
    this.breakpointsManager.cleanAllMarkers();
    this.updateBreakpoints();
  }

  toggleBreakpoints() {
    this.breakpointsManager.breakpointsEnabled = !this.breakpointsManager.breakpointsEnabled;
    this.enable = this.breakpointsManager.breakpointsEnabled;
  }
}
