import { CommandContribution, CommandRegistry } from '@ali/ide-core-common';
import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { WorkbenchEditorService, IResource } from '../common';
import { EDITOR_BROSWER_COMMANDS } from '../common/commands';
import { BrowserEditor } from './editor-collection.service';

@Injectable()
export class EditorCommandContribution implements CommandContribution {

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  registerCommands(commands: CommandRegistry): void {

    commands.registerCommand({
      id: EDITOR_BROSWER_COMMANDS.openResource,
    }, {
      execute: (resource: IResource) => {
        this.injector.get(WorkbenchEditorService).openResource(resource);
        // this.workbencEditorService.openResource(resource)
      },
    });

    commands.registerCommand({
      id: EDITOR_BROSWER_COMMANDS.saveCurrent,
    }, {
      execute: async () => {
        const service: WorkbenchEditorService = this.injector.get(WorkbenchEditorService);
        const editor = service.currentEditor as BrowserEditor;
        if (editor) {
          await editor.save(editor.currentDocumentModel.uri);
        }
      },
    });
  }
}
