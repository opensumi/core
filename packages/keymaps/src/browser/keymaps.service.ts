import * as fuzzy from 'fuzzy';

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
  Throttler,
  Schemes,
} from '@opensumi/ide-core-browser';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import { KEYMAPS_FILE_NAME, IKeymapService, KEYMAPS_SCHEME, KeybindingItem, KeymapItem } from '../common';

import { KeymapsParser } from './keymaps-parser';

@Injectable()
export class KeymapService implements IKeymapService {
  static DEFAULT_SEARCH_DELAY = 100;
  static KEYMAP_FILE_URI: URI = new URI().withScheme(Schemes.userStorage).withPath(KEYMAPS_FILE_NAME);

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

  protected readonly keymapChangeEmitter = new Emitter<KeybindingItem[]>();

  get onDidKeymapChanges(): Event<KeybindingItem[]> {
    return this.keymapChangeEmitter.event;
  }

  protected convertKeySequence: KeySequence = [];

  protected readonly toUnregisterUserKeybindingMap: Map<string, IDisposable> = new Map();
  protected readonly toRestoreDefaultKeybindingMap: Map<string, IDisposable> = new Map();

  private searchDelayer = new ThrottledDelayer(KeymapService.DEFAULT_SEARCH_DELAY);
  private disposableCollection: DisposableCollection = new DisposableCollection();

  private _whenReadyDeferred: Deferred<void> = new Deferred();

  /**
   * fuzzy???????????????pre???post????????????????????????
   * @protected
   * @memberof KeymapService
   */
  protected readonly fuzzyOptions = {
    pre: '<match>',
    post: '</match>',
  };
  private _storeKeybindings: KeymapItem[];

  private reconcileQueue: Throttler = new Throttler();

  get storeKeybindings() {
    return (
      this._storeKeybindings &&
      this._storeKeybindings.map((keybinding) => ({
        ...keybinding,
        command: this.getValidateCommand(keybinding.command),
        // ??????????????? keybinding ????????????
        key: keybinding.key || keybinding.keybinding!,
      }))
    );
  }

  set storeKeybindings(value: KeymapItem[]) {
    this._storeKeybindings = value;
  }

  keybindings: KeybindingItem[] = [];

  get whenReady() {
    return this._whenReadyDeferred.promise;
  }

  async init() {
    const keymapUrl = KeymapService.KEYMAP_FILE_URI.toString();
    this.resource = await this.filesystem.getFileStat(keymapUrl);
    // ????????????????????????????????????????????????
    // ?????????????????????????????????????????????????????????????????????????????? watch
    if (!this.resource) {
      this.resource = await this.filesystem.createFile(keymapUrl, {
        content: JSON.stringify([]),
      });
    }
    await this.reconcile();
    const watcher = await this.filesystem.watchFileChanges(KeymapService.KEYMAP_FILE_URI);
    this.disposableCollection.push(watcher);
    watcher.onFilesChanged(() => {
      // ???????????????????????????????????????????????????????????????
      this.reconcileQueue.queue(this.reconcile.bind(this));
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
   * ?????? monaco.edtior.* ????????? editor.* ??????????????? storage ???????????????????????????????????????
   * @param command
   */
  private getValidateCommand(command: string) {
    return command.replace(/^monaco.editor/, 'editor');
  }

  /**
   * ?????????????????????Keymap??????????????????
   * @param keybindings
   */
  async reconcile(keybindings?: KeymapItem[]) {
    const keymap = keybindings ? keybindings.slice(0) : await this.parseKeybindings();
    const bindings: Keybinding[] = keymap.map((kb) =>
      // ????????????keymap??????
      ({
        when: kb.when,
        command: this.getValidateCommand(kb.command),
        keybinding: kb.key || kb.keybinding!,
      }),
    );
    const added: Keybinding[] = [];
    const removed: Keybinding[] = [];
    // ??????????????????????????????????????????????????????
    this.disposeRegistedKeybinding();
    bindings.forEach((kb: Keybinding) => {
      if (kb.command.startsWith('-')) {
        removed.push(kb);
      } else {
        added.push(kb);
      }
    });
    // ??????????????????????????????????????????????????????????????????????????????????????????
    added.map((kb) => {
      this.unregisterDefaultKeybinding(kb, true);
      this.registerUserKeybinding(kb);
    });
    // ?????????????????????
    removed.map((kb) => {
      // ??????????????? '-' ???????????????????????????
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
      // ?????????????????????????????????????????????????????????????????????????????????
      // ??????????????????command?????????keybindings???when??????????????????????????????????????????
      const keybindings = this.keybindingRegistry.getKeybindingsForCommand(kd.command);
      keybindings.map((rawKd: ScopedKeybinding) => {
        const targetKd = {
          ...kd,
          keybinding: rawKd.keybinding,
        };
        this.keybindingRegistry.unregisterKeybinding(targetKd);
        const key = this.toUniqueKey(kd);
        // ?????????????????????????????????????????????
        this.toRestoreDefaultKeybindingMap.set(
          key,
          Disposable.create(() => {
            this.keybindingRegistry.registerKeybinding(targetKd);
          }),
        );
      });
    } else {
      // ?????????????????????????????????????????????????????????????????????
      // ???????????????????????????????????????????????????????????????????????????command?????????????????????????????????????????????
      this.keybindingRegistry.unregisterKeybinding(kd);
      const key = this.toUniqueKey(kd);
      // ?????????????????????????????????????????????
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
    if (restore) {
      restore?.dispose();
      this.toRestoreDefaultKeybindingMap.delete(key);
    }
  }

  private toUniqueKey(kb: Keybinding) {
    return `${kb.command}${kb.when ? `-${kb.when}` : '-'}${kb.keybinding ? `-${kb.keybinding}` : '-'}`;
  }
  /**
   * ??????keybindings??????
   */
  private updateKeybindings() {
    if (this.currentSearchValue) {
      this.doSearchKeybindings(this.currentSearchValue);
    } else {
      this.keybindings = this.getKeybindingItems();
    }
    this.keymapChangeEmitter.fire(this.keybindings);
  }

  /**
   * ?????????????????????
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
   * ???????????????
   * @param {Keybinding} raw
   * @param {Keybinding} keybindings
   * @returns {Promise<void>}
   * @memberof KeymapsService
   */
  setKeybinding = (raw: Keybinding, keybinding: Keybinding) =>
    this.progressService.withProgress(
      {
        location: ProgressLocation.Notification,
      },
      (progress: IProgress<IProgressStep>) =>
        new Promise<any>((resolve, reject) => {
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
              const rawKey = this.toUniqueKey(raw);
              const restore = this.toRestoreDefaultKeybindingMap.get(rawKey);
              if (restore) {
                const newKey = this.toUniqueKey(keybinding as Keybinding);
                this.toRestoreDefaultKeybindingMap.delete(rawKey);
                this.toRestoreDefaultKeybindingMap.set(newKey, restore);
              }
              kb.key = keybinding.keybinding;
              this.registerUserKeybinding({
                ...item,
                priority: KeybindingWeight.WorkbenchContrib * 100,
              });
            }
          }
          if (!updated) {
            const defaultBinding = this.keybindings.find(
              (kb: KeybindingItem) => kb.id === keybinding.command && this.getRaw(kb.when) === keybinding.when,
            );
            if (defaultBinding && defaultBinding.keybinding) {
              this.unregisterDefaultKeybinding({
                when: this.getRaw(defaultBinding.when),
                command: defaultBinding.id,
                keybinding: this.getRaw(defaultBinding.keybinding),
              });
              const rawKey = this.toUniqueKey(raw as Keybinding);
              const restore = this.toRestoreDefaultKeybindingMap.get(rawKey);
              if (restore) {
                const newKey = this.toUniqueKey(keybinding);
                this.toRestoreDefaultKeybindingMap.delete(rawKey);
                this.toRestoreDefaultKeybindingMap.set(newKey, restore);
              }
            }
            // ??????????????????keybinding???resolved???
            const item: KeymapItem = {
              when: this.getWhen(keybinding),
              command: keybinding.command,
              key: keybinding.keybinding,
            };
            keybindings.push(item);
            this.registerUserKeybinding(keybinding);
          }
          // ??????????????????
          return this.saveKeybinding(keybindings)
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
                // 3s ?????????????????????
                progress.report({ increment: 100 });
              }, 3000);
            });
        }),
      () => {},
    );

  private async saveKeybinding(keymaps: KeymapItem[]) {
    this.storeKeybindings = keymaps;
    this.updateKeybindings();
    if (!this.resource) {
      this.resource = await this.filesystem.createFile(KeymapService.KEYMAP_FILE_URI.toString());
    }
    // ????????????????????????
    const stat = await this.filesystem.setContent(this.resource, JSON.stringify(keymaps, undefined, 2));
    this.resource = stat || undefined;
  }

  covert = (event: KeyboardEvent) => this.keybindingService.convert(event, ' ');

  clearCovert = () => this.keybindingService.clearConvert();

  /**
   * ????????????ID??????????????????
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
    return this.saveKeybinding(filtered);
  };

  /**
   * ???keymaps.json?????????????????????
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
   * ?????????????????????
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
   * ????????????????????????
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
   * ????????????????????????
   * @returns {KeybindingItem[]}
   * @memberof KeymapService
   */
  getKeybindingItems(): KeybindingItem[] {
    const commands = this.commandRegistry.getCommands();
    const items: KeybindingItem[] = [];
    for (const command of commands) {
      const keybindings = this.keybindingRegistry.getKeybindingsForCommand(command.id);
      if (!keybindings || !keybindings.length) {
        // ????????????label???Command?????????????????????????????????????????????
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

    // ????????????????????????
    const sorted: KeybindingItem[] = items.sort((a: KeybindingItem, b: KeybindingItem) => this.compareItem(a, b));
    // ?????????????????????????????????
    const keyItems: KeybindingItem[] = sorted.filter((a: KeybindingItem) => !!a.keybinding);

    const otherItems: KeybindingItem[] = sorted.filter((a: KeybindingItem) => !a.keybinding && a.hasCommandLabel);

    // ????????? Label ??????????????????????????????
    const withLabelItems = keyItems.filter((keybinding) => keybinding.hasCommandLabel);
    const withoutLabelItems = keyItems.filter((keybinding) => !keybinding.hasCommandLabel);

    return [...withLabelItems, ...withoutLabelItems, ...otherItems];
  }

  // ????????????
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
   * ???????????????
   */
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

  private isSearching = false;

  /**
   * ??????????????????????????????
   * @protected
   */
  protected readonly doSearchKeybindings = (search) => {
    if (search) {
      this.isSearching = true;
    } else {
      this.isSearching = false;
    }
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
            // ???????????????????????????????????????????????????
            // ??????
            if (key === 'keybinding') {
              const queryItems = search.split('+');
              // ???????????????
              const tempItems = str.split(' ');
              // ?????????????????????
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
                    // ?????????????????????????????????????????????
                    const tempFuzzyMatch = fuzzy.match(queryItem, bindingItem, this.fuzzyOptions);
                    // ???????????????????????????
                    if (tempFuzzyMatch && tempFuzzyMatch.score > keyFuzzyMatch.score) {
                      keyFuzzyMatch = tempFuzzyMatch;
                      // ??????????????????????????????????????????
                      keyIndex = renderedResult.indexOf(bindingItem);
                    }
                  });

                  const keyRendered = keyFuzzyMatch.rendered;
                  if (keyRendered) {
                    if (keyIndex > -1) {
                      renderedResult[keyIndex] = keyRendered;
                    }
                    // ????????????????????????????????????????????????
                    bindingItems.splice(keyIndex, 1, '');
                    matchCounter += 1;
                  }
                }
              });
              if (matchCounter === queryItems.length) {
                // ????????????????????????
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
    this.keymapChangeEmitter.fire(this.keybindings);
  };

  /**
   * ???????????????????????????
   * @memberof KeymapService
   */
  validateKeybinding = (keybindingItem: KeybindingItem, keybinding: string): string => {
    if (!keybinding) {
      return localize('keymaps.keybinding.require');
    }
    try {
      const binding = {
        command: this.isSearching ? this.getRaw(keybindingItem.command) : keybindingItem.command,
        when: this.isSearching ? this.getRaw(keybindingItem.when) : keybindingItem.when,
        keybinding: this.isSearching ? this.getRaw(keybinding) : keybinding,
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
      // ??????????????????????????????????????????????????????
      const keybindings = this.keybindings.filter((kb) => this.getRaw(kb.keybinding) === keybinding);
      // ?????????????????????????????????????????????????????????????????????????????????????????????????????????
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
   * ?????????fuzzy??????????????????
   * @param {string} keybinding
   */
  getRaw(keybinding?: string) {
    if (!keybinding) {
      return '';
    }
    return keybinding.replace(new RegExp(/<(\/)?match>/gi), '');
  }
}
