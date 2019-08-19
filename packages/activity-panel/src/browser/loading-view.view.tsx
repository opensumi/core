import * as React from 'react';
import * as styles from './loading-view.module.less';

export const LoadingView = ({
  name,
}: {name: string}) => {
  return <div className={ styles.kt_extension_view }>
    <div className={ styles.kt_extension_view_loading_bar }>
      <div className={ styles.kt_extension_view_loading_bar_block }>
      </div>
    </div>
  </div>;
};
