import { Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import {
  PreferenceService, JsonSchemaContribution, ISchemaStore, PreferenceScope, ISchemaRegistry, Disposable,
  CommandRegistry, IMimeService, CorePreferences, ClientAppContribution, CommandContribution, ContributionProvider,
  Domain, MonacoService, MonacoContribution, ServiceNames, KeybindingContribution, KeybindingRegistry, Keystroke,
  KeyCode, Key, KeySequence, KeyModifier, isOSX, IContextKeyService,
} from '@ali/ide-core-browser';
import { IMenuRegistry, NextMenuContribution as MenuContribution, MenuId, IMenuItem } from '@ali/ide-core-browser/lib/menu/next';
import { IThemeService } from '@ali/ide-theme';
import { getDebugLogger } from '@ali/ide-core-common';

import { ContextKeyExpr } from '@reexport/vsc-modules/lib/contextkey/common/contextkey';

import { MonacoCommandService, MonacoCommandRegistry, MonacoActionRegistry } from './monaco.command.service';
import { MonacoMenus } from './monaco-menu';
import { TextmateService } from './textmate.service';
import { MonacoSnippetSuggestProvider } from './monaco-snippet-suggest-provider';

@Domain(ClientAppContribution, MonacoContribution, CommandContribution, MenuContribution, KeybindingContribution)
export class MonacoClientContribution implements ClientAppContribution, MonacoContribution, CommandContribution, MenuContribution, KeybindingContribution {
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

  private KEY_CODE_MAP = [];

  async initialize() {
    // 从 cdn 加载 monaco 和依赖的 vscode 代码
    await this.monacoService.loadMonaco();
    // 执行所有 contribution 的 onMonacoLoaded 事件，用来添加 overrideService
    for (const contribution of this.monacoContributionProvider.getContributions()) {
      if (contribution.onMonacoLoaded) {
        contribution.onMonacoLoaded(this.monacoService);
      }
    }
    for (const contribution of this.schemaContributionProvider.getContributions()) {
      contribution.registerSchema(this.jsonContributionRegistry);
    }
    this.setSchemaPreferenceListener(this.schemaStore);
    // monaco 的 keycode 和 ide 之间的映射
    // 依赖 Monaco 加载完毕
    this.KEY_CODE_MAP = require('./monaco.keycode-map').KEY_CODE_MAP;
  }

  onDidStart() {
    // @ts-ignore
    monaco.modes.CompletionProviderRegistry.register(this.snippetSuggestProvider.registedLanguageIds, this.snippetSuggestProvider);
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

  onMonacoLoaded(monacoService: MonacoService) {
    const { MonacoCodeService } = require('@ali/ide-editor/lib/browser/editor.override');
    const { MonacoOpenerService } = require('./monaco-opener.service');
    const codeEditorService = this.injector.get(MonacoCodeService);
    // 该类从 vs/editor/standalone/browser/simpleServices 中获取
    const standaloneCommandService = new monaco.services.StandaloneCommandService(monaco.services.StaticServices.instantiationService.get());
    // 给 monacoCommandService 设置委托，执行 monaco 命令使用 standaloneCommandService 执行
    this.monacoCommandService.setDelegate(standaloneCommandService);
    // 替换 monaco 内部的 commandService
    monacoService.registerOverride(ServiceNames.COMMAND_SERVICE, this.monacoCommandService);

    const openService = this.injector.get(MonacoOpenerService);
    const monacoOpenerService = new monaco.services.OpenerService(codeEditorService, this.monacoCommandService);
    openService.setDelegate(monacoOpenerService);
    monacoService.registerOverride(ServiceNames.OPENER_SERVICE, openService);
    // workbench-editor.service.ts 内部做了 registerOverride
    // monacoService.registerOverride(ServiceNames.CONTEXT_KEY_SERVICE, (this.contextKeyService as any).contextKeyService);

    for (const contribution of this.monacoContributionProvider.getContributions()) {
      if (contribution.onContextKeyServiceReady) {
        contribution.onContextKeyServiceReady(this.injector.get(IContextKeyService));
      }
    }

    const menuRegistry = this.injector.get(IMenuRegistry) as IMenuRegistry;
    const monacoMenuRegistry = monaco.actions.MenuRegistry;
    monacoMenuRegistry.getMenuItems(7 /* EditorContext */).forEach((item) => {
      menuRegistry.registerMenuItem(MenuId.EditorContext, transformMonacoMenuItem(item));
    });
    const originalAppendItem = monacoMenuRegistry.appendMenuItem;
    monacoMenuRegistry.appendMenuItem = (id, item) => {
      const disposer = new Disposable();
      disposer.addDispose(originalAppendItem.apply(monacoMenuRegistry, [id, item]));
      disposer.addDispose(menuRegistry.registerMenuItem(MenuId.EditorContext, transformMonacoMenuItem(item)));
      return disposer;
    };
    this.corePreferences.onPreferenceChanged((e) => {
      if (e.preferenceName === 'files.associations') {
        // 暂时无效，0.17 版本没有暴露出 mime clearTextMimes 方法
        this.mimeService.updateMime();
      }
    });

    getDebugLogger().info('monaco loaded');
  }

  registerCommands(commands: CommandRegistry) {
    // 注册 monaco 所有的 action
    this.monacoActionRegistry.registerMonacoActions();
  }

  registerNextMenus(menuRegistry: IMenuRegistry) {
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
    const monacoKeybindingsRegistry = monaco.keybindings.KeybindingsRegistry;

    // 将 Monaco 的 Keybinding 同步到 ide 中
    for (const item of monacoKeybindingsRegistry.getDefaultKeybindings()) {
      const command = this.monacoCommandRegistry.validate(item.command);
      if (command) {
        const raw = item.keybinding;

        // monaco keybindingRegistry中取出的keybinding缺少了editorFocus的when,
        // 当向开天的keybinding注册时需要加上editorFocus，避免焦点不在编辑器时响应到
        let when: any = item.when;
        const editorFocus = monaco.contextkey.EditorContextKeys.focus;
        if (!when) {
          when = editorFocus as any;
        } else {
          when = ContextKeyExpr.and(editorFocus, when as any)!;
        }
        // 转换 monaco 快捷键
        const keybindingStr = raw.parts.map((part) => this.keyCode(part)).join(' ');
        // monaco内优先级计算时为双优先级相加，第一优先级权重 * 100
        const keybinding = { command, keybinding: keybindingStr, when, priority: (item.weight1 ? item.weight1 * 100 : 0) + (item.weight2 || 0)};

        // 注册 keybinding
        keybindings.registerKeybinding(keybinding);
      }
    }
  }

  protected keyCode(keybinding: monaco.keybindings.SimpleKeybinding): KeyCode {
    const keyCode = keybinding.keyCode;
    const sequence: Keystroke = {
      /* tslint:disable-next-line: no-bitwise*/
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

  protected keySequence(keybinding: monaco.keybindings.ChordKeybinding): KeySequence {
    return [
      this.keyCode(keybinding.firstPart),
      this.keyCode(keybinding.chordPart),
    ];
  }

  protected monaco2BrowserKeyCode(keyCode: monaco.KeyCode): number {
    for (let i = 0; i < this.KEY_CODE_MAP.length; i++) {

      if (this.KEY_CODE_MAP[i] === keyCode) {
        return i;
      }
    }
    return -1;
  }

}

function transformMonacoMenuItem(item: monaco.actions.IMenuItem): IMenuItem {
  return {
    command: {
      id: item.command.id,
      label: item.command.title,
    },
    group: item.group,
    when: item.when,
    order: item.order,
  };
}
