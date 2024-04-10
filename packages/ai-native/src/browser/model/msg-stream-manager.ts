import { Injectable } from '@opensumi/di';
import { Dispatcher, Disposable, Emitter, Event } from '@opensumi/ide-core-common';

export interface IMsgStreamChoices {
  delta: {
    content: string;
    role: string;
  };
  finish_reason: null | 'stop' | string;
  index: number;
}

export const enum EMsgStreamStatus {
  READY,
  THINKING,
  DONE,
  ERROR,
  PAUSE,
}

@Injectable({ multiple: false })
export class MsgStreamManager extends Disposable {
  // 会话 id 与接口 answer id 的对应关系
  private sessionIdToAnswerIdMap = new Map<string, string>();
  // 每个 answer id 所对应的消息流
  private answerIdToMsgStreamMap = new Map<string, IMsgStreamChoices[]>();
  private onDidMsgListChangeDispatcher: Dispatcher<IMsgStreamChoices> = this.registerDispose(new Dispatcher());
  private _currentSessionId: string;
  private _status: EMsgStreamStatus;

  private readonly _onMsgStatus = this.registerDispose(new Emitter<EMsgStreamStatus>());
  public readonly onMsgStatus: Event<EMsgStreamStatus> = this._onMsgStatus.event;

  public get status(): EMsgStreamStatus {
    return this._status;
  }

  private set status(s: EMsgStreamStatus) {
    this._status = s;
    this._onMsgStatus.fire(s);
  }

  public get currentSessionId(): string {
    return this._currentSessionId;
  }

  public setCurrentSessionId(id: string) {
    this._currentSessionId = id;
    this.status = EMsgStreamStatus.READY;
  }

  public onMsgListChange(sessionId: string) {
    return this.onDidMsgListChangeDispatcher.on(sessionId);
  }

  public sendErrorStatue(): void {
    this.status = EMsgStreamStatus.ERROR;
  }

  public sendDoneStatue(): void {
    this.status = EMsgStreamStatus.DONE;
  }

  public sendThinkingStatue(): void {
    this.status = EMsgStreamStatus.THINKING;
  }

  public sendPauseStatue(): void {
    this.status = EMsgStreamStatus.PAUSE;
  }

  public recordMessage(answerId: string, msg: IMsgStreamChoices): void {
    if (!this._currentSessionId) {
      new Error('currentSessionId is null');
    }

    this.sessionIdToAnswerIdMap.set(this.currentSessionId, answerId);

    if (!(answerId && msg)) {
      new Error('answerId/msg is null');
    }

    const answerList = this.answerIdToMsgStreamMap.get(answerId);

    if (!answerList) {
      this.answerIdToMsgStreamMap.set(answerId, [msg]);
    } else {
      answerList.push(msg);
    }

    const { finish_reason } = msg;
    if (!finish_reason) {
      this.sendThinkingStatue();
    } else if (finish_reason === 'stop') {
      this.sendDoneStatue();
    } else {
      this.sendErrorStatue();
      return;
    }

    this.onDidMsgListChangeDispatcher.dispatch(this._currentSessionId, msg);
  }
}
