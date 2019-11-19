/**
 * 用于快速打开，检索文件
 */
import * as fuzzy from 'fuzzy';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import {
  CommandContribution,
  CommandRegistry,
  Command,
  CancellationTokenSource,
  Schemas,
} from '@ali/ide-core-common';
import {
  localize,
  AppConfig,
  CommandService,
  URI,
  EDITOR_COMMANDS,
  QuickOpenActionProvider,
  QuickOpenItem,
  QuickOpenAction,
  QuickOpenService,
  CorePreferences,
} from '@ali/ide-core-browser';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { KeybindingContribution, KeybindingRegistry, ILogger } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { QuickOpenContribution, QuickOpenHandlerRegistry } from '@ali/ide-quick-open/lib/browser/prefix-quick-open.service';
import { QuickOpenGroupItem, QuickOpenModel, QuickOpenMode, QuickOpenOptions, PrefixQuickOpenService, QuickOpenBaseAction } from '@ali/ide-quick-open';
import { IWorkspaceService } from '@ali/ide-workspace';
import { EditorGroupSplitAction } from '@ali/ide-editor';
import { FileSearchServicePath, DEFAULT_FILE_SEARCH_LIMIT } from '../common';
import { getIcon } from '@ali/ide-core-browser';
import { SearchPreferences } from './search-preferences';

export const quickFileOpen: Command = {
  id: 'file-search.openFile',
  category: 'File',
  label: 'Open File...',
};

@Injectable()
class FileSearchActionLeftRight extends QuickOpenBaseAction {

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  constructor() {
    super({
      id: 'file-search:splitToRight',
      tooltip: localize('search.quickOpen.leftRight'),
      class: getIcon('embed'),
    });
  }

  async run(item: QuickOpenItem): Promise<void> {
    await this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, item.getUri(), {
      preview: false,
      split: EditorGroupSplitAction.Right,
      // groupIndex: 1,
    });
    // 隐藏 quickopen
    // 目前需要主动调用，后面改为失去焦点自动 @蛋总
    this.injector.get(QuickOpenService).hide();
  }
}

@Injectable()
class FileSearchActionUpDown extends QuickOpenBaseAction {

  @Autowired(CommandService)
  commandService: CommandService;

  constructor() {
    super({
      id: 'file-search:splitToRight',
      tooltip: localize('search.quickOpen.upDown'),
      class: getIcon('embed'),
    });
  }

  run(item: QuickOpenItem): Promise<void> {
        // TODO: 读取 quickOpenPreview 配置
    return this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, item.getUri(), {
      preview: false,
      // split: EditorGroupSplitAction.Bottom,
      groupIndex: 1,
    });
  }
}

@Injectable()
class FileSearchActionProvider implements QuickOpenActionProvider {

  @Autowired()
  fileSearchActionLeftRight: FileSearchActionLeftRight;

  @Autowired()
  fileSearchActionUpDown: FileSearchActionUpDown;

  hasActions(): boolean {
    return true;
  }

  getActions(item: QuickOpenItem) {
    return [this.fileSearchActionLeftRight];
  }
}

@Injectable()
export class FileSearchQuickCommandHandler {

  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired(FileSearchServicePath)
  private fileSearchService;

  @Autowired()
  private labelService: LabelService;

  @Autowired(IWorkspaceService)
  private workspaceService: IWorkspaceService;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired()
  fileSearchActionProvider: FileSearchActionProvider;

  @Autowired(CorePreferences)
  corePreferences: CorePreferences;

  @Autowired(SearchPreferences)
  searchPreferences: SearchPreferences;

  private items: QuickOpenGroupItem[] = [];
  private cancelIndicator = new CancellationTokenSource();
  private currentLookFor: string = '';
  readonly default: boolean = true;
  readonly prefix: string = '...';
  readonly description: string =  localize('search.command.fileOpen.description');

  getModel(): QuickOpenModel {
    return {
      onType: async (lookFor, acceptor) => {
        this.cancelIndicator.cancel();
        this.cancelIndicator = new CancellationTokenSource();
        const token = this.cancelIndicator.token;
        const alreadyCollected = new Set<string>();
        let findResults: QuickOpenGroupItem[] = [];

        lookFor = lookFor = lookFor.trim().replace(/\s/g, '');
        this.currentLookFor = lookFor;
        const recentlyResultList: QuickOpenGroupItem[] = await this.getRecentlyItems(alreadyCollected, lookFor, token);

        if (lookFor) {
          this.logger.debug('lookFor', lookFor);
          findResults = await this.getFindOutItems(alreadyCollected, lookFor, token);
        }
        acceptor(recentlyResultList.concat(findResults), this.fileSearchActionProvider);
      },
    };
  }

  getOptions(): QuickOpenOptions {
    return {
      fuzzyMatchLabel: {
        enableSeparateSubstringMatching: true,
      },
      showItemsWithoutHighlight: true,
      fuzzyMatchDescription: {
        enableSeparateSubstringMatching: true,
      },
    };
  }

  private async getFindOutItems(alreadyCollected, lookFor, token) {
    const roots = await this.workspaceService.roots;
    const rootUris: string[] = [];
    roots.forEach((stat) => {
      const uri = new URI(stat.uri);
      if (uri.scheme !== Schemas.file) {
        return;
      }
      return rootUris.push(uri.codeUri.fsPath);
    });
    const result = await this.fileSearchService.find(lookFor, {
      rootUris,
      fuzzyMatch: true,
      limit: DEFAULT_FILE_SEARCH_LIMIT,
      useGitIgnore: true,
      noIgnoreParent: true,
      excludePatterns: ['*.git*', ...this.getPreferenceSearchExcludes()],
    }, token);

    let results: QuickOpenGroupItem[] = await this.getItems(
      result.filter((uri: string) => {
        if (alreadyCollected.has(uri) ||
          token.isCancellationRequested
        ) {
          return false;
        }
        alreadyCollected.add(uri);
        return true;
      }),
      {},
    );
    results = results.sort(this.compareItems.bind(this));
    // 排序后设置第一个元素的样式
    if (results[0]) {
      const newItems = await this.getItems(
        [results[0].getUri()!.toString()],
        {
          groupLabel: localize('fileResults'),
          showBorder: true,
        });
      results[0] = newItems[0];
    }
    return results;
  }

  private async getRecentlyItems(alreadyCollected, lookFor, token) {
    const recentlyOpenedFiles = await this.workspaceService.getMostRecentlyOpenedFiles() || [];

    return await this.getItems(
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
    );
  }

  private async getItems(
    uriList: string[],
    options: { [key: string]: any },
  ) {
    const items: QuickOpenGroupItem[] = [];

    for (const [index, strUri] of uriList.entries()) {
      const uri = new URI(strUri);
      const icon = `file-icon ${await this.labelService.getIcon(uri)}`;
      const description = await this.workspaceService.asRelativePath(strUri);
      const item = new QuickOpenGroupItem({
        uri,
        label: uri.displayName,
        tooltip: strUri,
        iconClass: icon,
        description,
        groupLabel: index === 0 ? options.groupLabel : '',
        showBorder: (uriList.length > 0 && index === 0) ? options.showBorder : false,
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

  private openFile(uri: URI) {
    this.currentLookFor = '';
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { preview: false });
  }

  /**
   * Compare two `QuickOpenItem`.
   *
   * @param a `QuickOpenItem` for comparison.
   * @param b `QuickOpenItem` for comparison.
   * @param member the `QuickOpenItem` object member for comparison.
   */
  private compareItems(
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

  private getPreferenceSearchExcludes(): string[] {
    const excludes: string[] = [];
    const fileExcludes = this.corePreferences['files.exclude'];
    const searchExcludes = this.searchPreferences['search.exclude'];
    const allExcludes = Object.assign({}, fileExcludes, searchExcludes);
    for (const key of Object.keys(allExcludes)) {
      if (allExcludes[key]) {
        excludes.push(key);
      }
    }
    return excludes;
  }
}

@Domain(CommandContribution, KeybindingContribution, MenuContribution, QuickOpenContribution)
export class FileSearchContribution implements CommandContribution, KeybindingContribution, MenuContribution, QuickOpenContribution {

  @Autowired(FileSearchQuickCommandHandler)
  protected fileSearchQuickCommandHandler: FileSearchQuickCommandHandler;

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

  registerMenus(menus: MenuModelRegistry): void { }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: quickFileOpen.id,
      keybinding: 'ctrlcmd+p',
    });
  }

}
