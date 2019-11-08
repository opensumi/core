import * as React from 'react';
import * as styles from './terminal.module.less';
import { useInjectable } from '@ali/ide-core-browser';
import { ITerminalController, IWidget } from '../common';

export interface IProps {
  flex: number;
  id: string;
  widget: IWidget;
}

export default ({ flex, widget, id }: IProps) => {
  const content = React.createRef<HTMLDivElement>();
  const controller = useInjectable<ITerminalController>(ITerminalController);

  React.useEffect(() => {
    widget.draw(content.current);

    return () => {
      widget.erase();
    };
  }, [id]);

  const onFocus = () => {
    controller.focus(widget);
  };

  return (
    <div onFocus={ onFocus } style={ { flex } } className={ styles.widgetContainer }>
      <div data-term-id={ id } className={ styles.widgetContent } ref={ content }></div>
    </div>
  );
};
