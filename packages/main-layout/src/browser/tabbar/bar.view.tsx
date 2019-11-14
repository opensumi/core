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
  forbidCollapse?: boolean;
}> = observer(({ TabView, forbidCollapse }) => {
  const { setSize } = React.useContext(PanelContext);
  const { side, direction } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  const { currentContainerId, handleTabClick } = tabbarService;
  const components: ComponentRegistryInfo[] = [];
  tabbarService.containersMap.forEach((component) => {
    components.push(component);
  });
  return (
    <div style={{flexDirection: Layout.getTabbarDirection(direction)}} className='tab-bar'>
      {components.map((component) => {
        const containerId = component.options!.containerId;
        return (
          <li
            key={containerId}
            id={containerId}
            onClick={(e) => handleTabClick(e, setSize, forbidCollapse)}
            className={clsx({active: currentContainerId === containerId})}>
            <TabView component={component} />
          </li>
        );
      })}
    </div>
  );
});

const IconTabView: React.FC<{component: ComponentRegistryInfo}> = (({ component }) => {
  return <div className='icon-tab'>
    <div className={clsx(component.options!.iconClass, 'activity-icon')} title={component.options!.title}></div>
    {component.options!.badge && <div className='tab-badge'>{component.options!.badge}</div>}
  </div>;
});

const TextTabView: React.FC<{component: ComponentRegistryInfo}> = (({ component }) => {
  return <div className={styles.text_tab}>
    <div className={styles.bottom_tab_title}>{component.options!.title}</div>
    {component.options!.badge && <div className='tab-badge'>{component.options!.badge}</div>}
  </div>;
});

export const RightTabbarRenderer: React.FC = () => <TabbarViewBase TabView={IconTabView} />;

export const LeftTabbarRenderer: React.FC = () => <TabbarViewBase TabView={IconTabView} />;

export const BottomTabbarRenderer: React.FC = () => <TabbarViewBase forbidCollapse={true} TabView={TextTabView} />;
