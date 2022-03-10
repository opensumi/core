import React from 'react';

import { IWidget } from '../../common/resize';

import styles from './resize.module.less';

export interface IResizeDelegateProps {
  start: () => void;
  stop: () => void;
  left: IWidget | null;
  self: IWidget;
  right: IWidget | null;
  last: boolean;
  wholeWidth: number;
}

// todo: 将这些变量放到一个实例中管理
let startX = 0;
let original: IWidget | null = null;

export default (props: IResizeDelegateProps) => {
  const { start, stop, self, left, right, wholeWidth, last } = props;

  const onMouseDown = (event: React.MouseEvent) => {
    startX = event.clientX;
    original = self;
    start();
  };

  const onMouseMove = (event: React.MouseEvent) => {
    if (!startX) {
      return false;
    }

    const endX = event.clientX;
    const move = ((endX - startX) / wholeWidth) * 100;
    startX = endX;

    if (move < 0) {
      self && self.increase(move);
      right && right.increase(-move);
    } else {
      if (original) {
        if (original === left) {
          self && self.increase(-move);
          left && left.increase(move);
        }
      }
    }
  };

  const onMouseUp = (_: React.MouseEvent) => {
    startX = 0;
    original = null;
    self.resize();
    left && left.resize();
    right && right.resize();
    stop();
  };

  return (
    <div className={styles.resizeDelegetContainer} onMouseUp={onMouseUp} onMouseMove={onMouseMove}>
      {!last && <div className={styles.resizeDelegateBar} onMouseDown={onMouseDown} onMouseUp={onMouseUp}></div>}
    </div>
  );
};
