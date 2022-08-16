import { IDisposable } from './disposable';

export enum ProgressLocation {
  Explorer = 1,
  Scm = 3,
  Extensions = 5,
  Window = 10,
  Notification = 15,
  Dialog = 20,
}

export interface IAction extends IDisposable {
  readonly id: string;
  label: string;
  tooltip: string;
  class: string | undefined;
  enabled: boolean;
  checked: boolean;
  run(event?: any): Promise<any>;
}

export interface IProgressOptions {
  readonly location: ProgressLocation | string;
  readonly title?: string;
  readonly source?: string;
  readonly total?: number;
  readonly cancellable?: boolean;
  readonly closeable?: boolean;
  // 暂不支持
  readonly buttons?: string[];
}

export interface IProgressNotificationOptions extends IProgressOptions {
  readonly location: ProgressLocation.Notification;
  // 暂不支持
  // readonly primaryActions?: ReadonlyArray<IAction>;
  // readonly secondaryActions?: ReadonlyArray<IAction>;
  readonly delay?: number;
  readonly silent?: boolean;
}

export interface IProgressWindowOptions extends IProgressOptions {
  readonly location: ProgressLocation.Window;
  readonly command?: string;
}

export interface IProgressCompositeOptions extends IProgressOptions {
  readonly location:
    | ProgressLocation.Explorer
    | ProgressLocation.Extensions
    | ProgressLocation.Scm
    | ProgressLocation.Window
    | ProgressLocation.Notification
    | ProgressLocation.Dialog
    | string;
  readonly delay?: number;
}

export interface IProgressStep {
  message?: string;
  increment?: number;
  total?: number;
}

export interface IProgress<T> {
  report(item: T): void;
}

export class Progress<T> implements IProgress<T> {
  static readonly None: IProgress<unknown> = Object.freeze({ report() {} });

  private _value?: T;
  get value(): T | undefined {
    return this._value;
  }

  constructor(private callback: (data: T) => void) {}

  report(item: T) {
    this._value = item;
    this.callback(this._value);
  }
}
