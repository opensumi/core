import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, URI } from '@ali/ide-core-browser';
import { IExtensionManagerService } from '../common';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { ExtensionList } from './components/extension-list';

export const ExtensionDisablePanel = observer(() => {

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const workbenchEditorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);

  function openExtensionDetail(extensionId: string) {
    workbenchEditorService.open(new URI(`extension://${extensionId}`));
  }

  return (
    <ExtensionList
      list={extensionManagerService.disableResults}
      openExtensionDetail={openExtensionDetail}
    />
  );
});
