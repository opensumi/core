import React, { useCallback, useEffect, useState } from 'react';

import { Badge } from '@opensumi/ide-components';
import { DisposableCollection, ViewState, getIcon, localize, useInjectable } from '@opensumi/ide-core-browser';

import { IDebugSessionManager } from '../../../common';
import { DebugSession } from '../../debug-session';
import { DebugSessionManager } from '../../debug-session-manager';
import { DebugStackFrame } from '../../model';
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
  isBottom?: boolean;
}

export const DebugStackThreadView = (props: DebugStackThreadViewProps) => {
  const { thread, viewState, indent, session, isBottom } = props;
  const manager = useInjectable<DebugSessionManager>(IDebugSessionManager);
  const debugCallStackService = useInjectable<DebugCallStackService>(DebugCallStackService);
  const [expanded, setExpanded] = useState<boolean>(true);
  const [frames, setFrames] = useState<DebugStackFrame[]>(thread.frames);

  const mutipleS = manager.sessions.length > 1;
  const mutiple = manager.currentSession?.supportsThreadIdCorrespond
    ? true
    : manager.sessions.length > 1 || (manager.sessions[0] && manager.sessions[0].threadCount > 1);

  const updateExpanded = useCallback(
    (value: boolean) => {
      setExpanded(value);
    },
    [expanded],
  );

  useEffect(() => {
    const disposable = new DisposableCollection();

    disposable.push(
      session.onDidChangeCallStack(() => {
        setFrames(thread.frames);
        if (thread.stopped && manager.currentThread && manager.currentThread.id === thread.id) {
          updateExpanded(true);
        } else {
          updateExpanded(false);
        }
      }),
    );

    return () => {
      disposable.dispose();
    };
  }, []);

  const statusDescription =
    thread.stopped && thread.stoppedDetails
      ? thread.raw.id === thread.stoppedDetails.threadId
        ? `${localize('debug.stack.frame.because')} ${thread.stoppedDetails.reason} ${localize(
            'debug.stack.frame.stopped',
          )}`
        : localize('debug.stack.frame.stopped')
      : localize('debug.stack.frame.running');

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
            <div
              className={expanded ? getIcon('arrow-down') : getIcon('arrow-right')}
              onClick={() => setExpanded(!expanded)}
            ></div>
          ) : (
            <div style={{ width: 14 }}></div>
          )}
          <div className={styles.debug_threads_item}>{thread.raw.name}</div>
          <>
            <div className={styles.debug_threads_operation}>
              <DebugStackOperationView thread={thread} />
            </div>
            <span className={styles.debug_threads_description}>
              <Badge>{statusDescription.toUpperCase()}</Badge>
            </span>
          </>
        </div>
      )}
      {(!mutiple || expanded) && thread.frames.length > 0 && (
        <DebugStackFramesView
          indent={mutiple ? (mutipleS ? 24 + 14 : 16 + 14) : 8}
          isBottom={isBottom}
          viewState={viewState}
          thread={thread}
          frames={frames}
          session={session}
        />
      )}
    </div>
  );
};
