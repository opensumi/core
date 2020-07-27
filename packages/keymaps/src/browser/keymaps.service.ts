import { Injectable, Autowired } from '@ali/common-di';
import { observable, action } from 'mobx';
import { KeybindingRegistry, ResourceProvider, URI, Resource, Emitter, Keybinding, KeybindingScope, CommandService, EDITOR_COMMANDS, CommandRegistry, localize, KeySequence, DisposableCollection, KeybindingService, ILogger, Event } from '@ali/ide-core-browser';
import { KeymapsParser } from './keymaps-parser';
import * as fuzzy from 'fuzzy';
import { KEYMAPS_FILE_NAME, IKeymapService, KEYMAPS_SCHEME, KeybindingItem } from '../common';
import { USER_STORAGE_SCHEME } from '@ali/ide-preferences';

// monaco.contextkey.ContextKeyExprType 引入
export const enum ContextKeyExprType {
  Defined = 1,
  Not = 2,
  Equals = 3,
  NotEquals = 4,
  And = 5,
  Regex = 6,
  NotRegex = 7,
  Or = 8,
}

@Injectable()
export class KeymapService implements IKeymapService {

  @Autowired(KeybindingRegistry)
  protected readonly keyBindingRegistry: KeybindingRegistry;

  @Autowired(ResourceProvider)
  protected readonly resourceProvider: ResourceProvider;

  @Autowired(KeymapsParser)
  protected readonly parser: KeymapsParser;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @Autowired(CommandRegistry)
  protected readonly commandRegistry: CommandRegistry;

  @Autowired(KeybindingRegistry)
  protected readonly keybindingRegistry: KeybindingRegistry;

  @Autowired(KeybindingService)
  protected readonly keybindingService: KeybindingService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  private currentSearchValue: string;

  protected resource: Resource;

  protected readonly keymapChangeEmitter = new Emitter<void>();

  get onDidKeymapChanges(): Event<void> {
    return this.keymapChangeEmitter.event;
  }

  private searchTimer: any = null;

  protected convertKeySequence: KeySequence = [];

  protected readonly toDisposeOnDetach = new DisposableCollection();

  /**
   * fuzzy搜索参数，pre及post用于包裹搜索结果
   * @protected
   * @memberof KeymapService
   */
  protected readonly fuzzyOptions = {
    pre: '<match>',
    post: '</match>',
  };
  private _storeKeybindings: Keybinding[];

  get storeKeybindings() {
    return this._storeKeybindings;
  }

  set storeKeybindings(value: Keybinding[]) {
    this._storeKeybindings = value;
  }

  @observable.shallow
  keybindings: KeybindingItem[] = [];

  async init() {
    this.resource = await this.resourceProvider(new URI().withScheme(USER_STORAGE_SCHEME).withPath(KEYMAPS_FILE_NAME));
    await this.reconcile();
  }

  dispose() {
    this.toDisposeOnDetach.dispose();
  }

  /**
   * 重新加载并设置Keymap定义的快捷键
   * @param keybindings
   */
  async reconcile(keybindings?: Keybinding[]) {
    const keymap = keybindings ? keybindings.slice(0) : await this.parseKeybindings();
    // 重新注册快捷键前取消注册先前的快捷键
    // TODO: 差量注册，差量移除
    this.dispose();
    this.toDisposeOnDetach.push(this.keyBindingRegistry.setKeymap(KeybindingScope.USER, keymap.map((kb) => {
      // 清洗存入keymap数据
      return {
        when: kb.when,
        command: kb.command,
        keybinding: kb.keybinding,
      };
    })));

    this.updateKeybindings();
  }

  /**
   * 更新keybindings列表
   */
  @action
  private updateKeybindings() {
    if (this.currentSearchValue) {
      this.doSearchKeybindings(this.currentSearchValue);
    } else {
      this.keybindings = this.getKeybindingItems();
    }
  }

  /**
   * 解析快捷键数据
   * @protected
   * @returns {Promise<Keybinding[]>}
   * @memberof KeymapsService
   */
  protected async parseKeybindings(): Promise<Keybinding[]> {
    try {
      if (!this.storeKeybindings) {
        const content = await this.resource.readContents();
        this.storeKeybindings = this.parser.parse(content);
      }
      return this.storeKeybindings;
    } catch (error) {
      return error;
    }
  }

  /**
   * 设置快捷键
   * @param {Keybinding} keybindings
   * @returns {Promise<void>}
   * @memberof KeymapsService
   */
  @action
  setKeybinding = (keybinding: Keybinding) => {
    const keybindings: Keybinding[] = this.storeKeybindings;
    let updated = false;
    for (const kb of keybindings) {
      if (kb.command === keybinding.command) {
        updated = true;
        kb.keybinding = keybinding.keybinding;
      }
    }
    if (!updated) {
      // 不能额外传入keybinding的resolved值
      const item: Keybinding = {
        when: keybinding.when,
        command: keybinding.command,
        keybinding: keybinding.keybinding,
      };
      keybindings.push(item);
    }
    // 后置存储流程
    this.saveKeybinding(keybindings);
  }

  private async saveKeybinding(keybindings: Keybinding[]) {
    if (!this.resource.saveContents) {
      return;
    }
    this.storeKeybindings = keybindings;
    // 存储前配置化当前快捷键
    this.reconcile(keybindings);
    // 存储前清理多余属性
    await this.resource.saveContents(JSON.stringify(keybindings.map((kb) => {
      return {
        when: kb.when,
        command: kb.command,
        keybinding: kb.keybinding,
      };
    }), undefined, 2));
  }

  covert = (event: KeyboardEvent) => {
    return this.keybindingService.convert(event, ' ');
  }

  clearCovert = () => {
    return this.keybindingService.clearConvert();
  }

  /**
   * 移除给定ID的快捷键绑定
   * @param {string} commandId
   * @returns {Promise<void>}
   * @memberof KeymapsService
   */
  removeKeybinding = async (item: KeybindingItem): Promise<void> => {
    if (!this.resource.saveContents) {
      return;
    }
    const keybindings: Keybinding[] = this.storeKeybindings;
    const filtered = keybindings.filter((a) => a.command !== item.id);
    this.saveKeybinding(filtered);
  }

  /**
   * 从keymaps.json获取快捷键列表
   * @returns {Promise<Keybinding[]>}
   * @memberof KeymapsService
   */
  async getKeybindings(): Promise<Keybinding[]> {
    return this.storeKeybindings;
  }

  /**
   * 打开快捷键面板
   * @protected
   * @returns {Promise<void>}
   * @memberof KeymapService
   */
  async open(): Promise<void> {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI().withScheme(KEYMAPS_SCHEME), { preview: true });
  }

  fixed = async () => {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI().withScheme(KEYMAPS_SCHEME), { preview: false });
  }

  getWhen(keybinding?: Keybinding) {
    if (!keybinding) {
      return '';
    }
    return keybinding.when ? typeof keybinding.when === 'string' ? keybinding.when : this.serialize(keybinding.when) : '';
  }

  serialize(when: any) {
    let result: string[] = [];
    if (when.expr) {
      when = when as monaco.contextkey.ContextKeyAndExpr | monaco.contextkey.ContextKeyOrExpr;
    } else {
      when = when as monaco.contextkey.ContextKeyDefinedExpr
        | monaco.contextkey.ContextKeyEqualsExpr
        | monaco.contextkey.ContextKeyNotEqualsExpr
        | monaco.contextkey.ContextKeyNotExpr
        | monaco.contextkey.ContextKeyNotRegexExpr
        | monaco.contextkey.ContextKeyOrExpr
        | monaco.contextkey.ContextKeyRegexExpr;
    }
    if (!when.expr) {
      switch (when.getType()) {
        case ContextKeyExprType.Defined:
          return when.key;
        case ContextKeyExprType.Equals:
          return when.key + ' == \'' + when.getValue() + '\'';
        case ContextKeyExprType.NotEquals:
          return when.key + ' != \'' + when.getValue() + '\'';
        case ContextKeyExprType.Not:
          return '!' + when.key;
        case ContextKeyExprType.Regex:
          const value = when.regexp
            ? `/${when.regexp.source}/${when.regexp.ignoreCase ? 'i' : ''}`
            : '/invalid/';
          return `${when.key} =~ ${value}`;
        case ContextKeyExprType.NotRegex:
          return '-not regex-';
        case ContextKeyExprType.And:
          return when.expr.map((e) => e.serialize()).join(' && ');
        case ContextKeyExprType.Or:
          return when.expr.map((e) => e.serialize()).join(' || ');
        default:
          return when.key;
      }
    }
    result = when.expr.map((contextKey: any) => {
      return this.serialize(contextKey);
    });
    return result.join(' && ');
  }

  /**
   * 获取可读的作用域
   * @param {KeybindingScope} scope
   * @returns
   * @memberof KeymapService
   */
  getScope(scope: KeybindingScope) {
    if (scope === KeybindingScope.DEFAULT) {
      return localize('keymaps.source.default');
    } else if (scope === KeybindingScope.USER) {
      return localize('keymaps.source.user');
    } else if (scope === KeybindingScope.WORKSPACE) {
      return localize('keymaps.source.workspace');
    } else {
      return '';
    }
  }

  /**
   * 获取所有快捷键项
   * @returns {KeybindingItem[]}
   * @memberof KeymapService
   */
  getKeybindingItems(): KeybindingItem[] {
    const commands = this.commandRegistry.getCommands();
    const items: KeybindingItem[] = [];
    for (const command of commands) {
      const keybindings = this.keybindingRegistry.getKeybindingsForCommand(command.id);
      let item: KeybindingItem;

      if (this.storeKeybindings) {
        const isUserKeybinding = this.storeKeybindings.find((kb) => command && kb.command === command.id);
        item = {
          id: command.id,
          command: command.label || command.id,
          keybinding: isUserKeybinding ? isUserKeybinding.keybinding : (keybindings && keybindings[0]) ? this.keybindingRegistry.acceleratorFor(keybindings[0], '+').join(' ') : '',
          when: isUserKeybinding ? this.getWhen(isUserKeybinding) : this.getWhen((keybindings && keybindings[0])),
          source: isUserKeybinding ? this.getScope(KeybindingScope.USER) : this.getScope(KeybindingScope.DEFAULT),
          hasCommandLabel: !!command.label,
        };
      } else {
        item = {
          id: command.id,
          command: command.label || command.id,
          keybinding: (keybindings && keybindings[0]) ? this.keybindingRegistry.acceleratorFor(keybindings[0], '+').join(' ') : '',
          when: this.getWhen((keybindings && keybindings[0])),
          source: (keybindings && keybindings[0] && typeof keybindings[0].scope !== 'undefined')
            ? this.getScope(keybindings[0].scope!) : '',
          hasCommandLabel: !!command.label,
        };
      }
      items.push(item);
    }

    // 获取排序后的列表
    const sorted: KeybindingItem[] = items.sort((a: KeybindingItem, b: KeybindingItem) => this.compareItem(a.command, b.command));
    // 获取定义了快捷键的列表
    const keyItems: KeybindingItem[] = sorted.filter((a: KeybindingItem) => !!a.keybinding);

    const otherItems: KeybindingItem[] = sorted.filter((a: KeybindingItem) => !a.keybinding && a.hasCommandLabel);

    return [...keyItems, ...otherItems];
  }

  // 字典排序
  protected compareItem(a: string | undefined, b: string | undefined): number {
    if (a && b) {
      return (a.toLowerCase()).localeCompare(b.toLowerCase());
    }
    return 0;
  }

  /**
   * 搜索快捷键
   */
  @action
  searchKeybindings = (search: string) => {
    this.currentSearchValue = search;
    // throttle
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.doSearchKeybindings(this.currentSearchValue);
    }, 100);
  }

  /**
   * 模糊搜索匹配的快捷键
   * @protected
   */
  @action
  protected readonly doSearchKeybindings = (search) => {
    const items = this.getKeybindingItems();
    const result: KeybindingItem[] = [];
    items.forEach((item) => {
      const keys: string[] = ['command', 'keybinding', 'when', 'context', 'source'];
      let matched = false;
      for (const key of keys) {
        const str = item[key];
        if (str) {
          const fuzzyMatch = fuzzy.match(search, str as string, this.fuzzyOptions);
          if (fuzzyMatch) {
            item[key] = fuzzyMatch.rendered;
            matched = true;
          } else {
            // 匹配到的快捷键会有不同的显示优先级
            // 排序
            if (key === 'keybinding') {
              const queryItems = search.split('+');
              // 处理组合键
              const tempItems = str.split(' ');
              // 存储空格字符串
              const spaceIndexArr = [0];
              let bindingItems: string[] = [];
              if (tempItems.length > 1) {
                tempItems.forEach((tItem) => {
                  const tKeys = tItem.split('+');
                  spaceIndexArr.push(tKeys.length + spaceIndexArr[-1]);
                  bindingItems.push(...tKeys);
                });
              } else {
                bindingItems = str.split('+');
              }
              spaceIndexArr.shift();

              const renderedResult = [...bindingItems];
              let matchCounter = 0;

              queryItems.forEach((queryItem) => {
                let keyFuzzyMatch: fuzzy.MatchResult = { rendered: '', score: 0 };
                let keyIndex = -1;
                if (str) {
                  bindingItems.forEach((bindingItem: string) => {
                    // 通过用户输入匹配所有快捷键字段
                    const tempFuzzyMatch = fuzzy.match(queryItem, bindingItem, this.fuzzyOptions);
                    // 选择匹配度的匹配项
                    if (tempFuzzyMatch && tempFuzzyMatch.score > keyFuzzyMatch.score) {
                      keyFuzzyMatch = tempFuzzyMatch;
                      // 获取在快捷键数组中对应的位置
                      keyIndex = renderedResult.indexOf(bindingItem);
                    }
                  });

                  const keyRendered = keyFuzzyMatch.rendered;
                  if (keyRendered) {
                    if (keyIndex > -1) {
                      renderedResult[keyIndex] = keyRendered;
                    }
                    // 在快捷键数组中移除匹配过的快捷键
                    bindingItems.splice(keyIndex, 1, '');
                    matchCounter += 1;
                  }
                }
              });
              if (matchCounter === queryItems.length) {
                // 处理组合键的渲染
                if (spaceIndexArr.length > 0) {
                  const chordRenderedResult = '';
                  renderedResult.forEach((resultKey, index) => {
                    if (index === 0) {
                      chordRenderedResult.concat(resultKey);
                    } else if (spaceIndexArr.indexOf(index) !== -1) {
                      chordRenderedResult.concat(' ' + resultKey);
                    } else {
                      chordRenderedResult.concat('+' + resultKey);
                    }
                  });
                  item[key] = chordRenderedResult;
                }

                item[key] = renderedResult.join('+');
                matched = true;
              }
            }
          }
        }
      }

      if (matched) {
        result.push(item);
      }
    });
    this.keybindings = result;
  }

  /**
   * 验证快捷键是否可用
   * @memberof KeymapService
   */
  validateKeybinding = (keybindingItem: KeybindingItem, keybinding: string): string => {
    if (!keybinding) {
      return localize('keymaps.keybinding.require');
    }
    try {
      const binding = {
        command: keybindingItem.command,
        when: keybindingItem.when,
        context: keybindingItem.context,
        keybinding,
      };
      if (keybindingItem.keybinding === keybinding) {
        return ' ';
      }
      return this.keybindingRegistry.validateKeybindingInScope(binding);
    } catch (error) {
      return error;
    }
  }

  detectKeybindings = (keybindingItem: KeybindingItem, keybinding: string): KeybindingItem[] => {
    if (!keybinding) {
      return [];
    }
    try {
      if (keybindingItem.keybinding === keybinding) {
        return [];
      }
      // 可能匹配了高亮结果，需要还原部分数据
      const keybindings = this.keybindings.filter((kb) => this.getRaw(kb.keybinding) === keybinding );
      // 只返回全匹配快捷键，不返回包含关系快捷键（包含关系会在保存前提示冲突）
      if (keybindings.length > 0) {
        return keybindings.map((binding) => {

          const command = this.commandRegistry.getCommand(this.getRaw(binding.command));
          const isUserKeybinding = this.storeKeybindings.find((kb) => command && kb.command === command.id);
          binding.when = this.getRaw(binding.when);
          binding.keybinding = this.getRaw(binding.keybinding);
          return {
            id: command ? command.id : this.getRaw(binding.command),
            command: (command ? command.label || command.id : binding.command) || '',
            when: typeof binding.when === 'string' ? binding.when : this.serialize(binding.when),
            keybinding: this.getRaw(binding.keybinding),
            source: isUserKeybinding ? this.getScope(KeybindingScope.USER) : this.getScope(KeybindingScope.DEFAULT),
          };
        });
      }
    } catch (error) {
      this.logger.error(error);
    }
    return [];
  }

  /**
   * 获取被fuzzy替换的原始值
   * @param {string} keybinding
   */
  getRaw(keybinding?: string) {
    if (!keybinding) {
      return '';
    }
    return keybinding.replace(new RegExp(/<(\/)?match>/ig), '');
  }
}
