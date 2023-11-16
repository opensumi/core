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

  // 返回内容 与输入内容对应
  private answerIdToMessage = new Map<string, string>();

  private readonly _onMsgStatus = new Emitter<EMsgStreamStatus>();
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

  public recordMessage(answerId: string, msg: IMsgStreamChoices): void {
    if (!this._currentSessionId) {
      new Error('currentSessionId is null');
    }

    this.sessionIdToAnswerIdMap.set(this.currentSessionId, answerId);

    const answerList = this.answerIdToMsgStreamMap.get(answerId);

    if (!answerList) {
      this.answerIdToMsgStreamMap.set(answerId, [msg]);
    } else {
      answerList.push(msg);
    }

    const { finish_reason } = msg;
    if (!finish_reason) {
      this.status = EMsgStreamStatus.THINKING;
    } else if (finish_reason === 'stop') {
      this.status = EMsgStreamStatus.DONE;
    } else {
      this.status = EMsgStreamStatus.ERROR;
    }

    this.onDidMsgListChangeDispatcher.dispatch(this._currentSessionId, msg);
  }
}
