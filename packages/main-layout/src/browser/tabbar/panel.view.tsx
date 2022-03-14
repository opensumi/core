import clsx from 'classnames';
import { observer } from 'mobx-react-lite';
import React from 'react';

import { INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  ComponentRegistryInfo,
  useInjectable,
  ComponentRenderer,
  ConfigProvider,
  AppConfig,
  ErrorBoundary,
  useViewState,
} from '@opensumi/ide-core-browser';
import { InlineActionBar, InlineMenuBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { IMenu } from '@opensumi/ide-core-browser/lib/menu/next';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import { ProgressBar } from '@opensumi/ide-core-browser/lib/progress/progress-bar';

import { AccordionServiceFactory, AccordionService } from '../accordion/accordion.service';
import { AccordionContainer } from '../accordion/accordion.view';
import { TitleBar } from '../accordion/titlebar.view';

import { TabbarConfig } from './renderer.view';
import styles from './styles.module.less';
import { TabbarService, TabbarServiceFactory } from './tabbar.service';

const NoUpdateBoundary: React.FC<{ visible: boolean; children: React.ReactElement }> = React.memo(
  ({ children }) => children,
  (prev, next) => !(prev.visible || next.visible),
);

export const BaseTabPanelView: React.FC<{
  PanelView: React.FC<{ component: ComponentRegistryInfo; side: string; titleMenu: IMenu }>;
  // tabPanel的尺寸（横向为宽，纵向高）
  panelSize?: number;
}> = observer(({ PanelView, panelSize }) => {
  const { side } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  const appConfig: AppConfig = useInjectable(AppConfig);
  const customPanelSize = appConfig.panelSizes && appConfig.panelSizes[side];
  const { currentContainerId } = tabbarService;
  const panelVisible = { zIndex: 1, display: 'block' };
  const panelInVisible = { zIndex: -1, display: 'none' };
  React.useEffect(() => {
    // panelSize = 384-1-48
    tabbarService.panelSize = customPanelSize || panelSize || 335;
  }, []);
  // tslint:disable-next-line:no-unused-variable
  const forceUpdate = tabbarService.forceUpdate;

  return (
    <div className={styles.tab_panel}>
      {tabbarService.visibleContainers.map((component) => {
        const containerId = component.options!.containerId;
        const titleMenu = tabbarService.getTitleToolbarMenu(containerId);
        return (
          <div
            key={containerId}
            className={clsx(styles.panel_wrap, containerId) /* @deprecated: query by data-viewlet-id */}
            data-viewlet-id={containerId}
            style={currentContainerId === containerId ? panelVisible : panelInVisible}
          >
            <ErrorBoundary>
              <NoUpdateBoundary visible={currentContainerId === containerId}>
                <PanelView titleMenu={titleMenu} side={side} component={component} />
              </NoUpdateBoundary>
            </ErrorBoundary>
          </div>
        );
      })}
    </div>
  );
});

const ContainerView: React.FC<{
  component: ComponentRegistryInfo;
  side: string;
  titleMenu: IMenu;
}> = ({ component, titleMenu, side }) => {
  const ref = React.useRef<HTMLElement | null>();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const configContext = useInjectable<AppConfig>(AppConfig);
  const { title, titleComponent, component: CustomComponent, containerId } = component.options!;
  const injector: Injector = useInjectable(INJECTOR_TOKEN);
  const handleContextMenu = (e: React.MouseEvent) => {
    const accordionService: AccordionService = injector.get(AccordionServiceFactory)(containerId);
    accordionService.handleContextMenu(e);
  };
  const progressService: IProgressService = useInjectable(IProgressService);
  const indicator = progressService.getIndicator(containerId)!;
  const viewState = useViewState(side, containerRef);

  return (
    <div ref={containerRef} className={styles.view_container}>
      {!CustomComponent && (
        <div onContextMenu={handleContextMenu} className={styles.panel_titlebar}>
          {!title ? null : <TitleBar title={title!} menubar={<InlineActionBar menus={titleMenu} />} />}
          {titleComponent && (
            <div className={styles.panel_component}>
              <ConfigProvider value={configContext}>
                <ComponentRenderer Component={titleComponent} initialProps={component.options?.titleProps} />
              </ConfigProvider>
            </div>
          )}
        </div>
      )}
      <div className={styles.container_wrap} ref={(ele) => (ref.current = ele)}>
        <ProgressBar progressModel={indicator.progressModel} />
        {CustomComponent ? (
          <ConfigProvider value={configContext}>
            <ComponentRenderer
              initialProps={{ viewState, ...component.options!.initialProps }}
              Component={CustomComponent}
            />
          </ConfigProvider>
        ) : (
          <AccordionContainer views={component.views} containerId={component.options!.containerId} />
        )}
      </div>
    </div>
  );
};

const PanelView: React.FC<{
  component: ComponentRegistryInfo;
  side: string;
  titleMenu: IMenu;
}> = ({ component, titleMenu, side }) => {
  const contentRef = React.useRef<HTMLDivElement | null>();
  const titleComponent = component.options && component.options.titleComponent;
  return (
    <div className={styles.panel_container} ref={(ele) => (contentRef.current = ele)}>
      <div className={styles.float_container}>
        {titleComponent && (
          <div className={styles.toolbar_container}>
            <ComponentRenderer Component={titleComponent} initialProps={component.options?.titleProps} />
          </div>
        )}
        <div className='toolbar_container'>{titleMenu && <InlineActionBar menus={titleMenu} />}</div>
      </div>
      <ComponentRenderer
        initialProps={component.options && component.options.initialProps}
        Component={component.views[0].component || component.options!.component!}
      />
    </div>
  );
};

const NextPanelView: React.FC<{
  component: ComponentRegistryInfo;
  side: string;
  titleMenu: IMenu;
}> = ({ component, titleMenu, side }) => {
  const contentRef = React.useRef<HTMLDivElement | null>();
  const titleComponent = component.options && component.options.titleComponent;
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  // 注入自定义视图 or 通过views注入视图
  const progressService: IProgressService = useInjectable(IProgressService);
  const indicator = progressService.getIndicator(component.options!.containerId)!;
  const viewState = useViewState(side, contentRef);

  return (
    <div className={styles.panel_container}>
      <div className={styles.panel_title_bar}>
        <h1>{component.options!.title}</h1>
        <div className={styles.title_component_container}>
          {titleComponent && (
            <ComponentRenderer Component={titleComponent} initialProps={component.options?.titleProps} />
          )}
        </div>
        <div className={styles.panel_toolbar_container}>
          {titleMenu && <InlineActionBar menus={titleMenu} />}
          <InlineMenuBar menus={tabbarService.commonTitleMenu} moreAtFirst />
        </div>
      </div>
      <div ref={(ele) => (contentRef.current = ele)} className={styles.panel_wrapper}>
        <ProgressBar progressModel={indicator.progressModel} />
        <ComponentRenderer
          initialProps={{ viewState, ...component.options!.initialProps }}
          Component={component.options!.component ? component.options!.component : component.views[0].component!}
        />
      </div>
    </div>
  );
};

export const RightTabPanelRenderer: React.FC = () => <BaseTabPanelView PanelView={ContainerView} />;

export const LeftTabPanelRenderer: React.FC = () => <BaseTabPanelView PanelView={ContainerView} />;

export const BottomTabPanelRenderer: React.FC = () => <BaseTabPanelView PanelView={PanelView} />;

export const NextBottomTabPanelRenderer: React.FC = () => (
  <BaseTabPanelView PanelView={NextPanelView} panelSize={280} />
);
