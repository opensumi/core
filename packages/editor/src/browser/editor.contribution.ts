import { CommandContribution, CommandRegistry, URI, Domain, MenuContribution, MenuModelRegistry, localize } from '@ali/ide-core-common';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { WorkbenchEditorService, IResource, IEditor } from '../common';
import { EDITOR_BROWSER_COMMANDS } from '../common/commands';
import { BrowserCodeEditor } from './editor-collection.service';
import { WorkbenchEditorServiceImpl, EditorGroupSplitAction, EditorGroup } from './workbench-editor.service';
import { ClientAppContribution, KeybindingContribution, KeybindingRegistry } from '@ali/ide-core-browser';
import { MonacoService, ServiceNames } from '@ali/ide-monaco';
import { EditorStatusBarService } from './editor.status-bar.service';

@Domain(CommandContribution, MenuContribution, ClientAppContribution, KeybindingContribution)
export class EditorContribution implements CommandContribution, MenuContribution, ClientAppContribution, KeybindingContribution {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired()
  monacoService: MonacoService;

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  @Autowired()
  private editorStatusBarService: EditorStatusBarService;

  waitUntilMonacoLoaded() {
    return new Promise((resolve, reject) => {
      this.monacoService.onMonacoLoaded((loaded) => {
        if (loaded) {
          resolve();
        } else {
          reject();
        }
      });
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: EDITOR_BROWSER_COMMANDS.saveCurrent,
      keybinding: 'ctrlcmd+s',
    });
    keybindings.registerKeybinding({
      command: EDITOR_BROWSER_COMMANDS.close,
      keybinding: 'ctrlcmd+w',
    });
  }

  onStart() {
    this.editorStatusBarService.setListener();
    this.waitUntilMonacoLoaded().then(() => {
      const { MonacoCodeService, MonacoContextViewService } = require('./editor.override');
      const codeEditorService = this.injector.get(MonacoCodeService);
      this.monacoService.registerOverride(ServiceNames.CODE_EDITOR_SERVICE, codeEditorService);
      this.monacoService.registerOverride(ServiceNames.CONTEXT_VIEW_SERVICE, this.injector.get(MonacoContextViewService));
    });
  }

  registerCommands(commands: CommandRegistry): void {

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.openResource,
    }, {
        execute: (uri: URI) => {
          this.workbenchEditorService.open(uri);
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.saveCurrent,
      label: localize('editor.saveCurrent', '保存当前文件'),
    }, {
        execute: async () => {
          const editor = this.workbenchEditorService.currentEditor as BrowserCodeEditor;
          if (editor) {
            await editor.save(editor.currentDocumentModel.uri);
          }
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.closeAllInGroup,
      label: localize('editor.closeAllInGroup', '关闭全部'),
    }, {
      execute: async () => {
        const group = this.workbenchEditorService.currentEditorGroup;
        if (group) {
          await group.closeAll();
        }
      },
    });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.close,
      label: localize('editor.close', '关闭'),
    }, {
      execute: async ([group, uri]: [EditorGroup, URI]) => {
        group = group || this.workbenchEditorService.currentEditorGroup;
        if (group) {
          uri = uri || (group.currentResource && group.currentResource.uri);
          if (uri) {
            await group.close(uri);
          }
        }
      },
    });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.closeToRight,
      label: localize('editor.closeToRight', '关闭到右侧'),
    }, {
      execute: async ([group, uri]: [EditorGroup, URI]) => {
        group = group || this.workbenchEditorService.currentEditorGroup;
        if (group) {
          uri = uri || (group.currentResource && group.currentResource.uri);
          if (uri) {
            await group.closeToRight(uri);
          }
        }
      },
    });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.getCurrent,
    }, {
        execute: () => this.workbenchEditorService.currentEditorGroup,
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToRight,
      label: localize('editor.splitToRight'),
    }, {
      execute: async ([group, uri]: [EditorGroup, URI]) => {
        group = group || this.workbenchEditorService.currentEditorGroup;
        if (group) {
          uri = uri || (group.currentResource && group.currentResource.uri);
          if (uri) {
            await group.split(EditorGroupSplitAction.Right, uri);
          }
        }
      },
    });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToLeft,
      label: localize('editor.splitToLeft'),
    }, {
      execute: async ([group, uri]: [EditorGroup, URI]) => {
        group = group || this.workbenchEditorService.currentEditorGroup;
        if (group) {
          uri = uri || (group.currentResource && group.currentResource.uri);
          if (uri) {
            await group.split(EditorGroupSplitAction.Left, uri);
          }
        }
      },
    });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToTop,
      label: localize('editor.splitToTop'),
    }, {
      execute: async ([group, uri]: [EditorGroup, URI]) => {
        group = group || this.workbenchEditorService.currentEditorGroup;
        if (group) {
          uri = uri || (group.currentResource && group.currentResource.uri);
          if (uri) {
            await group.split(EditorGroupSplitAction.Top, uri);
          }
        }
      },
    });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToBottom,
      label: localize('editor.splitToBottom'),
    }, {
      execute: async ([group, uri]: [EditorGroup, URI]) => {
        group = group || this.workbenchEditorService.currentEditorGroup;
        if (group) {
          uri = uri || (group.currentResource && group.currentResource.uri);
          if (uri) {
            await group.split(EditorGroupSplitAction.Bottom, uri);
          }
        }
      },
    });

  }

  registerMenus(menus: MenuModelRegistry) {
    menus.registerMenuAction(['editor', 'split', 'split-to-left'], {
      commandId: EDITOR_BROWSER_COMMANDS.splitToLeft,
    });
    menus.registerMenuAction(['editor', 'split', 'split-to-right'], {
      commandId: EDITOR_BROWSER_COMMANDS.splitToRight,
    });
    menus.registerMenuAction(['editor', 'split', 'split-to-top'], {
      commandId: EDITOR_BROWSER_COMMANDS.splitToTop,
    });
    menus.registerMenuAction(['editor', 'split', 'split-to-bottom'], {
      commandId: EDITOR_BROWSER_COMMANDS.splitToBottom,
    });
    menus.registerMenuAction(['editor', '0tab', 'close'], {
      commandId: EDITOR_BROWSER_COMMANDS.close,
    });
    menus.registerMenuAction(['editor', '0tab', 'closeAllInGroup'], {
      commandId: EDITOR_BROWSER_COMMANDS.closeAllInGroup,
    });
    menus.registerMenuAction(['editor', '0tab', 'closeToRight'], {
      commandId: EDITOR_BROWSER_COMMANDS.closeToRight,
    });
  }
}
