import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { SidePanelService } from './side-panel.service';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';

import './index.css';

export const SidePanel = observer(() => {
  const ref = React.useRef<HTMLElement | null>();
  const instance = useInjectable(SidePanelService);

  React.useEffect(() => {
    if (ref.current) {
      instance.init(ref.current as HTMLElement);
    }
  }, [ref]);

  return (
    <div className='side-panel-container' ref={(el) => ref.current = el} />
  );
});
