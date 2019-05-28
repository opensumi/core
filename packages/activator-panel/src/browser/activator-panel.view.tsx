import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './activator-panel.module.less';
import { ISignal, Signal } from '@phosphor/signaling';
import { BoxLayout, StackedPanel, TabBar, Widget } from '@phosphor/widgets';
import { ActivatorPanelWidget } from './activator-panel-widget.view';
import { ConfigContext, SlotRenderer, ConfigProvider } from '@ali/ide-core-browser';

export const ActivatorPanel = observer(() => {

  const ref = React.useRef<HTMLElement | null>();
  const configContext = React.useContext(ConfigContext);
  const { injector } = configContext;

  React.useEffect(() => {

    if (ref.current) {
      const tabPanelWidget = injector.get(ActivatorPanelWidget);

      Widget.attach(tabPanelWidget, ref.current);
    }

  });

  return (
    <div className={ styles.wrap } ref={(ele) => ref.current = ele}></div>
  );
});
