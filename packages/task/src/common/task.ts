/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IJSONSchemaMap, isString, basename, URI, ProblemMatcher, ProblemMatch } from '@opensumi/ide-core-common';
import { UriComponents } from '@opensumi/ide-editor';
import { RawContextKey } from '@opensumi/ide-core-browser/lib/raw-context-key';
import { IWorkspaceFolder } from './index';

interface JSONType {
  [key: string]: any;
}

export interface WorkspaceFolder {
  uri: UriComponents;
  name: string;
  index: number;
}

export const TASK_RUNNING_STATE = new RawContextKey<boolean>('taskRunning', false);

export interface TaskExecution {
  id: string;
  task: Task;
}

export interface IExtensionProps {
  readonly id: string;
  // 插件市场 id
  readonly extensionId: string;
  readonly name: string;
  readonly activated: boolean;
  readonly enabled: boolean;
  readonly packageJSON: JSONType;
  readonly deafaultPkgNlsJSON: JSONType | undefined;
  readonly packageNlsJSON: JSONType | undefined;
  readonly path: string;
  readonly realPath: string;
  readonly extraMetadata: JSONType;
  readonly extendConfig: JSONType;
  readonly enableProposedApi: boolean;
  readonly isUseEnable: boolean;
  workerVarId?: string;
  workerScriptPath?: string;
  readonly isBuiltin: boolean;
}

export enum ShellQuoting {
  /**
   * Use character escaping.
   */
  Escape = 1,

  /**
   * Use strong quoting
   */
  Strong = 2,

  /**
   * Use weak quoting.
   */
  Weak = 3,
}

export const CUSTOMIZED_TASK_TYPE = '$customized';

export namespace ShellQuoting {
  export function from(this: void, value: string): ShellQuoting {
    if (!value) {
      return ShellQuoting.Strong;
    }
    switch (value.toLowerCase()) {
      case 'escape':
        return ShellQuoting.Escape;
      case 'strong':
        return ShellQuoting.Strong;
      case 'weak':
        return ShellQuoting.Weak;
      default:
        return ShellQuoting.Strong;
    }
  }
}

export interface ShellQuotingOptions {
  /**
   * The character used to do character escaping.
   */
  escape?:
    | string
    | {
        escapeChar: string;
        charsToEscape: string;
      };

  /**
   * The character used for string quoting.
   */
  strong?: string;

  /**
   * The character used for weak quoting.
   */
  weak?: string;
}

export interface ShellConfiguration {
  /**
   * The shell executable.
   */
  executable?: string;

  /**
   * The arguments to be passed to the shell executable.
   */
  args?: string[];

  /**
   * Which kind of quotes the shell supports.
   */
  quoting?: ShellQuotingOptions;
}

export interface CommandOptions {
  /**
   * The shell to use if the task is a shell command.
   */
  shell?: ShellConfiguration;

  /**
   * The current working directory of the executed program or shell.
   * If omitted VSCode's current workspace root is used.
   */
  cwd?: string;

  /**
   * The environment of the executed program or shell. If omitted
   * the parent process' environment is used.
   */
  env?: { [key: string]: string };
}

export namespace CommandOptions {
  export const defaults: CommandOptions = { cwd: '${workspaceFolder}' };
}

export enum RevealKind {
  /**
   * Always brings the terminal to front if the task is executed.
   */
  Always = 1,

  /**
   * Only brings the terminal to front if a problem is detected executing the task
   * e.g. the task couldn't be started,
   * the task ended with an exit code other than zero,
   * or the problem matcher found an error.
   */
  Silent = 2,

  /**
   * The terminal never comes to front when the task is executed.
   */
  Never = 3,
}

export namespace RevealKind {
  export function fromString(this: void, value: string): RevealKind {
    switch (value.toLowerCase()) {
      case 'always':
        return RevealKind.Always;
      case 'silent':
        return RevealKind.Silent;
      case 'never':
        return RevealKind.Never;
      default:
        return RevealKind.Always;
    }
  }
}

export enum RevealProblemKind {
  /**
   * Never reveals the problems panel when this task is executed.
   */
  Never = 1,

  /**
   * Only reveals the problems panel if a problem is found.
   */
  OnProblem = 2,

  /**
   * Never reveals the problems panel when this task is executed.
   */
  Always = 3,
}

export namespace RevealProblemKind {
  export function fromString(this: void, value: string): RevealProblemKind {
    switch (value.toLowerCase()) {
      case 'always':
        return RevealProblemKind.Always;
      case 'never':
        return RevealProblemKind.Never;
      case 'onproblem':
        return RevealProblemKind.OnProblem;
      default:
        return RevealProblemKind.OnProblem;
    }
  }
}

export enum PanelKind {
  /**
   * Shares a panel with other tasks. This is the default.
   */
  Shared = 1,

  /**
   * Uses a dedicated panel for this tasks. The panel is not
   * shared with other tasks.
   */
  Dedicated = 2,

  /**
   * Creates a new panel whenever this task is executed.
   */
  New = 3,
}

export namespace PanelKind {
  export function fromString(value: string): PanelKind {
    switch (value.toLowerCase()) {
      case 'shared':
        return PanelKind.Shared;
      case 'dedicated':
        return PanelKind.Dedicated;
      case 'new':
        return PanelKind.New;
      default:
        return PanelKind.Shared;
    }
  }
}

export interface PresentationOptions {
  /**
   * Controls whether the task output is reveal in the user interface.
   * Defaults to `RevealKind.Always`.
   */
  reveal: RevealKind;

  /**
   * Controls whether the problems pane is revealed when running this task or not.
   * Defaults to `RevealProblemKind.Never`.
   */
  revealProblems: RevealProblemKind;

  /**
   * Controls whether the command associated with the task is echoed
   * in the user interface.
   */
  echo: boolean;

  /**
   * Controls whether the panel showing the task output is taking focus.
   */
  focus: boolean;

  /**
   * Controls if the task panel is used for this task only (dedicated),
   * shared between tasks (shared) or if a new panel is created on
   * every task execution (new). Defaults to `TaskInstanceKind.Shared`
   */
  panel: PanelKind;

  /**
   * Controls whether to show the "Terminal will be reused by tasks, press any key to close it" message.
   */
  showReuseMessage: boolean;

  /**
   * Controls whether to clear the terminal before executing the task.
   */
  clear: boolean;

  /**
   * Controls whether the task is executed in a specific terminal group using split panes.
   */
  group?: string;
}

export namespace PresentationOptions {
  export const defaults: PresentationOptions = {
    echo: true,
    reveal: RevealKind.Always,
    revealProblems: RevealProblemKind.Never,
    focus: false,
    panel: PanelKind.Shared,
    showReuseMessage: true,
    clear: false,
  };
}

export enum RuntimeType {
  Shell = 1,
  Process = 2,
  CustomExecution = 3,
  CustomExecution2 = 4,
}

export namespace RuntimeType {
  export function fromString(value: string): RuntimeType {
    switch (value.toLowerCase()) {
      case 'shell':
        return RuntimeType.Shell;
      case 'process':
        return RuntimeType.Process;
      case 'customExecution':
        return RuntimeType.CustomExecution;
      default:
        return RuntimeType.Process;
    }
  }
}

export interface QuotedString {
  value: string;
  quoting: ShellQuoting;
}

export type CommandString = string | QuotedString;

export namespace CommandString {
  export function value(value: CommandString): string {
    if (isString(value)) {
      return value;
    } else {
      return value.value;
    }
  }
}

export interface CommandConfiguration {
  /**
   * The task type
   */
  runtime?: RuntimeType;

  /**
   * The command to execute
   */
  name?: CommandString;

  /**
   * Additional command options.
   */
  options?: CommandOptions;

  /**
   * Command arguments.
   */
  args?: CommandString[];

  /**
   * The task selector if needed.
   */
  taskSelector?: string;

  /**
   * Whether to suppress the task name when merging global args
   *
   */
  suppressTaskName?: boolean;

  /**
   * Describes how the task is presented in the UI.
   */
  presentation?: PresentationOptions;
}

export namespace TaskGroup {
  export const Clean: TaskGroup = { _id: 'clean', isDefault: false };

  export const Build: TaskGroup = { _id: 'build', isDefault: false };

  export const Rebuild: TaskGroup = { _id: 'rebuild', isDefault: false };

  export const Test: TaskGroup = { _id: 'test', isDefault: false };

  export function is(value: any): value is string {
    return value === Clean._id || value === Build._id || value === Rebuild._id || value === Test._id;
  }

  export function from(value: string | TaskGroup | undefined): TaskGroup | undefined {
    if (value === undefined) {
      return undefined;
    } else if (isString(value)) {
      if (is(value)) {
        return { _id: value, isDefault: false };
      }
      return undefined;
    } else {
      return value;
    }
  }
}

export interface TaskGroup {
  _id: string;
  isDefault?: boolean;
}

export const enum TaskScope {
  Global = 1,
  Workspace = 2,
  Folder = 3,
}

export namespace TaskSourceKind {
  export const Workspace = 'workspace' as const;
  export const Extension = 'extension' as const;
  export const InMemory = 'inMemory' as const;
  export const WorkspaceFile = 'workspaceFile' as const;
  export const User = 'user' as const;
}

interface IWorkspace {
  /**
   * the unique identifier of the workspace.
   */
  readonly id: string;

  /**
   * Folders in the workspace.
   */
  readonly folders: WorkspaceFolder[];

  /**
   * the location of the workspace configuration
   */
  readonly configuration?: URI | null;
}

export interface TaskSourceConfigElement {
  workspaceFolder?: WorkspaceFolder;
  workspace?: IWorkspace;
  file: string;
  index: number;
  element: any;
}

interface BaseTaskSource {
  readonly kind: string;
  readonly label: string;
}

export interface WorkspaceTaskSource extends BaseTaskSource {
  readonly kind: 'workspace';
  readonly config: TaskSourceConfigElement;
  readonly customizes?: KeyedTaskIdentifier;
}

export interface ExtensionTaskSource extends BaseTaskSource {
  readonly kind: 'extension';
  readonly extension?: string;
  readonly scope: TaskScope;
  readonly workspaceFolder: IWorkspaceFolder | undefined;
}

export interface ExtensionTaskSourceTransfer {
  __workspaceFolder: UriComponents;
  __definition: { type: string; [name: string]: any };
}

export interface InMemoryTaskSource extends BaseTaskSource {
  readonly kind: 'inMemory';
}

export interface UserTaskSource extends BaseTaskSource {
  readonly kind: 'user';
  readonly config: TaskSourceConfigElement;
  readonly customizes?: KeyedTaskIdentifier;
}

export interface WorkspaceFileTaskSource extends BaseTaskSource {
  readonly kind: 'workspaceFile';
  readonly config: TaskSourceConfigElement;
  readonly customizes?: KeyedTaskIdentifier;
}

export type TaskSource =
  | WorkspaceTaskSource
  | ExtensionTaskSource
  | InMemoryTaskSource
  | UserTaskSource
  | WorkspaceFileTaskSource;
export type FileBasedTaskSource = WorkspaceTaskSource | UserTaskSource | WorkspaceFileTaskSource;
export interface TaskIdentifier {
  type: string;
  [name: string]: any;
}

export interface KeyedTaskIdentifier extends TaskIdentifier {
  _key: string;
}

export interface TaskDependency {
  workspaceFolder: IWorkspaceFolder;
  task: string | KeyedTaskIdentifier | undefined;
}

export const enum GroupType {
  default = 'default',
  user = 'user',
}

export const enum DependsOrder {
  parallel = 'parallel',
  sequence = 'sequence',
}

export interface ConfigurationProperties {
  /**
   * The task's name
   */
  name?: string;

  /**
   * The task's name
   */
  identifier?: string;

  /**
   * the task's group;
   */
  group?: string;

  /**
   * The group type
   */
  groupType?: GroupType;

  /**
   * The presentation options
   */
  presentation?: PresentationOptions;

  /**
   * The command options;
   */
  options?: CommandOptions;

  /**
   * Whether the task is a background task or not.
   */
  isBackground?: boolean;

  /**
   * Whether the task should prompt on close for confirmation if running.
   */
  promptOnClose?: boolean;

  /**
   * The other tasks this task depends on.
   */
  dependsOn?: TaskDependency[];

  /**
   * The order the dependsOn tasks should be executed in.
   */
  dependsOrder?: DependsOrder;

  /**
   * A description of the task.
   */
  detail?: string;

  /**
   * The problem watchers to use for this task
   */
  problemMatchers?: Array<string | ProblemMatcher>;
}

export enum RunOnOptions {
  default = 1,
  folderOpen = 2,
}

export interface RunOptions {
  reevaluateOnRerun?: boolean;
  runOn?: RunOnOptions;
}

export namespace RunOptions {
  export const defaults: RunOptions = { reevaluateOnRerun: true, runOn: RunOnOptions.default };
}

export abstract class CommonTask {
  /**
   * The task's internal id
   */
  _id: string;

  /**
   * The cached label.
   */
  _label = '';

  type?: string;

  runOptions: RunOptions;

  configurationProperties: ConfigurationProperties;

  _source: BaseTaskSource;

  private _taskLoadMessages: string[] | undefined;

  protected constructor(
    id: string,
    label: string | undefined,
    type: string | undefined,
    runOptions: RunOptions,
    configurationProperties: ConfigurationProperties,
    source: BaseTaskSource,
  ) {
    this._id = id;
    if (label) {
      this._label = label;
    }
    if (type) {
      this.type = type;
    }
    this.runOptions = runOptions;
    this.configurationProperties = configurationProperties;
    this._source = source;
  }

  public getDefinition(useSource?: boolean): KeyedTaskIdentifier | undefined {
    return undefined;
  }

  public getMapKey(): string {
    return this._id;
  }

  public getRecentlyUsedKey(): string | undefined {
    return undefined;
  }

  public clone(): Task {
    return this.fromObject(Object.assign({}, this as any));
  }

  protected abstract fromObject(object: any): Task;

  public getWorkspaceFolder(): IWorkspaceFolder | undefined {
    return undefined;
  }

  public getWorkspaceFileName(): string | undefined {
    return undefined;
  }

  public getTelemetryKind(): string {
    return 'unknown';
  }

  public matches(key: string | KeyedTaskIdentifier | undefined, compareId = false): boolean {
    if (key === undefined) {
      return false;
    }
    if (isString(key)) {
      return key === this._label || key === this.configurationProperties.identifier || (compareId && key === this._id);
    }
    const identifier = this.getDefinition(true);
    return identifier !== undefined && identifier._key === key._key;
  }

  public getQualifiedLabel(): string {
    const workspaceFolder = this.getWorkspaceFolder();
    if (workspaceFolder) {
      return `${this._label} (${workspaceFolder.name})`;
    } else {
      return this._label;
    }
  }

  public getTaskExecution(): TaskExecution {
    const result: TaskExecution = {
      id: this._id,
      task: this as any,
    };
    return result;
  }

  public addTaskLoadMessages(messages: string[] | undefined) {
    if (this._taskLoadMessages === undefined) {
      this._taskLoadMessages = [];
    }
    if (messages) {
      this._taskLoadMessages = this._taskLoadMessages.concat(messages);
    }
  }

  get taskLoadMessages(): string[] | undefined {
    return this._taskLoadMessages;
  }
}

export class CustomTask extends CommonTask {
  type!: '$customized'; // CUSTOMIZED_TASK_TYPE

  /**
   * Indicated the source of the task (e.g. tasks.json or extension)
   */
  _source: FileBasedTaskSource;

  hasDefinedMatchers: boolean;

  /**
   * The command configuration
   */
  command: CommandConfiguration = {};

  public constructor(
    id: string,
    source: FileBasedTaskSource,
    label: string,
    type: string,
    command: CommandConfiguration | undefined,
    hasDefinedMatchers: boolean,
    runOptions: RunOptions,
    configurationProperties: ConfigurationProperties,
  ) {
    super(id, label, undefined, runOptions, configurationProperties, source);
    this._source = source;
    this.hasDefinedMatchers = hasDefinedMatchers;
    if (command) {
      this.command = command;
    }
  }

  public customizes(): KeyedTaskIdentifier | undefined {
    if (this._source && this._source.customizes) {
      return this._source.customizes;
    }
    return undefined;
  }

  public getDefinition(useSource = false): KeyedTaskIdentifier {
    if (useSource && this._source.customizes !== undefined) {
      return this._source.customizes;
    } else {
      let type: string;
      const commandRuntime = this.command ? this.command.runtime : undefined;
      switch (commandRuntime) {
        case RuntimeType.Shell:
          type = 'shell';
          break;

        case RuntimeType.Process:
          type = 'process';
          break;

        case RuntimeType.CustomExecution:
          type = 'customExecution';
          break;

        case undefined:
          type = '$composite';
          break;

        default:
          throw new Error('Unexpected task runtime');
      }

      const result: KeyedTaskIdentifier = {
        type,
        _key: this._id,
        id: this._id,
      };
      return result;
    }
  }

  public static is(value: any): value is CustomTask {
    return value instanceof CustomTask;
  }

  public getMapKey(): string {
    const workspaceFolder = this._source.config.workspaceFolder;
    return workspaceFolder ? `${workspaceFolder.uri.toString()}|${this._id}` : this._id;
  }

  public getRecentlyUsedKey(): string | undefined {
    interface CustomKey {
      type: string;
      folder: string;
      id: string;
    }
    const workspaceFolder = this._source.config.workspaceFolder;
    if (!workspaceFolder) {
      return undefined;
    }
    let id: string = this.configurationProperties.identifier!;
    if (this._source.kind !== TaskSourceKind.Workspace) {
      id += this._source.kind;
    }
    const key: CustomKey = { type: CUSTOMIZED_TASK_TYPE, folder: workspaceFolder.uri.toString(), id };
    return JSON.stringify(key);
  }

  public getWorkspaceFolder(): IWorkspaceFolder | undefined {
    return this._source.config.workspaceFolder;
  }

  public getWorkspaceFileName(): string | undefined {
    return this._source.config.workspace && this._source.config.workspace.configuration
      ? basename(this._source.config.workspace.configuration.toString())
      : undefined;
  }

  public getTelemetryKind(): string {
    if (this._source.customizes) {
      return 'workspace>extension';
    } else {
      return 'workspace';
    }
  }

  protected fromObject(object: CustomTask): CustomTask {
    return new CustomTask(
      object._id,
      object._source,
      object._label,
      object.type,
      object.command,
      object.hasDefinedMatchers,
      object.runOptions,
      object.configurationProperties,
    );
  }
}

export class ConfiguringTask extends CommonTask {
  /**
   * Indicated the source of the task (e.g. tasks.json or extension)
   */
  _source: FileBasedTaskSource;

  configures: KeyedTaskIdentifier;

  public constructor(
    id: string,
    source: FileBasedTaskSource,
    label: string | undefined,
    type: string | undefined,
    configures: KeyedTaskIdentifier,
    runOptions: RunOptions,
    configurationProperties: ConfigurationProperties,
  ) {
    super(id, label, type, runOptions, configurationProperties, source);
    this._source = source;
    this.configures = configures;
  }

  public static is(value: any): value is ConfiguringTask {
    return value instanceof ConfiguringTask;
  }

  protected fromObject(object: any): Task {
    return object;
  }

  public getDefinition(): KeyedTaskIdentifier {
    return this.configures;
  }

  public getWorkspaceFileName(): string | undefined {
    return this._source.config.workspace && this._source.config.workspace.configuration
      ? basename(this._source.config.workspace.configuration.toString())
      : undefined;
  }
}

export class ContributedTask extends CommonTask {
  /**
   * Indicated the source of the task (e.g. tasks.json or extension)
   * Set in the super constructor
   */
  _source!: ExtensionTaskSource;

  defines: KeyedTaskIdentifier;

  hasDefinedMatchers: boolean;

  /**
   * The command configuration
   */
  command: CommandConfiguration;

  public constructor(
    id: string,
    source: ExtensionTaskSource,
    label: string,
    type: string | undefined,
    defines: KeyedTaskIdentifier,
    command: CommandConfiguration,
    hasDefinedMatchers: boolean,
    runOptions: RunOptions,
    configurationProperties: ConfigurationProperties,
  ) {
    super(id, label, type, runOptions, configurationProperties, source);
    this.defines = defines;
    this.hasDefinedMatchers = hasDefinedMatchers;
    this.command = command;
  }

  public getDefinition(): KeyedTaskIdentifier {
    return this.defines;
  }

  public static is(value: any): value is ContributedTask {
    return value instanceof ContributedTask;
  }

  public getMapKey(): string {
    const workspaceFolder = this._source.workspaceFolder;
    return workspaceFolder
      ? `${this._source.scope.toString()}|${workspaceFolder.uri.toString()}|${this._id}`
      : `${this._source.scope.toString()}|${this._id}`;
  }

  public getRecentlyUsedKey(): string | undefined {
    interface ContributedKey {
      type: string;
      scope: number;
      folder?: string;
      id: string;
    }

    const key: ContributedKey = { type: 'contributed', scope: this._source.scope, id: this._id };
    if (this._source.scope === TaskScope.Folder && this._source.workspaceFolder) {
      key.folder = this._source.workspaceFolder.uri.toString();
    }
    return JSON.stringify(key);
  }

  public getWorkspaceFolder(): IWorkspaceFolder | undefined {
    return this._source.workspaceFolder;
  }

  public getTelemetryKind(): string {
    return 'extension';
  }

  protected fromObject(object: ContributedTask): ContributedTask {
    return new ContributedTask(
      object._id,
      object._source,
      object._label,
      object.type,
      object.defines,
      object.command,
      object.hasDefinedMatchers,
      object.runOptions,
      object.configurationProperties,
    );
  }
}

export class InMemoryTask extends CommonTask {
  /**
   * Indicated the source of the task (e.g. tasks.json or extension)
   */
  _source: InMemoryTaskSource;

  type!: 'inMemory';

  public constructor(
    id: string,
    source: InMemoryTaskSource,
    label: string,
    type: string,
    runOptions: RunOptions,
    configurationProperties: ConfigurationProperties,
  ) {
    super(id, label, type, runOptions, configurationProperties, source);
    this._source = source;
  }

  public static is(value: any): value is InMemoryTask {
    return value instanceof InMemoryTask;
  }

  public getTelemetryKind(): string {
    return 'composite';
  }

  protected fromObject(object: InMemoryTask): InMemoryTask {
    return new InMemoryTask(
      object._id,
      object._source,
      object._label,
      object.type,
      object.runOptions,
      object.configurationProperties,
    );
  }
}

export type Task = CustomTask | ContributedTask | InMemoryTask;

export enum ExecutionEngine {
  Process = 1,
  Terminal = 2,
}

export namespace ExecutionEngine {
  export const _default: ExecutionEngine = ExecutionEngine.Terminal;
}

export const enum JsonSchemaVersion {
  V0_1_0 = 1,
  V2_0_0 = 2,
}

export interface TaskSet {
  tasks: Task[];
  extension?: IExtensionProps;
  type?: string;
}

export interface TaskDefinition {
  extensionId: string;
  taskType: string;
  required: string[];
  properties: IJSONSchemaMap;
}

export class TaskSorter {
  private _order: Map<string, number> = new Map();

  constructor(workspaceFolders: IWorkspaceFolder[]) {
    for (let i = 0; i < workspaceFolders.length; i++) {
      this._order.set(workspaceFolders[i].uri.toString(), i);
    }
  }

  public compare(a: Task, b: Task): number {
    const aw = a.getWorkspaceFolder();
    const bw = b.getWorkspaceFolder();
    if (aw && bw) {
      let ai = this._order.get(aw.uri.toString());
      ai = ai === undefined ? 0 : ai + 1;
      let bi = this._order.get(bw.uri.toString());
      bi = bi === undefined ? 0 : bi + 1;
      if (ai === bi) {
        return a._label.localeCompare(b._label);
      } else {
        return ai - bi;
      }
    } else if (!aw && bw) {
      return -1;
    } else if (aw && !bw) {
      return +1;
    } else {
      return 0;
    }
  }
}

export const enum TaskEventKind {
  DependsOnStarted = 'dependsOnStarted',
  Start = 'start',
  ProcessStarted = 'processStarted',
  Active = 'active',
  Inactive = 'inactive',
  Changed = 'changed',
  Terminated = 'terminated',
  ProcessEnded = 'processEnded',
  BackgroundTaskBegin = 'backgroundTaskBegin',
  BackgroundTaskEnded = 'backgroundTaskEnded',
  ProblemMatched = 'problemMatched',
  End = 'end',
}

export const enum TaskRunType {
  SingleRun = 'singleRun',
  Background = 'background',
}

export interface TaskEvent {
  kind: TaskEventKind;
  taskId?: string;
  taskName?: string;
  runType?: TaskRunType;
  group?: string;
  processId?: number;
  exitCode?: number;
  terminalId?: string;
  problems?: ProblemMatch[];
  __task?: Task;
}

export const enum TaskRunSource {
  System,
  User,
  FolderOpen,
  ConfigurationChange,
}

export namespace TaskEvent {
  export function create(
    kind: TaskEventKind.ProcessStarted | TaskEventKind.ProcessEnded,
    task: Task,
    processIdOrExitCode?: number,
  ): TaskEvent;
  // tslint:disable-next-line: unified-signatures
  export function create(kind: TaskEventKind.Start, task: Task, terminalId?: string): TaskEvent;
  export function create(kind: TaskEventKind.ProblemMatched, task: Task, problems?: ProblemMatch[]): TaskEvent;
  export function create(
    kind:
      | TaskEventKind.DependsOnStarted
      | TaskEventKind.Start
      | TaskEventKind.Active
      | TaskEventKind.Inactive
      | TaskEventKind.Terminated
      | TaskEventKind.End
      | TaskEventKind.BackgroundTaskBegin
      | TaskEventKind.BackgroundTaskEnded
      | TaskEventKind.ProblemMatched,
    task: Task,
  ): TaskEvent;
  export function create(kind: TaskEventKind.Changed): TaskEvent;
  export function create(
    kind: TaskEventKind,
    task?: Task,
    processIdOrExitCodeOrTerminalIdOrProblems?: number | string | ProblemMatch[],
  ): TaskEvent {
    if (task) {
      const result: TaskEvent = {
        kind,
        taskId: task._id,
        taskName: task.configurationProperties.name,
        runType: task.configurationProperties.isBackground ? TaskRunType.Background : TaskRunType.SingleRun,
        group: task.configurationProperties.group,
        processId: undefined as number | undefined,
        exitCode: undefined as number | undefined,
        terminalId: undefined as string | undefined,
        __task: task,
      };
      if (kind === TaskEventKind.Start) {
        result.terminalId = processIdOrExitCodeOrTerminalIdOrProblems as string;
      } else if (kind === TaskEventKind.ProcessStarted) {
        result.processId = processIdOrExitCodeOrTerminalIdOrProblems as number;
      } else if (kind === TaskEventKind.ProcessEnded) {
        result.exitCode = processIdOrExitCodeOrTerminalIdOrProblems as number;
      } else if (kind === TaskEventKind.ProblemMatched) {
        result.problems = processIdOrExitCodeOrTerminalIdOrProblems as ProblemMatch[];
      }
      return Object.freeze(result);
    } else {
      return Object.freeze({ kind: TaskEventKind.Changed });
    }
  }
}
