import { Injectable } from '@opensumi/di';
import { Emitter, Event } from '@opensumi/ide-core-common';

@Injectable()
export class InlineHintService {
  private _interactiveInputVisible: boolean = false;
  public get interactiveInputVisible(): boolean {
    return this._interactiveInputVisible;
  }

  public readonly _onInteractiveInputVisible = new Emitter<boolean>();
  public readonly onInteractiveInputVisible: Event<boolean> = this._onInteractiveInputVisible.event;
}
