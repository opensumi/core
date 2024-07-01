import { Injectable } from '@opensumi/di';
import { Emitter, Event } from '@opensumi/ide-core-common';

@Injectable()
export class InlineStreamDiffService {
  private readonly _onAcceptDiscardPartialEdit = new Emitter<boolean>();
  public readonly onAcceptDiscardPartialEdit: Event<boolean> = this._onAcceptDiscardPartialEdit.event;

  public launchAcceptDiscardPartialEdit(isAccept: boolean): void {
    this._onAcceptDiscardPartialEdit.fire(isAccept);
  }
}
