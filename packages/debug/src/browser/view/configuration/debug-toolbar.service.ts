import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { IContextKeyService, IReporterService, memoize } from '@opensumi/ide-core-browser';
import { AbstractContextMenuService, IContextMenu, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { IElectronMainUIService } from '@opensumi/ide-core-common/lib/electron';
import { observableValue, transaction } from '@opensumi/ide-monaco/lib/common/observable';

import { DEBUG_REPORT_NAME, DebugState } from '../../../common';
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

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  state = observableValue(this, DebugState.Inactive);
  currentSession = observableValue<DebugSession | undefined>(this, undefined);
  sessions = observableValue<DebugSession[]>(this, []);

  public readonly toolBarMenuMap: Map<string, IContextMenu> = new Map();

  constructor() {
    this.model.onDidChange(() => {
      this.updateToolBarMenu();
      this.updateModel();
    });
  }

  @memoize
  get mainUIService() {
    return this.injector.get(IElectronMainUIService);
  }

  updateModel() {
    transaction((tx) => {
      this.state.set(this.model.state, tx);
      this.currentSession.set(this.model.currentSession, tx);
      this.sessions.set(
        Array.from(this.model.sessions).filter(
          (session: DebugSession) => session && session.state > DebugState.Inactive,
        ),
        tx,
      );
    });
  }

  updateToolBarMenu() {
    const currentSession = this.currentSession.get();
    if (currentSession && currentSession.id && !this.toolBarMenuMap.has(currentSession.id)) {
      const contextMenu = this.contextMenuService.createMenu({
        id: MenuId.DebugToolBar,
        contextKeyService: this.contextKeyService.createScoped(),
      });
      currentSession.on('terminated', () => {
        this.toolBarMenuMap.delete(currentSession.id);
      });

      this.toolBarMenuMap.set(currentSession.id, contextMenu);
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
      request: this.currentSession.get()?.configuration?.request,
      sessionId: session.id,
      threadId,
    };
    this.model.report(DEBUG_REPORT_NAME.DEBUG_TOOLBAR_OPERATION, name, extra);
    const reportTime = this.model.reportTime(DEBUG_REPORT_NAME.DEBUG_TOOLBAR_OPERATION_TIME, extra);
    return () => {
      reportTime(name);
    };
  }

  doStart = async () => await this.model.start();

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
