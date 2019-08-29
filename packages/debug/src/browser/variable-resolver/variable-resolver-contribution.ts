import { Injectable, Autowired } from '@ali/common-di';
import { ClientAppContribution, ContributionProvider, Command, CommandContribution, CommandRegistry } from '@ali/ide-core-browser';
import { VariableQuickOpenService } from './variable-quick-open-service';
import { VariableRegistry, VariableContribution } from './variable';

export const LIST_VARIABLES: Command = {
    id: 'variable.list',
    label: 'Variable: List All',
};

@Injectable()
export class VariableResolverFrontendContribution implements ClientAppContribution, CommandContribution {

    @Autowired(ContributionProvider)
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
