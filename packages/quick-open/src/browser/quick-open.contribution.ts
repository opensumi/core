import { Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { Domain, CommandContribution, ContributionProvider, KeybindingContribution, CommandRegistry, Command, KeybindingRegistry, localize } from '@ali/ide-core-browser';
import { ClientAppContribution, MonacoService, MonacoContribution } from '@ali/ide-core-browser';
import { MenuId, NextMenuContribution, IMenuRegistry } from '@ali/ide-core-browser/lib/menu/next';

import { QuickOpenService, PrefixQuickOpenService } from './quick-open.model';
import { QuickOpenContribution, QuickOpenHandlerRegistry } from './prefix-quick-open.service';
import { QuickCommandHandler } from './quick-open.command.service';
import { HelpQuickOpenHandler } from './quick-open.help.service';

export const quickCommand: Command = {
  id: 'editor.action.quickCommand',
};

// 连接 monaco 内部的 quick-open
// 作为 contribution provider 的职责
@Domain(ClientAppContribution, MonacoContribution)
export class CoreQuickOpenContribution implements ClientAppContribution, MonacoContribution {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired()
  private readonly quickOpenHandlerRegistry: QuickOpenHandlerRegistry;

  @Autowired(QuickOpenContribution)
  private readonly quickOpenContributionProvider: ContributionProvider<QuickOpenContribution>;

  // 串联 monaco 内部的 quick-open 组件
  onMonacoLoaded(monacoService: MonacoService) {

     // 加载依赖 monaco 的其他组件
    const { MonacoQuickOpenService } = require('./quick-open.service');

    this.injector.addProviders({
       token: QuickOpenService,
       useClass: MonacoQuickOpenService,
     });
  }

  // contribution provider 的职责
  onStart() {
    for (const contribution of this.quickOpenContributionProvider.getContributions()) {
      contribution.registerQuickOpenHandlers(this.quickOpenHandlerRegistry);
    }
  }
}

// 作为 command platte 等相关功能的贡献点
@Domain(CommandContribution, KeybindingContribution, NextMenuContribution, QuickOpenContribution)
export class QuickOpenFeatureContribution implements CommandContribution, KeybindingContribution, NextMenuContribution, QuickOpenContribution {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(PrefixQuickOpenService)
  private readonly prefixQuickOpenService: PrefixQuickOpenService;

  @Autowired()
  private readonly quickCommandHandler: QuickCommandHandler;

  @Autowired()
  private readonly helpQuickOpenHandler: HelpQuickOpenHandler;

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

  registerNextMenus(menus: IMenuRegistry): void {
    menus.registerMenuItem(MenuId.MenubarViewMenu, {
      command: {
        id: quickCommand.id,
        label: localize('menu-bar.view.quick.command'),
      },
      group: '0_primary',
    });
  }

  registerQuickOpenHandlers(handlers: QuickOpenHandlerRegistry): void {
    handlers.registerHandler(this.quickCommandHandler);
    handlers.registerHandler(this.helpQuickOpenHandler);
  }
}
