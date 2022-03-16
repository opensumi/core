import { Injectable, Autowired } from '@opensumi/di';
import { Emitter, Event, Disposable } from '@opensumi/ide-core-common';

import {
  ITerminalErrorService,
  ITerminalNetwork,
  ITerminalInternalService,
  ITerminalController,
  ITerminalReconnectInfo,
  ITerminalError,
  TerminalNetworkStatus,
} from '../common';

@Injectable()
export class TerminalNetworkService extends Disposable implements ITerminalNetwork {
  @Autowired(ITerminalErrorService)
  private errorService: ITerminalErrorService;

  @Autowired(ITerminalInternalService)
  protected readonly service: ITerminalInternalService;

  @Autowired(ITerminalController)
  protected readonly controller: ITerminalController;

  private _onConnect = new Emitter<void>();
  public onConnect: Event<void> = this._onConnect.event;

  private _onDisconnect = new Emitter<void>();
  public onDisconnect: Event<void> = this._onDisconnect.event;

  private _status: TerminalNetworkStatus = TerminalNetworkStatus.DISCONNECTED;
  private _timer: number | undefined;
  private _resetRetryTimers = new Map<string, number>();
  private _reconnectInfo = new Map<string, ITerminalReconnectInfo>();

  constructor() {
    super();
    this.controller.onDidCloseTerminal((e) => {
      this._resetRetryTimers.delete(e.id);
      this._reconnectInfo.delete(e.id);
    });
    this.onDispose(() => {
      if (this._timer) {
        clearTimeout(this._timer);
      }
    });
  }

  get status() {
    return this._status;
  }

  setStatus(status: TerminalNetworkStatus) {
    this._status = status;
    if (status === TerminalNetworkStatus.CONNECTED) {
      this._onConnect.fire();
      this.scheduleReconnection();
    } else {
      this._onDisconnect.fire();
    }
  }

  bindErrors() {
    this.service.onError(this.handleError.bind(this));
  }

  handleError(error: ITerminalError) {
    if (error.shouldReconnect == null) {
      error.shouldReconnect = true;
    }
    const sessionId = error.id;
    const reconnectInfo = this.getReconnectInfo(sessionId);
    if (reconnectInfo.times) {
      reconnectInfo.nextRetry = Date.now() + 2000;
    }
    this._reconnectInfo.set(sessionId, reconnectInfo);
    this.scheduleReconnection();
  }

  reconnect() {
    if (this._status === TerminalNetworkStatus.DISCONNECTED) {
      return;
    }
    const now = Date.now();
    let delay = Number.POSITIVE_INFINITY;
    for (const sessionId of this.errorService.errors.keys()) {
      if (!this.shouldReconnect(sessionId)) {
        continue;
      }
      const { nextRetry } = this.getReconnectInfo(sessionId);
      if (nextRetry > now) {
        delay = Math.min(delay, nextRetry - now);
      } else {
        this.reconnectClient(sessionId);
      }
    }
    // 存在需要延迟重试的终端
    if (delay < Number.POSITIVE_INFINITY) {
      this.scheduleReconnection(delay);
    }
  }

  async reconnectClient(sessionId: string) {
    this.countRetry(sessionId);
    const reconnected = this.errorService.fix(sessionId);
    reconnected.then(() => {
      this.resetRetryLater(sessionId);
    });
    return reconnected;
  }

  getReconnectInfo(sessionId: string): ITerminalReconnectInfo {
    const reconnectInfo = this._reconnectInfo.get(sessionId);
    return (
      reconnectInfo || {
        times: 0,
        nextRetry: 0,
      }
    );
  }

  countRetry(sessionId: string) {
    const timer = this._resetRetryTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this._resetRetryTimers.delete(sessionId);
    }
    const reconnectInfo = this.getReconnectInfo(sessionId);
    reconnectInfo.times += 1;
    this._reconnectInfo.set(sessionId, reconnectInfo);
  }

  /**
   * 连接成功后重置重连计数
   * 这里延迟的作用是避免网络不稳定时频繁断连导致计数重置
   */
  resetRetryLater(sessionId: string) {
    const timer = window.setTimeout(() => {
      this._reconnectInfo.delete(sessionId);
      this._resetRetryTimers.delete(sessionId);
    }, 8000);
    this._resetRetryTimers.set(sessionId, timer);
  }

  scheduleReconnection(delay = 200) {
    if (this._timer) {
      return;
    }
    this._timer = window.setTimeout(() => {
      this._timer = undefined;
      this.reconnect();
    }, delay);
  }

  shouldReconnect(sessionId: string) {
    const error = this.errorService.errors.get(sessionId);
    if (!error?.shouldReconnect) {
      return false;
    }
    const retried = this.getReconnectInfo(sessionId).times;
    return retried < 3;
  }
}
