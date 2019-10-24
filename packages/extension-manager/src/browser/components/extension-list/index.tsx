import * as React from 'react';
import * as clx from 'classnames';
import { PerfectScrollbar } from '@ali/ide-core-browser/lib/components/scrollbar';
import { ProgressBar } from '@ali/ide-core-browser/lib/components/progressbar';

import { RawExtensionView } from '../raw-extension';
import { RawExtension, IExtensionManagerService } from '../../../common';
import * as styles from './index.module.less';
import { useInjectable, URI } from '@ali/ide-core-browser';
import { WorkbenchEditorService } from '@ali/ide-editor';

interface ExtensionListProps {
  loading?: boolean;
  empty?: React.ReactNode | string;
  list: RawExtension[];
  isGray?: boolean;
}

export const ExtensionList: React.FC<ExtensionListProps> = ({
  loading = false,
  list,
  empty,
  isGray,
}) => {
  const [selectExtensionId, setSelectExtensionId] = React.useState('');
  const workbenchEditorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);

  function openExtensionDetail(extension: RawExtension) {
    if (extension.installed) {
      workbenchEditorService.open(new URI(`extension://local?extensionId=${extension.extensionId}&name=${extension.displayName}`));
    } else {
      workbenchEditorService.open(new URI(`extension://remote?extensionId=${extension.extensionId}&name=${extension.displayName}`));
    }
  }

  function select(extension: RawExtension) {
    setSelectExtensionId(extension.extensionId);
    openExtensionDetail(extension);
  }

  return (
    <div className={clx(styles.wrap, {
      [styles.gray]: isGray,
    })}>
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
