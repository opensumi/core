import { CommandsSchema, CommandsContributionPoint } from './commands';
import { Disposable, ConstructorOf, getLogger } from '@ali/ide-core-browser';
import { Autowired, Injectable, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ThemesSchema, ThemesContributionPoint } from './theme';
import { VscodeContributionPoint, CONTRIBUTE_NAME_KEY } from './common';
import { IFeatureExtension } from '@ali/ide-feature-extension/lib/browser';
import { LanguagesSchema, LanguagesContributionPoint } from './language';
import { GrammarsContributionPoint, GrammarSchema } from './grammar';

export interface ContributesSchema {

  commands: CommandsSchema;
  themes: ThemesSchema;
  languages: LanguagesSchema;
  grammars: GrammarSchema;

}

export interface ContributionPointEntry {
  name: 'commands';
  point: ConstructorOf<VscodeContributionPoint>;
}

@Injectable({multiple: true})
export class VscodeContributesRunner extends Disposable {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  static ContributionPoints: ConstructorOf<VscodeContributionPoint>[] = [
    CommandsContributionPoint,
    ThemesContributionPoint,
    LanguagesContributionPoint,
    GrammarsContributionPoint,
  ];

  constructor(private contributes: ContributesSchema) {
    super();
  }

  async run(extension?: IFeatureExtension) {

    for (const contributionCls of VscodeContributesRunner.ContributionPoints) {
      const contributesName = Reflect.getMetadata(CONTRIBUTE_NAME_KEY, contributionCls);
      if (this.contributes[contributesName] !== undefined) {
        try {
          const contributionPoint = this.injector.get(contributionCls, [this.contributes[contributesName], this.contributes, extension]);
          this.addDispose(contributionPoint);
          await contributionPoint.contribute();
        } catch (e) {
          getLogger().error(e);
        }
      }
    }

  }

}
