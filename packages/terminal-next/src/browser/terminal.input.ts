import { Injectable } from '@opensumi/di';
import { isMacintosh } from '@opensumi/ide-core-common';

@Injectable()
export class TerminalKeyBoardInputService {
  private _isCommandOrCtrl = false;

  get isCommandOrCtrl() {
    return this._isCommandOrCtrl;
  }

  listen() {
    const key = isMacintosh ? 'Meta' : 'Control';

    document.addEventListener('keydown', (e) => {
      if (e.key === key) {
        this._isCommandOrCtrl = true;
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === key) {
        this._isCommandOrCtrl = false;
      }
    });
  }
}
