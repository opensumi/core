/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { IProgressOptions, IProgressNotificationOptions, IProgressWindowOptions, IProgressCompositeOptions, IProgress, IProgressStep, ProgressLocation, Progress, format } from '@ali/ide-core-common';
import { IProgressService, IProgressIndicator, IProgressRunner } from '.';
import { timeout, IDisposable } from '..';
import { StatusBarEntry, StatusBarAlignment, IStatusBarService, StatusBarEntryAccessor } from '../services';
import { ProgressIndicator } from './progress-indicator';

@Injectable()
export class ProgressService implements IProgressService {

  @Autowired(IStatusBarService)
  statusbarService: IStatusBarService;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  // 不同的视图会有不同的IProgressIndicator实例
  private progressIndicatorRegistry: Map<string, IProgressIndicator> = new Map();

  registerProgressIndicator(location: string, indicator?: IProgressIndicator): IDisposable {
    const targetIndicator = indicator || this.injector.get(ProgressIndicator);
    this.progressIndicatorRegistry.set(location, targetIndicator);
    return {
      dispose: () => this.progressIndicatorRegistry.delete(location),
    };
  }

  getIndicator(location: string) {
    return this.progressIndicatorRegistry.get(location);
  }

  withProgress<R>(
    options: IProgressOptions | IProgressNotificationOptions | IProgressWindowOptions | IProgressCompositeOptions,
    task: (progress: IProgress<IProgressStep>) => Promise<R>,
    onDidCancel?: ((choice?: number | undefined) => void) | undefined): Promise<R> {
    const location = options.location;
    if (typeof location === 'string') {
      if (this.progressIndicatorRegistry.get(location)) {
        return this.withCompositeProgress(location, task, { ...options, location });
      }
      throw new Error(`Bad progress location: ${location}`);
    }
    switch (location) {
      // case ProgressLocation.Notification:
      // 	return this.withNotificationProgress({ ...options, location }, task, onDidCancel);
      case ProgressLocation.Window:
        return this.withWindowProgress({ ...options, location }, task);
      case ProgressLocation.Explorer:
        return this.withCompositeProgress('explorer', task, { ...options, location });
      case ProgressLocation.Scm:
        return this.withCompositeProgress('scm', task, { ...options, location });
      case ProgressLocation.Extensions:
        return this.withCompositeProgress('extensions', task, { ...options, location });
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
      const progressCommand = (options as IProgressWindowOptions).command;
      let text: string;
      let title: string;

      if (progressTitle && progressMessage) {
        // <title>: <message>
        text = format('{0}: {1}', progressTitle, progressMessage);
        title = options.source ? format('[{0}] {1}: {2}', options.source, progressTitle, progressMessage) : text;

      } else if (progressTitle) {
        // <title>
        text = progressTitle;
        title = options.source ? format('[{0}]: {1}', options.source, progressTitle) : text;

      } else if (progressMessage) {
        // <message>
        text = progressMessage;
        title = options.source ? format('[{0}]: {1}', options.source, progressMessage) : text;

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

  private withCompositeProgress<P extends Promise<R>, R = unknown>(location: string, task: (progress: IProgress<IProgressStep>) => P, options: IProgressCompositeOptions): P {
    const progressIndicator: IProgressIndicator | undefined = this.progressIndicatorRegistry.get(location);
    let progressRunner: IProgressRunner | undefined;

    const promise = task({
      report: (progress) => {
        if (!progressRunner) {
          return;
        }

        if (typeof progress.increment === 'number') {
          progressRunner.worked(progress.increment);
        }

        if (typeof progress.total === 'number') {
          progressRunner.total(progress.total);
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
