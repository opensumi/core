import * as React from 'react';
import clsx from 'clsx';

import Icon from '../icon';
import { getIcon } from '../../icon';

import './styles.less';

export const Button: React.FC<
  {
    block?: boolean;
    loading?: boolean;
    type?: 'primary' | 'secondary' | 'danger';
  } & React.HTMLAttributes<HTMLDivElement>
> = ({ type = 'primary', loading, block, className, children, ...restProps }) => (
    <div
      className={clsx(
        'kt-btn',
        className,
        {
          'kt-btn-block': block,
          [`kt-btn-${type}`]: type,
          'kt-btn-loading': loading,
        },
      )}
      {...restProps}>
      {loading && <Icon loading iconClass={getIcon('reload')} />}
      <span>{children}</span>
    </div>
  );
