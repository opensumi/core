import React from 'react';
import styles from './index.module.less';
import cls from 'classnames';
import { getIcon } from '@opensumi/ide-core-browser';

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
  className,
  ...restProps
}: DebugActionProps & React.HtmlHTMLAttributes<HTMLDivElement>) => {
  const noop = () => {};
  return <div {...restProps} className={cls(styles.debug_action, styles[icon], getIcon(icon) || icon, typeof enabled === 'boolean' && !enabled && styles.mod_disabled, className)} title={ label } onClick={ run || noop }></div>;
};
