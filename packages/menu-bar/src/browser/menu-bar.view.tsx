import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ConfigContext } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import '@ali/ide-i18n';
import { localize } from '@ali/ide-core-common';

import { CommandRegistry as PhosphorCommandRegistry } from '@phosphor/commands';
import { Menu, MenuBar as WidgetsMenuBar, Widget } from '@phosphor/widgets';

import { MenuBarService } from './menu-bar.service';
import './menu-bar.module.less';

export const MenuBar = observer(() => {

  const ref = React.useRef<HTMLElement | null>();
  const { injector } = React.useContext(ConfigContext);
  const menuBarService = injector.get(MenuBarService);

  React.useEffect(function widgetsInit() {

    if (ref.current) {

      const commands = new PhosphorCommandRegistry();

      commands.addCommand('file:new', {
        execute: () => {
        },
        iconClass: 'fa',
        label: localize('menu-bar.file.new'),
        mnemonic: 0,
      });
      commands.addCommand('file:open', {
        execute: () => {
        },
        iconClass: 'fa',
        label: localize('menu-bar.file.open'),
        mnemonic: 0,
      });
      commands.addCommand('file:save', {
        execute: () => {
        },
        iconClass: 'fa',
        label: localize('menu-bar.file.save'),
        mnemonic: 0,
      });
      commands.addCommand('file:save-as', {
        execute: () => {
        },
        iconClass: 'fa',
        label: localize('menu-bar.file.save-as'),
        mnemonic: 0,
      });
      commands.addCommand('file:save-all', {
        execute: () => {
        },
        iconClass: 'fa',
        label: localize('menu-bar.file.save-all'),
        mnemonic: 0,
      });

      commands.addCommand('edit:rollback', {
        execute: () => {
        },
        iconClass: 'fa',
        label: localize('menu-bar.edit.rollback'),
        mnemonic: 0,
      });
      commands.addCommand('edit:redo', {
        execute: () => {
        },
        iconClass: 'fa',
        label: localize('menu-bar.edit.redo'),
        mnemonic: 0,
      });

      commands.addCommand('edit:cut', {
        execute: () => {
        },
        iconClass: 'fa',
        label: localize('menu-bar.edit.cut'),
        mnemonic: 0,
      });
      commands.addCommand('edit:copy', {
        execute: () => {
        },
        iconClass: 'fa',
        label: localize('menu-bar.edit.copy'),
        mnemonic: 0,
      });
      commands.addCommand('edit:paste', {
        execute: () => {
        },
        iconClass: 'fa',
        label: localize('menu-bar.edit.paste'),
        mnemonic: 0,
      });
      commands.addCommand('edit:find', {
        execute: () => {
        },
        iconClass: 'fa',
        label: localize('menu-bar.edit.find'),
        mnemonic: 0,
      });
      commands.addCommand('edit:replace', {
        execute: () => {
        },
        iconClass: 'fa',
        label: localize('menu-bar.edit.replace'),
        mnemonic: 0,
      });

      commands.addCommand('view:outward:right-panel:hide', {
        execute: () => {
          menuBarService.hidePanel(SlotLocation.rightPanel);
          viewOutward.removeItem(hidePanelItem);
          viewOutward.addItem(showPanelItem);
        },
        iconClass: 'fa',
        label: localize('menu-bar.view.outward.right-panel.hide'),
        mnemonic: 1,
      });
      commands.addCommand('view:outward:right-panel:show', {
        execute: () => {
          menuBarService.showPanel(SlotLocation.rightPanel);
          viewOutward.removeItem(showPanelItem);
          viewOutward.addItem(hidePanelItem);
        },
        iconClass: 'fa',
        label: localize('menu-bar.view.outward.right-panel.show'),
        mnemonic: 1,
      });

      commands.addKeyBinding({
        command: 'view:outward:right-panel:hide',
        keys: ['Accel X'],
        selector: 'body',
      });

      const menuBar = new WidgetsMenuBar();

      const file = new Menu({ commands });
      file.title.label = localize('menu-bar.file');
      file.title.mnemonic = 0;
      file.addItem({ command: 'file:new' });
      file.addItem({ command: 'file:open' });
      file.addItem({ type: 'separator' });
      file.addItem({ command: 'file:save' });
      file.addItem({ command: 'file:save-as' });
      file.addItem({ command: 'file:save-all' });
      menuBar.addMenu(file);

      const edit = new Menu({ commands });
      edit.title.label = localize('menu-bar.edit');
      edit.title.mnemonic = 0;
      edit.addItem({ command: 'edit:rollback' });
      edit.addItem({ command: 'edit:redo' });
      edit.addItem({ type: 'separator' });
      edit.addItem({ command: 'edit:cut' });
      edit.addItem({ command: 'edit:copy' });
      edit.addItem({ command: 'edit:paste' });
      edit.addItem({ type: 'separator' });
      edit.addItem({ command: 'edit:find' });
      edit.addItem({ command: 'edit:replace' });
      menuBar.addMenu(edit);

      const view = new Menu({ commands });
      view.title.label = localize('menu-bar.view');

      const viewOutward = new Menu({ commands });
      viewOutward.title.label = localize('menu-bar.view.outward');

      const hidePanelItem = viewOutward.addItem({ command: 'view:outward:right-panel:hide' });
      const showPanelItem = viewOutward.addItem({ command: 'view:outward:right-panel:show' });
      viewOutward.removeItem(showPanelItem);

      view.addItem({type: 'submenu', submenu: viewOutward});

      menuBar.addMenu(view);

      Widget.attach(menuBar, ref.current);

      commands.execute('view:outward:right-panel:hide');
      return function destory() {
        Widget.detach(menuBar);
      };
    }
  }, [ref]);

  return (
    <div ref={(ele) => ref.current = ele} />
  );
});
