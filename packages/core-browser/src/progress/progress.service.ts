import { Injectable, Autowired } from '@ali/common-di';
import { IProgressService, IProgressOptions, IProgressNotificationOptions, IProgressWindowOptions, IProgressCompositeOptions, IProgress, IProgressStep, ProgressLocation, IProgressIndicator, IProgressRunner } from '.';
import { Progress } from './progress';
import { timeout, formatLocalize } from '..';
import { StatusBarEntry, StatusBarAlignment, IStatusBarService, StatusBarEntryAccessor } from '../services';

@Injectable()
export class ProgressService implements IProgressService {

  @Autowired(IStatusBarService)
  statusbarService: IStatusBarService;

  private progressIndicatorRegistry: Map<number | string, IProgressIndicator> = new Map();

  getIndicator(location: number | string) {
    const indicator = this.progressIndicatorRegistry.get(location);
    // TODO: 提供默认实现
    return indicator;
  }

  withProgress<R>(
    options: IProgressOptions | IProgressNotificationOptions | IProgressWindowOptions | IProgressCompositeOptions,
    task: (progress: IProgress<IProgressStep>) => Promise<R>,
    onDidCancel?: ((choice?: number | undefined) => void) | undefined): Promise<R> {
    const location = options.location;
    switch (location) {
      // case ProgressLocation.Notification:
      // 	return this.withNotificationProgress({ ...options, location }, task, onDidCancel);
      case ProgressLocation.Window:
        return this.withWindowProgress({ ...options, location }, task);
      // case ProgressLocation.Explorer:
      // 	return this.withViewletProgress('workbench.view.explorer', task, { ...options, location });
      // case ProgressLocation.Scm:
      // 	return this.withViewletProgress('workbench.view.scm', task, { ...options, location });
      // case ProgressLocation.Extensions:
      // 	return this.withViewletProgress('workbench.view.extensions', task, { ...options, location });
      // case ProgressLocation.Dialog:
      // 	return this.withDialogProgress(options, task, onDidCancel);
      default:
        throw new Error(`Bad progress location: ${location}`);
    }
  }

  private readonly windowProgressStack: [IProgressOptions, Progress<IProgressStep>][] = [];
  private windowProgressStatusEntry: StatusBarEntryAccessor | undefined = undefined;

  private withWindowProgress<R = unknown>(options: IProgressWindowOptions, callback: (progress: IProgress<{ message?: string }>) => Promise<R>): Promise<R> {
    const task: [IProgressWindowOptions, Progress<IProgressStep>] = [options, new Progress<IProgressStep>(() => this.updateWindowProgress())];

    const promise = callback(task[1]);

    let delayHandle: any = setTimeout(() => {
      delayHandle = undefined;
      this.windowProgressStack.unshift(task);
      this.updateWindowProgress();

      // show progress for at least 150ms
      Promise.all([
        timeout(150),
        promise,
      ]).finally(() => {
        const idx = this.windowProgressStack.indexOf(task);
        this.windowProgressStack.splice(idx, 1);
        this.updateWindowProgress();
      });
    }, 150);

    // cancel delay if promise finishes below 150ms
    return promise.finally(() => clearTimeout(delayHandle));
  }

  private updateWindowProgress(idx: number = 0) {

    // We still have progress to show
    if (idx < this.windowProgressStack.length) {
      const [options, progress] = this.windowProgressStack[idx];

      const progressTitle = options.title;
      const progressMessage = progress.value && progress.value.message;
      const progressCommand = ( options as IProgressWindowOptions).command;
      let text: string;
      let title: string;

      if (progressTitle && progressMessage) {
        // <title>: <message>
        text = formatLocalize('progress.text2', '{0}: {1}', progressTitle, progressMessage);
        title = options.source ? formatLocalize('progress.title3', '[{0}] {1}: {2}', options.source, progressTitle, progressMessage) : text;

      } else if (progressTitle) {
        // <title>
        text = progressTitle;
        title = options.source ? formatLocalize('progress.title2', '[{0}]: {1}', options.source, progressTitle) : text;

      } else if (progressMessage) {
        // <message>
        text = progressMessage;
        title = options.source ? formatLocalize('progress.title2', '[{0}]: {1}', options.source, progressMessage) : text;

      } else {
        // no title, no message -> no progress. try with next on stack
        this.updateWindowProgress(idx + 1);
        return;
      }

      const statusEntryProperties: StatusBarEntry = {
        text: `$(sync~spin) ${text}`,
        tooltip: title,
        command: progressCommand,
        alignment: StatusBarAlignment.LEFT,
      };

      if (this.windowProgressStatusEntry) {
        this.windowProgressStatusEntry.update(statusEntryProperties);
      } else {
        this.windowProgressStatusEntry = this.statusbarService.addElement('status.progress', statusEntryProperties);
      }
    } else {
      // Progress is done so we remove the status entry
      this.windowProgressStatusEntry?.dispose();
      this.windowProgressStatusEntry = undefined;
    }
  }

  // tslint:disable-next-line
  private withCompositeProgress<P extends Promise<R>, R = unknown>(progressIndicator: IProgressIndicator | undefined, task: (progress: IProgress<IProgressStep>) => P, options: IProgressCompositeOptions): P {
    let progressRunner: IProgressRunner | undefined;

    const promise = task({
      report: (progress) => {
        if (!progressRunner) {
          return;
        }

        // TODO 必须透传message以支持window的能力
        if (typeof progress.increment === 'number') {
          progressRunner.worked(progress.increment, progress.message);
        }

        if (typeof progress.total === 'number') {
          progressRunner.total(progress.total, progress.message);
        }
      },
    });

    if (progressIndicator) {
      if (typeof options.total === 'number') {
        progressRunner = progressIndicator.show(options.total, options.delay);
        promise.catch(() => undefined /* ignore */).finally(() => progressRunner ? progressRunner.done() : undefined);
      } else {
        progressIndicator.showWhile(promise, options.delay);
      }
    }

    return promise;
  }

}
