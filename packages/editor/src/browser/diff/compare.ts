import { Autowired, Injectable } from '@opensumi/di';
import {
  CommandContribution,
  CommandRegistry,
  CommandService,
  DIFF_EDITOR_COMMANDS,
  Deferred,
  Domain,
  EDITOR_COMMANDS,
  PreferenceScope,
  PreferenceService,
  URI,
  getIcon,
  localize,
} from '@opensumi/ide-core-browser';
import { IMenuRegistry, MenuContribution, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';

import { CompareResult, DIFF_SCHEME, ICompareService } from '../types';

@Injectable()
export class CompareService implements ICompareService {
  public readonly comparing = new Map<string, Deferred<CompareResult>>();

  @Autowired(CommandService)
  private commandService: CommandService;

  compare(original: URI, modified: URI, name: string): Promise<CompareResult> {
    const compareUri = URI.from({
      scheme: DIFF_SCHEME,
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
  private compareService: CompareService;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  registerMenus(menu: IMenuRegistry) {
    menu.registerMenuItems(MenuId.EditorTitle, [
      {
        command: {
          id: DIFF_EDITOR_COMMANDS.ACCEPT.id,
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
          id: DIFF_EDITOR_COMMANDS.REVERT.id,
          label: localize('editor.action.revert'),
        },
        iconClass: getIcon('rollback'),
        group: 'navigation',
        when: 'isInDiffEditor && diffResource =~ /%26comparing%3Dtrue$/',
      },
    ]);
    menu.registerMenuItems(MenuId.EditorTitle, [
      {
        command: {
          id: DIFF_EDITOR_COMMANDS.TOGGLE_COLLAPSE_UNCHANGED_REGIONS.id,
          label: localize('diffEditor.action.toggleCollapseUnchangedRegions'),
        },
        toggledWhen: 'config.diffEditor.hideUnchangedRegions.enabled',
        iconClass: 'codicon codicon-map',
        group: 'navigation',
        when: 'isInDiffEditor',
      },
    ]);
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(DIFF_EDITOR_COMMANDS.ACCEPT, {
      execute: (uri: URI) => {
        if (uri && this.compareService.comparing.has(uri.toString())) {
          this.compareService.comparing.get(uri.toString())!.resolve(CompareResult.accept);
        }
      },
    });
    commands.registerCommand(DIFF_EDITOR_COMMANDS.REVERT, {
      execute: (uri: URI) => {
        if (uri && this.compareService.comparing.has(uri.toString())) {
          this.compareService.comparing.get(uri.toString())!.resolve(CompareResult.revert);
        }
      },
    });
    commands.registerCommand(DIFF_EDITOR_COMMANDS.TOGGLE_COLLAPSE_UNCHANGED_REGIONS, {
      execute: () => {
        const enabled = this.preferenceService.get('diffEditor.hideUnchangedRegions.enabled');
        this.preferenceService.set('diffEditor.hideUnchangedRegions.enabled', !enabled, PreferenceScope.User);
      },
    });
  }
}
