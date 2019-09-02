import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { Output } from './output.view';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { IMainLayoutService, MainLayoutContribution } from '@ali/ide-main-layout';

@Domain(CommandContribution, KeybindingContribution, MenuContribution, ComponentContribution, MainLayoutContribution)
export class OutputContribution implements CommandContribution, KeybindingContribution, MenuContribution, ComponentContribution, MainLayoutContribution {

  @Autowired()
  logger: Logger;

  @Autowired(IMainLayoutService)
  private layoutService: IMainLayoutService;

  onDidUseConfig() {
    // const handlerId = this.layoutService.registerTabbarComponent({
    //   componentId: '@ali/ide-output/test',
    //   component: Output,
    //   title: '输出',
    //   iconClass: 'volans_icon withdraw',
    // }, 'right');
    // const handler = this.layoutService.getTabbarHandler(handlerId!);
    // const exploreHandler = this.layoutService.getTabbarHandler('@ali/ide-explorer');
    // handler!.activate();
    // handler!.setSize(500);
    // handler!.setBadge('3');
    // exploreHandler!.setBadge('5');
    // setTimeout(() => handler!.dispose(), 2500);
    // handler!.setComponent(OutputTest);
  }

  registerCommands(commands: CommandRegistry): void {
  }

  registerMenus(menus: MenuModelRegistry): void {

  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-output', {
      id: 'ide-output',
      component: Output,
    }, {
      title: '输出',
      weight: 9,
    });
  }
}
