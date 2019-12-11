import * as React from 'react';
import clx from 'classnames';

import { getIcon, defaultIconMap } from '../../style/icon/icon';
import * as styles from './styles.module.less';

const Icon: React.FC<{
  title?: string;
  icon?: keyof typeof defaultIconMap;
  iconClass?: string;
  tooltip?: string;
  size?: 'small' | 'large';
  loading?: boolean;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
} & React.HTMLAttributes<HTMLDivElement>> = (
  { size = 'middle', loading, icon, iconClass, className, tooltip, ...restProps },
) => {
  const iconClx = icon ? getIcon(icon) : iconClass;
  return <span
    {...restProps}
    title={tooltip}
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

Icon.displayName = 'Icon';

export default Icon;
