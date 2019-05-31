import { Injectable, Autowired } from '@ali/common-di';
import { IDisposable, Disposable } from './disposable';
import { ContributionProvider } from './contribution-provider';

/**
 * A command is a unique identifier of a function
 * which can be executed by a user via a keyboard shortcut,
 * a menu action or directly.
 */
export interface Command {
  /**
   * A unique identifier of this command.
   */
  id: string;
  /**
   * A label of this command.
   */
  label?: string;
  /**
   * An icon class of this command.
   */
  iconClass?: string;
  /**
   * A category of this command.
   */
  category?: string;
}

export namespace Command {
  /* Determine whether object is a Command */
  // tslint:disable-next-line:no-any
  export function is(arg: Command | any): arg is Command {
    return !!arg && arg === Object(arg) && 'id' in arg;
  }

  /** Comparator function for when sorting commands */
  export function compareCommands(a: Command, b: Command): number {
    if (a.label && b.label) {
      const aCommand = a.category ? a.category + a.label : a.label;
      const bCommand = b.category ? b.category + b.label : b.label;
      return aCommand.localeCompare(bCommand);
    } else {
      return 0;
    }
  }
}

/**
 * A command handler is an implementation of a command.
 *
 * A command can have multiple handlers
 * but they should be active in different contexts,
 * otherwise first active will be executed.
 */
export interface CommandHandler {
  /**
   * Execute this handler.
   */
  // tslint:disable-next-line:no-any
  execute(...args: any[]): any;
  /**
   * Test whether this handler is enabled (active).
   */
  // tslint:disable-next-line:no-any
  isEnabled?(...args: any[]): boolean;
  /**
   * Test whether menu items for this handler should be visible.
   */
  // tslint:disable-next-line:no-any
  isVisible?(...args: any[]): boolean;
  /**
   * Test whether menu items for this handler should be toggled.
   */
  // tslint:disable-next-line:no-any
  isToggled?(...args: any[]): boolean;
}

export const CommandContribution = Symbol('CommandContribution');

export const CommandContributionProvider= Symbol('CommandContributionProvider');

/**
 * The command contribution should be implemented to register custom commands and handler.
 */
export interface CommandContribution {
  /**
   * Register commands and handlers.
   */
  registerCommands(commands: CommandRegistry): void;
}

export interface CommandRegistry {
  registerCommand(command: Command, handler?: CommandHandler): IDisposable;
  onStart(contributions?: CommandContribution[]): void;
}

export const commandServicePath = '/services/commands';
export const CommandService = Symbol('CommandService');
/**
 * The command service should be used to execute commands.
 */
export interface CommandService {
  /**
   * Execute the active handler for the given command and arguments.
   *
   * Reject if a command cannot be executed.
   */
  // tslint:disable-next-line:no-any
  executeCommand<T>(command: string, ...args: any[]): Promise<T | undefined>;
  getCommand(id: string): Command | undefined;
  getActiveHandler(commandId: string, ...args: any[]): CommandHandler | undefined;
}

/**
 * The command registry manages commands and handlers.
 */
@Injectable()
export class CommandRegistryImpl implements CommandService, CommandRegistry {

  @Autowired(CommandContributionProvider)
  private readonly contributionProvider: ContributionProvider<CommandContribution>

  /**
   * Get all registered commands.
   */
  get commands(): Command[] {
    const commands: Command[] = [];
    for (const id of this.commandIds) {
      const cmd = this.getCommand(id);
      if (cmd) {
        commands.push(cmd);
      }
    }
    return commands;
  }

  /**
   * Get all registered commands identifiers.
   */
  get commandIds(): string[] {
    return Object.keys(this._commands);
  }
  protected readonly _commands: { [id: string]: Command } = {};
  protected readonly _handlers: { [id: string]: CommandHandler[] } = {};

  onStart(): void {
    const contributions = this.contributionProvider.getContributions();
    for (const contrib of contributions) {
        contrib.registerCommands(this);
    }
  }

  /**
   * Register the given command and handler if present.
   *
   * Throw if a command is already registered for the given command identifier.
   */
  registerCommand(command: Command, handler?: CommandHandler): IDisposable {
    if (this._commands[command.id]) {
      console.warn(`A command ${command.id} is already registered.`);
      return Disposable.NULL;
    }
    if (handler) {
      const toDispose = new Disposable();
      toDispose.addDispose(this.doRegisterCommand(command));
      toDispose.addDispose(this.registerHandler(command.id, handler));
      return toDispose;
    }
    return this.doRegisterCommand(command);
  }

  /**
   * Unregister command from the registry
   *
   * @param command
   */
  unregisterCommand(command: Command): void;
  /**
   * Unregister command from the registry
   *
   * @param id
   */
  unregisterCommand(id: string): void;
  unregisterCommand(commandOrId: Command | string): void {
    const id = Command.is(commandOrId) ? commandOrId.id : commandOrId;

    if (this._commands[id]) {
      delete this._commands[id];
    }
  }

  /**
   * Register the given handler for the given command identifier.
   */
  registerHandler(commandId: string, handler: CommandHandler): IDisposable {
    let handlers = this._handlers[commandId];
    if (!handlers) {
      this._handlers[commandId] = handlers = [];
    }
    handlers.push(handler);
    return {
      dispose: () => {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) {
          handlers.splice(idx, 1);
        }
      },
    };
  }

  /**
   * Test whether there is an active handler for the given command.
   */
  // tslint:disable-next-line:no-any
  isEnabled(command: string, ...args: any[]): boolean {
    return this.getActiveHandler(command, ...args) !== undefined;
  }

  /**
   * Test whether there is a visible handler for the given command.
   */
  // tslint:disable-next-line:no-any
  isVisible(command: string, ...args: any[]): boolean {
    return this.getVisibleHandler(command, ...args) !== undefined;
  }

  /**
   * Test whether there is a toggled handler for the given command.
   */
  isToggled(command: string): boolean {
    const handler = this.getToggledHandler(command);
    return handler && handler.isToggled ? handler.isToggled() : false;
  }

  /**
   * Execute the active handler for the given command and arguments.
   *
   * Reject if a command cannot be executed.
   */
  // tslint:disable-next-line:no-any
  async executeCommand<T>(command: string, ...args: any[]): Promise<T | undefined> {
    const handler = this.getActiveHandler(command, ...args);
    if (handler) {
      const result = await handler.execute(...args);
      return result;
    }
    const argsMessage = args && args.length > 0 ? ` (args: ${JSON.stringify(args)})` : '';
    throw new Error(
      `The command '${command}' cannot be executed. There are no active handlers available for the command.${argsMessage}`
    );
  }

  /**
   * Get a visible handler for the given command or `undefined`.
   */
  // tslint:disable-next-line:no-any
  getVisibleHandler(commandId: string, ...args: any[]): CommandHandler | undefined {
    const handlers = this._handlers[commandId];
    if (handlers) {
      for (const handler of handlers) {
        if (!handler.isVisible || handler.isVisible(...args)) {
          return handler;
        }
      }
    }
    return undefined;
  }

  /**
   * Get an active handler for the given command or `undefined`.
   */
  // tslint:disable-next-line:no-any
  getActiveHandler(commandId: string, ...args: any[]): CommandHandler | undefined {
    const handlers = this._handlers[commandId];
    if (handlers) {
      for (const handler of handlers) {
        if (!handler.isEnabled || handler.isEnabled(...args)) {
          return handler;
        }
      }
    }
    return undefined;
  }

  /**
   * Get a toggled handler for the given command or `undefined`.
   */
  getToggledHandler(commandId: string): CommandHandler | undefined {
    const handlers = this._handlers[commandId];
    if (handlers) {
      for (const handler of handlers) {
        if (handler.isToggled) {
          return handler;
        }
      }
    }
    return undefined;
  }

  /**
   * Get a command for the given command identifier.
   */
  getCommand(id: string): Command | undefined {
    return this._commands[id];
  }

  protected doRegisterCommand(command: Command): IDisposable {
    this._commands[command.id] = command;
    return {
      dispose: () => {
        delete this._commands[command.id];
      },
    };
  }
}
