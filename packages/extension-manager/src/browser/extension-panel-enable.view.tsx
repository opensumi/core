import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, URI } from '@ali/ide-core-browser';
import { IExtensionManagerService, RawExtension } from '../common';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { ExtensionList } from './components/extension-list';

export const ExtensionEnablePanel = observer(() => {

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const workbenchEditorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);

  function openExtensionDetail(extension: RawExtension) {
    workbenchEditorService.open(new URI(`extension://local?extensionId=${extension.extensionId}&name=${extension.displayName}`));
  }

  return (
    <ExtensionList
      list={extensionManagerService.enableResults}
      openExtensionDetail={openExtensionDetail}
    />
  );
});
