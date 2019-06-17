import { CommandContribution, CommandRegistry, URI, Domain, MenuContribution, MenuModelRegistry, localize } from '@ali/ide-core-common';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { WorkbenchEditorService, IResource } from '../common';
import { EDITOR_BROWSER_COMMANDS } from '../common/commands';
import { BrowserCodeEditor } from './editor-collection.service';
import { WorkbenchEditorServiceImpl, EditorGroupSplitAction, EditorGroup } from './workbench-editor.service';
import { ClientAppContribution, KeybindingContribution, KeybindingRegistry } from '@ali/ide-core-browser';
import { MonacoService, ServiceNames } from '@ali/ide-monaco';

@Domain(CommandContribution, MenuContribution, ClientAppContribution, KeybindingContribution)
export class EditorContribution implements CommandContribution, MenuContribution, ClientAppContribution, KeybindingContribution {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired()
  monacoService: MonacoService;

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

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
      id: EDITOR_BROWSER_COMMANDS.splitToLeft,
      label: localize('editor.splitToLeft'),
    }, {
      execute: () => {
        if (this.workbenchEditorService.currentEditorGroup.currentResource) {
          this.workbenchEditorService.currentEditorGroup.split(EditorGroupSplitAction.Left, this.workbenchEditorService.currentEditorGroup.currentResource!);
        }
      },
    });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToRight,
      label: localize('editor.splitToRight'),
    }, {
      execute: () => {
        if (this.workbenchEditorService.currentEditorGroup.currentResource) {
          this.workbenchEditorService.currentEditorGroup.split(EditorGroupSplitAction.Right, this.workbenchEditorService.currentEditorGroup.currentResource!);
        }
      },
    });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToLeft,
      label: localize('editor.splitToLeft'),
    }, {
      execute: () => {
        if (this.workbenchEditorService.currentEditorGroup.currentResource) {
          this.workbenchEditorService.currentEditorGroup.split(EditorGroupSplitAction.Left, this.workbenchEditorService.currentEditorGroup.currentResource!);
        }
      },
    });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToRight,
      label: localize('editor.splitToRight'),
    }, {
      execute: () => {
        if (this.workbenchEditorService.currentEditorGroup.currentResource) {
          this.workbenchEditorService.currentEditorGroup.split(EditorGroupSplitAction.Right, this.workbenchEditorService.currentEditorGroup.currentResource!);
        }
      },
    });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToTop,
      label: localize('editor.splitToTop'),
    }, {
      execute: () => {
        if (this.workbenchEditorService.currentEditorGroup.currentResource) {
          this.workbenchEditorService.currentEditorGroup.split(EditorGroupSplitAction.Top, this.workbenchEditorService.currentEditorGroup.currentResource!);
        }
      },
    });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToBottom,
      label: localize('editor.splitToBottom'),
    }, {
      execute: () => {
        if (this.workbenchEditorService.currentEditorGroup.currentResource) {
          this.workbenchEditorService.currentEditorGroup.split(EditorGroupSplitAction.Bottom, this.workbenchEditorService.currentEditorGroup.currentResource!);
        }
      },
    });

  }

  registerMenus(menus: MenuModelRegistry) {
    menus.registerMenuAction(['editor', 'split-to-left'], {
        commandId: EDITOR_BROWSER_COMMANDS.splitToLeft,
    });
    menus.registerMenuAction(['editor', 'split-to-right'], {
      commandId: EDITOR_BROWSER_COMMANDS.splitToRight,
    });
    menus.registerMenuAction(['editor', 'split-to-top'], {
      commandId: EDITOR_BROWSER_COMMANDS.splitToTop,
    });
    menus.registerMenuAction(['editor', 'split-to-bottom'], {
      commandId: EDITOR_BROWSER_COMMANDS.splitToBottom,
    });
    menus.registerMenuAction(['editor', 'close'], {
      commandId: EDITOR_BROWSER_COMMANDS.close,
    });
    menus.registerMenuAction(['editor', 'closeAllInGroup'], {
      commandId: EDITOR_BROWSER_COMMANDS.closeAllInGroup,
    });
    menus.registerMenuAction(['editor', 'closeToRight'], {
      commandId: EDITOR_BROWSER_COMMANDS.closeToRight,
    });
  }
}
