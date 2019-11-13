import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import ResizeView, { ResizeDirection } from './component/resize.view';
import { ITerminalController, IWidget } from '../common';
import TerminalWidget from './terminal.widget';

import 'xterm/css/xterm.css';
import * as styles from './terminal.module.less';

export default observer(() => {
  const controller = useInjectable<ITerminalController>(ITerminalController);
  const { groups, state } = controller;

  React.useEffect(() => {
    controller.firstInitialize();
  }, []);

  const renderWidget = (widget: IWidget) => {
    return (
      <TerminalWidget dynamic={ widget.shadowDynamic } id={ widget.id } widget={ widget } />
    );
  };

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
