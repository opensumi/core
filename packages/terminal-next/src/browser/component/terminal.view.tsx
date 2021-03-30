import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, getIcon } from '@ali/ide-core-browser';
import ResizeView, { ResizeDirection } from './resize.view';
import { ITerminalController, ITerminalGroupViewService, ITerminalSearchService, IWidget, ITerminalErrorService, ITerminalNetwork } from '../../common';
import TerminalWidget from './terminal.widget';

import 'xterm/css/xterm.css';
import * as styles from './terminal.module.less';

export default observer(() => {
  const controller = useInjectable<ITerminalController>(ITerminalController);
  const view = useInjectable<ITerminalGroupViewService>(ITerminalGroupViewService);
  const search = useInjectable<ITerminalSearchService>(ITerminalSearchService);
  const errorService = useInjectable<ITerminalErrorService>(ITerminalErrorService);
  const network = useInjectable<ITerminalNetwork>(ITerminalNetwork);
  const { errors } = errorService;
  const { groups, currentGroupIndex, currentGroupId } = view;
  const inputRef = React.useRef<HTMLInputElement>(null);

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
    const error = client && !network.shouldReconnect(client.id) ? errors.get(client.id) : undefined;
    return (
      <TerminalWidget show={ currentGroupIndex === index } error={ error } widget={ widget } />
    );
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

  return (
    <div
      className={ styles.terminalWrapper }
      style={ { backgroundColor: controller.themeBackground } }
      data-group-current={ currentGroupId }
    >
      {
        search.show && <div className={ styles.terminalSearch }>
          <input
            autoFocus
            ref={ inputRef }
            placeholder='查找'
            value={ search.input }
            onChange={ (event) => searchInput(event) }
            onKeyDown={ (event) => searchKeyDown(event) }
          />
          <div
            className={ getIcon('close') }
            onClick={ () => searchClose() }
          ></div>
        </div>
      }
      {
        groups
          .map((group, index) => {
            if (!group.activated) {
              return;
            }
            return (<div
              data-group-rendered={ group.activated }
              key={ `terminal-${group.id}` }
              style={ { display: currentGroupIndex === index ? 'block' : 'none' } }
              className={ styles.group }
              onFocus={ () => controller.focus() }
              onBlur={ () => controller.blur() }
            >
              <ResizeView
                shadow={ false }
                useFlex={ false }
                direction={ ResizeDirection.horizontal }
                group={ group }
                draw={ (widget: IWidget) => renderWidget(widget, index) }
              />
            </div>);
          })
      }
    </div>
  );
});
