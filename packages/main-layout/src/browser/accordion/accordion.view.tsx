import { observer } from 'mobx-react-lite';
import React, { useMemo } from 'react';

import { AppConfig, View, useInjectable } from '@opensumi/ide-core-browser';
import { EDirection, Layout, SplitPanel } from '@opensumi/ide-core-browser/lib/components';
import { LAYOUT_VIEW_SIZE } from '@opensumi/ide-core-browser/lib/layout/constants';
import { replaceLocalizePlaceholder } from '@opensumi/ide-core-common';

import { AccordionServiceFactory, AccordionService, SectionState } from './accordion.service';
import { AccordionSection } from './section.view';

interface AccordionContainerProps {
  alignment?: Layout.alignment;
  views: View[];
  initState?: Map<string, SectionState>;
  containerId: string;
  headerSize?: number;
  minSize?: number;
  noRestore?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const AccordionContainer = observer(
  ({
    alignment = 'vertical',
    views,
    containerId,
    headerSize,
    minSize = 120,
    className,
    noRestore,
    style,
  }: AccordionContainerProps) => {
    const accordionService: AccordionService = useInjectable(AccordionServiceFactory)(containerId, noRestore);
    const appConfig: AppConfig = useInjectable(AppConfig);

    const layoutHeaderSize = useMemo(() => {
      if (headerSize) {
        return headerSize;
      }

      return appConfig.layoutViewSize
        ? appConfig.layoutViewSize.ACCORDION_HEADER_SIZE_HEIGHT
        : LAYOUT_VIEW_SIZE.ACCORDION_HEADER_SIZE_HEIGHT;
    }, [headerSize]);

    React.useEffect(() => {
      // 解决视图在渲染前注册的问题
      if (!views.length) {
        return;
      }
      for (const view of views) {
        accordionService.appendView(view);
      }
    }, [views]);
    React.useEffect(() => {
      accordionService.initConfig({ headerSize: layoutHeaderSize, minSize });
    }, []);
    const allCollapsed = !accordionService.visibleViews.find((view) => {
      const viewState: SectionState = accordionService.getViewState(view.id);
      return !viewState.collapsed;
    });

    return (
      <SplitPanel
        className={className}
        style={style}
        dynamicTarget={true}
        id={containerId}
        resizeKeep={false}
        useDomSize={allCollapsed}
        direction={alignment === 'horizontal' ? EDirection.LeftToRight : EDirection.TopToBottom}
      >
        {accordionService.visibleViews.map((view, index) => {
          const viewState: SectionState = accordionService.getViewState(view.id);
          const titleMenu = view.titleMenu || accordionService.getSectionToolbarMenu(view.id);
          const { collapsed, nextSize } = viewState;
          return (
            <AccordionSection
              noHeader={accordionService.visibleViews.length === 1}
              onItemClick={() => {
                accordionService.handleSectionClick(view.id, !collapsed, index);
              }}
              onContextMenuHandler={accordionService.handleContextMenu}
              alignment={alignment as Layout.alignment}
              header={(view.name && replaceLocalizePlaceholder(view.name)) || view.id}
              viewId={view.id}
              key={view.id}
              expanded={!collapsed}
              accordionService={accordionService}
              index={index}
              headerSize={layoutHeaderSize}
              minSize={layoutHeaderSize}
              initialProps={view.initialProps}
              titleMenu={titleMenu}
              titleMenuContext={view.titleMenuContext}
              savedSize={collapsed ? layoutHeaderSize : nextSize}
              flex={view.weight || 1}
            >
              {view.component}
            </AccordionSection>
          );
        })}
      </SplitPanel>
    );
  },
);

AccordionContainer.displayName = 'AccordionContainer';

export interface PanelProps extends React.PropsWithChildren<any> {
  flex: number;
}

export const Panel: React.FC<PanelProps> = ({ children }) => <div>{children}</div>;
Panel.displayName = 'Panel';
