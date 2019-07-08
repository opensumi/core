import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, getLogger } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { QuickOpenContribution, QuickOpenHandlerRegistry } from '@ali/ide-quick-open/lib/browser/prefix-quick-open.service';
import { QuickOpenItem, QuickOpenModel, QuickOpenMode, QuickOpenOptions, PrefixQuickOpenService } from '@ali/ide-quick-open/lib/browser/quick-open.model';
import { FileSearchServicePath } from '../common/';
import { AppConfig, CommandService, URI, EDITOR_COMMANDS } from '@ali/ide-core-browser';

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

  protected items: QuickOpenItem[] = [];

  readonly default: boolean = true;
  readonly prefix: string = '...';
  readonly description: string =  '查找文件';

  getModel(): QuickOpenModel {
    return {
      onType: async (lookFor, acceptor) => {
        lookFor = lookFor.trim();
        if (!lookFor) {
          return acceptor([]);
        }
        logger.log('lookFor', lookFor);
        const result = await this.fileSearchService.find(lookFor, {
          rootUris: [this.config.workspaceDir],
          fuzzyMatch: true,
          limit: 200,
          useGitIgnore: true,
          noIgnoreParent: true,
          excludePatterns: ['*.git*'],
        });
        acceptor(this.getItems(result));
      },
    };
  }

  getOptions(): QuickOpenOptions {
    return {
      fuzzyMatchLabel: true,
    };
  }

  protected getItems(uriList: string[]) {
    return uriList.map((strUri) => {
      const uri = URI.file(strUri);

      return new QuickOpenItem({
        label: uri.displayName,
        description: strUri,
        uri,
        run: (mode: QuickOpenMode) => {
          if (mode !== QuickOpenMode.OPEN) {
            return false;
          }
          this.openFile(uri);
          return true;
        },
      });
    });
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
