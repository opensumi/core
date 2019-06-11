import { CommandContribution, CommandRegistry, URI, Domain, MenuContribution, MenuModelRegistry, localize } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { WorkbenchEditorService, IResource } from '../common';
import { EDITOR_BROWSER_COMMANDS } from '../common/commands';
import { BrowserCodeEditor } from './editor-collection.service';
import { WorkbenchEditorServiceImpl, EditorGroupSplitAction } from './workbench-editor.service';

@Injectable()
@Domain(CommandContribution, MenuContribution)
export class EditorCommandContribution implements CommandContribution, MenuContribution  {

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

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
    }, {
      execute: async () => {
        const editor = this.workbenchEditorService.currentEditor as BrowserCodeEditor;
        if (editor) {
          await editor.save(editor.currentDocumentModel.uri);
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
  }
}
