import * as React from 'react';
import clx from 'classnames';

import * as styles from './styles.module.less';

const Icon: React.FC<{
  title?: string;
  iconClass?: string;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
}> = ({ iconClass, ...restProps }) => {
  return <span {...restProps} className={clx(styles.icon, iconClass)} />;
};

export default Icon;
