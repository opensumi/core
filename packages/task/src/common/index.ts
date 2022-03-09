import { IJSONSchemaMap } from '@opensumi/ide-core-browser';
import { IDisposable, Event, URI, TaskIdentifier, Uri, Deferred } from '@opensumi/ide-core-common';
import { UriComponents } from '@opensumi/ide-editor';
import { TerminalOptions } from '@opensumi/ide-terminal-next/lib/common';

// eslint-disable-next-line import/no-restricted-paths
import type { ProblemCollector } from '../browser/problem-collector';

import { Task, ConfiguringTask, ContributedTask, TaskSet, KeyedTaskIdentifier, TaskEvent } from './task';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface TaskMap {}

interface TaskFileter {
  version?: string;
  type?: string;
}

interface WorkspaceTaskResult {
  set: TaskSet | undefined;
  configurations:
    | {
        byIdentifier: Record<string, ConfiguringTask>;
      }
    | undefined;
  hasErrors: boolean;
}

export interface WorkspaceFolder {
  uri: UriComponents;
  name: string;
  index: number;
}

// tslint:disable-next-line: no-empty-interface
export type IWorkspaceFolder = WorkspaceFolder;

export interface WorkspaceFolderTaskResult extends WorkspaceTaskResult {
  workspaceFolder: IWorkspaceFolder;
}

export interface TaskDefinition {
  type?: string;
  required?: string[];
  properties?: IJSONSchemaMap;
}

export const ITaskService = Symbol('ITaskService');

export interface ITaskProvider {
  provideTasks(validTypes?: Record<string, boolean>): Promise<TaskSet>;
  resolveTask(task: ConfiguringTask): Promise<ContributedTask | undefined>;
}

export interface ITaskResolver {
  resolve(uri: URI, identifier: string | KeyedTaskIdentifier | undefined): Task | undefined;
}

export interface ITaskSummary {
  /**
   * Exit code of the process.
   */
  exitCode?: number;
}

export interface IActivateTaskExecutorData {
  executor: ITaskExecutor;
  task: Task;
  promise: Promise<ITaskSummary>;
}

export const enum TaskExecuteKind {
  Started = 1,
  Active = 2,
}

export interface ITaskExecuteResult {
  kind: TaskExecuteKind;
  promise: Promise<ITaskSummary>;
  task: Task;
  started?: {
    restartOnFileChanges?: string;
  };
  active?: {
    same: boolean;
    background: boolean;
  };
}

export interface TerminateResponse {
  success: boolean;
  code?: TerminateResponseCode;
  error?: any;
}

export const enum TerminateResponseCode {
  Success = 0,
  Unknown = 1,
  AccessDenied = 2,
  ProcessNotFound = 3,
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ExecutorOptions {}

export const ITaskExecutor = Symbol('ITaskExecutor');

export interface ITaskExecutor {
  executorId: number;
  processId: number | undefined;
  widgetId: string | undefined;
  processReady: Deferred<void>;
  execute(task: Task, reuse?: boolean): Promise<{ exitCode?: number }>;
  reset(): void;
  terminate(): Promise<{ success: boolean }>;
  updateTerminalOptions(options: TerminalOptions): void;
  updateProblemCollector(collector: ProblemCollector): void;
  onDidTerminalWidgetRemove: Event<void>;
  onDidTaskProcessExit: Event<number | undefined>;
}

export interface TaskTerminateResponse extends TerminateResponse {
  task: Task | undefined;
}

export const ITaskSystem = Symbol('ITaskSystem');
export interface ITaskSystem {
  onDidStateChange: Event<TaskEvent>;
  onDidBackgroundTaskBegin: Event<TaskEvent>;
  onDidBackgroundTaskEnded: Event<TaskEvent>;
  onDidProblemMatched: Event<TaskEvent>;
  run(task: Task | ConfiguringTask): Promise<ITaskExecuteResult>;
  rerun(): ITaskExecuteResult | undefined;
  isActive(): Promise<boolean>;
  isActiveSync(): boolean;
  getActiveTasks(): Task[];
  getBusyTasks(): Task[];
  canAutoTerminate(): boolean;
  terminate(task: Task): Promise<TaskTerminateResponse>;
  terminateAll(): Promise<TaskTerminateResponse[]>;
  revealTask(task: Task): boolean;
  customExecutionComplete(task: Task, result: number): Promise<void>;
}

export interface ITaskService {
  run(task: Task | ConfiguringTask): Promise<ITaskSummary>;

  runTaskCommand(): void;

  updateWorkspaceTasks(tasks: TaskMap): void;

  registerTaskProvider(provider: ITaskProvider, type: string): IDisposable;

  tasks(filter?: TaskFileter): Promise<Task[]>;

  getTask(workspaceFolder: Uri, identifier: string | TaskIdentifier, compareId?: boolean): Promise<Task | undefined>;

  terminateTask(key: string): Promise<void>;

  onDidStateChange: Event<TaskEvent>;
  onDidRegisterTaskProvider: Event<string>;
}
