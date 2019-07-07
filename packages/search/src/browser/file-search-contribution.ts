import { Injectable, Autowired, Inject } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { QuickOpenHandlerRegistry } from '@ali/ide-quick-open/lib/browser/prefix-quick-open.service';
import { QuickOpenItem, QuickOpenModel, QuickOpenMode, QuickOpenOptions } from '@ali/ide-quick-open/lib/browser/quick-open.model';
import { FileSearchServicePath } from '../common/';
import { AppConfig, CommandService, URI, EDITOR_COMMANDS } from '@ali/ide-core-browser';

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
  readonly prefix: string = '';
  readonly description: string =  '查找文件';

  init() {}

  onType(lookFor: string) {
    console.log('lookFor', lookFor);
  }

  getModel(): QuickOpenModel {
    console.log('getModel');
    return {
      getItems: async (searchValue) => {
        if (
          searchValue.indexOf('>') === 0 ||
          !searchValue.trim()
        ) {
          return this.items;
        }
        console.log('searchValue', searchValue);
        const result = await this.fileSearchService.find(searchValue, {
          rootUris: [this.config.workspaceDir],
          fuzzyMatch: true,
          limit: 200,
          useGitIgnore: true,
          noIgnoreParent: true,
          excludePatterns: ['*.git*'],
        });
        return this.getItems(result);
      },
    };
  }

  getOptions(): QuickOpenOptions {
    return {};
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

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution)
export class FileSearchContribution implements CommandContribution, KeybindingContribution, MenuContribution {
  @Autowired()
  private readonly quickOpenHandlerRegistry: QuickOpenHandlerRegistry;

  @Autowired(FileSearchQuickCommandHandler)
  protected fileSearchQuickCommandHandler: FileSearchQuickCommandHandler;

  @Autowired()
  logger: Logger;

  onStart() {
    this.quickOpenHandlerRegistry.registerHandler(this.fileSearchQuickCommandHandler);
  }

  registerCommands(commands: CommandRegistry): void {}

  registerMenus(menus: MenuModelRegistry): void {}

  registerKeybindings(keybindings: KeybindingRegistry): void {}
}
