import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, getIcon } from '@ali/ide-core-browser';
import ResizeView, { ResizeDirection } from './component/resize.view';
import { ITerminalController, IWidget } from '../common';
import TerminalWidget from './terminal.widget';

import 'xterm/css/xterm.css';
import * as styles from './terminal.module.less';

export default observer(() => {
  const controller = useInjectable<ITerminalController>(ITerminalController);
  const { groups, state, errors, themeBackground } = controller;

  const renderWidget = (widget: IWidget, show: boolean) => {
    const error = errors.get(widget.id);
    return (
      <TerminalWidget error={ error } dynamic={ widget.shadowDynamic } show={ show } id={ widget.id } widget={ widget } />
    );
  };

  const searchInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    controller.searchState.input = event.target.value;
  };

  const searchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      controller.search();
    }

    if (event.key === 'Escape') {
      controller.closeSearchInput();
      controller.clearSearchInput();
    }
  };

  const searchClose = () => {
    controller.closeSearchInput();
  };

  return (
    <div
      onFocus={ () => controller.focus() }
      onBlur={ () => controller.blur() }
      className={ styles.terminalWrapper }
      style={ { backgroundColor: themeBackground } }
    >
      {
        controller.searchState.show && <div className={ styles.terminalSearch }>
          <input
            autoFocus
            placeholder='查找'
            value={ controller.searchState.input }
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
            return (
              <div
                key={ `terminal-group-${groups.length}-${group.length}-${index}` }
                style={ { display: state.index === index ? 'block' : 'none' } }
                className={ styles.group }
              >
                <ResizeView
                  shadow={ false }
                  useFlex={ false }
                  direction={ ResizeDirection.horizontal }
                  group={ group }
                  draw={ (widget: IWidget) => renderWidget(widget, state.index === index) }
                />
              </div>
            );
          })
      }
    </div>
  );
});
