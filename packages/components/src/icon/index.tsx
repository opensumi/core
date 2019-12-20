import * as React from 'react';
import clx from 'classnames';

import { getIcon } from '@ali/ide-core-browser';
import * as styles from './style.module.less';

const Icon: React.FC<{
  title?: string;
  icon?: string;
  iconClass?: string;
  size?: 'small' | 'large';
  loading?: boolean;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
} & React.HTMLAttributes<HTMLDivElement>> = (
  { size = 'small', loading, icon, iconClass, className, ...restProps },
) => {
  const iconClx = icon ? getIcon(icon) : iconClass;
  return <span
    {...restProps}
    className={clx(
      styles.icon,
      iconClx,
      className,
      {
        [styles.loading]: loading,
        [styles[size]]: !!size,
      },
    )}
    />;
};

export default Icon;
