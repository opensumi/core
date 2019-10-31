import { Injectable, Autowired } from '@ali/common-di';
import { ICompareService, CompareResult, BrowserEditorContribution, IEditorActionRegistry } from '../types';
import { URI, Domain, localize, Deferred, CommandService, EDITOR_COMMANDS } from '@ali/ide-core-browser';
import { getIcon } from '@ali/ide-core-browser/lib/icon';

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

@Domain(BrowserEditorContribution)
export class CompareEditorContribution implements BrowserEditorContribution {

  @Autowired(ICompareService)
  compareService: CompareService;

  registerEditorActions(registry: IEditorActionRegistry) {
    registry.registerEditorAction({
      title: localize('editor.action.accept'),
      iconClass: getIcon('check'),
      isVisible: (resource) => {
        if (resource && resource.uri.scheme === 'diff') {
          return this.compareService.comparing.has(resource.uri.toString());
        }
        return false;
      },
      onClick: (resource) => {
        if (resource && this.compareService.comparing.has(resource.uri.toString())) {
          this.compareService.comparing.get(resource.uri.toString())!.resolve(CompareResult.accept);
        }
      },
    });

    registry.registerEditorAction({
      title: localize('editor.action.revert'),
      iconClass: getIcon('rollback'),
      isVisible: (resource) => {
        if (resource && resource.uri.scheme === 'diff') {
          return this.compareService.comparing.has(resource.uri.toString());
        }
        return false;
      },
      onClick: (resource) => {
        if (resource && this.compareService.comparing.has(resource.uri.toString())) {
          this.compareService.comparing.get(resource.uri.toString())!.resolve(CompareResult.revert);
        }
      },
    });
  }

}