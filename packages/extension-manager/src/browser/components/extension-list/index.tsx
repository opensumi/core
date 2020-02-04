import * as React from 'react';
import * as clx from 'classnames';
import { PerfectScrollbar } from '@ali/ide-core-browser/lib/components';
import { ProgressBar } from '@ali/ide-core-browser/lib/components/progressbar';
import { RawExtensionView } from '../raw-extension';
import { RawExtension, IExtensionManagerService } from '../../../common';
import * as styles from './index.module.less';
import { useInjectable, URI, CorePreferences } from '@ali/ide-core-browser';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { observer } from 'mobx-react-lite';

interface ExtensionListProps {
  height: number;
  loading?: boolean;
  empty?: React.ReactNode | string;
  onYReachEnd?: () => void;
  list: RawExtension[];
}

export const ExtensionList: React.FC<ExtensionListProps> = observer(({
  height,
  loading = false,
  list,
  empty,
  onYReachEnd,
}) => {
  const [selectExtensionId, setSelectExtensionId] = React.useState('');
  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);

  function select(extension: RawExtension, isDouble: boolean) {
    setSelectExtensionId(extension.extensionId);
    extensionManagerService.openExtensionDetail({
      publisher: extension.publisher,
      name: extension.name,
      displayName: extension.displayName || extension.name,
      icon: extension.icon,
      preview: !isDouble,
      remote: !extension.installed,
      version: extension.version,
    });
  }

  async function install(extension: RawExtension) {
    await extensionManagerService.installExtension(extension);
  }

  return (
    <div className={styles.wrap}>
      <ProgressBar loading={loading} />
      {list && list.length ? (
        <PerfectScrollbar
          onYReachEnd={onYReachEnd}
        >
          <div style={{ height }}>
            {list.map((rawExtension, index) => {
              return (<RawExtensionView className={clx({
                [styles.selected]: rawExtension.extensionId === selectExtensionId,
                [styles.gray]: rawExtension.installed && !rawExtension.enable,
                [styles.last_item]: index === list.length - 1,
              })}
              key={`${rawExtension.extensionId}_${rawExtension.version}`}
              extension={rawExtension}
              select={select}
              install={install}
              />);
            })}
          </div>
      </PerfectScrollbar>
      ) : typeof empty === 'string' ? (<div className={styles.empty}>{empty}</div>) : empty}
    </div>
  );
});
