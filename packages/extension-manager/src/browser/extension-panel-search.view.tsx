import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ExtensionList } from './components/extension-list';
import { useInjectable } from '@ali/ide-core-browser';
import { IExtensionManagerService, SearchState } from '../common';
import { WorkbenchEditorService } from '@ali/ide-editor';

export const ExtensionSearchPanel = observer(() => {

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const workbenchEditorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);

  function openExtensionDetail(extensionId: string) {
    console.log(extensionId);
  }

  return (
    <ExtensionList
      loading={extensionManagerService.searchState === SearchState.LOADING}
      openExtensionDetail={openExtensionDetail}
      list={extensionManagerService.searchResults}
    />
  );
});
