import * as React from 'react';
import * as styles from './status-bar.module.less';
import { StatusBarEntry } from './status-bar.service';
import { parseLabel, LabelPart, LabelIcon } from '@ali/ide-core-browser';
import cls from 'classnames';

export default function(props: StatusBarEntry) {
  const { icon, className, text, onClick, tooltip, command, color } = props;

  let items: LabelPart[] = [];
  if (text) {
    items = parseLabel(text);
  }

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
        {}
        {icon && <span className={cls('fa', `fa-${icon}`)}></span>}
        {items.map((item, key) => {
          if (!(typeof item === 'string') && LabelIcon.is(item)) {
            return <span key={key} className={`fa fa-${item.name} ${item.animation ? 'fa-' + item.animation : ''}`}></span>;
          } else {
            return <span key={key}>{`${icon ? ' ' : ''}${item}`}</span>;
          }
        })}
      </div>
    </div >
  );
}
