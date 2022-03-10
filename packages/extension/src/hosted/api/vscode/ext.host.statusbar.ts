import { v4 } from 'uuid';
import type vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection';
import { formatLocalize } from '@opensumi/ide-core-common';

import {
  MainThreadAPIIdentifier,
  IMainThreadStatusBar,
  IExtHostStatusBar,
  ArgumentProcessor,
  IExtensionDescription,
} from '../../../common/vscode';
import { Disposable, ThemeColor } from '../../../common/vscode/ext-types';
import * as types from '../../../common/vscode/ext-types';


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
      arg.then(
        () => this.proxy.$dispose(),
        () => this.proxy.$dispose(),
      );
    }

    return Disposable.create(() => {
      this.proxy.$dispose();
      if (handle) {
        clearTimeout(handle);
      }
    });
  }

  createStatusBarItem(
    extension: IExtensionDescription,
    id?: string,
    alignment?: types.StatusBarAlignment,
    priority?: number,
  ): vscode.StatusBarItem {
    const statusBarItem = new StatusBarItemImpl(this.rpcProtocol, extension, id, alignment, priority);
    this.proxy.$createStatusBarItem(
      statusBarItem.entryId,
      statusBarItem.id,
      statusBarItem.alignment,
      statusBarItem.priority,
    );
    return statusBarItem;
  }
}

export class StatusBarItemImpl implements vscode.StatusBarItem {
  private static ALLOWED_BACKGROUND_COLORS = new Map<string, ThemeColor>([
    ['statusBarItem.errorBackground', new ThemeColor('statusBarItem.errorForeground')],
    ['statusBarItem.warningBackground', new ThemeColor('statusBarItem.warningForeground')],
  ]);

  private readonly _entryId = StatusBarItemImpl.nextId();

  private _text: string;
  private _tooltip: string;
  private _name?: string;
  private _color: string | ThemeColor | undefined;
  private _backgroundColor: ThemeColor | undefined;
  private _command: string | vscode.Command | undefined;

  private _isVisible: boolean;
  private _timeoutHandle: NodeJS.Timer | undefined;

  private _proxy: IMainThreadStatusBar;

  private _accessibilityInformation?: vscode.AccessibilityInformation;

  constructor(
    private _rpcProtocol: IRPCProtocol,
    private _extension: IExtensionDescription,
    private _id: string | undefined,
    private _alignment: vscode.StatusBarAlignment = types.StatusBarAlignment.Left,
    private _priority: number = 0,
  ) {
    this._proxy = this._rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadStatusBar);
  }

  public get id(): string {
    return this._id ?? this._extension.identifier.value;
  }

  public get entryId(): string {
    return this._entryId;
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

  public get name(): string | undefined {
    return this._name;
  }

  public set name(name: string | undefined) {
    this._name = name;
    this.update();
  }

  public get tooltip(): string {
    return this._tooltip;
  }
  public set tooltip(tooltip: string) {
    this._tooltip = tooltip;
    this.update();
  }

  public get color(): string | ThemeColor | undefined {
    return this._color;
  }
  public set color(color: string | ThemeColor | undefined) {
    this._color = color;
    this.update();
  }

  public get backgroundColor(): ThemeColor | undefined {
    return this._backgroundColor;
  }

  public set backgroundColor(color: ThemeColor | undefined) {
    if (color && !StatusBarItemImpl.ALLOWED_BACKGROUND_COLORS.has(color.id)) {
      color = undefined;
    }

    this._backgroundColor = color;

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
    this._proxy.$dispose(this.entryId);
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

      // If the id is not set, derive it from the extension identifier,
      // otherwise make sure to prefix it with the extension identifier
      // to get a more unique value across extensions.
      let id: string;
      if (this._extension) {
        if (this._id) {
          id = `${this._extension.identifier.value}.${this._id}`;
        } else {
          id = this._extension.identifier.value;
        }
      } else {
        id = this._id!;
      }

      // If the name is not set, derive it from the extension descriptor
      let name: string;
      if (this._name) {
        name = this._name;
      } else {
        name = formatLocalize('extension.label', this._extension.displayName || this._extension.name);
      }

      // If a background color is set, the foreground is determined
      let color = this._color;
      if (this._backgroundColor) {
        color = StatusBarItemImpl.ALLOWED_BACKGROUND_COLORS.get(this._backgroundColor.id)!;
      }

      // Set to status bar
      this._proxy.$setMessage(
        this._entryId,
        id,
        name,
        this.text,
        this.priority,
        this.alignment,
        color,
        this._backgroundColor,
        this.tooltip,
        this.accessibilityInformation,
        commandId,
        commandArgs,
      );
    }, 0);
  }

  public dispose(): void {
    this.hide();
  }

  static nextId(): string {
    return StatusBarItemImpl.ID_PREFIX + ':' + v4();
  }
  static ID_PREFIX = 'plugin-status-bar-item';
}
