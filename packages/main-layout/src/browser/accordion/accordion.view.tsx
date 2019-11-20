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
  state: Map<string, SectionState>;
  containerId: string;
}> = observer(({ alignment = 'vertical', views, containerId, state }) => {
  const accordionService: AccordionService = useInjectable(AccordionServiceFactory)(containerId);
  return <SplitPanel direction={alignment === 'horizontal' ? 'left-to-right' : 'top-to-bottom'}>
    { views.map((view, index) => {
      const viewState: SectionState = state.get(view.id) || { collapsed: false, hidden: false };
      // TODO hidden支持
      const { collapsed, hidden } = viewState;
      return <AccordionSection
        onItemClick={(setSize: (targetSize: number) => void, currentSize: number) => accordionService.handleSectionClick(view.id, !collapsed, index, currentSize, setSize)}
        alignment={alignment as Layout.alignment}
        header={view.name || view.id}
        viewId={view.id}
        expanded={!collapsed}
        key={view.id}
        index={index}
        isLast={index === views.length - 1}
        flex={view.weight || 1}>
        {view.component}
      </AccordionSection>;
    })
    }
  </SplitPanel>;
});
