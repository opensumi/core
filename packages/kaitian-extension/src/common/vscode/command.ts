
import { Disposable, Position } from './ext-types';
import URI from 'vscode-uri';

export interface IMainThreadCommands {
  $registerCommand(id: string): void;
  $unregisterCommand(id: string): void;
  $getCommands(): Promise<string[]>;
  $executeCommand<T>(id: string, ...args: any[]): Promise<T | undefined>;
  $executeReferenceProvider(arg: {resource: URI, position: Position}): Promise<any | undefined>;
  $executeImplementationProvider(arg: {resource: URI, position: Position}): Promise<any | undefined>;
  $executeCodeLensProvider(arg: {resource: URI, itemResolveCount: number}): Promise<any | undefined>;
}

export type Handler = <T>(...args: any[]) => T | Promise<T>;

export interface ArgumentProcessor {
  processArgument(arg: any): any;
}

export interface IExtHostCommands {
  registerCommand(global: boolean, id: string, handler: Handler, thisArg?: any, description?: ICommandHandlerDescription): Disposable;
  executeCommand<T>(id: string, ...args: any[]): Promise<T | undefined>;
  $executeContributedCommand<T>(id: string, ...args: any[]): Promise<T>;
  getCommands(filterUnderscoreCommands: boolean): Promise<string[]>;
  registerArgumentProcessor(processor: ArgumentProcessor): void;
  $registerBuiltInCommands(): void;
}

export interface ICommandHandlerDescription {
  description: string;
  args: { name: string; description?: string; constraint?: any; schema?: any; }[];
  returns?: string;
}
