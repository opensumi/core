import * as React from 'react';
import * as styles from './debug-action.module.less';
import * as cls from 'classnames';
import { getIcon } from '@ali/ide-core-browser/lib/icon';

export interface DebugActionProps {
  icon: string;
  label: string;
  run?: () => any;
  enabled?: boolean;
}

export const DebugAction = ({
  icon,
  label,
  run,
  enabled,
}: DebugActionProps) => {
  const noop = () => {};
  return <div className={cls(styles.debug_action, `${getIcon(icon)}`, typeof enabled === 'boolean' && !enabled && styles.mod_disabled)} title={ label } onClick={ run || noop }></div>;
};
