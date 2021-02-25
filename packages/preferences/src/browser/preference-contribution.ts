import { Autowired, Injectable } from '@ali/common-di';

import {
  ClientAppContribution,
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
  localize,
  CommandService,
  EDITOR_COMMANDS,
  JsonSchemaContribution,
  ISchemaRegistry,
  IPreferenceSettingsService,
  ContributionProvider,
  ISettingGroup,
  IDisposable,
  addElement,
  Command,
  ResourceProvider,
  getIcon,
  isString,
} from '@ali/ide-core-browser';
import { USER_PREFERENCE_URI } from './user-preference-provider';
import { WorkspacePreferenceProvider } from './workspace-preference-provider';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { BrowserEditorContribution, EditorComponentRegistry } from '@ali/ide-editor/lib/browser';
import { ResourceService, IResourceProvider, IResource } from '@ali/ide-editor';
import { PREF_SCHEME, SettingContribution } from '../common';
import { PreferenceView } from './preferences.view';
import { MenuContribution, IMenuRegistry, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { PreferenceSettingsService, defaultSettingGroup, defaultSettingSections } from './preference.service';

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
      icon: getIcon('setting'),
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
  export const OPEN = '1_open';
}

export namespace PREFERENCE_COMMANDS {
  const CATEGORY = 'preference';

  export const OPEN_USER_SETTING_FILE: Command = {
    id: 'preference.open.user',
    label: localize('preference.editorTitle.openUserSource'),
    category: CATEGORY,
  };

  export const OPEN_WORKSPACE_SETTING_FILE: Command = {
    id: 'preference.open.workspace',
    label: localize('preference.editorTitle.openWorkspaceSource'),
    category: CATEGORY,
  };

  export const OPEN_SOURCE_FILE: Command = {
    id: 'preference.open.source',
    label: localize('preference.editorTitle.openSource'),

    category: CATEGORY,
  };
}

@Domain(CommandContribution, KeybindingContribution, ClientAppContribution, BrowserEditorContribution, MenuContribution, JsonSchemaContribution)
export class PreferenceContribution implements CommandContribution, KeybindingContribution, ClientAppContribution, BrowserEditorContribution, MenuContribution, JsonSchemaContribution {

  @Autowired(PreferenceSchemaProvider)
  private readonly schemaProvider: PreferenceSchemaProvider;

  @Autowired(PreferenceProvider, { tag: PreferenceScope.Workspace })
  protected readonly workspacePreferenceProvider: WorkspacePreferenceProvider;

  @Autowired(IFileServiceClient)
  protected readonly filesystem: IFileServiceClient;

  @Autowired(PrefResourceProvider)
  private readonly prefResourceProvider: PrefResourceProvider;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(ISchemaRegistry)
  private readonly schemaRegistry: ISchemaRegistry;

  @Autowired(IPreferenceSettingsService)
  private readonly preferenceService: PreferenceSettingsService;

  @Autowired(ResourceProvider)
  protected readonly resourceProvider: ResourceProvider;

  @Autowired(SettingContribution)
  private readonly contributions: ContributionProvider<SettingContribution>;

  private settingGroupsWillRegister: ISettingGroup[] = defaultSettingGroup;

  private settingSectionsWillRegister = defaultSettingSections;

  onStart() {
    /**
     * 收集 contribution 里对 settingGroupsWillRegister, settingSectionsWillRegister 增删
     */
    this.saveSettings();
    this.handleSettingGroups();
    this.handleSettingSections();

    /**
     * 将收集到的 group 和 section 真正注册到 service
    */
    this.registerSettings();
    this.registerSettingSections();
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(COMMON_COMMANDS.OPEN_PREFERENCES, {
      execute: async (search?: string) => {
        await this.openPreferences(search);
      },
    });

    commands.registerCommand(COMMON_COMMANDS.LOCATE_PREFERENCES, {
      execute: async (groupId: string) => {
        await this.openPreferences();
        return await this.preferenceService.setCurrentGroup(groupId);
      },
    });

    commands.registerCommand(PREFERENCE_COMMANDS.OPEN_USER_SETTING_FILE, {
      execute: async () => {
        this.openResource(PreferenceScope.User);
      },
    });

    commands.registerCommand(PREFERENCE_COMMANDS.OPEN_WORKSPACE_SETTING_FILE, {
      execute: async () => {
        this.openResource(PreferenceScope.Workspace);
      },
    });

    commands.registerCommand(PREFERENCE_COMMANDS.OPEN_SOURCE_FILE, {
      execute: async () => {
        this.openResource();
      },
    });
  }

  registerMenus(menus: IMenuRegistry) {
    menus.registerMenuItem(MenuId.SettingsIconMenu, {
      command: COMMON_COMMANDS.OPEN_PREFERENCES.id,
      group: PreferenceContextMenu.OPEN,
    });

    menus.registerMenuItem(MenuId.EditorTitle, {
      command: PREFERENCE_COMMANDS.OPEN_SOURCE_FILE.id,
      iconClass: getIcon('open'),
      group: 'navigation',
      order: 4,
      when: `resourceScheme == ${PREF_SCHEME}`,
    });

    menus.registerMenuItem(MenuId.EditorTitle, {
      command: COMMON_COMMANDS.OPEN_PREFERENCES.id,
      iconClass: getIcon('open'),
      group: 'navigation',
      order: 4,
      when: `resourceFilename =~ /settings\.json/`,
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: COMMON_COMMANDS.OPEN_PREFERENCES.id,
      keybinding: 'ctrlcmd+,',
    });
  }

  handleSettingGroups() {
    for (const contrib of this.contributions.getContributions()) {
      if (contrib.handleSettingGroup) {
        this.settingGroupsWillRegister = contrib.handleSettingGroup(this.settingGroupsWillRegister);
      }
    }
  }

  handleSettingSections() {
    for (const contrib of this.contributions.getContributions()) {
      if (contrib.handleSettingSections) {
        this.settingSectionsWillRegister = contrib.handleSettingSections({ ...this.settingSectionsWillRegister });
      }
    }
  }

  saveSettings() {
    for (const contrib of this.contributions.getContributions()) {
      contrib.registerSetting && contrib.registerSetting({
        registerSettingGroup: (settingGroup: ISettingGroup): IDisposable => {
          return addElement(this.settingGroupsWillRegister, settingGroup);
        },
        registerSettingSection: (key, section): IDisposable => {
          const has = (key: string) => Object.keys(this.settingSectionsWillRegister).includes(key);
          if (!has(key)) {
            this.settingSectionsWillRegister[key] = [];
          }
          return addElement(this.settingSectionsWillRegister[key], section);
        },
      });
    }
  }

  registerSettings() {
    this.settingGroupsWillRegister.forEach((g) => {
      this.preferenceService.registerSettingGroup(g);
    });
  }

  registerSettingSections() {
    Object.keys(this.settingSectionsWillRegister).forEach((key) => {
      this.settingSectionsWillRegister[key].forEach((section) => {
        this.preferenceService.registerSettingSection(key, section);
      });
    });
  }

  async openPreferences(search?: string) {
    await this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI('/').withScheme(PREF_SCHEME));
    if (isString(search)) {
      this.preferenceService.search(search);
    }
  }

  async openResource(scope?: PreferenceScope) {
    const url = await this.preferenceService.getCurrentPreferenceUrl(scope);
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI(url));
  }

  initialize() {
    this.schemaProvider.onDidPreferenceSchemaChanged(() => {
      this.registerSchema(this.schemaRegistry);
    });
  }

  registerSchema(registry: ISchemaRegistry) {
    // TODO: schema 应包含类似 [json] 这种 override
    registry.registerSchema('vscode://schemas/settings/user', this.schemaProvider.getCombinedSchema(), ['settings.json', USER_PREFERENCE_URI.toString()]);
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
