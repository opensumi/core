import { Autowired } from '@ali/common-di';
import { ClientAppContribution, ContributionProvider, Command, CommandContribution, CommandRegistry, Domain, VariableRegistry, VariableContribution } from '@ali/ide-core-browser';
import { VariableQuickOpenService } from './variable-quick-open-service';

export const LIST_VARIABLES: Command = {
  id: 'variable.list',
  label: 'Variable: List All',
};

@Domain(ClientAppContribution, CommandContribution)
export class VariableResolverContribution implements ClientAppContribution, CommandContribution {

  @Autowired(VariableContribution)
  protected readonly contributionProvider: ContributionProvider<VariableContribution>;

  @Autowired(VariableRegistry)
  protected readonly variableRegistry: VariableRegistry;

  @Autowired(VariableQuickOpenService)
  protected readonly variableQuickOpenService: VariableQuickOpenService;

  onStart(): void {
    this.contributionProvider.getContributions().forEach((contrib) =>
      contrib.registerVariables(this.variableRegistry),
    );
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(LIST_VARIABLES, {
      isEnabled: () => true,
      execute: () => this.variableQuickOpenService.open(),
    });
  }
}
