import { Injectable, Optional } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { DisposableCollection } from '@opensumi/ide-core-browser';

import { ExtHostAPIIdentifier, IExtHostWindowState } from '../../../common/vscode';

import { WindowActivityTracker } from './window-activity/window-activity-tracker';

@Injectable({ multiple: true })
export class MainThreadWindowState {
  private readonly proxy: IExtHostWindowState;
  private blurHandler;
  private focusHandler;

  private readonly toDispose = new DisposableCollection();

  constructor(@Optional(Symbol()) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostWindowState);

    this.blurHandler = () => {
      this.proxy.$onDidChangeWindowFocus(false);
    };
    this.focusHandler = () => {
      this.proxy.$onDidChangeWindowFocus(true);
    };
    window.addEventListener('blur', this.blurHandler);

    window.addEventListener('focus', this.focusHandler);

    const tracker = new WindowActivityTracker(window);
    this.toDispose.push(tracker.onDidChangeActiveState((isActive) => this.onActiveStateChanged(isActive)));
    this.toDispose.push(tracker);
  }

  private onActiveStateChanged(isActive: boolean): void {
    this.proxy.$onDidChangeWindowActive(isActive);
  }

  public dispose() {
    window.removeEventListener('blur', this.blurHandler);
    window.removeEventListener('focus', this.focusHandler);
    this.toDispose.dispose();
  }
}
