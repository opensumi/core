import cls from 'classnames';
import React, {
  FC,
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import {
  ComponentRegistryInfo,
  IDisposable,
  IEventBus,
  ResizeEvent,
  SlotLocation,
  fastdom,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { EDirection, PanelContext } from '@opensumi/ide-core-browser/lib/components';
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
  side: SlotLocation.left,
  direction: EDirection.LeftToRight,
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
}> = memo(({ id, className, components, direction = EDirection.LeftToRight, TabbarView, side, TabpanelView }) => {
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  const eventBus = useInjectable<IEventBus>(IEventBus);
  const resizeHandle = useContext(PanelContext);
  const rootRef = useRef<HTMLDivElement>(null);
  const [fullSize, setFullSize] = useState(0);

  useLayoutEffect(() => {
    tabbarService.registerResizeHandle(resizeHandle);
    components.forEach((component) => {
      tabbarService.registerContainer(component.options!.containerId, component);
    });
    tabbarService.updatePanelVisibility();
    tabbarService.ensureViewReady();
  }, [components]);

  const refreshFullSize = useCallback(() => {
    if (rootRef.current) {
      setFullSize(rootRef.current[Layout.getDomSizeProperty(direction)]);
    }
  }, []);

  useEffect(() => {
    fastdom.measure(() => {
      refreshFullSize();
    });

    let toDispose: IDisposable | undefined;

    eventBus.onDirective(ResizeEvent.createDirective(side), () => {
      if (toDispose) {
        toDispose.dispose();
      }

      toDispose = fastdom.measureAtNextFrame(() => {
        refreshFullSize();
      });
    });
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
  tabpanelView,
}: {
  className: string;
  components: ComponentRegistryInfo[];
  tabbarView?: FC<{}>;
  tabpanelView?: FC<{}>;
}) => (
  <TabRendererBase
    side={SlotLocation.right}
    direction={EDirection.RightToLeft}
    id={VIEW_CONTAINERS.RIGHT_TABBAR_PANEL}
    className={cls(className, 'right-slot')}
    components={components}
    TabbarView={tabbarView ?? RightTabbarRenderer}
    TabpanelView={tabpanelView ?? RightTabPanelRenderer}
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
    side={SlotLocation.left}
    direction={EDirection.LeftToRight}
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
    side={SlotLocation.bottom}
    id={VIEW_CONTAINERS.BOTTOM_TABBAR_PANEL}
    direction={EDirection.BottomToTop}
    className={cls(className, 'bottom-slot')}
    components={components}
    TabbarView={tabbarView ?? BottomTabbarRenderer}
    TabpanelView={BottomTabPanelRenderer}
  />
);
