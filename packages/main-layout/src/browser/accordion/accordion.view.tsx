import { observer } from 'mobx-react-lite';
import React from 'react';

import { View, useInjectable } from '@opensumi/ide-core-browser';
import { EDirection, Layout, SplitPanel } from '@opensumi/ide-core-browser/lib/components';
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
    headerSize = 24,
    minSize = 120,
    className,
    noRestore,
    style,
  }: AccordionContainerProps) => {
    const accordionService: AccordionService = useInjectable(AccordionServiceFactory)(containerId, noRestore);
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
      accordionService.initConfig({ headerSize, minSize });
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
              headerSize={headerSize}
              minSize={headerSize}
              initialProps={view.initialProps}
              titleMenu={titleMenu}
              titleMenuContext={view.titleMenuContext}
              savedSize={collapsed ? headerSize : nextSize}
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
