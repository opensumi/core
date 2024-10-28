import { Injectable } from '@opensumi/di';
import { Emitter } from '@opensumi/ide-utils';

import { IPartialEditEvent } from '../inline-stream-diff/live-preview.component';

@Injectable()
export class InlineDiffService {
  /**
   * Used in `codeblitz`, do not remove it.
   */
  private _partialEventEmitter = new Emitter<IPartialEditEvent>();
  public onPartialEdit = this._partialEventEmitter.event;

  public firePartialEdit(event: IPartialEditEvent) {
    this._partialEventEmitter.fire(event);
  }
}
