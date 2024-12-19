import cls from 'classnames';
import React from 'react';

import { useAutorun } from '../utils';

import styles from './progress.module.less';

import { IProgressModel } from '.';

export const ProgressBar: React.FC<{ progressModel: IProgressModel; className?: string }> = ({
  progressModel,
  className,
}) => {
  const worked = useAutorun(progressModel.worked);
  const total = useAutorun(progressModel.total);
  const show = useAutorun(progressModel.show);
  const fade = useAutorun(progressModel.fade);

  return (
    <div className={cls(className, styles.progressBar, { [styles.hide]: !show }, { [styles.fade]: fade })}>
      <div
        className={cls(styles.progress, { [styles.infinite]: !total })}
        style={total ? { width: (worked / total || 0.02) * 100 + '%' } : { width: '2%' }}
      ></div>
    </div>
  );
};

export const Progress: React.FC<{
  loading: boolean;
  wrapperClassName?: string;
  style?: React.CSSProperties;
}> = React.memo(({ loading, style, wrapperClassName }) => {
  if (!loading) {
    return null;
  }
  return (
    <div className={cls(styles.progressBar, wrapperClassName)}>
      <div className={cls(styles.progress, styles.infinite)} style={{ width: '2%', ...style }} />
    </div>
  );
});
