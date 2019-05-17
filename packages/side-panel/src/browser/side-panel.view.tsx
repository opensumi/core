import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { SidePanelService } from './side-panel.service';
import { useInjectable } from '@ali/ide-core-browser';

import './index.css';
import { SidePanelRegistry } from './side-panel-registry';
import { RegistryProvider } from './side-panel-registry.view';

export const SidePanel = observer(() => {
  const ref = React.useRef<HTMLElement | null>();
  const instance = useInjectable(SidePanelService);
  const registry = useInjectable(SidePanelRegistry);

  React.useEffect(() => {
    if (ref.current) {
      instance.init(ref.current as HTMLElement);
    }
  }, [ref]);

  return (
    <RegistryProvider value={ registry }>
      <div className='side-panel-container' ref={(el) => ref.current = el} />
    </RegistryProvider>
  );
});
