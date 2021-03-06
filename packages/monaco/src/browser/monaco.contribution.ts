import { Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  PreferenceService,
  JsonSchemaContribution,
  ISchemaStore,
  PreferenceScope,
  IJSONSchemaRegistry,
  Disposable,
  CommandRegistry,
  IMimeService,
  CorePreferences,
  ClientAppContribution,
  CommandContribution,
  ContributionProvider,
  Domain,
  MonacoService,
  MonacoContribution,
  ServiceNames,
  KeybindingContribution,
  KeybindingRegistry,
  IOpenerService,
  MonacoOverrideServiceRegistry,
} from '@opensumi/ide-core-browser';
import {
  IMenuRegistry,
  MenuContribution,
  MenuId,
  IMenuItem,
  ISubmenuItem,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { URI, ILogger } from '@opensumi/ide-core-common';
import { IIconService, IThemeService } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser/icon.service';
import {
  ISemanticTokenRegistry,
  parseClassifierString,
  TokenStyle,
} from '@opensumi/ide-theme/lib/common/semantic-tokens-registry';
import { registerEditorContribution } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorExtensions';
import { CodeEditorServiceImpl } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/codeEditorServiceImpl';
import { OpenerService } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/openerService';
import { IEditorContribution } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';
import { EditorContextKeys } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorContextKeys';
import { CompletionProviderRegistry } from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';
import {
  FormattingConflicts,
  IFormattingEditProviderSelector,
} from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/format/format';
import { StandaloneCommandService } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/simpleServices';
import { StaticServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import * as monacoActions from '@opensumi/monaco-editor-core/esm/vs/platform/actions/common/actions';
import {
  ContextKeyExpr,
  ContextKeyExprType,
} from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';
import * as monacoKeybindings from '@opensumi/monaco-editor-core/esm/vs/platform/keybinding/common/keybindingsRegistry';

import {
  EditorExtensionsRegistry,
  ICommandServiceToken,
  IMonacoActionRegistry,
  IMonacoCommandService,
  IMonacoCommandsRegistry,
} from './contrib/command';
import { ITextmateTokenizer, ITextmateTokenizerService } from './contrib/tokenizer';
import { ICodeEditor } from './monaco-api/editor';
import { MonacoMenus } from './monaco-menu';
import { MonacoSnippetSuggestProvider } from './monaco-snippet-suggest-provider';
import { MonacoResolvedKeybinding } from './monaco.resolved-keybinding';

@Domain(ClientAppContribution, CommandContribution, MenuContribution, KeybindingContribution)
export class MonacoClientContribution
  implements ClientAppContribution, CommandContribution, MenuContribution, KeybindingContribution
{
  @Autowired()
  monacoService: MonacoService;

  @Autowired(MonacoContribution)
  monacoContributionProvider: ContributionProvider<MonacoContribution>;

  @Autowired(JsonSchemaContribution)
  schemaContributionProvider: ContributionProvider<JsonSchemaContribution>;

  @Autowired(ICommandServiceToken)
  monacoCommandService: IMonacoCommandService;

  @Autowired(IMonacoCommandsRegistry)
  monacoCommandRegistry: IMonacoCommandsRegistry;

  @Autowired(IMonacoActionRegistry)
  monacoActionRegistry: IMonacoActionRegistry;

  @Autowired(ITextmateTokenizer)
  private textmateService!: ITextmateTokenizerService;

  @Autowired(IThemeService)
  themeService: IThemeService;

  @Autowired(IIconService)
  private iconService: IconService;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @Autowired(ISchemaStore)
  schemaStore: ISchemaStore;

  @Autowired(IJSONSchemaRegistry)
  jsonContributionRegistry: IJSONSchemaRegistry;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(CorePreferences)
  corePreferences: CorePreferences;

  @Autowired(IMimeService)
  mimeService: IMimeService;

  @Autowired(ISemanticTokenRegistry)
  protected readonly semanticTokenRegistry: ISemanticTokenRegistry;

  @Autowired(MonacoSnippetSuggestProvider)
  protected readonly snippetSuggestProvider: MonacoSnippetSuggestProvider;

  @Autowired(IOpenerService)
  private readonly openerService: IOpenerService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(MonacoOverrideServiceRegistry)
  private readonly overrideServicesRegistry: MonacoOverrideServiceRegistry;

  get editorExtensionsRegistry(): typeof EditorExtensionsRegistry {
    return EditorExtensionsRegistry;
  }

  async initialize() {
    // ?????? monaco ??????????????? override services
    // ??????????????????????????????????????? monaco ??????????????????????????? editor ??????
    this.registerOverrideServices();

    // ???????????? MonacoContribution
    for (const contrib of this.monacoContributionProvider.getContributions()) {
      // ???????????? MonacoContribution ??? registerOverrideService ????????????????????? overrideService
      if (contrib.registerOverrideService) {
        contrib.registerOverrideService(this.overrideServicesRegistry);
      }

      // ?????? Monaco ???????????????????????????????????? Select ??????????????? OpenSumi ????????????????????????
      if (contrib.registerMonacoDefaultFormattingSelector) {
        contrib.registerMonacoDefaultFormattingSelector(this.registryDefaultFormattingSelector);
      }

      // ??????/???????????? monaco ????????? EditorExtensionContribution????????? ContextMenu
      if (contrib.registerEditorExtensionContribution) {
        contrib.registerEditorExtensionContribution(
          (id: string, contribCtor: new (editor: ICodeEditor, ...services: any) => IEditorContribution) => {
            const existContrib = this.editorExtensionsRegistry.getSomeEditorContributions([id]);
            if (existContrib.length === 0) {
              registerEditorContribution(id, contribCtor);
            } else {
              existContrib[0].ctor = contribCtor;
            }
          },
        );
      }
    }

    // ???????????? SchemaContribution
    for (const contribution of this.schemaContributionProvider.getContributions()) {
      contribution.registerSchema(this.jsonContributionRegistry);
    }

    // ?????? Schema ???????????????
    this.setSchemaPreferenceListener(this.schemaStore);

    // ?????? preferences ??????????????????????????? mime
    this.setPreferencesChangeListener();

    // ???????????? Monaco ?????? Services ?????????
    this.patchMonacoInternalServices();

    // ??????/?????? Monaco ???????????????
    this.patchMonacoInternalMenus();

    // ?????? Mime
    this.mimeService.updateMime();

    // ???????????????????????????????????? textmateService
    this.initTextmateService();
  }

  onDidStart() {
    // DefaultEndOfLine ????????????
    CompletionProviderRegistry.register(this.snippetSuggestProvider.registeredLanguageIds, this.snippetSuggestProvider);
  }

  private registerOverrideServices() {
    const codeEditorService = this.overrideServicesRegistry.getRegisteredService<CodeEditorServiceImpl>(
      ServiceNames.CODE_EDITOR_SERVICE,
    );

    // Monaco CommandService
    const standaloneCommandService = new StandaloneCommandService(StaticServices.instantiationService.get());
    // ??? monacoCommandService ????????????????????? monaco ???????????? standaloneCommandService ??????
    this.monacoCommandService.setDelegate(standaloneCommandService);
    // ?????? monaco ????????? commandService
    this.overrideServicesRegistry.registerOverrideService(ServiceNames.COMMAND_SERVICE, this.monacoCommandService);

    // Monaco OpenerService
    const monacoOpenerService = new OpenerService(codeEditorService!, this.monacoCommandService);
    monacoOpenerService.registerOpener({
      open: (uri) => this.interceptOpen(new URI(uri.toString())),
    });
    this.overrideServicesRegistry.registerOverrideService(ServiceNames.OPENER_SERVICE, monacoOpenerService);
  }

  private patchMonacoInternalServices() {
    this.patchMonacoThemeService();

    const codeEditorService = this.overrideServicesRegistry.getRegisteredService(ServiceNames.CODE_EDITOR_SERVICE);
    // ?????? StaticServices ???????????? codeEditorService ??????
    (StaticServices as unknown as any).codeEditorService = {
      get: () => codeEditorService,
    };
  }

  private patchMonacoInternalMenus() {
    const menuRegistry = this.injector.get(IMenuRegistry) as IMenuRegistry;
    const monacoMenuRegistry = monacoActions.MenuRegistry;
    // editor/context
    monacoMenuRegistry.getMenuItems(monacoActions.MenuId.EditorContext).forEach((item) => {
      const menuItem = transformMonacoMenuItem(item);
      /**
       * monaco ??? editor/context ????????????????????????
       * opensumi ???????????? ?????????
       * ?????????????????????????????? (????????????????????????)
       */
      menuRegistry.registerMenuItem(MenuId.EditorContext as unknown as string, menuItem);
    });

    // editor/context submenu contextPeek
    monacoMenuRegistry.getMenuItems(monacoActions.MenuId.EditorContextPeek).forEach((item) => {
      const menuItem = transformMonacoMenuItem(item);
      menuRegistry.registerMenuItem(monacoActions.MenuId.EditorContextPeek as unknown as string, menuItem);
    });

    const originalAppendItem = monacoMenuRegistry.appendMenuItem;
    monacoMenuRegistry.appendMenuItem = (menuId, item) => {
      const disposer = new Disposable();
      disposer.addDispose(originalAppendItem.apply(monacoMenuRegistry, [menuId, item]));
      /**
       * monaco ??? editor/context ????????????????????????
       * opensumi ???????????? ?????????
       * ??????????????????????????????
       */
      if (menuId === monacoActions.MenuId.EditorContext) {
        disposer.addDispose(menuRegistry.registerMenuItem(MenuId.EditorContext, transformMonacoMenuItem(item)));
      } else {
        disposer.addDispose(menuRegistry.registerMenuItem(menuId as unknown as string, transformMonacoMenuItem(item)));
      }
      return disposer;
    };
  }

  private initTextmateService() {
    this.textmateService.init();
    const currentTheme = this.themeService.getCurrentThemeSync();
    const themeData = currentTheme.themeData;
    this.textmateService.setTheme(themeData);
    this.textmateService.initialized = true;
  }

  private registryDefaultFormattingSelector(selector: IFormattingEditProviderSelector) {
    (FormattingConflicts as unknown as any)._selectors.unshift(selector);
  }

  protected setPreferencesChangeListener() {
    this.corePreferences.onPreferenceChanged((e) => {
      if (e.preferenceName === 'files.associations') {
        this.mimeService.updateMime();
      }
    });
  }

  protected setSchemaPreferenceListener(registry: ISchemaStore) {
    this.schemaStore.onSchemasChanged(() => {
      const configs = registry.getConfigurations();
      this.preferenceService.set('json.schemas', configs, PreferenceScope.Default);
    });
  }

  private patchMonacoThemeService() {
    const standaloneThemeService = StaticServices.standaloneThemeService.get();
    const originalGetColorTheme: typeof standaloneThemeService.getColorTheme =
      standaloneThemeService.getColorTheme.bind(standaloneThemeService);
    const patchedGetTokenStyleMetadataFlag = '__patched_getTokenStyleMetadata';

    standaloneThemeService.getColorTheme = () => {
      const theme = originalGetColorTheme();
      if (!(patchedGetTokenStyleMetadataFlag in theme)) {
        Object.defineProperty(theme, patchedGetTokenStyleMetadataFlag, {
          enumerable: false,
          configurable: false,
          writable: false,
          value: true,
        });

        // ?????? patch ?????? getTokenStyleMetadata ????????? monaco ???????????? SemanticTokens ?????????????????? StandaloneThemeService
        // ????????? themeService ??? SemanticTokens ??????????????????????????????????????????????????????????????? TokenStyle ?????????????????? themeService ???????????????
        theme.getTokenStyleMetadata = (
          typeWithLanguage: string,
          modifiers: string[],
          defaultLanguage: string,
          useDefault = true,
          definitions: any = {},
        ) => {
          const { type, language } = parseClassifierString(typeWithLanguage, defaultLanguage);
          const style: TokenStyle | undefined = theme['themeData'].getTokenStyle(
            type,
            modifiers,
            language,
            useDefault,
            definitions,
          );
          if (!style) {
            return undefined;
          }
          return {
            foreground: theme['themeData'].getTokenColorIndex().get(style.foreground),
            bold: style.bold,
            underline: style.underline,
            italic: style.italic,
          };
        };
      }
      return theme;
    };

    standaloneThemeService.getFileIconTheme = () => this.iconService.currentTheme;
  }

  registerCommands(commands: CommandRegistry) {
    // ?????? monaco ????????? action
    this.monacoActionRegistry.registerMonacoActions();
  }

  registerMenus(menuRegistry: IMenuRegistry) {
    // ?????? Monaco ???????????????
    for (const group of MonacoMenus.SELECTION_GROUPS) {
      group.actions.forEach((action, index) => {
        const commandId = this.monacoCommandRegistry.validate(action);
        if (commandId) {
          menuRegistry.registerMenuItem(MenuId.MenubarSelectionMenu, {
            command: commandId,
            group: group.id,
            order: index,
          });
        }
      });
    }
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    const monacoKeybindingsRegistry = monacoKeybindings.KeybindingsRegistry;
    const editorFocus = EditorContextKeys.focus;

    const defaultItems = monacoKeybindingsRegistry.getDefaultKeybindings();

    // ??? Monaco ??? Keybinding ????????? ide ???
    for (const item of defaultItems) {
      const command = this.monacoCommandRegistry.validate(item.command);
      if (command) {
        const raw = item.keybinding;

        // monaco keybindingRegistry????????????keybinding?????????editorFocus???when,
        // ???????????????keybinding????????????????????? textInputFocus ??????????????????????????????????????????
        let when = item.when;
        if (!when) {
          when = editorFocus;
        } else {
          // when ????????? editorFocus ???????????????
          if (!when.keys().includes('editorFocus')) {
            // ??????????????? or ?????????????????? a && (b || c) ??????
            // ???????????? (a && b) || (a && c) ??????????????????
            // serialize ????????????????????? a && b || a && c
            // monaco-editor contextkey ?????????????????? && ??????????????? ||
            if (when.type === ContextKeyExprType.Or) {
              const exprs = when.expr;
              when = ContextKeyExpr.or(...exprs.map((expr) => ContextKeyExpr.and(expr, editorFocus)));
            } else {
              when = ContextKeyExpr.and(when, editorFocus);
            }
          }
        }
        // ?????? monaco ?????????
        const keybindingStr = raw.parts.map((part) => MonacoResolvedKeybinding.keyCode(part)).join(' ');
        // monaco?????????????????????????????????????????????????????????????????? * 100
        const keybinding = {
          command,
          args: item.commandArgs,
          keybinding: keybindingStr,
          when,
          priority: (item.weight1 ? item.weight1 * 100 : 0) + (item.weight2 || 0),
        };

        keybindings.registerKeybinding(keybinding);
      }
    }
  }

  protected async interceptOpen(uri: URI) {
    try {
      await this.openerService.open(uri);
      return true;
    } catch (e) {
      this.logger.error(e);
      return false;
    }
  }
}

function transformMonacoMenuItem(item: monacoActions.IMenuItem | monacoActions.ISubmenuItem): IMenuItem | ISubmenuItem {
  if (monacoActions.isIMenuItem(item)) {
    return {
      command: {
        id: item.command.id,
        label: typeof item.command.title === 'string' ? item.command.title : item.command.title.value,
      },
      group: item.group,
      when: item.when,
      order: item.order,
    };
  }

  return {
    submenu: item.submenu as unknown as string,
    label: typeof item.title === 'string' ? item.title : item.title.value,
    when: item.when,
    group: item.group,
    order: item.order,
  };
}
