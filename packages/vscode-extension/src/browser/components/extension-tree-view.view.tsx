import * as React from 'react';
import * as styles from './extension-view.module.less';

export const ExtensionTabbarTreeView = ({
  dataProvider,
}: React.PropsWithChildren<{dataProvider?: any}>) => {
  console.log(dataProvider);
  return <div className={ styles.kt_extension_view }>
    <span> dataProvider </span>
  </div>;
};
