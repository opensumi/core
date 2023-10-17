import clsx from 'classnames';
import { observer } from 'mobx-react-lite';
import React from 'react';

import styles from './progress.module.less';

import { IProgressModel } from '.';

export const ProgressBar: React.FC<{ progressModel: IProgressModel; className?: string }> = observer(
  ({ progressModel, className }) => {
    const { worked, total, show, fade } = progressModel;
    return (
      <div className={clsx(className, styles.progressBar, { [styles.hide]: !show }, { [styles.fade]: fade })}>
        <div
          className={clsx(styles.progress, { [styles.infinite]: !total })}
          style={total ? { width: (worked / total || 0.02) * 100 + '%' } : { width: '2%' }}
        ></div>
      </div>
    );
  },
);

export const Progress: React.FC<{
  loading: boolean;
  wrapperClassName?: string;
  style?: React.CSSProperties;
}> = React.memo(({ loading, style, wrapperClassName }) => {
  if (!loading) {
    return null;
  }
  return (
    <div className={clsx(styles.progressBar, wrapperClassName)}>
      <div className={clsx(styles.progress, styles.infinite)} style={{ width: '2%', ...style }} />
    </div>
  );
});
