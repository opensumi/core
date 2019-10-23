import * as React from 'react';
import { AccordionWidget } from '@ali/ide-core-browser/lib/layout';
import Tabs from 'antd/lib/tabs';
import 'antd/lib/tabs/style/index.less';
import { useInjectable, localize } from '@ali/ide-core-browser';
import { Widget } from '@phosphor/widgets';
import { enableExtensionsContainerId, enableExtensionsTarbarHandlerId, disableExtensionsTarbarHandlerId, searchExtensionsTarbarHandlerId } from '../common';
import { INJECTOR_TOKEN } from '@ali/common-di';
import { ExtensionEnablePanel } from './extension-panel-enable.view';
import { ExtensionDisablePanel } from './extension-panel-disable.view';
import { ExtensionSearchPanel } from './extension-panel-search.view';

const { TabPane } = Tabs;

export default function() {

  const [marketElement, setMarketElement] = React.useState<HTMLElement | null>(null);
  const [installedElement, setInstalledElement] = React.useState<HTMLElement | null>(null);
  const injector = useInjectable(INJECTOR_TOKEN);
  const accordion1 = injector.get(AccordionWidget, [enableExtensionsContainerId, [{
    component: ExtensionEnablePanel,
    id: enableExtensionsTarbarHandlerId,
    name: localize('marketplace.extension.enabled', '已启用'),
    forceHidden: false,
  }, {
    component: ExtensionDisablePanel,
    id: disableExtensionsTarbarHandlerId,
    name: localize('marketplace.extension.disabled', '已禁用'),
    forceHidden: false,
  }, {
    component: ExtensionSearchPanel,
    id: searchExtensionsTarbarHandlerId,
    name: localize('marketplace.extension.search', '搜索'),
    forceHidden: true,
  }], 'left']);

  const accordion2 = injector.get(AccordionWidget, ['enableExtensionsContainerId', [{
    component: ExtensionEnablePanel,
    id: enableExtensionsTarbarHandlerId,
    name: localize('marketplace.extension.enabled', '已启用'),
    forceHidden: false,
  }, {
    component: ExtensionDisablePanel,
    id: disableExtensionsTarbarHandlerId,
    name: localize('marketplace.extension.disabled', '已禁用'),
    forceHidden: false,
  }], 'left']);

  React.useEffect(() => {
    if (marketElement) {
      Widget.attach(accordion1, marketElement);
    }
  }, [marketElement]);

  React.useEffect(() => {
    if (installedElement) {
      Widget.attach(accordion2, installedElement);
    }
  }, [installedElement]);

  return (
    <Tabs tabBarStyle={{margin: 0}} tabBarGutter={0}>
      <TabPane tab='marketplace' key='marketplace'>
        <div ref={setMarketElement}></div>
      </TabPane>
      <TabPane tab='installed' key='installed'>
        <div ref={setInstalledElement}></div>
      </TabPane>
    </Tabs>
  );
}
