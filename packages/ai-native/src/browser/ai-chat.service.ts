import { Injectable } from '@opensumi/di';
import { CancellationTokenSource, Disposable, Emitter, Event } from '@opensumi/ide-core-common';

@Injectable()
export class AINativeService extends Disposable {
  private readonly _onInlineChatVisible = new Emitter<boolean>();
  public readonly onInlineChatVisible: Event<boolean> = this._onInlineChatVisible.event;

  constructor() {
    super();
  }

  public launchInlineChatVisible(value: boolean) {
    this._onInlineChatVisible.fire(value);
  }

  public cancelIndicator = new CancellationTokenSource();
  public cancelIndicatorChatView = new CancellationTokenSource();

  public cancelToken() {
    this.cancelIndicator.cancel();
    this.cancelIndicator = new CancellationTokenSource();
  }

  public cancelChatViewToken() {
    this.cancelIndicatorChatView.cancel();
    this.cancelIndicatorChatView = new CancellationTokenSource();
  }
}
