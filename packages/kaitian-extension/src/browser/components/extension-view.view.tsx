import * as React from 'react';
import { ProgressBar } from '@ali/ide-core-browser/lib/components/progressbar';
import * as styles from './extension-view.module.less';
import { formatLocalize } from '@ali/ide-core-browser';

export const ExtensionLoadingView = ({
  name,
}: {name: string}) => {
  return <div className={ styles.kt_extension_view }>
    <ProgressBar loading />
  </div>;
};

export const ExtensionNoExportsView = (extensionId: string, viewId: string) => (
  <div className={styles.kt_extension_no_exports_view}>{formatLocalize(
    'extension.no.view.found', extensionId, viewId,
  )}</div>
);
