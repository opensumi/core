import { Injectable, Autowired } from '@ali/common-di';
import { isOSX, Emitter, CommandService, ContributionProvider } from '@ali/ide-core-common';
import { KeyCode, KeySequence, Key } from '../keyboard/keys';
import { KeyboardLayoutService } from '../keyboard/keyboard-layout-service';
import { Logger } from '../logger';
import { ContextKeyService } from './context-key-service';

export enum KeybindingScope {
    DEFAULT,
    USER,
    WORKSPACE,
    END,
}

// tslint:disable-next-line:no-namespace
export namespace KeybindingScope {
    export const length = KeybindingScope.END - KeybindingScope.DEFAULT;
}

// tslint:disable-next-line:no-namespace
export namespace Keybinding {

    /**
     * Returns with the string representation of the binding.
     * Any additional properties which are not described on
     * the `Keybinding` API will be ignored.
     *
     * @param binding the binding to stringify.
     */
    export function stringify(binding: Keybinding): string {
        const copy: Keybinding = {
            command: binding.command,
            keybinding: binding.keybinding,
            context: binding.context,
        };
        return JSON.stringify(copy);
    }

    /* Determine whether object is a KeyBinding */
    // tslint:disable-next-line:no-any
    export function is(arg: Keybinding | any): arg is Keybinding {
        return !!arg && arg === Object(arg) && 'command' in arg && 'keybinding' in arg;
    }
}

// tslint:disable-next-line:no-namespace
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

// tslint:disable-next-line:no-namespace
export namespace KeybindingRegistry {
  export class KeybindingsResult {
      full: Keybinding[] = [];
      partial: Keybinding[] = [];
      shadow: Keybinding[] = [];

      /**
       * Merge two results together inside `this`
       *
       * @param other the other KeybindingsResult to merge with
       * @return this
       */
      merge(other: KeybindingsResult): KeybindingsResult {
          this.full.push(...other.full);
          this.partial.push(...other.partial);
          this.shadow.push(...other.shadow);
          return this;
      }

      /**
       * Returns a new filtered KeybindingsResult
       *
       * @param fn callback filter on the results
       * @return filtered new result
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
    /** Command identifier, this needs to be a unique string.  */
    command: string;
    /** Keybinding string as defined in packages/keymaps/README.md.  */
    keybinding: string;
    /**
     * The optional keybinding context where this binding belongs to.
     * If not specified, then this keybinding context belongs to the NOOP
     * keybinding context.
     */
    context?: string;
    /**
     * https://code.visualstudio.com/docs/getstarted/keybindings#_when-clause-contexts
     */
    when?: string;
}

export interface ResolvedKeybinding extends Keybinding {
    /**
     * The KeyboardLayoutService may transform the `keybinding` depending on the
     * user's keyboard layout. This property holds the transformed keybinding that
     * should be used in the UI. The value is undefined if the KeyboardLayoutService
     * has not been called yet to resolve the keybinding.
     */
    resolved?: KeyCode[];
}

export interface ScopedKeybinding extends Keybinding {
    /** Current keybinding scope */
    scope?: KeybindingScope;
}

export const KeybindingContribution = Symbol('KeybindingContribution');

export const KeybindingContributionProvider = Symbol('KeybindingContributionProvider');

export interface KeybindingContribution {
  registerKeybindings(keybindings: KeybindingRegistryImpl): void;
}

export const KeybindingContext = Symbol('KeybindingContext');
export interface KeybindingContext {
    /**
     * The unique ID of the current context.
     */
    readonly id: string;

    isEnabled(arg: Keybinding): boolean;
}

export interface KeybindingRegistry {
  onStart(): Promise<any>;
  registerKeybinding(binding: Keybinding): void;
  registerKeybindings(...bindings: Keybinding[]): void;
  unregisterKeybinding(keyOrBinding: Keybinding | string): void;
  resolveKeybinding(binding: ResolvedKeybinding): KeyCode[];
  containsKeybinding(bindings: Keybinding[], binding: Keybinding): boolean;
  containsKeybindingInScope(binding: Keybinding, scope: KeybindingScope): boolean;
  acceleratorFor(keybinding: Keybinding, separator: string ): string[];
  acceleratorForSequence(keySequence: KeySequence, separator: string): string[];
  acceleratorForKeyCode(keyCode: KeyCode, separator: string ): string;
  acceleratorForKey(key: Key): string;
  getKeybindingsForKeySequence(keySequence: KeySequence): KeybindingRegistry.KeybindingsResult;
  getKeybindingsForCommand(commandId: string): ScopedKeybinding[];
  getScopedKeybindingsForCommand(scope: KeybindingScope, commandId: string): Keybinding[];
  run(event: KeyboardEvent): void;
  isPseudoCommand(commandId: string): boolean;
  setKeymap(scope: KeybindingScope, bindings: Keybinding[]): void;
  resetKeybindingsForScope(scope: KeybindingScope): void;
  resetKeybindings(): void;
}

export const keybindingServicePath = '/services/keybindings';
export const KeybindingService = Symbol('KeybindingService');

export interface KeybindingService {
  /**
   * 根据传入的键盘事件执行对应的Command
   */
  run(event: KeyboardEvent): void;
}

@Injectable()
export class KeybindingRegistryImpl implements KeybindingService, KeybindingRegistry {

    static readonly PASSTHROUGH_PSEUDO_COMMAND = 'passthrough';
    protected keySequence: KeySequence = [];

    protected readonly contexts: { [id: string]: KeybindingContext } = {};
    protected readonly keymaps: Keybinding[][] = [...Array(KeybindingScope.length)].map(() => []);

    @Autowired(KeyboardLayoutService)
    protected readonly keyboardLayoutService: KeyboardLayoutService;

    @Autowired(KeybindingContributionProvider)
    private readonly keybindingContributionProvider: ContributionProvider<KeybindingContribution>;

    @Autowired(CommandService)
    protected readonly commandRegistry: CommandService;

    @Autowired(Logger)
    protected readonly logger: Logger;

    @Autowired(ContextKeyService)
    protected readonly whenContextService: ContextKeyService;

    async onStart(): Promise<void> {
      await this.keyboardLayoutService.initialize();
      this.keyboardLayoutService.onKeyboardLayoutChanged((newLayout) => {
            this.clearResolvedKeybindings();
            this.keybindingsChanged.fire(undefined);
        });
      this.registerContext(KeybindingContexts.NOOP_CONTEXT);
      this.registerContext(KeybindingContexts.DEFAULT_CONTEXT);
        // 从模块中获取的KeybindingContribution
      for (const contribution of this.keybindingContributionProvider.getContributions()) {
            contribution.registerKeybindings(this);
        }
    }

    protected keybindingsChanged = new Emitter<void>();

    /**
     * 由于不同的键盘布局发生更改时触发的事件。
     */
    get onKeybindingsChanged() {
        return this.keybindingsChanged.event;
    }

    /**
     * 往应用注册Keybinding Context参数
     * 当该参数已被注册时不会重复注册
     *
     * @param contexts the keybinding contexts to register into the application.
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
     *
     * @param binding
     */
    registerKeybinding(binding: Keybinding) {
        this.doRegisterKeybinding(binding, KeybindingScope.DEFAULT);
    }

    /**
     * 注册默认 Keybindings
     *
     * @param bindings
     */
    registerKeybindings(...bindings: Keybinding[]): void {
        this.doRegisterKeybindings(bindings, KeybindingScope.DEFAULT);
    }

    /**
     * 注销 Keybinding
     *
     * @param binding
     */
    unregisterKeybinding(binding: Keybinding): void;
    /**
     * 注销 Keybinding
     *
     * @param key
     */
    // tslint:disable-next-line:unified-signatures
    unregisterKeybinding(key: string): void;
    unregisterKeybinding(keyOrBinding: Keybinding | string): void {
        const key = Keybinding.is(keyOrBinding) ? keyOrBinding.keybinding : keyOrBinding;
        const keymap = this.keymaps[KeybindingScope.DEFAULT];
        const bindings = keymap.filter((el) => el.keybinding === key);

        bindings.forEach((binding) => {
            const idx = keymap.indexOf(binding);
            if (idx >= 0) {
                keymap.splice(idx, 1);
            }
        });
    }

    protected doRegisterKeybindings(bindings: Keybinding[], scope: KeybindingScope = KeybindingScope.DEFAULT) {
        for (const binding of bindings) {
            this.doRegisterKeybinding(binding, scope);
        }
    }

    protected doRegisterKeybinding(binding: Keybinding, scope: KeybindingScope = KeybindingScope.DEFAULT) {
        try {
            this.resolveKeybinding(binding);
            if (this.containsKeybinding(this.keymaps[scope], binding)) {
                throw new Error(`"${binding.keybinding}" is in collision with something else [scope:${scope}]`);
            }
            this.keymaps[scope].push(binding);
        } catch (error) {
            this.logger.warn(`Could not register keybinding:\n  ${Keybinding.stringify(binding)}\n${error}`);
        }
    }

    /**
     * 通过调用KeyboardLayoutService来设置给定的ResolvedKeybinding中的`resolved`属性。
     *
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
     *
     */
    protected clearResolvedKeybindings(): void {
        for (let i = KeybindingScope.DEFAULT; i < KeybindingScope.END; i++) {
            const bindings = this.keymaps[i];
            for (const binding of bindings) {
              const bd: ResolvedKeybinding  = binding;
              bd.resolved = undefined;
            }
        }
    }

    /**
     * 检查Keybindings列表中的keySequence冲突
     *
     * @param bindings the keybinding reference list
     * @param binding the keybinding to test collisions for
     */
    containsKeybinding(bindings: Keybinding[], binding: Keybinding): boolean {
        const bindingKeySequence = this.resolveKeybinding(binding);
        const collisions = this.getKeySequenceCollisions(bindings, bindingKeySequence)
            .filter((b) => b.context === binding.context);

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

    containsKeybindingInScope(binding: Keybinding, scope = KeybindingScope.USER): boolean {
        return this.containsKeybinding(this.keymaps[scope], binding);
    }

    /**
     * 返回用户可见的Keybinding数据
     */
    acceleratorFor(keybinding: Keybinding, separator: string = ' '): string[] {
        const bindingKeySequence = this.resolveKeybinding(keybinding);
        return this.acceleratorForSequence(bindingKeySequence, separator);
    }

    /**
     * 从KeySequence中返回用户可见的Keybinding
     */
    acceleratorForSequence(keySequence: KeySequence, separator: string = ' '): string[] {
        return keySequence.map((keyCode) => this.acceleratorForKeyCode(keyCode, separator));
    }

    /**
     * Return a user visible representation of a key code (a key with modifiers).
     */
    acceleratorForKeyCode(keyCode: KeyCode, separator: string = ' '): string {
        const keyCodeResult: string[] = [];
        if (keyCode.meta && isOSX) {
            keyCodeResult.push('Cmd');
        }
        if (keyCode.ctrl) {
            keyCodeResult.push('Ctrl');
        }
        if (keyCode.alt) {
            keyCodeResult.push('Alt');
        }
        if (keyCode.shift) {
            keyCodeResult.push('Shift');
        }
        if (keyCode.key) {
            keyCodeResult.push(this.acceleratorForKey(keyCode.key));
        }
        return keyCodeResult.join(separator);
    }

    /**
     * Return a user visible representation of a single key.
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
     * Finds collisions for a binding inside a list of bindings (error-free)
     *
     * @param bindings the reference bindings
     * @param binding the binding to match
     */
    protected getKeybindingCollisions(bindings: Keybinding[], binding: Keybinding): KeybindingRegistry.KeybindingsResult {
        const result = new KeybindingRegistry.KeybindingsResult();
        try {
            const bindingKeySequence = this.resolveKeybinding(binding);
            result.merge(this.getKeySequenceCollisions(bindings, bindingKeySequence));
        } catch (error) {
            this.logger.warn(error);
        }
        return result;
    }

    /**
     * Finds collisions for a key sequence inside a list of bindings (error-free)
     *
     * @param bindings the reference bindings
     * @param candidate the sequence to match
     */
    protected getKeySequenceCollisions(bindings: Keybinding[], candidate: KeySequence): KeybindingRegistry.KeybindingsResult {
        const result = new KeybindingRegistry.KeybindingsResult();
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
     * Get the lists of keybindings matching fully or partially matching a KeySequence.
     * The lists are sorted by priority (see #sortKeybindingsByPriority).
     *
     * @param keySequence The key sequence for which we are looking for keybindings.
     */
    getKeybindingsForKeySequence(keySequence: KeySequence): KeybindingRegistry.KeybindingsResult {
        const result = new KeybindingRegistry.KeybindingsResult();

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
        return result;
    }

    /**
     * Get the keybindings associated to commandId.
     *
     * @param commandId The ID of the command for which we are looking for keybindings.
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
     * Returns a list of keybindings for a command in a specific scope
     * @param scope specific scope to look for
     * @param commandId unique id of the command
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
     * Sort keybindings in-place, in order of priority.
     *
     * The only criterion right now is that a keybinding with a context has
     * more priority than a keybinding with no context.
     *
     * @param keybindings Array of keybindings to be sorted in-place.
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
        /* Pseudo commands like "passthrough" are always active (and not found
           in the command registry).  */
        if (this.isPseudoCommand(binding.command)) {
            return true;
        }

        const command = this.commandRegistry.getCommand(binding.command);
        return !!command && !!this.commandRegistry.getActiveHandler(command.id);
    }

    /**
     * Tries to execute a keybinding.
     *
     * @param bindings list of matching keybindings as returned by getKeybindingsForKeySequence.full
     * @param event keyboard event.
     * @return true if the corresponding command was executed false otherwise.
     */
    protected tryKeybindingExecution(bindings: Keybinding[], event: KeyboardEvent) {

        if (bindings.length === 0) {
            return false;
        }

        for (const binding of bindings) {
            if (this.isEnabled(binding, event)) {
              if (this.isPseudoCommand(binding.command)) {
                    /* Don't do anything, let the event propagate.  */
                    return true;
                } else {
                    const command = this.commandRegistry.getCommand(binding.command);
                    if (command) {
                        const commandHandler = this.commandRegistry.getActiveHandler(command.id);

                        if (commandHandler) {
                            commandHandler.execute();
                        }

                        /* Note that if a keybinding is in context but the command is
                           not active we still stop the processing here.  */
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

    /**
     * Only execute if it has no context (global context) or if we're in that context.
     */
    protected isEnabled(binding: Keybinding, event: KeyboardEvent): boolean {
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
     * Run the command matching to the given keyboard event.
     */
    run(event: KeyboardEvent): void {
        if (event.defaultPrevented) {
            return;
        }

        const keyCode = KeyCode.createKeyCode(event);
        /* Keycode is only a modifier, next keycode will be modifier + key.
           Ignore this one.  */
        if (keyCode.isModifierOnly()) {
            return;
        }

        this.keyboardLayoutService.validateKeyCode(keyCode);
        this.keySequence.push(keyCode);
        const bindings = this.getKeybindingsForKeySequence(this.keySequence);

        if (this.tryKeybindingExecution(bindings.full, event)) {

            this.keySequence = [];
            this.logger.log('statusBar should be remove');
            // this.statusBar.removeElement('keybinding-status');

        } else if (bindings.partial.length > 0) {

            /* Accumulate the keysequence */
            event.preventDefault();
            event.stopPropagation();

            this.logger.log('statusBar should be show info: ', `(${this.acceleratorForSequence(this.keySequence, '+')}) was pressed, waiting for more keys`);

        } else {
            this.keySequence = [];
            this.logger.log('statusBar should be remove');
        }
    }

    /**
     * Return true of string a pseudo-command id, in other words a command id
     * that has a special meaning and that we won't find in the command
     * registry.
     *
     * @param commandId commandId to test
     */
    isPseudoCommand(commandId: string): boolean {
        return commandId === KeybindingRegistryImpl.PASSTHROUGH_PSEUDO_COMMAND;
    }

    setKeymap(scope: KeybindingScope, bindings: Keybinding[]): void {
        this.resetKeybindingsForScope(scope);
        this.doRegisterKeybindings(bindings, scope);
    }

    /**
     * Reset keybindings for a specific scope
     * @param scope scope to reset the keybindings for
     */
    resetKeybindingsForScope(scope: KeybindingScope): void {
        this.keymaps[scope] = [];
    }

    /**
     * Reset keybindings for all scopes(only leaves the default keybindings mapped)
     */
    resetKeybindings(): void {
        for (let i = KeybindingScope.DEFAULT + 1; i < KeybindingScope.END; i++) {
            this.keymaps[i] = [];
        }
    }
}
