import { NextMenuContribution, IMenuRegistry, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { Autowired } from '@ali/common-di';
import { Domain, CommandContribution, CommandRegistry, localize, IQuickInputService } from '@ali/ide-core-browser';
import { DebugVariable } from '../../tree/debug-tree-node.define';
import { DebugVariablesModelService } from './debug-variables-tree.model.service';
import { DEBUG_COMMANDS } from '../../debug-contribution';
import { IMessageService } from '@ali/ide-overlay';

@Domain(NextMenuContribution, CommandContribution)
export class VariablesPanelContribution implements NextMenuContribution, CommandContribution {
  @Autowired(IQuickInputService)
  private readonly quickInputService: IQuickInputService;

  @Autowired(DebugVariablesModelService)
  private readonly debugVariablesModelService: DebugVariablesModelService;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(DEBUG_COMMANDS.SET_VARIABLE_VALUE, {
      execute: async (node: DebugVariable) => {
        const param = await this.quickInputService.open({
          placeHolder: localize('deugger.menu.setValue.param'),
          value: node.description.replace(/^\"(.*)\"$/, '$1') as string,
        });
        if (param !== undefined && param !== null) {
          // 设置值
          try {
            await node.setValue(param);
          } catch (e) {
            this.messageService.error(e.message);
          }
          this.debugVariablesModelService.treeModel?.dispatchChange();
        }
      },
    });
  }

  registerNextMenus(registry: IMenuRegistry) {
    registry.registerMenuItem(MenuId.DebugVariablesContext, {
      command: {
        id: DEBUG_COMMANDS.SET_VARIABLE_VALUE.id,
        label: localize('deugger.menu.setValue'),
      },
      order: 1,
    });
  }
}
