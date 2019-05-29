import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ISignal, Signal } from '@phosphor/signaling';
import { BoxLayout, StackedPanel, TabBar, Widget, Title } from '@phosphor/widgets';
import { ActivatorBarWidget } from './activator-bar-widget.view';
import { ConfigContext, SlotRenderer, ConfigProvider } from '@ali/ide-core-browser';
import './activator-bar.less';

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
      widget.title.iconClass = 'fa fa-file-code-o';

      const widget2 = new Widget();
      widget2.node.innerHTML = 'filetree in here 2';
      widget2.title.iconClass = 'fa fa-git';

      tabBarWidget.addWidget(widget);
      tabBarWidget.addWidget(widget2);

      Widget.attach(tabBarWidget, ref.current);
    }

  });

  return (
    <div className='activator-bar' ref={(ele) => ref.current = ele}></div>
  );
});
