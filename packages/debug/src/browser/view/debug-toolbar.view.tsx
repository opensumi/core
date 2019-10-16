import * as React from 'react';
import * as styles from './debug-configuration.module.less';
import * as cls from 'classnames';
import { useInjectable, localize } from '@ali/ide-core-browser';
import { DebugAction } from '../components/debug-action';
import { observer } from 'mobx-react-lite';
import { DebugToolbarService } from './debug-toolbar.service';
import { DebugState } from '../debug-session';
export const DebubgToolbarView = observer(() => {
  const {
    state,
    sessionCount,
    doStop,
    doStepIn,
    doStepOut,
    doStepOver,
    doContinue,
    doStart,
    doRestart,
    doPause,
  }: DebugToolbarService = useInjectable(DebugToolbarService);

  const renderStop = (state: DebugState, sessionCount: number): React.ReactNode => {
    return <DebugAction color={'#FF7673'} run={doStop} enabled={state !== DebugState.Inactive} icon={'terminate'} label={localize('debug.action.stop')} />;
  };
  const renderContinue = (state: DebugState): React.ReactNode => {
    if (state === DebugState.Stopped) {
      return <DebugAction color={'#62D99D'} run={doContinue} icon={'start'} label={localize('debug.action.continue')} />;
    }
    return <DebugAction color={'#FF7673'} run={doPause} enabled={state === DebugState.Running} icon={'stop'} label={localize('debug.action.pause')} />;

  };
  return <React.Fragment>
    <div className={styles.kt_debug_action_bar}>
      {renderContinue(state)}
      <DebugAction color={'#2288E6'} run={doStepOver} enabled={state === DebugState.Stopped} icon={'step'} label={localize('debug.action.step-over')} />
      <DebugAction color={'#2288E6'} run={doStepIn} enabled={state === DebugState.Stopped} icon={'step-in'} label={localize('debug.action.step-into')} />
      <DebugAction color={'#2288E6'} run={doStepOut} enabled={state === DebugState.Stopped} icon={'step-out'} label={localize('debug.action.step-out')} />
      <DebugAction color={'#62D99D'} run={doRestart} enabled={state !== DebugState.Inactive} icon={'reload'} label={localize('debug.action.restart')} />
      {renderStop(state, sessionCount)}
    </div>
  </React.Fragment>;
});
