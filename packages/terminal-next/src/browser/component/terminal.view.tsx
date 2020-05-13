import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, getIcon } from '@ali/ide-core-browser';
import ResizeView, { ResizeDirection } from './resize.view';
import { ITerminalController, ITerminalGroupViewService, ITerminalSearchService, IWidget, ITerminalErrorService } from '../../common';
import TerminalWidget from './terminal.widget';

import 'xterm/css/xterm.css';
import * as styles from './terminal.module.less';

export default observer(() => {
  const controller = useInjectable<ITerminalController>(ITerminalController);
  const view = useInjectable<ITerminalGroupViewService>(ITerminalGroupViewService);
  const search = useInjectable<ITerminalSearchService>(ITerminalSearchService);
  const errorService = useInjectable<ITerminalErrorService>(ITerminalErrorService);
  const { errors } = errorService;
  const { groups, currentGroupIndex, currentGroupId } = view;

  const renderWidget = (widget: IWidget) => {
    const client = controller.findClientFromWidgetId(widget.id);
    const error = client && errors.get(client.id);
    return (
      <TerminalWidget error={ error } widget={ widget } />
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
      onFocus={ () => controller.focus() }
      onBlur={ () => controller.blur() }
      className={ styles.terminalWrapper }
      style={ { backgroundColor: controller.themeBackground } }
      data-group-current={ currentGroupId }
    >
      {
        search.show && <div className={ styles.terminalSearch }>
          <input
            autoFocus
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
              >
                <ResizeView
                  shadow={ false }
                  useFlex={ false }
                  direction={ ResizeDirection.horizontal }
                  group={ group }
                  draw={ (widget: IWidget) => renderWidget(widget) }
                />
              </div>);
          })
      }
    </div>
  );
});
