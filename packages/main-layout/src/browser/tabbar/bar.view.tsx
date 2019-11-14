import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from '@ali/ide-core-browser/lib/components/layout/layout';
import { ComponentRegistryInfo, useInjectable } from '@ali/ide-core-browser';
import { TabbarService, TabbarServiceFactory } from './tabbar.service';
import { observer } from 'mobx-react-lite';
import { PanelContext } from '@ali/ide-core-browser/lib/components/layout/split-panel';
import { INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { TabbarConfig } from './renderer.view';

export const TabbarViewBase: React.FC<{
  TabView: React.FC<{component: ComponentRegistryInfo}>,
}> = observer(({ TabView }) => {
  const { setSize } = React.useContext(PanelContext);
  const { side } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  const { currentContainerId, handleTabClick } = tabbarService;
  const components: ComponentRegistryInfo[] = [];
  tabbarService.containersMap.forEach((component) => {
    components.push(component);
  });
  return (
    <div className='tab-bar'>
      {components.map((component) => {
        const containerId = component.options!.containerId;
        return <li key={containerId} id={containerId} onClick={(e) => handleTabClick(e, setSize)} className={clsx('icon-tab', {active: currentContainerId === containerId})}>
          <TabView component={component} />
        </li>;
      })}
    </div>
  );
});

const IconTabView: React.FC<{component: ComponentRegistryInfo}> = (({ component }) => {
  return <>
    <div className={clsx(component.options!.iconClass, 'activity-icon')} title={component.options!.title}></div>
    {component.options!.badge && <div className='tab-badge'>{component.options!.badge}</div>}
  </>;
});

export const RightTabbarRenderer: React.FC = () => <TabbarViewBase TabView={IconTabView} />;

export const LeftTabbarRenderer: React.FC = () => <TabbarViewBase TabView={IconTabView} />;
