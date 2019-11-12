import * as React from 'react';
import * as styles from './resize.module.less';
import { IWidget } from '../../common/resize';

export interface IResizeDelegateProps {
  start: () => void;
  stop: () => void;
  left: IWidget | null;
  self: IWidget;
  right: IWidget | null;
}

export default (props: IResizeDelegateProps) => {

  const { start, stop } = props;

  const onMouseDown = () => {
    start();
  };

  const onMouseUp = () => {
    stop();
  };

  const onMouseMove = () => {

  };

  return (
    <div
      className={ styles.resizeDelegetContainer }
      onMouseUp={ onMouseUp }
      onMouseMove= { onMouseMove }
    >
      <div
        className={ styles.resizeDelegateBar }
        onMouseDown={ onMouseDown }
      ></div>
    </div>
  );
};
