import debounce from 'lodash/debounce';
import React from 'react';

import { FRAME_THREE, useAutorun, useEventEffect, useInjectable } from '@opensumi/ide-core-browser';

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
import { TerminalSearch } from './search.view';
import styles from './terminal.module.less';
import TerminalWidget from './terminal.widget';

import '@xterm/xterm/css/xterm.css';

export default () => {
  const controller = useInjectable<ITerminalController>(ITerminalController);
  const searchService = useInjectable<ITerminalSearchService>(ITerminalSearchService);
  const errorService = useInjectable<ITerminalErrorService>(ITerminalErrorService);
  const network = useInjectable<ITerminalNetwork>(ITerminalNetwork);

  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  const view = useInjectable<ITerminalGroupViewService>(ITerminalGroupViewService);
  const currentGroupId = useAutorun(view.currentGroupId);
  const currentGroupIndex = useAutorun(view.currentGroupIndex);
  const groups = useAutorun(view.groups);

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
      {isVisible && <TerminalSearch />}
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
