import { FeatureExtensionCapabilityContribution, FeatureExtensionCapabilityRegistry, IFeatureExtension, FeatureExtensionManagerService } from '@ali/ide-feature-extension/lib/browser';
import { Domain, CommandContribution, CommandRegistry, AppConfig, IContextKeyService, ClientAppContribution, Command, CommandService, EDITOR_COMMANDS, FILE_COMMANDS, URI } from '@ali/ide-core-browser';
import { Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { VscodeExtensionType } from './vscode.extension';
import { LANGUAGE_BUNDLE_FIELD, VSCodeExtensionService } from './types';
import { ActivationEventService } from '@ali/ide-activation-event';
import { WorkspaceService } from '@ali/ide-workspace/lib/browser/workspace-service';
import { IExtensionStorageService } from '@ali/ide-extension-storage';
import { UriComponents } from '../common/ext-types';
import { WorkbenchEditorService } from '@ali/ide-editor';

export namespace VscodeCommands {
  export const SET_CONTEXT: Command = {
      id: 'setContext',
  };

  export const WORKBENCH_CLOSE_ACTIVE_EDITOR: Command = {
    id: 'workbench.action.closeActiveEditor',
    delegate: EDITOR_COMMANDS.CLOSE.id,
  };

  export const REVERT_AND_CLOSE_ACTIVE_EDITOR: Command = {
    id: 'workbench.action.revertAndCloseActiveEditor',
    delegate: EDITOR_COMMANDS.REVERT_AND_CLOSE.id,
  };

  export const SPLIT_EDITOR_RIGHT: Command = {
    id: 'workbench.action.splitEditorRight',
    delegate: EDITOR_COMMANDS.SPLIT_TO_RIGHT.id,
  };

  export const SPLIT_EDITOR_DOWN: Command = {
    id: 'workbench.action.splitEditorDown',
    delegate: EDITOR_COMMANDS.SPLIT_TO_BOTTOM.id,
  };

  export const NEW_UNTITLED_FILE: Command = {
    id: 'workbench.action.files.newUntitledFile',
    delegate: FILE_COMMANDS.NEW_FILE.id,
  };

  export const CLOSE_ALL_EDITORS: Command = {
    id: 'workbench.action.closeAllEditors',
    delegate: EDITOR_COMMANDS.CLOSE_ALL_IN_GROUP.id,
  };

  export const CLOSE_OTHER_EDITORS: Command = {
    id: 'workbench.action.closeOtherEditors',
    delegate: EDITOR_COMMANDS.CLOSE_OTHER_IN_GROUP.id,
  };

  export const FILE_SAVE: Command = {
    id: 'workbench.action.files.save',
    delegate: EDITOR_COMMANDS.SAVE_CURRENT.id,
  };

  export const SPLIT_EDITOR: Command = {
    id: 'workbench.action.splitEditor',
    // 默认打开右侧
    delegate: EDITOR_COMMANDS.SPLIT_TO_RIGHT.id,
  };

  export const SPLIT_EDITOR_ORTHOGONAL: Command = {
    id: 'workbench.action.splitEditorOrthogonal',
    // 默认打开下侧
    delegate: EDITOR_COMMANDS.SPLIT_TO_BOTTOM.id,
  };

  export const NAVIGATE_LEFT: Command = {
    id: 'workbench.action.navigateLeft',
    // 默认打开下侧
    delegate: EDITOR_COMMANDS.NAVIGATE_LEFT.id,
  };

  export const NAVIGATE_UP: Command = {
    id: 'workbench.action.navigateUp',
    delegate: EDITOR_COMMANDS.NAVIGATE_UP.id,
  };

  export const NAVIGATE_RIGHT: Command = {
    id: 'workbench.action.navigateRight',
    delegate: EDITOR_COMMANDS.NAVIGATE_RIGHT.id,
  };

  export const NAVIGATE_DOWN: Command = {
    id: 'workbench.action.navigateDown',
    delegate: EDITOR_COMMANDS.NAVIGATE_DOWN.id,
  };

  export const NAVIGATE_NEXT: Command = {
    id: 'workbench.action.navigateEditorGroups',
    delegate: EDITOR_COMMANDS.NAVIGATE_NEXT.id,
  };

  export const NEXT_EDITOR: Command = {
    id: 'workbench.action.nextEditor',
    delegate: EDITOR_COMMANDS.NEXT.id,
  };

  export const PREVIOUS_EDITOR: Command = {
    id: 'workbench.action.previousEditor',
    delegate: EDITOR_COMMANDS.PREVIOUS.id,
  };

  export const PREVIOUS_EDITOR_IN_GROUP: Command = {
    id: 'workbench.action.previousEditorInGroup',
    delegate: EDITOR_COMMANDS.PREVIOUS_IN_GROUP.id,
  };

  export const NEXT_EDITOR_IN_GROUP: Command = {
    id: 'workbench.action.nextEditorInGroup',
    delegate: EDITOR_COMMANDS.NEXT_IN_GROUP.id,
  };

  export const LAST_EDITOR_IN_GROUP: Command = {
    id: 'workbench.action.lastEditorInGroup',
    delegate: EDITOR_COMMANDS.LAST_IN_GROUP.id,
  };

  export const EVEN_EDITOR_WIDTH: Command = {
    id: 'workbench.action.eventEditorWidths',
    delegate: EDITOR_COMMANDS.EVEN_EDITOR_GROUPS.id,
  };

  export const CLOSE_OTHER_GROUPS: Command = {
    id: 'workbench.action.closeEditorsInOtherGroups',
    delegate: EDITOR_COMMANDS.EVEN_EDITOR_GROUPS.id,
  };

  export const OPEN_EDITOR_AT_INDEX: Command = {
    id: 'workbench.action.openEditorAtIndex',
    delegate: EDITOR_COMMANDS.OPEN_EDITOR_AT_INDEX.id,
  };

  export const REVERT_FILES: Command = {
    id: 'workbench.action.files.revert',
    delegate: EDITOR_COMMANDS.REVERT_DOCUMENT.id,
  };

  // 打开内容
  export const OPEN: Command = {
    id: 'vscode.open',
  };

  // 比较内容
  export const DIFF: Command = {
    id: 'vscode.diff',
  };
}

@Domain(FeatureExtensionCapabilityContribution, CommandContribution, ClientAppContribution)
export class VsodeExtensionContribution implements FeatureExtensionCapabilityContribution, CommandContribution, ClientAppContribution {

  @Autowired()
  vscodeExtensionType: VscodeExtensionType;

  @Autowired()
  activationEventService: ActivationEventService;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(WorkspaceService)
  protected readonly workspaceService: WorkspaceService;

  @Autowired(IExtensionStorageService)
  protected readonly extensionStorageService: IExtensionStorageService;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(IContextKeyService)
  protected contextKeyService: IContextKeyService;

  onStart() {
    // `listFocus` 为 vscode 旧版 api，已经废弃，默认设置为 true
    this.contextKeyService.createKey('listFocus', true);
  }

  async registerCapability(registry: FeatureExtensionCapabilityRegistry) {

    if (this.appConfig.extensionDir) {
      registry.addFeatureExtensionScanDirectory(this.appConfig.extensionDir);
    }
    registry.addExtraMetaData(LANGUAGE_BUNDLE_FIELD, './package.nls.' /* 'zh-cn' */ + 'json');
    registry.registerFeatureExtensionType(this.vscodeExtensionType);

  }

  async onDidEnableFeatureExtensions(extensionService: FeatureExtensionManagerService) {
    (async () => {
      const service =  this.injector.get(VSCodeExtensionService); // new VSCodeExtensionService(extensionService)
      await this.workspaceService.whenReady;
      await this.extensionStorageService.whenReady;
      await service.createExtensionHostProcess();
    })();
  }

  registerCommands(commandRegistry: CommandRegistry): void {

    // 使用的服务
    const workbenchEditorService: WorkbenchEditorService =  this.injector.get(WorkbenchEditorService);
    const commandService: CommandService =  this.injector.get(CommandService);

    commandRegistry.beforeExecuteCommand(async (command, args) => {
      await this.activationEventService.fireEvent('onCommand', command);
      return args;
    });

    commandRegistry.registerCommand(VscodeCommands.SET_CONTEXT, {
      execute: (contextKey: any, contextValue: any) => {
        this.contextKeyService.createKey(String(contextKey), contextValue);
      },
    });

    commandRegistry.registerCommand(VscodeCommands.WORKBENCH_CLOSE_ACTIVE_EDITOR);
    commandRegistry.registerCommand(VscodeCommands.REVERT_AND_CLOSE_ACTIVE_EDITOR);
    commandRegistry.registerCommand(VscodeCommands.SPLIT_EDITOR_RIGHT);
    commandRegistry.registerCommand(VscodeCommands.SPLIT_EDITOR_DOWN);
    commandRegistry.registerCommand(VscodeCommands.NEW_UNTITLED_FILE);
    commandRegistry.registerCommand(VscodeCommands.CLOSE_ALL_EDITORS);
    commandRegistry.registerCommand(VscodeCommands.FILE_SAVE);
    commandRegistry.registerCommand(VscodeCommands.SPLIT_EDITOR);
    commandRegistry.registerCommand(VscodeCommands.SPLIT_EDITOR_ORTHOGONAL);
    commandRegistry.registerCommand(VscodeCommands.NAVIGATE_LEFT);
    commandRegistry.registerCommand(VscodeCommands.NAVIGATE_RIGHT);
    commandRegistry.registerCommand(VscodeCommands.NAVIGATE_UP);
    commandRegistry.registerCommand(VscodeCommands.NAVIGATE_DOWN);
    commandRegistry.registerCommand(VscodeCommands.NAVIGATE_NEXT);
    commandRegistry.registerCommand(VscodeCommands.PREVIOUS_EDITOR);
    commandRegistry.registerCommand(VscodeCommands.PREVIOUS_EDITOR_IN_GROUP);
    commandRegistry.registerCommand(VscodeCommands.NEXT_EDITOR);
    commandRegistry.registerCommand(VscodeCommands.NEXT_EDITOR_IN_GROUP);
    commandRegistry.registerCommand(VscodeCommands.EVEN_EDITOR_WIDTH);
    commandRegistry.registerCommand(VscodeCommands.CLOSE_OTHER_GROUPS);
    commandRegistry.registerCommand(VscodeCommands.LAST_EDITOR_IN_GROUP);
    commandRegistry.registerCommand(VscodeCommands.OPEN_EDITOR_AT_INDEX);
    commandRegistry.registerCommand(VscodeCommands.CLOSE_OTHER_EDITORS);
    commandRegistry.registerCommand(VscodeCommands.REVERT_FILES);

    commandRegistry.registerCommand(VscodeCommands.OPEN, {
      execute: (uriComponents: UriComponents) => {
        const uri = URI.from(uriComponents);
        return workbenchEditorService.open(uri);
      },
    });

    commandRegistry.registerCommand(VscodeCommands.DIFF, {
      execute: (left: UriComponents, right: UriComponents, title: string, options: any) => {
        const original = URI.from(left);
        const modified = URI.from(right);
        commandService.executeCommand(EDITOR_COMMANDS.COMPARE.id, {
          original,
          modified,
          name: title,
        });
      },
    });

  }

}
