import { URI } from '@ali/ide-core-common';
import { ContextKeyExpr } from '@ali/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';
import { EditorContextKeys } from '@ali/monaco-editor-core/esm/vs/editor/common/editorContextKeys';
import { CONTEXT_VARIABLE_EVALUATE_NAME_PRESENT, CONTEXT_IN_DEBUG_MODE, CONTEXT_SET_VARIABLE_SUPPORTED } from './../../../common/constants';
import { MenuContribution, IMenuRegistry, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { Autowired } from '@ali/common-di';
import { Domain, CommandContribution, CommandRegistry, localize, IQuickInputService, IReporterService } from '@ali/ide-core-browser';
import { DebugVariableContainer, DebugVariable } from '../../tree/debug-tree-node.define';
import { DebugVariablesModelService } from './debug-variables-tree.model.service';
import { DEBUG_COMMANDS } from '../../debug-contribution';
import { IMessageService } from '@ali/ide-overlay';
import { DEBUG_REPORT_NAME } from '../../../common';
import { DebugWatchModelService } from './../watch/debug-watch-tree.model.service';
import { WorkbenchEditorService } from '@ali/ide-editor/lib/browser';
@Domain(MenuContribution, CommandContribution)
export class VariablesPanelContribution implements MenuContribution, CommandContribution {
  @Autowired(IQuickInputService)
  private readonly quickInputService: IQuickInputService;

  @Autowired(DebugVariablesModelService)
  private readonly debugVariablesModelService: DebugVariablesModelService;

  @Autowired(DebugWatchModelService)
  private readonly debugWatchModelService: DebugWatchModelService;

  @Autowired(WorkbenchEditorService)
  protected readonly workbenchEditorService: WorkbenchEditorService;

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
    registry.registerCommand(DEBUG_COMMANDS.COPY_EVALUATE_PATH, {
      execute: async (node: DebugVariableContainer | DebugVariable) => {
        this.debugVariablesModelService.copyEvaluateName(node);
      },
    });
    registry.registerCommand(DEBUG_COMMANDS.ADD_TO_WATCH_ID, {
      execute: async (node: DebugVariableContainer | DebugVariable | URI) => {
        if (node instanceof URI) {
          // 说明是从编辑器的选中区域来监听表达式
          const currentEditor = this.workbenchEditorService.currentEditor;

          if (!currentEditor?.monacoEditor) {
            return;
          }

          if (!currentEditor?.monacoEditor.hasModel()) {
            return;
          }

          const editor = currentEditor.monacoEditor;
          const text = editor.getModel().getValueInRange(editor.getSelection());

          this.debugWatchModelService.addWatchExpression(text);
          return;
        }
        this.debugWatchModelService.addWatchExpression(node.evaluateName);
      },
    });
  }

  registerMenus(registry: IMenuRegistry) {
    registry.registerMenuItem(MenuId.DebugVariablesContext, {
      command: {
        id: DEBUG_COMMANDS.SET_VARIABLE_VALUE.id,
        label: localize('deugger.menu.setValue'),
      },
      order: 10,
      when: CONTEXT_SET_VARIABLE_SUPPORTED.raw,
      group: '3_modification',
    });
    registry.registerMenuItem(MenuId.DebugVariablesContext, {
      command: {
        id: DEBUG_COMMANDS.COPY_VARIABLE_VALUE.id,
        label: localize('deugger.menu.copyValue'),
      },
      order: 10,
      group: '5_cutcopypaste',
    });
    registry.registerMenuItem(MenuId.DebugVariablesContext, {
      command: {
        id: DEBUG_COMMANDS.COPY_EVALUATE_PATH.id,
        label: localize('deugger.menu.copyEvaluatePath'),
      },
      when: CONTEXT_VARIABLE_EVALUATE_NAME_PRESENT.raw,
      order: 20,
      group: '5_cutcopypaste',
    });
    registry.registerMenuItem(MenuId.DebugVariablesContext, {
      command: {
        id: DEBUG_COMMANDS.ADD_TO_WATCH_ID.id,
        label: localize('deugger.menu.addToWatchExpressions'),
      },
      when: CONTEXT_VARIABLE_EVALUATE_NAME_PRESENT.raw,
      order: 100,
      group: 'z_commands',
    });
    registry.registerMenuItem(MenuId.EditorContext, {
      command: {
        id: DEBUG_COMMANDS.ADD_TO_WATCH_ID.id,
        label: localize('deugger.menu.addToWatchExpressions'),
      },
      when: ContextKeyExpr.and(EditorContextKeys.hasNonEmptySelection, EditorContextKeys.editorTextFocus)?.keys().reduce((p, c) => p + ' && ' + c, CONTEXT_IN_DEBUG_MODE.raw),
      group: 'debug',
      order: 1,
    });
  }
}
