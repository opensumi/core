import { IDisposable, IProgressOptions, IProgressStep } from '@ali/ide-core-common';
import { IExtension } from '..';

export interface IMainThreadProgress extends IDisposable {
  $startProgress(handle: number, options: IProgressOptions, extension?: IExtension): void;
  $progressReport(handle: number, message: IProgressStep): void;
  $progressEnd(handle: number): void;
}

export interface IExtHostProgress {
  $acceptProgressCanceled(handle: number): void;
}
