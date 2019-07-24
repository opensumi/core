import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Widget, SingletonLayout } from '@phosphor/widgets';
import './activator-panel.less';
import { ConfigContext } from '@ali/ide-core-browser';
import { ActivatorPanelService } from './activator-panel.service';

export const ActivatorPanelRight = observer(() => {

  const ref = React.useRef<HTMLElement | null>();
  const configContext = React.useContext(ConfigContext);
  const { injector } = configContext;

  React.useEffect(() => {

    if (ref.current) {
      const panelService = injector.get(ActivatorPanelService);
      const layout = new SingletonLayout({fitPolicy: 'set-min-size'});
      layout.widget = panelService.getPanel('right');
      const widget = new Widget();
      widget.layout = layout;
      Widget.attach(widget, ref.current);
    }

  }, [ref]);

  return (
    <div className='activator-panel' ref={(ele) => ref.current = ele}></div>
  );
});
