import { URI, MaybePromise } from '@ali/ide-core-common';
import { Keybinding } from '@ali/ide-core-browser';

/**
 * 高亮显示的范围
 */
export interface Highlight {
  start: number;
  end: number;
}

/**
 * QuickOpen 执行的模式
 */
export enum QuickOpenMode {
  /* 选中条目但未执行 */
  PREVIEW,
  /* 选中条目且执行 */
  OPEN,
  /* 后台执行条目 */
  OPEN_IN_BACKGROUND,
}

/**
 * QuickOpen Item 参数
 */
export interface QuickOpenItemOptions {
  /**
   * 屏幕阅读器字段，对应 vscode
   */
  tooltip?: string;
  /**
   * 标签文案
   */
  label?: string;
  /**
   * 高亮标签的范围
   */
  labelHighlights?: Highlight[];
  /**
   * 显示描述
   */
  description?: string;
  /**
   * 高亮描述的范围
   */
  descriptionHighlights?: Highlight[];
  /**
   * 显示详情
   */
  detail?: string;
  /**
   * 描述高亮范围
   */
  detailHighlights?: Highlight[];
  /**
   * 是否隐藏
   */
  hidden?: boolean;
  /**
   * 打开资源，对应 vscode getResource
   */
  uri?: URI;
  /**
   * 图标
   */
  iconClass?: string;
  /**
   * 对应绑定的快捷键
   */
  keybinding?: Keybinding;
  /**
   * 点击 QuickOpen 要执行的方法
   * @param mode
   */
  run?(mode: QuickOpenMode): boolean;
}
/**
 * QuickOpen 分组
 */
export interface QuickOpenGroupItemOptions extends QuickOpenItemOptions {
  /**
   * 分组文案
   */
  groupLabel?: string;
  /**
   * 是否显示 border
   */
  showBorder?: boolean;
}

export class QuickOpenItem<T extends QuickOpenItemOptions = QuickOpenItemOptions> {

  constructor(
    protected options: T = {} as T,
  ) { }

  getTooltip(): string | undefined {
    return this.options.tooltip || this.getLabel();
  }
  getLabel(): string | undefined {
    return this.options.label;
  }
  getLabelHighlights(): Highlight[] {
    return this.options.labelHighlights || [];
  }
  getDescription(): string | undefined {
    return this.options.description;
  }
  getDescriptionHighlights(): Highlight[] | undefined {
    return this.options.descriptionHighlights;
  }
  getDetail(): string | undefined {
    return this.options.detail;
  }
  getDetailHighlights(): Highlight[] | undefined {
    return this.options.detailHighlights;
  }
  isHidden(): boolean {
    return this.options.hidden || false;
  }
  getUri(): URI | undefined {
    return this.options.uri;
  }
  getIconClass(): string | undefined {
    return this.options.iconClass;
  }
  getKeybinding(): Keybinding | undefined {
    return this.options.keybinding;
  }
  run(mode: QuickOpenMode): boolean {
    if (!this.options.run) {
      return false;
    }
    return this.options.run(mode);
  }
}

export class QuickOpenGroupItem<T extends QuickOpenGroupItemOptions = QuickOpenGroupItemOptions> extends QuickOpenItem<T> {

  getGroupLabel(): string | undefined {
    return this.options.groupLabel;
  }
  showBorder(): boolean {
    return this.options.showBorder || false;
  }
}

export interface QuickOpenModel {
  onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void): void;
}

export const QuickOpenService = Symbol('QuickOpenService');

export interface QuickOpenService {
  open(model: QuickOpenModel, options?: QuickOpenOptions): void;
}

export type QuickOpenOptions = Partial<QuickOpenOptions.Resolved>;
export namespace QuickOpenOptions {
  export interface Resolved {
    /**
     * 显示前缀
     */
    readonly prefix: string;
    /**
     * 占位符
     */
    readonly placeholder: string;
    /**
     * 关闭回调
     * @param canceled 是否是取消关闭
     */
    onClose(canceled: boolean): void;
    /**
     * 是否模糊匹配标签
     * 使用 vscode filter matchesFuzzy 方法
     */
    readonly fuzzyMatchLabel: boolean;
    /**
     * 是否模糊匹配详情
     * 使用 vscode filter matchesFuzzy 方法
     */
    readonly fuzzyMatchDetail: boolean;
    /**
     * 是否模糊匹配描述
     * 使用 vscode filter matchesFuzzy 方法
     */
    readonly fuzzyMatchDescription: boolean;
    /**
     * 是否模糊排序
     * 使用 vscode filter compareEntries 方法
     */
    readonly fuzzySort: boolean;
    /**
     * 前缀的截取长度
     */
    readonly skipPrefix: number;

    /**
     * 点击空白处是否收起 QuickOpen
     */
    readonly ignoreFocusOut: boolean;
  }
  export const defaultOptions: Resolved = Object.freeze({
    prefix: '',
    placeholder: '',
    onClose: () => { /* no-op*/ },
    fuzzyMatchLabel: false,
    fuzzyMatchDetail: false,
    fuzzyMatchDescription: false,
    fuzzySort: false,
    skipPrefix: 0,
    ignoreFocusOut: false,
  });
  export function resolve(options: QuickOpenOptions = {}, source: Resolved = defaultOptions): Resolved {
    return Object.assign({}, source, options);
  }
}

export interface QuickOpenGroupItemOptions extends QuickOpenItemOptions {
  groupLabel?: string;
  showBorder?: boolean;
}

export interface QuickPickItem<T> {
  label: string;
  value: T;
  description?: string;
  detail?: string;
  iconClass?: string;
}

// tslint:disable-next-line: no-empty-interface
export interface QuickPickOptions extends QuickOpenOptions {
}

export const QuickPickService = Symbol('QuickPickService');

export interface QuickPickService {
  show(elements: string[], options?: QuickPickOptions): Promise<string | undefined>;
  show<T>(elements: QuickPickItem<T>[], options?: QuickPickOptions): Promise<T | undefined>;
  show<T>(elements: (string | QuickPickItem<T>)[], options?: QuickPickOptions): Promise<T | string | undefined>;
}

export const PrefixQuickOpenService = Symbol('PrefixQuickOpenService');
export interface PrefixQuickOpenService {
  open(prefix: string): void;
}
