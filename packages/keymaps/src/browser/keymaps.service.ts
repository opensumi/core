import { Injectable, Autowired } from '@ali/common-di';
import { observable, action } from 'mobx';
import { KeybindingRegistry, ResourceProvider, URI, Resource, Emitter, Keybinding, KeybindingScope, CommandService, EDITOR_COMMANDS, CommandRegistry, localize, KeySequence, KeyCode, KeysOrKeyCodes, IDisposable, DisposableCollection } from '@ali/ide-core-browser';
import { KeymapsParser } from './keymaps-parser';
import { UserStorageUri } from '@ali/ide-userstorage/lib/browser';
import * as jsoncparser from 'jsonc-parser';
import * as fuzzy from 'fuzzy';
import { KEYMAPS_FILE_NAME, IKeymapService, KeybindingJson, KEYMAPS_SCHEME, KeybindingItem } from '../common';

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

  protected resource: Resource;

  protected readonly keymapChangeEmitter = new Emitter<void>();
  onDidKeymapChanges = this.keymapChangeEmitter.event;

  private searchTimer: any = null;

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

  @observable.shallow
  keybindings: KeybindingItem[] = [];

  constructor() {
    this.init();
  }

  async init() {
    this.resource = await this.resourceProvider(new URI().withScheme(UserStorageUri.SCHEME).withPath(KEYMAPS_FILE_NAME));
    await this.reconcile();
    if (this.resource.onDidChangeContents) {
      this.resource.onDidChangeContents(async () => {
        await this.reconcile();
      });
    }
    this.keyBindingRegistry.onKeybindingsChanged(() => this.keymapChangeEmitter.fire(undefined));
    this.keybindings = this.getKeybindingItems();
    this.onDidKeymapChanges(() => {
      this.keybindings = this.getKeybindingItems();
    });
  }

  dispose() {
    this.toDisposeOnDetach.dispose();
  }

  // 重新加载并设置Keymap定义的快捷键
  async reconcile() {
    const keybindings = await this.parseKeybindings();
    this.keyBindingRegistry.setKeymap(KeybindingScope.USER, keybindings);
    this.keymapChangeEmitter.fire(undefined);
  }

  /**
   * 解析快捷键数据
   * @protected
   * @returns {Promise<Keybinding[]>}
   * @memberof KeymapsService
   */
  protected async parseKeybindings(): Promise<Keybinding[]> {
    try {
      const content = await this.resource.readContents();
      return this.parser.parse(content);
    } catch (error) {
      return error;
    }
  }

  /**
   * 设置快捷键
   * @param {KeybindingJson} keybindingJson
   * @returns {Promise<void>}
   * @memberof KeymapsService
   */
  setKeybinding = async (keybindingJson: KeybindingJson): Promise<void> => {
    if (!this.resource.saveContents) {
      return;
    }
    const content = await this.resource.readContents();
    const keybindings: KeybindingJson[] = content ? jsoncparser.parse(content) : [];
    let updated = false;
    for (const keybinding of keybindings) {
      if (keybinding.command === keybindingJson.command) {
        updated = true;
        keybinding.keybinding = keybindingJson.keybinding;
      }
    }
    if (!updated) {
      const item: KeybindingJson = { ...keybindingJson };
      keybindings.push(item);
    }
    await this.resource.saveContents(JSON.stringify(keybindings, undefined, 4));
  }

  /**
   * 移除给定ID的快捷键绑定
   * @param {string} commandId
   * @returns {Promise<void>}
   * @memberof KeymapsService
   */
  removeKeybinding = async (commandId: string): Promise<void> => {
    if (!this.resource.saveContents) {
      return;
    }
    const content = await this.resource.readContents();
    const keybindings: KeybindingJson[] = content ? jsoncparser.parse(content) : [];
    const filtered = keybindings.filter((a) => a.command !== commandId);
    await this.resource.saveContents(JSON.stringify(filtered, undefined, 4));
  }

  /**
   * 从keymaps.json获取快捷键列表
   * @returns {Promise<KeybindingJson[]>}
   * @memberof KeymapsService
   */
  async getKeybindings(): Promise<KeybindingJson[]> {
    if (!this.resource.saveContents) {
      return [];
    }
    const content = await this.resource.readContents();
    return content ? jsoncparser.parse(content) : [];
  }

  /**
   * 打开快捷键面板
   * @protected
   * @returns {Promise<void>}
   * @memberof KeymapService
   */
  async open(): Promise<void> {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI().withScheme(KEYMAPS_SCHEME));
  }

  /**
   * 获取可读的条件语句
   * @param {Keybinding} keybinding
   * @returns
   * @memberof KeymapService
   */
  getContextOrWhen(keybinding: KeybindingItem) {
    return keybinding.context ? keybinding.context : keybinding.when ? typeof keybinding.when === 'string' ? keybinding.when : keybinding.when.keys().join(' && ') : '';
  }

  getWhen(keybinding?: Keybinding) {
    if (!keybinding) {
      return '';
    }
    return keybinding.when ? typeof keybinding.when === 'string' ? keybinding.when : keybinding.when.keys().join(' && ') : '';
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
      const item: KeybindingItem = {
        id: command.id,
        command: command.label || command.id,
        keybinding: (keybindings && keybindings[0]) ? keybindings[0].keybinding.toLocaleUpperCase() : '',
        when: this.getWhen((keybindings && keybindings[0])),
        context: (keybindings && keybindings[0]) ? (keybindings && keybindings[0]).context : '',
        source: (keybindings && keybindings[0] && typeof keybindings[0].scope !== 'undefined')
          ? this.getScope(keybindings[0].scope!) : '',
      };
      items.push(item);
    }

    // 获取排序后的列表
    const sorted: KeybindingItem[] = items.sort((a: KeybindingItem, b: KeybindingItem) => this.compareItem(a.command, b.command));
    // 获取定义了快捷键的列表
    const keyItems: KeybindingItem[] = sorted.filter((a: KeybindingItem) => !!a.keybinding);
    // 获取剩余的未定义快捷键列表.
    const otherItems: KeybindingItem[] = sorted.filter((a: KeybindingItem) => !a.keybinding);

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
  searchKeybindings = (event) => {
    const searchValue = event.target && event.target.value ? event.target.value.toLocaleLowerCase() : '';
    // debounce
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.doSearchKeybindings(searchValue);
    }, 100);
  }

  /**
   * 模糊搜索匹配的快捷键
   * @protected
   */
  protected readonly doSearchKeybindings = (search) => {
    const items = this.getKeybindingItems();
    const result: KeybindingItem[] = [];
    items.forEach((item) => {
      const keys: (keyof KeybindingItem)[] = ['command', 'keybinding', 'when', 'context', 'source'];
      let matched = false;
      for (const key of keys) {
        const str = item[key];
        if (str) {
          const fuzzyMatch = fuzzy.match(search, str, this.fuzzyOptions);
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
      KeySequence.parse(keybinding);
      if (keybindingItem.keybinding === keybinding) {
        return ' ';
      }
      if (this.keybindingRegistry.containsKeybindingInScope(binding)) {
        return localize('keymaps.keybinding.collide');
      }
      return '';
    } catch (error) {
      return error;
    }
  }

  /**
   * 获取被fuzzy替换的原始值
   * @param {string} keybinding
   */
  getRaw(keybinding: string) {
    return keybinding.replace(new RegExp(/<match>(.*?)<\/match>/g), '$1');
  }
}
