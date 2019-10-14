import * as React from 'react';
import clsx from 'clsx';

import './styles.less';

const Button: React.FC<
  {
    block?: boolean;
  } & React.HTMLAttributes<HTMLDivElement>
> = ({ block, className, children, ...restProps }) => (
    <div className={clsx('kt-btn', className, { 'kt-btn-block': block })} {...restProps}>
      {children}
    </div>
  );

export default Button;
