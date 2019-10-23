import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Widget, SingletonLayout } from '@phosphor/widgets';
import { ConfigContext } from '@ali/ide-core-browser';
import { ActivityPanelService } from './activity-panel.service';

export const ActivityPanelBottom = observer(() => {

  const ref = React.useRef<HTMLElement | null>();
  const configContext = React.useContext(ConfigContext);
  const { injector } = configContext;

  React.useEffect(() => {

    if (ref.current) {
      const panelService = injector.get(ActivityPanelService);
      const widget = panelService.getPanel('bottom');
      Widget.attach(widget, ref.current);
    }

  }, [ref]);

  return (
    <div className='bottom-panel' ref={(ele) => ref.current = ele}></div>
  );
});
