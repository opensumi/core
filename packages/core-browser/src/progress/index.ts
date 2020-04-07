import { IDisposable } from '..';

/**
 * A progress service that can be used to report progress to various locations of the UI.
 */
export interface IProgressService {
  withProgress<R>(
    options: IProgressOptions | IProgressNotificationOptions | IProgressWindowOptions | IProgressCompositeOptions,
    task: (progress: IProgress<IProgressStep>) => Promise<R>,
    onDidCancel?: (choice?: number) => void,
  ): Promise<R>;
}

export interface IProgressIndicator {

  /**
	 * Show progress customized with the provided flags.
	 */
  show(infinite: true, delay?: number): IProgressRunner;
  // tslint:disable-next-line: unified-signatures
  show(total: number, delay?: number): IProgressRunner;

  /**
	 * Indicate progress for the duration of the provided promise. Progress will stop in
	 * any case of promise completion, error or cancellation.
	 */
  showWhile(promise: Promise<unknown>, delay?: number): Promise<void>;
}

export const enum ProgressLocation {
  Explorer = 1,
  Scm = 3,
  Extensions = 5,
  Window = 10,
  Notification = 15,
  Dialog = 20,
}

export interface IProgressOptions {
  readonly location: ProgressLocation | string;
  readonly title?: string;
  readonly source?: string;
  readonly total?: number;
  readonly cancellable?: boolean;
  readonly buttons?: string[];
}

export interface IProgressNotificationOptions extends IProgressOptions {
  readonly location: ProgressLocation.Notification;
  readonly primaryActions?: ReadonlyArray<IAction>;
  readonly secondaryActions?: ReadonlyArray<IAction>;
  readonly delay?: number;
  readonly silent?: boolean;
}

export interface IProgressWindowOptions extends IProgressOptions {
  readonly location: ProgressLocation.Window;
  readonly command?: string;
}

export interface IProgressCompositeOptions extends IProgressOptions {
  readonly location: ProgressLocation.Explorer | ProgressLocation.Extensions | ProgressLocation.Scm | ProgressLocation.Window | ProgressLocation.Notification | ProgressLocation.Dialog | string;
  readonly delay?: number;
}

export interface IProgressStep {
  message?: string;
  increment?: number;
  total?: number;
}

export interface IProgressRunner {
  total(value: number): void;
  worked(value: number): void;
  done(): void;
}

export const emptyProgressRunner: IProgressRunner = Object.freeze({
  total() { },
  worked() { },
  done() { },
});

export interface IProgress<T> {
  report(item: T): void;
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
