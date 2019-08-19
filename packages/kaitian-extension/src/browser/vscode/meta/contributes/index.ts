import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Optional} from '@ali/common-di';
import { Disposable, ConstructorOf, getLogger } from '@ali/ide-core-browser';
import { IExtensionMetaData, VSCodeContributePoint, CONTRIBUTE_NAME_KEY } from '../../../../common';

import { CommandsSchema, CommandsContributionPoint } from './commands';
import { ThemesSchema, ThemesContributionPoint } from './theme';
import { LanguagesSchema, LanguagesContributionPoint } from './language';
import { GrammarsContributionPoint, GrammarSchema } from './grammar';
import { ConfigurationContributionPoint, ConfigurationsSchema } from './configuration';
import { ColorsSchema, ColorsContributionPoint } from './color';
import { LocalizationsContributionPoint } from './localization';
import { KeybindingSchema, KeybindingContributionPoint } from './keybindings';
import { MenusContributionPoint } from './menu';
import { SnippetSchema, SnippetsContributionPoint } from './snippets';
import { ViewContainersSchema, ViewContainersContributionPoint } from './view-containers';

export interface ContributesSchema {

  commands?: CommandsSchema;
  themes?: ThemesSchema;
  languages?: LanguagesSchema;
  grammars?: GrammarSchema;
  configuration?: ConfigurationsSchema;
  colors?: ColorsSchema;
  keybinding?: KeybindingSchema;
  snippets?: SnippetSchema;
  viewContainers?: ViewContainersSchema;
}

const CONTRIBUTES_SYMBOL = Symbol();

@Injectable({multiple: true})
export class VSCodeContributeRunner extends Disposable {

  static ContributePoints: ConstructorOf<VSCodeContributePoint>[] = [
    CommandsContributionPoint,
    ThemesContributionPoint,
    LanguagesContributionPoint,
    GrammarsContributionPoint,
    ConfigurationContributionPoint,
    ColorsContributionPoint,
    LocalizationsContributionPoint,
    KeybindingContributionPoint,
    MenusContributionPoint,
    SnippetsContributionPoint,
    ViewContainersContributionPoint,
  ];

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  constructor(@Optional(CONTRIBUTES_SYMBOL) private extension) {
    super();
  }

  public async run() {
    const contributes: ContributesSchema = this.extension.packageJSON.contributes;
    for (const contributeCls of VSCodeContributeRunner.ContributePoints) {
      const contributeName = Reflect.getMetadata(CONTRIBUTE_NAME_KEY, contributeCls);
      if (contributes[contributeName] !== undefined) {
        try {
          const contributePoint = this.injector.get(contributeCls, [
            contributes[contributeName],
            contributes,
            this.extension,
          ]);

          console.log('contributePoint', this.extension.packageJSON.name, contributeName );

          this.addDispose(contributePoint);
          await contributePoint.contribute();
        } catch (e) {
          getLogger().error(e);
        }
      }
    }
  }
}
