import clx from 'classnames';
import { observer } from 'mobx-react-lite';
import React from 'react';

import { useInjectable, getIcon, localize } from '@opensumi/ide-core-browser';

import {
  ITerminalController,
  ITerminalGroupViewService,
  ITerminalSearchService,
  IWidget,
  ITerminalErrorService,
  ITerminalNetwork,
  ITerminalError,
} from '../../common';

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
  const { errors } = errorService;
  const { groups, currentGroupIndex, currentGroupId } = view;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const dispose = searchService.onOpen(() => {
      if (inputRef.current) {
        inputRef.current.focus();

        if (inputRef.current.value.length > 0) {
          inputRef.current.setSelectionRange(0, inputRef.current.value.length);
        }
      }
    });
    return () => dispose.dispose();
  }, [searchService, inputRef.current]);

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

  const searchInput = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      searchService.input = event.target.value;
      searchService.search();
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
      style={{ backgroundColor: controller.themeBackground }}
      data-group-current={currentGroupId}
    >
      {searchService.show && (
        <div className={styles.terminalSearch}>
          <div className='kt-input-box'>
            <input
              autoFocus
              ref={inputRef}
              placeholder={localize('common.find')}
              value={searchService.input}
              onChange={searchInput}
              onKeyDown={searchKeyDown}
            />
          </div>
          <div className={clx(styles.closeBtn, getIcon('close'))} onClick={() => searchService.close()}></div>
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
