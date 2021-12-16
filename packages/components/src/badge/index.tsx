import React from 'react';
import clx from 'classnames';

import './styles.less';

// eslint-disable-next-line @typescript-eslint/ban-types
export const Badge: React.FC<{} & React.HTMLAttributes<HTMLSpanElement>> = ({ className, children, ...restProps }) => (
  <span className={clx('kt-badge', className)} {...restProps}>
    {children}
  </span>
);
