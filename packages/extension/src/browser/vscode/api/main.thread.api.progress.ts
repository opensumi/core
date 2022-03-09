import { Autowired, Injectable, Optional } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import {
  IProgressOptions,
  IProgressStep,
  IProgress,
  ProgressLocation,
  IProgressNotificationOptions,
} from '@opensumi/ide-core-common';

import { IExtension } from '../../../common';
import { ExtHostAPIIdentifier } from '../../../common/vscode';
import { IMainThreadProgress, IExtHostProgress } from '../../../common/vscode/progress';

@Injectable({ multiple: true })
export class MainThreadProgress implements IMainThreadProgress {
  private proxy: IExtHostProgress;
  private progress = new Map<number, { resolve: (value?: any) => void; progress: IProgress<IProgressStep> }>();

  @Autowired(IProgressService)
  private readonly progressService: IProgressService;

  constructor(@Optional(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostProgress);
  }

  $startProgress(handle: number, options: IProgressOptions, extension?: IExtension | undefined): void {
    const task = this.createTask(handle);

    if (options.location === ProgressLocation.Notification && extension) {
      const notificationOptions: IProgressNotificationOptions = {
        ...options,
        location: ProgressLocation.Notification,
      };

      options = notificationOptions;
    }

    this.progressService.withProgress(options, task, () => this.proxy.$acceptProgressCanceled(handle));
  }

  $progressReport(handle: number, message: IProgressStep): void {
    const entry = this.progress.get(handle);
    if (entry) {
      entry.progress.report(message);
    }
  }

  $progressEnd(handle: number): void {
    const entry = this.progress.get(handle);
    if (entry) {
      entry.resolve();
      this.progress.delete(handle);
    }
  }

  dispose(): void {
    this.progress.forEach((handle) => handle.resolve());
    this.progress.clear();
  }

  private createTask(handle: number) {
    return (progress: IProgress<IProgressStep>) =>
      new Promise<any>((resolve) => {
        this.progress.set(handle, { resolve, progress });
      });
  }
}
