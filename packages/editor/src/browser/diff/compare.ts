import { Injectable, Autowired } from '@opensumi/di';
import {
  URI,
  Domain,
  localize,
  Deferred,
  CommandService,
  EDITOR_COMMANDS,
  CommandContribution,
  CommandRegistry,
} from '@opensumi/ide-core-browser';
import { getIcon } from '@opensumi/ide-core-browser';
import { MenuContribution, IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';

import { ICompareService, CompareResult } from '../types';

@Injectable()
export class CompareService implements ICompareService {
  public readonly comparing = new Map<string, Deferred<CompareResult>>();

  @Autowired(CommandService)
  private commandService: CommandService;

  compare(original: URI, modified: URI, name: string): Promise<CompareResult> {
    const compareUri = URI.from({
      scheme: 'diff',
      query: URI.stringifyQuery({
        name,
        original,
        modified,
        comparing: true,
      }),
    });
    if (!this.comparing.has(compareUri.toString())) {
      const deferred = new Deferred<CompareResult>();
      this.comparing.set(compareUri.toString(), deferred);
      deferred.promise.then(() => {
        this.comparing.delete(compareUri.toString());
        this.commandService.executeCommand(EDITOR_COMMANDS.CLOSE_ALL.id, compareUri);
      });
    }
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, compareUri);
    return this.comparing.get(compareUri.toString())!.promise;
  }
}

@Domain(MenuContribution, CommandContribution)
export class CompareEditorContribution implements MenuContribution, CommandContribution {
  @Autowired(ICompareService)
  compareService: CompareService;

  registerMenus(menu: IMenuRegistry) {
    menu.registerMenuItems(MenuId.EditorTitle, [
      {
        command: {
          id: 'editor.diff.accept',
          label: localize('editor.action.accept'),
        },
        iconClass: getIcon('check'),
        group: 'navigation',
        when: 'isInDiffEditor && diffResource =~ /%26comparing%3Dtrue$/',
      },
    ]);
    menu.registerMenuItems(MenuId.EditorTitle, [
      {
        command: {
          id: 'editor.diff.revert',
          label: localize('editor.action.revert'),
        },
        iconClass: getIcon('rollback'),
        group: 'navigation',
        when: 'isInDiffEditor && diffResource =~ /%26comparing%3Dtrue$/',
      },
    ]);
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(
      { id: 'editor.diff.accept' },
      {
        execute: (uri: URI) => {
          if (uri && this.compareService.comparing.has(uri.toString())) {
            this.compareService.comparing.get(uri.toString())!.resolve(CompareResult.accept);
          }
        },
      },
    );
    commands.registerCommand(
      { id: 'editor.diff.revert' },
      {
        execute: (uri: URI) => {
          if (uri && this.compareService.comparing.has(uri.toString())) {
            this.compareService.comparing.get(uri.toString())!.resolve(CompareResult.revert);
          }
        },
      },
    );
  }
}
