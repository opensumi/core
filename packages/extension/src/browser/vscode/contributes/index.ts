import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Optional } from '@opensumi/di';
import {
  PreferenceSchema,
  PreferenceSchemaProperties,
  IJSONSchemaRegistry,
  localize,
  ILogger,
  WithEventBus,
  IEventBus,
  EXTENSION_JSON_URI,
  VSCodeExtensionPackageSchema,
  runWhenIdle,
} from '@opensumi/ide-core-browser';

import { IExtensionMetaData, CONTRIBUTE_NAME_KEY } from '../../../common';
import { CustomEditorScheme } from '../../../common/vscode/custom-editor';
import { ExtensionWillContributeEvent } from '../../types';

import { ActionContributionSchema, ActionsContributionPoint } from './actions';
import { BreakpointsContributionScheme, BreakpointsContributionPoint } from './breakpoints';
import { ColorsSchema, ColorsContributionPoint } from './color';
import { CommandsSchema, CommandsContributionPoint } from './commands';
import { ConfigurationContributionPoint } from './configuration';
import { ConfigurationDefaultsContributionPoint } from './configurationDefaults';
import { CustomEditorContributionPoint } from './customEditors';
import { DebuggersContributionScheme, DebuggersContributionPoint } from './debuggers';
import { GrammarsContributionPoint, GrammarSchema } from './grammar';
import { IconThemesContributionPoint } from './icon';
import { KeybindingSchema, KeybindingContributionPoint } from './keybindings';
import { LanguagesSchema, LanguagesContributionPoint } from './language';
import { LocalizationsContributionPoint } from './localization';
import { MenusContributionPoint, SubmenusContributionPoint } from './menu';
import { ProblemMatchersContributions, ProblemMatchersContributionPoint } from './problemMatchers';
import { ProblemPatterns, ProblemPatternsContributionPoint } from './problemPatterns';
import { SemanticTokenModifiersContributionPoint } from './semanticTokenModifiers';
import { SemanticTokenScopesContributionPoint } from './semanticTokenScopes';
import { SemanticTokenTypesContributionPoint } from './semanticTokenTypes';
import { SnippetSchema, SnippetsContributionPoint } from './snippets';
import { ITaskDefinitionSchema, TaskDefinitionContributionPoint } from './taskDefinition';
import { TerminalContributionPoint } from './terminal';
import { ThemesSchema, ThemesContributionPoint } from './theme';
import { ViewContainersSchema, ViewContainersContributionPoint } from './view-containers';
import { ViewsSchema, ViewsContributionPoint } from './views';
import { ViewsWelcomeContributionPoint } from './views-welcome';

export interface ContributesSchema {
  commands?: CommandsSchema;
  themes?: ThemesSchema;
  iconThemes?: ThemesSchema;
  languages?: LanguagesSchema;
  grammars?: GrammarSchema;
  configuration?: PreferenceSchema | PreferenceSchema[];
  configurationDefaults?: PreferenceSchemaProperties;
  colors?: ColorsSchema;
  keybinding?: KeybindingSchema;
  snippets?: SnippetSchema;
  viewContainers?: ViewContainersSchema;
  views: ViewsSchema;
  debuggers: DebuggersContributionScheme;
  breakpoints: BreakpointsContributionScheme;
  actions: ActionContributionSchema;
  taskDefinition: ITaskDefinitionSchema;
  problemPatterns: ProblemPatterns;
  problemeMatchers: ProblemMatchersContributions;
  customEditors?: CustomEditorScheme[];
}

const CONTRIBUTES_SYMBOL = Symbol();

@Injectable({ multiple: true })
export class VSCodeContributeRunner extends WithEventBus {
  static ContributePoints = [
    LocalizationsContributionPoint,
    CommandsContributionPoint,
    ThemesContributionPoint,
    IconThemesContributionPoint,
    GrammarsContributionPoint,
    LanguagesContributionPoint,
    ConfigurationContributionPoint,
    ConfigurationDefaultsContributionPoint,
    ColorsContributionPoint,
    KeybindingContributionPoint,
    SubmenusContributionPoint,
    MenusContributionPoint,
    SnippetsContributionPoint,
    ViewContainersContributionPoint,
    ViewsContributionPoint,
    ViewsWelcomeContributionPoint,
    BreakpointsContributionPoint,
    DebuggersContributionPoint,
    ActionsContributionPoint,
    TaskDefinitionContributionPoint,
    ProblemPatternsContributionPoint,
    ProblemMatchersContributionPoint,
    CustomEditorContributionPoint,
    SemanticTokenTypesContributionPoint,
    SemanticTokenModifiersContributionPoint,
    SemanticTokenScopesContributionPoint,
    TerminalContributionPoint,
  ];

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(IJSONSchemaRegistry)
  schemaRegistry: IJSONSchemaRegistry;

  @Autowired(IEventBus)
  protected eventBus: IEventBus;

  @Autowired(ILogger)
  private logger: ILogger;

  constructor(@Optional(CONTRIBUTES_SYMBOL) private extension: IExtensionMetaData) {
    super();
  }

  public async run() {
    // superSet merge here
    const contributes: ContributesSchema = this.extension.packageJSON.contributes;
    if (!contributes) {
      return;
    }

    const skipContribute = await this.eventBus.fireAndAwait(new ExtensionWillContributeEvent(this.extension));

    if (skipContribute.length > 0 && skipContribute[0].result) {
      return;
    }
    await Promise.all([
      VSCodeContributeRunner.ContributePoints.map(async (ContributePointConstructor) => {
        const contributeName = Reflect.getMetadata(CONTRIBUTE_NAME_KEY, ContributePointConstructor);
        if (contributes[contributeName] !== undefined) {
          try {
            const contributePoint = this.injector.get(ContributePointConstructor, [
              contributes[contributeName],
              contributes,
              this.extension,
              this.extension.packageNlsJSON,
              this.extension.defaultPkgNlsJSON,
            ]);

            if (ContributePointConstructor.schema) {
              VSCodeExtensionPackageSchema.properties.contributes.properties[contributeName] =
                ContributePointConstructor.schema;
            }

            this.addDispose(contributePoint);
            await contributePoint.contribute();
          } catch (e) {
            this.logger.error(e);
          }
        }
      }),
    ]);
    this.schemaRegistry.registerSchema(EXTENSION_JSON_URI, VSCodeExtensionPackageSchema, ['package.json']);
  }
}
