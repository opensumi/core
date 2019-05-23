import * as React from 'react';
import * as styles from './status-bar.module.less';
import { StatusBarEntry } from './status-bar.service';
import cls from 'classnames';

export default function(props: StatusBarEntry) {
  const { icon, className, text, onClick, tooltip, command, color } = props;

  return (
    <div
      className={cls(styles.element, className, {
        [styles.hasCommand]: command || onClick,
      })}
      title={tooltip}
      onClick={onClick}
      style={{
        color,
      }}
>
      <div>
        <span className={cls('fa', `fa-${icon}`)}></span>
        <span> {text}</span>
      </div>
    </div >
  );
}
