import { Injectable } from '@opensumi/di';
import { Emitter, Event } from '@opensumi/ide-core-common';

@Injectable()
export class InlineHintService {
  private _interactiveInputVisible: boolean = false;
  public get interactiveInputVisible(): boolean {
    return this._interactiveInputVisible;
  }

  private readonly _onInteractiveInputVisible = new Emitter<boolean>();
  public readonly onInteractiveInputVisible: Event<boolean> = this._onInteractiveInputVisible.event;

  public changVisible(v: boolean): void {
    this._interactiveInputVisible = v;
    this._onInteractiveInputVisible.fire(v);
  }
}
