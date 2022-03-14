import React from 'react';

import { ViewState, getIcon, useInjectable, localize, DisposableCollection } from '@opensumi/ide-core-browser';

import { IDebugSessionManager } from '../../../common';
import { DebugSession } from '../../debug-session';
import { DebugSessionManager } from '../../debug-session-manager';
import { DebugThread } from '../../model/debug-thread';

import { DebugStackFramesView } from './debug-call-stack-frame.view';
import styles from './debug-call-stack.module.less';
import { DebugStackOperationView } from './debug-call-stack.operation';
import { DebugCallStackService } from './debug-call-stack.service';

export interface DebugStackThreadViewProps {
  session: DebugSession;
  viewState: ViewState;
  thread: DebugThread;
  indent?: number;
}

export const DebugStackThreadView = (props: DebugStackThreadViewProps) => {
  const { thread, viewState, indent, session } = props;
  const manager = useInjectable<DebugSessionManager>(IDebugSessionManager);
  const debugCallStackService = useInjectable<DebugCallStackService>(DebugCallStackService);
  const [unfold, setUnfold] = React.useState<boolean>(true);

  const mutipleS = manager.sessions.length > 1;
  const mutiple = manager.currentSession?.supportsThreadIdCorrespond
    ? true
    : manager.sessions.length > 1 || manager.sessions[0].threadCount > 1;

  React.useEffect(() => {
    const disposable = new DisposableCollection();

    disposable.push(
      session.onDidChangeCallStack(() => {
        if (thread.stopped && manager.currentThread && manager.currentThread.id === thread.id) {
          setUnfold(true);
        } else {
          setUnfold(false);
        }
      }),
    );

    return () => {
      disposable.dispose();
    };
  }, []);

  return (
    <div
      className={styles.debug_stack_item}
      onContextMenu={(event: React.MouseEvent<HTMLDivElement, MouseEvent>) =>
        debugCallStackService.handleContextMenu(event, thread)
      }
    >
      {mutiple && (
        <div style={{ paddingLeft: `${indent}px` }} className={styles.debug_stack_item_label}>
          {thread.frames.length > 0 ? (
            <div className={unfold ? getIcon('down') : getIcon('right')} onClick={() => setUnfold(!unfold)}></div>
          ) : (
            <div style={{ width: 14 }}></div>
          )}
          <div className={styles.debug_threads_item}>{thread.raw.name}</div>
          <>
            <div className={styles.debug_threads_operation}>
              <DebugStackOperationView thread={thread} />
            </div>
            <span className={styles.debug_threads_description}>
              {thread.stopped && thread.stoppedDetails
                ? thread.raw.id === thread.stoppedDetails.threadId
                  ? `${localize('debug.stack.frame.because')} ${thread.stoppedDetails.reason} ${localize(
                      'debug.stack.frame.stopped',
                    )}`
                  : localize('debug.stack.frame.stopped')
                : localize('debug.stack.frame.running')}
            </span>
          </>
        </div>
      )}
      {(!mutiple || unfold) && thread.frames.length > 0 && (
        <DebugStackFramesView
          indent={mutiple ? (mutipleS ? 32 + 14 : 16 + 14) : 8}
          viewState={viewState}
          thread={thread}
          frames={thread.frames}
          session={session}
        />
      )}
    </div>
  );
};
