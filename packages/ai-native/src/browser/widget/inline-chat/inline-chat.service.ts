import { Injectable } from '@opensumi/di';
import { IAIInlineChatService } from '@opensumi/ide-core-browser';
import { Emitter, Event, runWhenIdle } from '@opensumi/ide-core-common';

export const enum EInlineChatStatus {
  READY,
  THINKING,
  DONE,
  ERROR,
}

export const enum EResultKind {
  ACCEPT = 'ACCEPT',
  DISCARD = 'DISCARD',
  REGENERATE = 'REGENERATE',
}

@Injectable({ multiple: false })
export class AIInlineChatService implements IAIInlineChatService {
  private _interactiveInputVisible: boolean = false;
  public get interactiveInputVisible(): boolean {
    return this._interactiveInputVisible;
  }

  public readonly _onInteractiveInputVisible = new Emitter<boolean>();
  public readonly onInteractiveInputVisible: Event<boolean> = this._onInteractiveInputVisible.event;

  public readonly _onInlineChatVisible = new Emitter<boolean>();
  public readonly onInlineChatVisible: Event<boolean> = this._onInlineChatVisible.event;

  private readonly _onThumbs = new Emitter<boolean>();
  public readonly onThumbs: Event<boolean> = this._onThumbs.event;

  public fireThumbsEvent(isThumbsUp: boolean) {
    this._onThumbs.fire(isThumbsUp);
  }

  public launchInputVisible(v: boolean) {
    return runWhenIdle(() => {
      this._interactiveInputVisible = v;
      this._onInteractiveInputVisible.fire(v);
    });
  }
}
