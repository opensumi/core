import clx from 'classnames';
import React from 'react';

import './styles.less';

export const Badge: React.FC<{} & React.HTMLAttributes<HTMLSpanElement>> = ({ className, children, ...restProps }) => (
  <span className={clx('kt-badge', className)} {...restProps}>
    {children}
  </span>
);
