import { Autowired } from '@opensumi/di';
import {
  Domain,
  CommandContribution,
  CommandRegistry,
  localize,
  IQuickInputService,
  IReporterService,
  getIcon,
  ClientAppContribution,
} from '@opensumi/ide-core-browser';
import { MenuContribution, IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { CommandService, CUSTOM_EDITOR_SCHEME, IExtensionProps, URI } from '@opensumi/ide-core-common';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  EditorComponentRenderMode,
  IEditorDocumentModelContentRegistry,
  IResource,
  ResourceService,
  WorkbenchEditorService,
} from '@opensumi/ide-editor/lib/browser';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { FileServiceClient } from '@opensumi/ide-file-service/lib/browser/file-service-client';
import { IMessageService } from '@opensumi/ide-overlay';
import { EditorContextKeys } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorContextKeys';
import { ContextKeyExpr } from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol';

import { DEBUG_REPORT_NAME } from '../../../common';
import { DEBUG_COMMANDS } from '../../debug-contribution';
import { DebugMemoryFileSystemProvider } from '../../debug-memory';
import { DebugViewModel } from '../debug-view-model';

import {
  CONTEXT_VARIABLE_EVALUATE_NAME_PRESENT,
  CONTEXT_IN_DEBUG_MODE,
  CONTEXT_SET_VARIABLE_SUPPORTED,
  DEBUG_MEMORY_SCHEME,
} from './../../../common/constants';
import { DebugWatchModelService } from './../watch/debug-watch-tree.model.service';
import { DebugVariablesModelService } from './debug-variables-tree.model.service';


@Domain(ClientAppContribution, BrowserEditorContribution, MenuContribution, CommandContribution)
export class VariablesPanelContribution implements BrowserEditorContribution, MenuContribution, CommandContribution {
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

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(DebugViewModel)
  private readonly viewModel: DebugViewModel;

  @Autowired(IFileServiceClient)
  protected readonly fileSystem: FileServiceClient;

  @Autowired(DebugMemoryFileSystemProvider)
  private readonly debugMemoryFileSystemProvider: DebugMemoryFileSystemProvider;

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(DEBUG_COMMANDS.SET_VARIABLE_VALUE, {
      execute: async () => {
        this.reporterService.point(DEBUG_REPORT_NAME?.DEBUG_VARIABLES, DEBUG_COMMANDS.SET_VARIABLE_VALUE.id);
        const { currentVariableInternalContext: node } = this.debugVariablesModelService;
        if (!node) {
          return;
        }

        const param = await this.quickInputService.open({
          placeHolder: localize('debugger.menu.setValue.param'),
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
      execute: async () => {
        const { currentVariableInternalContext: node } = this.debugVariablesModelService;
        this.debugVariablesModelService.copyValue(node);
      },
    });
    registry.registerCommand(DEBUG_COMMANDS.COPY_EVALUATE_PATH, {
      execute: async () => {
        const { currentVariableInternalContext: node } = this.debugVariablesModelService;
        this.debugVariablesModelService.copyEvaluateName(node);
      },
    });
    registry.registerCommand(DEBUG_COMMANDS.ADD_TO_WATCH_ID, {
      execute: async (node: DebugProtocol.Variable | URI) => {
        const { currentVariableInternalContext } = this.debugVariablesModelService;

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
        } else if (currentVariableInternalContext) {
          this.debugWatchModelService.addWatchExpression(currentVariableInternalContext.evaluateName);
        }
      },
    });

    const HEX_EDITOR_EXTENSION_ID = 'ms-vscode.hexeditor';
    const HEX_EDITOR_EDITOR_ID = `${CUSTOM_EDITOR_SCHEME}-hexEditor.hexedit`;

    registry.registerCommand(DEBUG_COMMANDS.VIEW_MEMORY_ID, {
      execute: async (node: DebugProtocol.Variable) => {
        const ext = await this.commandService.executeCommand<IExtensionProps>(
          'extension.getDescription',
          HEX_EDITOR_EXTENSION_ID,
        );

        if (ext && ext.enabled) {
          const sessionId = this.viewModel.currentSession?.id;
          const memoryReference = node.memoryReference;
          this.workbenchEditorService.open(
            URI.from({
              scheme: DEBUG_MEMORY_SCHEME,
              authority: sessionId,
              path: '/' + encodeURIComponent(memoryReference || '') + '/memory.bin',
            }),
            {
              forceOpenType: {
                type: 'component',
                componentId: HEX_EDITOR_EDITOR_ID,
              },
            },
          );
        }
      },
    });
  }

  async initialize() {
    this.fileSystem.registerProvider(DEBUG_MEMORY_SCHEME, this.debugMemoryFileSystemProvider);
  }

  registerResource(service: ResourceService) {
    service.registerResourceProvider({
      scheme: DEBUG_MEMORY_SCHEME,
      provideResource: async (uri: URI): Promise<IResource<Partial<{ [prop: string]: any }>>> => ({
          uri,
          icon: getIcon('hex'),
          name: uri.displayName,
        }),
    });
  }

  registerMenus(registry: IMenuRegistry) {
    registry.registerMenuItem(MenuId.DebugVariablesContext, {
      command: {
        id: DEBUG_COMMANDS.SET_VARIABLE_VALUE.id,
        label: localize('debugger.menu.setValue'),
      },
      order: 10,
      when: CONTEXT_SET_VARIABLE_SUPPORTED.raw,
      group: '3_modification',
    });
    registry.registerMenuItem(MenuId.DebugVariablesContext, {
      command: {
        id: DEBUG_COMMANDS.COPY_VARIABLE_VALUE.id,
        label: localize('debugger.menu.copyValue'),
      },
      order: 10,
      group: '5_cutcopypaste',
    });
    registry.registerMenuItem(MenuId.DebugVariablesContext, {
      command: {
        id: DEBUG_COMMANDS.COPY_EVALUATE_PATH.id,
        label: localize('debugger.menu.copyEvaluatePath'),
      },
      when: CONTEXT_VARIABLE_EVALUATE_NAME_PRESENT.raw,
      order: 20,
      group: '5_cutcopypaste',
    });
    registry.registerMenuItem(MenuId.DebugVariablesContext, {
      command: {
        id: DEBUG_COMMANDS.ADD_TO_WATCH_ID.id,
        label: localize('debugger.menu.addToWatchExpressions'),
      },
      when: CONTEXT_VARIABLE_EVALUATE_NAME_PRESENT.raw,
      order: 100,
      group: 'z_commands',
    });
    registry.registerMenuItem(MenuId.EditorContext, {
      command: {
        id: DEBUG_COMMANDS.ADD_TO_WATCH_ID.id,
        label: localize('debugger.menu.addToWatchExpressions'),
      },
      when: ContextKeyExpr.and(EditorContextKeys.hasNonEmptySelection, EditorContextKeys.editorTextFocus)
        ?.keys()
        .reduce((p, c) => p + ' && ' + c, CONTEXT_IN_DEBUG_MODE.raw),
      group: 'debug',
      order: 1,
    });
    registry.registerMenuItem(MenuId.DebugVariablesContext, {
      command: {
        id: DEBUG_COMMANDS.VIEW_MEMORY_ID.id,
        label: localize('debug.variables.view.memory'),
      },
      type: 'checkbox',
    });
  }
}
