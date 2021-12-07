import React from 'react';

import styles from './styles.module.less';

export const ProgressBar: React.FC<{
  loading: boolean;
}> = React.memo(({ loading }) => {
  if (!loading) {
    return null;
  }
  return (
    <div className={styles.progressbar}>
      <div className={styles.barblock} />
    </div>
  );
});
