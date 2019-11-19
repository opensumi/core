import * as React from 'react';
import * as styles from './terminal.module.less';
import { useInjectable } from '@ali/ide-core-browser';
import { ITerminalController, IWidget, ITerminalError } from '../common';

export interface IProps {
  id: string;
  dynamic: number;
  widget: IWidget;
  errors: Map<string, ITerminalError>;
}

export default ({ id, dynamic, errors }: IProps) => {
  const content = React.createRef<HTMLDivElement>();
  const controller = useInjectable<ITerminalController>(ITerminalController);

  React.useEffect(() => {
    if (content.current) {
      controller.drawTerminalClient(content.current, id);
    }
    return () => {
      controller.eraseTerminalClient(id);
    };
  }, [id]);

  React.useEffect(() => {
    controller.layoutTerminalClient(id);
  }, [dynamic]);

  const onFocus = () => {
    controller.focusWidget(id);
  };

  const onRemoveClick = () => {
    controller.removeWidget(id);
  };

  const onRetryClick = () => {
    if (content.current) {
      controller.drawTerminalClient(content.current, id, true);
    }
  };

  return (
    <div className={ styles.terminalContainer }>
      <div data-term-id={ id } onFocus={ onFocus } className={ styles.terminalContent } ref={ content }></div>
      {
        errors.has(id) ?
          <div onClick={ onRemoveClick } className={ styles.terminalCover }>
            终端已断开连接，是否<a onClick={ onRemoveClick }>删除终端</a>，或者<a onClick={ onRetryClick }>尝试重连</a>
          </div> : null
      }
    </div>
  );
};
