import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Widget } from '@phosphor/widgets';
import { ConfigContext, useInjectable } from '@ali/ide-core-browser';
import { BottomDockPanelWidget } from './bottom-dockpanel-widget.view';
import './bottom-panel.less';
import { BottomPanelService } from './bottom-panel.service';
import { BottomPanelWidget } from './bottom-panel-widget.view';

export const BottomPanel = observer(() => {

  const ref = React.useRef<HTMLElement | null>();

  const configContext = React.useContext(ConfigContext);
  const { injector } = configContext;
  const bottomPanelService = useInjectable(BottomPanelService);

  React.useEffect(() => {

    if (ref.current) {
      const bottomPanelWidget = injector.get(BottomDockPanelWidget);

      bottomPanelService.panels.map((panel) => {
        const widget = new BottomPanelWidget(panel.component, configContext);
        widget.title.label = panel.title;
        bottomPanelWidget.addWidget(widget);
      });

      Widget.attach(bottomPanelWidget, ref.current);
    }
  });

  return (
    <div className='bottom-panel' ref={(el) => ref.current = el}></div>
  );
});
