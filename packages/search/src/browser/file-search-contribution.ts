import { Injectable, Autowired } from '@ali/common-di';
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
import { QuickOpenItem, QuickOpenModel, QuickOpenMode, QuickOpenOptions, PrefixQuickOpenService } from '@ali/ide-quick-open/lib/browser/quick-open.model';
import { FileSearchServicePath } from '../common/';

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
  labelService: LabelService;

  protected items: QuickOpenItem[] = [];

  readonly default: boolean = true;
  readonly prefix: string = '...';
  readonly description: string =  localize('search.command.fileOpen.description');

  protected cancelIndicator = new CancellationTokenSource();

  getModel(): QuickOpenModel {
    return {
      onType: async (lookFor, acceptor) => {
        let findResults: QuickOpenItem[] = [];

        this.cancelIndicator.cancel();
        this.cancelIndicator = new CancellationTokenSource();
        const token = this.cancelIndicator.token;
        // TODO get recent open file
        lookFor = lookFor.trim();
        if (!lookFor) {
          return;
        }
        logger.log('lookFor', lookFor);
        const result = await this.fileSearchService.find(lookFor, {
          rootUris: [this.config.workspaceDir],
          fuzzyMatch: true,
          limit: 200,
          useGitIgnore: true,
          noIgnoreParent: true,
          excludePatterns: ['*.git*'],
        }, token);
        if (token.isCancellationRequested) {
          return;
        }
        findResults = await this.getItems(result);
        acceptor(findResults);
      },
    };
  }

  getOptions(): QuickOpenOptions {
    return {
      fuzzyMatchLabel: true,
    };
  }

  protected async getItems(uriList: string[]) {
    const items: QuickOpenItem[] = [];
    for (const strUri of uriList) {
      const uri = URI.file(strUri);
      const icon = `file-icon ${await this.labelService.getIcon(uri)}`;
      items.push(new QuickOpenItem({
        label: uri.displayName,
        tooltip: strUri,
        iconClass: icon,
        description: strUri,
        uri,
        hidden: false,
        run: (mode: QuickOpenMode) => {
          if (mode !== QuickOpenMode.OPEN) {
            return false;
          }
          this.openFile(uri);
          return true;
        },
      }));
    }
    return items;
  }

  protected openFile(uri: URI) {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri);
  }

}

@Domain(CommandContribution, KeybindingContribution, MenuContribution, QuickOpenContribution)
export class FileSearchContribution implements CommandContribution, KeybindingContribution, MenuContribution, QuickOpenContribution {

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
}
