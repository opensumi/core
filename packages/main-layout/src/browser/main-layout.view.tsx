import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useInjectable, SlotRenderer, RenderNameEnum, ConfigContext } from '@ali/ide-core-browser';
import Store from './main-layout.store';
import { observer } from 'mobx-react-lite';

import {
  CommandRegistry,
} from '@phosphor/commands';

import {
  Message,
} from '@phosphor/messaging';

import {
  BoxPanel, CommandPalette, ContextMenu, DockPanel, Menu, MenuBar, Widget,
} from '@phosphor/widgets';

import './index.css';

export const MainLayout = observer(() => {
  const store = useInjectable(Store);
  const { slotMap } = React.useContext(ConfigContext);

  const ref = React.useRef<HTMLElement | null>();

  React.useEffect(function widgetsInit() {

    if (ref.current) {

      function createNodeBySlot(renderName: RenderNameEnum) {
        const $container = document.createElement('div');
        const Component = slotMap.get(renderName);
        if (!Component) {
          return;
        }
        ReactDOM.render(<Component />, $container);
        $container.classList.add('topWidget');
        $container.classList.add(renderName);
        return $container;
      }
      const commands = new CommandRegistry();
      commands.addCommand('example:cut', {
        label: 'Cut',
        mnemonic: 1,
        iconClass: 'fa fa-cut',
        execute: () => {
        },
      });
      commands.addCommand('example:one', {
        label: 'One',
        mnemonic: 1,
        iconClass: 'fa fa-eye',
        execute: () => {
        },
      });

      // NOTE 注册按键绑定
      commands.addKeyBinding({
        keys: ['Accel X'],
        selector: 'body',
        command: 'example:cut',
      });

      commands.addKeyBinding({
        keys: ['Accel 1'],
        selector: 'body',
        command: 'example:one',
      });
      function createMenu(): Menu {
        // NOTE 子菜单、子菜单嵌套
        const sub1 = new Menu({ commands });
        sub1.title.label = 'More...';
        sub1.title.mnemonic = 0;
        sub1.addItem({ command: 'example:one' });

        const sub2 = new Menu({ commands });
        sub2.title.label = 'More...';
        sub2.title.mnemonic = 0;
        sub2.addItem({ command: 'example:one' });
        sub2.addItem({ type: 'submenu', submenu: sub1 });

        const root = new Menu({ commands });
        root.addItem({ command: 'example:cut' });
        root.addItem({ type: 'separator' });
        root.addItem({ type: 'submenu', submenu: sub2 });

        return root;
      }

      const mainBoxPanel = new BoxPanel({ direction: 'left-to-right', spacing: 0 });
      mainBoxPanel.id = 'main-layout';

      const sideBarMainWidget = new Widget({
        node: createNodeBySlot(RenderNameEnum.sideBarMain),
      });

      const activitorBarWidget = new Widget({
        node: createNodeBySlot(RenderNameEnum.activatorBar),
      });

      mainBoxPanel.addWidget(activitorBarWidget);
      mainBoxPanel.addWidget(sideBarMainWidget);

      const menu1 = createMenu();
      menu1.title.label = 'File';
      menu1.title.mnemonic = 0;

      const menu2 = createMenu();
      menu2.title.label = 'Edit';
      menu2.title.mnemonic = 0;

      const menu3 = createMenu();
      menu3.title.label = 'View';
      menu3.title.mnemonic = 0;
      const menuBar = new MenuBar();
      menuBar.addMenu(menu1);
      menuBar.addMenu(menu2);
      menuBar.addMenu(menu3);

      Widget.attach(menuBar, document.body);
      Widget.attach(mainBoxPanel, document.body);

      return function destory() {
        // ReactDOM.unmountComponentAtNode($container)
      };
    }
  }, [ref]);

  return (
    <div ref={(ele) => ref.current = ele} />
  );
});
