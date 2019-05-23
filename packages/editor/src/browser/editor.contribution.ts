import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common';
import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { WorkbenchEditorService, IResource } from '../common';
import { EDITOR_BROSWER_COMMANDS } from '../common/commands';

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

  }

}
