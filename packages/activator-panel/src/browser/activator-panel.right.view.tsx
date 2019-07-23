import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Widget } from '@phosphor/widgets';
import './activator-panel.less';
import { ActivatorStackedPanelWidget } from './activator-stackedpanel-widget';

export const ActivatorPanelRight = observer(() => {

  const ref = React.useRef<HTMLElement | null>();

  React.useEffect(() => {

    if (ref.current) {
      const tabPanelWidget = new ActivatorStackedPanelWidget();

      Widget.attach(tabPanelWidget, ref.current);
    }

  }, [ref]);

  return (
    <div className='activator-panel' ref={(ele) => ref.current = ele}></div>
  );
});
