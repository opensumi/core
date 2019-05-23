import { observable, computed } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { CommandService } from '@ali/ide-core-common';

export interface StatusBarEntry {
  /**
   * For icons we use fontawesome. Get more information and the class names
   * here: http://fontawesome.io/icons/
   * To set a text with icon use the following pattern in text string:
   * $(fontawesomeClassName)
   * To use animated icons use the following pattern:
   * $(fontawesomeClassName~typeOfAnimation)
   * Type of animation can be either spin or pulse.
   * Look here for more information to animated icons:
   * http://fontawesome.io/examples/#animated
   */
  text: string;
  alignment: StatusBarAlignment;
  color?: string;
  className?: string;
  tooltip?: string;
  command?: string;
  arguments?: any[];
  priority?: number;
  icon?: string;
  onClick?: (e: any) => void;
}

export enum StatusBarAlignment {
  LEFT, RIGHT,
}

export interface StatusBar {
  setBackgroundColor(color?: string): void;
  setColor(color?: string): void;
  setElement(id: string, entry: StatusBarEntry): void;
  removeElement(id: string): void;
}

@Injectable()
export class StatusBarService extends Disposable implements StatusBar {

  @observable
  protected backgroundColor: string | undefined;

  @observable
  private color: string | undefined;

  @observable
  private entries: Map<string, StatusBarEntry>;

  @Autowired(CommandService)
  private commandService: CommandService;

  constructor() {
    super();
    this.entries = this.initEntry();
  }

  private initEntry(): Map<string, StatusBarEntry> {
    return new Map([
      ['demo.alert', {
        text: 'kaitian',
        icon: 'info-circle',
        alignment: StatusBarAlignment.LEFT,
        priority: 100,
        onClick: () => {
          alert('hello ide :)');
        },
      }],
    ]);
  }

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
   * 设置 Status Bar 颜色
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
  setElement(id: string, entry: StatusBarEntry) {
    // 如果有 command，覆盖自定义的 click 方法
    if (entry.command) {
      entry.onClick = this.onclick(entry);
    }
    this.entries.set(id, entry);
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
