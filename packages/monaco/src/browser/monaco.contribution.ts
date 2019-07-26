
import { Autowired } from '@ali/common-di';
import { ClientAppContribution, CommandContribution, ContributionProvider, Domain, MonacoService, MonacoContribution, ServiceNames, MenuContribution, MenuModelRegistry, MAIN_MENU_BAR, localize } from '@ali/ide-core-browser';
import { MonacoCommandService, MonacoCommandRegistry, MonacoActionRegistry } from './monaco.command.service';
import { MonacoMenus } from './monaco-menu';
import { TextmateService } from './textmate.service';
import { IThemeService } from '@ali/ide-theme';

@Domain(ClientAppContribution, MonacoContribution, CommandContribution, MenuContribution)
export class MonacoClientContribution implements ClientAppContribution, MonacoContribution, CommandContribution, MenuContribution {

  @Autowired()
  monacoService: MonacoService;

  @Autowired(MonacoContribution)
  contributionProvider: ContributionProvider<MonacoContribution>;

  @Autowired()
  monacoCommandService: MonacoCommandService;

  @Autowired()
  monacoCommandRegistry: MonacoCommandRegistry;

  @Autowired()
  monacoActionRegistry: MonacoActionRegistry;

  @Autowired()
  private textmateService!: TextmateService;

  @Autowired(IThemeService)
  themeService: IThemeService;

  async initialize() {
    // 从 cdn 加载 monaco 和依赖的 vscode 代码
    await this.monacoService.loadMonaco();
    // 执行所有 contribution 的 onMonacoLoaded 事件，用来添加 overrideService
    for (const contribution of this.contributionProvider.getContributions()) {
      contribution.onMonacoLoaded(this.monacoService);
    }
    this.textmateService.init();
  }

  async onStart() {
    const currentTheme = await this.themeService.getCurrentTheme();
    const themeData = currentTheme.themeData;
    this.textmateService.setTheme(themeData);
  }

  onMonacoLoaded(monacoService: MonacoService) {
    // 该类从 vs/editor/standalone/browser/simpleServices 中获取
    const standaloneCommandService = new monaco.services.StandaloneCommandService(monaco.services.StaticServices.instantiationService.get());
    // 给 monacoCommandService 设置委托，执行 monaco 命令使用 standaloneCommandService 执行
    this.monacoCommandService.setDelegate(standaloneCommandService);
    // 替换 monaco 内部的 commandService
    monacoService.registerOverride(ServiceNames.COMMAND_SERVICE, this.monacoCommandService);
  }

  registerCommands() {
    // 注册 monaco 所有的 action
    this.monacoActionRegistry.registerMonacoActions();
  }

  registerMenus(menus: MenuModelRegistry) {
    menus.registerSubmenu(MonacoMenus.SELECTION, localize('selection'));
    for (const group of MonacoMenus.SELECTION_GROUPS) {
      group.actions.forEach((action, index) => {
        const commandId = this.monacoCommandRegistry.validate(action);
        if (commandId) {
          const path = [...MonacoMenus.SELECTION, group.id];
          const order = index.toString();
          menus.registerMenuAction(path, { commandId, order });
        }
      });
    }
  }
}
