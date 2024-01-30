import cls from 'classnames';
import React from 'react';

import './styles.less';

export const Badge: React.FC<{} & React.HTMLAttributes<HTMLSpanElement>> = ({ className, children, ...restProps }) => (
  <span className={cls('kt-badge', className)} {...restProps}>
    {children}
  </span>
);
