import * as React from 'react';
import * as clx from 'classnames';
import { useInjectable, localize, getIcon } from '@ali/ide-core-browser';
import { ITerminalGroupViewService, IWidget, ITerminalError, ITerminalErrorService } from '../../common';

import * as styles from './terminal.module.less';

export interface IProps {
  widget: IWidget;
  error: ITerminalError | undefined;
}

function renderError(error: ITerminalError, eService: ITerminalErrorService, view: ITerminalGroupViewService) {

  const onRemoveClick = () => {
    view.removeWidget(error.id);
  };

  const onRetryClick = () => {
    eService.fix(error.id);
  };

  return (
    error.stopped ?
      <div className={ styles.terminalCover }>
        <div>{ localize('terminal.disconnected') }</div>
        <div>
          { localize('terminal.can.not.reconnect') }
          <a onClick={ onRetryClick }>{ localize('terminal.try.reconnect') }</a>
        </div>
      </div>
      :
      <div className={ styles.terminalCover }>
        <div>{ localize('terminal.disconnected') }</div>
        <div>
          <a onClick={ onRemoveClick }>{ localize('terminal.stop') }</a>
          { localize('terminal.or') }
          <a onClick={ onRetryClick }>{ localize('terminal.try.reconnect') }</a>
        </div>
      </div>
  );
}

export default ({ widget, error }: IProps) => {
  const content = React.createRef<HTMLDivElement>();
  const errorService = useInjectable<ITerminalErrorService>(ITerminalErrorService);
  const view = useInjectable<ITerminalGroupViewService>(ITerminalGroupViewService);

  React.useEffect(() => {
    if (content.current) {
      widget.element = content.current;
    }
  }, []);

  const onFocus = () => {
    view.selectWidget(widget.id);
  };

  return (
    <div className={ styles.terminalContainer }>
      {
        error ? renderError(error, errorService, view) : null
      }
      <div
        className={ clx({
          [getIcon('close')]: true,
          [styles.terimnalClose]: true,
        }) }
        onClick={ () => {
          view.removeWidget(widget.id);
        } }
      ></div>
      <div
        data-term-id={ widget.id }
        style={ { display: error ? 'none' : 'block' } }
        className={ styles.terminalContent }
        onFocus={ onFocus }
        ref={ content }
      >
      </div>
    </div>
  );
};
