import { Injectable, Autowired } from '@opensumi/di';
import {
  ILogger,
  isOSX,
  Emitter,
  Event,
  CommandRegistry,
  ContributionProvider,
  IDisposable,
  Disposable,
  formatLocalize,
  CommandService,
  isUndefined,
} from '@opensumi/ide-core-common';
import { ContextKeyExpression } from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';

import { IContextKeyService } from '../context-key';
import { KeyboardLayoutService } from '../keyboard/keyboard-layout-service';
import { KeyCode, KeySequence, Key, SpecialCases } from '../keyboard/keys';
import { StatusBarAlignment, IStatusBarService } from '../services';

export enum KeybindingScope {
  DEFAULT,
  USER,
  WORKSPACE,
  END,
}

// ref: https://github.com/Microsoft/vscode/blob/97fc588e65bedcb1113baeddd2f67237e52c8c63/src/vs/platform/keybinding/common/keybindingsRegistry.ts#L56
// 快捷键第一优先级，将对该值 * 100 作为快捷键的优先级参数 priority
export enum KeybindingWeight {
  Default = 0, // 不传入 priority 则默认为 0
  EditorCore = 1,
  EditorContrib = 100,
  WorkbenchContrib = 200,
  BuiltinExtension = 300,
  ExternalExtension = 400,
}

export namespace KeybindingScope {
  export const length = KeybindingScope.END - KeybindingScope.DEFAULT;
}

export namespace Keybinding {
  /**
   * 返回带有绑定的字符串表达式
   * 仅序列化关键的快捷键及command
   * 在快捷时被使用
   *
   * @param binding 按键绑定的字符串表达式.
   */
  export function stringify(binding: Keybinding): string {
    const copy: Keybinding = {
      command: binding.command,
      keybinding: binding.keybinding,
    };
    return JSON.stringify(copy);
  }

  // 判断一个对象是否为Keybinding对象
  export function is(arg: Keybinding | any): arg is Keybinding {
    return !!arg && arg === Object(arg) && 'command' in arg && 'keybinding' in arg;
  }
}

export namespace KeybindingsResultCollection {
  export class KeybindingsResult {
    public full: Keybinding[] = [];
    public partial: Keybinding[] = [];
    public shadow: Keybinding[] = [];

    /**
     * 合并KeybindingsResult至this
     *
     * @param other
     * @return this
     */
    public merge(other: KeybindingsResult): KeybindingsResult {
      this.full.push(...other.full);
      this.partial.push(...other.partial);
      this.shadow.push(...other.shadow);
      return this;
    }

    /**
     * 返回一个新的过滤后的 KeybindingsResult
     *
     * @param fn 过滤函数
     * @return KeybindingsResult
     */
    public filter(fn: (binding: Keybinding) => boolean): KeybindingsResult {
      const result = new KeybindingsResult();
      result.full = this.full.filter(fn);
      result.partial = this.partial.filter(fn);
      result.shadow = this.shadow.filter(fn);
      return result;
    }
  }
}

export interface Keybinding {
  // 命令ID
  command: string;

  // 快捷键字符串
  keybinding: string;

  /**
   * https://code.visualstudio.com/docs/getstarted/keybindings#_when-clause-contexts
   */
  when?: string | ContextKeyExpression;

  // Command执行参数
  args?: any;

  // 快捷键匹配的优先级
  priority?: number;
}

export interface ResolvedKeybinding extends Keybinding {
  /**
   * KeyboardLayoutService会根据用户的键盘布局来转换keybinding得到最终在UI中使用的值
   * 如果尚未调用KeyboardLayoutService来解析键绑定，则该值为unfedined。
   */
  resolved?: KeySequence;
}

export interface ScopedKeybinding extends ResolvedKeybinding {
  scope?: KeybindingScope;
}

export const KeybindingContribution = Symbol('KeybindingContribution');

export interface KeybindingContribution {
  registerKeybindings(keybindings: KeybindingRegistry): void;
}

export const KeybindingRegistry = Symbol('KeybindingRegistry');
export interface KeybindingRegistry {
  initialize(): Promise<any>;
  registerKeybinding(binding: Keybinding, scope?: KeybindingScope): IDisposable;
  registerKeybindings(bindings: Keybinding[], scope?: KeybindingScope): IDisposable;
  unregisterKeybinding(keyOrBinding: Keybinding | string, scope?: KeybindingScope): void;
  resolveKeybinding(binding: ResolvedKeybinding): KeyCode[];
  containsKeybinding(bindings: Keybinding[], binding: Keybinding): boolean;
  containsKeybindingInScope(binding: Keybinding, scope?: KeybindingScope): boolean;
  validateKeybinding(bindings: Keybinding[], binding: Keybinding): string;
  validateKeybindingInScope(binding: Keybinding, scope?: KeybindingScope): string;
  acceleratorFor(keybinding: Keybinding, separator: string): string[];
  acceleratorForSequence(keySequence: KeySequence, separator: string): string[];
  acceleratorForKeyCode(keyCode: KeyCode, separator: string): string;
  acceleratorForKey(key: Key): string;
  acceleratorForKeyString(keyString: string, separator?: string): string;
  getKeybindingsForKeySequence(
    keySequence: KeySequence,
    event?: KeyboardEvent,
  ): KeybindingsResultCollection.KeybindingsResult;
  getKeybindingsForCommand(commandId: string): ScopedKeybinding[];
  getScopedKeybindingsForCommand(scope: KeybindingScope, commandId: string): Keybinding[];
  isEnabled(binding: Keybinding, event: KeyboardEvent): boolean;
  isPseudoCommand(commandId: string): boolean;
  resetKeybindings(): void;
  onKeybindingsChanged: Event<{ affectsCommands: string[] }>;
  getKeybindingByScope(scope: KeybindingScope): Keybinding[];
}

export const keybindingServicePath = '/services/keybindings';
export const KeybindingService = Symbol('KeybindingService');

export interface KeybindingService {
  /**
   * 根据传入的键盘事件执行对应的 Command
   */
  run(event: KeyboardEvent): void;
  /**
   * 根据传入的键盘事件处理对应的快捷键修饰符
   */
  resolveModifierKey(event: KeyboardEvent): void;
  /**
   * 根据传入的键盘事件返回对应的快捷键文本
   */
  convert(event: KeyboardEvent, separator?: string): string;

  /**
   * 清空键盘事件队列
   */
  clearConvert(): void;
  /**
   * 转化monaco传入的when为可识别的字符串
   * @param when
   */
  convertMonacoWhen(when: any): string;
}

@Injectable()
export class KeybindingRegistryImpl implements KeybindingRegistry, KeybindingService {
  // 该伪命令用于让事件冒泡，使事件不被Keybinding消费掉
  public static readonly PASSTHROUGH_PSEUDO_COMMAND = 'passthrough';
  protected readonly keymaps: Keybinding[][] = [...Array(KeybindingScope.length)].map(() => []);

  protected keySequence: KeySequence = [];
  private keySequenceTimer;

  protected convertKeySequence: KeySequence = [];

  protected modifierKeySequence: KeySequence = [];
  private modifierKeySequenceTimer;

  public static KEYSEQUENCE_TIMEOUT = 5000;
  public static MODIFIER_KEYSEQUENCE_TIMEOUT = 300;

  @Autowired(KeyboardLayoutService)
  protected readonly keyboardLayoutService: KeyboardLayoutService;

  @Autowired(KeybindingContribution)
  private readonly keybindingContributionProvider: ContributionProvider<KeybindingContribution>;

  @Autowired(CommandRegistry)
  protected readonly commandRegistry: CommandRegistry;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired(IContextKeyService)
  protected readonly whenContextService: IContextKeyService;

  @Autowired(IStatusBarService)
  protected readonly statusBar: IStatusBarService;

  public async initialize(): Promise<void> {
    await this.keyboardLayoutService.initialize();
    this.keyboardLayoutService.onKeyboardLayoutChanged(() => {
      this.clearResolvedKeybindings();
    });
    // 从模块中获取的KeybindingContribution
    for (const contribution of this.keybindingContributionProvider.getContributions()) {
      contribution.registerKeybindings(this);
    }
  }

  protected keybindingsChanged = new Emitter<{ affectsCommands: string[] }>();

  /**
   * 由于不同的键盘布局发生更改时触发的事件。
   */
  get onKeybindingsChanged() {
    return this.keybindingsChanged.event;
  }

  /**
   * 注册默认 Keybinding, 支持指定作用域
   * @param binding
   */
  public registerKeybinding(binding: Keybinding, scope: KeybindingScope = KeybindingScope.DEFAULT): IDisposable {
    return this.doRegisterKeybinding(binding, scope);
  }

  /**
   * 注册默认 Keybindings, 支持指定作用域
   * @param bindings
   */
  public registerKeybindings(bindings: Keybinding[], scope: KeybindingScope = KeybindingScope.DEFAULT): IDisposable {
    return this.doRegisterKeybindings(bindings, scope);
  }

  /**
   * 用于转换monaco内置的RawContextKey
   * @param when
   */
  public convertMonacoWhen(when: string | ContextKeyExpression | undefined) {
    if (!when) {
      return '';
    }
    if (typeof when === 'string') {
      return when;
    }
    return when.serialize();
  }

  /**
   * 注销 Keybinding
   * @param binding
   */
  public unregisterKeybinding(binding: Keybinding, scope?: KeybindingScope): void;
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  public unregisterKeybinding(key: string, scope?: KeybindingScope): void;
  public unregisterKeybinding(
    keyOrBinding: Keybinding | string,
    scope: KeybindingScope = KeybindingScope.DEFAULT,
  ): void {
    const key = Keybinding.is(keyOrBinding) ? keyOrBinding.keybinding : keyOrBinding;
    const keymap = this.keymaps[scope];
    let bindings;
    // 当传入的keybinding存在when条件时，严格匹配
    if (Keybinding.is(keyOrBinding) && !!keyOrBinding.when) {
      bindings = keymap.filter(
        (el) =>
          this.isKeybindingEqual(el.keybinding, keyOrBinding.keybinding) &&
          this.isKeybindingWhenEqual(el.when, keyOrBinding.when),
      );
    } else {
      bindings = keymap.filter((el) => this.isKeybindingEqual(el.keybinding, key));
    }
    bindings.forEach((binding) => {
      const idx = keymap.indexOf(binding);
      if (idx >= 0) {
        keymap.splice(idx, 1);
      }
    });
  }

  // 判断两个when是否相等
  private isKeybindingWhenEqual(when1?: string | ContextKeyExpression, when2?: string | ContextKeyExpression) {
    return this.convertMonacoWhen(when1) === this.convertMonacoWhen(when2);
  }

  // 判断两个快捷键是否相等
  // 如 ⌘ 默认等价于 cmd， ctrlcmd
  private isKeybindingEqual(preKeybinding: string, nextKeybinding: string) {
    return this.acceleratorForSequenceKeyString(preKeybinding) === this.acceleratorForSequenceKeyString(nextKeybinding);
  }

  // 解析快捷键字符串为统一的结果
  private acceleratorForSequenceKeyString(key: string) {
    const keyCodeStrings = key.split(' ');
    const keySequence: KeySequence = keyCodeStrings.map((key) => KeyCode.parse(key));
    return this.acceleratorForSequence(keySequence, '+').join(' ');
  }

  /**
   * 执行注册多个Keybinding
   * @param bindings
   * @param scope
   */
  protected doRegisterKeybindings(bindings: Keybinding[], scope: KeybindingScope = KeybindingScope.DEFAULT) {
    const toDispose = new Disposable();
    for (const binding of bindings) {
      toDispose.addDispose(this.doRegisterKeybinding(binding, scope));
    }
    return toDispose;
  }

  /**
   * 执行注册单个Keybinding
   * @param binding
   * @param scope
   */
  protected doRegisterKeybinding(binding: Keybinding, scope: KeybindingScope = KeybindingScope.DEFAULT): IDisposable {
    try {
      this.resolveKeybinding(binding, true);
      this.keymaps[scope].unshift(binding);
    } catch (error) {
      this.logger.warn(`Could not register keybinding:\n  ${Keybinding.stringify(binding)}\n${error}`);
    }

    this.keybindingsChanged.fire({ affectsCommands: [binding.command] });

    return {
      dispose: () => {
        this.unregisterKeybinding(binding, scope);
      },
    };
  }

  /**
   * 通过调用KeyboardLayoutService来设置给定的ResolvedKeybinding中的`resolved`属性。
   * @param binding
   */
  public resolveKeybinding(binding: ResolvedKeybinding, disableCache?: boolean): KeyCode[] {
    if (!binding.resolved || disableCache) {
      const sequence = KeySequence.parse(binding.keybinding);
      binding.resolved = sequence.map((code) => this.keyboardLayoutService.resolveKeyCode(code));
    }
    return binding.resolved;
  }

  /**
   * 清除已注册的Keybinding中所有`resolved`属性，以便调用KeyboardLayoutService再次为他们赋值
   * 当用户的键盘布局发生变化时，执行该方法
   */
  protected clearResolvedKeybindings(): void {
    for (let i = KeybindingScope.DEFAULT; i < KeybindingScope.END; i++) {
      const bindings = this.keymaps[i];
      for (const binding of bindings) {
        const bd: ResolvedKeybinding = binding;
        bd.resolved = undefined;
      }
    }
  }

  /**
   * 检查Keybindings列表中的keySequence冲突
   * @param bindings
   * @param binding
   */
  public containsKeybinding(bindings: Keybinding[], binding: Keybinding): boolean {
    const bindingKeySequence = this.resolveKeybinding(binding);
    const collisions = this.getKeySequenceCollisions(bindings, bindingKeySequence).filter(
      (b) => b.when === binding.when,
    );

    if (collisions.full.length > 0) {
      this.logger.warn(
        'Collided keybinding is ignored; ',
        Keybinding.stringify(binding),
        ' collided with ',
        collisions.full.map((b) => Keybinding.stringify(b)).join(', '),
      );
      return true;
    }
    if (collisions.partial.length > 0) {
      this.logger.warn(
        'Shadowing keybinding is ignored; ',
        Keybinding.stringify(binding),
        ' shadows ',
        collisions.partial.map((b) => Keybinding.stringify(b)).join(', '),
      );
      return true;
    }
    if (collisions.shadow.length > 0) {
      this.logger.warn(
        'Shadowed keybinding is ignored; ',
        Keybinding.stringify(binding),
        ' would be shadowed by ',
        collisions.shadow.map((b) => Keybinding.stringify(b)).join(', '),
      );
      return true;
    }
    return false;
  }

  /**
   * 检查Keybindings列表中的keySequence冲突
   * 直接返回错误信息，无错误则返回空字符串
   * @param bindings
   * @param binding
   */
  public validateKeybinding(bindings: Keybinding[], binding: Keybinding): string {
    const bindingKeySequence = this.resolveKeybinding(binding);
    const collisions = this.getKeySequenceCollisions(bindings, bindingKeySequence).filter(
      (b) => b.when === binding.when,
    );

    if (collisions.full.length > 0) {
      const collision = collisions.full[0];
      const command = this.commandRegistry.getCommand(collision.command);
      return formatLocalize(
        'keymaps.keybinding.full.collide',
        `${command ? command?.label || command.id : collision.command}${
          collision.when ? `{${collision.when}}` : collision.when
        }`,
      );
    }
    if (collisions.partial.length > 0) {
      const collision = collisions.partial[0];
      const command = this.commandRegistry.getCommand(collision.command);
      return formatLocalize(
        'keymaps.keybinding.partial.collide',
        `${command ? command?.label || command.id : collision.command}${
          collision.when ? `{${collision.when}}` : collision.when
        }`,
      );
    }
    if (collisions.shadow.length > 0) {
      const collision = collisions.shadow[0];
      const command = this.commandRegistry.getCommand(collision.command);
      return formatLocalize(
        'keymaps.keybinding.shadow.collide',
        `${command ? command?.label || command.id : collision.command}${
          collision.when ? `{${collision.when}}` : collision.when
        }`,
      );
    }
    return '';
  }

  /**
   * 检查在特定Scope下是否包含该Keybinding
   *
   * @param binding
   * @param scope
   */
  public containsKeybindingInScope(binding: Keybinding, scope: KeybindingScope = KeybindingScope.USER): boolean {
    return this.containsKeybinding(this.keymaps[scope], binding);
  }

  /**
   * 检查在特定Scope下是否包含该Keybinding
   * 返回冲突信息
   * 无冲突返回空字符串
   * @param binding
   * @param scope
   */
  public validateKeybindingInScope(binding: Keybinding, scope: KeybindingScope = KeybindingScope.USER): string {
    return this.validateKeybinding(this.keymaps[scope], binding);
  }

  /**
   * 返回用户可见的Keybinding数据
   * @param keybinding
   * @param separator
   */
  public acceleratorFor(keybinding: Keybinding, separator = ' '): string[] {
    const bindingKeySequence = this.resolveKeybinding(keybinding);
    return this.acceleratorForSequence(bindingKeySequence, separator);
  }

  /**
   * 从KeySequence中返回用户可见的Keybinding
   * @param keySequence
   * @param separator
   */
  public acceleratorForSequence(keySequence: KeySequence, separator = ' '): string[] {
    return keySequence.map((keyCode) => this.acceleratorForKeyCode(keyCode, separator));
  }

  public acceleratorForKeyString(keyString: string, separator = ' '): string {
    const keyCode = KeyCode.parse(keyString);
    return this.acceleratorForKeyCode(keyCode, separator);
  }

  /**
   * 将字符串转化为首字母大写
   * @param str 字符串
   */
  private capitalizeFirstLetter(str: string) {
    return str.replace(/^\S/, function (s) {
      return s.toUpperCase();
    });
  }

  /**
   * 返回用户可读的组合按键指令文本 （带修饰符）
   * @param keyCode
   * @param separator
   */
  public acceleratorForKeyCode(keyCode: KeyCode, separator = ' '): string {
    const keyCodeResult: string[] = [];
    if (keyCode.ctrl) {
      keyCodeResult.push(this.capitalizeFirstLetter(SpecialCases.CTRL));
    }
    if (keyCode.alt) {
      keyCodeResult.push(this.capitalizeFirstLetter(SpecialCases.ALT));
    }
    if (keyCode.shift) {
      keyCodeResult.push(this.capitalizeFirstLetter(SpecialCases.SHIFT));
    }
    if (keyCode.meta) {
      if (isOSX) {
        keyCodeResult.push(SpecialCases.MACMETA);
      } else {
        keyCodeResult.push(this.capitalizeFirstLetter(SpecialCases.META));
      }
    }
    if (keyCode.key) {
      keyCodeResult.push(this.acceleratorForKey(keyCode.key));
    }
    return keyCodeResult.join(separator);
  }

  /**
   * 根据Key返回可读文本
   * @param key
   */
  public acceleratorForKey(key: Key): string {
    if (isOSX) {
      if (key === Key.ARROW_LEFT) {
        return SpecialCases.ARROW_LEFT;
      }
      if (key === Key.ARROW_RIGHT) {
        return SpecialCases.ARROW_RIGHT;
      }
      if (key === Key.ARROW_UP) {
        return SpecialCases.ARROW_UP;
      }
      if (key === Key.ARROW_DOWN) {
        return SpecialCases.ARROW_DOWN;
      }
      if (key === Key.BACKSPACE) {
        return SpecialCases.BACKSPACE;
      }
      if (key === Key.ENTER) {
        return SpecialCases.ENTER;
      }
    }
    const keyString = this.keyboardLayoutService.getKeyboardCharacter(key);
    if (
      (key.keyCode >= Key.KEY_A.keyCode && key.keyCode <= Key.KEY_Z.keyCode) ||
      (key.keyCode >= Key.F1.keyCode && key.keyCode <= Key.F24.keyCode)
    ) {
      return keyString.toUpperCase();
    } else if (keyString.length > 1) {
      return keyString.charAt(0).toUpperCase() + keyString.slice(1);
    } else if (keyString === ' ') {
      // 空格需要额外使用特殊字符进行展示，否则直接输出 `' '` 会比较疑惑
      return SpecialCases.SPACE.charAt(0).toUpperCase() + SpecialCases.SPACE.slice(1);
    } else {
      return keyString;
    }
  }

  /**
   * 查找绑定列表中的键序列的冲突（无错误，是否冲突都会返回结果）
   * @param bindings
   * @param candidate
   */
  protected getKeySequenceCollisions(
    bindings: Keybinding[],
    candidate: KeySequence,
  ): KeybindingsResultCollection.KeybindingsResult {
    const result = new KeybindingsResultCollection.KeybindingsResult();
    for (const binding of bindings) {
      try {
        const bindingKeySequence = this.resolveKeybinding(binding);
        const compareResult = KeySequence.compare(candidate, bindingKeySequence);
        switch (compareResult) {
          case KeySequence.CompareResult.FULL: {
            result.full.push(binding);
            break;
          }
          case KeySequence.CompareResult.PARTIAL: {
            result.partial.push(binding);
            break;
          }
          case KeySequence.CompareResult.SHADOW: {
            result.shadow.push(binding);
            break;
          }
        }
      } catch (error) {
        this.logger.warn(error);
      }
    }
    return result;
  }

  /**
   * 获取与KeySequence完全匹配或部分匹配的键绑定列表
   * 列表按优先级排序 （见sortKeybindingsByPriority方法）
   * @param keySequence
   */
  public getKeybindingsForKeySequence(
    keySequence: KeySequence,
    event?: KeyboardEvent,
  ): KeybindingsResultCollection.KeybindingsResult {
    const result = new KeybindingsResultCollection.KeybindingsResult();

    for (let scope = KeybindingScope.END; --scope >= KeybindingScope.DEFAULT; ) {
      const matches = this.getKeySequenceCollisions(this.keymaps[scope], keySequence);

      matches.full = matches.full.sort(this.sortKeybindingsByPriority);
      matches.partial = matches.partial.sort(this.sortKeybindingsByPriority);

      result.merge(matches);
    }

    // 如果组合键不可用，去掉组合键的功能
    const partial = result.partial.filter((binding) => this.isEnabled(binding, event));
    result.partial = partial;
    return result;
  }

  /**
   * 获取与commandId相关联的键绑定
   * @param commandId
   */
  public getKeybindingsForCommand(commandId: string): ScopedKeybinding[] {
    const result: ScopedKeybinding[] = [];

    for (let scope = KeybindingScope.END - 1; scope >= KeybindingScope.DEFAULT; scope--) {
      this.keymaps[scope].forEach((binding) => {
        const command = this.commandRegistry.getCommand(binding.command);
        if (command) {
          if (command.id === commandId) {
            result.push({ ...binding, scope });
          }
        }
      });

      if (result.length > 0) {
        return result;
      }
    }
    return result;
  }

  /**
   * 返回在特定Scope下与commandId关联的键值对列表
   * @param scope
   * @param commandId
   */
  public getScopedKeybindingsForCommand(scope: KeybindingScope, commandId: string): Keybinding[] {
    const result: Keybinding[] = [];

    if (scope >= KeybindingScope.END) {
      return [];
    }

    this.keymaps[scope].forEach((binding) => {
      const command = this.commandRegistry.getCommand(binding.command);
      if (command && command.id === commandId) {
        result.push(binding);
      }
    });
    return result;
  }

  /**
   * 按优先级顺序对键值绑定进行排序
   *
   * 具有When判定的键绑定比没有的优先级更高
   * 当均具备 when 时，采用 priority 进行优先级判断
   * @param keybindings
   */
  private sortKeybindingsByPriority(a: Keybinding, b: Keybinding) {
    if (a.when && !b.when) {
      return -1;
    }
    if (!a.when && b.when) {
      return 1;
    }
    const compA = isUndefined(a.priority) ? KeybindingWeight.Default : a.priority;
    const compB = isUndefined(b.priority) ? KeybindingWeight.Default : b.priority;
    return compB - compA;
  }

  protected isActive(binding: Keybinding): boolean {
    // passthrough命令始终处于活动状态 （无法在命令注册表中找到））
    if (this.isPseudoCommand(binding.command)) {
      return true;
    }

    const command = this.commandRegistry.getCommand(binding.command);
    return !!command && !!this.commandRegistry.getActiveHandler(command.id);
  }

  /**
   * 只有在没有上下文（全局上下文）或者我们处于该上下文中时才执行
   * @param binding
   * @param event
   */
  public isEnabled(binding: Keybinding, event?: KeyboardEvent): boolean {
    if (binding.when && !this.whenContextService.match(binding.when, event && (event.target as HTMLElement))) {
      return false;
    }
    return true;
  }

  /**
   * 判断是否为PASSTHROUGH_PSEUDO_COMMAND
   * @param commandId
   */
  public isPseudoCommand(commandId: string): boolean {
    return commandId === KeybindingRegistryImpl.PASSTHROUGH_PSEUDO_COMMAND;
  }

  /**
   * 重置所有Scope下的键绑定（仅保留映射的默认键绑定）
   */
  public resetKeybindings(): void {
    for (let i = KeybindingScope.DEFAULT + 1; i < KeybindingScope.END; i++) {
      this.keymaps[i] = [];
    }
  }

  /**
   * 用于处理诸如 Shift + Shift, Ctrl + Ctrl, Alt + Alt 等快捷键
   * 参考： https://github.com/microsoft/vscode/pull/115190
   *
   * @param event 键盘事件
   */
  public resolveModifierKey(event: KeyboardEvent): void {
    if (event.defaultPrevented) {
      return;
    }
    if (this.modifierKeySequenceTimer) {
      clearTimeout(this.modifierKeySequenceTimer);
    }
    const keyCode = KeyCode.createKeyCode(event);
    // 当传入的 KeyCode 不是修饰符时，清空当前修饰符队列
    if (!keyCode.isModifierOnly()) {
      this.modifierKeySequence = [];
      return;
    }
    this.modifierKeySequence.push(keyCode);
    const bindings = this.getKeybindingsForKeySequence(this.modifierKeySequence, event);
    if (this.tryKeybindingExecution(bindings.full, event)) {
      this.modifierKeySequence = [];
    } else if (bindings.partial.length > 0) {
      // 堆积 modifierKeySequence, 用于实现组合键
      event.preventDefault();
      event.stopPropagation();
      this.modifierKeySequenceTimer = setTimeout(() => {
        this.modifierKeySequence = [];
      }, KeybindingRegistryImpl.MODIFIER_KEYSEQUENCE_TIMEOUT);
    } else {
      this.modifierKeySequence = [];
    }
  }

  /**
   * 执行匹配键盘事件的命令
   *
   * @param event 键盘事件
   */
  public run(event: KeyboardEvent): void {
    if (event.defaultPrevented) {
      return;
    }
    if (this.keySequenceTimer) {
      clearTimeout(this.keySequenceTimer);
    }
    const keyCode = KeyCode.createKeyCode(event);
    // 当传入的 KeyCode 仅为修饰符，忽略，等待下次输入
    if (keyCode.isModifierOnly()) {
      return;
    }
    this.keyboardLayoutService.validateKeyCode(keyCode);
    this.keySequence.push(keyCode);
    const bindings = this.getKeybindingsForKeySequence(this.keySequence, event);

    if (this.tryKeybindingExecution(bindings.full, event)) {
      this.keySequence = [];
      this.statusBar.removeElement('keybinding-status');
    } else if (bindings.partial.length > 0) {
      // 堆积keySequence, 用于实现组合键
      event.preventDefault();
      event.stopPropagation();

      this.statusBar.addElement('keybinding-status', {
        text: formatLocalize('keybinding.combination.tip', this.acceleratorForSequence(this.keySequence, '+')),
        alignment: StatusBarAlignment.LEFT,
        priority: 2,
      });
      this.keySequenceTimer = setTimeout(() => {
        this.keySequence = [];
        this.statusBar.removeElement('keybinding-status');
      }, KeybindingRegistryImpl.KEYSEQUENCE_TIMEOUT);
    } else {
      this.keySequence = [];
      this.statusBar.removeElement('keybinding-status');
    }
  }

  /**
   * 返回快捷键文本
   *
   * @param event 键盘事件
   */
  public convert(event: KeyboardEvent, separator = ' '): string {
    const keyCode = KeyCode.createKeyCode(event);

    // 当传入的Keycode仅为修饰符，返回上次输出结果
    if (keyCode.isModifierOnly()) {
      return this.acceleratorForSequence(this.convertKeySequence, '+').join(separator);
    }
    this.keyboardLayoutService.validateKeyCode(keyCode);
    if (this.convertKeySequence.length <= 1) {
      this.convertKeySequence.push(keyCode);
    } else {
      this.convertKeySequence = [keyCode];
    }
    return this.acceleratorForSequence(this.convertKeySequence, '+').join(separator);
  }

  /**
   * 清空键盘事件队列
   */
  public clearConvert() {
    this.convertKeySequence = [];
  }

  /**
   * 尝试执行Keybinding
   * @param bindings
   * @param event
   * @return 命令执行成功时返回true，否则为false
   */
  protected tryKeybindingExecution(bindings: Keybinding[], event: KeyboardEvent): boolean {
    if (bindings.length === 0) {
      return false;
    }
    for (const binding of bindings) {
      if (this.isEnabled(binding, event)) {
        if (this.isPseudoCommand(binding.command)) {
          // 让事件冒泡
          return true;
        } else {
          const command = this.commandRegistry.getCommand(binding.command);
          if (command) {
            this.commandService
              .executeCommand(command.id, binding.args)
              .catch((err) => this.logger.error('Failed to execute command:', err, binding.command));
            /* 如果键绑定在上下文中但命令是可用状态下我们仍然在这里停止处理  */
            event.preventDefault();
            event.stopPropagation();
            return true;
          }
        }
        return false;
      }
    }
    return false;
  }

  getKeybindingByScope(scope: KeybindingScope) {
    return this.keymaps[scope];
  }
}

export const NO_KEYBINDING_NAME = 'no_keybinding';
