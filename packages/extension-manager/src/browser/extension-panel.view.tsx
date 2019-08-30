import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, URI } from '@ali/ide-core-browser';
import { IExtensionManagerService } from '../common';
import RawExtension from './components/raw-extension';
import { PerfectScrollbar } from '@ali/ide-core-browser/lib/components/scrollbar';
import * as clx from 'classnames';
import { WorkbenchEditorService } from '@ali/ide-editor';
import * as styles from './extension-panel.module.less';

export const ExtensionPanel = observer(() => {

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const workbenchEditorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);
  const [selectExtensionId, setSelectExtensionId] = React.useState('');

  function openExtensionDetail(extensionId: string) {
    setSelectExtensionId(extensionId);
    workbenchEditorService.open(new URI(`extension://${extensionId}`));
  }

  return (
    <div className={clx(styles.wrap, {
      [styles.loading]: extensionManagerService.loading,
    })}>
      <div className={ styles.kt_extension_view_loading_bar }>
        <div className={ styles.kt_extension_view_loading_bar_block }>
        </div>
      </div>
      <PerfectScrollbar>
      {extensionManagerService.installed.map((rawExtension) => {
        return (<RawExtension className={clx({
          [styles.selected]: rawExtension.id === selectExtensionId,
        })} key={rawExtension.id} extension={rawExtension} select={openExtensionDetail} />);
      })}
      </PerfectScrollbar>
    </div>
  );
});
