import { observable, computed } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { AppConfig, Disposable } from '@ali/ide-core-browser';
import { IStatusBarService, StatusBarEntry, StatusBarAlignment, StatusBarEntryAccessor } from '@ali/ide-core-browser/lib/services';
import { CommandService } from '@ali/ide-core-common';

@Injectable()
export class StatusBarService extends Disposable implements IStatusBarService {

  @observable
  private backgroundColor: string | undefined;

  @observable
  private entries: Map<string, StatusBarEntry> = new Map();

  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  /**
   * 获取背景颜色
   */
  getBackgroundColor(): string | undefined {
    if (this.appConfig.extensionDevelopmentHost) {
      return 'var(--kt-statusBar-extensionDebuggingBackground)';
    }
    return this.backgroundColor;
  }

  /**
   * 设置整个 Status Bar 背景颜色
   * @param color
   */
  setBackgroundColor(color?: string | undefined) {
    this.backgroundColor = color;
  }
  /**
   * 设置 Status Bar 所有文字颜色
   * @param color
   */
  setColor(color?: string | undefined) {
    for (const [, value] of this.entries) {
      value.color = color;
    }
  }

  // 暴露给其他地方获取配置数据以自定义渲染
  // 目前 scm 使用
  getElementConfig(id: string, entry: StatusBarEntry): StatusBarEntry {
    // 如果有 command，覆盖自定义的 click 方法
    if (entry.command) {
      entry.onClick = this.onclick(entry);
    }

    entry.id = id;

    return entry;
  }

  /**
   * 设置一个 Status Bar Item
   * @param id
   * @param entry
   */
  addElement(id: string, entry: StatusBarEntry): StatusBarEntryAccessor {
    entry = this.getElementConfig(id, entry);
    this.entries.set(id, entry);
    return {
      dispose: () => {
        this.entries.delete(id);
      },
      update: (entry: StatusBarEntry) => {
        this.setElement(id, entry);
      },
    };
  }

  /**
   * 给指定 id 的元素设置属性
   * @param id
   * @param fields
   */
  setElement(id: string, fields: Partial<StatusBarEntry>) {
    const current = this.entries.get(id);
    if (current) {
      const entry = {
        ...current,
        ...fields,
      };
      this.addElement(id, entry);
    } else {
      throw new Error(`not found id is ${id} element`);
    }
  }

  /**
   * 删除一个元素
   * @param id
   */
  removeElement(id: string) {
    this.entries.delete(id);
  }

  /**
   * 数组形式的 entries
   * @readonly
   * @private
   * @type {StatusBarEntry[]}
   * @memberof StatusBarService
   */
  private get entriesArray(): StatusBarEntry[] {
    return Array.from(this.entries.values()).sort((left, right) => {
      const lp = left.priority || 0;
      const rp = right.priority || 0;
      return rp - lp;
    });
  }

  /**
   * Status Bar 左边的 Item
   * @readonly
   * @type {StatusBarEntry[]}
   * @memberof StatusBarService
   */
  @computed
  public get leftEntries(): StatusBarEntry[] {
    return this.entriesArray.filter((entry) => entry.alignment === StatusBarAlignment.LEFT);
  }

  /**
   * Status Bar 右边的 Item
   *
   * @readonly
   * @type {StatusBarEntry[]}
   * @memberof StatusBarService
   */
  @computed
  public get rightEntries(): StatusBarEntry[] {
    return this.entriesArray.filter((entry) => entry.alignment === StatusBarAlignment.RIGHT);
  }

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

}
