import cls from 'classnames';
import debounce from 'lodash/debounce';
import { observer } from 'mobx-react-lite';
import React from 'react';

import { CheckBox, Icon } from '@opensumi/ide-components';
import { PreferenceService, getIcon, localize, useEventEffect, useInjectable } from '@opensumi/ide-core-browser';

import {
  ITerminalController,
  ITerminalError,
  ITerminalErrorService,
  ITerminalGroupViewService,
  ITerminalNetwork,
  ITerminalSearchService,
  IWidget,
} from '../../common';
import { CodeTerminalSettingId } from '../../common/preference';
import { IntellTerminalService } from '../intell/intell-terminal.service';

import ResizeView, { ResizeDirection } from './resize.view';
import styles from './terminal.module.less';
import TerminalWidget from './terminal.widget';

import 'xterm/css/xterm.css';

export default observer(() => {
  const controller = useInjectable<ITerminalController>(ITerminalController);
  const view = useInjectable<ITerminalGroupViewService>(ITerminalGroupViewService);
  const searchService = useInjectable<ITerminalSearchService>(ITerminalSearchService);
  const errorService = useInjectable<ITerminalErrorService>(ITerminalErrorService);
  const network = useInjectable<ITerminalNetwork>(ITerminalNetwork);
  const intellService = useInjectable<IntellTerminalService>(IntellTerminalService);
  const preference = useInjectable<PreferenceService>(PreferenceService);
  const { groups, currentGroupIndex, currentGroupId } = view;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const dispose = searchService.onVisibleChange((show) => {
      if (show && inputRef.current) {
        inputRef.current.focus();

        if (inputRef.current.value.length > 0) {
          inputRef.current.setSelectionRange(0, inputRef.current.value.length);
        }
      }
    });
    return () => dispose.dispose();
  }, [searchService, inputRef.current]);

  const [themeBackground, setThemeBackground] = React.useState(controller.themeBackground);

  useEventEffect(controller.onThemeBackgroundChange, (themeBackground) => {
    setThemeBackground(themeBackground);
  });

  const [errors, setErrors] = React.useState(errorService.errors);
  const func = debounce(() => {
    setErrors(errorService.errors);
  }, 16 * 3);
  useEventEffect(errorService.onErrorsChange, func);

  const renderWidget = React.useCallback(
    (widget: IWidget, index: number) => {
      const client = controller.findClientFromWidgetId(widget.id);
      let error: ITerminalError | undefined;
      if (client) {
        error = !network.shouldReconnect(client.id) ? errors.get(client.id) : undefined;
      } else {
        error = errors.get(widget.id);
      }
      return <TerminalWidget show={currentGroupIndex === index} error={error} widget={widget} />;
    },
    [currentGroupIndex, controller, errors, network, view],
  );

  const [isVisible, setIsVisible] = React.useState(searchService.isVisible);
  useEventEffect(searchService.onVisibleChange, (visible) => {
    setIsVisible(visible);
  });

  const [intellSettingsVisible, setIntellSettingsVisible] = React.useState(false);
  useEventEffect(intellService.onIntellSettingsVisibleChange, (visible) => {
    setIntellSettingsVisible(visible);
  });

  const [enableTerminalIntell, setEnableTerminalIntell] = React.useState(
    preference.get(CodeTerminalSettingId.EnableTerminalIntellComplete, false),
  );

  const [inputText, setInputText] = React.useState('');

  const searchInput = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      searchService.text = event.target.value;
      searchService.search();
      setInputText(event.target.value);
    },
    [searchService],
  );

  const searchKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        searchService.search();
      }

      if (event.key === 'Escape') {
        searchService.close();
        searchService.clear();
      }
    },
    [searchService],
  );

  React.useEffect(() => {
    if (wrapperRef.current) {
      controller.initContextKey(wrapperRef.current);
      controller.viewReady.resolve();
    }
  }, [wrapperRef.current]);

  return (
    <div
      ref={wrapperRef}
      className={styles.terminalWrapper}
      style={{ backgroundColor: themeBackground }}
      data-group-current={currentGroupId}
    >
      {isVisible && (
        <div className={styles.terminalSearch}>
          <div className='kt-input-box'>
            <input
              autoFocus
              ref={inputRef}
              placeholder={localize('common.find')}
              value={inputText}
              onChange={searchInput}
              onKeyDown={searchKeyDown}
            />
          </div>
          <div className={cls(styles.closeBtn, getIcon('close'))} onClick={() => searchService.close()}></div>
        </div>
      )}
      {intellSettingsVisible && (
        <div className={styles.terminalIntell}>
          <div className={styles.intellTitleContainer}>
            <Icon icon={'magic-wand'} className={styles.intellTitleIcon} />
            <div className={styles.intellTitle}>终端智能补全</div>
            <div
              className={cls(styles.closeBtn, getIcon('close'))}
              onClick={() => intellService.closeIntellSettingsPopup()}
            ></div>
          </div>
          <div className={styles.intellSampleImage} />
          <div className={styles.intellCheckContainer}>
            <CheckBox
              checked={enableTerminalIntell}
              onChange={(event) => {
                const checked = (event.target as HTMLInputElement).checked;
                setEnableTerminalIntell(checked);
                preference.set(CodeTerminalSettingId.EnableTerminalIntellComplete, checked);
              }}
            />
            <div className={styles.intellDesc}>终端输入时，自动弹出弹出子命令、选项和上下文相关的参数的补全</div>
          </div>
        </div>
      )}
      {groups.map((group, index) => {
        if (!group.activated) {
          return;
        }
        return (
          <div
            data-group-rendered={group.activated}
            key={`terminal-${group.id}`}
            style={{ display: currentGroupIndex === index ? 'block' : 'none' }}
            className={styles.group}
            onFocus={controller.focus.bind(controller)}
            onBlur={controller.blur.bind(controller)}
            onContextMenu={controller.onContextMenu.bind(controller)}
          >
            <ResizeView
              shadow={false}
              useFlex={false}
              direction={ResizeDirection.horizontal}
              group={group}
              draw={(widget: IWidget) => renderWidget(widget, index)}
            />
          </div>
        );
      })}
    </div>
  );
});
