import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './extension-panel.module.less';
import { useInjectable, URI } from '@ali/ide-core-browser';
import { IExtensionManagerService } from '../common';
import RawExtension from './components/raw-extension';
import { PerfectScrollbar } from '@ali/ide-core-browser/lib/components/scrollbar';
import * as cls from 'classnames';
import { WorkbenchEditorService } from '@ali/ide-editor';

export const ExtensionPanel = observer(() => {

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const workbenchEditorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);

  function openExtensionDetail(extensionId: string) {
    workbenchEditorService.open(new URI(`extension://${extensionId}`));
  }

  return (
    <div className={cls(styles.wrap, {
      [styles.loading]: extensionManagerService.loading,
    })}>
      <div className={ styles.kt_extension_view_loading_bar }>
        <div className={ styles.kt_extension_view_loading_bar_block }>
        </div>
      </div>
      <PerfectScrollbar>
      {extensionManagerService.installed.map((rawExtension) => {
        return (<RawExtension key={rawExtension.id} extension={rawExtension} onClick={openExtensionDetail} />);
      })}
      </PerfectScrollbar>
    </div>
  );
});
