import { Injectable } from '@opensumi/di';
import { Emitter } from '@opensumi/ide-utils';

import type { IInlineDiffService } from '../../../common/index';
import type { IPartialEditEvent } from '../../../common/types';

@Injectable()
export class InlineDiffService implements IInlineDiffService {
  /**
   * Used in `codeblitz`, do not remove it.
   */
  private _partialEventEmitter = new Emitter<IPartialEditEvent>();
  public onPartialEdit = this._partialEventEmitter.event;

  public firePartialEdit(event: IPartialEditEvent) {
    this._partialEventEmitter.fire(event);
  }
}
