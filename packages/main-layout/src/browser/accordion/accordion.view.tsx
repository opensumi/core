import React, { useMemo } from 'react';

import { View, useAutorun, useInjectable } from '@opensumi/ide-core-browser';
import { EDirection, Layout, SplitPanel } from '@opensumi/ide-core-browser/lib/components';
import { LayoutViewSizeConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { replaceLocalizePlaceholder } from '@opensumi/ide-core-common';

import { AccordionService, AccordionServiceFactory, SectionState } from './accordion.service';
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

export const AccordionContainer = ({
  alignment = 'vertical',
  views,
  containerId,
  headerSize = 24,
  minSize = 120,
  className,
  noRestore,
  style,
}: AccordionContainerProps) => {
  const layoutViewSize = useInjectable<LayoutViewSizeConfig>(LayoutViewSizeConfig);

  const accordionService: AccordionService = useInjectable(AccordionServiceFactory)(containerId, noRestore);
  const visibleViews = useAutorun(accordionService.visibleViews);

  useAutorun(accordionService.stateObservable);

  const layoutHeaderSize = useMemo(() => headerSize || layoutViewSize.accordionHeaderSizeHeight!, [headerSize]);

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

  return (
    <SplitPanel
      className={className}
      style={style}
      headerSize={headerSize}
      dynamicTarget={true}
      id={containerId}
      resizeKeep={false}
      direction={alignment === 'horizontal' ? EDirection.LeftToRight : EDirection.TopToBottom}
    >
      {visibleViews.map((view, index) => {
        const viewState: SectionState = accordionService.getViewState(view.id);
        const titleMenu = view.titleMenu || accordionService.getSectionToolbarMenu(view.id);
        const { collapsed, nextSize } = viewState;

        return (
          <AccordionSection
            noHeader={visibleViews.length === 1}
            onItemClick={() => {
              accordionService.handleSectionClick(view.id, !collapsed, index);
            }}
            onContextMenuHandler={accordionService.handleContextMenu}
            alignment={alignment as Layout.alignment}
            header={(view.name && replaceLocalizePlaceholder(view.name)) || view.id}
            viewId={view.id}
            key={view.id}
            message={view.message}
            description={view.description}
            badge={view.badge}
            title={view.name}
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
};

AccordionContainer.displayName = 'AccordionContainer';

export interface PanelProps extends React.PropsWithChildren<any> {
  flex: number;
}

export const Panel: React.FC<PanelProps> = ({ children }) => <div>{children}</div>;
Panel.displayName = 'Panel';
