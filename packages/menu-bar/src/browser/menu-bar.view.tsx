import * as React from 'react';
import { observer } from 'mobx-react-lite';

import {
  CommandRegistry as PhosphorCommandRegistry,
} from '@phosphor/commands';


import {
  Menu, MenuBar as WidgetsMenuBar, Widget,
} from '@phosphor/widgets';
import { ConfigContext } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { MenuBarService } from './menu-bar.service';

import './index.css';

export const MenuBar = observer(() => {

  const ref = React.useRef<HTMLElement | null>();
  const { injector } = React.useContext(ConfigContext);
  const menuBarService = injector.get(MenuBarService);

  React.useEffect(function widgetsInit() {

    if (ref.current) {

      const commands = new PhosphorCommandRegistry();
      commands.addCommand('example:hide', {
        execute: () => {
          menuBarService.hidePanel(SlotLocation.rightPanel);
        },
        iconClass: 'fa fa-cut',
        label: '隐藏右侧面板',
        mnemonic: 1,
      });

      // NOTE 注册按键绑定
      commands.addKeyBinding({
        command: 'example:hide',
        keys: ['Accel X'],
        selector: 'body',
      });

      function createMenu(): Menu {
        // NOTE 子菜单、子菜单嵌套
        const sub1 = new Menu({ commands });
        sub1.title.label = '外观';
        sub1.title.mnemonic = 0;
        sub1.addItem({ command: 'example:hide' });


        const root = new Menu({ commands });
        root.addItem({ type: 'separator' });
        root.addItem({ type: 'submenu', submenu: sub1 });

        return root;
      }

      const menu1 = createMenu();
      menu1.title.label = 'File';
      menu1.title.mnemonic = 0;

      const menu2 = createMenu();
      menu2.title.label = 'Edit';
      menu2.title.mnemonic = 0;

      const menu3 = createMenu();
      menu3.title.label = 'View';
      menu3.title.mnemonic = 0;
      const menuBar = new WidgetsMenuBar();
      menuBar.addMenu(menu1);
      menuBar.addMenu(menu2);
      menuBar.addMenu(menu3);

      Widget.attach(menuBar, ref.current);

      return function destory() {
        // ReactDOM.unmountComponentAtNode($container)
      };
    }
  }, [ref]);

  return (
    <div ref={(ele) => ref.current = ele} />
  );
});
