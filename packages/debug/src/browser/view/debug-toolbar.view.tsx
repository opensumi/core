import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as styles from './debug-configuration.module.less';
import * as cls from 'classnames';
import { Injectable } from '@ali/common-di';
import { observable, action } from 'mobx';
import { useInjectable, localize, getIcon, isElectronRenderer, IClientApp } from '@ali/ide-core-browser';
import { DebugAction } from '../components/debug-action';
import { observer } from 'mobx-react-lite';
import { DebugToolbarService } from './debug-toolbar.service';
import { DebugState, DebugSession } from '../debug-session';
import { isExtensionHostDebugging } from '../debugUtils';
import { Select } from '@ali/ide-components';

@Injectable()
class FloatController {
  @observable
  x: number;

  @observable
  enable: boolean;

  private _origin: number;
  private _last: number;

  constructor() {
    this.x = 0;
    this.enable = false;
    this._origin = 0;
    this._last = 0;
  }

  @action.bound
  onMouseDown(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    this.enable = true;
    this._origin = e.clientX;
  }

  @action.bound
  onMouseMove(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    e.stopPropagation();
    if (this.enable) {
      this.x = e.clientX - this._origin + this._last;
    }
  }

  @action.bound
  onMouseUp() {
    this.enable = false;
    this._last = this.x;
  }
}

export const DebugToolbarView = observer(() => {
  const {
    state,
    sessionCount,
    doStop,
    doStepIn,
    doStepOut,
    doStepOver,
    doContinue,
    doRestart,
    doPause,
    currentSession,
    sessions,
    updateCurrentSession,
  }: DebugToolbarService = useInjectable(DebugToolbarService);

  const isAttach = !!currentSession && currentSession.configuration.request === 'attach' && !isExtensionHostDebugging(currentSession.configuration);

  const currentSessionId = currentSession && currentSession.id;

  const renderStop = (state: DebugState, sessionCount: number): React.ReactNode => {
    if (isAttach) {
      return <DebugAction run={ doStop } enabled={ typeof state === 'number' && state !== DebugState.Inactive } icon={ 'disconnect' } label={ localize('debug.action.disattach') } />;
    }
    return <DebugAction run={ doStop } enabled={ typeof state === 'number' && state !== DebugState.Inactive } icon={ 'stop' } label={ localize('debug.action.stop') } />;
  };
  const renderContinue = (state: DebugState): React.ReactNode => {
    if (state === DebugState.Stopped) {
      return <DebugAction run={ doContinue } icon={ 'continue' } label={ localize('debug.action.continue') } />;
    }
    return <DebugAction run={ doPause } enabled={ typeof state === 'number' && state === DebugState.Running } icon={ 'pause' } label={ localize('debug.action.pause') } />;
  };

  const renderSessionOptions = (sessions: DebugSession[]) => {
    return sessions.map((session: DebugSession) => {
      if (isElectronRenderer()) {
        return <option key={ session.id } value={ session.id }>{ session.label }</option>;
      }
      return <Option key={ session.id } label={session.label} value={ session.id }>{ session.label }</Option>;
    });
  };

  const renderSelections = (sessions: DebugSession[]) => {
    if (sessionCount > 1) {
      return <div className={ cls(styles.debug_selection) }>
        {isElectronRenderer() ?
          <select value={ currentSessionId } onChange={ setCurrentSession }>
          { renderSessionOptions(sessions) }
        </select> :
        <Select value={ currentSessionId } onChange={ setCurrentSession }>
        { renderSessionOptions(sessions) }
      </Select>}
      </div>;
    }
  };

  const setCurrentSession = (event: React.ChangeEvent<HTMLSelectElement> | string | number) => {
    let value = event;
    if (isElectronRenderer()) {
      value = (event as React.ChangeEvent<HTMLSelectElement>).target.value;
    }

    if (!sessions) {
      return;
    }
    for (const session of sessions) {
      if (session.id === value) {
        updateCurrentSession(session);
      }
    }
  };

  return (
    <React.Fragment>
      <div className={ styles.kt_debug_action_bar }>
        { renderContinue(state) }
        <DebugAction run={ doStepOver } enabled={ typeof state === 'number' && state === DebugState.Stopped } icon={ 'step' } label={ localize('debug.action.step-over') } />
        <DebugAction run={ doStepIn } enabled={ typeof state === 'number' && state === DebugState.Stopped } icon={ 'step-in' } label={ localize('debug.action.step-into') } />
        <DebugAction run={ doStepOut } enabled={ typeof state === 'number' && state === DebugState.Stopped } icon={ 'step-out' } label={ localize('debug.action.step-out') } />
        <DebugAction run={ doRestart } enabled={ typeof state === 'number' && state !== DebugState.Inactive } icon={ 'reload' } label={ localize('debug.action.restart') } />
        { renderStop(state, sessionCount) }
        { renderSelections(sessions) }

      </div>
    </React.Fragment>
  );
});

export const FloatDebugToolbarView = observer(() => {
  const app = useInjectable<IClientApp>(IClientApp);
  const controller = useInjectable<FloatController>(FloatController);
  const {
    state,
  }: DebugToolbarService = useInjectable(DebugToolbarService);
  if (app.container && state) {
    return ReactDOM.createPortal(
      <div
        style={ { pointerEvents: controller.enable ? 'all' : 'none' } }
        className={ styles.debug_toolbar_container }
        onMouseMove={ (e) => controller.onMouseMove(e) }
        onMouseUp={ (e) => controller.onMouseUp() }
      >
        <div
          style={ { transform: `translateX(${controller.x}px)` } }
          className={ styles.debug_toolbar_wrapper }
        >
          <div
            className={ cls(getIcon('ellipsis'), styles.debug_toolbar_drag) }
            onMouseDown={ (e) => controller.onMouseDown(e) }
            onMouseMove={ (e) => controller.onMouseMove(e) }
          ></div>
          <DebugToolbarView />
        </div>
      </div>,
      app.container,
    );
  } else {
    return null;
  }
});
