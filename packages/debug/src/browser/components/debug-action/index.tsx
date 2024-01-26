import React from 'react';

import { getIcon } from '@opensumi/ide-core-browser';
import { clx } from '@opensumi/ide-utils/lib/clx';

import styles from './index.module.less';

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
  return (
    <div
      {...restProps}
      className={clx(
        styles.debug_action,
        styles[icon],
        getIcon(icon) || icon,
        typeof enabled === 'boolean' && !enabled && styles.mod_disabled,
        className,
      )}
      title={label}
      onClick={run || noop}
    ></div>
  );
};
