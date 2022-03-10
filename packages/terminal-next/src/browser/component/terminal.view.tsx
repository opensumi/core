import { observer } from 'mobx-react-lite';
import React from 'react';

import { useInjectable, getIcon } from '@opensumi/ide-core-browser';

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
  const search = useInjectable<ITerminalSearchService>(ITerminalSearchService);
  const errorService = useInjectable<ITerminalErrorService>(ITerminalErrorService);
  const network = useInjectable<ITerminalNetwork>(ITerminalNetwork);
  const { errors } = errorService;
  const { groups, currentGroupIndex, currentGroupId } = view;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const wrapperRef: React.RefObject<HTMLDivElement> = React.createRef();

  search.onOpen(() => {
    if (inputRef.current) {
      inputRef.current.focus();

      if (inputRef.current.value.length > 0) {
        inputRef.current.setSelectionRange(0, inputRef.current.value.length);
      }
    }
  });

  const renderWidget = (widget: IWidget, index: number) => {
    const client = controller.findClientFromWidgetId(widget.id);
    let error: ITerminalError | undefined;
    if (client) {
      error = !network.shouldReconnect(client.id) ? errors.get(client.id) : undefined;
    } else {
      error = errors.get(widget.id);
    }
    return <TerminalWidget show={currentGroupIndex === index} error={error} widget={widget} />;
  };

  const searchInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    search.input = event.target.value;
  };

  const searchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      search.search();
    }

    if (event.key === 'Escape') {
      search.close();
      search.clear();
    }
  };

  const searchClose = () => {
    search.close();
  };

  React.useEffect(() => {
    if (wrapperRef.current) {
      controller.initContextKey(wrapperRef.current);
    }
  }, [wrapperRef.current]);

  return (
    <div
      ref={wrapperRef}
      className={styles.terminalWrapper}
      style={{ backgroundColor: controller.themeBackground }}
      data-group-current={currentGroupId}
    >
      {search.show && (
        <div className={styles.terminalSearch}>
          <input
            autoFocus
            ref={inputRef}
            placeholder='查找'
            value={search.input}
            onChange={(event) => searchInput(event)}
            onKeyDown={(event) => searchKeyDown(event)}
          />
          <div className={getIcon('close')} onClick={() => searchClose()}></div>
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
