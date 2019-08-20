import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { StatusBar, StatusBarAlignment } from '@ali/ide-status-bar/lib/browser/status-bar.service';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { BottomPanel } from './bottom-panel.view';

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution, LayoutContribution)
export class BottomPanelContribution implements CommandContribution, KeybindingContribution, MenuContribution, ClientAppContribution, LayoutContribution {

  @Autowired()
  logger: Logger;

  @Autowired(StatusBar)
  statusBar: StatusBar;

  onStart() {
    this.statusBar.addElement('bottom-panel-handle', {
      icon: 'window-maximize',
      alignment: StatusBarAlignment.RIGHT,
      command: 'main-layout.bottom-panel.toggle',
    });
  }

  registerCommands(commands: CommandRegistry): void {
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-bottom-panel', {
      id: 'ide-bottom-panel',
      component: BottomPanel,
    });
  }

  registerMenus(menus: MenuModelRegistry): void {

  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
  }
}
