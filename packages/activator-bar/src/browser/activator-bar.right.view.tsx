import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ISignal, Signal } from '@phosphor/signaling';
import { BoxLayout, StackedPanel, TabBar, Widget, Title } from '@phosphor/widgets';
import { ActivatorBarWidget } from './activator-bar-widget.view';
import { ConfigContext, SlotRenderer, ConfigProvider } from '@ali/ide-core-browser';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import './activator-bar.less';
import { ActivatorBarService } from './activator-bar.service';
import { ActivatorPanelWidget } from '@ali/ide-activator-panel/lib/browser/activator-panel-widget';
import { autorun } from 'mobx';

export const ActivatorBarRight = observer(() => {

  const ref = React.useRef<HTMLElement | null>();
  const configContext = React.useContext(ConfigContext);
  const { injector } = configContext;
  const activatorBarService: ActivatorBarService = useInjectable(ActivatorBarService);

  React.useEffect(() => {
    let disposer;
    if (ref.current) {
      const tabBarWidget = injector.get(ActivatorBarWidget, ['right']);
      disposer = autorun(() => {
        if (activatorBarService.rightPanels) {
          activatorBarService.rightPanels.map((panel) => {
            const widget = new ActivatorPanelWidget(panel.component, configContext);
            widget.title.iconClass = `activator-icon ${panel.iconClass}`;
            tabBarWidget.addWidget(widget, 'right');
          });
        }
        if (tabBarWidget.isAttached) {
          Widget.detach(tabBarWidget);
        }
        Widget.attach(tabBarWidget, ref.current!);
      });
    }
    return () => {
      disposer.dispose();
    };
  });

  return (
    <div className='activator-bar' ref={(ele) => ref.current = ele}></div>
  );
});
