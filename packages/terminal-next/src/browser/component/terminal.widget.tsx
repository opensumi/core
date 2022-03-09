import React from 'react';

import { useInjectable, localize } from '@opensumi/ide-core-browser';

import {
  ITerminalGroupViewService,
  IWidget,
  ITerminalError,
  ITerminalErrorService,
  ETerminalErrorType,
} from '../../common';

import styles from './terminal.module.less';

export interface IProps {
  widget: IWidget;
  show: boolean;
  error: ITerminalError | undefined;
}

function renderError(error: ITerminalError, eService: ITerminalErrorService, view: ITerminalGroupViewService) {
  const onRemoveClick = () => {
    view.removeWidget(error.id);
  };

  const onRetryClick = () => {
    eService.fix(error.id);
  };

  if (error?.type === ETerminalErrorType.CREATE_FAIL) {
    return (
      <div className={styles.terminalCover}>
        <div>
          {localize('terminal.can.not.create')}: {error.message}
        </div>
        <div>
          <a onClick={onRemoveClick}>{localize('terminal.stop')}</a>
          {localize('terminal.or')}
          <a onClick={onRetryClick}>{localize('terminal.try.recreate')}</a>
        </div>
      </div>
    );
  }

  return error.stopped ? (
    <div className={styles.terminalCover}>
      <div>{localize('terminal.disconnected')}</div>
      <div>
        {localize('terminal.can.not.reconnect')}
        <a onClick={onRetryClick}>{localize('terminal.try.reconnect')}</a>
      </div>
    </div>
  ) : (
    <div className={styles.terminalCover}>
      <div>{localize('terminal.disconnected')}</div>
      <div>
        <a onClick={onRemoveClick}>{localize('terminal.stop')}</a>
        {localize('terminal.or')}
        <a onClick={onRetryClick}>{localize('terminal.try.reconnect')}</a>
      </div>
    </div>
  );
}

export default ({ widget, error, show }: IProps) => {
  const content = React.createRef<HTMLDivElement>();
  const errorService = useInjectable<ITerminalErrorService>(ITerminalErrorService);
  const view = useInjectable<ITerminalGroupViewService>(ITerminalGroupViewService);

  React.useEffect(() => {
    if (content.current) {
      widget.element = content.current;
    }
  }, []);

  React.useEffect(() => {
    widget.show = show;
  }, [show]);

  React.useEffect(() => {
    widget.error = !!error;
  }, [error]);

  const onFocus = () => {
    view.selectWidget(widget.id);
  };

  return (
    <div className={styles.terminalContainer}>
      {error ? renderError(error, errorService, view) : null}
      <div
        data-term-id={widget.id}
        style={{ display: error ? 'none' : 'block' }}
        className={styles.terminalContent}
        onFocus={onFocus}
        ref={content}
      ></div>
    </div>
  );
};
