import * as React from 'react';

import * as styles from './styles.module.less';

const Badge: React.FC<{} & React.HTMLAttributes<HTMLSpanElement>> = ({ children }) => {
  return <span className={styles.badge}>{children}</span>;
};

export default Badge;
