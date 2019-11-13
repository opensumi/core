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
  const corePreferences = useInjectable<CorePreferences>(CorePreferences);
  function openExtensionDetail(extension: RawExtension, isDouble: boolean) {
    const query = `extensionId=${extension.publisher}.${extension.name}&version=${extension.version}&name=${extension.displayName}&icon=${extension.icon}`;
    // 当打开模式为双击同时预览模式生效时，默认单击为预览
    const options = {
      preview: corePreferences['editor.previewMode'] && !isDouble,
    };
    if (extension.installed) {
      workbenchEditorService.open(new URI(`extension://local?${query}`), options);
    } else {
      workbenchEditorService.open(new URI(`extension://remote?${query}`), options);
    }
  }

  function select(extension: RawExtension, isDouble: boolean) {
    setSelectExtensionId(extension.extensionId);
    openExtensionDetail(extension, isDouble);
  }

  async function install(extension: RawExtension) {
    await extensionManagerService.installExtension(extension);
  }

  return (
    <div className={styles.wrap}>
      <ProgressBar loading={loading} />
      {list && list.length ? (
        <PerfectScrollbar>
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
      </PerfectScrollbar>
      ) : typeof empty === 'string' ? (<div className={styles.empty}>{empty}</div>) : empty}
    </div>
  );
});
