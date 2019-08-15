import * as React from 'react';
import * as styles from './extension-view.module.less';

export const ExtensionTabbarView = ({
  name,
}: {name: string}) => {
  return <div className={ styles.kt_extension_view }>
    <div className={ styles.kt_extension_view_loading_bar }>
      <div className={ styles.kt_extension_view_loading_bar_block }>
      </div>
    </div>
  </div>;
};
