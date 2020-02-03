import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, localize } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { Output, ChannelSelector } from './output.view';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { TabBarToolbarContribution, ToolbarRegistry } from '@ali/ide-core-browser/lib/layout';
import { getIcon } from '@ali/ide-core-browser';
import { OutputService } from './output.service';

const OUTPUT_CLEAR: Command = {
  id: 'output.channel.clear',
  iconClass: getIcon('clear'),
  label: localize('output.channel.clear', '清理日志'),
};
const OUTPUT_CONTAINER_ID = 'ide-output';
@Domain(CommandContribution, KeybindingContribution, ComponentContribution, TabBarToolbarContribution)
export class OutputContribution implements CommandContribution, KeybindingContribution, ComponentContribution, TabBarToolbarContribution {

  @Autowired()
  logger: Logger;

  @Autowired(IMainLayoutService)
  private layoutService: IMainLayoutService;

  @Autowired()
  private outputService: OutputService;

  registerToolbarItems(registry: ToolbarRegistry) {
    registry.registerItem({
      id: 'output.clear.action',
      command: OUTPUT_CLEAR.id,
      viewId: OUTPUT_CONTAINER_ID,
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(OUTPUT_CLEAR, {
      execute: () => this.outputService.selectedChannel.clear(),
      // FIXME 默认为output面板时，无法直接刷新按钮可用状态，需要给出事件 @CC
      isEnabled: () => !!this.outputService.selectedChannel,
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-output', {
      id: OUTPUT_CONTAINER_ID,
      component: Output,
    }, {
      title: localize('output.tabbar.title', '输出'),
      iconClass: getIcon('output'),
      priority: 9,
      containerId: OUTPUT_CONTAINER_ID,
      activateKeyBinding: 'ctrlcmd+shift+u',
      titleComponent: ChannelSelector,
    });
  }
}
