import { IExtensionInfo, IDisposable } from '@opensumi/ide-core-common';

import { Disposable } from './ext-types';

export interface IMainThreadCommands {
  $registerCommand(id: string): void;
  $unregisterCommand(id: string): void;
  $getCommands(): Promise<string[]>;
  /**
   * 来自main -> extHost的command调用
   */
  $executeExtensionCommand(id: string, ...args: any[]): Promise<any>;
  /**
   * 来自ext -> main的command调用
   */
  $executeCommand<T>(id: string, ...args: any[]): Promise<T | undefined>;
  $executeCommandWithExtensionInfo<T>(
    id: string,
    extensionInfo: IExtensionInfo,
    ...args: any[]
  ): Promise<T | undefined>;
  registerArgumentProcessor(processor: ArgumentProcessor): IDisposable;
}

export interface CommandHandler<T = any> {
  handler: Handler<T>;
  thisArg?: any;
  description?: ICommandHandlerDescription;
  isPermitted?: PermittedHandler;
}

export type Handler<T = any> = (...args: any[]) => T | Promise<T>;

export type PermittedHandler = (extensionInfo: IExtensionInfo, ...args: any[]) => boolean;

// 处理单个参数的 processor
export interface ArgumentProcessor {
  processArgument(arg: any): any;
}

export interface IExtHostCommands {
  registerCommand(
    global: boolean,
    id: string,
    handler: Handler,
    thisArg?: any,
    description?: ICommandHandlerDescription,
  ): Disposable;
  registerCommand(global: boolean, id: string, handler: CommandHandler): Disposable;
  executeCommand<T>(id: string, ...args: any[]): Promise<T | undefined>;
  getCommands(filterUnderscoreCommands: boolean): Promise<string[]>;
  registerArgumentProcessor(processor: ArgumentProcessor): void;

  $executeContributedCommand<T>(id: string, ...args: any[]): Promise<T>;
  $executeCommandWithExtensionInfo<T>(
    id: string,
    extensionInfo: IExtensionInfo,
    ...args: any[]
  ): Promise<T | undefined>;
  $registerBuiltInCommands(): void;
  $registerCommandConverter(): void;
}

export interface ICommandHandlerDescription {
  description: string;
  args: { name: string; description?: string; constraint?: any; schema?: any }[];
  returns?: string;
}
