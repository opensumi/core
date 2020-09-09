import * as React from 'react';
import * as cls from 'classnames';
import { ViewState, getIcon, useInjectable, DisposableCollection } from '@ali/ide-core-browser';
import { DebugSession } from '../../debug-session';
import { DebugThread } from '../../model/debug-thread';
import { DebugStackThreadView } from './debug-call-stack-thread.view';
import { DebugStackOperationView } from './debug-call-stack.operation';
import { DebugSessionManager } from '../../debug-session-manager';
import { IDebugSessionManager } from '../../../common';
import * as styles from './debug-call-stack.module.less';

export interface DebugStackSessionViewProps {
  session: DebugSession;
  viewState: ViewState;
}

export const DebugStackSessionView = (props: DebugStackSessionViewProps) => {
  const { session, viewState } = props;
  const manager = useInjectable<DebugSessionManager>(IDebugSessionManager);
  const [threads, setThreads] = React.useState<DebugThread[]>([]);
  const [unfold, setUnfold] = React.useState<boolean>(true);
  const [hover, setHover] = React.useState<boolean>(false);
  const mutiple = manager.sessions.length > 1;

  React.useEffect(() => {
    setThreads(Array.from(session.threads));

    const disposable = new DisposableCollection();

    disposable.push(session.onDidChange(() => {
      setThreads([...session.threads]);
    }));

    return () => {
      disposable.dispose();
    };
  }, []);

  return (
    <div className={ styles.debug_stack_item }>
      {
        mutiple &&
        <div
          className={ styles.debug_stack_item_label }
          onMouseEnter={ () => setHover(true) }
          onMouseLeave={ () => setHover(false) }
        >
          {
            threads.length > 0 &&
            [
              <div className={ unfold ? getIcon('down') : getIcon('right') } onClick={ () => setUnfold(!unfold) }></div>,
              <div className={ cls([getIcon('debug'), styles.debug_session_icon]) }></div>,
            ]
          }
          <div
            className={ styles.debug_stack_item_label_title }
          >
            { session.label }
          </div>
          {
            hover &&
            <DebugStackOperationView session={ session } />
          }
        </div>
      }
      {
        (!mutiple || unfold) &&
        threads.map((thread) =>
          <DebugStackThreadView key={ thread.id } indent={ mutiple ? 16 : 0 } viewState={ viewState } thread={ thread } />)
      }
    </div>
  );
};
