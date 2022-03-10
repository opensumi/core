import { observer } from 'mobx-react-lite';
import React from 'react';

import { useInjectable, ViewState } from '@opensumi/ide-core-browser';

import { IDebugSessionManager, IDebugSession } from '../../../common';
import { DebugSession } from '../../debug-session';
import { DebugSessionManager } from '../../debug-session-manager';

import { DebugStackSessionView } from './debug-call-stack-session.view';

export const DebugCallStackView = observer(({ viewState }: React.PropsWithChildren<{ viewState: ViewState }>) => {
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
    <div style={{ width: viewState.width }}>
      {sessions
        .filter((s: IDebugSession) => !s.parentSession)
        .map((session) => (
          <DebugStackSessionView key={session.id} viewState={viewState} session={session} indent={0} />
        ))}
    </div>
  );
});
