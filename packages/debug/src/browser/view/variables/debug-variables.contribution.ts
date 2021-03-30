import { MenuContribution, IMenuRegistry, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { Autowired } from '@ali/common-di';
import { Domain, CommandContribution, CommandRegistry, localize, IQuickInputService, IReporterService } from '@ali/ide-core-browser';
import { DebugVariableContainer, DebugVariable } from '../../tree/debug-tree-node.define';
import { DebugVariablesModelService } from './debug-variables-tree.model.service';
import { DEBUG_COMMANDS } from '../../debug-contribution';
import { IMessageService } from '@ali/ide-overlay';
import { DEBUG_REPORT_NAME } from '../../../common';

@Domain(MenuContribution, CommandContribution)
export class VariablesPanelContribution implements MenuContribution, CommandContribution {
  @Autowired(IQuickInputService)
  private readonly quickInputService: IQuickInputService;

  @Autowired(DebugVariablesModelService)
  private readonly debugVariablesModelService: DebugVariablesModelService;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  @Autowired(IReporterService)
  private readonly reporterService: IReporterService;

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(DEBUG_COMMANDS.SET_VARIABLE_VALUE, {
      execute: async (node: DebugVariable) => {
        this.reporterService.point(DEBUG_REPORT_NAME?.DEBUG_VARIABLES, DEBUG_COMMANDS.SET_VARIABLE_VALUE.id);
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
    registry.registerCommand(DEBUG_COMMANDS.COPY_VARIABLE_VALUE, {
      execute: async (node: DebugVariableContainer | DebugVariable) => {
        this.debugVariablesModelService.copyValue(node);
      },
    });
  }

  registerMenus(registry: IMenuRegistry) {
    registry.registerMenuItem(MenuId.DebugVariablesContext, {
      command: {
        id: DEBUG_COMMANDS.SET_VARIABLE_VALUE.id,
        label: localize('deugger.menu.setValue'),
      },
      order: 1,
    });
    registry.registerMenuItem(MenuId.DebugVariablesContext, {
      command: {
        id: DEBUG_COMMANDS.COPY_VARIABLE_VALUE.id,
        label: localize('deugger.menu.copyValue'),
      },
      order: 1,
    });
  }
}
