import type vscode from 'vscode';

import { IDisposable } from '@opensumi/ide-core-node';
import { UriComponents } from '@opensumi/ide-editor/lib/common';

import { IExtensionProps } from '../index';


export interface TaskHandlerData {
  type: string;
  provider: vscode.TaskProvider;
  extension: IExtensionProps;
}

export interface TaskDefinitionDTO {
  type: string;
  [name: string]: any;
}

export interface IMainThreadTasks {
  $registerTaskProvider(handler: number, type: string): Promise<any>;

  $unregisterTaskProvider(type: string): Promise<any>;

  $createTaskId(task: TaskDTO): Promise<string>;

  $fetchTasks(taskFilter?: TaskFilterDTO): Promise<TaskDTO[]>;

  $executeTask(dto: TaskDTO | TaskHandleDTO): Promise<TaskExecutionDTO>;

  $terminateTask(id: string): void;
}

export interface IExtHostTasks {
  // Task API start
  onDidStartTask(
    listener: (e: vscode.TaskStartEvent) => any,
    thisArg: any,
    disposables: vscode.Disposable[] | undefined,
  ): vscode.Disposable;

  onDidEndTask(
    listener: (e: vscode.TaskEndEvent) => any,
    thisArg: any,
    disposables: vscode.Disposable[] | undefined,
  ): vscode.Disposable;

  onDidStartTaskProcess(
    listener: (e: vscode.TaskProcessStartEvent) => any,
    thisArg: any,
    disposables: vscode.Disposable[] | undefined,
  ): vscode.Disposable;

  onDidEndTaskProcess(
    listener: (e: vscode.TaskProcessEndEvent) => any,
    thisArg: any,
    disposables: vscode.Disposable[] | undefined,
  ): vscode.Disposable;
  // Task API end

  taskExecutions: readonly vscode.TaskExecution[];

  registerTaskProvider(type: string, provider: vscode.TaskProvider, extension: IExtensionProps): IDisposable;

  executeTask(task: vscode.Task, extension: IExtensionProps): Promise<vscode.TaskExecution>;

  fetchTasks(filter?: vscode.TaskFilter): Promise<vscode.Task[]>;

  terminateTask(execution: vscode.TaskExecution): void;

  $onDidStartTask(taskExecution: TaskExecutionDTO, terminalId: string): void;

  $onDidEndTask(execution: TaskExecutionDTO): void;

  $onDidStartTaskProcess(value: TaskProcessStartedDTO): void;

  $onDidEndTaskProcess(value: TaskProcessEndedDTO): void;

  $provideTask(handler: number, validTypes: Record<string, boolean>): Promise<TaskSetDTO>;

  $resolveTask(handle: number, taskDTO: any): Promise<any | undefined>;
}

export interface TaskPresentationOptionsDTO {
  reveal?: number;
  echo?: boolean;
  focus?: boolean;
  panel?: number;
  showReuseMessage?: boolean;
  clear?: boolean;
  group?: string;
}

export interface RunOptionsDTO {
  reevaluateOnRerun?: boolean;
}

export interface ExecutionOptionsDTO {
  cwd?: string;
  env?: { [key: string]: string };
}

export type ProcessExecutionOptionsDTO = ExecutionOptionsDTO;

export interface ProcessExecutionDTO {
  process: string;
  args: string[];
  options?: ProcessExecutionOptionsDTO;
}

export interface ShellQuotingOptionsDTO {
  escape?:
    | string
    | {
        escapeChar: string;
        charsToEscape: string;
      };
  strong?: string;
  weak?: string;
}

export interface ShellExecutionOptionsDTO extends ExecutionOptionsDTO {
  executable?: string;
  shellArgs?: string[];
  shellQuoting?: ShellQuotingOptionsDTO;
}

export interface ShellQuotedStringDTO {
  value: string;
  quoting: number;
}

export interface ShellExecutionDTO {
  commandLine?: string;
  command?: string | ShellQuotedStringDTO;
  args?: Array<string | ShellQuotedStringDTO>;
  options?: ShellExecutionOptionsDTO;
}

export interface CustomExecutionDTO {
  customExecution: 'customExecution';
}

export interface CustomExecution2DTO {
  customExecution: 'customExecution2';
}

export interface TaskSourceDTO {
  label: string;
  extensionId?: string;
  scope?: number | UriComponents;
}

export interface TaskHandleDTO {
  id: string;
  workspaceFolder: UriComponents;
}

export interface TaskDTO {
  _id: string;
  name?: string;
  execution: ProcessExecutionDTO | ShellExecutionDTO | CustomExecutionDTO | undefined;
  definition: TaskDefinitionDTO;
  isBackground?: boolean;
  source: TaskSourceDTO;
  group?: string;
  detail?: string;
  presentationOptions?: TaskPresentationOptionsDTO;
  problemMatchers: string[];
  hasDefinedMatchers: boolean;
  runOptions?: RunOptionsDTO;
}

export interface TaskSetDTO {
  tasks: TaskDTO[];
  extension: IExtensionProps;
}

export interface TaskExecutionDTO {
  id: string;
  task: TaskDTO | undefined;
}

export interface TaskProcessStartedDTO {
  id: string;
  processId: number;
}

export interface TaskProcessEndedDTO {
  id: string;
  exitCode: number;
}

export interface TaskFilterDTO {
  version?: string;
  type?: string;
}

export namespace TaskFilterDTO {
  export function from(value: vscode.TaskFilter | undefined): TaskFilterDTO | undefined {
    return value;
  }

  export function to(value: TaskFilterDTO): vscode.TaskFilter | undefined {
    if (!value) {
      return undefined;
    }
    return Object.assign(Object.create(null), value);
  }
}

export interface TaskSystemInfoDTO {
  scheme: string;
  authority: string;
  platform: string;
}
