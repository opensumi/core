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
  const { groups, state } = controller;

  const renderWidget = (widget: IWidget) => {
    return (
      <TerminalWidget errors={ controller.errors } dynamic={ widget.shadowDynamic } id={ widget.id } widget={ widget } />
    );
  };

  React.useEffect(() => {
    store.restore()
      .then(() => {
        controller.firstInitialize();
      });
  }, []);

  return (
    <div className={ styles.terminalWrapper }>
      {
        groups
          .filter((_, order) => order === state.index)
          .map((group) => {
            return (
              <ResizeView
                shadow={ false }
                useFlex={ false }
                direction={ ResizeDirection.horizontal }
                group={ group }
                draw={ (widget: IWidget) => renderWidget(widget) }
              />
            );
          })
      }
    </div>
  );
});
