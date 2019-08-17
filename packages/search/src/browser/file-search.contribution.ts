import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import {
  CommandContribution,
  CommandRegistry,
  Command,
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
import { LoggerManage, SupportLogNamespace, LogServiceClient } from '@ali/ide-logs/lib/browser';
import * as fuzzy from 'fuzzy';
import { IWorkspaceService } from '@ali/ide-workspace';
import { Search } from './search.view';
import { FileSearchServicePath, DEFAULT_FILE_SEARCH_LIMIT } from '../common';

export const quickFileOpen: Command = {
  id: 'file-search.openFile',
  category: 'File',
  label: 'Open File...',
};

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

  @Autowired(IWorkspaceService)
  private workspaceService: IWorkspaceService;

  @Autowired(LoggerManage)
  private LoggerManage: LoggerManage;
  private logger: LogServiceClient;

  protected items: QuickOpenGroupItem[] = [];
  protected cancelIndicator = new CancellationTokenSource();
  protected currentLookFor: string = '';
  readonly default: boolean = true;
  readonly prefix: string = '...';
  readonly description: string =  localize('search.command.fileOpen.description');

  constructor() {
    this.logger = this.LoggerManage.getLogger(SupportLogNamespace.Browser);
  }

  getModel(): QuickOpenModel {
    return {
      onType: async (lookFor, acceptor) => {
        this.cancelIndicator.cancel();
        this.cancelIndicator = new CancellationTokenSource();
        let findResults: QuickOpenGroupItem[] = [];
        let result: string[] = [];
        const token = this.cancelIndicator.token;
        const recentlyOpenedFiles = await this.workspaceService.getMostRecentlyOpenedFiles() || [];
        const alreadyCollected = new Set<string>();

        lookFor = lookFor.trim();
        this.currentLookFor = lookFor;

        findResults = findResults.concat(
          await this.getItems(
            recentlyOpenedFiles.filter((uri: string) => {
              const _uri = new URI(uri);
              if (alreadyCollected.has(uri) ||
                  !fuzzy.test(lookFor, _uri.displayName) ||
                  token.isCancellationRequested
              ) {
                return false;
              }
              alreadyCollected.add(uri);
              return true;
            }),
            {
              groupLabel: localize('historyMatches'),
            },
           ),
        );
        if (lookFor) {
          this.logger.debug(`lookFor:`, lookFor);
          result = await this.fileSearchService.find(lookFor, {
            rootUris: [this.config.workspaceDir],
            fuzzyMatch: true,
            limit: DEFAULT_FILE_SEARCH_LIMIT,
            useGitIgnore: true,
            noIgnoreParent: true,
            excludePatterns: ['*.git*'],
          }, token);
        }
        findResults = findResults.concat(
          (await this.getItems(
            result.filter((uri: string) => {
              if (alreadyCollected.has(uri) ||
                  token.isCancellationRequested
              ) {
                return false;
              }
              alreadyCollected.add(uri);
              return true;
            }),
            {
              groupLabel: localize('fileResults'),
              showBorder: true,
            },
          )).sort(this.compareItems.bind(this)),
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

  protected async getItems(
    uriList: string[],
    options: {[key: string]: any},
  ) {
    const items: QuickOpenGroupItem[] = [];

    for (const [index, strUri] of uriList.entries()) {
      const uri = URI.file(strUri);
      const icon = `file-icon ${await this.labelService.getIcon(uri)}`;
      const description = await this.workspaceService.asRelativePath(strUri);
      const item = new QuickOpenGroupItem({
        uri,
        label: uri.displayName,
        tooltip: strUri,
        iconClass: icon,
        description,
        groupLabel: index === 0 ? options.groupLabel : '',
        showBorder: (uriList.length > 0 && index === 0) ?  options.showBorder : false,
        // hidden: false,
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
    this.currentLookFor = '';
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri);
  }

/**
 * Compare two `QuickOpenItem`.
 *
 * @param a `QuickOpenItem` for comparison.
 * @param b `QuickOpenItem` for comparison.
 * @param member the `QuickOpenItem` object member for comparison.
 */
  protected compareItems(
    a: QuickOpenGroupItem,
    b: QuickOpenGroupItem,
    member: 'getLabel' | 'getUri' = 'getLabel'): number {

    /**
     * Normalize a given string.
     *
     * @param str the raw string value.
     * @returns the normalized string value.
     */
    function normalize(str: string) {
      return str.trim().toLowerCase();
    }

    // Normalize the user query.
    const query: string = normalize(this.currentLookFor);

    /**
     * Score a given string.
     *
     * @param str the string to score on.
     * @returns the score.
     */
    function score(str: string): number {
      const match = fuzzy.match(query, str);
      return (match === null) ? 0 : match.score;
    }

    // Get the item's member values for comparison.
    let itemA = a[member]()!;
    let itemB = b[member]()!;

    // If the `URI` is used as a comparison member, perform the necessary string conversions.
    if (typeof itemA !== 'string') {
      itemA = itemA.path.toString();
    }
    if (typeof itemB !== 'string') {
      itemB = itemB.path.toString();
    }

    // Normalize the item labels.
    itemA = normalize(itemA);
    itemB = normalize(itemB);

    // Score the item labels.
    const scoreA: number = score(itemA);
    const scoreB: number = score(itemB);

    // If both label scores are identical, perform additional computation.
    if (scoreA === scoreB) {

      // Favor the label which have the smallest substring index.
      const indexA: number = itemA.indexOf(query);
      const indexB: number = itemB.indexOf(query);

      if (indexA === indexB) {

        // Favor the result with the shortest label length.
        if (itemA.length !== itemB.length) {
          return (itemA.length < itemB.length) ? -1 : 1;
        }

        // Fallback to the alphabetical order.
        const comparison = itemB.localeCompare(itemA);

        // If the alphabetical comparison is equal, call `compareItems` recursively using the `URI` member instead.
        if (comparison === 0) {
          return this.compareItems(a, b, 'getUri');
        }

        return itemB.localeCompare(itemA);
      }

      return indexA - indexB;
    }

    return scoreB - scoreA;
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
