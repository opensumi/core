import * as React from 'react';
import { localize, useInjectable } from '@ali/ide-core-browser';
import { DebugAction } from '../components/debug-action';
import { DebugToolbarService } from './debug-toolbar.service';
import * as styles from './debug-call-stack.module.less';
import { DebugState, DebugSession } from '../debug-session';
import { DebugThread } from '../model/debug-thread';

export interface DebugStackOperationViewProps {
  session?: DebugSession;
  thread?: DebugThread;
}

export const DebugStackOperationView = (props: DebugStackOperationViewProps) => {
  const {
    session,
    thread,
  } = props;
  const {
    state,
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
    const seletSession = (callback: () => any) => {
      updateCurrentSession(session);
      callback();
    };

    return (
      <div className={ styles.debug_stack_session_operations }>
        <DebugAction run={ () => seletSession(doRestart) } icon={ 'reload' } label={ localize('debug.action.restart') } />
        <DebugAction run={ () => seletSession(doStop) } icon={ 'stop' } label={ localize('debug.action.stop') } />
      </div>
    );
  }

  if (!session && thread) {
    const selectThread = (callback: () => any) => {
      thread.session.currentThread = thread;
      callback();
    };

    const renderContinue = (state: DebugState): React.ReactNode => {
      if (state === DebugState.Stopped) {
        return <DebugAction run={ () => selectThread(doContinue) } icon={ 'continue' } label={ localize('debug.action.continue') } />;
      }
      return <DebugAction run={ () => selectThread(doPause) } enabled={ typeof state === 'number' && state === DebugState.Running } icon={ 'pause' } label={ localize('debug.action.pause') } />;
    };

    return (
      <div className={ styles.debug_stack_thread_operations }>
        { renderContinue(state) }
        <DebugAction run={ () => selectThread(doStepOver) } icon={ 'step' } label={ localize('debug.action.step-over') } />
        <DebugAction run={ () => selectThread(doStepIn) } icon={ 'step-in' } label={ localize('debug.action.step-into') } />
        <DebugAction run={ () => selectThread(doStepOut) } icon={ 'step-out' } label={ localize('debug.action.step-out') } />
      </div>
    );
  }

  return null;
};
