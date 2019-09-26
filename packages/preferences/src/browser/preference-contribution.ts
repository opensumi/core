import { Autowired, Injectable } from '@ali/common-di';

import {
  ClientAppContribution,
  InMemoryResourceResolver,
  JsonSchemaStore,
  PreferenceSchemaProvider,
  URI,
  Domain,
  CommandContribution,
  CommandRegistry,
  COMMON_COMMANDS,
  KeybindingContribution,
  KeybindingRegistry,
  PreferenceScope,
  PreferenceProvider,
  WithEventBus,
  MaybePromise,
<<<<<<< HEAD
=======
  EDITOR_COMMANDS,
  MenuContribution,
  MenuModelRegistry,
  CommandService,
>>>>>>> origin/develop
  localize,
} from '@ali/ide-core-browser';
import { USER_PREFERENCE_URI } from './user-preference-provider';
import { WorkspacePreferenceProvider } from './workspace-preference-provider';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { PreferenceService } from '@ali/ide-core-browser/lib/preferences';
import { BrowserEditorContribution, EditorComponentRegistry } from '@ali/ide-editor/lib/browser';
import { ResourceService, IResourceProvider, IResource } from '@ali/ide-editor';
import { PREF_SCHEME } from '../common';
import { PreferenceView } from './preferences.view';
import { SETTINGS_MENU_PATH } from '@ali/ide-activity-bar';

const PREF_PREVIEW_COMPONENT_ID = 'pref-preview';

@Injectable()
export class PrefResourceProvider extends WithEventBus implements IResourceProvider {

  readonly scheme: string = PREF_SCHEME;

  constructor() {
    super();
  }

  provideResource(uri: URI): MaybePromise<IResource<any>> {
    // 获取文件类型 getFileType: (path: string) => string
    return {
      name: localize('preference.tab.name'),
      icon: 'volans_icon setting',
      uri,
    };
  }

  provideResourceSubname(resource: IResource, groupResources: IResource[]): string | null {
    return null;
  }

  async shouldCloseResource(resource: IResource, openedResources: IResource[][]): Promise<boolean> {
    return true;
  }
}

export namespace PreferenceContextMenu {
  // 1_, 2_用于菜单排序，这样能保证分组顺序顺序
  export const OPEN = [...SETTINGS_MENU_PATH, '1_open'];
}

@Domain(CommandContribution, KeybindingContribution, ClientAppContribution, BrowserEditorContribution, MenuContribution)
export class PreferenceContribution implements CommandContribution, KeybindingContribution, ClientAppContribution, BrowserEditorContribution, MenuContribution {

  @Autowired(JsonSchemaStore)
  private readonly jsonSchemaStore: JsonSchemaStore;
  @Autowired(PreferenceSchemaProvider)
  private readonly schemaProvider: PreferenceSchemaProvider;
  @Autowired(InMemoryResourceResolver)
  private readonly inmemoryResources: InMemoryResourceResolver;

  @Autowired(PreferenceProvider, {tag: PreferenceScope.Workspace})
  protected readonly workspacePreferenceProvider: WorkspacePreferenceProvider;

  @Autowired(IFileServiceClient)
  protected readonly filesystem: IFileServiceClient;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @Autowired(PrefResourceProvider)
  prefResourceProvider: PrefResourceProvider;

  @Autowired(CommandService)
  commandService: CommandService;

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(COMMON_COMMANDS.OPEN_PREFERENCES, {
      isEnabled: () => true,
      execute: async () => {
        await this.openPreferences();
      },
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(PreferenceContextMenu.OPEN, {
      commandId: COMMON_COMMANDS.OPEN_PREFERENCES.id,
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: COMMON_COMMANDS.OPEN_PREFERENCES.id,
      keybinding: 'ctrl+,',
    });
  }

  openPreferences() {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI().withScheme(PREF_SCHEME));
  }

  onStart() {
    const serializeSchema = () => JSON.stringify(this.schemaProvider.getCombinedSchema());
    const uri = new URI('vscode://schemas/settings/user');
    this.inmemoryResources.add(uri, serializeSchema());
    this.jsonSchemaStore.registerSchema({
      fileMatch: ['settings.json', USER_PREFERENCE_URI.toString()],
      url: uri.toString(),
    });
    this.schemaProvider.onDidPreferenceSchemaChanged(() =>
      this.inmemoryResources.update(uri, serializeSchema()),
    );
  }

  // 初始化PreferenceService下的PreferenceProvider，如Folder，Workspace
  initialize(): void {
    this.preferenceService.initializeProviders();
  }

  registerResource(resourceService: ResourceService) {
    resourceService.registerResourceProvider(this.prefResourceProvider);
  }

  registerEditorComponent(editorComponentRegistry: EditorComponentRegistry) {

    editorComponentRegistry.registerEditorComponent({
      component: PreferenceView,
      uid: PREF_PREVIEW_COMPONENT_ID,
      scheme: PREF_SCHEME,
    });

    editorComponentRegistry.registerEditorComponentResolver(PREF_SCHEME, (_, __, resolve) => {

      resolve!([
        {
          type: 'component',
          componentId: PREF_PREVIEW_COMPONENT_ID,
        },
      ]);

    });
  }
}
