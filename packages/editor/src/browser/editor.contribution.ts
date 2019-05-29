import { CommandContribution, CommandRegistry, URI } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { WorkbenchEditorService, IResource } from '../common';
import { EDITOR_BROWSER_COMMANDS } from '../common/commands';
import { BrowserEditor } from './editor-collection.service';

@Injectable()
export class EditorCommandContribution implements CommandContribution {

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorService;

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
        const editor = this.workbenchEditorService.currentEditor as BrowserEditor;
        if (editor) {
          await editor.save(editor.currentDocumentModel.uri);
        }
      },
    });
  }
}
