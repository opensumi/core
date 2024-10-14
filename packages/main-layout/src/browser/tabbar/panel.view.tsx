import cls from 'classnames';
import { observer } from 'mobx-react-lite';
import React from 'react';

import { INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  AppConfig,
  ComponentRegistryInfo,
  ComponentRenderer,
  ConfigProvider,
  ErrorBoundary,
  useDesignStyles,
  useInjectable,
  useViewState,
} from '@opensumi/ide-core-browser';
import { InlineActionBar, InlineMenuBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { LayoutViewSizeConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { IMenu } from '@opensumi/ide-core-browser/lib/menu/next';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import { ProgressBar } from '@opensumi/ide-core-browser/lib/progress/progress-bar';

import { AccordionService, AccordionServiceFactory } from '../accordion/accordion.service';
import { AccordionContainer } from '../accordion/accordion.view';
import { TitleBar } from '../accordion/titlebar.view';

import { TabbarConfig } from './renderer.view';
import styles from './styles.module.less';
import { TabbarService, TabbarServiceFactory } from './tabbar.service';

const NoUpdateBoundary: React.FC<{ visible: boolean; children: React.ReactElement }> = React.memo(
  ({ children }) => children,
  (prev, next) => !(prev.visible || next.visible),
);

const panelVisible = { display: 'block' };
const panelInVisible = { display: 'none' };

export interface IBaseTabPanelView {
  PanelView: React.FC<{ component: ComponentRegistryInfo; side: string; titleMenu: IMenu }>;
  PanelViewProps?: { [key: string]: any };
  // tabPanel的尺寸（横向为宽，纵向高）
  id?: string;
  panelSize?: number;
}

export const BaseTabPanelView: React.FC<IBaseTabPanelView> = observer((props) => {
  const { PanelView, panelSize, id, PanelViewProps } = props;
  const { side } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  const appConfig: AppConfig = useInjectable(AppConfig);
  const customPanelSize = appConfig.panelSizes && appConfig.panelSizes[side];

  const styles_tab_panel = useDesignStyles(styles.tab_panel, 'tab_panel');
  const styles_tab_panel_hidden = useDesignStyles(styles.tab_panel_hidden, 'tab_panel_hidden');

  React.useEffect(() => {
    // panelSize = 384-1-48
    tabbarService.updatePanelSize(customPanelSize || panelSize || 335);
  }, []);

  return (
    <div
      id={id}
      className={cls('kt-tab-panel', styles_tab_panel, {
        [styles_tab_panel_hidden]: !tabbarService.currentContainerId,
      })}
    >
      {tabbarService.visibleContainers.map((component) => {
        const containerId = component.options?.containerId;
        if (!containerId) {
          return null;
        }
        const titleMenu = tabbarService.getTitleToolbarMenu(containerId);
        return (
          <div
            key={containerId}
            className={cls(styles.panel_wrap, containerId) /* @deprecated: query by data-viewlet-id */}
            data-viewlet-id={containerId}
            style={tabbarService.currentContainerId === containerId ? panelVisible : panelInVisible}
            id={id}
          >
            <ErrorBoundary>
              <NoUpdateBoundary visible={tabbarService.currentContainerId === containerId}>
                <PanelView titleMenu={titleMenu} side={side} component={component} {...PanelViewProps} />
              </NoUpdateBoundary>
            </ErrorBoundary>
          </div>
        );
      })}
    </div>
  );
});

export const ContainerView: React.FC<{
  component: ComponentRegistryInfo;
  side: string;
  titleMenu: IMenu;
  renderContainerWrap?: React.FC<{
    children: React.ReactNode;
  }>;
  className?: string;
}> = observer(({ component, titleMenu, side, renderContainerWrap, className }) => {
  const ref = React.useRef<HTMLElement | null>();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const appConfig = useInjectable<AppConfig>(AppConfig);
  const { title, titleComponent, component: CustomComponent, containerId } = component.options || {};
  const injector: Injector = useInjectable(INJECTOR_TOKEN);
  const layoutViewSize = useInjectable<LayoutViewSizeConfig>(LayoutViewSizeConfig);

  const handleContextMenu = (e: React.MouseEvent) => {
    const accordionService: AccordionService = injector.get(AccordionServiceFactory)(containerId);
    accordionService.handleContextMenu(e);
  };
  if (!containerId) {
    return null;
  }
  const progressService: IProgressService = useInjectable(IProgressService);
  const indicator = progressService.getIndicator(containerId);
  if (!indicator) {
    return null;
  }
  const viewState = useViewState(side, containerRef);

  const renderContainerWrapFn = React.useCallback(
    (node: React.ReactNode) => {
      if (renderContainerWrap) {
        return renderContainerWrap({ children: node });
      }

      return node;
    },
    [renderContainerWrap],
  );

  return (
    <div ref={containerRef} className={cls(styles.view_container, className)}>
      {!CustomComponent && (
        <div onContextMenu={handleContextMenu} className={styles.panel_titlebar}>
          {!title ? null : (
            <TitleBar
              title={title}
              height={layoutViewSize.panelTitleBarHeight}
              menubar={<InlineActionBar menus={titleMenu} />}
            />
          )}
          {titleComponent && (
            <div className={styles.panel_component}>
              <ConfigProvider value={appConfig}>
                <ComponentRenderer Component={titleComponent} initialProps={component.options?.titleProps} />
              </ConfigProvider>
            </div>
          )}
        </div>
      )}
      <div className={styles.container_wrap} ref={(ele) => (ref.current = ele)}>
        <ProgressBar progressModel={indicator.progressModel} />
        {renderContainerWrapFn(
          CustomComponent ? (
            <ConfigProvider value={appConfig}>
              <ComponentRenderer
                initialProps={{ viewState, ...component.options?.initialProps }}
                Component={CustomComponent}
              />
            </ConfigProvider>
          ) : (
            <AccordionContainer
              views={component.views}
              minSize={component.options!.miniSize}
              containerId={component.options!.containerId}
            />
          ),
        )}
      </div>
    </div>
  );
});

const BottomPanelView: React.FC<{
  component: ComponentRegistryInfo;
  side: string;
  titleMenu: IMenu;
}> = observer(({ component, titleMenu, side }) => {
  const ref = React.useRef<HTMLElement | null>();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const appConfig = useInjectable<AppConfig>(AppConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  const styles_panel_title_bar = useDesignStyles(styles.panel_title_bar, 'panel_title_bar');
  const styles_panel_toolbar_container = useDesignStyles(styles.panel_toolbar_container, 'panel_toolbar_container');

  const viewState = useViewState(side, containerRef);
  const layoutViewSize = useInjectable<LayoutViewSizeConfig>(LayoutViewSizeConfig);
  const progressService: IProgressService = useInjectable(IProgressService);

  const { component: CustomComponent, containerId } = component.options || {};
  const titleComponent = component.options && component.options.titleComponent;
  if (!containerId) {
    return null;
  }

  const indicator = progressService.getIndicator(containerId);
  if (!indicator) {
    return null;
  }

  return (
    <div ref={containerRef} className={styles.panel_container}>
      <div className={styles_panel_title_bar} style={{ height: layoutViewSize.panelTitleBarHeight }}>
        <h1>{component.options?.title?.toUpperCase()}</h1>
        <div className={styles.title_component_container}>
          {titleComponent && (
            <ComponentRenderer Component={titleComponent} initialProps={component.options?.titleProps} />
          )}
        </div>
        <div className={styles_panel_toolbar_container}>
          {titleMenu && <InlineActionBar menus={titleMenu} />}
          <InlineMenuBar menus={tabbarService.commonTitleMenu} moreAtFirst />
        </div>
      </div>
      <div className={styles.container_wrap} ref={(ele) => (ref.current = ele)}>
        <ProgressBar progressModel={indicator.progressModel} />
        {CustomComponent ? (
          <ConfigProvider value={appConfig}>
            <ComponentRenderer
              initialProps={{ viewState, ...component.options?.initialProps }}
              Component={CustomComponent}
            />
          </ConfigProvider>
        ) : (
          <AccordionContainer
            views={component.views}
            alignment='horizontal'
            minSize={component.options!.miniSize}
            containerId={component.options!.containerId}
          />
        )}
      </div>
    </div>
  );
});

export const RightTabPanelRenderer: React.FC = () => <BaseTabPanelView PanelView={ContainerView} />;

export const LeftTabPanelRenderer: React.FC = () => <BaseTabPanelView PanelView={ContainerView} />;

export const BottomTabPanelRenderer: React.FC = () => <BaseTabPanelView PanelView={BottomPanelView} panelSize={280} />;
