import React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, localize, CommandService, ViewState } from '@ali/ide-core-browser';
import { IExtensionManagerService, SearchState, SearchFromMarketplaceCommandId } from '../common';
import { ExtensionList } from './components/extension-list';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';
import styles from './extension-panel.module.less';

export const ExtensionDisableAccordion: React.FC<{
  viewState: ViewState,
}> = observer(({ viewState }) => {

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);

  return (
    <ExtensionList
      height={viewState.height}
      list={extensionManagerService.disableResults}
      empty={extensionManagerService.disableResults.length === 0 ? localize('marketplace.extension.empty.disabled') : ''}
    />
  );
});

export const ExtensionEnableAccordion: React.FC<{
  viewState: ViewState,
}> = observer(({ viewState }) => {

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);

  return (
    <ExtensionList
      height={viewState.height}
      list={extensionManagerService.enableResults}
    />
  );
});

export const ExtensionHotAccordion: React.FC<{
  viewState: ViewState,
}> = observer(({ viewState }) => {

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);

  return (
    <ExtensionList
      height={viewState.height}
      onReachBottom={() => extensionManagerService.loadHotExtensions()}
      loading={extensionManagerService.loading === SearchState.LOADING}
      list={extensionManagerService.hotExtensions}
      empty={extensionManagerService.loading === SearchState.NO_CONTENT ? localize('marketplace.extension.notfound') : ''}
    />
  );
});

export const ExtensionSearchInstalledAccordion: React.FC<{
  viewState: ViewState,
}> = observer(({ viewState }) => {

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const commandService = useInjectable<CommandService>(CommandService);

  return (
    <ExtensionList
      height={viewState.height}
      loading={extensionManagerService.searchInstalledState === SearchState.LOADING}
      list={extensionManagerService.searchInstalledResults}
      empty={extensionManagerService.searchInstalledState === SearchState.NO_CONTENT ? (
        <div className={styles.search_nofound}>
          <div>{localize('marketplace.extension.notfound')}</div>
          <a className={styles.search_nofound_link} onClick={() => commandService.executeCommand(SearchFromMarketplaceCommandId)}>{localize('marketplace.extension.search.marketplace', '搜索扩展市场')}</a>
        </div>
      ) : ''}
    />
  );
});

export const ExtensionSearchMarketplaceAccordion: React.FC<{
  viewState: ViewState,
}> = observer(({ viewState }) => {

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);

  return (
    <ExtensionList
      height={viewState.height}
      loading={extensionManagerService.searchMarketplaceState === SearchState.LOADING}
      list={extensionManagerService.searchMarketplaceResults}
      empty={extensionManagerService.searchMarketplaceState === SearchState.NO_CONTENT ? (
        <div className={styles.search_nofound}>
          <div>{localize('marketplace.extension.notfound')}</div>
          <InlineActionBar<string>
            className={styles.marketplace_search_nofound}
            separator='inline'
            menus={extensionManagerService.marketplaceNoResultsContext}
            context={[extensionManagerService.marketplaceQuery]}
          />
        </div>
      ) : ''}
    />
  );
});
