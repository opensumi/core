import * as React from 'react';
import clx from 'classnames';

import * as styles from './styles.module.less';
import { getIcon } from '../../icon';

const Icon: React.FC<{
  title?: string;
  icon?: string;
  iconClass?: string;
  size?: 'small' | 'large';
  loading?: boolean;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
} & React.HTMLAttributes<HTMLDivElement>> = (
  { size = 'middle', loading, icon, iconClass, className, ...restProps },
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
