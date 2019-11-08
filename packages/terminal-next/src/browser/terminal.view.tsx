import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import { ITerminalController, IWidget } from '../common';
import TerminalWidget from './terminal.widget';

import 'xterm/css/xterm.css';
import * as styles from './terminal.module.less';

export interface IResizeDelegateProps {
  left: IWidget | null;
  self: IWidget | null;
  right: IWidget | null;
  flex: number;
  step: number;
  setEvent: (e: boolean) => void;
}

let startX = 0;
let wholeWidth = Infinity;
let original: IWidget | null = null;

export const ResizeDelegate = (props: IResizeDelegateProps) => {
  const onMouseDown = (event: React.MouseEvent) => {
    const { self } = props;
    startX = event.clientX;
    original = self;
    props.setEvent(true);
  };

  const onMouseMove = (event: React.MouseEvent) => {
    if (!startX) {
      return false;
    }

    const endX = event.clientX;
    const { left, right, self } = props;

    const move = (endX - startX) / wholeWidth;
    startX = endX;

    if (move < 0) {
      self && self.resize(move);
      right && right.resize(-move);
    } else {
      if (original) {
        if (original === left) {
          self && self.resize(-move);
          left && left.resize(move);
        }
      }
    }
  };

  const onMouseUp = () => {
    startX = 0;
    original = null;
    props.setEvent(false);
  };

  return (
    <div
      style={ {
        flex: props.flex,
      } }
      className={ styles.resizeDelegateContainer }
      onMouseMove={ onMouseMove }
      onMouseUp={ onMouseUp }
    >
      <div
        className={ styles.resizeDelegate }
        onMouseDown={ onMouseDown }
        onMouseUp={ onMouseUp }
      ></div>
    </div>
  );
};

export default observer(() => {
  const [event, setEvent] = React.useState(false);

  const controller = useInjectable<ITerminalController>(ITerminalController);
  const { groups, state } = controller;

  React.useEffect(() => {
    controller.firstInitialize();
  }, []);

  return (
    <div className={ styles.widgetPanel } ref={ (ref) => wholeWidth = (ref && ref.clientWidth) || Infinity }>
      <div
        style={ {
          pointerEvents: !event ? 'all' : 'none',
        } }
        className={ styles.widgetGroups }
      >
        {
          groups
            .filter((_, order) => order === state.index)
            .map((group) => {
              return group.members.map((widget) => {
                return <TerminalWidget widget={ widget } id={ widget.id } flex={ widget.styles.flex } />;
              });
            })
        }
      </div>
      <div
        style={ {
          pointerEvents: event ? 'all' : 'none',
        } }
        className={ styles.widgetResizeGroups }
      >
        {
          groups
            .filter((_, order) => order === state.index)
            .map((group) => {
              return group.members.map((widget, count) => {
                const left = count - 1 > -1 ? group.members[count - 1] : null;
                const self = group.members[count];
                const right = count + 1 < group.members.length ? group.members[count + 1] : null;
                return <ResizeDelegate setEvent={ setEvent } flex={ widget.styles.flex } left={ left } self={ self } right={ right } step={ 0.001 } />;
              });
            })
        }
      </div>
    </div>
  );
});
