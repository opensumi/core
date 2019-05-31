import { CommandContribution, CommandRegistry, Domain } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { WorkbenchEditorService, IResource } from '../common';
import { EDITOR_BROSWER_COMMANDS } from '../common/commands';
import { BrowserEditor } from './editor-collection.service';

@Injectable()
@Domain(CommandContribution)
export class EditorCommandContribution implements CommandContribution {

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorService;

  registerCommands(commands: CommandRegistry): void {

    commands.registerCommand({
      id: EDITOR_BROSWER_COMMANDS.openResource,
    }, {
      execute: (resource: IResource) => {
        this.workbenchEditorService.openResource(resource);
        // this.workbencEditorService.openResource(resource)
      },
    });

    commands.registerCommand({
      id: EDITOR_BROSWER_COMMANDS.saveCurrent,
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
