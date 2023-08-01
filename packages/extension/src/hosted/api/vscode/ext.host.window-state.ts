import { IRPCProtocol } from '@opensumi/ide-connection';
import { Emitter, Event } from '@opensumi/ide-core-common';

import { IExtHostWindowState } from '../../../common/vscode';
import * as types from '../../../common/vscode/ext-types';

export class ExtHostWindowState implements IExtHostWindowState {
  public readonly state: types.WindowState = new WindowStateImpl();

  constructor(private rpcProtocol: IRPCProtocol) {}
  private readonly _onDidChangeWindowState: Emitter<types.WindowState> = new Emitter();

  public readonly onDidChangeWindowState: Event<types.WindowState> = this._onDidChangeWindowState.event;

  public $setWindowState(focused: boolean) {
    if (focused !== this.state.focused) {
      this.state.focused = focused;
      this._onDidChangeWindowState.fire(this.state);
    }
  }
}

export class WindowStateImpl implements types.WindowState {
  public focused: boolean;

  constructor() {
    // 当插件进程重启时，这里如果默认是 false，会与实际状态不一致，导致依赖该状态的插件处理有问题
    this.focused = true;
  }
}
