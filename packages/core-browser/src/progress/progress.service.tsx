/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React = require('react');

import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { MessageType, update, close } from '@opensumi/ide-components';
import {
  localize,
  IProgressOptions,
  IProgressNotificationOptions,
  IProgressWindowOptions,
  IProgressCompositeOptions,
  IProgress,
  IProgressStep,
  ProgressLocation,
  Progress,
  strings,
  CommandService,
  Disposable,
  Emitter,
  Event,
  toDisposable,
  dispose,
  parseLinkedText,
  IDisposable,
  timeout,
  IAction,
} from '@opensumi/ide-core-common';

import { open } from '../components';
import { toMarkdown } from '../markdown';
import { IOpenerService } from '../opener';
import { StatusBarEntry, StatusBarAlignment, StatusBarEntryAccessor } from '../services';

import { ProgressBar } from './progress-bar';
import { ProgressIndicator } from './progress-indicator';

import { IProgressService, IProgressIndicator, IProgressRunner } from './index';

const { format } = strings;

@Injectable()
export class ProgressService implements IProgressService {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

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
    onDidCancel?: ((choice?: number | undefined) => void) | undefined,
  ): Promise<R> {
    const location = options.location;
    if (typeof location === 'string') {
      if (this.progressIndicatorRegistry.get(location)) {
        return this.withCompositeProgress(location, task, { ...options, location });
      }
      throw new Error(`Bad progress location: ${location}`);
    }
    switch (location) {
      case ProgressLocation.Notification:
        return this.withNotificationProgress({ ...options, location }, task, onDidCancel);
      case ProgressLocation.Window:
        return this.withWindowProgress({ ...options, location }, task);
      case ProgressLocation.Explorer:
        return this.withCompositeProgress('explorer', task, { ...options, location });
      case ProgressLocation.Scm:
        return this.withCompositeProgress('scm', task, { ...options, location });
      case ProgressLocation.Extensions:
        return this.withCompositeProgress('extensions', task, { ...options, location });
      default:
        throw new Error(`Bad progress location: ${location}`);
    }
  }

  private readonly windowProgressStack: [IProgressOptions, Progress<IProgressStep>][] = [];
  private windowProgressStatusEntry: StatusBarEntryAccessor | undefined = undefined;

  private withWindowProgress<R = unknown>(
    options: IProgressWindowOptions,
    callback: (progress: IProgress<{ message?: string }>) => Promise<R>,
  ): Promise<R> {
    const task: [IProgressWindowOptions, Progress<IProgressStep>] = [
      options,
      new Progress<IProgressStep>(() => this.updateWindowProgress()),
    ];

    const promise = callback(task[1]);

    let delayHandle: any = setTimeout(() => {
      delayHandle = undefined;
      this.windowProgressStack.unshift(task);
      this.updateWindowProgress();

      // show progress for at least 150ms
      Promise.all([timeout(150), promise]).finally(() => {
        const idx = this.windowProgressStack.indexOf(task);
        this.windowProgressStack.splice(idx, 1);
        this.updateWindowProgress();
      });
    }, 150);

    // cancel delay if promise finishes below 150ms
    return promise.finally(() => clearTimeout(delayHandle));
  }

  private updateWindowProgress(idx = 0) {
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
        this.commandService
          .executeCommand('statusbar.addElement', 'status.progress', statusEntryProperties)
          .then((accessor: any) => {
            this.windowProgressStatusEntry = accessor;
          });
      }
    } else {
      // Progress is done so we remove the status entry
      this.windowProgressStatusEntry?.dispose();
      this.windowProgressStatusEntry = undefined;
    }
  }

  private withCompositeProgress<P extends Promise<R>, R = unknown>(
    location: string,
    task: (progress: IProgress<IProgressStep>) => P,
    options: IProgressCompositeOptions,
  ): P {
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
        promise.catch(() => undefined /* ignore */).finally(() => (progressRunner ? progressRunner.done() : undefined));
      } else {
        progressIndicator.showWhile(promise, options.delay);
      }
    }

    return promise;
  }

  private withNotificationProgress<P extends Promise<R>, R = unknown>(
    options: IProgressNotificationOptions,
    callback: (progress: IProgress<IProgressStep>) => P,
    onDidCancel?: (choice?: number) => void,
  ): P {
    const progressStateModel = new (class extends Disposable {
      private readonly _onDidReport = this.registerDispose(new Emitter<IProgressStep>());
      readonly onDidReport = this._onDidReport.event;

      private _step: IProgressStep | undefined = undefined;
      get step() {
        return this._step;
      }

      private _done = false;
      get done() {
        return this._done;
      }

      readonly promise: P;

      constructor() {
        super();

        this.promise = callback(this);

        this.promise.finally(() => {
          this.dispose();
        });
      }

      report(step: IProgressStep): void {
        this._step = step;

        this._onDidReport.fire(step);
      }

      cancel(choice?: number): void {
        onDidCancel?.(choice);

        this.dispose();
      }

      dispose(): void {
        this._done = true;
        super.dispose();
      }
    })();

    const createWindowProgress = () => {
      // Create a promise that we can resolve as needed
      // when the outside calls dispose on us
      let promiseResolve: (value?: R | PromiseLike<R>) => void;
      const promise = new Promise<R>((resolve) => (promiseResolve = resolve));

      this.withWindowProgress<R>(
        {
          location: ProgressLocation.Window,
          title: options.title ? parseLinkedText(options.title).toString() : undefined, // convert markdown links => string
        },
        (progress) => {
          function reportProgress(step: IProgressStep) {
            if (step.message) {
              progress.report({
                message: parseLinkedText(step.message).toString(), // convert markdown links => string
              });
            }
          }

          // Apply any progress that was made already
          if (progressStateModel.step) {
            reportProgress(progressStateModel.step);
          }

          // Continue to report progress as it happens
          const onDidReportListener = progressStateModel.onDidReport((step) => reportProgress(step));
          promise.finally(() => onDidReportListener.dispose());

          // When the progress model gets disposed, we are done as well
          Event.once(progressStateModel.onDispose)(() => promiseResolve());

          return promise;
        },
      );

      // Dispose means completing our promise
      return toDisposable(() => promiseResolve());
    };

    let progressBar: React.ReactNode;
    let progressRunner: IProgressRunner;
    let isInfinite = false;

    const createNotification = (message: string, silent: boolean, increment?: number): string => {
      const buttons: Array<string | IAction> = [];
      const closeable = options.closeable ?? true;

      if (options.cancellable) {
        buttons.push(localize('ButtonCancel'));
      }

      if (options.buttons) {
        buttons.push(...options.buttons);
      }

      const notificationKey = Math.random().toString(18).slice(2, 5);
      const indicator = this.injector.get(ProgressIndicator);
      this.registerProgressIndicator(notificationKey, indicator);

      // Switch to window based progress once the notification
      // changes visibility to hidden and is still ongoing.
      // Remove that window based progress once the notification
      // shows again.
      let windowProgressDisposable: IDisposable | undefined;
      const onVisibilityChange = (visible: boolean) => {
        // Clear any previous running window progress
        dispose(windowProgressDisposable);

        // Create new window progress if notification got hidden
        if (!visible && !progressStateModel.done) {
          windowProgressDisposable = createWindowProgress();
        }
      };
      progressBar = <ProgressBar progressModel={indicator.progressModel} />;
      open(message, MessageType.Info, closeable, notificationKey, buttons, progressBar, 0, () =>
        onVisibilityChange(false),
      )?.then(() => {
        progressStateModel.cancel();
      });
      if (typeof increment === 'number' && increment >= 0) {
        progressRunner = indicator.show(100);
        progressRunner.worked(increment);
      } else {
        isInfinite = true;
        progressRunner = indicator.show(true);
      }

      return notificationKey;
    };

    const updateProgress = (increment?: number): void => {
      if (typeof increment === 'number' && increment >= 0) {
        if (isInfinite) {
          isInfinite = false;
          progressRunner.total(100);
        }
        progressRunner.worked(increment);
      } else {
        progressRunner.total(0);
      }
    };

    let notificationKey: string | undefined;
    let notificationTimeout: any | undefined;
    let titleAndMessage: string | undefined; // hoisted to make sure a delayed notification shows the most recent message

    const updateNotification = (step?: IProgressStep): void => {
      // full message (inital or update)
      if (step?.message && options.title) {
        titleAndMessage = `${options.title}: ${step.message}`; // always prefix with overall title if we have it (https://github.com/Microsoft/vscode/issues/50932)
      } else {
        titleAndMessage = options.title || step?.message;
      }

      if (!notificationKey && titleAndMessage) {
        // create notification now or after a delay
        if (typeof options.delay === 'number' && options.delay > 0) {
          if (typeof notificationTimeout !== 'number') {
            notificationTimeout = setTimeout(
              () => (notificationKey = createNotification(titleAndMessage!, !!options.silent, step?.increment)),
              options.delay,
            );
          }
        } else {
          notificationKey = createNotification(titleAndMessage, !!options.silent, step?.increment);
        }
      }

      if (notificationKey) {
        if (typeof step?.increment === 'number') {
          updateProgress(step.increment);
        }
        if (titleAndMessage) {
          const openner = this.injector.get(IOpenerService);
          update(notificationKey, toMarkdown(titleAndMessage, openner));
        }
      }
    };

    // Show initially
    updateNotification(progressStateModel.step);
    const listener = progressStateModel.onDidReport((step) => updateNotification(step));
    Event.once(progressStateModel.onDispose)(() => listener.dispose());

    // Clean up eventually
    (async () => {
      try {
        // with a delay we only wait for the finish of the promise
        if (typeof options.delay === 'number' && options.delay > 0) {
          await progressStateModel.promise;
        } else {
          // to reduce the chance of the notification flashing up and hiding
          // without a delay we show the notification for at least 800ms
          await Promise.all([timeout(800), progressStateModel.promise]);
        }
      } finally {
        clearTimeout(notificationTimeout);
        if (notificationKey) {
          close(notificationKey);
          this.progressIndicatorRegistry.delete(notificationKey);
        }
      }
    })();

    return progressStateModel.promise;
  }
}
