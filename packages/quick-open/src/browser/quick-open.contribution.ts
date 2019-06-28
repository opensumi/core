import { Autowired } from '@ali/common-di';
import { Domain, CommandContribution, ContributionProvider, IClientApp, KeybindingContribution, MenuContribution, CommandRegistry, Command, KeybindingRegistry, MAIN_MENU_BAR, MenuModelRegistry, localize } from '@ali/ide-core-browser';
import { ClientAppContribution, COMMON_MENUS } from '@ali/ide-core-browser';
import { MonacoService } from '@ali/ide-monaco';
import { QuickOpenService, PrefixQuickOpenService } from './quick-open.model';
import { QuickOpenContribution, QuickOpenHandlerRegistry } from './prefix-quick-open.service';
import { QuickCommandHandler } from './quick-open.command.service';
import { HelpQuickOpenHandler } from './quick-open.help.service';

export const quickCommand: Command = {
  id: 'quickCommand',
};
@Domain(CommandContribution, KeybindingContribution, MenuContribution, QuickOpenContribution, ClientAppContribution)
export class QuickOpenClientContribution implements CommandContribution, KeybindingContribution, MenuContribution, QuickOpenContribution, ClientAppContribution {
  @Autowired()
  monacoService: MonacoService;

  @Autowired(PrefixQuickOpenService)
  protected readonly prefixQuickOpenService: PrefixQuickOpenService;

  @Autowired()
  protected readonly quickCommandHandler: QuickCommandHandler;

  @Autowired()
  protected readonly helpQuickOpenHandler: HelpQuickOpenHandler;

  @Autowired()
  private readonly quickOpenHandlerRegistry: QuickOpenHandlerRegistry;

  @Autowired(QuickOpenContribution)
  private readonly quickOpenContributionProvider: ContributionProvider<QuickOpenContribution>;

  async initialize(app: IClientApp) {
    // 等待 monaco 下载完毕
    await this.monacoService.loadMonaco();
    // 加载依赖 monaco 的其他组件
    const { MonacoQuickOpenService } = require('./quick-open.service');

    app.injector.addProviders({
      token: QuickOpenService,
      useClass: MonacoQuickOpenService,
    });
  }

  onStart() {
    for (const contribution of this.quickOpenContributionProvider.getContributions()) {
      contribution.registerQuickOpenHandlers(this.quickOpenHandlerRegistry);
    }
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(quickCommand, {
      execute: () => this.prefixQuickOpenService.open('>'),
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: quickCommand.id,
      keybinding: 'ctrlcmd+shift+p',
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(COMMON_MENUS.VIEW_PRIMARY, {
      commandId: quickCommand.id,
      label: localize('menu-bar.view.quick.command'),
    });
  }

  registerQuickOpenHandlers(handlers: QuickOpenHandlerRegistry): void {
    handlers.registerHandler(this.quickCommandHandler);
    handlers.registerHandler(this.helpQuickOpenHandler);
  }
}
