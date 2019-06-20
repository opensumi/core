import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ConfigContext, useInjectable } from '@ali/ide-core-browser';
import '@ali/ide-i18n';
import { localize } from '@ali/ide-core-common';

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

  React.useEffect(function widgetsInit() {
    if (ref.current) {
      const menuBar = menuFactory.createMenuBar();
      Widget.attach(menuBar, ref.current);
    }
  }, [ref]);

  return (
    <div className='menu-bar' ref={(ele) => ref.current = ele} />
  );
});
