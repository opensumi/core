import { observable, computed } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable, getIconClass } from '@ali/ide-core-browser';
import { CommandService } from '@ali/ide-core-common';
import * as common from '../common';

/**
 * @deprecated import from `@ali/ide-status-bar` instead
 */
export const StatusBar = common.IStatusBarService;

/**
 * @deprecated import from `@ali/ide-status-bar` instead
 */
export type StatusBar = common.IStatusBarService;

/**
 * @deprecated import from `@ali/ide-status-bar` instead
 */
export const StatusBarAlignment = common.StatusBarAlignment;

/**
 * @deprecated import from `@ali/ide-status-bar` instead
 */
export type StatusBarEntry = common.StatusBarEntry;

@Injectable()
export class StatusBarService extends Disposable implements common.IStatusBarService {

  @observable
  private backgroundColor: string | undefined;

  @observable
  private entries: Map<string, StatusBarEntry> = new Map();

  @Autowired(CommandService)
  private commandService: CommandService;

  /**
   * 获取背景颜色
   */
  getBackgroundColor(): string | undefined {
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
    for (const [key, value] of this.entries) {
      value.color = color;
    }
  }
  /**
   * 设置一个 Status Bar Item
   * @param id
   * @param entry
   */
  addElement(id: string, entry: StatusBarEntry) {
    // 如果有 command，覆盖自定义的 click 方法
    if (entry.command) {
      entry.onClick = this.onclick(entry);
    }
    // 设置图标
    if (entry.text) {
      const [icon, text] = getIconClass(entry.text);

      entry.text = text;
      if (icon) {
        entry.icon = icon;
      }
    }

    entry.id = id;
    this.entries.set(id, entry);
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
