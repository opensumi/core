import * as fuzzy from 'fuzzy';
import { observable, action } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import {
  Disposable,
  IDisposable,
  ScopedKeybinding,
  KeybindingRegistry,
  URI,
  Emitter,
  Keybinding,
  KeybindingScope,
  CommandService,
  EDITOR_COMMANDS,
  CommandRegistry,
  localize,
  KeySequence,
  KeybindingService,
  ILogger,
  Event,
  KeybindingWeight,
  ThrottledDelayer,
  FileStat,
  DisposableCollection,
  ProgressLocation,
  IProgress,
  IProgressStep,
  Deferred,
} from '@opensumi/ide-core-browser';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { USER_STORAGE_SCHEME } from '@opensumi/ide-preferences';

import { KEYMAPS_FILE_NAME, IKeymapService, KEYMAPS_SCHEME, KeybindingItem, KeymapItem } from '../common';

import { KeymapsParser } from './keymaps-parser';


@Injectable()
export class KeymapService implements IKeymapService {
  static DEFAULT_SEARCH_DELAY = 500;
  static KEYMAP_FILE_URI: URI = new URI().withScheme(USER_STORAGE_SCHEME).withPath(KEYMAPS_FILE_NAME);

  @Autowired(KeybindingRegistry)
  protected readonly keyBindingRegistry: KeybindingRegistry;

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

  @Autowired(IFileServiceClient)
  protected readonly filesystem: IFileServiceClient;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(IProgressService)
  private readonly progressService: IProgressService;

  private currentSearchValue: string;

  protected resource: FileStat | undefined;

  protected readonly keymapChangeEmitter = new Emitter<void>();

  get onDidKeymapChanges(): Event<void> {
    return this.keymapChangeEmitter.event;
  }

  protected convertKeySequence: KeySequence = [];

  protected readonly toUnregisterUserKeybindingMap: Map<string, IDisposable> = new Map();
  protected readonly toRestoreDefaultKeybindingMap: Map<string, IDisposable> = new Map();

  private searchDelayer = new ThrottledDelayer(KeymapService.DEFAULT_SEARCH_DELAY);
  private disposableCollection: DisposableCollection = new DisposableCollection();

  private _whenReadyDeferred: Deferred<void> = new Deferred();

  /**
   * fuzzy搜索参数，pre及post用于包裹搜索结果
   * @protected
   * @memberof KeymapService
   */
  protected readonly fuzzyOptions = {
    pre: '<match>',
    post: '</match>',
  };
  private _storeKeybindings: KeymapItem[];

  get storeKeybindings() {
    return (
      this._storeKeybindings &&
      this._storeKeybindings.map((keybinding) => ({
        ...keybinding,
        command: this.getValidateCommand(keybinding.command),
        // 保持对旧版 keybinding 格式兼容
        key: keybinding.key || keybinding.keybinding!,
      }))
    );
  }

  set storeKeybindings(value: KeymapItem[]) {
    this._storeKeybindings = value;
  }

  @observable.shallow
  keybindings: KeybindingItem[] = [];

  get whenReady() {
    return this._whenReadyDeferred.promise;
  }

  async init() {
    const keymapUrl = KeymapService.KEYMAP_FILE_URI.toString();
    this.resource = await this.filesystem.getFileStat(keymapUrl);
    // 如果不存在，则默认创建一个空文件
    // 集成测有可能后置才会同步这个配置，如果不创建好不方便 watch
    if (!this.resource) {
      this.resource = await this.filesystem.createFile(keymapUrl, {
        content: JSON.stringify([]),
      });
    }
    await this.reconcile();
    const watcher = await this.filesystem.watchFileChanges(KeymapService.KEYMAP_FILE_URI);
    this.disposableCollection.push(watcher);
    watcher.onFilesChanged(() => {
      // 快捷键绑定文件内容变化，重新更新快捷键信息
      this.reconcile();
    });
    this._whenReadyDeferred.resolve();
  }

  async openResource() {
    if (!this.resource || !this.resource!.uri) {
      return;
    }
    const fsPath = await this.resource.uri;
    if (!fsPath) {
      return;
    }
    const exist = await this.filesystem.access(fsPath);
    if (!exist) {
      const fileStat = await this.filesystem.createFile(fsPath);
      const stat = await this.filesystem.setContent(fileStat, '{\n}');
      this.resource = stat || undefined;
    }
    if (fsPath) {
      this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI(fsPath), { preview: false });
    }
  }

  private disposeRegistedKeybinding() {
    for (const [, value] of this.toUnregisterUserKeybindingMap) {
      value.dispose();
    }
    for (const [, value] of this.toRestoreDefaultKeybindingMap) {
      value.dispose();
    }
  }

  dispose() {
    this.disposeRegistedKeybinding();
    this.disposableCollection.dispose();
  }

  /**
   * 因为 monaco.edtior.* 替换为 editor.* 为了兼容在 storage 里存量的数据，需要兼容一下
   * @param command
   */
  private getValidateCommand(command: string) {
    return command.replace(/^monaco.editor/, 'editor');
  }

  /**
   * 重新加载并设置Keymap定义的快捷键
   * @param keybindings
   */
  async reconcile(keybindings?: KeymapItem[]) {
    const keymap = keybindings ? keybindings.slice(0) : await this.parseKeybindings();
    const bindings: Keybinding[] = keymap.map((kb) =>
      // 清洗存入keymap数据
      ({
        when: kb.when,
        command: this.getValidateCommand(kb.command),
        keybinding: kb.key || kb.keybinding!,
      }),
    );
    const added: Keybinding[] = [];
    const removed: Keybinding[] = [];
    // 重新注册快捷键前取消注册先前的快捷键
    this.disposeRegistedKeybinding();
    bindings.forEach((kb: Keybinding) => {
      if (kb.command.startsWith('-')) {
        removed.push(kb);
      } else {
        added.push(kb);
      }
    });
    // 卸载快捷键的语法仅对默认快捷键生效，故这里不需要进行额外操作
    added.map((kb) => {
      this.unregisterDefaultKeybinding(kb, true);
      this.registerUserKeybinding(kb);
    });
    // 卸载默认快捷键
    removed.map((kb) => {
      // 去除开头的 '-' 便于查找默认快捷键
      kb.command = kb.command.slice(1);
      this.unregisterDefaultKeybinding(kb, true);
    });
    this.updateKeybindings();
  }

  private unregisterUserKeybinding(kb: Keybinding) {
    const key = this.toUniqueKey(kb);
    if (this.toUnregisterUserKeybindingMap.has(key)) {
      const disposeable = this.toUnregisterUserKeybindingMap.get(key);
      disposeable?.dispose();
      this.toUnregisterUserKeybindingMap.delete(key);
    }
  }

  private registerUserKeybinding(kb: Keybinding) {
    const key = this.toUniqueKey(kb);
    this.toUnregisterUserKeybindingMap.set(key, this.keybindingRegistry.registerKeybinding(kb, KeybindingScope.USER));
  }

  private unregisterDefaultKeybinding(kd: Keybinding, fromUserScope = false) {
    if (fromUserScope) {
      // 当卸载默认快捷键的操作是从用户快捷键初始化时操作的时候
      // 此时需要找到command下对应keybindings中when及快捷键匹配的快捷键进行卸载
      const keybindings = this.keybindingRegistry.getKeybindingsForCommand(kd.command);
      keybindings.map((rawKd: ScopedKeybinding) => {
        const targetKd = {
          ...kd,
          keybinding: rawKd.keybinding,
        };
        this.keybindingRegistry.unregisterKeybinding(targetKd);
        const key = this.toUniqueKey(kd);
        // 存储可恢复默认快捷键注册的函数
        this.toRestoreDefaultKeybindingMap.set(
          key,
          Disposable.create(() => {
            this.keybindingRegistry.registerKeybinding(targetKd);
          }),
        );
      });
    } else {
      // 当直接从快捷键编辑面板直接修改默认快捷键的时候
      // 由于卸载是定向的快捷键，有明确的快捷键，不需要进行command对应到快捷键的查找，可直接卸载
      this.keybindingRegistry.unregisterKeybinding(kd);
      const key = this.toUniqueKey(kd);
      // 存储可恢复默认快捷键注册的函数
      this.toRestoreDefaultKeybindingMap.set(
        key,
        Disposable.create(() => {
          this.keybindingRegistry.registerKeybinding(kd);
        }),
      );
    }
  }

  private restoreDefaultKeybinding(kb: Keybinding) {
    const key = this.toUniqueKey(kb);
    const restore = this.toRestoreDefaultKeybindingMap.get(key);
    restore?.dispose();
  }

  private toUniqueKey(kb: Keybinding) {
    return `${kb.command}${kb.when ? `-${kb.when}` : '-'}${kb.keybinding ? `-${kb.keybinding}` : '-'}`;
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
    this.keymapChangeEmitter.fire();
  }

  /**
   * 解析快捷键数据
   * @protected
   * @returns {Promise<Keybinding[]>}
   * @memberof KeymapsService
   */
  protected async parseKeybindings(): Promise<KeymapItem[]> {
    try {
      const resource = await this.resource;
      if (!resource) {
        return [];
      }
      const { content } = await this.filesystem.readFile(resource.uri);
      this.storeKeybindings = this.parser.parse(content.toString());
    } catch (error) {
      this.logger.warn(`ParseKeybindings fail: ${error.stack}`);
      this.storeKeybindings = [];
    }
    return this.storeKeybindings;
  }

  /**
   * 设置快捷键
   * @param {Keybinding} keybindings
   * @returns {Promise<void>}
   * @memberof KeymapsService
   */
  setKeybinding = (keybinding: Keybinding) => {
    this.progressService.withProgress(
      {
        location: ProgressLocation.Notification,
      },
      (progress: IProgress<IProgressStep>) =>
        new Promise<any>(async (resolve, reject) => {
          progress.report({ message: localize('keymaps.keybinding.loading'), increment: 0, total: 100 });
          const keybindings: KeymapItem[] = this.storeKeybindings || [];
          let updated = false;
          for (const kb of keybindings) {
            const item: Keybinding = {
              when: kb.when,
              command: kb.command,
              keybinding: kb.key,
            };
            if (kb.command === keybinding.command) {
              updated = true;
              this.unregisterUserKeybinding(item);
              kb.key = keybinding.keybinding;
              this.registerUserKeybinding({
                ...item,
                priority: KeybindingWeight.WorkbenchContrib * 100,
              });
            }
          }
          if (!updated) {
            const defaultBinding: KeybindingItem = this.keybindings.find(
              (kb: KeybindingItem) => kb.id === keybinding.command && this.getRaw(kb.when) === keybinding.when,
            )!;
            if (defaultBinding && defaultBinding.keybinding) {
              this.unregisterDefaultKeybinding({
                when: this.getRaw(defaultBinding.when),
                command: defaultBinding.id,
                keybinding: this.getRaw(defaultBinding.keybinding),
              });
            }
            // 不能额外传入keybinding的resolved值
            const item: KeymapItem = {
              when: this.getWhen(keybinding),
              command: keybinding.command,
              key: keybinding.keybinding,
            };
            keybindings.push(item);
            this.registerUserKeybinding(keybinding);
          }
          // 后置存储流程
          this.saveKeybinding(keybindings)
            .then(() => {
              resolve(undefined);
              progress.report({ message: localize('keymaps.keybinding.success'), increment: 99 });
            })
            .catch((e: any) => {
              reject(e);
              progress.report({ message: localize('keymaps.keybinding.fail'), increment: 99 });
            })
            .finally(() => {
              setTimeout(() => {
                // 3s 后再隐藏进度条
                progress.report({ increment: 100 });
              }, 3000);
            });
        }),
      () => {},
    );
  };

  private async saveKeybinding(keymaps: KeymapItem[]) {
    this.storeKeybindings = keymaps;
    this.updateKeybindings();
    if (!this.resource) {
      this.resource = await this.filesystem.createFile(KeymapService.KEYMAP_FILE_URI.toString());
    }
    // 更新当前文件资源
    const stat = await this.filesystem.setContent(this.resource, JSON.stringify(keymaps, undefined, 2));
    this.resource = stat || undefined;
  }

  covert = (event: KeyboardEvent) => this.keybindingService.convert(event, ' ');

  clearCovert = () => this.keybindingService.clearConvert();

  /**
   * 移除给定ID的快捷键绑定
   * @param {string} commandId
   * @returns {Promise<void>}
   * @memberof KeymapsService
   */
  resetKeybinding = async (item: Keybinding) => {
    if (!this.resource) {
      return;
    }
    const keymaps: KeymapItem[] = this.storeKeybindings;
    const filtered = keymaps.filter((a) => a.command !== item.command);
    this.unregisterUserKeybinding(item);
    this.restoreDefaultKeybinding(item);
    this.saveKeybinding(filtered);
  };

  /**
   * 从keymaps.json获取快捷键列表
   * @returns {Promise<Keybinding[]>}
   * @memberof KeymapsService
   */
  async getKeybindings(): Promise<Keybinding[]> {
    return this.storeKeybindings.map((keymap) => ({
      command: keymap.command,
      keybinding: keymap.key,
      when: keymap.when,
      args: keymap.args,
    }));
  }

  /**
   * 打开快捷键面板
   * @protected
   * @returns {Promise<void>}
   * @memberof KeymapService
   */
  async open(): Promise<void> {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI().withScheme(KEYMAPS_SCHEME), {
      preview: true,
    });
  }

  fixed = async () => {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI().withScheme(KEYMAPS_SCHEME), {
      preview: false,
    });
  };

  getWhen(keybinding?: Keybinding | KeymapItem) {
    if (!keybinding) {
      return '';
    }
    return this.keybindingService.convertMonacoWhen(keybinding.when);
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
      if (!keybindings || !keybindings.length) {
        // 针对带有label的Command，在快捷键面板上添加可配置按钮
        if (command.label) {
          items.push({
            id: command.id,
            command: command.label,
            hasCommandLabel: true,
          });
        }
      } else {
        keybindings.forEach((kd: ScopedKeybinding) => {
          let item: KeybindingItem;
          if (this.storeKeybindings) {
            const isUserKeybinding = this.storeKeybindings.find((kb) => command && kb.command === command.id);
            item = {
              id: command.id,
              command: command.label || command.id,
              keybinding: isUserKeybinding
                ? isUserKeybinding.key
                : kd
                ? this.keybindingRegistry.acceleratorFor(kd, '+').join(' ')
                : '',
              when: isUserKeybinding ? this.getWhen(isUserKeybinding) : this.getWhen(keybindings && kd),
              source: isUserKeybinding ? this.getScope(KeybindingScope.USER) : this.getScope(KeybindingScope.DEFAULT),
              hasCommandLabel: !!command.label,
            };
          } else {
            item = {
              id: command.id,
              command: command.label || command.id,
              keybinding: keybindings && kd ? this.keybindingRegistry.acceleratorFor(kd, '+').join(' ') : '',
              when: this.getWhen(keybindings && kd),
              source: keybindings && kd && typeof kd.scope !== 'undefined' ? this.getScope(kd.scope!) : '',
              hasCommandLabel: !!command.label,
            };
          }
          items.push(item);
        });
      }
    }

    // 获取排序后的列表
    const sorted: KeybindingItem[] = items.sort((a: KeybindingItem, b: KeybindingItem) => this.compareItem(a, b));
    // 获取定义了快捷键的列表
    const keyItems: KeybindingItem[] = sorted.filter((a: KeybindingItem) => !!a.keybinding);

    const otherItems: KeybindingItem[] = sorted.filter((a: KeybindingItem) => !a.keybinding && a.hasCommandLabel);

    // 让带有 Label 的快捷键命令排序靠前
    const withLabelItems = keyItems.filter((keybinding) => keybinding.hasCommandLabel);
    const withoutLabelItems = keyItems.filter((keybinding) => !keybinding.hasCommandLabel);

    return [...withLabelItems, ...withoutLabelItems, ...otherItems];
  }

  // 字典排序
  protected compareItem(a: KeybindingItem, b: KeybindingItem): number {
    if (a && b) {
      if (a.source === b.source) {
        return a.command.toLowerCase().localeCompare(b.command.toLowerCase());
      } else if (a.source === this.getScope(KeybindingScope.USER)) {
        return -1;
      } else {
        return 1;
      }
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
    if (!this.searchDelayer.isTriggered) {
      this.searchDelayer.cancel();
    }
    this.searchDelayer.trigger(async () => {
      this.doSearchKeybindings(this.currentSearchValue);
    });
  };

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
  };

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
        keybinding,
      };
      if (keybindingItem.keybinding === keybinding) {
        return ' ';
      }
      return this.keybindingRegistry.validateKeybindingInScope(binding);
    } catch (error) {
      return error;
    }
  };

  detectKeybindings = (keybindingItem: KeybindingItem, keybinding: string): KeybindingItem[] => {
    if (!keybinding) {
      return [];
    }
    try {
      if (keybindingItem.keybinding === keybinding) {
        return [];
      }
      // 可能匹配了高亮结果，需要还原部分数据
      const keybindings = this.keybindings.filter((kb) => this.getRaw(kb.keybinding) === keybinding);
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
            when: this.keybindingService.convertMonacoWhen(binding.when),
            keybinding: this.getRaw(binding.keybinding),
            source: isUserKeybinding ? this.getScope(KeybindingScope.USER) : this.getScope(KeybindingScope.DEFAULT),
          };
        });
      }
    } catch (error) {
      this.logger.error(error);
    }
    return [];
  };

  /**
   * 获取被fuzzy替换的原始值
   * @param {string} keybinding
   */
  getRaw(keybinding?: string) {
    if (!keybinding) {
      return '';
    }
    return keybinding.replace(new RegExp(/<(\/)?match>/gi), '');
  }
}
