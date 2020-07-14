import * as React from 'react';
import { ViewState, getIcon, useInjectable, localize } from '@ali/ide-core-browser';
import { DebugThread } from '../model/debug-thread';
import { DebugStackFrame } from '../model';
import { DebugStackFramesView } from './debug-call-stack-frame.view';
import { DebugStackOperationView } from './debug-call-stack.operation';
import { DebugSessionManager } from '../debug-session-manager';
import { IDebugSessionManager } from '../../common';
import * as styles from './debug-call-stack.module.less';

export interface DebugStackThreadViewProps {
  viewState: ViewState;
  thread: DebugThread;
  indent?: number;
}

export const DebugStackThreadView = (props: DebugStackThreadViewProps) => {
  const { thread, viewState, indent } = props;
  const manager = useInjectable<DebugSessionManager>(IDebugSessionManager);
  const [frames, setFrames] = React.useState<DebugStackFrame[]>([]);
  const [unfold, setUnfold] = React.useState<boolean>(false);
  const [hover, setHover] = React.useState<boolean>(false);

  const mutipleS = manager.sessions.length > 1;
  const mutiple = manager.sessions.length > 1 || manager.sessions[0].threadCount > 1;

  React.useEffect(() => {
    setFrames([...thread.frames]);

    const disposable = thread.onDidChanged(() => {
      setFrames([...thread.frames]);
      if (thread.stopped && (manager.currentThread && manager.currentThread.id === thread.id)) {
        setUnfold(true);
      } else {
        setUnfold(false);
      }
    });

    return () => {
      disposable.dispose();
    };
  }, []);

  return (
    <div className={ styles.debug_stack_item }>
      {
        mutiple &&
        <div
          style={ { paddingLeft: `${indent}px` } }
          className={ styles.debug_stack_item_label }
          onMouseEnter={ () => setHover(true) }
          onMouseLeave={ () => setHover(false) }
        >
          {
            frames.length > 0 ?
              <div
                className={ unfold ? getIcon('down') : getIcon('right') }
                onClick={ () => setUnfold(!unfold) }
              ></div> :
              <div style={ { width: 14 } }></div>
          }
          <div className={ styles.debug_threads_item }>{ thread.raw.name }</div>
          {
            hover ?
              <DebugStackOperationView thread={ thread } /> :
              <span className={ styles.debug_threads_item_description }>
                {
                  (thread.stopped && thread.stoppedDetails) ?
                    thread.raw.id === thread.stoppedDetails.threadId ? `${localize('debug.stack.frame.because')} ${thread.stoppedDetails.reason} ${localize('debug.stack.frame.stopped')}`
                      : localize('debug.stack.frame.stopped')
                    : localize('debug.stack.frame.running')
                }
              </span>
          }
        </div>
      }
      {
        (!mutiple || unfold) &&
        <DebugStackFramesView indent={ mutiple ? mutipleS ? 32 + 14 : 16 + 14 : 8 } viewState={ viewState } thread={ thread } frames={ frames } />
      }
    </div>
  );
};
