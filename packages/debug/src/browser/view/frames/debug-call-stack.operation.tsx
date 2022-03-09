import React from 'react';

import { localize, useInjectable } from '@opensumi/ide-core-browser';

import { DebugAction } from '../../components';
import { DebugSession } from '../../debug-session';
import { DebugThread } from '../../model/debug-thread';
import { DebugToolbarService } from '../configuration/debug-toolbar.service';

import styles from './debug-call-stack.module.less';

export interface DebugStackOperationViewProps {
  session?: DebugSession;
  thread?: DebugThread;
}

export const DebugStackOperationView = (props: DebugStackOperationViewProps) => {
  const { session, thread } = props;
  const {
    doStop,
    doStepIn,
    doStepOut,
    doStepOver,
    doContinue,
    doRestart,
    doPause,
    updateCurrentSession,
  }: DebugToolbarService = useInjectable(DebugToolbarService);

  if (session && !thread) {
    const selectSession = (callback: () => any) => {
      updateCurrentSession(session);
      callback();
    };

    return (
      <div className={styles.debug_stack_session_operations}>
        <DebugAction run={() => selectSession(doRestart)} icon={'reload'} label={localize('debug.action.restart')} />
        <DebugAction run={() => selectSession(doStop)} icon={'stop'} label={localize('debug.action.stop')} />
      </div>
    );
  }

  if (!session && thread) {
    const { stopped } = thread;
    const selectThread = (callback: () => any) => {
      thread.session.currentThread = thread;
      callback();
    };

    const renderContinue = (isStop: boolean): React.ReactNode => {
      if (isStop) {
        return (
          <DebugAction
            run={() => selectThread(doContinue)}
            icon={'continue'}
            label={localize('debug.action.continue')}
          />
        );
      }
      return (
        <DebugAction
          run={() => selectThread(doPause)}
          enabled={true}
          icon={'pause'}
          label={localize('debug.action.pause')}
        />
      );
    };

    return (
      <div className={styles.debug_stack_thread_operations}>
        {renderContinue(stopped)}
        <DebugAction
          run={() => selectThread(doStepOver)}
          enabled={stopped}
          icon={'step'}
          label={localize('debug.action.step-over')}
        />
        <DebugAction
          run={() => selectThread(doStepIn)}
          enabled={stopped}
          icon={'step-in'}
          label={localize('debug.action.step-into')}
        />
        <DebugAction
          run={() => selectThread(doStepOut)}
          enabled={stopped}
          icon={'step-out'}
          label={localize('debug.action.step-out')}
        />
      </div>
    );
  }

  return null;
};
