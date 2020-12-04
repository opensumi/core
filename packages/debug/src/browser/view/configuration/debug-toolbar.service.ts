import { Injectable, Autowired } from '@ali/common-di';
import { observable, action } from 'mobx';
import { DebugViewModel } from '../debug-view-model';
import { DebugState, DebugSession } from '../../debug-session';
import { IContextKeyService, CommandService } from '@ali/ide-core-browser';
import { AbstractContextMenuService, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { MenuNode } from '@ali/ide-core-browser/lib/menu/next';

@Injectable()
export class DebugToolbarService {

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  @Autowired(DebugViewModel)
  protected readonly model: DebugViewModel;

  @observable
  state: DebugState;

  @observable
  sessionCount: number;

  @observable
  currentSession: DebugSession | undefined;

  @observable.shallow
  sessions: DebugSession[] = [];

  @observable
  currentToolBarMenu: MenuNode[];

  private readonly toolBarMenuMap: Map<string, MenuNode[]> = new Map();

  constructor() {
    this.model.onDidChange(() => {
      this.updateToolBarMenu();
      this.updateModel();
    });
  }

  @action
  updateModel() {
    this.state = this.model.state;
    this.currentSession = this.model.currentSession;
    this.sessions = Array.from(this.model.sessions).filter((session: DebugSession) => {
      return session && session.state > DebugState.Inactive;
    });
    this.sessionCount = this.sessions.length;
    this.currentToolBarMenu = this.getToolBarMenu();
  }

  @action
  updateToolBarMenu() {
    if (this.currentSession && this.currentSession.id && !this.toolBarMenuMap.has(this.currentSession.id)) {
      const contextMenu = this.contextMenuService.createMenu({ id: MenuId.DebugToolBar, contextKeyService: this.contextKeyService.createScoped() });
      this.toolBarMenuMap.set(
        this.currentSession.id,
        contextMenu.getMergedMenuNodes(),
      );
      contextMenu.dispose();
    }
  }

  doStart = () => {
    return this.model.start();
  }

  doRestart = () => {
    return this.model.restart();
  }

  doStop = () => {
    return this.model.currentSession && this.model.currentSession.terminate();
  }
  doContinue = () => {
    return this.model.currentThread && this.model.currentThread.continue();
  }
  doPause = () => {
    return this.model.currentThread && this.model.currentThread.pause();
  }
  doStepOver = () => {
    return this.model.currentThread && this.model.currentThread.stepOver();
  }
  doStepIn = () => {
    return this.model.currentThread && this.model.currentThread.stepIn();
  }
  doStepOut = () => {
    return this.model.currentThread && this.model.currentThread.stepOut();
  }
  doRunToolBarMenu = (menu: MenuNode) => {
    const { id } = menu;
    this.commandService.executeCommand(id);
  }

  getToolBarMenu = () => {
    return this.toolBarMenuMap.get(this.currentSession?.id!) || [];
  }

  updateCurrentSession = (session: DebugSession) => {
    this.model.currentSession = session;
  }

}
