import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import {
  CommandContribution,
  CommandRegistry,
  Command,
  getLogger,
  CancellationTokenSource,
} from '@ali/ide-core-common';
import {
  localize,
  AppConfig,
  CommandService,
  URI,
  EDITOR_COMMANDS,
} from '@ali/ide-core-browser';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { KeybindingContribution, KeybindingRegistry, Logger } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { QuickOpenContribution, QuickOpenHandlerRegistry } from '@ali/ide-quick-open/lib/browser/prefix-quick-open.service';
import { QuickOpenGroupItem, QuickOpenModel, QuickOpenMode, QuickOpenOptions, PrefixQuickOpenService } from '@ali/ide-quick-open/lib/browser/quick-open.model';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { IWorkspaceServer } from '@ali/ide-workspace';
import { WorkspaceService } from '@ali/ide-workspace/lib/browser/workspace-service';
import { Search } from './search.view';
import { FileSearchServicePath, DEFAULT_FILE_SEARCH_LIMIT } from '../common';

export const quickFileOpen: Command = {
  id: 'file-search.openFile',
  category: 'File',
  label: 'Open File...',
};

const logger = getLogger();

@Injectable()
export class FileSearchQuickCommandHandler {

  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired(FileSearchServicePath)
  private fileSearchService;

  @Autowired(AppConfig)
  private config: AppConfig;

  @Autowired()
  private labelService: LabelService;

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  protected items: QuickOpenGroupItem[] = [];

  readonly default: boolean = true;
  readonly prefix: string = '...';
  readonly description: string =  localize('search.command.fileOpen.description');

  protected cancelIndicator = new CancellationTokenSource();

  getModel(): QuickOpenModel {
    return {
      onType: async (lookFor, acceptor) => {
        this.cancelIndicator.cancel();
        this.cancelIndicator = new CancellationTokenSource();
        let findResults: QuickOpenGroupItem[] = [];
        let result: string[] = [];
        const token = this.cancelIndicator.token;
        const recentlyOpenedFiles = await this.injector.get('WorkspaceService').getMostRecentlyOpenedFiles() || [];

        findResults = findResults.concat(
          await this.getItems(recentlyOpenedFiles, {
            groupLabel: localize('historyMatches'),
          }),
        );
        lookFor = lookFor.trim();
        if (lookFor) {
          result = await this.fileSearchService.find(lookFor, {
            rootUris: [this.config.workspaceDir],
            fuzzyMatch: true,
            limit: DEFAULT_FILE_SEARCH_LIMIT,
            useGitIgnore: true,
            noIgnoreParent: true,
            excludePatterns: ['*.git*'],
          }, token);
        }
        if (token.isCancellationRequested) {
          return;
        }
        findResults = findResults.concat(
          await this.getItems(result, {
            groupLabel: localize('fileResults'),
            showBorder: true,
          }),
        );
        acceptor(findResults);
      },
    };
  }

  getOptions(): QuickOpenOptions {
    return {
      fuzzyMatchLabel: {
        enableSeparateSubstringMatching: true,
      },
    };
  }

  protected async getItems(uriList: string[], options: {[key: string]: any}) {
    const items: QuickOpenGroupItem[] = [];

    for (const [index, strUri] of uriList.entries()) {
      const uri = URI.file(strUri);
      const icon = `file-icon ${await this.labelService.getIcon(uri)}`;
      const item = new QuickOpenGroupItem({
        uri,
        label: uri.displayName,
        tooltip: strUri,
        iconClass: icon,
        // TODO WorkspaceService.asRelativePath 获取相对路径
        description: strUri,
        groupLabel: index === 0 ? options.groupLabel : '',
        showBorder: (uriList.length > 0 && index === 0) ?  options.showBorder : false,
        hidden: false,
        run: (mode: QuickOpenMode) => {
          if (mode !== QuickOpenMode.OPEN) {
            return false;
          }
          this.openFile(uri);
          return true;
        },
      });
      items.push(item);
    }
    return items;
  }

  protected openFile(uri: URI) {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri);
  }

}

@Domain(CommandContribution, KeybindingContribution, MenuContribution, QuickOpenContribution, LayoutContribution)
export class FileSearchContribution implements CommandContribution, KeybindingContribution, MenuContribution, QuickOpenContribution, LayoutContribution {

  @Autowired(FileSearchQuickCommandHandler)
  protected fileSearchQuickCommandHandler: FileSearchQuickCommandHandler;

  @Autowired()
  logger: Logger;

  @Autowired(PrefixQuickOpenService)
  protected readonly quickOpenService: PrefixQuickOpenService;

  registerQuickOpenHandlers(quickOpenHandlerRegistry: QuickOpenHandlerRegistry) {
    quickOpenHandlerRegistry.registerHandler(this.fileSearchQuickCommandHandler);
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(quickFileOpen, {
      execute: (...args: any[]) => {
        this.quickOpenService.open('...');
      },
  });
  }

  registerMenus(menus: MenuModelRegistry): void {}

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: quickFileOpen.id,
      keybinding: 'ctrlcmd+p',
    });
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-search', {
      component: Search,
      iconClass: 'volans_icon search',
      weight: 8,
    });
  }
}
