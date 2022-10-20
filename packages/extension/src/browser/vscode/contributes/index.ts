import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  PreferenceSchema,
  PreferenceSchemaProperties,
  ILogger,
  WithEventBus,
  runWhenIdle,
  JSONType,
  ConstructorOf,
  IExtensionsSchemaService,
} from '@opensumi/ide-core-browser';
import {
  AppLifeCycleService,
  AppLifeCycleServiceToken,
  LifeCyclePhase,
} from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';

import {
  LIFE_CYCLE_PHASE_KEY,
  CONTRIBUTE_NAME_KEY,
  VSCodeContributePoint,
  ExtensionContributesService,
} from '../../../common';
import { CustomEditorScheme } from '../../../common/vscode/custom-editor';

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

export const VSCodeContributesServiceToken = Symbol('VSCodeContributesService');

@Injectable()
export class VSCodeContributesService extends ExtensionContributesService {
  ContributionPoints = [
    ThemesContributionPoint,
    IconThemesContributionPoint,
    LocalizationsContributionPoint,
    CommandsContributionPoint,
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
  ] as typeof VSCodeContributePoint[];
}
