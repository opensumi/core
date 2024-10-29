import cls from 'classnames';
import { action, makeObservable, observable } from 'mobx';
import { observer } from 'mobx-react-lite';
import React, { useCallback, useEffect, useState } from 'react';

import { Injectable } from '@opensumi/di';
import { Option, Select } from '@opensumi/ide-components';
import {
  AppConfig,
  DisposableCollection,
  PreferenceService,
  electronEnv,
  getIcon,
  localize,
  useDerived,
  useDesignStyles,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { InlineMenuBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { Select as NativeSelect } from '@opensumi/ide-core-browser/lib/components/select';
import { LayoutViewSizeConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { IElectronMainUIService } from '@opensumi/ide-core-common/lib/electron';

import { DebugState } from '../../../common';
import { DebugAction } from '../../components';
import { DebugSession } from '../../debug-session';
import { isExtensionHostDebugging } from '../../debugUtils';

import styles from './debug-configuration.module.less';
import { DebugConfigurationService } from './debug-configuration.service';
import { DebugToolbarService } from './debug-toolbar.service';

@Injectable()
class FloatController {
  @observable
  x: number;

  @observable
  line: number;

  @observable
  enable: boolean;

  private _origin: number;
  private _last: number;

  private _y: number;

  constructor() {
    makeObservable(this);
    this.x = 0;
    this.line = 0;
    this.enable = false;
    this._origin = 0;
    this._last = 0;
    this._y = 0;
  }

  @action.bound
  onMouseDown(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    this.enable = true;
    this._origin = e.clientX;
    this._y = e.clientY;
  }

  @action.bound
  onMouseMove(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    e.stopPropagation();
    if (this.enable) {
      this.x = e.clientX - this._origin + this._last;
      this.line = e.clientY - this._y > 10 ? 1 : 0;
    }
  }

  @action.bound
  onMouseUp() {
    this.enable = false;
    this._last = this.x;
  }
}

export interface DebugToolbarViewProps {
  float: boolean;
  className?: string;
}

/**
 * 该组件支持用户导入
 * 后续如果有一些改动需要考虑是否有 breakchange
 */
export const DebugToolbarView = observer((props: DebugToolbarViewProps) => {
  const {
    state,
    toolBarMenuMap,
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
  } = useInjectable<DebugToolbarService>(DebugToolbarService);
  const derivedState = useDerived(state);
  const derivedCurrentSession = useDerived(currentSession);
  const derivedSessions = useDerived(sessions);

  const { isElectronRenderer } = useInjectable<AppConfig>(AppConfig);
  const isAttach =
    !!derivedCurrentSession &&
    derivedCurrentSession.configuration?.request === 'attach' &&
    !isExtensionHostDebugging(derivedCurrentSession.configuration);

  const currentSessionId = derivedCurrentSession && derivedCurrentSession.id;

  const renderToolBar = useCallback(
    (session: DebugSession | undefined): React.ReactNode => {
      if (session && session.id) {
        const menus = toolBarMenuMap.get(session.id);
        if (menus) {
          return <InlineMenuBar menus={menus} />;
        }
      }
      return null;
    },
    [toolBarMenuMap],
  );

  const renderStop = useCallback(
    (state: DebugState): React.ReactNode => {
      if (isAttach) {
        return (
          <DebugAction
            run={doStop}
            enabled={derivedState !== DebugState.Inactive}
            icon={'disconnect'}
            label={localize('debug.action.disattach')}
          />
        );
      }
      return (
        <DebugAction
          run={doStop}
          enabled={derivedState !== DebugState.Inactive}
          icon={'stop'}
          label={localize('debug.action.stop')}
        />
      );
    },
    [doStop],
  );

  const renderContinue = useCallback(
    (state: DebugState): React.ReactNode => {
      if (state === DebugState.Stopped) {
        return <DebugAction run={doContinue} icon={'continue'} label={localize('debug.action.continue')} />;
      }
      return (
        <DebugAction
          run={doPause}
          enabled={derivedState === DebugState.Running}
          icon={'pause'}
          label={localize('debug.action.pause')}
        />
      );
    },
    [doPause, doContinue],
  );

  const renderSessionOptions = useCallback(
    (sessions: DebugSession[]) =>
      sessions.map((session: DebugSession) => {
        if (isElectronRenderer) {
          return (
            <option key={session.id} value={session.id}>
              {session.label}
            </option>
          );
        }
        return (
          <Option key={session.id} label={session.label} value={session.id}>
            {session.label}
          </Option>
        );
      }),
    [],
  );

  const renderSelections = useCallback(
    (sessions: DebugSession[]) => {
      if (sessions.length > 1) {
        return (
          <div className={cls(styles.debug_selection)}>
            {isElectronRenderer ? (
              <NativeSelect value={currentSessionId} onChange={setCurrentSession}>
                {renderSessionOptions(sessions)}
              </NativeSelect>
            ) : (
              <Select
                className={cls(styles.debug_selection, styles.special_radius)}
                size={props.float ? 'small' : 'default'}
                value={currentSessionId}
                options={sessions.map((s) => ({ label: s.label, value: s.id }))}
                onChange={setCurrentSession}
              >
                {renderSessionOptions(sessions)}
              </Select>
            )}
          </div>
        );
      }
    },
    [currentSessionId],
  );

  const setCurrentSession = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement> | string | number) => {
      let value = event;
      if (isElectronRenderer) {
        value = (event as React.ChangeEvent<HTMLSelectElement>).target.value;
      }

      if (!derivedSessions) {
        return;
      }
      for (const session of derivedSessions) {
        if (session.id === value) {
          updateCurrentSession(session);
        }
      }
    },
    [derivedSessions, updateCurrentSession],
  );

  return (
    <div className={cls(styles.debug_action_bar, props.className || '')}>
      {renderSelections(derivedSessions.filter((s: DebugSession) => !s.parentSession))}
      <div className={styles.debug_actions}>
        {renderContinue(derivedState)}
        <DebugAction
          run={doStepOver}
          enabled={derivedState === DebugState.Stopped}
          icon={'step'}
          label={localize('debug.action.step-over')}
        />
        <DebugAction
          run={doStepIn}
          enabled={derivedState === DebugState.Stopped}
          icon={'step-in'}
          label={localize('debug.action.step-into')}
        />
        <DebugAction
          run={doStepOut}
          enabled={derivedState === DebugState.Stopped}
          icon={'step-out'}
          label={localize('debug.action.step-out')}
        />
        <DebugAction
          run={doRestart}
          enabled={derivedState !== DebugState.Inactive}
          icon={'reload'}
          label={localize('debug.action.restart')}
        />
        {renderStop(derivedState)}
        {renderToolBar(derivedCurrentSession)}
      </div>
    </div>
  );
});

const DebugPreferenceTopKey = 'debug.toolbar.top';
const DebugPreferenceHeightKey = 'debug.toolbar.height';

const FloatDebugToolbarView = observer(() => {
  const controller = useInjectable<FloatController>(FloatController);
  const preference = useInjectable<PreferenceService>(PreferenceService);
  const { isElectronRenderer } = useInjectable<AppConfig>(AppConfig);
  const layoutViewSize = useInjectable<LayoutViewSizeConfig>(LayoutViewSizeConfig);
  const styles_debug_toolbar_wrapper = useDesignStyles(styles.debug_toolbar_wrapper, 'debug_toolbar_wrapper');
  const [toolbarOffsetTop, setToolbarOffsetTop] = useState<number>(0);

  const debugToolbarService = useInjectable<DebugToolbarService>(DebugToolbarService);
  const state = useDerived(debugToolbarService.state);

  useEffect(() => {
    makeObservable(controller);
    const disposableCollection = new DisposableCollection();
    const value = preference.get<number>(DebugPreferenceTopKey) || 0;
    if (isElectronRenderer) {
      const uiService: IElectronMainUIService = debugToolbarService.mainUIService;
      // Electron 环境下需要在非全屏情况下追加 Header 高度
      uiService.isFullScreen(electronEnv.currentWindowId).then((fullScreen) => {
        fullScreen ? setToolbarOffsetTop(value) : setToolbarOffsetTop(value + layoutViewSize.calcOnlyTitleBarHeight());
      });
      disposableCollection.push(
        uiService.on('fullScreenStatusChange', (windowId, fullScreen) => {
          if (windowId === electronEnv.currentWindowId) {
            fullScreen
              ? setToolbarOffsetTop(value)
              : setToolbarOffsetTop(value + layoutViewSize.calcOnlyTitleBarHeight());
          }
        }),
      );
    } else {
      setToolbarOffsetTop(value);
    }
    return () => {
      disposableCollection.dispose();
    };
  }, []);

  const customHeight = preference.get<number>(DebugPreferenceHeightKey) || 0;

  const debugToolbarWrapperClass = cls({
    [styles_debug_toolbar_wrapper]: true,
    [styles.debug_toolbar_wrapper_electron]: isElectronRenderer,
  });

  if (state) {
    return (
      <div
        style={{ pointerEvents: controller.enable ? 'all' : 'none' }}
        className={styles.debug_toolbar_container}
        onMouseMove={(e) => controller.onMouseMove(e)}
        onMouseUp={(e) => controller.onMouseUp()}
      >
        <div
          style={{
            transform: `translateX(${controller.x}px) translateY(${
              toolbarOffsetTop + controller.line * customHeight
            }px)`,
            height: `${customHeight}px`,
          }}
          className={debugToolbarWrapperClass}
        >
          <div className={cls(styles.debug_toolbar_drag_wrapper)}>
            <div
              className={cls(getIcon('drag'), styles.debug_toolbar_drag)}
              onMouseDown={(e) => controller.onMouseDown(e)}
              onMouseMove={(e) => controller.onMouseMove(e)}
            ></div>
          </div>
          <DebugToolbarView float />
        </div>
      </div>
    );
  }

  controller.enable = false;
  return null;
});

export const DebugToolbarOverlayWidget = observer(() => {
  const { float } = useInjectable<DebugConfigurationService>(DebugConfigurationService);
  if (!float) {
    return null;
  }

  return <FloatDebugToolbarView />;
});
