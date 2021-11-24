import { IDisposable, IProgressOptions, IProgressStep, IExtensionProps } from '@opensumi/ide-core-common';

export interface IMainThreadProgress extends IDisposable {
  $startProgress(handle: number, options: IProgressOptions, extension?: IExtensionProps): void;
  $progressReport(handle: number, message: IProgressStep): void;
  $progressEnd(handle: number): void;
}

export interface IExtHostProgress {
  $acceptProgressCanceled(handle: number): void;
}
