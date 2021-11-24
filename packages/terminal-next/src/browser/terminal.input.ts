import { Injectable } from '@opensumi/di';
import { isMacintosh } from '@opensumi/ide-core-common/lib/platform';

@Injectable()
export class TerminalKeyBoardInputService {
  private _isCommandOrCtrl: boolean = false;

  get isCommandOrCtrl() {
    return this._isCommandOrCtrl;
  }

  listen() {
    const key = isMacintosh ? 'Meta' : 'Control';

    document.addEventListener('keydown', (e) => {
      if (e.key === key)  {
        this._isCommandOrCtrl = true;
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === key)  {
        this._isCommandOrCtrl = false;
      }
    });
  }
}
