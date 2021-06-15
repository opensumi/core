import * as modes from '@ali/monaco-editor-core/esm/vs/editor/common/modes';
import { OpenerService } from '@ali/monaco-editor-core/esm/vs/editor/browser/services/openerService';
import { CompletionProviderRegistry } from '@ali/monaco-editor-core/esm/vs/editor/common/modes';
import { StaticServices } from '@ali/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import { CodeEditorServiceImpl } from '@ali/monaco-editor-core/esm/vs/editor/browser/services/codeEditorServiceImpl';
import * as monacoActions from '@ali/monaco-editor-core/esm/vs/platform/actions/common/actions';
import * as monacoKeybindings from '@ali/monaco-editor-core/esm/vs/platform/keybinding/common/keybindingsRegistry';
import { SimpleKeybinding } from '@ali/monaco-editor-core/esm/vs/base/common/keyCodes';
import { EditorContextKeys } from '@ali/monaco-editor-core/esm/vs/editor/common/editorContextKeys';
import { StandaloneCommandService } from '@ali/monaco-editor-core/esm/vs/editor/standalone/browser/simpleServices';
import { ContextKeyExpr, ContextKeyExprType, ContextKeyOrExpr } from '@ali/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';
import { Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import {
  PreferenceService, JsonSchemaContribution, ISchemaStore, PreferenceScope, ISchemaRegistry, Disposable,
  CommandRegistry, IMimeService, CorePreferences, ClientAppContribution, CommandContribution, ContributionProvider,
  Domain, MonacoService, MonacoContribution, ServiceNames, KeybindingContribution, KeybindingRegistry, Keystroke,
  KeyCode, Key, KeyModifier, isOSX, IContextKeyService, IOpenerService, MonacoOverrideServiceRegistry, FormattingSelectorType,
} from '@ali/ide-core-browser';
import { IMenuRegistry, NextMenuContribution as MenuContribution, MenuId, IMenuItem, ISubmenuItem } from '@ali/ide-core-browser/lib/menu/next';
import { IThemeService } from '@ali/ide-theme';
import { URI, ILogger } from '@ali/ide-core-common';

import { MonacoCommandService, MonacoCommandRegistry, MonacoActionRegistry } from './monaco.command.service';
import { MonacoMenus } from './monaco-menu';
import { TextmateService } from './textmate.service';
import { MonacoSnippetSuggestProvider } from './monaco-snippet-suggest-provider';
import { KeyCode as MonacoKeyCode } from '@ali/monaco-editor-core';
import { FormattingConflicts } from '@ali/monaco-editor-core/esm/vs/editor/contrib/format/format';

@Domain(ClientAppContribution, CommandContribution, MenuContribution, KeybindingContribution)
export class MonacoClientContribution implements ClientAppContribution, CommandContribution, MenuContribution, KeybindingContribution {
  @Autowired()
  monacoService: MonacoService;

  @Autowired(MonacoContribution)
  monacoContributionProvider: ContributionProvider<MonacoContribution>;

  @Autowired(JsonSchemaContribution)
  schemaContributionProvider: ContributionProvider<JsonSchemaContribution>;

  @Autowired()
  monacoCommandService: MonacoCommandService;

  @Autowired()
  monacoCommandRegistry: MonacoCommandRegistry;

  @Autowired()
  monacoActionRegistry: MonacoActionRegistry;

  @Autowired()
  private textmateService!: TextmateService;

  @Autowired(IThemeService)
  themeService: IThemeService;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @Autowired(ISchemaStore)
  schemaStore: ISchemaStore;

  @Autowired(ISchemaRegistry)
  jsonContributionRegistry: ISchemaRegistry;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(CorePreferences)
  corePreferences: CorePreferences;

  @Autowired(IMimeService)
  mimeService: IMimeService;

  @Autowired(MonacoSnippetSuggestProvider)
  protected readonly snippetSuggestProvider: MonacoSnippetSuggestProvider;

  @Autowired(IOpenerService)
  private readonly openerService: IOpenerService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(MonacoOverrideServiceRegistry)
  private readonly overrideServicesRegistry: MonacoOverrideServiceRegistry;

  private KEY_CODE_MAP = [];

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
        // tslint:disable-next-line:no-console
        console.warn(
          !!contribution.onMonacoLoaded,
          `MonacoContribution#onMonacoLoaded was deprecated.`,
        );
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
        // tslint:disable-next-line:no-console
        console.warn(
          !!contribution.onContextKeyServiceReady,
          `MonacoContribution#onContextKeyServiceReady was deprecated.`,
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

    // monaco 的 keycode 和 ide 之间的映射
    this.KEY_CODE_MAP = require('./monaco.keycode-map').KEY_CODE_MAP;

    // 修改一些 Monaco 内置 Services 的行为
    this.patchMonacoInternalServices();

    // 注册/拦截 Monaco 内置的菜单
    this.patchMonacoInternalMenus();

  }

  onDidStart() {
    // DefaultEndOfLine 类型冲突
    // @ts-ignore
    CompletionProviderRegistry.register(this.snippetSuggestProvider.registeredLanguageIds, this.snippetSuggestProvider);
  }

  private registerOverrideServices() {
    const codeEditorService = this.overrideServicesRegistry.getRegisteredService<CodeEditorServiceImpl>(ServiceNames.CODE_EDITOR_SERVICE);

    // Monaco CommandService
    const standaloneCommandService = new StandaloneCommandService(StaticServices.instantiationService.get());
    // 给 monacoCommandService 设置委托，执行 monaco 命令使用 standaloneCommandService 执行
    this.monacoCommandService.setDelegate(standaloneCommandService);
    // 替换 monaco 内部的 commandService
    this.overrideServicesRegistry.registerOverrideService(
      ServiceNames.COMMAND_SERVICE,
      this.monacoCommandService,
    );

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
      get: () => {
        return codeEditorService;
      },
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
       * kaitian 中是一个 字符串
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
       * kaitian 中是一个 字符串
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

  onStart() {
    this.mimeService.updateMime();
    this.textmateService.init();
    const currentTheme = this.themeService.getCurrentThemeSync();
    const themeData = currentTheme.themeData;
    this.textmateService.setTheme(themeData);
    this.textmateService.initialized = true;
  }

  private patchMonacoThemeService() {
    // 临时实现，覆盖 standaloneThemeService 中的 getTokenStyleMetadata，因为在 0.20.0 中一直永远 undefined
    const standaloneThemeService = StaticServices.standaloneThemeService.get();
    const originalGetTheme: typeof standaloneThemeService.getTheme = standaloneThemeService.getTheme.bind(standaloneThemeService);
    const patchedGetTokenStyleMetadatadFlag = '__patched_getTokenStyleMetadata';
    standaloneThemeService.getTheme = () => {
      const theme = originalGetTheme();
      if (!(patchedGetTokenStyleMetadatadFlag in theme)) {
        Object.defineProperty(theme, patchedGetTokenStyleMetadatadFlag, { enumerable: false, configurable: false, writable: false, value: true });
        theme.getTokenStyleMetadata = (type, modifiers) => {
          // use theme rules match
          const style = theme.tokenTheme._match([type].concat(modifiers).join('.'));
          const metadata = style.metadata;
          const foreground = modes.TokenMetadata.getForeground(metadata);
          const fontStyle = modes.TokenMetadata.getFontStyle(metadata);
          const res =  {
            foreground,
            italic: Boolean(fontStyle & 1),
            bold: Boolean(fontStyle & 2),
            underline: Boolean(fontStyle & 4),
          };
          return res;
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

    // 将 Monaco 的 Keybinding 同步到 ide 中
    for (const item of monacoKeybindingsRegistry.getDefaultKeybindings()) {
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
            if (when.getType() === ContextKeyExprType.Or) {
              const exprs = (when as ContextKeyOrExpr).expr;
              when = ContextKeyExpr.or(
                ...exprs.map((expr) => ContextKeyExpr.and(expr, editorFocus)),
              );
            } else {
              when = ContextKeyExpr.and(when, editorFocus);
            }
          }
        }
        // 转换 monaco 快捷键
        const keybindingStr = raw.parts.map((part) => this.keyCode(part)).join(' ');
        // monaco内优先级计算时为双优先级相加，第一优先级权重 * 100
        const keybinding = { command, args: item.commandArgs, keybinding: keybindingStr, when, priority: (item.weight1 ? item.weight1 * 100 : 0) + (item.weight2 || 0)};

        keybindings.registerKeybinding(keybinding);
      }
    }
  }

  protected keyCode(keybinding: SimpleKeybinding): KeyCode {
    const keyCode = keybinding.keyCode;
    const sequence: Keystroke = {
      first: Key.getKey(this.monaco2BrowserKeyCode(keyCode & 0xff)),
      modifiers: [],
    };
    if (keybinding.ctrlKey) {
      if (isOSX) {
        sequence.modifiers!.push(KeyModifier.MacCtrl);
      } else {
        sequence.modifiers!.push(KeyModifier.CtrlCmd);
      }
    }
    if (keybinding.shiftKey) {
      sequence.modifiers!.push(KeyModifier.Shift);
    }
    if (keybinding.altKey) {
      sequence.modifiers!.push(KeyModifier.Alt);
    }
    if (keybinding.metaKey && sequence.modifiers!.indexOf(KeyModifier.CtrlCmd) === -1) {
      sequence.modifiers!.push(KeyModifier.CtrlCmd);
    }
    return KeyCode.createKeyCode(sequence);
  }

  protected monaco2BrowserKeyCode(keyCode: MonacoKeyCode): number {
    for (let i = 0; i < this.KEY_CODE_MAP.length; i++) {
      if (this.KEY_CODE_MAP[i] === keyCode) {
        return i;
      }
    }
    return -1;
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
        label: item.command.title as string,
      },
      group: item.group,
      when: item.when,
      order: item.order,
    };
  }

  return {
    submenu: item.submenu as unknown as string,
    label: item.title as string,
    when: item.when,
    group: item.group,
    order: item.order,
  };
}
