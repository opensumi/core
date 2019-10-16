import * as React from 'react';
import * as clx from 'classnames';
import { PerfectScrollbar } from '@ali/ide-core-browser/lib/components/scrollbar';
import { ProgressBar } from '@ali/ide-core-browser/lib/components/progressbar';

import { RawExtensionView } from '../raw-extension';
import { RawExtension } from '../../../common';
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
    if (selectExtensionId !== extension.extensionId) {
      setSelectExtensionId(extension.extensionId);
      openExtensionDetail(extension);
    }
  }

  return (
    <div className={styles.wrap}>
      <ProgressBar loading={loading} />
      {list && list.length ? (
        <PerfectScrollbar>
          {list.map((rawExtension) => {
            return (<RawExtensionView className={clx({
              [styles.selected]: rawExtension.extensionId === selectExtensionId,
            })} key={`${rawExtension.extensionId}_${rawExtension.version}`} extension={rawExtension} select={select} />);
          })}
        </PerfectScrollbar>
      ) : <div className={styles.empty}>{empty}</div>}
    </div>
  );
};
