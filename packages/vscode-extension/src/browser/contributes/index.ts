import { CommandsSchema, CommandsContributionPoint } from './commands';
import { Disposable } from '@ali/ide-core-browser';
import { Autowired, Injectable, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ThemesSchema, ThemesContributionPoint } from './theme';

export interface ContributesSchema {

  commands: CommandsSchema;
  themes: ThemesSchema;

}

@Injectable({multiple: true})
export class VscodeContributesRunner extends Disposable {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  constructor(private contributes: ContributesSchema) {
    super();
  }

  run() {

    if (this.contributes) {
      if (this.contributes.commands) {
        const commandsContributionPoint = this.injector.get(CommandsContributionPoint, [this.contributes.commands]);
        this.addDispose(commandsContributionPoint);
        commandsContributionPoint.contribute();
      }
      if (this.contributes.themes) {
        const themesContributionPoint = this.injector.get(ThemesContributionPoint, [this.contributes.themes]);
        this.addDispose(themesContributionPoint);
        themesContributionPoint.contribute();
      }
    }

  }

}
