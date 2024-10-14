import { Injectable } from '@opensumi/di';
import { Emitter, Event } from '@opensumi/ide-core-common';
import { Position } from '@opensumi/ide-monaco';

@Injectable()
export class InlineInputChatService {
  private _currentVisiblePosition: Position | undefined;
  public get currentVisiblePosition(): Position | undefined {
    return this._currentVisiblePosition;
  }

  private readonly _onInteractiveInputVisibleInPosition = new Emitter<Position | undefined>();
  public readonly onInteractiveInputVisibleInPosition: Event<Position | undefined> =
    this._onInteractiveInputVisibleInPosition.event;

  public setCurrentVisiblePosition(position: Position | undefined): void {
    this._currentVisiblePosition = position;
  }

  public visible(): void {
    this._onInteractiveInputVisibleInPosition.fire(this._currentVisiblePosition);
  }

  public hide(): void {
    this._onInteractiveInputVisibleInPosition.fire(undefined);
  }
}
