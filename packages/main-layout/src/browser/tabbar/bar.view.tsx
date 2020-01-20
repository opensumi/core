import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from '@ali/ide-core-browser/lib/components/layout/layout';
import { ComponentRegistryInfo, useInjectable, ConfigProvider, ComponentRenderer, AppConfig } from '@ali/ide-core-browser';
import { TabbarService, TabbarServiceFactory } from './tabbar.service';
import { observer } from 'mobx-react-lite';
import { TabbarConfig } from './renderer.view';
import { getIcon } from '@ali/ide-core-browser';
import { IMainLayoutService } from '../../common';
import { InlineActionBar, InlineMenuBar } from '@ali/ide-core-browser/lib/components/actions';

export const TabbarViewBase: React.FC<{
  TabView: React.FC<{component: ComponentRegistryInfo}>,
  forbidCollapse?: boolean;
  barSize?: number;
  panelBorderSize?: number;
  tabClassName?: string;
}> = observer(({ TabView, forbidCollapse, barSize = 48, panelBorderSize = 0, tabClassName }) => {
  const { side, direction } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  React.useEffect(() => {
    // 内部只关注总的宽度
    tabbarService.barSize = barSize + panelBorderSize;
  }, []);
  const { currentContainerId, handleTabClick } = tabbarService;
  return (
    <div className={styles.tab_bar}>
      <div className={styles.bar_content} style={{flexDirection: Layout.getTabbarDirection(direction)}}>
        {tabbarService.visibleContainers.map((component) => {
          const containerId = component.options!.containerId;
          let ref: HTMLLIElement | null;
          return (
            <li
              draggable={true}
              onDragStart={(e) => {
                if (ref) {
                  const dragImage = ref.cloneNode(true) as HTMLLIElement;
                  dragImage.classList.add(styles.dragging);
                  if (tabClassName) {
                    dragImage.classList.add(tabClassName);
                  }
                  document.body.appendChild(dragImage);
                  e.dataTransfer.setDragImage(dragImage, 0, 0);
                  setTimeout(() => document.body.removeChild(dragImage), 0);
                }
                tabbarService.handleDragStart(e, containerId);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (ref) {
                  ref.classList.add('on-drag-over');
                }
              }}
              onDragLeave={(e) => {
                if (ref) {
                  ref.classList.remove('on-drag-over');
                }
              }}
              onDrop={(e) => {
                if (ref) {
                  ref.classList.remove('on-drag-over');
                }
                tabbarService.handleDrop(e, containerId);
              }}
              key={containerId}
              id={containerId}
              onContextMenu={(e) => tabbarService.handleContextMenu(e, containerId)}
              onClick={(e) => handleTabClick(e, forbidCollapse)}
              ref={(el) => ref = el}
              className={clsx({active: currentContainerId === containerId}, tabClassName)}>
              <TabView component={component} />
            </li>
          );
        })}
      </div>
    </div>
  );
});

const IconTabView: React.FC<{component: ComponentRegistryInfo}> = observer(({ component }) => {
  return <div className={styles.icon_tab}>
    <div className={clsx(component.options!.iconClass, 'activity-icon')} title={component.options!.title}></div>
    {component.options!.badge && <div className={styles.tab_badge}>{component.options!.badge}</div>}
  </div>;
});

const TextTabView: React.FC<{component: ComponentRegistryInfo}> = observer(({ component }) => {
  return <div className={styles.text_tab}>
    <div className={styles.bottom_tab_title}>{component.options!.title}</div>
    {component.options!.badge && <div className={styles.tab_badge}>{component.options!.badge}</div>}
  </div>;
});

export const RightTabbarRenderer: React.FC = () => {
  const { side } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  return (<div className={styles.right_tab_bar} onContextMenu={tabbarService.handleContextMenu}>
    <TabbarViewBase tabClassName={styles.kt_right_tab} TabView={IconTabView} barSize={40} panelBorderSize={1}/>
  </div>);
};

export const LeftTabbarRenderer: React.FC = () => {
  const { side } = React.useContext(TabbarConfig);
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  return (<div className={styles.left_tab_bar} onContextMenu={tabbarService.handleContextMenu}>
    <TabbarViewBase tabClassName={styles.kt_left_tab} TabView={IconTabView} barSize={48} panelBorderSize={1}/>
    <InlineMenuBar className={styles.vertical_icons} menus={layoutService.getExtraMenu()} />
  </div>);
};

export const BottomTabbarRenderer: React.FC = () => {
  return (
    <div className={styles.bottom_bar_container}>
      <TabbarViewBase forbidCollapse={true} TabView={TextTabView} barSize={0} />
    </div>
  );
};

export const NextBottomTabbarRenderer: React.FC = () => {
  const { side } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  return (
    <div onContextMenu={tabbarService.handleContextMenu} className={clsx(styles.bottom_bar_container, 'next_bottom_bar')}>
      <TabbarViewBase tabClassName={styles.kt_bottom_tab} TabView={TextTabView} barSize={28} panelBorderSize={1}/>
    </div>
  );
};
