import { FeatureExtensionCapabilityContribution, FeatureExtensionCapabilityRegistry, IFeatureExtension, FeatureExtensionManagerService } from '@ali/ide-feature-extension/lib/browser';
import { Domain, CommandContribution, CommandRegistry, AppConfig, IContextKeyService, ClientAppContribution, Command, CommandService, EDITOR_COMMANDS, FILE_COMMANDS } from '@ali/ide-core-browser';
import { Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { VscodeExtensionType } from './vscode.extension';
import { LANGUAGE_BUNDLE_FIELD, VSCodeExtensionService } from './types';
import { ActivationEventService } from '@ali/ide-activation-event';
import { WorkspaceService } from '@ali/ide-workspace/lib/browser/workspace-service';
import { IExtensionStorageService } from '@ali/ide-extension-storage';

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
    delegate: EDITOR_COMMANDS.CLOSE.id,
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
  }

}
