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
}> = observer(({ alignment = 'vertical', views, containerId, initState = new Map() }) => {
  const accordionService: AccordionService = useInjectable(AccordionServiceFactory)(containerId);
  React.useEffect(() => {
    for (const view of views) {
      accordionService.appendView(view);
    }
  }, []);
  return <SplitPanel id={containerId} resizeKeep={false} direction={alignment === 'horizontal' ? 'left-to-right' : 'top-to-bottom'}>
    {accordionService.visibleViews.map((view, index) => {
      let viewState: SectionState | undefined = accordionService.state.get(view.id);
      if (!viewState) {
        accordionService.state.set(view.id, initState.get(view.id) || { collapsed: false, hidden: false });
        viewState = accordionService.state.get(view.id)!;
      }
      const titleMenu = accordionService.getSectionToolbarMenu(view.id);
      const { collapsed } = viewState;
      return <AccordionSection
        noHeader={accordionService.visibleViews.length === 1}
        onItemClick={() => accordionService.handleSectionClick(view.id, !collapsed, index)}
        alignment={alignment as Layout.alignment}
        header={view.name || view.id}
        viewId={view.id}
        key={view.id}
        expanded={!collapsed}
        id={view.id}
        index={index}
        initialProps={view.initialProps}
        titleMenu={titleMenu}
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
