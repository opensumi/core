import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ExtensionList } from './components/extension-list';
import { useInjectable, URI, localize } from '@ali/ide-core-browser';
import { IExtensionManagerService, SearchState, RawExtension } from '../common';
import { WorkbenchEditorService } from '@ali/ide-editor';

export const ExtensionSearchPanel = observer(() => {

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const workbenchEditorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);

  function openExtensionDetail(extension: RawExtension) {
    if (extension.installed) {
      workbenchEditorService.open(new URI(`extension://local?extensionId=${extension.extensionId}&name=${extension.displayName}&version=${extension.version}`));
    } else {
      workbenchEditorService.open(new URI(`extension://remote?extensionId=${extension.extensionId}&name=${extension.displayName}`));
    }

  }

  return (
    <ExtensionList
      loading={extensionManagerService.searchState === SearchState.LOADING}
      openExtensionDetail={openExtensionDetail}
      list={extensionManagerService.searchResults}
      empty={extensionManagerService.searchState === SearchState.NO_CONTENT ? localize('marketplace.extension.notfound', '找不到扩展') : ''}
    />
  );
});
