import React from 'react';

import { formatLocalize } from '@opensumi/ide-core-browser';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';

import styles from './extension-tree-view.module.less';

export const ExtensionLoadingView = ({ style }: { style?: React.CSSProperties }) => (
  <div style={style || {}} className={styles.kt_extension_view}>
    <Progress loading />
  </div>
);

export const ExtensionNoExportsView = (extensionId: string, viewId: string) => (
  <div className={styles.kt_extension_no_exports_view}>
    {formatLocalize('extension.no.view.found', extensionId, viewId)}
  </div>
);
