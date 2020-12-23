// 快捷键相关功能为纯前端模块，这里直接从browser引入定义
import { Keybinding } from '@ali/ide-core-browser';

export const IKeymapService = Symbol('IKeymapService');

export interface KeybindingItem {
  id: string;
  /**
   * 命令ID
   */
  command: string;
  /**
   * 快捷键
   */
  keybinding?: string;
  /**
   * When条件语句
   */
  when?: string;
  /**
   * Context条件语句
   */
  context?: string;
  /**
   * 作用域
   */
  source?: string;
  /**
   * 判断快捷键是否带有command label
   */
  hasCommandLabel?: boolean;
}

export interface IKeymapService {
  /**
   * 初始化快捷键注册信息
   */
  init(): Promise<void>;
  /**
   * 设置快捷键
   * @param {Keybinding} keybinding
   * @returns {Promise<void>}
   * @memberof KeymapsService
   */
  setKeybinding(keybinding: Keybinding): void;

  /**
   * 移除给定ID的快捷键绑定
   * @param {Keybinding} keybinding
   * @returns {Promise<void>}
   * @memberof KeymapsService
   */
  resetKeybinding(keybinding: Keybinding): Promise<void>;

  /**
   * 从keymaps.json获取快捷键列表
   * @returns {Promise<KeybindingJson[]>}
   * @memberof KeymapsService
   */
  getKeybindings(): Promise<Keybinding[]>;

  /**
   * 打开快捷键面板
   * @returns {Promise<void>}
   * @memberof IKeymapService
   */
  open(): Promise<void>;

  /**
   * 固定快捷键面板
   * @returns {Promise<void>}
   * @memberof IKeymapService
   */
  fixed(): Promise<void>;

  /**
   * 打开快捷键源文件 keymaps.json
   * @returns {Promise<void>}
   * @memberof IKeymapService
   */
  openResource(): Promise<void>;
}
