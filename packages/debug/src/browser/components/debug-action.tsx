import * as React from 'react';
import * as styles from './debug-action.module.less';
import * as cls from 'classnames';
import { getIcon } from '@ali/ide-core-browser';

export interface DebugActionProps {
  icon: string;
  label: string;
  run?: () => any;
  enabled?: boolean;
  color?: string;
  className?: string;
}

export const DebugAction = ({
  icon,
  label,
  run,
  enabled,
  color,
  className,
}: DebugActionProps) => {
  const noop = () => {};
  const style = {
    color,
  };
  return <div className={cls(styles.debug_action, styles[icon] ? styles[icon] : getIcon(icon), typeof enabled === 'boolean' && !enabled && styles.mod_disabled, className)} style={style} title={ label } onClick={ run || noop }></div>;
};
