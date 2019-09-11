import * as React from 'react';
import { PerfectScrollbar } from '@ali/ide-core-browser/lib/components/scrollbar';
import { RawExtensionView } from '../raw-extension';
import { RawExtension } from '../../../common';
import * as clx from 'classnames';
import * as styles from './index.module.less';

interface ExtensionListProps {
  loading?: boolean;
  empty?: React.ReactNode | string;
  list: RawExtension[];
  openExtensionDetail: (extension: RawExtension) => void;
}

export const ExtensionList: React.FC<ExtensionListProps> = ({
  loading = false,
  list,
  openExtensionDetail,
  empty,
}) => {
  const [selectExtensionId, setSelectExtensionId] = React.useState('');

  function select(extension: RawExtension) {
    setSelectExtensionId(extension.id);
    openExtensionDetail(extension);
  }

  return (
    <div className={clx(styles.wrap, {
      [styles.loading]: loading,
    })}>
      <div className={ styles.kt_extension_view_loading_bar }>
        <div className={ styles.kt_extension_view_loading_bar_block }>
        </div>
      </div>
      {list && list.length ? (
        <PerfectScrollbar>
          {list.map((rawExtension) => {
            return (<RawExtensionView className={clx({
              [styles.selected]: rawExtension.id === selectExtensionId,
            })} key={rawExtension.id} extension={rawExtension} select={select} />);
          })}
        </PerfectScrollbar>
      ) : <div className={styles.empty}>{empty}</div>}
    </div>
  );
};
