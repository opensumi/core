import cls from 'classnames';
import React, { FC, createContext, memo, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { ComponentRegistryInfo, IEventBus, ResizeEvent, useInjectable } from '@opensumi/ide-core-browser';
import { PanelContext } from '@opensumi/ide-core-browser/lib/components';
import { Layout } from '@opensumi/ide-core-browser/lib/components/layout/layout';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';

import { BottomTabbarRenderer, LeftTabbarRenderer, RightTabbarRenderer } from './bar.view';
import { BottomTabPanelRenderer, LeftTabPanelRenderer, RightTabPanelRenderer } from './panel.view';
import styles from './styles.module.less';
import { TabbarService, TabbarServiceFactory } from './tabbar.service';

export const TabbarConfig = createContext<{
  side: string;
  direction: Layout.direction;
  fullSize: number;
}>({
  side: 'left',
  direction: 'left-to-right',
  fullSize: 0,
});

export const TabRendererBase: FC<{
  side: string;
  id?: string;
  className?: string;
  components: ComponentRegistryInfo[];
  direction?: Layout.direction;
  TabbarView: FC;
  TabpanelView: FC;
}> = memo(({ id, className, components, direction = 'left-to-right', TabbarView, side, TabpanelView }) => {
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  const eventBus = useInjectable<IEventBus>(IEventBus);
  const resizeHandle = useContext(PanelContext);
  const rootRef = useRef<HTMLDivElement>(null);
  const [fullSize, setFullSize] = useState(0);

  useLayoutEffect(() => {
    if (components.length <= 0) {
      return;
    }
    tabbarService.registerResizeHandle(resizeHandle);
    components.forEach((component) => {
      tabbarService.registerContainer(component.options!.containerId, component);
    });
    tabbarService.updatePanelVisibility();
    tabbarService.viewReady.resolve();
  }, [components]);

  useEffect(() => {
    if (rootRef.current) {
      setFullSize(rootRef.current[Layout.getDomSizeProperty(direction)]);
      let lastFrame: number | null;
      eventBus.on(ResizeEvent, (e) => {
        if (e.payload.slotLocation === side) {
          if (lastFrame) {
            window.cancelAnimationFrame(lastFrame);
          }
          lastFrame = window.requestAnimationFrame(() => {
            setFullSize(rootRef.current![Layout.getDomSizeProperty(direction)]);
          });
        }
      });
    }
  }, []);

  return (
    <div
      ref={rootRef}
      id={id}
      className={cls(styles.tab_container, className)}
      style={{ flexDirection: Layout.getFlexDirection(direction) }}
    >
      <TabbarConfig.Provider value={{ side, direction, fullSize }}>
        <TabbarView />
        <TabpanelView />
      </TabbarConfig.Provider>
    </div>
  );
});

export const RightTabRenderer = ({
  className,
  components,
  tabbarView,
}: {
  className: string;
  components: ComponentRegistryInfo[];
  tabbarView?: FC<{}>;
}) => (
  <TabRendererBase
    side='right'
    direction='right-to-left'
    id={VIEW_CONTAINERS.RIGHT_TABBAR_PANEL}
    className={cls(className, 'right-slot')}
    components={components}
    TabbarView={tabbarView ?? RightTabbarRenderer}
    TabpanelView={RightTabPanelRenderer}
  />
);

export const LeftTabRenderer = ({
  className,
  components,
  tabbarView,
}: {
  className: string;
  components: ComponentRegistryInfo[];
  tabbarView?: FC<{}>;
}) => (
  <TabRendererBase
    side='left'
    direction='left-to-right'
    id={VIEW_CONTAINERS.LEFT_TABBAR_PANEL}
    className={cls(className, 'left-slot')}
    components={components}
    TabbarView={tabbarView ?? LeftTabbarRenderer}
    TabpanelView={LeftTabPanelRenderer}
  />
);

export const BottomTabRenderer = ({
  className,
  components,
  tabbarView,
}: {
  className: string;
  components: ComponentRegistryInfo[];
  tabbarView?: FC<{}>;
}) => (
  <TabRendererBase
    side='bottom'
    id={VIEW_CONTAINERS.BOTTOM_TABBAR_PANEL}
    direction='bottom-to-top'
    className={cls(className, 'bottom-slot')}
    components={components}
    TabbarView={tabbarView ?? BottomTabbarRenderer}
    TabpanelView={BottomTabPanelRenderer}
  />
);
