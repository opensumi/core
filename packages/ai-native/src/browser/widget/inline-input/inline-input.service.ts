import { Injectable } from '@opensumi/di';
import { Emitter, Event } from '@opensumi/ide-core-common';
import { Position } from '@opensumi/ide-monaco';

@Injectable()
export class InlineInputChatService {
  private _interactiveInputVisible: boolean = false;
  public get interactiveInputVisible(): boolean {
    return this._interactiveInputVisible;
  }

  private readonly _onInteractiveInputVisibleInPosition = new Emitter<Position | undefined>();
  public readonly onInteractiveInputVisibleInPosition: Event<Position | undefined> =
    this._onInteractiveInputVisibleInPosition.event;

  public visibleInPosition(position: Position): void {
    this._interactiveInputVisible = true;
    this._onInteractiveInputVisibleInPosition.fire(position);
  }

  public hide(): void {
    this._interactiveInputVisible = false;
    this._onInteractiveInputVisibleInPosition.fire(undefined);
  }
}
