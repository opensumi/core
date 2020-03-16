import * as React from 'react';
import clx from 'classnames';

import { getIcon, defaultIconMap } from '../../style/icon/icon';
import * as styles from './styles.module.less';

/**
 * @deprecated 推荐使用 `@ali/ide-components`
 */
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
  const iconClx = icon ? getIcon(icon as string) : iconClass;
  return <span
    {...restProps}
    title={tooltip}
    className={clx(
      styles.icon,
      iconClx,
      className,
      {
        [styles.loading]: loading,
        // css modules
        [size === 'small' ? styles.small : styles.large]: !!size,
      },
    )}
    />;
};

Icon.displayName = 'Icon';

export default Icon;
