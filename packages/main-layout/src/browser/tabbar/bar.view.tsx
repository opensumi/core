import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from '@ali/ide-core-browser/lib/components/layout/layout';
import { ComponentRegistryInfo, useInjectable, ConfigProvider, ComponentRenderer, AppConfig, TabBarToolbar } from '@ali/ide-core-browser';
import { TabbarService, TabbarServiceFactory } from './tabbar.service';
import { observer } from 'mobx-react-lite';
import { PanelContext } from '@ali/ide-core-browser/lib/components/layout/split-panel';
import { INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { TabbarConfig } from './renderer.view';
import { Widget } from '@phosphor/widgets';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import { IMainLayoutService } from '../../common';

export const TabbarViewBase: React.FC<{
  TabView: React.FC<{component: ComponentRegistryInfo}>,
  forbidCollapse?: boolean;
  hasToolBar?: boolean;
}> = observer(({ TabView, forbidCollapse, hasToolBar }) => {
  const measureRef = React.useCallback((node) => {
    if (node) {
      const toolbar = injector.get(TabBarToolbar, [side]);
      tabbarService.registerToolbar(toolbar);
      Widget.attach(toolbar, node);
    }
  }, []);
  const { setSize, getSize } = React.useContext(PanelContext);
  const { side, direction } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  React.useEffect(() => {
    tabbarService.registerResizeHandle(setSize, getSize);
  }, []);
  const { currentContainerId, handleTabClick } = tabbarService;
  const components: ComponentRegistryInfo[] = [];
  const configContext = useInjectable<AppConfig>(AppConfig);
  const injector = useInjectable<Injector>(INJECTOR_TOKEN);
  tabbarService.containersMap.forEach((component) => {
    components.push(component);
  });
  const currentComponent = tabbarService.getContainer(currentContainerId)!;
  const titleComponent = currentComponent && currentComponent.options && currentComponent.options.titleComponent;
  return (
    <div className='tab-bar'>
      <div className={styles.bar_content} style={{flexDirection: Layout.getTabbarDirection(direction)}}>
        {components.map((component) => {
          const containerId = component.options!.containerId;
          return (
            <li
              key={containerId}
              id={containerId}
              onClick={(e) => handleTabClick(e, forbidCollapse)}
              className={clsx({active: currentContainerId === containerId})}>
              <TabView component={component} />
            </li>
          );
        })}
      </div>
      {hasToolBar && titleComponent && <div className={styles.toolbar_container}>
        <ConfigProvider value={configContext} >
          <ComponentRenderer Component={titleComponent} />
        </ConfigProvider>
        <div className='tab-tool-bar' ref={measureRef}></div>
      </div>}
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

export const LeftTabbarRenderer: React.FC = () => {
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  return (<div className='left-tab-bar'>
    <TabbarViewBase TabView={IconTabView} />
    <div className='bottom-icon-container' onClick={layoutService.handleSetting}>
      <i className={`activity-icon ${getIcon('setting')}`}></i>
    </div>
  </div>);
};

export const BottomTabbarRenderer: React.FC = () => <TabbarViewBase hasToolBar={true} forbidCollapse={true} TabView={TextTabView} />;
