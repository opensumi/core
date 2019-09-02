import * as React from 'react';
import * as styles from './debug-action.module.less';
import * as cls from 'classnames';

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
  const iconPrefix = 'kaitian-debug-action-';
  const tabindexProp = {
    tabIndex: 0,
  };
  const noop = () => {};
  return <div {...tabindexProp} className={cls(styles.debug_action, `${iconPrefix}${icon}`, typeof enabled === 'boolean' && !enabled && styles.mod_disabled)} title={ label } onClick={ run || noop }></div>;
};
