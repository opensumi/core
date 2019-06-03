import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ISignal, Signal } from '@phosphor/signaling';
import { BoxLayout, StackedPanel, TabBar, Widget } from '@phosphor/widgets';
import { ActivatorStackedPanelWidget } from './activator-stackedpanel-widget.view';
import { ConfigContext, SlotRenderer, ConfigProvider } from '@ali/ide-core-browser';
import './activator-panel.less';

export const ActivatorPanel = observer(() => {

  const ref = React.useRef<HTMLElement | null>();
  const configContext = React.useContext(ConfigContext);
  const { injector } = configContext;

  React.useEffect(() => {

    if (ref.current) {
      const tabPanelWidget = injector.get(ActivatorStackedPanelWidget);

      Widget.attach(tabPanelWidget, ref.current);
    }

  });

  return (
    <div className='activator-panel' ref={(ele) => ref.current = ele}></div>
  );
});
