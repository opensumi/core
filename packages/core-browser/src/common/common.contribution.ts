import { Autowired } from '@opensumi/di';
import {
  CommandContribution,
  CommandService,
  PreferenceSchema,
  CommandRegistry,
  localize,
  Domain,
  Event,
  replaceLocalizePlaceholder,
} from '@opensumi/ide-core-common';

import { IContextKeyService, IContextKey } from '../context-key';
import { corePreferenceSchema } from '../core-preferences';
import { trackFocus } from '../dom';
import { KeybindingContribution, KeybindingRegistry } from '../keybinding';
import { MenuContribution, IMenuRegistry, MenuId } from '../menu/next';
import { PreferenceContribution } from '../preferences';
import { AppConfig } from '../react-providers/config-provider';

import { FILE_COMMANDS, COMMON_COMMANDS, EDITOR_COMMANDS } from './common.command';
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
  schema: PreferenceSchema = corePreferenceSchema;

  private inputFocusedContext: IContextKey<boolean>;

  @Autowired(CommandService)
  protected commandService: CommandService;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

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
    // 注册 Menubar
    if (this.appConfig.isElectronRenderer) {
      menus.registerMenubarItem(MenuId.MenubarAppMenu, {
        label: localize('app.name', this.appConfig.appName),
        order: 0,
      });
    }
    menus.registerMenubarItem(MenuId.MenubarFileMenu, { label: localize('menu-bar.title.file'), order: 1 });
    menus.registerMenubarItem(MenuId.MenubarEditMenu, { label: localize('menu-bar.title.edit'), order: 2 });
    menus.registerMenubarItem(MenuId.MenubarSelectionMenu, { label: localize('menu-bar.title.selection'), order: 3 });
    menus.registerMenubarItem(MenuId.MenubarViewMenu, { label: localize('menu-bar.title.view'), order: 4 });
    menus.registerMenubarItem(MenuId.MenubarGoMenu, { label: localize('menu-bar.title.go'), order: 5 });
    menus.registerMenubarItem(MenuId.MenubarHelpMenu, { label: localize('menu-bar.title.help'), order: 999 });

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
        command: EDITOR_COMMANDS.NEW_UNTITLED_FILE.id,
        group: '2_new',
      },
      {
        command: FILE_COMMANDS.NEW_FOLDER.id,
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
        group: '3_go_line',
      },
    ]);

    // Edit 菜单
    if (this.appConfig.isElectronRenderer) {
      menus.registerMenuItems(MenuId.MenubarEditMenu, [
        {
          command: {
            id: 'electron.undo',
            label: localize('editor.undo'),
          },
          nativeRole: 'undo',
          group: '1_undo',
        },
        {
          command: {
            id: 'electron.redo',
            label: localize('editor.redo'),
          },
          group: '1_undo',
          nativeRole: 'redo',
        },
        {
          command: {
            label: localize('edit.cut'),
            id: 'electron.cut',
          },
          nativeRole: 'cut',
          group: '2_clipboard',
        },
        {
          command: {
            label: localize('edit.copy'),
            id: 'electron.copy',
          },
          nativeRole: 'copy',
          group: '2_clipboard',
        },
        {
          command: {
            label: localize('edit.paste'),
            id: 'electron.paste',
          },
          nativeRole: 'paste',
          group: '2_clipboard',
        },
        {
          command: {
            label: localize('edit.selectAll'),
            id: 'electron.selectAll',
          },
          nativeRole: 'selectAll',
          group: '2_clipboard',
        },
      ]);
      menus.registerMenuItems(MenuId.MenubarAppMenu, [
        {
          command: {
            id: 'electron.quit',
            label: localize('app.quit'),
          },
          nativeRole: 'quit',
          group: '4_quit',
        },
      ]);
    } else {
      menus.registerMenuItems(MenuId.MenubarEditMenu, [
        {
          command: EDITOR_COMMANDS.REDO.id,
          group: '1_undo',
        },
        {
          command: EDITOR_COMMANDS.UNDO.id,
          group: '1_undo',
        },
      ]);
      // 帮助菜单
      menus.registerMenuItem(MenuId.MenubarHelpMenu, {
        command: {
          id: COMMON_COMMANDS.ABOUT_COMMAND.id,
          label: localize('common.about'),
        },
        nativeRole: 'about',
        group: '0_about',
      });
    }
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
