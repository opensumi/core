
import { Disposable } from './ext-types';

export interface IMainThreadCommands {
  $registerCommand(id: string): void;
  $unregisterCommand(id: string): void;
  $getCommands(): Promise<string[]>;
  $executeCommand<T>(id: string, ...args: any[]): Promise<T | undefined>;
}

export type Handler = <T>(...args: any[]) => T | Promise<T>;

export interface ArgumentProcessor {
  processArgument(arg: any): any;
}

export interface IExtHostCommandsRegistry {
  registerCommand(global: boolean, id: string, handler: Handler, thisArg?: any, description?: string): Disposable;
  executeCommand<T>(id: string, ...args: any[]): Promise<T | undefined>;
  $executeContributedCommand<T>(id: string, ...args: any[]): Promise<T>;
  getCommands(filterUnderscoreCommands: boolean): Promise<string[]>;
  registerArgumentProcessor(processor: ArgumentProcessor): void;
}
