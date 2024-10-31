import {
  IDisposable,
  IProgress,
  IProgressCompositeOptions,
  IProgressNotificationOptions,
  IProgressOptions,
  IProgressStep,
  IProgressWindowOptions,
} from '@opensumi/ide-core-common';
import { IObservable } from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/base';

export interface IProgressModel {
  show: IObservable<boolean>;
  fade: IObservable<boolean>;
  worked: IObservable<number>;
  total: IObservable<number | undefined>;
}

export const IProgressService = Symbol('IProgressService');
/**
 * A progress service that can be used to report progress to various locations of the UI.
 */
export interface IProgressService {
  registerProgressIndicator(location: string, indicator?: IProgressIndicator): IDisposable;
  getIndicator(location: string): IProgressIndicator | undefined;
  withProgress<R>(
    options: IProgressOptions | IProgressNotificationOptions | IProgressWindowOptions | IProgressCompositeOptions,
    task: (progress: IProgress<IProgressStep>) => Promise<R>,
    onDidCancel?: (choice?: number) => void,
  ): Promise<R>;
}

export interface IProgressIndicator {
  progressModel: IProgressModel;
  /**
   * Show progress customized with the provided flags.
   */
  show(infinite: true, delay?: number): IProgressRunner;
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  show(total: number, delay?: number): IProgressRunner;

  /**
   * Indicate progress for the duration of the provided promise. Progress will stop in
   * any case of promise completion, error or cancellation.
   */
  showWhile(promise: Promise<unknown>, delay?: number): Promise<void>;
}

export interface IProgressRunner {
  total(value: number): void;
  worked(value: number): void;
  done(): void;
}

export const emptyProgressRunner: IProgressRunner = Object.freeze({
  total() {},
  worked() {},
  done() {},
});
