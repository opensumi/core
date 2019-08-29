import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Widget } from '@phosphor/widgets';
import { ConfigContext, useInjectable } from '@ali/ide-core-browser';
import './bottom-panel.less';
import { BottomPanelService } from './bottom-panel.service';
import { BottomPanelWidget } from './bottom-panel-widget.view';

export const BottomPanel = observer(() => {

  const ref = React.useRef<HTMLElement | null>();

  const configContext = React.useContext(ConfigContext);
  const { injector } = configContext;

  React.useEffect(() => {

    if (ref.current) {
    }
  });

  return (
    <div className='bottom-panel' ref={(el) => ref.current = el}></div>
  );
});
