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
  IContextKeyService,
  IOpenerService,
  MonacoOverrideServiceRegistry,
  FormattingSelectorType,
} from '@opensumi/ide-core-browser';
import {
  IMenuRegistry,
  NextMenuContribution as MenuContribution,
  MenuId,
  IMenuItem,
  ISubmenuItem,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { URI, ILogger } from '@opensumi/ide-core-common';
import { IThemeService } from '@opensumi/ide-theme';
import {
  ISemanticTokenRegistry,
  parseClassifierString,
  TokenStyle,
} from '@opensumi/ide-theme/lib/common/semantic-tokens-registry';
import { CodeEditorServiceImpl } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/codeEditorServiceImpl';
import { OpenerService } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/openerService';
import { EditorContextKeys } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorContextKeys';
import { CompletionProviderRegistry } from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';
import { FormattingConflicts } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/format/format';
import { StandaloneCommandService } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/simpleServices';
import { StaticServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import * as monacoActions from '@opensumi/monaco-editor-core/esm/vs/platform/actions/common/actions';
import {
  ContextKeyExpr,
  ContextKeyExprType,
} from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';
import * as monacoKeybindings from '@opensumi/monaco-editor-core/esm/vs/platform/keybinding/common/keybindingsRegistry';

import {
  ICommandServiceToken,
  IMonacoActionRegistry,
  IMonacoCommandService,
  IMonacoCommandsRegistry,
} from './contrib/command';
import { ITextmateTokenizer, ITextmateTokenizerService } from './contrib/tokenizer';
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

  async initialize() {
    // 保留这个空的 loadMonaco 行为
    await this.monacoService.loadMonaco();
    // 注册 monaco 模块原有的 override services
    // 由于历史原因，这部分实现在 monaco 模块，后需要迁移到 editor 模块
    this.registerOverrideServices();

    // 执行所有 MonacoContribution
    for (const contribution of this.monacoContributionProvider.getContributions()) {
      // onMonacoLoaded 待废弃, 暂时也会触发 onMonacoLoaded 事件，待集成方改造以后去除
      if (contribution.onMonacoLoaded) {
        // eslint-disable-next-line no-console
        console.warn(!!contribution.onMonacoLoaded, 'MonacoContribution#onMonacoLoaded was deprecated.');
        contribution.onMonacoLoaded(this.monacoService);
      }

      // 执行所有 MonacoContribution 的 registerOverrideService 方法，用来注册 overrideService
      if (contribution.registerOverrideService) {
        contribution.registerOverrideService(this.overrideServicesRegistry);
      }

      // 注册 Monaco 内置的格式化选择器，触发 Select 操作时使用 KAITIAN 自己实现的选择器
      if (contribution.registerMonacoDefaultFormattingSelector) {
        contribution.registerMonacoDefaultFormattingSelector(this.registryDefaultFormattingSelector);
      }

      // onContextKeyServiceReady 待废弃, 暂时也会触发 onContextKeyServiceReady 事件，待集成方改造以后去除
      if (contribution.onContextKeyServiceReady) {
        // eslint-disable-next-line no-console
        console.warn(
          !!contribution.onContextKeyServiceReady,
          'MonacoContribution#onContextKeyServiceReady was deprecated.',
        );
        contribution.onContextKeyServiceReady(this.injector.get(IContextKeyService));
      }
    }

    // 执行所有 SchemaContribution
    for (const contribution of this.schemaContributionProvider.getContributions()) {
      contribution.registerSchema(this.jsonContributionRegistry);
    }

    // 监听 Schema 改变的事件
    this.setSchemaPreferenceListener(this.schemaStore);

    // 监听 preferences 更新事件，同步更新 mime
    this.setPreferencesChangeListener();

    // 修改一些 Monaco 内置 Services 的行为
    this.patchMonacoInternalServices();

    // 注册/拦截 Monaco 内置的菜单
    this.patchMonacoInternalMenus();

    // 更新 Mime
    this.mimeService.updateMime();

    // 在编辑器全部恢复前初始化 textmateService
    this.initTextmateService();
  }

  onDidStart() {
    // DefaultEndOfLine 类型冲突
    CompletionProviderRegistry.register(this.snippetSuggestProvider.registeredLanguageIds, this.snippetSuggestProvider);
  }

  private registerOverrideServices() {
    const codeEditorService = this.overrideServicesRegistry.getRegisteredService<CodeEditorServiceImpl>(
      ServiceNames.CODE_EDITOR_SERVICE,
    );

    // Monaco CommandService
    const standaloneCommandService = new StandaloneCommandService(StaticServices.instantiationService.get());
    // 给 monacoCommandService 设置委托，执行 monaco 命令使用 standaloneCommandService 执行
    this.monacoCommandService.setDelegate(standaloneCommandService);
    // 替换 monaco 内部的 commandService
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
    // 替换 StaticServices 上挂载的 codeEditorService 实例
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
       * monaco 中 editor/context 是一个数字枚举值
       * opensumi 中是一个 字符串
       * 这里做了一层代理转换 (下方也有代理注册)
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
       * monaco 中 editor/context 是一个数字枚举值
       * opensumi 中是一个 字符串
       * 这里做了一层代理注册
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

  private registryDefaultFormattingSelector(selector: FormattingSelectorType) {
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
    const originalGetTheme: typeof standaloneThemeService.getColorTheme =
      standaloneThemeService.getColorTheme.bind(standaloneThemeService);
    const patchedGetTokenStyleMetadataFlag = '__patched_getTokenStyleMetadata';

    standaloneThemeService.getColorTheme = () => {
      const theme = originalGetTheme();
      if (!(patchedGetTokenStyleMetadataFlag in theme)) {
        Object.defineProperty(theme, patchedGetTokenStyleMetadataFlag, {
          enumerable: false,
          configurable: false,
          writable: false,
          value: true,
        });

        // 这里 patch 一个 getTokenStyleMetadata 原因是 monaco 内部获取 SemanticTokens 时只走内部的 StandaloneThemeService
        // 注册在 themeService 的 SemanticTokens 没有被同步进去，所以在这里做一次处理，获取 TokenStyle 时基于外部的 themeService 来计算样式
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
  }

  registerCommands(commands: CommandRegistry) {
    // 注册 monaco 所有的 action
    this.monacoActionRegistry.registerMonacoActions();
  }

  registerMenus(menuRegistry: IMenuRegistry) {
    // 注册 Monaco 的选择命令
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

    // 将 Monaco 的 Keybinding 同步到 ide 中
    for (const item of defaultItems) {
      const command = this.monacoCommandRegistry.validate(item.command);
      if (command) {
        const raw = item.keybinding;

        // monaco keybindingRegistry中取出的keybinding缺少了editorFocus的when,
        // 当向开天的keybinding注册时需要加上 textInputFocus ，避免焦点不在编辑器时响应到
        let when = item.when;
        if (!when) {
          when = editorFocus;
        } else {
          // when 中没有 editorFocus 时再做追加
          if (!when.keys().includes('editorFocus')) {
            // 当其内部为 or 时，避免出现 a && (b || c) 报错
            // 因此改成 (a && b) || (a && c) 这样不会报错
            // serialize 之后的结果类似 a && b || a && c
            // monaco-editor contextkey 的计算规则中 && 优先级高于 ||
            if (when.type === ContextKeyExprType.Or) {
              const exprs = when.expr;
              when = ContextKeyExpr.or(...exprs.map((expr) => ContextKeyExpr.and(expr, editorFocus)));
            } else {
              when = ContextKeyExpr.and(when, editorFocus);
            }
          }
        }
        // 转换 monaco 快捷键
        const keybindingStr = raw.parts.map((part) => MonacoResolvedKeybinding.keyCode(part)).join(' ');
        // monaco内优先级计算时为双优先级相加，第一优先级权重 * 100
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
