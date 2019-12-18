import * as React from 'react';
import * as clx from 'classnames';
import { useInjectable, localize, getIcon } from '@ali/ide-core-browser';
import { ITerminalController, IWidget, ITerminalError } from '../common';

import * as styles from './terminal.module.less';
import { TerminalContextMenuService } from './terminal.menu';

export interface IProps {
  id: string;
  dynamic: number;
  widget: IWidget;
  show: boolean;
  error: ITerminalError | undefined;
}

export default ({ id, dynamic, error, show }: IProps) => {
  const content = React.createRef<HTMLDivElement>();
  const controller = useInjectable<ITerminalController>(ITerminalController);
  const menuService = useInjectable<TerminalContextMenuService>(TerminalContextMenuService);

  React.useEffect(() => {
    if (content.current) {
      controller.drawTerminalClient(content.current, id)
        .then(() => {
          controller.layoutTerminalClient(id);
        });
    }
  }, []);

  React.useEffect(() => {
    controller.layoutTerminalClient(id);
  }, [dynamic, show, error]);

  const onFocus = () => {
    controller.focusWidget(id);
  };

  const onRemoveClick = () => {
    controller.removeWidget(id);
  };

  const onRetryClick = () => {
    controller.retryTerminalClient(id);
  };

  return (
    <div className={ styles.terminalContainer } onContextMenu={ (event) => menuService.onContextMenu(event) }>
      {
        error ?
          <div className={ styles.terminalCover }>
            <div>{ localize('terminal.disconnected') }</div>
            <div>
              <a onClick={ onRemoveClick }>{ localize('terminal.stop') }</a>
              { localize('terminal.or') }
              <a onClick={ onRetryClick }>{ localize('terminal.try.reconnect') }</a>
            </div>
          </div> : null
      }
      <div
        className={ clx({
          [getIcon('close')]: true,
          [styles.terimnalClose]: true,
        }) }
        onClick={ () => {
          controller.focusWidget(id);
          controller.removeFocused();
        } }
      ></div>
      <div
        data-term-id={ id }
        style={ { display: error ? 'none' : 'block' } }
        className={ styles.terminalContent }
        onFocus={ onFocus }
        ref={ content }
      >
      </div>
    </div>
  );
};
