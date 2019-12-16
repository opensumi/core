import * as React from 'react';
import * as styles from './terminal.module.less';
import { useInjectable, localize } from '@ali/ide-core-browser';
import { ITerminalController, IWidget, ITerminalError } from '../common';

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

  React.useEffect(() => {
    if (content.current) {
      controller.drawTerminalClient(content.current, id)
        .then(() => {
          controller.layoutTerminalClient(id);
        });
    }
  }, []);

  React.useEffect(() => {
    if (show) {
      controller.showTerminalClient(id);
    }
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
    <div className={ styles.terminalContainer }>
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
