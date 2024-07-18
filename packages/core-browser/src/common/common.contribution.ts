import { Autowired } from '@opensumi/di';
import { getIcon } from '@opensumi/ide-components';
import {
  CommandContribution,
  CommandRegistry,
  CommandService,
  Domain,
  Event,
  PreferenceSchema,
  localize,
  replaceLocalizePlaceholder,
} from '@opensumi/ide-core-common';

import { IContextKey, IContextKeyService } from '../context-key';
import { corePreferenceSchema } from '../core-preferences';
import { trackFocus } from '../dom';
import { KeybindingContribution, KeybindingRegistry } from '../keybinding';
import { LayoutViewSizeConfig } from '../layout/constants';
import { IMenuRegistry, MenuContribution } from '../menu/next/base';
import { MenuId } from '../menu/next/menu-id';
import { PreferenceContribution } from '../preferences';
import { AppConfig } from '../react-providers/config-provider';

import {
  COMMON_COMMANDS,
  EDITOR_COMMANDS,
  FILE_COMMANDS,
  TERMINAL_COMMANDS,
  WORKSPACE_COMMANDS,
} from './common.command';
import { ClientAppContribution } from './common.define';

export const inputFocusedContextKey = 'inputFocus';
export const locationProtocolContextKey = 'locationProtocol';

@Domain(CommandContribution, ClientAppContribution, PreferenceContribution, MenuContribution, KeybindingContribution)
export class ClientCommonContribution
  implements
    CommandContribution,
    PreferenceContribution,
    ClientAppContribution,
    MenuContribution,
    KeybindingContribution
{
  private inputFocusedContext: IContextKey<boolean>;

  @Autowired(CommandService)
  protected commandService: CommandService;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(LayoutViewSizeConfig)
  private layoutViewSize: LayoutViewSizeConfig;

  schema: PreferenceSchema = corePreferenceSchema;

  constructor() {
    const overridePropertiesDefault = {
      'application.supportsOpenFolder': !!this.appConfig.isElectronRenderer && !this.appConfig.isRemote,
      'application.supportsOpenWorkspace': !!this.appConfig.isElectronRenderer && !this.appConfig.isRemote,
      'debug.toolbar.top': this.appConfig.isElectronRenderer ? 0 : this.layoutViewSize.menubarHeight,
    };
    const keys = Object.keys(this.schema.properties);
    for (const key of keys) {
      this.schema.properties[key].default = overridePropertiesDefault[key] || this.schema.properties[key].default;
    }
  }

  onStart() {
    this.contextKeyService.createKey(locationProtocolContextKey, window.location.protocol.split(':')[0]);
    this.inputFocusedContext = this.contextKeyService.createKey(inputFocusedContextKey, false);
    window.addEventListener('focusin', this.updateInputContextKeys.bind(this));
  }

  onStop() {
    window.removeEventListener('focusin', this.updateInputContextKeys.bind(this));
  }

  private activeElementIsInput(): boolean {
    return (
      !!document.activeElement &&
      (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
    );
  }

  private updateInputContextKeys(): void {
    const isInputFocused = this.activeElementIsInput();

    this.inputFocusedContext.set(isInputFocused);

    if (isInputFocused) {
      const tracker = trackFocus(document.activeElement as HTMLElement);
      Event.once(tracker.onDidBlur)(() => {
        this.inputFocusedContext.set(this.activeElementIsInput());
        tracker.dispose();
      });
    }
  }

  registerCommands(command: CommandRegistry) {
    command.registerCommand(EDITOR_COMMANDS.UNDO);
    command.registerCommand(EDITOR_COMMANDS.REDO);
    command.registerCommand(EDITOR_COMMANDS.SELECT_ALL);
    command.registerCommand(COMMON_COMMANDS.ABOUT_COMMAND, {
      execute: () => {
        alert(replaceLocalizePlaceholder(this.appConfig.appName));
      },
    });
  }

  registerMenus(menus: IMenuRegistry): void {
    menus.registerMenubarItem(MenuId.MenubarFileMenu, {
      label: localize('menu-bar.title.file'),
      order: 1,
      iconClass: getIcon('menubar-file'),
    });
    menus.registerMenubarItem(MenuId.MenubarEditMenu, {
      label: localize('menu-bar.title.edit'),
      order: 2,
      iconClass: getIcon('menubar-edit'),
    });
    menus.registerMenubarItem(MenuId.MenubarSelectionMenu, {
      label: localize('menu-bar.title.selection'),
      order: 3,
      iconClass: getIcon('menubar-selection'),
    });
    menus.registerMenubarItem(MenuId.MenubarViewMenu, {
      label: localize('menu-bar.title.view'),
      order: 4,
      iconClass: getIcon('menubar-view'),
    });
    menus.registerMenubarItem(MenuId.MenubarGoMenu, {
      label: localize('menu-bar.title.go'),
      order: 5,
      iconClass: getIcon('menubar-go'),
    });
    menus.registerMenubarItem(MenuId.MenubarTerminalMenu, {
      label: localize('menu-bar.title.terminal'),
      order: 5,
      iconClass: getIcon('terminal'),
    });
    menus.registerMenubarItem(MenuId.MenubarHelpMenu, {
      label: localize('menu-bar.title.help'),
      order: 999,
      iconClass: getIcon('question-circle'),
    });

    // File 菜单
    menus.registerMenuItems(MenuId.MenubarFileMenu, [
      {
        command: FILE_COMMANDS.OPEN_FOLDER.id,
        group: '1_open',
        when: 'config.application.supportsOpenFolder',
      },
      {
        command: FILE_COMMANDS.OPEN_WORKSPACE.id,
        group: '1_open',
        when: 'config.application.supportsOpenWorkspace',
      },
      {
        command: WORKSPACE_COMMANDS.ADD_WORKSPACE_FOLDER.id,
        group: '1_open',
        when: 'config.workspace.supportMultiRootWorkspace',
      },
      {
        command: WORKSPACE_COMMANDS.SAVE_WORKSPACE_AS_FILE.id,
        group: '1_open',
        when: 'config.workspace.supportMultiRootWorkspace',
      },
      {
        command: EDITOR_COMMANDS.NEW_UNTITLED_FILE.id,
        group: '2_new',
      },
      {
        command: {
          id: EDITOR_COMMANDS.SAVE_CURRENT.id,
          label: localize('file.save'),
        },
        group: '3_save',
      },
      {
        command: {
          id: EDITOR_COMMANDS.SAVE_ALL.id,
          label: localize('file.saveAll'),
        },
        group: '3_save',
      },
      {
        command: {
          id: EDITOR_COMMANDS.AUTO_SAVE.id,
          label: localize('file.autoSave'),
        },
        toggledWhen: 'config.editor.autoSave != off',
        group: '4_autosave',
      },
    ]);

    menus.registerMenuItems(MenuId.MenubarGoMenu, [
      {
        command: {
          id: EDITOR_COMMANDS.GO_BACK.id,
          label: localize('editor.goBack'),
        },
        group: '1_go',
      },
      {
        command: {
          id: EDITOR_COMMANDS.GO_FORWARD.id,
          label: localize('editor.goForward'),
        },
        group: '1_go',
      },
      {
        command: {
          id: EDITOR_COMMANDS.QUICK_OPEN.id,
          label: localize('editor.quickOpen'),
        },
        group: '2_go_file',
      },
      {
        command: {
          id: EDITOR_COMMANDS.SEARCH_WORKSPACE_SYMBOL.id,
          label: localize('editor.workspaceSymbol.quickopen'),
        },
        group: '2_go_file',
      },
      {
        command: {
          id: EDITOR_COMMANDS.GO_TO_LINE.id,
          label: localize('editor.goToLine'),
        },
        group: '3_go_infile',
      },
      {
        command: {
          id: 'editor.action.jumpToBracket',
          label: localize('menu-bar.go.jumpToBracket'),
        },
        group: '3_go_infile',
      },
      {
        command: {
          id: 'editor.action.marker.nextInFiles',
          label: localize('menu-bar.go.nextProblemInFiles'),
        },
        group: '6_go_problem',
      },
      {
        command: {
          id: 'editor.action.marker.prevInFiles',
          label: localize('menu-bar.go.prevProblemInFiles'),
        },
        group: '6_go_problem',
      },
    ]);
    menus.registerMenuItems(MenuId.MenubarTerminalMenu, [
      {
        command: {
          id: TERMINAL_COMMANDS.ADD.id,
          label: TERMINAL_COMMANDS.ADD.label,
        },
        group: '1_terminal',
      },
      {
        command: {
          id: TERMINAL_COMMANDS.SPLIT.id,
          label: TERMINAL_COMMANDS.SPLIT.label,
        },
        group: '1_terminal',
      },
    ]);
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    // 对于 MonacoActionRegistry.COMMON_ACTIONS 我们只做了 command handler 代理
    // 因此需要增加快捷键代理
    // 但是在快捷键设置页面会出现两者都存在的情况
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.SELECT_ALL.id,
      keybinding: 'ctrlcmd+a',
      when: 'editorFocus',
    });

    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.UNDO.id,
      keybinding: 'ctrlcmd+z',
      when: 'editorFocus',
    });

    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.REDO.id,
      keybinding: 'ctrlcmd+shift+z',
      when: 'editorFocus',
    });
  }
}
