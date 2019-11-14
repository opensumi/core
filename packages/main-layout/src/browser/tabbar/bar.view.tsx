import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from '@ali/ide-core-browser/lib/components/layout/layout';
import { ComponentRegistryInfo, useInjectable } from '@ali/ide-core-browser';
import { TabbarService, TabbarServiceManager, TabbarServiceFactory } from './tabbar.service';
import { observer } from 'mobx-react-lite';
import { PanelContext } from '@ali/ide-core-browser/lib/components/layout/split-panel';
import { INJECTOR_TOKEN, Injector } from '@ali/common-di';

export const TabbarViewBase: React.FC<{
  side: string;
  components: ComponentRegistryInfo[];
  TabView: React.FC<{component: ComponentRegistryInfo}>
}> = observer(({ components, TabView, side }) => {
  const { setSize } = React.useContext(PanelContext);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  const { currentContainerId, handleTabClick } = tabbarService;

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
    {/* TODO badge数据源 */}
    <div className='tab-badge'>2</div>
  </>;
});

export const RightTabbarRenderer: React.FC<{
  components: ComponentRegistryInfo[];
  side: string;
}> = ({components, side}) => <TabbarViewBase side={side} components={components} TabView={IconTabView} />;

export const LeftTabbarRenderer: React.FC<{
  components: ComponentRegistryInfo[];
  side: string;
}> = ({components, side}) => <TabbarViewBase side={side} components={components} TabView={IconTabView} />;
