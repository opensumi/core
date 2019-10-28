import * as React from 'react';
import * as clx from 'classnames';
import { PerfectScrollbar } from '@ali/ide-core-browser/lib/components/scrollbar';
import { ProgressBar } from '@ali/ide-core-browser/lib/components/progressbar';
import { RawExtensionView } from '../raw-extension';
import { RawExtension, IExtensionManagerService } from '../../../common';
import * as styles from './index.module.less';
import { useInjectable, URI } from '@ali/ide-core-browser';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { observer } from 'mobx-react-lite';

interface ExtensionListProps {
  loading?: boolean;
  empty?: React.ReactNode | string;
  list: RawExtension[];
}

export const ExtensionList: React.FC<ExtensionListProps> = observer(({
  loading = false,
  list,
  empty,
}) => {
  const [selectExtensionId, setSelectExtensionId] = React.useState('');
  const workbenchEditorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);
  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
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

  async function install(extension: RawExtension) {
    const path = await extensionManagerService.downloadExtension(extension.extensionId);
    // 更新插件进程信息
    await extensionManagerService.onInstallExtension(extension.extensionId, path);
    // 标记为已安装
    await extensionManagerService.makeExtensionStatus(true, extension.extensionId, path);
  }

  return (
    <div className={styles.wrap}>
      <ProgressBar loading={loading} />
      {list && list.length ? (
        <PerfectScrollbar>
          {list.map((rawExtension) => {
            return (<RawExtensionView className={clx({
              [styles.selected]: rawExtension.extensionId === selectExtensionId,
              [styles.gray]: rawExtension.installed && !rawExtension.enable,
            })}
            key={`${rawExtension.extensionId}_${rawExtension.version}`}
            extension={rawExtension}
            select={select}
            install={install}
            />);
          })}
        </PerfectScrollbar>
      ) : typeof empty === 'string' ? (<div className={styles.empty}>{empty}</div>) : empty}
    </div>
  );
});
