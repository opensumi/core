import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './activator-bar.module.less';
import { ISignal, Signal } from '@phosphor/signaling';
import { BoxLayout, StackedPanel, TabBar, Widget, Title } from '@phosphor/widgets';
import { ActivatorBarWidget } from './activator-bar-widget.view';
import { ConfigContext, SlotRenderer, ConfigProvider } from '@ali/ide-core-browser';

export const ActivatorBar = observer(() => {

  const ref = React.useRef<HTMLElement | null>();
  const configContext = React.useContext(ConfigContext);
  const { injector } = configContext;

  React.useEffect(() => {

    if (ref.current) {
      const tabBarWidget = injector.get(ActivatorBarWidget);

      const node = document.createElement('div');
      node.innerHTML = 'filetree in here';
      const widget = new Widget({node});
      widget.title.label = 'filetree';

      const node2 = document.createElement('div');
      node2.innerHTML = 'filetree in here 2';
      const widget2 = new Widget({node});
      widget2.title.label = 'filetree2';

      tabBarWidget.addWidget(widget);
      tabBarWidget.addWidget(widget2);

      Widget.attach(tabBarWidget, ref.current);
    }

  });

  return (
    <div className={ styles.wrap } ref={(ele) => ref.current = ele}></div>
  );
});
