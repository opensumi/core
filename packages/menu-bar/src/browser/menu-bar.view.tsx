import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ConfigContext, useInjectable, SlotRenderer, ComponentRegistry } from '@ali/ide-core-browser';
import { localize, isWindows, isElectronRenderer } from '@ali/ide-core-browser';

import { BrowserMainMenuFactory } from '@ali/ide-core-browser/lib/menu';
import { MenuBarService } from './menu-bar.service';
import './menu-bar.less';
import './menu.less';
import { Widget } from '@phosphor/widgets';

export const MenuBar = observer(() => {

  const ref = React.useRef<HTMLElement | null>();
  const { injector } = React.useContext(ConfigContext);
  const menuBarService = injector.get(MenuBarService);
  const menuFactory = useInjectable(BrowserMainMenuFactory);
  const componentRegistry: ComponentRegistry = useInjectable(ComponentRegistry);

  React.useEffect(function widgetsInit() {
    if (ref.current) {
      const menuBar = menuFactory.createMenuBar();
      Widget.attach(menuBar, ref.current);
    }
  }, [ref]);

  return (
    <div>
      <div className='menu-bar' ref={(ele) => ref.current = ele} />
      {
        isElectronRenderer() && !!componentRegistry.getComponentRegistryInfo('electron-header') ? <SlotRenderer Component={componentRegistry.getComponentRegistryInfo('electron-header')!.views[0].component!}/> : null
      }
    </div>
  );
});
