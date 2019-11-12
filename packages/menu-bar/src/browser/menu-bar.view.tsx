import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ConfigContext, useInjectable, ComponentRenderer, ComponentRegistry, MenuModelRegistry, IEventBus, MenuUpdateEvent, MAIN_MENU_BAR } from '@ali/ide-core-browser';
import { localize, isWindows, isElectronRenderer } from '@ali/ide-core-browser';

import { BrowserMainMenuFactory } from '@ali/ide-core-browser/lib/menu';
import { MenuBarService } from './menu-bar.service';
import './menu-bar.less';
import './menu.less';
import { Widget } from '@phosphor/widgets';

let attachedWidget: Widget | null = null;

export const MenuBar = observer(() => {

  const ref = React.useRef<HTMLElement | null>();
  const { injector } = React.useContext(ConfigContext);
  const menuBarService = injector.get(MenuBarService);
  const menuFactory = useInjectable(BrowserMainMenuFactory);
  const eventBus: IEventBus = useInjectable(IEventBus);

  React.useEffect(function widgetsInit() {
    updateMenu();
    const disposer = eventBus.on(MenuUpdateEvent, (e) => {
      if (e.payload && e.payload[0] === MAIN_MENU_BAR[0]) {
        updateMenu();
      }
    });
    return () => disposer.dispose();
  }, [ref]);

  function updateMenu() {
    if (ref.current) {
      const menuBar = menuFactory.createMenuBar();
      if (attachedWidget) {
        Widget.detach(attachedWidget);
      }
      Widget.attach(menuBar, ref.current);
      attachedWidget = menuBar;
    }
  }

  return (
    <div className='menu-bar' ref={(ele) => ref.current = ele} />);
});
