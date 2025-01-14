/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Autowired, Injectable } from '@opensumi/di';
import { Event, IDisposable } from '@opensumi/ide-core-browser';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import { DisposableCollection, IProgress, IProgressStep, ProgressLocation } from '@opensumi/ide-core-common';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol';

import { IDebugProgress } from '../common/debug-progress';
import { DebugState, IDebugSession, IDebugSessionManager } from '../common/debug-session';

@Injectable()
export class DebugProgressService implements IDebugProgress {
  static DEBUG_PANEL_PROGRESS_ID = 'debug';

  @Autowired(IProgressService)
  protected readonly progressService: IProgressService;

  private progressResolve: (() => void) | undefined;

  private toDispose: IDisposable[] = [];

  public async onDebugServiceStateChange(state: DebugState) {
    if (this.progressResolve) {
      this.progressResolve();
      this.progressResolve = undefined;
    }
    if (
      state === DebugState.Initializing &&
      this.progressService.getIndicator(DebugProgressService.DEBUG_PANEL_PROGRESS_ID)
    ) {
      this.progressService.withProgress(
        { location: DebugProgressService.DEBUG_PANEL_PROGRESS_ID },
        (_progress) => new Promise<void>((resolve) => (this.progressResolve = resolve)),
      );
    }
  }

  public run(sessionsManager: IDebugSessionManager): void {
    let progressListener: DisposableCollection | undefined;
    const listenOnProgress = (session: IDebugSession | undefined) => {
      progressListener = new DisposableCollection();

      if (session) {
        progressListener?.push(session.onDidChangeState((state: DebugState) => this.onDebugServiceStateChange(state)));
        progressListener?.push(
          session.onDidProgressStart(async (progressStartEvent: DebugProtocol.ProgressStartEvent) => {
            const promise = new Promise<void>((r) => {
              const listener = Event.any(
                Event.filter(session.onDidProgressEnd, (e) => e.body.progressId === progressStartEvent.body.progressId),
                session.onDidExitAdapter as Event<any>,
              )(() => {
                listener.dispose();
                r();
              });
            });

            if (this.progressService.getIndicator(DebugProgressService.DEBUG_PANEL_PROGRESS_ID)) {
              this.progressService.withProgress(
                { location: DebugProgressService.DEBUG_PANEL_PROGRESS_ID },
                () => promise,
              );
            }

            this.progressService.withProgress(
              {
                location: ProgressLocation.Notification,
                title: progressStartEvent.body.title,
                cancellable: progressStartEvent.body.cancellable,
                silent: true,
                delay: 500,
              },
              (progressStep: IProgress<IProgressStep>) => {
                let total = 0;
                const reportProgress = (progress: { message?: string; percentage?: number }) => {
                  let increment: undefined | number;
                  if (typeof progress.percentage === 'number') {
                    increment = progress.percentage - total;
                    total += increment;
                  }
                  progressStep.report({
                    message: progress.message,
                    increment,
                    total: typeof increment === 'number' ? 100 : undefined,
                  });
                };

                if (progressStartEvent.body.message) {
                  reportProgress(progressStartEvent.body);
                }

                const progressUpdateListener = session.onDidProgressUpdate((e) => {
                  if (e.body.progressId === progressStartEvent.body.progressId) {
                    reportProgress(e.body);
                  }
                });

                return promise.then(() => progressUpdateListener.dispose());
              },
              () => session.cancel(progressStartEvent.body.progressId),
            );
          }),
        );
      }
    };

    this.toDispose.push(
      sessionsManager.onDidChangeActiveDebugSession(({ current }) => {
        if (progressListener) {
          progressListener.dispose();
        }
        listenOnProgress(current);
      }),
    );
    listenOnProgress(sessionsManager.currentSession);
  }
}
