import cls from 'classnames';
import React, { useEffect } from 'react';

import { Badge, Icon } from '@opensumi/ide-components';
import {
  ComponentRegistryInfo,
  ComponentRegistryProvider,
  KeybindingRegistry,
  addClassName,
  getIcon,
  useAutorun,
  useDesignStyles,
  useInjectable,
  usePreference,
} from '@opensumi/ide-core-browser';
import { InlineMenuBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { Layout } from '@opensumi/ide-core-browser/lib/components/layout/layout';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';

import { IMainLayoutService } from '../../common';

import { TabbarConfig } from './renderer.view';
import styles from './styles.module.less';
import { TabbarService, TabbarServiceFactory } from './tabbar.service';

import type { ViewBadge } from 'vscode';

function splitVisibleTabs(containers: ComponentRegistryInfo[], visibleCount: number) {
  if (visibleCount >= containers.length) {
    return [containers, []];
  }
  if (visibleCount <= 1) {
    return [[], containers];
  }
  return [containers.slice(0, visibleCount - 1), containers.slice(visibleCount - 1)];
}

function getBadgeValue(badge: string | ViewBadge) {
  if (typeof badge === 'string') {
    return parseInt(badge, 10) > 99 ? '99+' : badge;
  }
  if (typeof badge === 'object' && badge.value) {
    return badge.value > 99 ? '99+' : badge.value;
  }
  return '';
}

export interface ITabbarViewProps {
  TabView: React.FC<{ component: ComponentRegistryInfo }>;
  forbidCollapse?: boolean;
  // tabbar的尺寸（横向为宽，纵向高），tab折叠后为改尺寸加上panelBorderSize
  barSize?: number;
  // 包含tab的内外边距的总尺寸，用于控制溢出隐藏逻辑
  tabSize: number;
  MoreTabView: React.FC;
  /**
   * 禁用自动检测高度或者宽度变化后自动调整显示 tab 的数量
   */
  disableAutoAdjust?: boolean;
  panelBorderSize?: number;
  tabClassName?: string;
  className?: string;
  // tab上预留的位置，用来控制tab过多的显示效果
  margin?: number;
  canHideTabbar?: boolean;
  renderOtherVisibleContainers?: React.FC<{
    props: ITabbarViewProps;
    renderContainers: (
      component: ComponentRegistryInfo,
      tabbarService: TabbarService,
      currentContainerId: string,
    ) => JSX.Element | null;
  }>;
}

export const TabbarViewBase: React.FC<ITabbarViewProps> = (props) => {
  const {
    TabView,
    MoreTabView,
    forbidCollapse,
    barSize = 48,
    panelBorderSize = 0,
    tabClassName,
    className,
    margin,
    tabSize,
    canHideTabbar,
    renderOtherVisibleContainers = () => null,
    disableAutoAdjust,
  } = props;
  const { side, direction, fullSize } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  const styles_tab_bar = useDesignStyles(styles.tab_bar, 'tab_bar');
  const styles_bar_content = useDesignStyles(styles.bar_content, 'bar_content');

  React.useEffect(() => {
    // 内部只关注总的宽度
    tabbarService.updateBarSize(barSize + panelBorderSize);
  }, []);

  const currentContainerId = useAutorun(tabbarService.currentContainerId);

  const hideTabBarWhenHidePanel = usePreference<boolean>('workbench.hideSlotTabBarWhenHidePanel', false);

  const willHideTabbar = canHideTabbar && hideTabBarWhenHidePanel;

  if (willHideTabbar && !currentContainerId) {
    // 之所以要用这么偏门的方法，是因为：
    // 我尝试了好几种方案，比如让 tabbar 或其他几个组件返回 null 的话
    // 会导致 SplitPanel 计算 children 的尺寸不正确，或者计算 tabbar 上按钮区域长度不对等等
    // 最后试了这个方法一劳永逸，感觉也挺合适
    tabbarService.resizeHandle?.setSize(0);
  }

  const visibleCount = disableAutoAdjust ? Number.MAX_SAFE_INTEGER : Math.floor(fullSize - (margin || 0) / tabSize);

  const [visibleContainers, hideContainers] = splitVisibleTabs(
    tabbarService.visibleContainers.filter((container) => !container.options?.hideTab),
    visibleCount,
  );

  hideContainers.forEach((componentInfo) => {
    tabbarService.updateTabInMoreKey(componentInfo.options!.containerId, true);
  });

  const renderContainers = React.useCallback(
    (component: ComponentRegistryInfo, tabbarService: TabbarService, currentContainerId?: string, side?: string) => {
      const containerId = component.options?.containerId;
      if (!containerId) {
        return null;
      }
      if (side && component.options?.hideLocationTab?.includes(side)) {
        return null;
      }

      tabbarService.updateTabInMoreKey(containerId, false);
      let ref: HTMLLIElement | null;
      return (
        <li
          draggable={true}
          onDragStart={(e) => {
            if (ref) {
              const dragImage = ref.cloneNode(true) as HTMLLIElement;
              dragImage.classList.add(styles.dragging);
              if (tabClassName) {
                addClassName(dragImage, tabClassName);
              }
              document.body.appendChild(dragImage);
              e.persist();
              requestAnimationFrame(() => {
                e.dataTransfer.setDragImage(dragImage, 0, 0);
                document.body.removeChild(dragImage);
              });
            }
            tabbarService.handleDragStart(e, containerId);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (ref) {
              ref.classList.add('on-drag-over');
            }
          }}
          onDragLeave={() => {
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
          onDragEnd={(e) => {
            tabbarService.handleDragEnd(e);
          }}
          key={containerId}
          id={containerId}
          onContextMenu={(e) => tabbarService.handleContextMenu(e, containerId)}
          // 如果设置了可隐藏 Tabbar，那么就不允许点击 tab 时隐藏整个 panel 了 通过设置 forbidCollapse 来阻止这个动作
          onClick={(e) => tabbarService.handleTabClick(e, willHideTabbar || forbidCollapse)}
          ref={(el) => (ref = el)}
          className={cls({ active: currentContainerId === containerId }, tabClassName)}
        >
          <TabView component={component} />
        </li>
      );
    },
    [],
  );

  return (
    <div className={cls([styles_tab_bar, className])}>
      <div className={styles_bar_content} style={{ flexDirection: Layout.getTabbarDirection(direction) }}>
        {visibleContainers.map((component) => renderContainers(component, tabbarService, currentContainerId, side))}
        {renderOtherVisibleContainers({ props, renderContainers })}
        {hideContainers.length ? (
          <li
            key='tab-more'
            onClick={(e) =>
              tabbarService.showMoreMenu(
                e,
                visibleContainers[visibleContainers.length - 1] &&
                  visibleContainers[visibleContainers.length - 1].options?.containerId,
              )
            }
            className={tabClassName}
          >
            <MoreTabView />
          </li>
        ) : null}
      </div>
    </div>
  );
};

export const IconTabView: React.FC<{ component: ComponentRegistryProvider }> = ({ component: defaultComponent }) => {
  const progressService: IProgressService = useInjectable(IProgressService);
  const keybindingRegistry: KeybindingRegistry = useInjectable(KeybindingRegistry);
  const styles_icon_tab = useDesignStyles(styles.icon_tab, 'icon_tab');
  const [component, setComponent] = React.useState<ComponentRegistryProvider>(defaultComponent);
  const indicator = progressService.getIndicator(component.options?.containerId || '');

  const inProgress = useAutorun(indicator!.progressModel.show);

  const title = React.useMemo(() => {
    const options = component.options;
    if (options?.activateKeyBinding) {
      return `${options?.title} (${keybindingRegistry.acceleratorForKeyString(options.activateKeyBinding, '+')})`;
    }
    return options?.title;
  }, [component]);

  useEffect(() => {
    const dispose = component.onChange((newComponent) => {
      // Immediately update with current component to handle initial badge value
      setComponent({ ...newComponent });
    });
    return () => {
      dispose.dispose();
    };
  }, [component]); // Add component as dependency to re-run effect when it changes

  return (
    <div className={styles_icon_tab}>
      <div className={cls(component.options?.iconClass, 'activity-icon')} title={title}></div>
      {inProgress ? (
        <Badge className={styles.tab_badge}>
          <span className={styles.icon_wrapper}>
            <Icon icon='time-circle' />
          </span>
        </Badge>
      ) : (
        component.options?.badge && <Badge className={styles.tab_badge}>{getBadgeValue(component.options.badge)}</Badge>
      )}
    </div>
  );
};

export const TextTabView: React.FC<{ component: ComponentRegistryProvider }> = ({ component: defaultComponent }) => {
  const [component, setComponent] = React.useState<ComponentRegistryProvider>(defaultComponent);
  useEffect(() => {
    const dispose = component.onChange((newComponent) => {
      // Immediately update with current component to handle initial badge value
      setComponent({ ...newComponent });
    });
    return () => {
      dispose.dispose();
    };
  }, [component]); // Add component as dependency to re-run effect when it changes
  return (
    <div className={styles.text_tab}>
      <div className={styles.bottom_tab_title}>{component.options?.title?.toUpperCase()}</div>
      {component.options?.badge && <Badge className={styles.tab_badge}>{getBadgeValue(component.options.badge)}</Badge>}
    </div>
  );
};

export const IconElipses: React.FC = () => {
  const styles_icon_tab = useDesignStyles(styles.icon_tab, 'icon_tab');
  return (
    <div className={styles_icon_tab}>
      {/* i18n */}
      <div className={cls(getIcon('ellipsis'), 'activity-icon')} title='extra tabs'></div>
    </div>
  );
};

export const TextElipses: React.FC = () => (
  <div className={styles.text_tab}>
    <div className={styles.bottom_tab_title}>
      <i className={getIcon('doubleright')}></i>
    </div>
  </div>
);

export const RightTabbarRenderer: React.FC<{ barSize?: number; style?: React.CSSProperties }> = (props) => {
  const { barSize = 48, style } = props;
  const { side } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);

  const styles_right_tab_bar = useDesignStyles(styles.right_tab_bar, 'right_tab_bar');
  const styles_right_tab = useDesignStyles(styles.right_tab, 'right_tab');

  return (
    <div
      id={VIEW_CONTAINERS.RIGHT_TABBAR}
      className={styles_right_tab_bar}
      style={style}
      onContextMenu={tabbarService.handleContextMenu}
    >
      <TabbarViewBase
        tabSize={48}
        MoreTabView={IconElipses}
        tabClassName={styles_right_tab}
        TabView={IconTabView}
        barSize={barSize}
        panelBorderSize={1}
      />
    </div>
  );
};

export const LeftTabbarRenderer: React.FC<{
  renderOtherVisibleContainers?: React.FC<{
    props: ITabbarViewProps;
    renderContainers: (
      component: ComponentRegistryInfo,
      tabbarService: TabbarService,
      currentContainerId: string,
    ) => JSX.Element | null;
  }>;
  isRenderExtraTopMenus?: boolean;
  renderExtraMenus?: React.ReactNode;
  tabbarViewProps?: Partial<ITabbarViewProps>;
}> = ({ renderOtherVisibleContainers, isRenderExtraTopMenus = true, renderExtraMenus, tabbarViewProps }) => {
  const { side } = React.useContext(TabbarConfig);
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);

  const extraTopMenus = React.useMemo(() => layoutService.getExtraTopMenu(), [layoutService]);
  const extraMenus = React.useMemo(() => layoutService.getExtraMenu(), [layoutService]);

  const styles_left_tab_bar = useDesignStyles(styles.left_tab_bar, 'left_tab_bar');
  const styles_left_tab = useDesignStyles(styles.left_tab, 'left_tab');

  return (
    <div
      id={VIEW_CONTAINERS.LEFT_TABBAR}
      className={styles_left_tab_bar}
      onContextMenu={tabbarService.handleContextMenu}
    >
      {isRenderExtraTopMenus && (
        <InlineMenuBar className={cls(styles.vertical_icons, styles.extra_top_menus)} menus={extraTopMenus} />
      )}
      <TabbarViewBase
        tabSize={48}
        MoreTabView={IconElipses}
        className={styles.left_tab_content}
        tabClassName={styles_left_tab}
        TabView={IconTabView}
        barSize={48}
        margin={90}
        panelBorderSize={1}
        renderOtherVisibleContainers={renderOtherVisibleContainers}
        {...tabbarViewProps}
      />
      {renderExtraMenus || <InlineMenuBar className={styles.vertical_icons} menus={extraMenus} />}
    </div>
  );
};

export const BottomTabbarRenderer: React.FC = () => {
  const { side } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  const styles_bottom_bar_container = useDesignStyles(styles.bottom_bar_container, 'bottom_bar_container');
  const styles_bottom_tab = useDesignStyles(styles.bottom_tab, 'bottom_tab');
  return (
    <div
      id={VIEW_CONTAINERS.BOTTOM_TABBAR}
      onContextMenu={tabbarService.handleContextMenu}
      className={cls(styles_bottom_bar_container, 'next_bottom_bar')}
    >
      <TabbarViewBase
        // TODO: 暂时通过预估值来计算是否超出可视范围，实际上需要通过dom尺寸的计算
        tabSize={80}
        MoreTabView={TextElipses}
        tabClassName={styles_bottom_tab}
        TabView={TextTabView}
        barSize={24}
        panelBorderSize={1}
        canHideTabbar
      />
    </div>
  );
};

export const ChatTabbarRenderer2: React.FC<{ barSize?: number; style?: React.CSSProperties }> = (props) => {
  const { barSize = 32, style } = props;
  const { side } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  useEffect(() => {
    tabbarService.setIsLatter(true);
  }, [tabbarService]);
  const styles_right_tab_bar = useDesignStyles(styles.ai_right_tab_bar, 'ai_right_tab_bar');
  const styles_right_tab = useDesignStyles(styles.ai_right_tab, 'ai_right_tab');

  return (
    <div id={side} className={styles_right_tab_bar} style={style} onContextMenu={tabbarService.handleContextMenu}>
      <TabbarViewBase
        tabSize={32}
        MoreTabView={IconElipses}
        tabClassName={styles_right_tab}
        TabView={IconTabView}
        barSize={barSize}
        panelBorderSize={1}
      />
    </div>
  );
};
