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

  const marketplaceRef = React.useRef<HTMLElement | null>();
  const installedRef = React.useRef<HTMLElement | null>();
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
    if (marketplaceRef.current && installedRef.current) {
      Widget.attach(accordion1, marketplaceRef.current);
      Widget.attach(accordion2, installedRef.current);
    }
  }, [marketplaceRef, installedRef]);

  return (
    <Tabs tabBarStyle={{margin: 0}} tabBarGutter={0}>
      <TabPane tab='marketplace' key='marketplace'>
        <div ref={(ele) => marketplaceRef.current = ele}></div>
      </TabPane>
      <TabPane tab='installed' key='installed'>
        <div ref={(ele) => installedRef.current = ele}></div>
      </TabPane>
    </Tabs>
  );
}
