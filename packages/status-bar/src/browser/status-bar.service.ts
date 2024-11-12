import { Autowired, Injectable } from '@opensumi/di';
import { EventEmitter } from '@opensumi/events';
import { AppConfig, Disposable, IContextKeyService, IDisposable, isUndefined } from '@opensumi/ide-core-browser';
import { LAYOUT_STATE, LayoutState } from '@opensumi/ide-core-browser/lib/layout/layout-state';
import { AbstractMenuService, IMenu, IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { RawContextKey } from '@opensumi/ide-core-browser/lib/raw-context-key';
import {
  IStatusBarService,
  StatusBarAlignment,
  StatusBarCommand,
  StatusBarEntry,
  StatusBarEntryAccessor,
  StatusBarState,
} from '@opensumi/ide-core-browser/lib/services';
import { CommandService, DisposableCollection, memoize } from '@opensumi/ide-core-common';
import { derived, observableValue, transaction } from '@opensumi/ide-monaco/lib/common/observable';

@Injectable()
export class StatusBarService extends Disposable implements IStatusBarService {
  emitter = this.registerDispose(
    new EventEmitter<{
      backgroundColor: [string?];
      color: [string?];
    }>(),
  );

  private background: string | undefined;
  private foreground: string | undefined;

  private entriesObservable = observableValue<Map<string, StatusBarEntry>>(this, new Map());

  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  @Autowired(IMenuRegistry)
  protected readonly menuRegistry: IMenuRegistry;

  @Autowired(AbstractMenuService)
  protected readonly menuService: AbstractMenuService;

  @Autowired(IContextKeyService)
  protected readonly globalContextKeyService: IContextKeyService;

  @Autowired(LayoutState)
  private layoutState: LayoutState;

  protected disposableCollection = new Map<string, IDisposable>();

  /**
   * 获取背景颜色
   */
  getBackgroundColor(): string | undefined {
    if (this.appConfig.extensionDevelopmentHost) {
      return 'var(--kt-statusBar-extensionDebuggingBackground)';
    }
    return this.background;
  }

  getColor() {
    return this.foreground;
  }

  /**
   * 设置整个 Status Bar 背景颜色
   * @param color
   */
  setBackgroundColor(color?: string | undefined) {
    this.background = color;
    this.emitter.emit('backgroundColor', color);
  }
  /**
   * 设置 Status Bar 所有文字颜色，当设置值为 undefined 时，文件将回复原有颜色配置
   * @param color
   */
  setColor(color?: string | undefined) {
    this.foreground = color;
    this.emitter.emit('color', color);
  }

  // 暴露给其他地方获取配置数据以自定义渲染
  // 目前 scm 使用
  getElementConfig(entryId: string, entry: StatusBarEntry): StatusBarEntry {
    // 如果有 command，覆盖自定义的 click 方法
    if (entry.command) {
      entry.onClick = this.onclick(entry);
    }
    entry.entryId = entryId;

    if (isUndefined(entry.id)) {
      entry.id = entryId;
    }

    return entry;
  }

  /**
   * 通过 id 获取关联的实例
   * @param id 状态栏 id
   * @returns
   */
  private getEntriesById(id: string) {
    return this.entriesArray.get().filter((entry) => entry.id === id);
  }

  /**
   * 从 storage 中读取 state
   */
  private getStorageState(id: string) {
    return this.layoutState.getState<{ [id: string]: StatusBarState }>(LAYOUT_STATE.STATUSBAR, {})[id];
  }

  private setStorageState(id: string, state: StatusBarState) {
    this.layoutState.setState(LAYOUT_STATE.STATUSBAR, {
      ...this.layoutState.getState<{ [id: string]: StatusBarState }>(LAYOUT_STATE.STATUSBAR, {}),
      [id]: state,
    });
  }

  /**
   * 设置一个 StatusBar Item
   * @param id
   * @param entry
   */
  addElement(entryId: string, entry: StatusBarEntry): StatusBarEntryAccessor {
    const disposables = new DisposableCollection();
    entry = this.getElementConfig(entryId, entry);
    const id = entry.id!;
    // 优先读取 storage 数据
    const hidden = this.getStorageState(id)?.hidden ?? entry.hidden;
    entry.hidden = hidden;
    // 确保相同 id 只注册一次菜单me
    // 比如源码管理会注册多个状态栏元素，但菜单只会注册一个
    if (entry.name && this.getEntriesById(id).length === 0) {
      const toggleContextKey = new RawContextKey(`${id}:toggle`, !hidden);
      toggleContextKey.bind(this.contextKeyService);
      // 如果当前状态栏在左侧，权重越大，排序越靠前，右侧反之
      // 负数为左，正数为右
      const order =
        entry.alignment === StatusBarAlignment.LEFT
          ? -1 * (entry.priority ?? 0)
          : Number.MAX_SAFE_INTEGER - (entry.priority ?? 0);
      const menuDisposer = this.menuRegistry.registerMenuItem(MenuId.StatusBarContext, {
        command: {
          id: StatusBarCommand.toggleElement.id,
          label: entry.name,
        },
        order,
        extraTailArgs: [entryId],
        toggledWhen: toggleContextKey.raw,
      });
      disposables.push(menuDisposer);
    }
    const preEntries = this.entriesObservable.get();
    preEntries.set(entryId, entry);
    transaction((tx) => {
      this.entriesObservable.set(new Map(preEntries), tx);
    });

    disposables.push(
      Disposable.create(() => {
        const preEntries = this.entriesObservable.get();
        preEntries.delete(entryId);
        transaction((tx) => {
          this.entriesObservable.set(new Map(preEntries), tx);
        });
      }),
    );

    this.disposableCollection.set(entryId, disposables);
    return {
      dispose: () => {
        this.removeElement(entryId);
      },
      update: (entry: StatusBarEntry) => {
        this.setElement(entryId, entry);
      },
    };
  }

  toggleElement(entryId: string): void {
    const entries = this.entriesObservable.get();
    const entry = entries.get(entryId);
    if (entry?.id) {
      const toggleContextKey = `${entry.id}:toggle`;
      const hidden = !entry.hidden;
      // 设置 toggle contextkey
      this.contextKeyService.createKey<boolean>(toggleContextKey, !hidden);
      this.setStorageState(entry.id, {
        hidden,
      });
      // 确保修改了所有 id 相同的状态栏
      for (const toggleEntry of this.getEntriesById(entry.id)) {
        toggleEntry.hidden = !toggleEntry.hidden;
      }
    }
  }

  /**
   * 给指定 id 的元素设置属性
   * @param id
   * @param fields
   */
  setElement(entryId: string, fields: Partial<StatusBarEntry>) {
    const entries = this.entriesObservable.get();
    const current = entries.get(entryId);
    if (current) {
      const entry = {
        ...current,
        ...fields,
      };
      entries.set(entryId, this.getElementConfig(entryId, entry));
      transaction((tx) => {
        this.entriesObservable.set(new Map(entries), tx);
      });
    } else {
      throw new Error(`not found id is ${entryId} element`);
    }
  }

  /**
   * 删除一个元素
   * @param id
   */
  removeElement(entryId: string) {
    this.disposableCollection.get(entryId)?.dispose();
    this.disposableCollection.delete(entryId);
  }

  /**
   * 数组形式的 entries
   * @readonly
   * @private
   * @type {StatusBarEntry[]}
   * @memberof StatusBarService
   */
  readonly entriesArray = derived(this, (reader) => {
    const entries = this.entriesObservable.read(reader);
    return Array.from(entries.values()).sort((left, right) => {
      const lp = left.priority || 0;
      const rp = right.priority || 0;
      return rp - lp;
    });
  });

  /**
   * Status Bar 左边的 Item
   * @readonly
   * @type {StatusBarEntry[]}
   * @memberof StatusBarService
   */
  readonly leftEntries = derived(this, (reader) => {
    const entries = this.entriesArray.read(reader);
    return entries.filter((entry) => !entry.hidden && entry.alignment === StatusBarAlignment.LEFT);
  });

  /**
   * Status Bar 右边的 Item
   *
   * @readonly
   * @type {StatusBarEntry[]}
   * @memberof StatusBarService
   */
  readonly rightEntries = derived(this, (reader) => {
    const entries = this.entriesArray.read(reader);
    return entries.filter((entry) => !entry.hidden && entry.alignment === StatusBarAlignment.RIGHT);
  });

  /**
   * command 转换 onClick 的方法
   * @param entry
   */
  private onclick(entry: StatusBarEntry): () => void {
    return () => {
      if (entry.command) {
        const args = entry.arguments || [];
        this.commandService.executeCommand(entry.command, ...args);
      }
    };
  }

  @memoize
  get contextKeyService() {
    return this.registerDispose(this.globalContextKeyService.createScoped());
  }

  @memoize
  public get contextMenu(): IMenu {
    return this.registerDispose(this.menuService.createMenu(MenuId.StatusBarContext, this.contextKeyService));
  }
}
