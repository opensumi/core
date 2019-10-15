import * as React from 'react';
import * as styles from './debug-action.module.less';
import * as cls from 'classnames';
import { getIcon } from '@ali/ide-core-browser/lib/icon';

export interface DebugActionProps {
  icon: string;
  label: string;
  run?: () => any;
  enabled?: boolean;
  color?: string;
}

export const DebugAction = ({
  icon,
  label,
  run,
  enabled,
  color,
}: DebugActionProps) => {
  const noop = () => {};
  const style = {
    color,
  };
  return <div className={cls(styles.debug_action, `${getIcon(icon)}`, typeof enabled === 'boolean' && !enabled && styles.mod_disabled)} style={style} title={ label } onClick={ run || noop }></div>;
};
