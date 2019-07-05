
import { Autowired } from '@ali/common-di';
import { ClientAppContribution, CommandContribution, ContributionProvider, Domain, MonacoService, MonacoContribution, ServiceNames } from '@ali/ide-core-browser';
import { MonacoCommandService, MonacoCommandRegistry, MonacoActionModule } from './monaco.command.service';
import { TextmateService } from './textmate.service';

@Domain(ClientAppContribution, MonacoContribution, CommandContribution)
export class MonacoClientContribution implements ClientAppContribution, MonacoContribution, CommandContribution {

  @Autowired()
  monacoService: MonacoService;

  @Autowired(MonacoContribution)
  contributionProvider: ContributionProvider<MonacoContribution>;

  @Autowired()
  monacoCommandService: MonacoCommandService;

  @Autowired()
  monacoCommandRegistry: MonacoCommandRegistry;

  @Autowired()
  monacoActionModule: MonacoActionModule;

  @Autowired()
  private textmateService!: TextmateService;

  async initialize() {
    // 从 cdn 加载 monaco 和依赖的 vscode 代码
    await this.monacoService.loadMonaco();
    // 执行所有 contribution 的 onMonacoLoaded 事件，用来添加 overrideService
    for (const contribution of this.contributionProvider.getContributions()) {
      contribution.onMonacoLoaded(this.monacoService);
    }
  }

  onStart() {
    this.textmateService.initialize();
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
    for (const action of this.monacoActionModule.getActions()) {
      // 将 Action 转为可执行的 CommandHandler
      const handler = this.monacoActionModule.newMonacoActionHandler(action);
      this.monacoCommandRegistry.registerCommand(action, handler);
    }
  }
}
