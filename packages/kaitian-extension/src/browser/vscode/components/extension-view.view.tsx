import * as React from 'react';
import { ProgressBar } from '@ali/ide-core-browser/lib/components/progressbar';
import * as styles from './extension-view.module.less';

export const ExtensionTabbarView = ({
  name,
}: {name: string}) => {
  return <div className={ styles.kt_extension_view }>
    <ProgressBar loading />
  </div>;
};
