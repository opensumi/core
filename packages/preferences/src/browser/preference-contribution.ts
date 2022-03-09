import * as jsoncparser from 'jsonc-parser';

import { Autowired, Injectable } from '@opensumi/di';
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
  IJSONSchemaRegistry,
  IPreferenceSettingsService,
  ContributionProvider,
  ISettingGroup,
  IDisposable,
  addElement,
  Command,
  getIcon,
  isString,
  ISettingSection,
} from '@opensumi/ide-core-browser';
import { MenuContribution, IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { ResourceService, IResourceProvider, IResource } from '@opensumi/ide-editor';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  IResourceOpenResult,
  WorkbenchEditorService,
} from '@opensumi/ide-editor/lib/browser';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';

import { PREF_SCHEME, SettingContribution } from '../common';

import { PreferenceSettingsService, defaultSettingGroup, defaultSettingSections } from './preference-settings.service';
import { PreferenceView } from './preferences.view';
import { USER_PREFERENCE_URI } from './user-preference-provider';
import { WorkspacePreferenceProvider } from './workspace-preference-provider';


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

  export const PREFERENCE_INPUT_FOCUS: Command = {
    id: 'preference.input.focus',
    category: CATEGORY,
  };
}

@Domain(
  CommandContribution,
  KeybindingContribution,
  ClientAppContribution,
  BrowserEditorContribution,
  MenuContribution,
  JsonSchemaContribution,
)
export class PreferenceContribution
  implements
    CommandContribution,
    KeybindingContribution,
    ClientAppContribution,
    BrowserEditorContribution,
    MenuContribution,
    JsonSchemaContribution
{
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

  @Autowired(IJSONSchemaRegistry)
  private readonly schemaRegistry: IJSONSchemaRegistry;

  @Autowired(IPreferenceSettingsService)
  private readonly preferenceService: PreferenceSettingsService;

  @Autowired(SettingContribution)
  private readonly contributions: ContributionProvider<SettingContribution>;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  private settingGroupsWillRegister: ISettingGroup[] = defaultSettingGroup;

  private settingSectionsWillRegister: {
    [key: string]: ISettingSection[];
  } = defaultSettingSections;

  onStart() {
    /**
     * 处理各个模块下贡献的 PreferenceSettingSectionContribution， 组成默认的设置面板内容
     */
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
      execute: async (scopeOrUrl?: PreferenceScope | URI, prefernceId?: string) => {
        // 这里可能被 Editor 的 Toolbar 调用
        // 传入 URI 及 EditorGroup
        if (!scopeOrUrl || typeof scopeOrUrl !== 'number') {
          this.openResource();
        } else {
          this.openResource(scopeOrUrl as PreferenceScope, prefernceId);
        }
      },
    });

    commands.registerCommand(PREFERENCE_COMMANDS.PREFERENCE_INPUT_FOCUS, {
      execute: () => {
        this.preferenceService.focusInput();
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
      when: 'resourceFilename =~ /settings.json/',
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: COMMON_COMMANDS.OPEN_PREFERENCES.id,
      keybinding: 'ctrlcmd+,',
    });

    keybindings.registerKeybinding({
      command: PREFERENCE_COMMANDS.PREFERENCE_INPUT_FOCUS.id,
      keybinding: 'ctrlcmd+f',
      when: 'resourceScheme == pref',
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
      contrib.registerSetting &&
        contrib.registerSetting({
          registerSettingGroup: (settingGroup: ISettingGroup): IDisposable =>
            addElement(this.settingGroupsWillRegister, settingGroup),
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

  async openPreferences(search?: string, prefernceId?: string) {
    await this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI('/').withScheme(PREF_SCHEME), {
      preview: false,
    });
    if (isString(search)) {
      this.preferenceService.search(search);
    }
  }

  async openResource(scope?: PreferenceScope, preferenceId?: string) {
    const url = await this.preferenceService.getCurrentPreferenceUrl(scope);
    const openResult = await this.commandService.executeCommand<IResourceOpenResult>(
      EDITOR_COMMANDS.OPEN_RESOURCE.id,
      new URI(url),
    );
    if (openResult && preferenceId) {
      const editor = this.workbenchEditorService.editorGroups.find((g) => g.name === openResult.groupId)?.currentEditor;
      if (editor) {
        const { _commandService: commandService } = editor.monacoEditor as any;
        let text = editor.monacoEditor.getValue();
        let lines;
        let numReturns;
        let preferenceLine;
        const { index } = text.match(new RegExp(`\\"${preferenceId}\\"`)) || {};
        if (index && index >= 0) {
          numReturns = text.slice(0, index).match(new RegExp('\\n', 'g'))?.length || -1 + 1;
          if (numReturns > 0) {
            lines = text.split('\n');
            preferenceLine = lines[numReturns];
          }
        } else {
          // 如果不存在配置项，追加配置项内容
          const formattingOptions = { tabSize: 2, insertSpaces: true, eol: '' };
          const edits = jsoncparser.modify(text, [preferenceId], '', { formattingOptions });
          const content = jsoncparser.applyEdits(text, edits);
          editor.monacoEditor.setValue(content);
          text = content;
          numReturns = text.slice(0, index).match(new RegExp('\\n', 'g'))?.length || -1;
          if (numReturns > 1) {
            lines = text.split('\n');
            preferenceLine = lines[numReturns - 1];
          }
        }
        if (!preferenceLine) {
          return;
        }
        const regStr = `\\s+\\"${preferenceId}\\":\\s?["|{|t|f|[]`;
        const match = new RegExp(regStr, 'g').exec(preferenceLine);
        if (match) {
          const isStringExpr = match[0].slice(-1) === '"';
          editor.monacoEditor.revealPositionInCenterIfOutsideViewport(
            { lineNumber: numReturns + 1, column: match[0].length + 1 },
            1,
          );
          editor.monacoEditor.setPosition({ lineNumber: numReturns + 1, column: match[0].length + 1 });
          if (isStringExpr) {
            // 只对 String 类型配置展示提示，包括不存在配置项时追加的情况
            await commandService.executeCommand('editor.action.triggerSuggest');
          }
        }
      }
    }
  }

  initialize() {
    this.schemaProvider.onDidPreferenceSchemaChanged(() => {
      this.registerSchema(this.schemaRegistry);
    });
  }

  registerSchema(registry: IJSONSchemaRegistry) {
    registry.registerSchema('vscode://schemas/settings/user', this.schemaProvider.getCombinedSchema(), [
      'settings.json',
      USER_PREFERENCE_URI.toString(),
    ]);
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
