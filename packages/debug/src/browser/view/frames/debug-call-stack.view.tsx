import React from 'react';

import { ViewState, useInjectable } from '@opensumi/ide-core-browser';

import { IDebugSession, IDebugSessionManager } from '../../../common';
import { DebugSession } from '../../debug-session';
import { DebugSessionManager } from '../../debug-session-manager';

import { DebugStackSessionView } from './debug-call-stack-session.view';
import styles from './debug-call-stack.module.less';

export const DebugCallStackView = ({ viewState }: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const manager = useInjectable<DebugSessionManager>(IDebugSessionManager);
  const [sessions, setSessions] = React.useState<DebugSession[]>([]);

  React.useEffect(() => {
    const createDispose = manager.onDidStartDebugSession((session) => {
      sessions.push(session);
      setSessions([...sessions]);
    });

    const destroyDispose = manager.onDidDestroyDebugSession((session) => {
      const index = sessions.findIndex((s) => s.id === session.id);
      sessions.splice(index, 1);
      setSessions([...sessions]);
    });

    return () => {
      createDispose.dispose();
      destroyDispose.dispose();
    };
  }, []);

  return (
    <div className={styles.call_stack_wrapper}>
      {sessions
        .filter((s: IDebugSession) => !s.parentSession)
        .map((session) => (
          <DebugStackSessionView key={session.id} viewState={viewState} session={session} indent={0} />
        ))}
    </div>
  );
};
