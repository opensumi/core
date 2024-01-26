import React from 'react';

import { clxx } from '@opensumi/ide-utils/lib/clx';

import './styles.less';

export const Badge: React.FC<{} & React.HTMLAttributes<HTMLSpanElement>> = ({ className, children, ...restProps }) => (
  <span className={clxx('kt-badge', className)} {...restProps}>
    {children}
  </span>
);
