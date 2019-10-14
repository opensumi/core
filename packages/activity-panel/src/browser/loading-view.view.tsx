import * as React from 'react';
import { ProgressBar } from '@ali/ide-core-browser/lib/components/progressbar';
import * as styles from './loading-view.module.less';

export const LoadingView = ({
  name,
}: {name: string}) => {
  return <div className={ styles.kt_extension_view }>
    <ProgressBar loading />
  </div>;
};
