import { Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { Domain, CommandContribution, ContributionProvider } from '@ali/ide-core-browser';
import { ClientAppContribution } from '@ali/ide-core-browser';
import { MonacoService } from '@ali/ide-monaco';

@Domain(ClientAppContribution)
export class QuickOpenClientContribution implements ClientAppContribution {
  @Autowired()
  monacoService: MonacoService;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(CommandContribution)
  private readonly contributionProvider: ContributionProvider<CommandContribution>;

  async initialize() {
    // 等待 monaco 下载完毕
    await this.monacoService.loadMonaco();
    // 下载依赖 monaco 的其他组件
    await this.loadResolveMonacoModules();
  }

  /**
   * quick-open.command.contributuin 和 quick-open.service 依赖 monaco，需要异步下载
   */
  private async loadResolveMonacoModules() {
    const [{
      QuickOpenCommandContribution,
    }, {
      QuickOpenService, MonacoQuickOpenService,
    }] = await Promise.all([
      import('./quick-open.command.contributuin'),
      import('./quick-open.service'),
    ]);
    this.contributionProvider.addContribution(QuickOpenCommandContribution);
    this.injector.addProviders({
      token: QuickOpenService,
      useClass: MonacoQuickOpenService,
    });
  }

  async onStart() {

  }
}
