import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import ResizeView, { ResizeDirection } from './component/resize.view';
import { ITerminalController, IWidget, ITerminalRestore } from '../common';
import TerminalWidget from './terminal.widget';

import 'xterm/css/xterm.css';
import * as styles from './terminal.module.less';

export default observer(() => {
  const controller = useInjectable<ITerminalController>(ITerminalController);
  const store = useInjectable<ITerminalRestore>(ITerminalRestore);
  const { groups, state, errors, themeBackground } = controller;

  const renderWidget = (widget: IWidget, show: boolean) => {
    const error = errors.get(widget.id);
    return (
      <TerminalWidget error={ error } dynamic={ widget.shadowDynamic } show={ show } id={ widget.id } widget={ widget } />
    );
  };

  React.useEffect(() => {
    store.restore()
      .then(() => {
        controller.firstInitialize();
      });
  }, []);

  return (
    <div className={ styles.terminalWrapper } style={{backgroundColor: themeBackground}}>
      {
        groups
          .map((group, index) => {
            return (
              <div
                key={ `terminal-group-${group.length}-${index}` }
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
