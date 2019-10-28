import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Widget, SingletonLayout } from '@phosphor/widgets';
import { ConfigContext } from '@ali/ide-core-browser';
import { ActivityPanelService } from './activity-panel.service';

export const ActivityPanelRight = observer(() => {

  const ref = React.useRef<HTMLElement | null>();
  const configContext = React.useContext(ConfigContext);
  const { injector } = configContext;

  React.useEffect(() => {

    if (ref.current) {
      const panelService = injector.get(ActivityPanelService);
      const layout = new SingletonLayout({fitPolicy: 'set-min-size'});
      layout.widget = panelService.getPanel('right');
      const widget = new Widget();
      widget.layout = layout;
      Widget.attach(widget, ref.current);
    }

  }, [ref]);

  return (
    <div className='activity-panel' ref={(ele) => ref.current = ele}></div>
  );
});
