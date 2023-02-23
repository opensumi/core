import { Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  PreferenceService,
  JsonSchemaContribution,
  ISchemaStore,
  PreferenceScope,
  IJSONSchemaRegistry,
  Disposable,
  CorePreferences,
  ClientAppContribution,
  CommandContribution,
  ContributionProvider,
  Domain,
  MonacoContribution,
  ServiceNames,
  KeybindingContribution,
  KeybindingRegistry,
  IOpenerService,
  MonacoOverrideServiceRegistry,
  KeybindingScope,
  IContextKeyService,
  KeyCode,
  KeySequence,
} from '@opensumi/ide-core-browser';
import {
  IMenuRegistry,
  MenuContribution,
  MenuId,
  IMenuItem,
  ISubmenuItem,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { URI, ILogger, DisposableCollection, isString, CommandService, isOSX } from '@opensumi/ide-core-common';
import { IIconService } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser/icon.service';
import {
  ISemanticTokenRegistry,
  parseClassifierString,
  TokenStyle,
} from '@opensumi/ide-theme/lib/common/semantic-tokens-registry';
import * as monaco from '@opensumi/monaco-editor-core';
import { registerEditorContribution } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorExtensions';
import { AbstractCodeEditorService } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/abstractCodeEditorService';
import { OpenerService } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/openerService';
import { IEditorContribution } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';
import { EditorContextKeys } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorContextKeys';
import { registerPlatformLanguageAssociation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/languagesAssociations';
import {
  FormattingConflicts,
  IFormattingEditProviderSelector,
} from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/format/browser/format';
import {
  StandaloneCommandService,
  StandaloneKeybindingService,
} from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import { IStandaloneThemeService } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/common/standaloneTheme';
import * as monacoActions from '@opensumi/monaco-editor-core/esm/vs/platform/actions/common/actions';
import {
  ContextKeyExpr,
  ContextKeyExprType,
} from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';
import { IInstantiationService } from '@opensumi/monaco-editor-core/esm/vs/platform/instantiation/common/instantiation';
import * as monacoKeybindings from '@opensumi/monaco-editor-core/esm/vs/platform/keybinding/common/keybindingsRegistry';

import { DELEGATE_COMMANDS } from '../common/command';

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
import { KEY_CODE_MAP } from './monaco.keycode-map';
import { MonacoResolvedKeybinding } from './monaco.resolved-keybinding';

@Domain(ClientAppContribution, CommandContribution, MenuContribution, KeybindingContribution)
export class MonacoClientContribution
  implements ClientAppContribution, CommandContribution, MenuContribution, KeybindingContribution
{
  @Autowired(MonacoContribution)
  private readonly monacoContributionProvider: ContributionProvider<MonacoContribution>;

  @Autowired(JsonSchemaContribution)
  private readonly schemaContributionProvider: ContributionProvider<JsonSchemaContribution>;

  @Autowired(ICommandServiceToken)
  private readonly monacoCommandService: IMonacoCommandService;

  @Autowired(IMonacoCommandsRegistry)
  private readonly monacoCommandRegistry: IMonacoCommandsRegistry;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(IMonacoActionRegistry)
  private readonly monacoActionRegistry: IMonacoActionRegistry;

  @Autowired(ITextmateTokenizer)
  private readonly textmateService!: ITextmateTokenizerService;

  @Autowired(IIconService)
  private readonly iconService: IconService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(ISchemaStore)
  private readonly schemaStore: ISchemaStore;

  @Autowired(IJSONSchemaRegistry)
  private readonly jsonContributionRegistry: IJSONSchemaRegistry;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(CorePreferences)
  private readonly corePreferences: CorePreferences;

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

  @Autowired(KeybindingRegistry)
  private readonly keybindings: KeybindingRegistry;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  get editorExtensionsRegistry(): typeof EditorExtensionsRegistry {
    return EditorExtensionsRegistry;
  }

  private toDisposeOnKeybindingChange = new DisposableCollection();

  async initialize() {
    // 注册 monaco 模块原有的 override services
    // 由于历史原因，这部分实现在 monaco 模块，后需要迁移到 editor 模块
    this.registerOverrideServices();

    // 执行所有 MonacoContribution
    for (const contrib of this.monacoContributionProvider.getContributions()) {
      // 执行所有 MonacoContribution 的 registerOverrideService 方法，用来注册 overrideService
      if (contrib.registerOverrideService) {
        contrib.registerOverrideService(this.overrideServicesRegistry);
      }

      // 注册 Monaco 内置的格式化选择器，触发 Select 操作时使用 OpenSumi 自己实现的选择器
      if (contrib.registerMonacoDefaultFormattingSelector) {
        contrib.registerMonacoDefaultFormattingSelector(this.registryDefaultFormattingSelector);
      }

      // 注册/覆盖一些 monaco 内置的 EditorExtensionContribution，例如 ContextMenu
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

      // 注册 mime
      if (contrib.registerPlatformLanguageAssociations) {
        contrib.registerPlatformLanguageAssociations((associations) => {
          for (const association of associations) {
            registerPlatformLanguageAssociation(association, true);
          }
        });
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

    // 在编辑器全部恢复前初始化 textmateService
    this.initTextmateService();

    // 在快捷键被用户修改时，同步更新编辑器内的快捷键展示
    this.keybindings.onKeybindingsChanged(() => this.updateMonacoKeybindings());
  }

  private registerOverrideServices() {
    const codeEditorService = this.overrideServicesRegistry.getRegisteredService<AbstractCodeEditorService>(
      ServiceNames.CODE_EDITOR_SERVICE,
    );

    // Monaco CommandService
    const standaloneCommandService = new StandaloneCommandService(StandaloneServices.get(IInstantiationService));
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
    // FIXME: 如何替换成 StandaloneServices.get(ICodeEditorService)
    (StandaloneServices as unknown as any).codeEditorService = {
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
    this.textmateService.initialized = true;
  }

  private registryDefaultFormattingSelector(selector: IFormattingEditProviderSelector) {
    (FormattingConflicts as unknown as any)._selectors.unshift(selector);
  }

  protected updateMonacoKeybindings() {
    const monacoKeybindingsRegistry = monacoKeybindings.KeybindingsRegistry;
    if (monacoKeybindingsRegistry instanceof StandaloneKeybindingService) {
      // Keybindings only support `KeybindingScope.USER` scope now
      const userKeybindings = this.keybindings.getKeybindingByScope(KeybindingScope.USER);
      this.toDisposeOnKeybindingChange.dispose();
      for (const binding of userKeybindings) {
        const resolved = this.keybindings.resolveKeybinding(binding);
        const when = isString(binding.when) ? ContextKeyExpr.deserialize(binding.when) : binding.when;
        const command = binding.command;
        this.toDisposeOnKeybindingChange.push(
          monacoKeybindingsRegistry.addDynamicKeybinding(
            command,
            this.toMonacoKeybindingNumber(resolved),
            (_, ...args) => this.commandService.executeCommand(command, ...args),
            when,
          ),
        );
      }
    }
  }

  protected toMonacoKeybindingNumber(codes: KeyCode[]): number {
    const [firstPart, secondPart] = codes;
    if (codes.length > 2) {
      this.logger.warn('Key chords should not consist of more than two parts; got ', codes);
    }
    const encodedFirstPart = this.toSingleMonacoKeybindingNumber(firstPart);
    const encodedSecondPart = secondPart ? this.toSingleMonacoKeybindingNumber(secondPart) << 16 : 0;
    return monaco.KeyMod.chord(encodedFirstPart, encodedSecondPart);
  }

  protected toSingleMonacoKeybindingNumber(code: KeyCode): number {
    const keyCode = code.key?.keyCode !== undefined ? KEY_CODE_MAP[code.key.keyCode] : 0;
    let encoded = (keyCode >>> 0) & 0x000000ff;
    if (code.alt) {
      encoded |= monaco.KeyMod.Alt;
    }
    if (code.shift) {
      encoded |= monaco.KeyMod.Shift;
    }
    if (code.ctrl) {
      encoded |= monaco.KeyMod.WinCtrl;
    }
    if (code.meta && isOSX) {
      encoded |= monaco.KeyMod.CtrlCmd;
    }
    return encoded;
  }

  protected setPreferencesChangeListener() {
    this.corePreferences.onPreferenceChanged((e) => {
      if (e.preferenceName === 'files.associations') {
        for (const contrib of this.monacoContributionProvider.getContributions()) {
          if (contrib.registerPlatformLanguageAssociations) {
            contrib?.registerPlatformLanguageAssociations((associations) => {
              for (const association of associations) {
                registerPlatformLanguageAssociation(association, true);
              }
            });
          }
        }
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
    const standaloneThemeService = StandaloneServices.get(IStandaloneThemeService);
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
            strikethrough: undefined,
          };
        };
      }
      return theme;
    };

    standaloneThemeService.getFileIconTheme = () => this.iconService.currentTheme;
  }

  registerCommands() {
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
    for (const item of defaultItems) {
      if (
        item.command === DELEGATE_COMMANDS.UNDO ||
        item.command === DELEGATE_COMMANDS.REDO ||
        item.command === DELEGATE_COMMANDS.SELECT_ALL
      ) {
        // 针对部分被代理命令，跳过快捷键注册
        continue;
      }
      const command = this.monacoCommandRegistry.validate(item.command);
      if (command) {
        const rawKeybinding = MonacoResolvedKeybinding.toKeybinding(item.keybinding);
        // 当不存在 when 条件或不包含 `editorFocus` 时，追加 editorFocus 条件
        let when = item.when;
        if (!when) {
          when = editorFocus;
        } else {
          // when 中没有 `EditorContextKeys.focus` 时再做追加
          if (!when.keys().includes(editorFocus.key)) {
            // 当其内部为 or 时，避免出现 a && (b || c) 报错
            // 因此改成 (a && b) || (a && c) 这样不会报错
            // serialize 之后的结果类似 a && b || a && c
            // Monaco Editor ContextKey 的计算规则中 && 优先级高于 ||
            if (when.type === ContextKeyExprType.Or) {
              const exprs = when.expr;
              when = ContextKeyExpr.or(...exprs.map((expr) => ContextKeyExpr.and(expr, editorFocus)));
            } else {
              when = ContextKeyExpr.and(when, editorFocus);
            }
          }
        }
        const keybinding = {
          command,
          args: item.commandArgs,
          keybinding: rawKeybinding,
          when: (item.when && item.when.serialize()) ?? undefined,
          // monaco内优先级计算时为双优先级相加，第一优先级权重 * 100
          priority: (item.weight1 ? item.weight1 * 100 : 0) + (item.weight2 || 0),
        };
        // 注册快捷键前先卸载 Monaco 内对应命令的快捷键实现
        monacoKeybindingsRegistry.registerKeybindingRule({
          id: `-${command}`,
          weight: item.weight1,
          primary: this.toMonacoKeybindingNumber(KeySequence.parse(rawKeybinding)),
          when,
        });
        // 将 Monaco 内默认快捷键注册进 OpenSumi 中
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
