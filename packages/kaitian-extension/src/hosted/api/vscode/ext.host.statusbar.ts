import { IRPCProtocol } from '@ali/ide-connection';
import { Disposable, ThemeColor } from '../../../common/vscode/ext-types';
import { MainThreadAPIIdentifier, IMainThreadStatusBar, IExtHostStatusBar, ArgumentProcessor } from '../../../common/vscode';
import { v4 } from 'uuid';
import * as types from '../../../common/vscode/ext-types';
import type * as vscode from 'vscode';

export class ExtHostStatusBar implements IExtHostStatusBar {
  protected readonly proxy: IMainThreadStatusBar;
  protected readonly rpcProtocol: IRPCProtocol;
  protected readonly argumentProcessors: ArgumentProcessor[] = [];
  constructor(rpcProtocol: IRPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadStatusBar);
  }

  setStatusBarMessage(text: string, arg?: number | Thenable<any>): Disposable {

    // step3
    this.proxy.$setStatusBarMessage(text);
    let handle: NodeJS.Timer | undefined;

    if (typeof arg === 'number') {
        handle = global.setTimeout(() => this.proxy.$dispose(), arg);
    } else if (typeof arg !== 'undefined') {
        arg.then(() => this.proxy.$dispose(), () => this.proxy.$dispose());
    }

    return Disposable.create(() => {
        this.proxy.$dispose();
        if (handle) {
            clearTimeout(handle);
        }
    });
  }

  createStatusBarItem(alignment?: vscode.StatusBarAlignment, priority?: number): vscode.StatusBarItem {
    const statusBarItem = new StatusBarItemImpl(this.rpcProtocol, alignment, priority);
    this.proxy.$createStatusBarItem(statusBarItem.id, statusBarItem.alignment, statusBarItem.priority);

    return statusBarItem;
  }

}

export class StatusBarItemImpl implements vscode.StatusBarItem {

    public readonly id = StatusBarItemImpl.nextId();

    private _alignment: vscode.StatusBarAlignment;
    private _priority: number;

    private _text: string;
    private _tooltip: string;
    private _color: string | ThemeColor;
    private _command: string | vscode.Command | undefined;

    private _isVisible: boolean;
    private _timeoutHandle: NodeJS.Timer | undefined;

    private _proxy: IMainThreadStatusBar;
    private _rpcProtocol: IRPCProtocol;

    private _accessibilityInformation?: vscode.AccessibilityInformation;

    constructor(rpcProtocol: IRPCProtocol, alignment: vscode.StatusBarAlignment = types.StatusBarAlignment.Left, priority: number = 0) {
      this._rpcProtocol = rpcProtocol;
      this._proxy = this._rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadStatusBar);
      this._alignment = alignment;
      this._priority = priority;
    }

    public get alignment(): vscode.StatusBarAlignment {
        return this._alignment;
    }

    public get priority(): number {
        return this._priority;
    }

    public get text(): string {
        return this._text;
    }
    public set text(text: string) {
      this._text = text;
      this.update();
    }

    public get tooltip(): string {
        return this._tooltip;
    }
    public set tooltip(tooltip: string) {
        this._tooltip = tooltip;
        this.update();
    }

    public get color(): string | ThemeColor {
        return this._color;
    }
    public set color(color: string | ThemeColor) {
        this._color = color;
        this.update();
    }

    public get accessibilityInformation(): vscode.AccessibilityInformation | undefined {
      return this._accessibilityInformation;
    }

    public set accessibilityInformation(accessibilityInformation: vscode.AccessibilityInformation | undefined) {
      this._accessibilityInformation = accessibilityInformation;
      this.update();
    }

    public get command(): string | vscode.Command | undefined {
        return this._command;
    }
    public set command(command: string | vscode.Command | undefined) {
        this._command = command;
        this.update();
    }

    public show(): void {
        this._isVisible = true;
        this.update();
    }

    public hide(): void {
        if (this._timeoutHandle) {
            clearTimeout(this._timeoutHandle);
        }
        this._proxy.$dispose(this.id);
        this._isVisible = false;
    }

    private update(): void {
        if (!this._isVisible) {
            return;
        }
        if (this._timeoutHandle) {
            clearTimeout(this._timeoutHandle);
        }
        // Defer the update so that multiple changes to setters don't cause a redraw each
        this._timeoutHandle = global.setTimeout(() => {
            this._timeoutHandle = undefined;
            const commandId = typeof this.command === 'string' ? this.command : this.command?.command;
            const commandArgs = typeof this.command === 'string' ? undefined : this.command?.arguments;
            // Set to status bar
            this._proxy.$setMessage(
                this.id,
                this.text,
                this.priority,
                this.alignment,
                this.getColor(),
                this.tooltip,
                this.accessibilityInformation,
                commandId,
                commandArgs);
        }, 0);
    }

    private getColor(): string | undefined {
      if (typeof this.color !== 'string' && typeof this.color !== 'undefined') {
          const colorId = (this.color as ThemeColor).id;
          return colorId;
      }
      return this.color;
    }

    public dispose(): void {
        this.hide();
    }

    static nextId(): string {
        return StatusBarItemImpl.ID_PREFIX + ':' + v4();
    }
    static ID_PREFIX = 'plugin-status-bar-item';
}
