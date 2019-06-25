import { Autowired } from '@ali/common-di';
import { Domain, CommandContribution, ContributionProvider, IClientApp } from '@ali/ide-core-browser';
import { ClientAppContribution } from '@ali/ide-core-browser';
import { MonacoService } from '@ali/ide-monaco';
import { QuickOpenService, QuickPickService } from './quick-open.model';

@Domain(ClientAppContribution)
export class QuickOpenClientContribution implements ClientAppContribution {
  @Autowired()
  monacoService: MonacoService;

  @Autowired(CommandContribution)
  private readonly commandContributionProvider: ContributionProvider<CommandContribution>;

  async initialize(app: IClientApp) {
    // 等待 monaco 下载完毕
    await this.monacoService.loadMonaco();
    // 加载依赖 monaco 的其他组件
    const { QuickOpenCommandContribution } = require('./quick-open.command.contributuin');
    const { MonacoQuickOpenService } = require('./quick-open.service');
    const { QuickPickServiceImpl } = require('./quick-pick.service');

    this.commandContributionProvider.addContribution(QuickOpenCommandContribution);
    app.injector.addProviders({
      token: QuickOpenService,
      useClass: MonacoQuickOpenService,
    }, {
      token: QuickPickService,
      useClass: QuickPickServiceImpl,
    });
  }
}
