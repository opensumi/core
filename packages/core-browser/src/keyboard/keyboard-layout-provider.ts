import { Injectable, Autowired } from '@opensumi/di';
import { isOSX, Emitter, Deferred, ILogger, isWindows } from '@opensumi/ide-core-common';
import {
  KeyboardNativeLayoutService,
  KeyboardLayoutChangeNotifierService,
  KeyValidationInput,
  IKeymapInfo,
  ILinuxKeyboardLayoutInfo,
  IMacKeyboardLayoutInfo,
  KeymapInfo,
  getKeyboardLayoutId,
} from '@opensumi/ide-core-common/lib/keyboard';

import { GlobalBrowserStorageService } from '../services';

import { KeyCode } from './keys';
import { KeyboardLayoutContribution, requireRegister } from './layouts/layout.contribution';

export const KeyValidator = Symbol('KeyValidator');

export interface KeyValidator {
  validateKeyCode(keyCode: KeyCode): void;
}

export type KeyboardLayoutSource = 'navigator.keyboard' | 'user-choice' | 'pressed-keys';

@Injectable()
export class BrowserKeyboardLayoutImpl
  implements KeyboardNativeLayoutService, KeyboardLayoutChangeNotifierService, KeyValidator
{
  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired(GlobalBrowserStorageService)
  private readonly browserStorageService: GlobalBrowserStorageService;

  protected readonly initialized = new Deferred<void>();
  protected readonly nativeLayoutChanged = new Emitter<KeymapInfo>();

  get onDidChangeNativeLayout() {
    return this.nativeLayoutChanged.event;
  }

  protected readonly tester = new KeyboardTester();
  protected source: KeyboardLayoutSource = 'pressed-keys';
  protected currentLayout: KeymapInfo | null;

  get allLayoutData() {
    return this.tester.keymapInfos.slice();
  }

  get currentLayoutData() {
    return this.currentLayout;
  }

  get currentLayoutSource() {
    return this.source;
  }

  constructor() {
    this.initialize();
  }

  get whenReady() {
    return this.initialized.promise;
  }

  protected async initialize(): Promise<void> {
    this.loadState();
    const keyboard = (navigator as NavigatorExtension).keyboard;
    if (keyboard && keyboard.addEventListener) {
      keyboard.addEventListener('layoutchange', async () => {
        const newLayout = await this.getNativeLayout();
        if (newLayout) {
          this.nativeLayoutChanged.fire(newLayout);
        }
      });
    }
    this.initialized.resolve();
  }

  /**
   * 获取当前合适的用户键盘布局
   * 用户选择或是自动检测
   */
  async getNativeLayout(): Promise<KeymapInfo | void> {
    await this.whenReady;
    if (this.source === 'user-choice' && this.currentLayout) {
      return this.currentLayout;
    }
    const [layout, source] = await this.autodetect();
    if (layout) {
      this.setCurrent(layout, source);
      return layout;
    }
  }

  /**
   * 设置 user-choice 的键盘数据
   */
  async setLayoutData(layout: KeymapInfo | 'autodetect'): Promise<KeymapInfo | null> {
    if (layout === 'autodetect') {
      if (this.source === 'user-choice') {
        const [newLayout, source] = await this.autodetect();
        if (newLayout) {
          this.setCurrent(newLayout, source);
          this.nativeLayoutChanged.fire(newLayout);
          return newLayout;
        }
      }
      return this.currentLayout;
    } else {
      if (this.source !== 'user-choice' || layout !== this.currentLayout) {
        this.setCurrent(layout, 'user-choice');
        this.nativeLayoutChanged.fire(layout);
      }
      return layout;
    }
  }

  /**
   * 将 KeyCode 校验转化为 KeyValidationInput 校验
   */
  validateKeyCode(keyCode: KeyCode): void {
    if (keyCode.key && keyCode.character) {
      this.validateKey({
        code: keyCode.key.code,
        character: keyCode.character,
        shiftKey: keyCode.shift,
        ctrlKey: keyCode.ctrl,
        altKey: keyCode.alt,
      });
    }
  }

  /**
   * 使用给定的按键组合和键来测试所有已知的键盘布局所产生的字符。
   * 匹配度越高得分越高可参考（KeyboardTester实现）。
   * 如果得分最高的键盘布局发生改吧，触发键盘布局变化事件。
   */
  private validateKey(keyCode: KeyValidationInput): void {
    if (this.source !== 'pressed-keys') {
      return;
    }
    const accepted = this.tester.updateScores(keyCode);
    if (!accepted) {
      return;
    }
    const layout = this.selectLayout();
    if (layout && layout !== this.currentLayout) {
      this.setCurrent(layout, 'pressed-keys');
      this.nativeLayoutChanged.fire(layout);
    }
  }

  protected setCurrent(layout: KeymapInfo, source: KeyboardLayoutSource): void {
    this.currentLayout = layout;
    this.source = source;
    this.saveState();
    if (this.tester.inputCount && (source === 'pressed-keys' || source === 'navigator.keyboard')) {
      const from = source === 'pressed-keys' ? 'pressed keys' : 'browser API';
      this.logger.debug(`Detected keyboard layout from ${from}: ${JSON.stringify(layout.layout)}`);
    }
  }

  protected async autodetect(): Promise<[KeymapInfo | null, KeyboardLayoutSource]> {
    const keyboard = (navigator as NavigatorExtension).keyboard;
    if (keyboard && keyboard.getLayoutMap) {
      try {
        const layoutMap = await keyboard.getLayoutMap();
        this.testLayoutMap(layoutMap);
        return [this.selectLayout(), 'navigator.keyboard'];
      } catch (error) {
        this.logger.warn('Failed to obtain keyboard layout map.', error);
      }
    }
    return [this.selectLayout(), 'pressed-keys'];
  }

  /**
   * @param layoutMap a keyboard layout map according to https://wicg.github.io/keyboard-map/
   */
  protected testLayoutMap(layoutMap: KeyboardLayoutMap): void {
    this.tester.reset();
    for (const [code, key] of layoutMap.entries()) {
      this.tester.updateScores({ code, character: key });
    }
  }

  /**
   * 根据当前检测到的语言 navigator.language
   * 及浏览器中获取到的操作系统信息选择合适的键盘布局
   */
  protected selectLayout(): KeymapInfo | null {
    const keymapInfos = this.tester.keymapInfos;
    const scores = this.tester.scores;
    const topScore = this.tester.topScore;
    const language = navigator.language;
    let topScoringCount = 0;
    for (let i = 0; i < keymapInfos.length; i++) {
      if (scores[i] === topScore) {
        const candidate = keymapInfos[i];
        if (isOSX) {
          if (language && language.startsWith((candidate.layout as IMacKeyboardLayoutInfo).lang)) {
            return candidate;
          }
        } else if (!isWindows) {
          // windows 环境不需要考虑
          if (language && language.startsWith((candidate.layout as ILinuxKeyboardLayoutInfo).layout)) {
            return candidate;
          }
        }
        topScoringCount++;
      }
    }
    if (topScoringCount >= 1) {
      return keymapInfos.find((_, i) => scores[i] === topScore)!;
    }
    return this.tester.getUSStandardLayout();
  }

  protected saveState(): void {
    const data: LayoutProviderState = {
      tester: this.tester.getState(),
      source: this.source,
      currentLayoutId: this.currentLayout ? getKeyboardLayoutId(this.currentLayout?.layout) : undefined,
    };
    // 全局只需要共用一份存储即可
    return this.browserStorageService.setData('keyboard', data);
  }

  protected loadState() {
    const data = this.browserStorageService.getData<LayoutProviderState>('keyboard');
    if (data) {
      this.tester.setState(data.tester || {});
      this.source = data.source || 'pressed-keys';
      if (data.currentLayoutId) {
        const layout = this.tester.keymapInfos.find((c) => getKeyboardLayoutId(c.layout) === data.currentLayoutId);
        if (layout) {
          this.currentLayout = layout;
        }
      } else {
        this.currentLayout = this.tester.getUSStandardLayout();
      }
    }
  }
}

export interface LayoutProviderState {
  tester?: KeyboardTesterState;
  source?: KeyboardLayoutSource;
  currentLayoutId?: string;
}

export interface KeyboardTesterState {
  scores?: { [id: string]: number };
  topScore?: number;
  testedInputs?: { [key: string]: string };
}

/**
 * 通过对比用户输入 Key Codes 得到的解析结果，处理所有已知键盘布局分数
 */
export class KeyboardTester {
  readonly scores: number[];
  topScore = 0;

  private readonly testedInputs = new Map<string, string>();

  private _keymapInfos: KeymapInfo[] = [];
  protected readonly initialized = new Deferred();

  get inputCount() {
    return this.testedInputs.size;
  }

  get keymapInfos() {
    return this._keymapInfos;
  }

  constructor() {
    requireRegister();
    const keymapInfos: IKeymapInfo[] = KeyboardLayoutContribution.INSTANCE.layoutInfos;
    this._keymapInfos.push(
      ...keymapInfos.map(
        (info) => new KeymapInfo(info.layout, info.secondaryLayouts, info.mapping, info.isUserKeyboardLayout),
      ),
    );
    this.initialized.resolve(true);
    this.scores = this.keymapInfos.map(() => 0);
  }

  reset(): void {
    for (let i = 0; i < this.scores.length; i++) {
      this.scores[i] = 0;
    }
    this.topScore = 0;
    this.testedInputs.clear();
  }

  updateScores(input: KeyValidationInput): boolean {
    let property: 'value' | 'withShift' | 'withAltGr' | 'withShiftAltGr';
    if (input.shiftKey && input.altKey) {
      property = 'withShiftAltGr';
    } else if (input.shiftKey) {
      property = 'withShift';
    } else if (input.altKey) {
      property = 'withAltGr';
    } else {
      property = 'value';
    }
    const inputKey = `${input.code}.${property}`;
    if (this.testedInputs.has(inputKey)) {
      if (this.testedInputs.get(inputKey) === input.character) {
        return false;
      } else {
        /**
         * 相同的按键输入输出了不同的字符
         * 可能发生了键盘布局变化，重置所有计算后的分数
         */
        this.reset();
      }
    }

    const scores = this.scores;
    for (let i = 0; i < this.keymapInfos.length; i++) {
      scores[i] += this.testCandidate(this.keymapInfos[i], input, property);
      if (scores[i] > this.topScore) {
        this.topScore = scores[i];
      }
    }
    this.testedInputs.set(inputKey, input.character);
    return true;
  }

  protected testCandidate(
    candidate: KeymapInfo,
    input: KeyValidationInput,
    property: 'value' | 'withShift' | 'withAltGr' | 'withShiftAltGr',
  ): number {
    const keyMapping = candidate.mapping[input.code];
    if (keyMapping && keyMapping[property]) {
      return keyMapping[property] === input.character ? 1 : 0;
    } else {
      return 0;
    }
  }

  getState(): KeyboardTesterState {
    const scores: { [id: string]: number } = {};
    for (let i = 0; i < this.scores.length; i++) {
      scores[getKeyboardLayoutId(this.keymapInfos[i].layout)] = this.scores[i];
    }
    const testedInputs: { [key: string]: string } = {};
    for (const [key, character] of this.testedInputs.entries()) {
      testedInputs[key] = character;
    }
    return {
      scores,
      topScore: this.topScore,
      testedInputs,
    };
  }

  setState(state: KeyboardTesterState): void {
    this.reset();
    if (state.scores) {
      const layoutIds = this.keymapInfos.map((info) => getKeyboardLayoutId(info.layout));
      for (const id in state.scores) {
        if (state.scores.hasOwnProperty(id)) {
          const index = layoutIds.indexOf(id);
          if (index > 0) {
            this.scores[index] = state.scores[id];
          }
        }
      }
    }
    if (state.topScore) {
      this.topScore = state.topScore;
    }
    if (state.testedInputs) {
      for (const key in state.testedInputs) {
        if (state.testedInputs.hasOwnProperty(key)) {
          this.testedInputs.set(key, state.testedInputs[key]);
        }
      }
    }
  }

  getUSStandardLayout() {
    const usStandardLayouts = this.keymapInfos.filter((layout) => layout.layout.isUSStandard);

    if (usStandardLayouts.length) {
      return usStandardLayouts[0];
    }
    return null;
  }
}

/**
 * API specified by https://wicg.github.io/keyboard-map/
 */
interface NavigatorExtension extends Navigator {
  keyboard: Keyboard;
}

interface Keyboard {
  getLayoutMap(): Promise<KeyboardLayoutMap>;
  addEventListener(type: 'layoutchange', listener: EventListenerOrEventListenerObject): void;
}

type KeyboardLayoutMap = Map<string, string>;
