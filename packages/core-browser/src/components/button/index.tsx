import * as React from 'react';
import * as clsx from 'classnames';

import Icon from '../icon';
import { getIcon } from '../../style/icon/icon';

import './styles.less';

export const Button: React.FC<
  {
    block?: boolean;
    loading?: boolean;
    ghost?: boolean;
    type?: 'primary' | 'secondary' | 'danger';
  } & React.HTMLAttributes<HTMLDivElement>
> = function Button({ type = 'primary', loading, block, ghost, className, children, ...restProps }) {
  return (
    <div
      className={clsx(
        'kt-btn',
        className,
        {
          'kt-btn-block': block,
          [`kt-btn-${type}`]: type,
          'kt-btn-loading': loading,
          'kt-btn-ghost': ghost,
        },
      )}
      {...restProps}>
      {loading && <Icon loading iconClass={getIcon('reload')} />}
      <span>{children}</span>
    </div>
  );
};
