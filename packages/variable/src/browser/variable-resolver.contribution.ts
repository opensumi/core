import { Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  Command,
  CommandContribution,
  CommandRegistry,
  ContributionProvider,
  Domain,
  VariableContribution,
  VariableRegistry,
} from '@opensumi/ide-core-browser';

import { VariableQuickOpenService } from './variable-quick-open.service';

export const LIST_VARIABLES: Command = {
  id: 'variable.list',
  label: '%variable.list.all%',
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
    this.contributionProvider.getContributions().forEach((contrib) => contrib.registerVariables(this.variableRegistry));
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(LIST_VARIABLES, {
      execute: () => this.variableQuickOpenService.open(),
    });
  }
}
