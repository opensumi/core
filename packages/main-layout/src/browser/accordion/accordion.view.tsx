import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { observer } from 'mobx-react-lite';
import { Layout, PanelContext } from '@ali/ide-core-browser/lib/components';
import { SplitPanel } from '@ali/ide-core-browser/lib/components';
import { AccordionSection } from './section.view';
import { View, useInjectable } from '@ali/ide-core-browser';
import { AccordionServiceFactory, AccordionService, SectionState } from './accordion.service';

export const AccordionContainer: React.FC<{
  alignment?: Layout.alignment;
  views: View[];
  initState?: Map<string, SectionState>;
  containerId: string;
  headerSize?: number;
  minSize?: number;
  className?: string;
}> = observer(({ alignment = 'vertical', views, containerId, initState = new Map(), headerSize = 22, minSize = 120, className }) => {
  const accordionService: AccordionService = useInjectable(AccordionServiceFactory)(containerId);
  React.useEffect(() => {
    // 解决视图在渲染前注册的问题
    if (!views.length) { return; }
    accordionService.disposeAll();
    for (const view of views) {
      accordionService.appendView(view);
    }
  }, [views]);
  React.useEffect(() => {
    accordionService.initConfig({headerSize, minSize});
  }, []);
  return <SplitPanel className={className} dynamicTarget={true} id={containerId} resizeKeep={false} direction={alignment === 'horizontal' ? 'left-to-right' : 'top-to-bottom'}>
    {accordionService.visibleViews.map((view, index) => {
      const viewState: SectionState = accordionService.getViewState(view.id);
      const titleMenu = view.titleMenu || accordionService.getSectionToolbarMenu(view.id);
      const { collapsed } = viewState;
      return <AccordionSection
        noHeader={accordionService.visibleViews.length === 1}
        onItemClick={() => accordionService.handleSectionClick(view.id, !collapsed, index)}
        onContextMenuHandler={accordionService.handleContextMenu}
        alignment={alignment as Layout.alignment}
        header={view.name || view.id}
        viewId={view.id}
        key={view.id}
        expanded={!collapsed}
        id={view.id}
        index={index}
        headerSize={headerSize}
        minSize={headerSize}
        initialProps={view.initialProps}
        titleMenu={titleMenu}
        titleMenuContext={view.titleMenuContext}
        flex={view.weight || 1}>
        {view.component}
      </AccordionSection>;
    })
    }
  </SplitPanel>;
});

export interface PanelProps extends React.PropsWithChildren<any> {
  flex: number;
}

export const Panel: React.FC<PanelProps> = ({ flex, children }) => {
  return <div>{children}</div>;
};
