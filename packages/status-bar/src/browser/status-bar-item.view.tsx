import * as React from 'react';
import * as styles from './status-bar.module.less';
import { StatusBarEntry } from '@ali/ide-core-browser/lib/services';
import { parseLabel, LabelPart, LabelIcon } from '@ali/ide-core-browser';
import cls from 'classnames';
import { getOctIcon } from '@ali/ide-core-browser/lib/icon';

// todo: 移除 fa 的相关代码
export function StatusBarItem(props: StatusBarEntry) {
  const { iconClass, className, text, onClick, tooltip, command, color } = props;

  let items: LabelPart[] = [];
  if (text) {
    items = parseLabel(text);
  }
  let hasIcon = false;
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
      {[
        iconClass && <span key={-1} className={iconClass}></span>,
        items.map((item, key) => {
          if (!(typeof item === 'string') && LabelIcon.is(item)) {
            hasIcon = true;
            // TODO 支持内置的iconfont
            return <span key={key} className={cls(getOctIcon(item.name), `${item.animation ? 'fa-' + item.animation : ''}`)}></span>;
          } else {
            return <span key={key}>{item}</span>;
          }
        }),
      ]}
    </div >
  );
}
