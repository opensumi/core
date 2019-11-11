import { Injectable, Autowired } from '@ali/common-di';
import { isOSX, Emitter, Event, CommandRegistry, ContributionProvider, IDisposable, Disposable, formatLocalize } from '@ali/ide-core-common';
import { KeyCode, KeySequence, Key } from '../keyboard/keys';
import { KeyboardLayoutService } from '../keyboard/keyboard-layout-service';
import { Logger } from '../logger';
import { IContextKeyService } from '../context-key';
import { StatusBarAlignment, IStatusBarService } from '../services';

export enum KeybindingScope {
  DEFAULT,
  USER,
  WORKSPACE,
  END,
}

export namespace KeybindingScope {
  export const length = KeybindingScope.END - KeybindingScope.DEFAULT;
}

export namespace Keybinding {

  /**
   * 返回带有绑定的字符串表达式
   * 缺省值将会被忽略
   *
   * @param binding 按键绑定的字符串表达式.
   */
  export function stringify(binding: Keybinding): string {
    const copy: Keybinding = {
      command: binding.command,
      keybinding: binding.keybinding,
      context: binding.context,
    };
    return JSON.stringify(copy);
  }

  // 判断一个对象是否为Keybinding对象
  export function is(arg: Keybinding | any): arg is Keybinding {
    return !!arg && arg === Object(arg) && 'command' in arg && 'keybinding' in arg;
  }
}

export namespace KeybindingContexts {

  export const NOOP_CONTEXT: KeybindingContext = {
    id: 'noop.keybinding.context',
    isEnabled: () => true,
  };

  export const DEFAULT_CONTEXT: KeybindingContext = {
    id: 'default.keybinding.context',
    isEnabled: () => false,
  };
}

export namespace KeybindingsResultCollection {
  export class KeybindingsResult {
    full: Keybinding[] = [];
    partial: Keybinding[] = [];
    shadow: Keybinding[] = [];

    /**
     * 合并KeybindingsResult至this
     *
     * @param other
     * @return this
     */
    merge(other: KeybindingsResult): KeybindingsResult {
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
    filter(fn: (binding: Keybinding) => boolean): KeybindingsResult {
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

  // 指定执行快捷键的上下文环境
  context?: string;

  /**
   * https://code.visualstudio.com/docs/getstarted/keybindings#_when-clause-contexts
   */
  when?: string | IContextKeyExpr;

  // Command执行参数
  args?: any;
}

export interface IContextKeyExpr {
  evaluate(context?: any): boolean;
  keys(): string[];
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

export const KeybindingContext = Symbol('KeybindingContext');
export interface KeybindingContext {

  readonly id: string;

  isEnabled(arg: Keybinding): boolean;
}

export const KeybindingRegistry = Symbol('KeybindingRegistry');
export interface KeybindingRegistry {
  onStart(): Promise<any>;
  registerKeybinding(binding: Keybinding): IDisposable;
  registerKeybindings(...bindings: Keybinding[]): IDisposable;
  unregisterKeybinding(keyOrBinding: Keybinding | string, scope?: KeybindingScope): void;
  resolveKeybinding(binding: ResolvedKeybinding): KeyCode[];
  containsKeybinding(bindings: Keybinding[], binding: Keybinding): boolean;
  containsKeybindingInScope(binding: Keybinding, scope?: KeybindingScope): boolean;
  acceleratorFor(keybinding: Keybinding, separator: string): string[];
  acceleratorForSequence(keySequence: KeySequence, separator: string): string[];
  acceleratorForKeyCode(keyCode: KeyCode, separator: string): string;
  acceleratorForKey(key: Key): string;
  getKeybindingsForKeySequence(keySequence: KeySequence, event: KeyboardEvent): KeybindingsResultCollection.KeybindingsResult;
  getKeybindingsForCommand(commandId: string): ScopedKeybinding[];
  getScopedKeybindingsForCommand(scope: KeybindingScope, commandId: string): Keybinding[];
  isEnabled(binding: Keybinding, event: KeyboardEvent): boolean;
  isPseudoCommand(commandId: string): boolean;
  setKeymap(scope: KeybindingScope, bindings: Keybinding[]): void;
  resetKeybindingsForScope(scope: KeybindingScope): void;
  resetKeybindings(): void;
  onKeybindingsChanged: Event<{ affectsCommands: string[] }>;
}

export const keybindingServicePath = '/services/keybindings';
export const KeybindingService = Symbol('KeybindingService');

export interface KeybindingService {
  /**
   * 根据传入的键盘事件执行对应的Command
   */
  run(event: KeyboardEvent): void;

  /**
   * 根据传入的键盘事件返回对应的快捷键文本
   */
  convert(event: KeyboardEvent, separator: string): string;

  /**
   * 清空键盘事件队列
   */
  clearConvert(): void;
}

@Injectable()
export class KeybindingRegistryImpl implements KeybindingRegistry, KeybindingService {

  // 该伪命令用于让事件冒泡，使事件不被Keybinding消费掉
  static readonly PASSTHROUGH_PSEUDO_COMMAND = 'passthrough';
  protected readonly contexts: { [id: string]: KeybindingContext } = {};
  protected readonly keymaps: Keybinding[][] = [...Array(KeybindingScope.length)].map(() => []);

  protected keySequence: KeySequence = [];
  protected convertKeySequence: KeySequence = [];

  private keySequenceTimer: any;

  static KEYSEQUENCE_TIMEOUT = 5000;

  @Autowired(KeyboardLayoutService)
  protected readonly keyboardLayoutService: KeyboardLayoutService;

  @Autowired(KeybindingContribution)
  private readonly keybindingContributionProvider: ContributionProvider<KeybindingContribution>;

  @Autowired(KeybindingContext)
  private readonly keybindingContextContributionProvider: ContributionProvider<KeybindingContext>;

  @Autowired(CommandRegistry)
  protected readonly commandRegistry: CommandRegistry;

  @Autowired(Logger)
  protected readonly logger: Logger;

  @Autowired(IContextKeyService)
  protected readonly whenContextService: IContextKeyService;

  @Autowired(IStatusBarService)
  protected readonly statusBar: IStatusBarService;

  async onStart(): Promise<void> {
    await this.keyboardLayoutService.initialize();
    this.keyboardLayoutService.onKeyboardLayoutChanged((newLayout) => {
      this.clearResolvedKeybindings();
      // this.keybindingsChanged.fire([]); // TODO 暂时不会改keyboard布局
    });
    this.registerContext(KeybindingContexts.NOOP_CONTEXT);
    this.registerContext(KeybindingContexts.DEFAULT_CONTEXT);
    // 获取所有模块中注册的KeybindingContext进行注册
    this.registerContext(...this.keybindingContextContributionProvider.getContributions());
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
   * 往应用注册Keybinding Context参数
   * 当该参数已被注册时不会重复注册
   * @param contexts 注册进应用的Keybinding Contexts.
   */
  protected registerContext(...contexts: KeybindingContext[]) {
    for (const context of contexts) {
      const { id } = context;
      if (this.contexts[id]) {
        this.logger.error(`A keybinding context with ID ${id} is already registered.`);
      } else {
        this.contexts[id] = context;
      }
    }
  }

  /**
   * 注册默认 Keybinding
   * @param binding
   */
  registerKeybinding(binding: Keybinding): IDisposable {
    return this.doRegisterKeybinding(binding, KeybindingScope.DEFAULT);
  }

  /**
   * 注册默认 Keybindings
   * @param bindings
   */
  registerKeybindings(...bindings: Keybinding[]): IDisposable {
    return this.doRegisterKeybindings(bindings, KeybindingScope.DEFAULT);
  }

  /**
   * 注销 Keybinding
   * @param binding
   */
  unregisterKeybinding(binding: Keybinding, scope?: KeybindingScope): void;
  // tslint:disable-next-line:unified-signatures
  unregisterKeybinding(key: string, scope?: KeybindingScope): void;
  unregisterKeybinding(keyOrBinding: Keybinding | string, scope: KeybindingScope = KeybindingScope.DEFAULT): void {
    const key = Keybinding.is(keyOrBinding) ? keyOrBinding.keybinding : keyOrBinding;
    const keymap = this.keymaps[scope];
    const bindings = keymap.filter((el) => el.keybinding === key);

    bindings.forEach((binding) => {
      const idx = keymap.indexOf(binding);
      if (idx >= 0) {
        keymap.splice(idx, 1);
      }
    });
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
      this.resolveKeybinding(binding);
      this.keymaps[scope].push(binding);
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
  resolveKeybinding(binding: ResolvedKeybinding): KeyCode[] {
    if (!binding.resolved) {
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
  containsKeybinding(bindings: Keybinding[], binding: Keybinding): boolean {
    const bindingKeySequence = this.resolveKeybinding(binding);
    const collisions = this.getKeySequenceCollisions(bindings, bindingKeySequence)
      .filter((b) => b.context === binding.context || b.when === binding.when);

    if (collisions.full.length > 0) {
      this.logger.warn('Collided keybinding is ignored; ',
        Keybinding.stringify(binding), ' collided with ',
        collisions.full.map((b) => Keybinding.stringify(b)).join(', '));
      return true;
    }
    if (collisions.partial.length > 0) {
      this.logger.warn('Shadowing keybinding is ignored; ',
        Keybinding.stringify(binding), ' shadows ',
        collisions.partial.map((b) => Keybinding.stringify(b)).join(', '));
      return true;
    }
    if (collisions.shadow.length > 0) {
      this.logger.warn('Shadowed keybinding is ignored; ',
        Keybinding.stringify(binding), ' would be shadowed by ',
        collisions.shadow.map((b) => Keybinding.stringify(b)).join(', '));
      return true;
    }
    return false;
  }

  /**
   * 检查在特定Scope下是否包含该Keybinding
   * @param binding
   * @param scope
   */
  containsKeybindingInScope(binding: Keybinding, scope: KeybindingScope = KeybindingScope.USER): boolean {
    return this.containsKeybinding(this.keymaps[scope], binding);
  }

  /**
   * 返回用户可见的Keybinding数据
   * @param keybinding
   * @param separator
   */
  acceleratorFor(keybinding: Keybinding, separator: string = ' '): string[] {
    const bindingKeySequence = this.resolveKeybinding(keybinding);
    return this.acceleratorForSequence(bindingKeySequence, separator);
  }

  /**
   * 从KeySequence中返回用户可见的Keybinding
   * @param keySequence
   * @param separator
   */
  acceleratorForSequence(keySequence: KeySequence, separator: string = ' '): string[] {
    return keySequence.map((keyCode) => this.acceleratorForKeyCode(keyCode, separator));
  }

  /**
   * 返回用户可读的组合按键指令文本 （带修饰符）
   * @param keyCode
   * @param separator
   */
  acceleratorForKeyCode(keyCode: KeyCode, separator: string = ' '): string {
    const keyCodeResult: any[] = [];
    if (keyCode.meta && isOSX) {
      keyCodeResult.push('⌘');
    }
    if (keyCode.ctrl) {
      keyCodeResult.push('⌃');
    }
    if (keyCode.alt) {
      keyCodeResult.push('⌥');
    }
    if (keyCode.shift) {
      keyCodeResult.push('⇧');
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
  acceleratorForKey(key: Key): string {
    if (isOSX) {
      if (key === Key.ARROW_LEFT) {
        return '←';
      }
      if (key === Key.ARROW_RIGHT) {
        return '→';
      }
      if (key === Key.ARROW_UP) {
        return '↑';
      }
      if (key === Key.ARROW_DOWN) {
        return '↓';
      }
      if (key === Key.BACKSPACE) {
        return '⌫';
      }
      if (key === Key.ENTER) {
        return '⏎';
      }
    }
    const keyString = this.keyboardLayoutService.getKeyboardCharacter(key);
    if (key.keyCode >= Key.KEY_A.keyCode && key.keyCode <= Key.KEY_Z.keyCode ||
      key.keyCode >= Key.F1.keyCode && key.keyCode <= Key.F24.keyCode) {
      return keyString.toUpperCase();
    } else if (keyString.length > 1) {
      return keyString.charAt(0).toUpperCase() + keyString.slice(1);
    } else {
      return keyString;
    }
  }

  /**
   * 在绑定列表中查找绑定冲突 （无错误，是否冲突都会返回结果）
   * @param bindings
   * @param binding
   */
  protected getKeybindingCollisions(bindings: Keybinding[], binding: Keybinding): KeybindingsResultCollection.KeybindingsResult {
    const result = new KeybindingsResultCollection.KeybindingsResult();
    try {
      const bindingKeySequence = this.resolveKeybinding(binding);
      result.merge(this.getKeySequenceCollisions(bindings, bindingKeySequence));
    } catch (error) {
      this.logger.warn(error);
    }
    return result;
  }

  /**
   * 查找绑定列表中的键序列的冲突（无错误，是否冲突都会返回结果）
   * @param bindings
   * @param candidate
   */
  protected getKeySequenceCollisions(bindings: Keybinding[], candidate: KeySequence): KeybindingsResultCollection.KeybindingsResult {
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
  getKeybindingsForKeySequence(keySequence: KeySequence, event: KeyboardEvent): KeybindingsResultCollection.KeybindingsResult {
    const result = new KeybindingsResultCollection.KeybindingsResult();

    for (let scope = KeybindingScope.END; --scope >= KeybindingScope.DEFAULT;) {
      const matches = this.getKeySequenceCollisions(this.keymaps[scope], keySequence);

      matches.full = matches.full.filter(
        (binding) => this.getKeybindingCollisions(result.full, binding).full.length === 0);
      matches.partial = matches.partial.filter(
        (binding) => this.getKeybindingCollisions(result.partial, binding).partial.length === 0);

      result.merge(matches);
    }
    this.sortKeybindingsByPriority(result.full);
    this.sortKeybindingsByPriority(result.partial);

    // 如果组合键不可用，去掉组合键的功能
    const partial = result.partial.filter((binding) => this.isEnabled(binding, event));
    result.partial = partial;
    return result;
  }

  /**
   * 获取与commandId相关联的键绑定
   * @param commandId
   */
  getKeybindingsForCommand(commandId: string): ScopedKeybinding[] {
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
  getScopedKeybindingsForCommand(scope: KeybindingScope, commandId: string): Keybinding[] {
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
   * 具有Context判定的键绑定比没有的优先级更高
   * @param keybindings
   */
  private sortKeybindingsByPriority(keybindings: Keybinding[]) {
    keybindings.sort((a: Keybinding, b: Keybinding): number => {

      let acontext: KeybindingContext | undefined;
      if (a.context) {
        acontext = this.contexts[a.context];
      }

      let bcontext: KeybindingContext | undefined;
      if (b.context) {
        bcontext = this.contexts[b.context];
      }

      if (acontext && !bcontext) {
        return -1;
      }

      if (!acontext && bcontext) {
        return 1;
      }

      return 0;
    });
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
  isEnabled(binding: Keybinding, event: KeyboardEvent): boolean {
    const context = binding.context && this.contexts[binding.context];
    if (context && !context.isEnabled(binding)) {
      return false;
    }
    if (binding.when && !this.whenContextService.match(binding.when, event.target as HTMLElement)) {
      return false;
    }
    return true;
  }

  /**
   * 判断是否为PASSTHROUGH_PSEUDO_COMMAND
   * @param commandId
   */
  isPseudoCommand(commandId: string): boolean {
    return commandId === KeybindingRegistryImpl.PASSTHROUGH_PSEUDO_COMMAND;
  }

  /**
   * 在特定Scope下重新注册值绑定
   * @param scope
   * @param bindings
   */
  setKeymap(scope: KeybindingScope, bindings: Keybinding[]): void {
    this.resetKeybindingsForScope(scope);
    this.doRegisterKeybindings(bindings, scope);
    this.keybindingsChanged.fire({ affectsCommands: bindings.map((b) => b.command) });
  }

  /**
   * 重置特定Scope下的Keybindings
   * @param scope
   */
  resetKeybindingsForScope(scope: KeybindingScope): void {
    this.keymaps[scope] = [];
  }

  /**
   * 重置所有Scope下的键绑定（仅保留映射的默认键绑定）
   */
  resetKeybindings(): void {
    for (let i = KeybindingScope.DEFAULT + 1; i < KeybindingScope.END; i++) {
      this.keymaps[i] = [];
    }
  }

  /**
   * 执行匹配键盘事件的命令
   *
   * @param event 键盘事件
   */
  run(event: KeyboardEvent): void {
    if (event.defaultPrevented) {
      return;
    }
    if (this.keySequenceTimer) {
      clearTimeout(this.keySequenceTimer);
    }
    const keyCode = KeyCode.createKeyCode(event);
    // 当传入的Keycode仅为修饰符，忽略，等待下次输入
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
  convert(event: KeyboardEvent, separator: string = ' '): string {

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
  clearConvert() {
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
            const commandHandler = this.commandRegistry.getActiveHandler(command.id);

            if (commandHandler) {
              commandHandler.execute(...(binding.args || []));
            }
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

}

export const noKeybidingInputName = 'no_keybinding';
