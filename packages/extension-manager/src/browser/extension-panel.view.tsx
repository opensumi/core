import React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, localize, CommandRegistry } from '@ali/ide-core-browser';
import { enableExtensionsContainerId, hotExtensionsContainerId, enableExtensionsTarbarHandlerId, disableExtensionsTarbarHandlerId, searchExtensionsFromMarketplaceTarbarHandlerId, searchExtensionsFromInstalledTarbarHandlerId, IExtensionManagerService, hotExtensionsFromMarketplaceTarbarHandlerId, TabActiveKey, SearchFromMarketplaceCommandId } from '../common';
import { ExtensionHotAccordion, ExtensionEnableAccordion, ExtensionDisableAccordion, ExtensionSearchInstalledAccordion, ExtensionSearchMarketplaceAccordion } from './extension-panel-accordion.view';
import { ExtensionSearch } from './components/extension-search';
import styles from './extension-panel.module.less';
import { AccordionContainer } from '@ali/ide-main-layout/lib/browser/accordion/accordion.view';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { Tabs } from '@ali/ide-components';

const tabMap = [
  TabActiveKey.MARKETPLACE,
  TabActiveKey.INSTALLED,
];

export default observer(() => {
  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const commandRegistry = useInjectable<CommandRegistry>(CommandRegistry);
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);

  const showEnableAndDisable = React.useCallback(() => {
    const enabledAccordionService = layoutService.getAccordionService(enableExtensionsContainerId, true);
    enabledAccordionService.toggleViewVisibility(enableExtensionsTarbarHandlerId, true);
    enabledAccordionService.toggleViewVisibility(disableExtensionsTarbarHandlerId, true);
    enabledAccordionService.toggleViewVisibility(searchExtensionsFromInstalledTarbarHandlerId, false);
  }, []);

  const showHotSection = React.useCallback(() => {
    const hotAccordionService = layoutService.getAccordionService(hotExtensionsContainerId, true);
    hotAccordionService.toggleViewVisibility(hotExtensionsFromMarketplaceTarbarHandlerId, true);
    hotAccordionService.toggleViewVisibility(searchExtensionsFromMarketplaceTarbarHandlerId, false);
  }, []);

  const hideHotSearch = React.useCallback(() => {
    const hotAccordionService = layoutService.getAccordionService(hotExtensionsContainerId, true);
    hotAccordionService.toggleViewVisibility(hotExtensionsFromMarketplaceTarbarHandlerId, false);
    hotAccordionService.toggleViewVisibility(searchExtensionsFromMarketplaceTarbarHandlerId, true);
  }, []);

  React.useEffect(() => {
    // 默认要调用一次，不使用layout状态
    showEnableAndDisable();
    showHotSection();
  }, [showEnableAndDisable, showHotSection]);

  const handleChangeFromMarket = React.useCallback((value: string) => {
    extensionManagerService.marketplaceQuery = value;
    if (value) {
      hideHotSearch();
      extensionManagerService.searchFromMarketplace(value);
    } else {
      showHotSection();
    }
  }, [hideHotSearch, showHotSection]);

  React.useEffect(() => {
    commandRegistry.registerCommand({
      id: SearchFromMarketplaceCommandId,
    }, {
      execute: () => {
        extensionManagerService.tabActiveKey = TabActiveKey.MARKETPLACE;
        handleChangeFromMarket(extensionManagerService.installedQuery);
      },
    });
    return () => {
      commandRegistry.unregisterCommand(SearchFromMarketplaceCommandId);
    };
  }, [handleChangeFromMarket]);

  function handleChangeFromInstalled(value: string) {
    extensionManagerService.installedQuery = value;
    if (value) {
      const enabledAccordionService = layoutService.getAccordionService(enableExtensionsContainerId, true);
      enabledAccordionService.toggleViewVisibility(enableExtensionsTarbarHandlerId, false);
      enabledAccordionService.toggleViewVisibility(disableExtensionsTarbarHandlerId, false);
      enabledAccordionService.toggleViewVisibility(searchExtensionsFromInstalledTarbarHandlerId, true);
      extensionManagerService.searchFromInstalled(value);
    } else {
      showEnableAndDisable();
    }
  }

  const tabIndex = tabMap.indexOf(extensionManagerService.tabActiveKey);
  const selectedTabIndex = tabIndex >= 0 ? tabIndex : 0;

  return (
    <div className={styles.panel}>
      <Tabs
        mini
        className={styles.tabs}
        value={selectedTabIndex}
        onChange={(index: number) => {
          const activeKey = tabMap[index];
          if (activeKey) {
            extensionManagerService.tabActiveKey = activeKey;
          }
        }}
        tabs={[localize('marketplace.panel.tab.marketplace'), localize('marketplace.tab.installed')]}
      />
      {
        extensionManagerService.tabActiveKey === TabActiveKey.MARKETPLACE
          && (
            <>
              <ExtensionSearch
                query={extensionManagerService.marketplaceQuery}
                onChange={handleChangeFromMarket}
                placeholder={localize('marketplace.panel.tab.placeholder.search')}
                />
              <AccordionContainer
                views={[{
                  component: ExtensionHotAccordion,
                  id: hotExtensionsFromMarketplaceTarbarHandlerId,
                  name: localize('marketplace.panel.hot'),
                }, {
                  component: ExtensionSearchMarketplaceAccordion,
                  id: searchExtensionsFromMarketplaceTarbarHandlerId,
                  name: localize('marketplace.panel.search'),
                }]}
                noRestore={true}
                containerId={hotExtensionsContainerId}
                className={styles.accordion}
              />
            </>
          )
      }
      {
        extensionManagerService.tabActiveKey === TabActiveKey.INSTALLED
          && (
            <>
              <ExtensionSearch
                query={extensionManagerService.installedQuery}
                onChange={handleChangeFromInstalled}
                placeholder={localize('marketplace.panel.tab.placeholder.installed')}
                />
              <AccordionContainer
                views={[{
                  component: ExtensionEnableAccordion,
                  id: enableExtensionsTarbarHandlerId,
                  name: localize('marketplace.panel.enabled'),
                }, {
                  component: ExtensionDisableAccordion,
                  id: disableExtensionsTarbarHandlerId,
                  name: localize('marketplace.panel.disabled'),
                  collapsed: true,
                }, {
                  component: ExtensionSearchInstalledAccordion,
                  id: searchExtensionsFromInstalledTarbarHandlerId,
                  name: localize('marketplace.panel.search'),
                }]}
                noRestore={true}
                containerId={enableExtensionsContainerId}
                className={styles.accordion}
              />
            </>
          )
      }
    </div>
  );
});
