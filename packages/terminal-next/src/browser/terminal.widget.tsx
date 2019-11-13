import * as React from 'react';
import * as styles from './terminal.module.less';
import { useInjectable } from '@ali/ide-core-browser';
import { ITerminalController, IWidget } from '../common';

export interface IProps {
  id: string;
  dynamic: number;
  widget: IWidget;
}

export default ({ widget, id, dynamic }: IProps) => {
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
    controller.focusWidget(widget.id);
  };

  return (
    <div data-term-id={ id } onFocus={ onFocus } className={ styles.terminalContent } ref={ content }></div>
  );
};
