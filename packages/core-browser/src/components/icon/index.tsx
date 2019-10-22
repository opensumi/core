import * as React from 'react';
import clx from 'classnames';

import * as styles from './styles.module.less';

const Icon: React.FC<{
  title?: string;
  iconClass?: string;
  loading?: boolean;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
} & React.HTMLAttributes<HTMLDivElement>> = ({ loading, iconClass, className, ...restProps }) => {
  return <span {...restProps} className={clx(styles.icon, iconClass, className, { [styles.loading]: loading })} />;
};

export default Icon;
