import { observable, action } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import { IContextKeyService, IReporterService } from '@opensumi/ide-core-browser';
import { AbstractContextMenuService, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { IContextMenu } from '@opensumi/ide-core-browser/lib/menu/next';

import { DebugState, DEBUG_REPORT_NAME } from '../../../common';
import { DebugSession } from '../../debug-session';
import { DebugViewModel } from '../debug-view-model';

@Injectable()
export class DebugToolbarService {
  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  @Autowired(DebugViewModel)
  protected readonly model: DebugViewModel;

  @Autowired(IReporterService)
  protected readonly reporterService: IReporterService;

  @observable
  state: DebugState;

  @observable
  sessionCount: number;

  @observable
  currentSession: DebugSession | undefined;

  @observable.shallow
  sessions: DebugSession[] = [];

  public readonly toolBarMenuMap: Map<string, IContextMenu> = new Map();

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
    this.sessions = Array.from(this.model.sessions).filter(
      (session: DebugSession) => session && session.state > DebugState.Inactive,
    );
    this.sessionCount = this.sessions.length;
  }

  @action
  updateToolBarMenu() {
    if (this.currentSession && this.currentSession.id && !this.toolBarMenuMap.has(this.currentSession.id)) {
      const contextMenu = this.contextMenuService.createMenu({
        id: MenuId.DebugToolBar,
        contextKeyService: this.contextKeyService.createScoped(),
      });
      this.currentSession.on('terminated', () => {
        this.toolBarMenuMap.delete(this.currentSession?.id!);
      });

      this.toolBarMenuMap.set(this.currentSession.id, contextMenu);
    }
  }

  private instrumentReporter(name: string): () => void {
    const session = this.model.currentSession!;
    const languageType = session.configuration?.type;
    const currentThread = this.model.currentThread;
    const threadId = currentThread?.raw?.id;
    this.model.reportAction(session.id, threadId, name);
    const extra = {
      type: languageType,
      request: this.currentSession?.configuration.request,
      sessionId: session.id,
      threadId,
    };
    this.model.report(DEBUG_REPORT_NAME.DEBUG_TOOLBAR_OPERATION, name, extra);
    const reportTime = this.model.reportTime(DEBUG_REPORT_NAME.DEBUG_TOOLBAR_OPERATION_TIME, extra);
    return () => {
      reportTime(name);
    };
  }

  doStart = () => this.model.start();

  doRestart = async () => {
    const reportTimeEnd = this.instrumentReporter('restart');
    const terminated = await this.model.restart();
    reportTimeEnd();
    return terminated;
  };

  doStop = async () => {
    if (!this.model.currentSession) {
      return;
    }
    const reportTimeEnd = this.instrumentReporter('stop');
    const terminated = await this.model.currentSession.terminate();
    reportTimeEnd();
    return terminated;
  };
  doContinue = async () => {
    if (!this.model.currentThread) {
      return;
    }
    const reportTimeEnd = this.instrumentReporter('continue');
    const terminated = await this.model.currentThread.continue();
    reportTimeEnd();
    return terminated;
  };
  doPause = async () => {
    if (!this.model.currentThread) {
      return;
    }
    const reportTimeEnd = this.instrumentReporter('pause');
    const terminated = await this.model.currentThread.pause();
    reportTimeEnd();
    return terminated;
  };
  doStepOver = async () => {
    if (!this.model.currentThread) {
      return;
    }
    const reportTimeEnd = this.instrumentReporter('stepOver');
    const terminated = await this.model.currentThread.stepOver();
    reportTimeEnd();
    return terminated;
  };
  doStepIn = async () => {
    if (!this.model.currentThread) {
      return;
    }
    const reportTimeEnd = this.instrumentReporter('stepIn');
    const terminated = await this.model.currentThread.stepIn();
    reportTimeEnd();
    return terminated;
  };
  doStepOut = async () => {
    if (!this.model.currentThread) {
      return;
    }
    const reportTimeEnd = this.instrumentReporter('stepOut');
    const terminated = await this.model.currentThread.stepOut();
    reportTimeEnd();
    return terminated;
  };

  updateCurrentSession = (session: DebugSession) => {
    this.model.currentSession = session;
  };
}
