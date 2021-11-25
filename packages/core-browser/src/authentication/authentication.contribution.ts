import { Autowired } from '@opensumi/common-di';
import { ClientAppContribution } from '../common/common.define';
import { Domain, IAuthenticationService, CommandContribution, CommandRegistry, noAccountsId } from '@opensumi/ide-core-common';

@Domain(ClientAppContribution, CommandContribution)
export class AuthenticationContribution implements ClientAppContribution, CommandContribution {

  @Autowired(IAuthenticationService)
  protected readonly authenticationService: IAuthenticationService;

  onStart() {
    this.authenticationService.initialize();
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand({
      id: noAccountsId,
      label: '%authentication.noAccounts%',
    }, {
      execute: () => {
        // noop
        // 点击菜单时空实现
      },
    });
  }
}
