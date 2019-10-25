import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, localize, CommandService } from '@ali/ide-core-browser';
import { IExtensionManagerService, SearchState, SearchFromMarketplaceCommandId } from '../common';
import { ExtensionList } from './components/extension-list';
import * as styles from './extension-panel.module.less';

export const ExtensionDisableAccordion = observer(() => {

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);

  return (
    <ExtensionList
      list={extensionManagerService.disableResults}
      empty={extensionManagerService.disableResults.length === 0 ? localize('marketplace.extension.empty.disabled', '暂无已禁用的扩展') : ''}
    />
  );
});

export const ExtensionEnableAccordion = observer(() => {

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);

  return (
    <ExtensionList
      list={extensionManagerService.enableResults}
    />
  );
});

export const ExtensionHotAccordion = observer(() => {

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);

  return (
    <ExtensionList
      loading={extensionManagerService.loading === SearchState.LOADING}
      list={extensionManagerService.hotExtensions}
      empty={extensionManagerService.loading === SearchState.NO_CONTENT ? localize('marketplace.extension.notfound', '找不到扩展') : ''}
    />
  );
});

export const ExtensionSearchInstalledAccordion = observer(() => {

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const commandService = useInjectable<CommandService>(CommandService);

  return (
    <ExtensionList
      loading={extensionManagerService.searchInstalledState === SearchState.LOADING}
      list={extensionManagerService.searchInstalledResults}
      empty={extensionManagerService.searchInstalledState === SearchState.NO_CONTENT ? (
        <div className={styles.search_nofound}>
          <div>{localize('marketplace.extension.notfound', '找不到扩展')}</div>
          <a className={styles.search_nofound_link} onClick={() => commandService.executeCommand(SearchFromMarketplaceCommandId)}>{localize('marketplace.extension.search.marketplace', '搜索扩展市场')}</a>
        </div>
      ) : ''}
    />
  );
});

export const ExtensionSearchMarketplaceAccordion = observer(() => {

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);

  return (
    <ExtensionList
      loading={extensionManagerService.searchMarketplaceState === SearchState.LOADING}
      list={extensionManagerService.searchMarketplaceResults}
      empty={extensionManagerService.searchMarketplaceState === SearchState.NO_CONTENT ? localize('marketplace.extension.notfound', '找不到扩展') : ''}
    />
  );
});
