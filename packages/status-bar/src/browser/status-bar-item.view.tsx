import * as React from 'react';
import * as styles from './status-bar.module.less';
import { StatusBarEntry } from '@ali/ide-core-browser/lib/services';
import { parseLabel, LabelPart, LabelIcon, replaceLocalizePlaceholder } from '@ali/ide-core-browser';
import cls from 'classnames';
import { getExternalIcon } from '@ali/ide-core-browser';

// todo: 移除 fa 的相关代码
export function StatusBarItem(props: StatusBarEntry) {
  const { iconClass, className, text, onClick, tooltip, command, color, ariaLabel, role = 'button' } = props;

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
      aria-label={ariaLabel}
    >
      {iconClass && <span key={-1} className={cls(styles.icon, iconClass)}></span>}
      {items.map((item, key) => {
        if (!(typeof item === 'string') && LabelIcon.is(item)) {
          hasIcon = true;
          // TODO 支持内置的iconfont
          return <span key={key} className={cls(styles.icon, getExternalIcon(item.name), `${item.animation ? 'iconfont-anim-' + item.animation : ''}`)}></span>;
        } else {
          // 22px高度限制用于解决文本超长时文本折叠问题
          return <span style={{marginLeft: iconClass || hasIcon ? '2px' : 0, height: '22px', lineHeight: '22px' }} key={key} aria-label={ariaLabel} role={role}>{replaceLocalizePlaceholder(item)}</span>;
        }
      })}
    </div>
  );
}
