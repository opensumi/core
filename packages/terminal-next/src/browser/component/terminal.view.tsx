import cls from 'classnames';
import debounce from 'lodash/debounce';
import React from 'react';

import { FRAME_THREE, getIcon, localize, useAutorun, useEventEffect, useInjectable } from '@opensumi/ide-core-browser';

import {
  ITerminalController,
  ITerminalError,
  ITerminalErrorService,
  ITerminalGroupViewService,
  ITerminalNetwork,
  ITerminalSearchService,
  IWidget,
} from '../../common';

import ResizeView, { ResizeDirection } from './resize.view';
import styles from './terminal.module.less';
import TerminalWidget from './terminal.widget';

import '@xterm/xterm/css/xterm.css';

export default () => {
  const controller = useInjectable<ITerminalController>(ITerminalController);
  const searchService = useInjectable<ITerminalSearchService>(ITerminalSearchService);
  const errorService = useInjectable<ITerminalErrorService>(ITerminalErrorService);
  const network = useInjectable<ITerminalNetwork>(ITerminalNetwork);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  const view = useInjectable<ITerminalGroupViewService>(ITerminalGroupViewService);
  const currentGroupId = useAutorun(view.currentGroupId);
  const currentGroupIndex = useAutorun(view.currentGroupIndex);
  const groups = useAutorun(view.groups);

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
  }, FRAME_THREE);
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
      {groups.map((group, index) => {
        if (!group.activated.get()) {
          return;
        }
        return (
          <div
            data-group-rendered={group.activated.get()}
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
};
