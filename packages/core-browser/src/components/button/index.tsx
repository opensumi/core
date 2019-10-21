import * as React from 'react';
import clsx from 'clsx';

import './styles.less';

export const Button: React.FC<
  {
    block?: boolean;
    type?: 'primary' | 'secondary' | 'danger';
  } & React.HTMLAttributes<HTMLDivElement>
> = ({ type = 'primary', block, className, children, ...restProps }) => (
    <div
      className={clsx('kt-btn', className, { 'kt-btn-block': block, [`kt-btn-${type}`]: type })}
      {...restProps}>
      {children}
    </div>
  );
