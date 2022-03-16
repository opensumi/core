/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
  isStringArray,
  isString,
  ProblemMatcherType,
  NamedProblemMatcher,
  deepClone,
  formatLocalize,
  isBoolean,
  isArray,
  ProblemMatcher,
  isUndefined,
  IJSONSchemaMap,
  uuid,
  IStringDictionary,
  KeyedTaskIdentifier,
  IProblemMatcherRegistry,
  ITaskDefinitionRegistry,
  IProblemPatternRegistry,
  NamedProblemPattern,
} from '@opensumi/ide-core-common';
import { Platform } from '@opensumi/ide-core-common/lib/platform';

import { IWorkspaceFolder } from '../common';
import * as TaskTypes from '../common/task';

import { IProblemReporterBase, ValidationStatus, ProblemMatcherParser, Config } from './parser';

export interface CommandOptionsConfig {
  /**
   * The current working directory of the executed program or shell.
   * If omitted VSCode's current workspace root is used.
   */
  cwd?: string;

  /**
   * The additional environment of the executed program or shell. If omitted
   * the parent process' environment is used.
   */
  env?: IStringDictionary<string>;

  /**
   * The shell configuration;
   */
  shell?: TaskTypes.ShellConfiguration;
}

export interface PresentationOptionsConfig {
  /**
   * Controls whether the task output is reveal in the user interface.
   * Defaults to `RevealKind.Always`.
   */
  reveal: TaskTypes.RevealKind;

  /**
   * Controls whether the problems pane is revealed when running this task or not.
   * Defaults to `RevealProblemKind.Never`.
   */
  revealProblems: TaskTypes.RevealProblemKind;

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
  panel: TaskTypes.PanelKind;

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

export interface RunOptionsConfig {
  reevaluateOnRerun?: boolean;
  runOn?: string;
}

export interface TaskIdentifier {
  type?: string;
  [name: string]: any;
}

export namespace TaskIdentifier {
  export function is(value: any): value is TaskIdentifier {
    const candidate: TaskIdentifier = value;
    return candidate !== undefined && isString(value.type);
  }
}

export interface LegacyTaskProperties {
  /**
   * @deprecated Use `isBackground` instead.
   * Whether the executed command is kept alive and is watching the file system.
   */
  isWatching?: boolean;

  /**
   * @deprecated Use `group` instead.
   * Whether this task maps to the default build command.
   */
  isBuildCommand?: boolean;

  /**
   * @deprecated Use `group` instead.
   * Whether this task maps to the default test command.
   */
  isTestCommand?: boolean;
}

export interface LegacyCommandProperties {
  /**
   * Whether this is a shell or process
   */
  type?: string;

  /**
   * @deprecated Use presentation options
   * Controls whether the output view of the running tasks is brought to front or not.
   * See BaseTaskRunnerConfiguration#showOutput for details.
   */
  showOutput?: string;

  /**
   * @deprecated Use presentation options
   * Controls whether the executed command is printed to the output windows as well.
   */
  echoCommand?: boolean;

  /**
   * @deprecated Use presentation instead
   */
  terminal?: PresentationOptionsConfig;

  /**
   * @deprecated Use inline commands.
   * See BaseTaskRunnerConfiguration#suppressTaskName for details.
   */
  suppressTaskName?: boolean;

  /**
   * Some commands require that the task argument is highlighted with a special
   * prefix (e.g. /t: for msbuild). This property can be used to control such
   * a prefix.
   */
  taskSelector?: string;

  /**
   * @deprecated use the task type instead.
   * Specifies whether the command is a shell command and therefore must
   * be executed in a shell interpreter (e.g. cmd.exe, bash, ...).
   *
   * Defaults to false if omitted.
   */
  isShellCommand?: boolean | TaskTypes.ShellConfiguration;
}

export type CommandString = string | string[] | { value: string | string[]; quoting: 'escape' | 'strong' | 'weak' };

export namespace CommandString {
  export function value(value: CommandString): string {
    if (isString(value)) {
      return value;
    } else if (isStringArray(value)) {
      return value.join(' ');
    } else {
      if (isString(value.value)) {
        return value.value;
      } else {
        return value.value.join(' ');
      }
    }
  }
}

export interface BaseCommandProperties {
  /**
   * The command to be executed. Can be an external program or a shell
   * command.
   */
  command?: CommandString;

  /**
   * The command options used when the command is executed. Can be omitted.
   */
  options?: CommandOptionsConfig;

  /**
   * The arguments passed to the command or additional arguments passed to the
   * command when using a global command.
   */
  args?: CommandString[];
}

export interface CommandProperties extends BaseCommandProperties {
  /**
   * Windows specific command properties
   */
  windows?: BaseCommandProperties;

  /**
   * OSX specific command properties
   */
  osx?: BaseCommandProperties;

  /**
   * linux specific command properties
   */
  linux?: BaseCommandProperties;
}

export interface GroupKind {
  kind?: string;
  isDefault?: boolean;
}

export interface ConfigurationProperties {
  /**
   * The task's name
   */
  taskName?: string;

  /**
   * The UI label used for the task.
   */
  label?: string;

  /**
   * An optional identifier which can be used to reference a task
   * in a dependsOn or other attributes.
   */
  identifier?: string;

  /**
   * Whether the executed command is kept alive and runs in the background.
   */
  isBackground?: boolean;

  /**
   * Whether the task should prompt on close for confirmation if running.
   */
  promptOnClose?: boolean;

  /**
   * Defines the group the task belongs too.
   */
  group?: string | GroupKind;

  /**
   * The other tasks the task depend on
   */
  dependsOn?: string | TaskIdentifier | Array<string | TaskIdentifier>;

  /**
   * The order the dependsOn tasks should be executed in.
   */
  dependsOrder?: string;

  /**
   * Controls the behavior of the used terminal
   */
  presentation?: PresentationOptionsConfig;

  /**
   * Controls shell options.
   */
  options?: CommandOptionsConfig;

  /**
   * The problem matcher(s) to use to capture problems in the tasks
   * output.
   */
  problemMatcher?: ProblemMatcherType;

  /**
   * Task run options. Control run related properties.
   */
  runOptions?: RunOptionsConfig;
}

export interface CustomTask extends CommandProperties, ConfigurationProperties {
  /**
   * Custom tasks have the type CUSTOMIZED_TASK_TYPE
   */
  type?: string;
}

export interface ConfiguringTask extends ConfigurationProperties {
  /**
   * The contributed type of the task
   */
  type?: string;
}

/**
 * The base task runner configuration
 */
export interface BaseTaskRunnerConfiguration {
  /**
   * The command to be executed. Can be an external program or a shell
   * command.
   */
  command?: CommandString;

  /**
   * @deprecated Use type instead
   *
   * Specifies whether the command is a shell command and therefore must
   * be executed in a shell interpreter (e.g. cmd.exe, bash, ...).
   *
   * Defaults to false if omitted.
   */
  isShellCommand?: boolean;

  /**
   * The task type
   */
  type?: string;

  /**
   * The command options used when the command is executed. Can be omitted.
   */
  options?: CommandOptionsConfig;

  /**
   * The arguments passed to the command. Can be omitted.
   */
  args?: CommandString[];

  /**
   * Controls whether the output view of the running tasks is brought to front or not.
   * Valid values are:
   *   "always": bring the output window always to front when a task is executed.
   *   "silent": only bring it to front if no problem matcher is defined for the task executed.
   *   "never": never bring the output window to front.
   *
   * If omitted "always" is used.
   */
  showOutput?: string;

  /**
   * Controls whether the executed command is printed to the output windows as well.
   */
  echoCommand?: boolean;

  /**
   * The group
   */
  group?: string | GroupKind;
  /**
   * Controls the behavior of the used terminal
   */
  presentation?: PresentationOptionsConfig;

  /**
   * If set to false the task name is added as an additional argument to the
   * command when executed. If set to true the task name is suppressed. If
   * omitted false is used.
   */
  suppressTaskName?: boolean;

  /**
   * Some commands require that the task argument is highlighted with a special
   * prefix (e.g. /t: for msbuild). This property can be used to control such
   * a prefix.
   */
  taskSelector?: string;

  /**
   * The problem matcher(s) to used if a global command is executed (e.g. no tasks
   * are defined). A json file can either contain a global problemMatcher
   * property or a tasks property but not both.
   */
  problemMatcher?: ProblemMatcherType;

  /**
   * @deprecated Use `isBackground` instead.
   *
   * Specifies whether a global command is a watching the filesystem. A task.json
   * file can either contain a global isWatching property or a tasks property
   * but not both.
   */
  isWatching?: boolean;

  /**
   * Specifies whether a global command is a background task.
   */
  isBackground?: boolean;

  /**
   * Whether the task should prompt on close for confirmation if running.
   */
  promptOnClose?: boolean;

  /**
   * The configuration of the available  A json file can either
   * contain a global problemMatcher property or a tasks property but not both.
   */
  tasks?: Array<CustomTask | ConfiguringTask>;

  /**
   * Problem matcher declarations.
   */
  declares?: Config.NamedProblemMatcher[];

  /**
   * Optional user input variables.
   */
  inputs?: any[];
}

/**
 * A configuration of an external build system. BuildConfiguration.buildSystem
 * must be set to 'program'
 */
export interface ExternalTaskRunnerConfiguration extends BaseTaskRunnerConfiguration {
  _runner?: string;

  /**
   * Determines the runner to use
   */
  runner?: string;

  /**
   * The config's version number
   */
  version: string;

  /**
   * Windows specific task configuration
   */
  windows?: BaseTaskRunnerConfiguration;

  /**
   * Mac specific task configuration
   */
  osx?: BaseTaskRunnerConfiguration;

  /**
   * Linux specific task configuration
   */
  linux?: BaseTaskRunnerConfiguration;
}

enum ProblemMatcherKind {
  Unknown,
  String,
  ProblemMatcher,
  Array,
}

const EMPTY_ARRAY: any[] = [];
Object.freeze(EMPTY_ARRAY);

function assignProperty<T, K extends keyof T>(target: T, source: Partial<T>, key: K) {
  const sourceAtKey = source[key];
  if (sourceAtKey !== undefined) {
    target[key] = sourceAtKey!;
  }
}

function fillProperty<T, K extends keyof T>(target: T, source: Partial<T>, key: K) {
  const sourceAtKey = source[key];
  if (target[key] === undefined && sourceAtKey !== undefined) {
    target[key] = sourceAtKey!;
  }
}

interface ParserType<T> {
  isEmpty(value: T | undefined): boolean;
  assignProperties(target: T | undefined, source: T | undefined): T | undefined;
  fillProperties(target: T | undefined, source: T | undefined): T | undefined;
  fillDefaults(value: T | undefined, context: ParseContext): T | undefined;
  freeze(value: T): Readonly<T> | undefined;
}

interface MetaData<T, U> {
  property: keyof T;
  type?: ParserType<U>;
}

function _isEmpty<T>(this: void, value: T | undefined, properties: MetaData<T, any>[] | undefined): boolean {
  if (value === undefined || value === null || properties === undefined) {
    return true;
  }
  for (const meta of properties) {
    const property = value[meta.property];
    if (property !== undefined && property !== null) {
      if (meta.type !== undefined && !meta.type.isEmpty(property)) {
        return false;
      } else if (!Array.isArray(property) || property.length > 0) {
        return false;
      }
    }
  }
  return true;
}

function _assignProperties<T>(
  this: void,
  target: T | undefined,
  source: T | undefined,
  properties: MetaData<T, any>[],
): T | undefined {
  if (!source || _isEmpty(source, properties)) {
    return target;
  }
  if (!target || _isEmpty(target, properties)) {
    return source;
  }
  for (const meta of properties) {
    const property = meta.property;
    let value: any;
    if (meta.type !== undefined) {
      value = meta.type.assignProperties(target[property], source[property]);
    } else {
      value = source[property];
    }
    if (value !== undefined && value !== null) {
      target[property] = value;
    }
  }
  return target;
}

function _fillProperties<T>(
  this: void,
  target: T | undefined,
  source: T | undefined,
  properties: MetaData<T, any>[] | undefined,
): T | undefined {
  if (!source || _isEmpty(source, properties)) {
    return target;
  }
  if (!target || _isEmpty(target, properties)) {
    return source;
  }
  for (const meta of properties!) {
    const property = meta.property;
    let value: any;
    if (meta.type) {
      value = meta.type.fillProperties(target[property], source[property]);
    } else if (target[property] === undefined) {
      value = source[property];
    }
    if (value !== undefined && value !== null) {
      target[property] = value;
    }
  }
  return target;
}

function _fillDefaults<T>(
  this: void,
  target: T | undefined,
  defaults: T | undefined,
  properties: MetaData<T, any>[],
  context: ParseContext,
): T | undefined {
  if (target && Object.isFrozen(target)) {
    return target;
  }
  if (target === undefined || target === null || defaults === undefined || defaults === null) {
    if (defaults !== undefined && defaults !== null) {
      return deepClone(defaults);
    } else {
      return undefined;
    }
  }
  for (const meta of properties) {
    const property = meta.property;
    if (target[property] !== undefined) {
      continue;
    }
    let value: any;
    if (meta.type) {
      value = meta.type.fillDefaults(target[property], context);
    } else {
      value = defaults[property];
    }

    if (value !== undefined && value !== null) {
      target[property] = value;
    }
  }
  return target;
}

function _freeze<T>(this: void, target: T, properties: MetaData<T, any>[]): Readonly<T> | undefined {
  if (target === undefined || target === null) {
    return undefined;
  }
  if (Object.isFrozen(target)) {
    return target;
  }
  for (const meta of properties) {
    if (meta.type) {
      const value = target[meta.property];
      if (value) {
        meta.type.freeze(value);
      }
    }
  }
  Object.freeze(target);
  return target;
}

export namespace RunOnOptions {
  export function fromString(value: string | undefined): TaskTypes.RunOnOptions {
    if (!value) {
      return TaskTypes.RunOnOptions.default;
    }
    switch (value.toLowerCase()) {
      case 'folderopen':
        return TaskTypes.RunOnOptions.folderOpen;
      case 'default':
      default:
        return TaskTypes.RunOnOptions.default;
    }
  }
}

export namespace RunOptions {
  export function fromConfiguration(value: RunOptionsConfig | undefined): TaskTypes.RunOptions {
    return {
      reevaluateOnRerun: value ? value.reevaluateOnRerun : true,
      runOn: value ? RunOnOptions.fromString(value.runOn) : TaskTypes.RunOnOptions.default,
    };
  }
}

type createTaskIdentifierFn = (
  external: TaskIdentifier,
  reporter: { error(message: string): void },
) => KeyedTaskIdentifier | undefined;

export type getProblemMatcherFn = (name: string) => NamedProblemMatcher | undefined;

export type getProblemPatternFn = (name: string) => undefined | NamedProblemPattern | NamedProblemPattern[];

class ParseContext {
  workspaceFolder: IWorkspaceFolder;
  problemReporter: IProblemReporter;
  namedProblemMatchers: { [name: string]: NamedProblemMatcher };
  uuidMap: UUIDMap;
  engine: TaskTypes.ExecutionEngine;
  schemaVersion: TaskTypes.JsonSchemaVersion;
  platform: Platform;
  taskLoadIssues: string[];
  createTaskIdentifier: createTaskIdentifierFn;
  getProblemMatcher: getProblemMatcherFn;
  getProblemPattern: getProblemPatternFn;
}

namespace ShellConfiguration {
  const properties: MetaData<TaskTypes.ShellConfiguration, void>[] = [
    { property: 'executable' },
    { property: 'args' },
    { property: 'quoting' },
  ];

  export function is(value: any): value is TaskTypes.ShellConfiguration {
    const candidate: TaskTypes.ShellConfiguration = value;
    return candidate && (isString(candidate.executable) || isStringArray(candidate.args));
  }

  export function from(
    this: void,
    config: TaskTypes.ShellConfiguration | undefined,
    context: ParseContext,
  ): TaskTypes.ShellConfiguration | undefined {
    if (!is(config)) {
      return undefined;
    }
    const result: TaskTypes.ShellConfiguration = {};
    if (config.executable !== undefined) {
      result.executable = config.executable;
    }
    if (config.args !== undefined) {
      result.args = config.args.slice();
    }
    if (config.quoting !== undefined) {
      result.quoting = deepClone(config.quoting);
    }

    return result;
  }

  export function isEmpty(this: void, value: TaskTypes.ShellConfiguration): boolean {
    return _isEmpty(value, properties);
  }

  export function assignProperties(
    this: void,
    target: TaskTypes.ShellConfiguration | undefined,
    source: TaskTypes.ShellConfiguration | undefined,
  ): TaskTypes.ShellConfiguration | undefined {
    return _assignProperties(target, source, properties);
  }

  export function fillProperties(
    this: void,
    target: TaskTypes.ShellConfiguration,
    source: TaskTypes.ShellConfiguration,
  ): TaskTypes.ShellConfiguration | undefined {
    return _fillProperties(target, source, properties);
  }

  export function fillDefaults(
    this: void,
    value: TaskTypes.ShellConfiguration,
    context: ParseContext,
  ): TaskTypes.ShellConfiguration {
    return value;
  }

  export function freeze(
    this: void,
    value: TaskTypes.ShellConfiguration,
  ): Readonly<TaskTypes.ShellConfiguration> | undefined {
    if (!value) {
      return undefined;
    }
    return Object.freeze(value);
  }
}

namespace CommandOptions {
  const properties: MetaData<TaskTypes.CommandOptions, TaskTypes.ShellConfiguration>[] = [
    { property: 'cwd' },
    { property: 'env' },
    { property: 'shell', type: ShellConfiguration },
  ];
  const defaults: CommandOptionsConfig = { cwd: '${workspaceFolder}' };

  export function from(
    this: void,
    options: CommandOptionsConfig,
    context: ParseContext,
  ): TaskTypes.CommandOptions | undefined {
    const result: TaskTypes.CommandOptions = {};
    if (options.cwd !== undefined) {
      if (isString(options.cwd)) {
        result.cwd = options.cwd;
      } else {
        context.taskLoadIssues.push(
          formatLocalize(
            'ConfigurationParser.invalidCWD',
            'Warning: options.cwd must be of type string. Ignoring value {0}\n',
            options.cwd,
          ),
        );
      }
    }
    if (options.env !== undefined) {
      result.env = deepClone(options.env);
    }
    result.shell = ShellConfiguration.from(options.shell, context);
    return isEmpty(result) ? undefined : result;
  }

  export function isEmpty(value: TaskTypes.CommandOptions | undefined): boolean {
    return _isEmpty(value, properties);
  }

  export function assignProperties(
    target: TaskTypes.CommandOptions | undefined,
    source: TaskTypes.CommandOptions | undefined,
  ): TaskTypes.CommandOptions | undefined {
    if (source === undefined || isEmpty(source)) {
      return target;
    }
    if (target === undefined || isEmpty(target)) {
      return source;
    }
    assignProperty(target, source, 'cwd');
    if (target.env === undefined) {
      target.env = source.env;
    } else if (source.env !== undefined) {
      const env: { [key: string]: string } = Object.create(null);
      if (target.env !== undefined) {
        Object.keys(target.env).forEach((key) => (env[key] = target.env![key]));
      }
      if (source.env !== undefined) {
        Object.keys(source.env).forEach((key) => (env[key] = source.env![key]));
      }
      target.env = env;
    }
    target.shell = ShellConfiguration.assignProperties(target.shell, source.shell);
    return target;
  }

  export function fillProperties(
    target: TaskTypes.CommandOptions | undefined,
    source: TaskTypes.CommandOptions | undefined,
  ): TaskTypes.CommandOptions | undefined {
    return _fillProperties(target, source, properties);
  }

  export function fillDefaults(
    value: TaskTypes.CommandOptions | undefined,
    context: ParseContext,
  ): TaskTypes.CommandOptions | undefined {
    return _fillDefaults(value, defaults, properties, context);
  }

  export function freeze(value: TaskTypes.CommandOptions): Readonly<TaskTypes.CommandOptions> | undefined {
    return _freeze(value, properties);
  }
}

namespace CommandConfiguration {
  export namespace PresentationOptions {
    const properties: MetaData<TaskTypes.PresentationOptions, void>[] = [
      { property: 'echo' },
      { property: 'reveal' },
      { property: 'revealProblems' },
      { property: 'focus' },
      { property: 'panel' },
      { property: 'showReuseMessage' },
      { property: 'clear' },
      { property: 'group' },
    ];

    interface PresentationOptionsShape extends LegacyCommandProperties {
      presentation?: PresentationOptionsConfig;
    }

    export function from(
      this: void,
      config: PresentationOptionsShape,
      context: ParseContext,
    ): TaskTypes.PresentationOptions | undefined {
      let echo: boolean;
      let reveal: TaskTypes.RevealKind;
      let revealProblems: TaskTypes.RevealProblemKind;
      let focus: boolean;
      let panel: TaskTypes.PanelKind;
      let showReuseMessage: boolean;
      let clear: boolean;
      let group: string | undefined;
      let hasProps = false;
      if (isBoolean(config.echoCommand)) {
        echo = config.echoCommand;
        hasProps = true;
      }
      if (isString(config.showOutput)) {
        reveal = TaskTypes.RevealKind.fromString(config.showOutput);
        hasProps = true;
      }
      const presentation = config.presentation || config.terminal;
      if (presentation) {
        if (isBoolean(presentation.echo)) {
          echo = presentation.echo;
        }
        if (isString(presentation.reveal)) {
          reveal = TaskTypes.RevealKind.fromString(presentation.reveal);
        }
        if (isString(presentation.revealProblems)) {
          revealProblems = TaskTypes.RevealProblemKind.fromString(presentation.revealProblems);
        }
        if (isBoolean(presentation.focus)) {
          focus = presentation.focus;
        }
        if (isString(presentation.panel)) {
          panel = TaskTypes.PanelKind.fromString(presentation.panel);
        }
        if (isBoolean(presentation.showReuseMessage)) {
          showReuseMessage = presentation.showReuseMessage;
        }
        if (isBoolean(presentation.clear)) {
          clear = presentation.clear;
        }
        if (isString(presentation.group)) {
          group = presentation.group;
        }
        hasProps = true;
      }
      if (!hasProps) {
        return undefined;
      }
      return {
        echo: echo!,
        reveal: reveal!,
        revealProblems: revealProblems!,
        focus: focus!,
        panel: panel!,
        showReuseMessage: showReuseMessage!,
        clear: clear!,
        group,
      };
    }

    export function assignProperties(
      target: TaskTypes.PresentationOptions,
      source: TaskTypes.PresentationOptions | undefined,
    ): TaskTypes.PresentationOptions | undefined {
      return _assignProperties(target, source, properties);
    }

    export function fillProperties(
      target: TaskTypes.PresentationOptions,
      source: TaskTypes.PresentationOptions | undefined,
    ): TaskTypes.PresentationOptions | undefined {
      return _fillProperties(target, source, properties);
    }

    export function fillDefaults(
      value: TaskTypes.PresentationOptions,
      context: ParseContext,
    ): TaskTypes.PresentationOptions | undefined {
      const defaultEcho = context.engine === TaskTypes.ExecutionEngine.Terminal ? true : false;
      return _fillDefaults(
        value,
        {
          echo: defaultEcho,
          reveal: TaskTypes.RevealKind.Always,
          revealProblems: TaskTypes.RevealProblemKind.Never,
          focus: false,
          panel: TaskTypes.PanelKind.Shared,
          showReuseMessage: true,
          clear: false,
        },
        properties,
        context,
      );
    }

    export function freeze(value: TaskTypes.PresentationOptions): Readonly<TaskTypes.PresentationOptions> | undefined {
      return _freeze(value, properties);
    }

    export function isEmpty(this: void, value: TaskTypes.PresentationOptions): boolean {
      return _isEmpty(value, properties);
    }
  }

  namespace ShellString {
    export function from(this: void, value: CommandString | undefined): TaskTypes.CommandString | undefined {
      if (value === undefined || value === null) {
        return undefined;
      }
      if (isString(value)) {
        return value;
      } else if (isStringArray(value)) {
        return value.join(' ');
      } else {
        const quoting = TaskTypes.ShellQuoting.from(value.quoting);
        const result = isString(value.value)
          ? value.value
          : isStringArray(value.value)
          ? value.value.join(' ')
          : undefined;
        if (result) {
          return {
            value: result,
            quoting,
          };
        } else {
          return undefined;
        }
      }
    }
  }

  interface BaseCommandConfigurationShape extends BaseCommandProperties, LegacyCommandProperties {}

  interface CommandConfigurationShape extends BaseCommandConfigurationShape {
    windows?: BaseCommandConfigurationShape;
    osx?: BaseCommandConfigurationShape;
    linux?: BaseCommandConfigurationShape;
  }

  const properties: MetaData<TaskTypes.CommandConfiguration, any>[] = [
    { property: 'runtime' },
    { property: 'name' },
    { property: 'options', type: CommandOptions },
    { property: 'args' },
    { property: 'taskSelector' },
    { property: 'suppressTaskName' },
    { property: 'presentation', type: PresentationOptions },
  ];

  export function from(
    this: void,
    config: CommandConfigurationShape,
    context: ParseContext,
  ): TaskTypes.CommandConfiguration | undefined {
    let result: TaskTypes.CommandConfiguration = fromBase(config, context)!;

    let osConfig: TaskTypes.CommandConfiguration | undefined;
    if (config.windows && context.platform === Platform.Windows) {
      osConfig = fromBase(config.windows, context);
    } else if (config.osx && context.platform === Platform.Mac) {
      osConfig = fromBase(config.osx, context);
    } else if (config.linux && context.platform === Platform.Linux) {
      osConfig = fromBase(config.linux, context);
    }
    if (osConfig) {
      result = assignProperties(result, osConfig, context.schemaVersion === TaskTypes.JsonSchemaVersion.V2_0_0);
    }
    return isEmpty(result) ? undefined : result;
  }

  function fromBase(
    this: void,
    config: BaseCommandConfigurationShape,
    context: ParseContext,
  ): TaskTypes.CommandConfiguration | undefined {
    const name: TaskTypes.CommandString | undefined = ShellString.from(config.command);
    let runtime: TaskTypes.RuntimeType;
    if (isString(config.type)) {
      if (config.type === 'shell' || config.type === 'process') {
        runtime = TaskTypes.RuntimeType.fromString(config.type);
      }
    }
    const isShellConfiguration = ShellConfiguration.is(config.isShellCommand);
    if (isBoolean(config.isShellCommand) || isShellConfiguration) {
      runtime = TaskTypes.RuntimeType.Shell;
    } else if (config.isShellCommand !== undefined) {
      runtime = config.isShellCommand ? TaskTypes.RuntimeType.Shell : TaskTypes.RuntimeType.Process;
    }

    const result: TaskTypes.CommandConfiguration = {
      name,
      runtime: runtime!,
      presentation: PresentationOptions.from(config, context)!,
    };

    if (config.args !== undefined) {
      result.args = [];
      for (const arg of config.args) {
        const converted = ShellString.from(arg);
        if (converted !== undefined) {
          result.args.push(converted);
        } else {
          context.taskLoadIssues.push(
            formatLocalize(
              'ConfigurationParser.inValidArg',
              'Error: command argument must either be a string or a quoted string. Provided value is:\n{0}',
              arg ? JSON.stringify(arg, undefined, 4) : 'undefined',
            ),
          );
        }
      }
    }
    if (config.options !== undefined) {
      result.options = CommandOptions.from(config.options, context);
      if (result.options && result.options.shell === undefined && isShellConfiguration) {
        result.options.shell = ShellConfiguration.from(config.isShellCommand as TaskTypes.ShellConfiguration, context);
        if (context.engine !== TaskTypes.ExecutionEngine.Terminal) {
          context.taskLoadIssues.push(
            formatLocalize(
              'ConfigurationParser.noShell',
              'Warning: shell configuration is only supported when executing tasks in the terminal.',
            ),
          );
        }
      }
    }

    if (isString(config.taskSelector)) {
      result.taskSelector = config.taskSelector;
    }
    if (isBoolean(config.suppressTaskName)) {
      result.suppressTaskName = config.suppressTaskName;
    }

    return isEmpty(result) ? undefined : result;
  }

  export function hasCommand(value: TaskTypes.CommandConfiguration): boolean {
    return value && !!value.name;
  }

  export function isEmpty(value: TaskTypes.CommandConfiguration | undefined): boolean {
    return _isEmpty(value, properties);
  }

  export function assignProperties(
    target: TaskTypes.CommandConfiguration,
    source: TaskTypes.CommandConfiguration,
    overwriteArgs: boolean,
  ): TaskTypes.CommandConfiguration {
    if (isEmpty(source)) {
      return target;
    }
    if (isEmpty(target)) {
      return source;
    }
    assignProperty(target, source, 'name');
    assignProperty(target, source, 'runtime');
    assignProperty(target, source, 'taskSelector');
    assignProperty(target, source, 'suppressTaskName');
    if (source.args !== undefined) {
      if (target.args === undefined || overwriteArgs) {
        target.args = source.args;
      } else {
        target.args = target.args.concat(source.args);
      }
    }
    target.presentation = PresentationOptions.assignProperties(target.presentation!, source.presentation)!;
    target.options = CommandOptions.assignProperties(target.options, source.options);
    return target;
  }

  export function fillProperties(
    target: TaskTypes.CommandConfiguration,
    source: TaskTypes.CommandConfiguration,
  ): TaskTypes.CommandConfiguration | undefined {
    return _fillProperties(target, source, properties);
  }

  export function fillGlobals(
    target: TaskTypes.CommandConfiguration,
    source: TaskTypes.CommandConfiguration | undefined,
    taskName: string | undefined,
  ): TaskTypes.CommandConfiguration {
    if (source === undefined || isEmpty(source)) {
      return target;
    }
    target = target || {
      name: undefined,
      runtime: undefined,
      presentation: undefined,
    };
    if (target.name === undefined) {
      fillProperty(target, source, 'name');
      fillProperty(target, source, 'taskSelector');
      fillProperty(target, source, 'suppressTaskName');
      let args: TaskTypes.CommandString[] = source.args ? source.args.slice() : [];
      if (!target.suppressTaskName && taskName) {
        if (target.taskSelector !== undefined) {
          args.push(target.taskSelector + taskName);
        } else {
          args.push(taskName);
        }
      }
      if (target.args) {
        args = args.concat(target.args);
      }
      target.args = args;
    }
    fillProperty(target, source, 'runtime');

    target.presentation = PresentationOptions.fillProperties(target.presentation!, source.presentation)!;
    target.options = CommandOptions.fillProperties(target.options, source.options);

    return target;
  }

  export function fillDefaults(value: TaskTypes.CommandConfiguration | undefined, context: ParseContext): void {
    if (!value || Object.isFrozen(value)) {
      return;
    }
    if (value.name !== undefined && value.runtime === undefined) {
      value.runtime = TaskTypes.RuntimeType.Process;
    }
    value.presentation = PresentationOptions.fillDefaults(value.presentation!, context)!;
    if (!isEmpty(value)) {
      value.options = CommandOptions.fillDefaults(value.options, context);
    }
    if (value.args === undefined) {
      value.args = EMPTY_ARRAY;
    }
    if (value.suppressTaskName === undefined) {
      value.suppressTaskName = context.schemaVersion === TaskTypes.JsonSchemaVersion.V2_0_0;
    }
  }

  export function freeze(value: TaskTypes.CommandConfiguration): Readonly<TaskTypes.CommandConfiguration> | undefined {
    return _freeze(value, properties);
  }
}

namespace ProblemMatcherConverter {
  export function namedFrom(
    this: void,
    declares: Config.NamedProblemMatcher[] | undefined,
    context: ParseContext,
  ): IStringDictionary<NamedProblemMatcher> {
    const result: IStringDictionary<NamedProblemMatcher> = Object.create(null);

    if (!isArray(declares)) {
      return result;
    }
    (declares as Config.NamedProblemMatcher[]).forEach((value) => {
      const namedProblemMatcher = new ProblemMatcherParser(context.problemReporter).parse(
        value,
        context.getProblemPattern,
        context.getProblemMatcher,
      );
      // @ts-ignore
      if (Config.isNamedProblemMatcher(namedProblemMatcher)) {
        result[namedProblemMatcher!.name] = namedProblemMatcher;
      } else {
        context.problemReporter.error(
          formatLocalize(
            'ConfigurationParser.noName',
            'Error: Problem Matcher in declare scope must have a name:\n{0}\n',
            JSON.stringify(value, undefined, 4),
          ),
        );
      }
    });
    return result;
  }

  export function from(this: void, config: ProblemMatcherType | undefined, context: ParseContext): ProblemMatcher[] {
    const result: ProblemMatcher[] = [];
    if (config === undefined) {
      return result;
    }
    const kind = getProblemMatcherKind(config);
    if (kind === ProblemMatcherKind.Unknown) {
      context.problemReporter.warn(
        formatLocalize(
          'ConfigurationParser.unknownMatcherKind',
          'Warning: the defined problem matcher is unknown. Supported types are string | ProblemMatcher | Array<string | ProblemMatcher>.\n{0}\n',
          JSON.stringify(config, null, 4),
        ),
      );
      return result;
    } else if (kind === ProblemMatcherKind.String || kind === ProblemMatcherKind.ProblemMatcher) {
      const matcher = resolveProblemMatcher(config as ProblemMatcher, context);
      if (matcher) {
        result.push(matcher);
      }
    } else if (kind === ProblemMatcherKind.Array) {
      const problemMatchers = config as (string | ProblemMatcher)[];
      problemMatchers.forEach((problemMatcher) => {
        const matcher = resolveProblemMatcher(problemMatcher, context);
        if (matcher) {
          result.push(matcher);
        }
      });
    }
    return result;
  }

  function getProblemMatcherKind(this: void, value: ProblemMatcherType): ProblemMatcherKind {
    if (isString(value)) {
      return ProblemMatcherKind.String;
    } else if (isArray(value)) {
      return ProblemMatcherKind.Array;
    } else if (!isUndefined(value)) {
      return ProblemMatcherKind.ProblemMatcher;
    } else {
      return ProblemMatcherKind.Unknown;
    }
  }

  function resolveProblemMatcher(
    this: void,
    value: string | ProblemMatcher,
    context: ParseContext,
  ): ProblemMatcher | undefined {
    if (isString(value)) {
      let variableName = value as string;
      if (variableName.length > 1 && variableName[0] === '$') {
        variableName = variableName.substring(1);
        const global = context.getProblemMatcher(variableName);
        if (global) {
          return deepClone(global);
        }
        let localProblemMatcher = context.namedProblemMatchers[variableName];
        if (localProblemMatcher) {
          localProblemMatcher = deepClone(localProblemMatcher);
          // remove the name attr
          // 让他从一个 NamedProblemMatcher 到 ProblemMatcher
          delete (localProblemMatcher as Partial<NamedProblemMatcher>).name;
          return localProblemMatcher;
        }
      }
      context.taskLoadIssues.push(
        formatLocalize(
          'ConfigurationParser.invalidVariableReference',
          'Error: Invalid problemMatcher reference: {0}\n',
          value,
        ),
      );
      return undefined;
    } else {
      const json = value as Config.ProblemMatcher;
      return new ProblemMatcherParser(context.problemReporter).parse(
        json,
        context.getProblemPattern,
        context.getProblemMatcher,
      );
    }
  }
}

const source: Partial<TaskTypes.TaskSource> = {
  kind: TaskTypes.TaskSourceKind.Workspace,
  label: 'Workspace',
  config: undefined,
};

namespace GroupKind {
  export function from(
    this: void,
    external: string | GroupKind | undefined,
  ): [string, TaskTypes.GroupType] | undefined {
    if (external === undefined) {
      return undefined;
    }
    if (isString(external)) {
      if (TaskTypes.TaskGroup.is(external)) {
        return [external, TaskTypes.GroupType.user];
      } else {
        return undefined;
      }
    }
    if (!isString(external.kind) || !TaskTypes.TaskGroup.is(external.kind)) {
      return undefined;
    }
    const group: string = external.kind;
    const isDefault = !!external.isDefault;

    return [group, isDefault ? TaskTypes.GroupType.default : TaskTypes.GroupType.user];
  }
}

namespace TaskDependency {
  export function from(
    this: void,
    external: string | TaskIdentifier,
    context: ParseContext,
  ): TaskTypes.TaskDependency | undefined {
    if (isString(external)) {
      return { workspaceFolder: context.workspaceFolder, task: external };
    } else if (TaskIdentifier.is(external)) {
      return {
        workspaceFolder: context.workspaceFolder,
        task: context.createTaskIdentifier(external as TaskTypes.TaskIdentifier, context.problemReporter),
      };
    } else {
      return undefined;
    }
  }
}

namespace DependsOrder {
  export function from(order: string | undefined): TaskTypes.DependsOrder {
    switch (order) {
      case TaskTypes.DependsOrder.sequence:
        return TaskTypes.DependsOrder.sequence;
      case TaskTypes.DependsOrder.parallel:
      default:
        return TaskTypes.DependsOrder.parallel;
    }
  }
}

namespace ConfigurationProperties {
  const properties: MetaData<TaskTypes.ConfigurationProperties, any>[] = [
    { property: 'name' },
    { property: 'identifier' },
    { property: 'group' },
    { property: 'isBackground' },
    { property: 'promptOnClose' },
    { property: 'dependsOn' },
    { property: 'presentation', type: CommandConfiguration.PresentationOptions },
    { property: 'problemMatchers' },
  ];

  export function from(
    this: void,
    external: ConfigurationProperties & { [key: string]: any },
    context: ParseContext,
    includeCommandOptions: boolean,
    properties?: IJSONSchemaMap,
  ): TaskTypes.ConfigurationProperties | undefined {
    if (!external) {
      return undefined;
    }
    const result: TaskTypes.ConfigurationProperties = {};

    if (properties) {
      for (const propertyName of Object.keys(properties)) {
        if (external[propertyName] !== undefined) {
          result[propertyName] = deepClone(external[propertyName]);
        }
      }
    }

    if (isString(external.taskName)) {
      result.name = external.taskName;
    }
    if (isString(external.label) && context.schemaVersion === TaskTypes.JsonSchemaVersion.V2_0_0) {
      result.name = external.label;
    }
    if (isString(external.identifier)) {
      result.identifier = external.identifier;
    }
    if (external.isBackground !== undefined) {
      result.isBackground = !!external.isBackground;
    }
    if (external.promptOnClose !== undefined) {
      result.promptOnClose = !!external.promptOnClose;
    }
    if (external.group !== undefined) {
      if (isString(external.group) && TaskTypes.TaskGroup.is(external.group)) {
        result.group = external.group;
        result.groupType = TaskTypes.GroupType.user;
      } else {
        const values = GroupKind.from(external.group);
        if (values) {
          result.group = values[0];
          result.groupType = values[1];
        }
      }
    }
    if (external.dependsOn !== undefined) {
      if (isArray(external.dependsOn)) {
        result.dependsOn = external.dependsOn.reduce(
          (dependencies: TaskTypes.TaskDependency[], item): TaskTypes.TaskDependency[] => {
            const dependency = TaskDependency.from(item, context);
            if (dependency) {
              dependencies.push(dependency);
            }
            return dependencies;
          },
          [],
        );
      } else {
        const dependsOnValue = TaskDependency.from(external.dependsOn, context);
        result.dependsOn = dependsOnValue ? [dependsOnValue] : undefined;
      }
    }
    result.dependsOrder = DependsOrder.from(external.dependsOrder);
    if (
      includeCommandOptions &&
      (external.presentation !== undefined || (external as LegacyCommandProperties).terminal !== undefined)
    ) {
      result.presentation = CommandConfiguration.PresentationOptions.from(external, context);
    }
    if (includeCommandOptions && external.options !== undefined) {
      result.options = CommandOptions.from(external.options, context);
    }
    if (external.problemMatcher) {
      result.problemMatchers = ProblemMatcherConverter.from(external.problemMatcher, context);
    }
    return isEmpty(result) ? undefined : result;
  }

  export function isEmpty(this: void, value: TaskTypes.ConfigurationProperties): boolean {
    return _isEmpty(value, properties);
  }
}

namespace ConfiguringTask {
  const grunt = 'grunt.';
  const jake = 'jake.';
  const gulp = 'gulp.';
  const npm = 'vscode.npm.';
  const typescript = 'vscode.typescript.';

  interface CustomizeShape {
    customize: string;
  }

  export function from(
    this: void,
    external: ConfiguringTask,
    context: ParseContext,
    index: number,
    taskDefinitionRegister,
  ): TaskTypes.ConfiguringTask | undefined {
    if (!external) {
      return undefined;
    }
    const type = external.type;
    const customize = (external as CustomizeShape).customize;
    if (!type && !customize) {
      context.problemReporter.error(
        formatLocalize(
          'ConfigurationParser.noTaskType',
          'Error: tasks configuration must have a type property. The configuration will be ignored.\n{0}\n',
          JSON.stringify(external, null, 4),
        ),
      );
      return undefined;
    }
    const typeDeclaration = type ? taskDefinitionRegister.get(type) : undefined;
    if (!typeDeclaration) {
      const message = formatLocalize(
        'ConfigurationParser.noTypeDefinition',
        "Error: there is no registered task type '{0}'. Did you miss to install an extension that provides a corresponding task provider?",
        type,
      );
      context.problemReporter.error(message);
      return undefined;
    }
    let identifier: TaskIdentifier | undefined;
    if (isString(customize)) {
      if (customize.indexOf(grunt) === 0) {
        identifier = { type: 'grunt', task: customize.substring(grunt.length) };
      } else if (customize.indexOf(jake) === 0) {
        identifier = { type: 'jake', task: customize.substring(jake.length) };
      } else if (customize.indexOf(gulp) === 0) {
        identifier = { type: 'gulp', task: customize.substring(gulp.length) };
      } else if (customize.indexOf(npm) === 0) {
        identifier = { type: 'npm', script: customize.substring(npm.length + 4) };
      } else if (customize.indexOf(typescript) === 0) {
        identifier = { type: 'typescript', tsconfig: customize.substring(typescript.length + 6) };
      }
    } else {
      if (isString(external.type)) {
        identifier = external as TaskIdentifier;
      }
    }
    if (identifier === undefined) {
      context.problemReporter.error(
        formatLocalize(
          'ConfigurationParsTaskTypes.er.missingType',
          "Error: the task configuration '{0}' is missing the required property 'type'. The task configuration will be ignored.",
          JSON.stringify(external, undefined, 0),
        ),
      );
      return undefined;
    }
    const taskIdentifier: KeyedTaskIdentifier | undefined = context.createTaskIdentifier(
      identifier,
      context.problemReporter,
    );
    if (taskIdentifier === undefined) {
      context.problemReporter.error(
        formatLocalize(
          'ConfigurationParTaskTypes.ser.incorrectType',
          "Error: the task configuration '{0}' is using an unknown type. The task configuration will be ignored.",
          JSON.stringify(external, undefined, 0),
        ),
      );
      return undefined;
    }
    const configElement: TaskTypes.TaskSourceConfigElement = {
      workspaceFolder: context.workspaceFolder,
      file: '.vscode/json',
      index,
      element: external,
    };
    const result: TaskTypes.ConfiguringTask = new TaskTypes.ConfiguringTask(
      `${typeDeclaration.extensionId}.${taskIdentifier._key}`,
      Object.assign({} as TaskTypes.WorkspaceTaskSource, source, { config: configElement }),
      undefined,
      type,
      taskIdentifier,
      RunOptions.fromConfiguration(external.runOptions),
      {},
    );
    const configuration = ConfigurationProperties.from(external, context, true, typeDeclaration.properties);
    if (configuration) {
      result.configurationProperties = Object.assign(result.configurationProperties, configuration);
      if (result.configurationProperties.name) {
        result._label = result.configurationProperties.name;
      } else {
        let label = result.configures.type;
        if (typeDeclaration.required && typeDeclaration.required.length > 0) {
          for (const required of typeDeclaration.required) {
            const value = result.configures[required];
            if (value) {
              label = label + ' ' + value;
              break;
            }
          }
        }
        result._label = label;
      }
      if (!result.configurationProperties.identifier) {
        result.configurationProperties.identifier = taskIdentifier._key;
      }
    }
    return result;
  }
}

namespace CustomTask {
  export function from(
    this: void,
    external: CustomTask,
    context: ParseContext,
    index: number,
  ): TaskTypes.CustomTask | undefined {
    if (!external) {
      return undefined;
    }
    let type = external.type;
    if (type === undefined || type === null) {
      type = TaskTypes.CUSTOMIZED_TASK_TYPE;
    }
    if (type !== TaskTypes.CUSTOMIZED_TASK_TYPE && type !== 'shell' && type !== 'process') {
      context.problemReporter.error(
        formatLocalize(
          'ConfigurationParser.notCustom',
          'Error: tasks is not declared as a custom task. The configuration will be ignored.\n{0}\n',
          JSON.stringify(external, null, 4),
        ),
      );
      return undefined;
    }
    let taskName = external.taskName;
    if (isString(external.label) && context.schemaVersion === TaskTypes.JsonSchemaVersion.V2_0_0) {
      taskName = external.label;
    }
    if (!taskName) {
      context.problemReporter.error(
        formatLocalize(
          'ConfigurationParser.noTaskName',
          'Error: a task must provide a label property. The task will be ignored.\n{0}\n',
          JSON.stringify(external, null, 4),
        ),
      );
      return undefined;
    }
    const result: TaskTypes.CustomTask = new TaskTypes.CustomTask(
      context.uuidMap.getUUID(taskName),
      Object.assign({} as TaskTypes.WorkspaceTaskSource, source, {
        config: { index, element: external, file: '.vscode/json', workspaceFolder: context.workspaceFolder },
      }),
      taskName,
      TaskTypes.CUSTOMIZED_TASK_TYPE,
      undefined,
      false,
      RunOptions.fromConfiguration(external.runOptions),
      {
        name: taskName,
        identifier: taskName,
      },
    );
    const configuration = ConfigurationProperties.from(external, context, false);
    if (configuration) {
      result.configurationProperties = Object.assign(result.configurationProperties, configuration);
    }
    const supportLegacy = true; // context.schemaVersion === JsonSchemaVersion.V2_0_0;
    if (supportLegacy) {
      const legacy: LegacyTaskProperties = external as LegacyTaskProperties;
      if (result.configurationProperties.isBackground === undefined && legacy.isWatching !== undefined) {
        result.configurationProperties.isBackground = !!legacy.isWatching;
      }
      if (result.configurationProperties.group === undefined) {
        if (legacy.isBuildCommand === true) {
          result.configurationProperties.group = TaskTypes.TaskGroup.Build._id;
        } else if (legacy.isTestCommand === true) {
          result.configurationProperties.group = TaskTypes.TaskGroup.Test._id;
        }
      }
    }
    const command: TaskTypes.CommandConfiguration = CommandConfiguration.from(external, context)!;
    if (command) {
      result.command = command;
    }
    if (external.command !== undefined) {
      // if the task has its own command then we suppress the
      // task name by default.
      command.suppressTaskName = true;
    }
    return result;
  }

  export function fillGlobals(task: TaskTypes.CustomTask, globals: Globals): void {
    // We only merge a command from a global definition if there is no dependsOn
    // or there is a dependsOn and a defined command.
    if (CommandConfiguration.hasCommand(task.command) || task.configurationProperties.dependsOn === undefined) {
      task.command = CommandConfiguration.fillGlobals(task.command, globals.command, task.configurationProperties.name);
    }
    if (task.configurationProperties.problemMatchers === undefined && globals.problemMatcher !== undefined) {
      task.configurationProperties.problemMatchers = deepClone(globals.problemMatcher);
      task.hasDefinedMatchers = true;
    }
    // promptOnClose is inferred from isBackground if available
    if (
      task.configurationProperties.promptOnClose === undefined &&
      task.configurationProperties.isBackground === undefined &&
      globals.promptOnClose !== undefined
    ) {
      task.configurationProperties.promptOnClose = globals.promptOnClose;
    }
  }

  export function fillDefaults(task: TaskTypes.CustomTask, context: ParseContext): void {
    CommandConfiguration.fillDefaults(task.command, context);
    if (task.configurationProperties.promptOnClose === undefined) {
      task.configurationProperties.promptOnClose =
        task.configurationProperties.isBackground !== undefined ? !task.configurationProperties.isBackground : true;
    }
    if (task.configurationProperties.isBackground === undefined) {
      task.configurationProperties.isBackground = false;
    }
    if (task.configurationProperties.problemMatchers === undefined) {
      task.configurationProperties.problemMatchers = EMPTY_ARRAY;
    }
    if (task.configurationProperties.group !== undefined && task.configurationProperties.groupType === undefined) {
      task.configurationProperties.groupType = TaskTypes.GroupType.user;
    }
  }

  export function createCustomTask(
    contributedTask: TaskTypes.ContributedTask,
    configuredProps: TaskTypes.ConfiguringTask | TaskTypes.CustomTask,
  ): TaskTypes.CustomTask {
    const result: TaskTypes.CustomTask = new TaskTypes.CustomTask(
      configuredProps._id,
      Object.assign({}, configuredProps._source, { customizes: contributedTask.defines }),
      configuredProps.configurationProperties.name || contributedTask._label,
      TaskTypes.CUSTOMIZED_TASK_TYPE,
      contributedTask.command,
      false,
      contributedTask.runOptions,
      {
        name: configuredProps.configurationProperties.name || contributedTask.configurationProperties.name,
        identifier:
          configuredProps.configurationProperties.identifier || contributedTask.configurationProperties.identifier,
      },
    );
    result.addTaskLoadMessages(configuredProps.taskLoadMessages);
    const resultConfigProps: TaskTypes.ConfigurationProperties = result.configurationProperties;

    assignProperty(resultConfigProps, configuredProps.configurationProperties, 'group');
    assignProperty(resultConfigProps, configuredProps.configurationProperties, 'groupType');
    assignProperty(resultConfigProps, configuredProps.configurationProperties, 'isBackground');
    assignProperty(resultConfigProps, configuredProps.configurationProperties, 'dependsOn');
    assignProperty(resultConfigProps, configuredProps.configurationProperties, 'problemMatchers');
    assignProperty(resultConfigProps, configuredProps.configurationProperties, 'promptOnClose');
    result.command.presentation = CommandConfiguration.PresentationOptions.assignProperties(
      result.command.presentation!,
      configuredProps.configurationProperties.presentation,
    )!;
    result.command.options = CommandOptions.assignProperties(
      result.command.options,
      configuredProps.configurationProperties.options,
    );

    const contributedConfigProps: TaskTypes.ConfigurationProperties = contributedTask.configurationProperties;
    fillProperty(resultConfigProps, contributedConfigProps, 'group');
    fillProperty(resultConfigProps, contributedConfigProps, 'groupType');
    fillProperty(resultConfigProps, contributedConfigProps, 'isBackground');
    fillProperty(resultConfigProps, contributedConfigProps, 'dependsOn');
    fillProperty(resultConfigProps, contributedConfigProps, 'problemMatchers');
    fillProperty(resultConfigProps, contributedConfigProps, 'promptOnClose');
    result.command.presentation = CommandConfiguration.PresentationOptions.fillProperties(
      result.command.presentation!,
      contributedConfigProps.presentation,
    )!;
    result.command.options = CommandOptions.fillProperties(result.command.options, contributedConfigProps.options);

    if (contributedTask.hasDefinedMatchers === true) {
      result.hasDefinedMatchers = true;
    }

    return result;
  }
}

interface TaskParseResult {
  custom: TaskTypes.CustomTask[];
  configured: TaskTypes.ConfiguringTask[];
}

namespace TaskParser {
  function isCustomTask(value: CustomTask | ConfiguringTask): value is CustomTask {
    const type = value.type;
    const customize = (value as any).customize;
    return (
      customize === undefined &&
      (type === undefined ||
        type === null ||
        type === TaskTypes.CUSTOMIZED_TASK_TYPE ||
        type === 'shell' ||
        type === 'process')
    );
  }

  export function from(
    this: void,
    externals: Array<CustomTask | ConfiguringTask> | undefined,
    globals: Globals,
    context: ParseContext,
    taskDefinitionRegister,
  ): TaskParseResult {
    const result: TaskParseResult = { custom: [], configured: [] };
    if (!externals) {
      return result;
    }
    const defaultBuildTask: { task: TaskTypes.Task | undefined; rank: number } = { task: undefined, rank: -1 };
    const defaultTestTask: { task: TaskTypes.Task | undefined; rank: number } = { task: undefined, rank: -1 };
    // tslint:disable-next-line: variable-name
    const schema2_0_0: boolean = context.schemaVersion === TaskTypes.JsonSchemaVersion.V2_0_0;
    const baseLoadIssues = deepClone(context.taskLoadIssues);
    for (let index = 0; index < externals.length; index++) {
      const external = externals[index];
      if (isCustomTask(external)) {
        const customTask = CustomTask.from(external, context, index);
        if (customTask) {
          CustomTask.fillGlobals(customTask, globals);
          CustomTask.fillDefaults(customTask, context);
          if (schema2_0_0) {
            if (
              (customTask.command === undefined || customTask.command.name === undefined) &&
              (customTask.configurationProperties.dependsOn === undefined ||
                customTask.configurationProperties.dependsOn.length === 0)
            ) {
              context.problemReporter.error(
                formatLocalize(
                  'taskConfiguration.noCommandOrDependsOn',
                  "Error: the task '{0}' neither specifies a command nor a dependsOn property. The task will be ignored. Its definition is:\n{1}",
                  customTask.configurationProperties.name,
                  JSON.stringify(external, undefined, 4),
                ),
              );
              continue;
            }
          } else {
            if (customTask.command === undefined || customTask.command.name === undefined) {
              context.problemReporter.warn(
                formatLocalize(
                  'taskConfiguration.noCommand',
                  "Error: the task '{0}' doesn't define a command. The task will be ignored. Its definition is:\n{1}",
                  customTask.configurationProperties.name,
                  JSON.stringify(external, undefined, 4),
                ),
              );
              continue;
            }
          }
          if (customTask.configurationProperties.group === TaskTypes.TaskGroup.Build._id && defaultBuildTask.rank < 2) {
            defaultBuildTask.task = customTask;
            defaultBuildTask.rank = 2;
          } else if (
            customTask.configurationProperties.group === TaskTypes.TaskGroup.Test._id &&
            defaultTestTask.rank < 2
          ) {
            defaultTestTask.task = customTask;
            defaultTestTask.rank = 2;
          } else if (customTask.configurationProperties.name === 'build' && defaultBuildTask.rank < 1) {
            defaultBuildTask.task = customTask;
            defaultBuildTask.rank = 1;
          } else if (customTask.configurationProperties.name === 'test' && defaultTestTask.rank < 1) {
            defaultTestTask.task = customTask;
            defaultTestTask.rank = 1;
          }
          customTask.addTaskLoadMessages(context.taskLoadIssues);
          result.custom.push(customTask);
        }
      } else {
        const configuredTask = ConfiguringTask.from(external, context, index, taskDefinitionRegister);
        if (configuredTask) {
          configuredTask.addTaskLoadMessages(context.taskLoadIssues);
          result.configured.push(configuredTask);
        }
      }
      context.taskLoadIssues = deepClone(baseLoadIssues);
    }
    if (defaultBuildTask.rank > -1 && defaultBuildTask.rank < 2 && defaultBuildTask.task) {
      defaultBuildTask.task.configurationProperties.group = TaskTypes.TaskGroup.Build._id;
      defaultBuildTask.task.configurationProperties.groupType = TaskTypes.GroupType.user;
    } else if (defaultTestTask.rank > -1 && defaultTestTask.rank < 2 && defaultTestTask.task) {
      defaultTestTask.task.configurationProperties.group = TaskTypes.TaskGroup.Test._id;
      defaultTestTask.task.configurationProperties.groupType = TaskTypes.GroupType.user;
    }
    return result;
  }

  export function assignTasks(target: TaskTypes.CustomTask[], source: TaskTypes.CustomTask[]): TaskTypes.CustomTask[] {
    if (source === undefined || source.length === 0) {
      return target;
    }
    if (target === undefined || target.length === 0) {
      return source;
    }

    if (source) {
      // Tasks are keyed by ID but we need to merge by name
      const map: IStringDictionary<TaskTypes.CustomTask> = Object.create(null);
      target.forEach((task) => {
        map[task.configurationProperties.name!] = task;
      });

      source.forEach((task) => {
        map[task.configurationProperties.name!] = task;
      });
      const newTarget: TaskTypes.CustomTask[] = [];
      target.forEach((task) => {
        newTarget.push(map[task.configurationProperties.name!]);
        delete map[task.configurationProperties.name!];
      });
      Object.keys(map).forEach((key) => newTarget.push(map[key]));
      target = newTarget;
    }
    return target;
  }
}

interface Globals {
  command?: TaskTypes.CommandConfiguration;
  problemMatcher?: ProblemMatcher[];
  promptOnClose?: boolean;
  suppressTaskName?: boolean;
}

namespace Globals {
  export function from(config: ExternalTaskRunnerConfiguration, context: ParseContext): Globals {
    let result = fromBase(config, context);
    let osGlobals: Globals | undefined;
    if (config.windows && context.platform === Platform.Windows) {
      osGlobals = fromBase(config.windows, context);
    } else if (config.osx && context.platform === Platform.Mac) {
      osGlobals = fromBase(config.osx, context);
    } else if (config.linux && context.platform === Platform.Linux) {
      osGlobals = fromBase(config.linux, context);
    }
    if (osGlobals) {
      result = Globals.assignProperties(result, osGlobals);
    }
    const command = CommandConfiguration.from(config, context);
    if (command) {
      result.command = command;
    }
    Globals.fillDefaults(result, context);
    Globals.freeze(result);
    return result;
  }

  export function fromBase(this: void, config: BaseTaskRunnerConfiguration, context: ParseContext): Globals {
    const result: Globals = {};
    if (config.suppressTaskName !== undefined) {
      result.suppressTaskName = !!config.suppressTaskName;
    }
    if (config.promptOnClose !== undefined) {
      result.promptOnClose = !!config.promptOnClose;
    }
    if (config.problemMatcher) {
      result.problemMatcher = ProblemMatcherConverter.from(config.problemMatcher, context);
    }
    return result;
  }

  export function isEmpty(value: Globals): boolean {
    return (
      !value ||
      (value.command === undefined && value.promptOnClose === undefined && value.suppressTaskName === undefined)
    );
  }

  export function assignProperties(target: Globals, source: Globals): Globals {
    if (isEmpty(source)) {
      return target;
    }
    if (isEmpty(target)) {
      return source;
    }
    assignProperty(target, source, 'promptOnClose');
    assignProperty(target, source, 'suppressTaskName');
    return target;
  }

  export function fillDefaults(value: Globals, context: ParseContext): void {
    if (!value) {
      return;
    }
    CommandConfiguration.fillDefaults(value.command, context);
    if (value.suppressTaskName === undefined) {
      value.suppressTaskName = context.schemaVersion === TaskTypes.JsonSchemaVersion.V2_0_0;
    }
    if (value.promptOnClose === undefined) {
      value.promptOnClose = true;
    }
  }

  export function freeze(value: Globals): void {
    Object.freeze(value);
    if (value.command) {
      CommandConfiguration.freeze(value.command);
    }
  }
}

export namespace ExecutionEngine {
  export function from(config: ExternalTaskRunnerConfiguration): TaskTypes.ExecutionEngine {
    const runner = config.runner || config._runner;
    let result: TaskTypes.ExecutionEngine | undefined;
    if (runner) {
      switch (runner) {
        case 'terminal':
          result = TaskTypes.ExecutionEngine.Terminal;
          break;
        case 'process':
          result = TaskTypes.ExecutionEngine.Process;
          break;
      }
    }
    const schemaVersion = JsonSchemaVersion.from(config);
    if (schemaVersion === TaskTypes.JsonSchemaVersion.V0_1_0) {
      return result || TaskTypes.ExecutionEngine.Process;
    } else if (schemaVersion === TaskTypes.JsonSchemaVersion.V2_0_0) {
      return TaskTypes.ExecutionEngine.Terminal;
    } else {
      throw new Error("Shouldn't happen.");
    }
  }
}

export namespace JsonSchemaVersion {
  const _default: TaskTypes.JsonSchemaVersion = TaskTypes.JsonSchemaVersion.V2_0_0;

  export function from(config: ExternalTaskRunnerConfiguration): TaskTypes.JsonSchemaVersion {
    const version = config.version;
    if (!version) {
      return _default;
    }
    switch (version) {
      case '0.1.0':
        return TaskTypes.JsonSchemaVersion.V0_1_0;
      case '2.0.0':
        return TaskTypes.JsonSchemaVersion.V2_0_0;
      default:
        return _default;
    }
  }
}

export interface ParseResult {
  validationStatus: ValidationStatus;
  custom: TaskTypes.CustomTask[];
  configured: TaskTypes.ConfiguringTask[];
  engine: TaskTypes.ExecutionEngine;
}

// tslint:disable-next-line: no-empty-interface
export type IProblemReporter = IProblemReporterBase;

class UUIDMap {
  private last: IStringDictionary<string | string[]> | undefined;
  private current: IStringDictionary<string | string[]>;

  constructor(other?: UUIDMap) {
    this.current = Object.create(null);
    if (other) {
      for (const key of Object.keys(other.current)) {
        const value = other.current[key];
        if (Array.isArray(value)) {
          this.current[key] = value.slice();
        } else {
          this.current[key] = value;
        }
      }
    }
  }

  public start(): void {
    this.last = this.current;
    this.current = Object.create(null);
  }

  public getUUID(identifier: string): string {
    const lastValue = this.last ? this.last[identifier] : undefined;
    let result: string | undefined;
    if (lastValue !== undefined) {
      if (Array.isArray(lastValue)) {
        result = lastValue.shift();
        if (lastValue.length === 0) {
          delete this.last![identifier];
        }
      } else {
        result = lastValue;
        delete this.last![identifier];
      }
    }
    if (result === undefined) {
      result = uuid();
    }
    const currentValue = this.current[identifier];
    if (currentValue === undefined) {
      this.current[identifier] = result;
    } else {
      if (Array.isArray(currentValue)) {
        currentValue.push(result);
      } else {
        const arrayValue: string[] = [currentValue];
        arrayValue.push(result);
        this.current[identifier] = arrayValue;
      }
    }
    return result;
  }

  public finish(): void {
    this.last = undefined;
  }
}

class ConfigurationParser {
  private workspaceFolder: IWorkspaceFolder;
  private problemReporter: IProblemReporter;
  private uuidMap: UUIDMap;
  private platform: Platform;

  constructor(
    workspaceFolder: IWorkspaceFolder,
    platform: Platform,
    problemReporter: IProblemReporter,
    uuidMap: UUIDMap,
    private createTaskIdentifier: createTaskIdentifierFn,
    private getProblemMatcher: getProblemMatcherFn,
    private getProblemPattern: getProblemPatternFn,
  ) {
    this.workspaceFolder = workspaceFolder;
    this.platform = platform;
    this.problemReporter = problemReporter;
    this.uuidMap = uuidMap;
  }

  public run(fileConfig: ExternalTaskRunnerConfiguration, taskDefinitionRegister): ParseResult {
    const engine = ExecutionEngine.from(fileConfig);
    const schemaVersion = JsonSchemaVersion.from(fileConfig);
    const context: ParseContext = {
      workspaceFolder: this.workspaceFolder,
      problemReporter: this.problemReporter,
      uuidMap: this.uuidMap,
      namedProblemMatchers: {},
      engine,
      schemaVersion,
      platform: this.platform,
      taskLoadIssues: [],
      createTaskIdentifier: this.createTaskIdentifier,
      getProblemMatcher: this.getProblemMatcher,
      getProblemPattern: this.getProblemPattern,
    };
    const taskParseResult = this.createTaskRunnerConfiguration(fileConfig, context, taskDefinitionRegister);
    return {
      validationStatus: this.problemReporter.status,
      custom: taskParseResult.custom,
      configured: taskParseResult.configured,
      engine,
    };
  }

  private createTaskRunnerConfiguration(
    fileConfig: ExternalTaskRunnerConfiguration,
    context: ParseContext,
    taskDefinitionRegister,
  ): TaskParseResult {
    const globals = Globals.from(fileConfig, context);
    if (this.problemReporter.status.isFatal()) {
      return { custom: [], configured: [] };
    }
    context.namedProblemMatchers = ProblemMatcherConverter.namedFrom(fileConfig.declares, context);
    let globalTasks: TaskTypes.CustomTask[] | undefined;
    let externalGlobalTasks: Array<ConfiguringTask | CustomTask> | undefined;
    if (fileConfig.windows && context.platform === Platform.Windows) {
      globalTasks = TaskParser.from(fileConfig.windows.tasks, globals, context, taskDefinitionRegister).custom;
      externalGlobalTasks = fileConfig.windows.tasks;
    } else if (fileConfig.osx && context.platform === Platform.Mac) {
      globalTasks = TaskParser.from(fileConfig.osx.tasks, globals, context, taskDefinitionRegister).custom;
      externalGlobalTasks = fileConfig.osx.tasks;
    } else if (fileConfig.linux && context.platform === Platform.Linux) {
      globalTasks = TaskParser.from(fileConfig.linux.tasks, globals, context, taskDefinitionRegister).custom;
      externalGlobalTasks = fileConfig.linux.tasks;
    }
    if (
      context.schemaVersion === TaskTypes.JsonSchemaVersion.V2_0_0 &&
      globalTasks &&
      globalTasks.length > 0 &&
      externalGlobalTasks &&
      externalGlobalTasks.length > 0
    ) {
      const taskContent: string[] = [];
      for (const task of externalGlobalTasks) {
        taskContent.push(JSON.stringify(task, null, 4));
      }
      context.problemReporter.error(
        formatLocalize(
          'TaskParse.noOsSpecificGlobalTasks',
          "Task version 2.0.0 doesn't support global OS specific  Convert them to a task with a OS specific command. Affected tasks are:\n{0}",
          taskContent.join('\n'),
        ),
      );
    }

    let result: TaskParseResult = { custom: [], configured: [] };
    if (fileConfig.tasks) {
      result = TaskParser.from(fileConfig.tasks, globals, context, taskDefinitionRegister);
    }
    if (globalTasks) {
      result.custom = TaskParser.assignTasks(result.custom, globalTasks);
    }

    if ((!result.custom || result.custom.length === 0) && globals.command && globals.command.name) {
      const matchers: ProblemMatcher[] = ProblemMatcherConverter.from(fileConfig.problemMatcher, context);
      const isBackground = fileConfig.isBackground
        ? !!fileConfig.isBackground
        : fileConfig.isWatching
        ? !!fileConfig.isWatching
        : undefined;
      const name = TaskTypes.CommandString.value(globals.command.name);
      const task: TaskTypes.CustomTask = new TaskTypes.CustomTask(
        context.uuidMap.getUUID(name),
        Object.assign({} as TaskTypes.WorkspaceTaskSource, source, {
          config: { index: -1, element: fileConfig, workspaceFolder: context.workspaceFolder },
        }),
        name,
        TaskTypes.CUSTOMIZED_TASK_TYPE,
        {
          name: undefined,
          runtime: undefined,
          presentation: undefined,
          suppressTaskName: true,
        },
        false,
        { reevaluateOnRerun: true },
        {
          name,
          identifier: name,
          group: TaskTypes.TaskGroup.Build._id,
          isBackground,
          problemMatchers: matchers,
        },
      );
      const value = GroupKind.from(fileConfig.group);
      if (value) {
        task.configurationProperties.group = value[0];
        task.configurationProperties.groupType = value[1];
      } else if (fileConfig.group === 'none') {
        task.configurationProperties.group = undefined;
      }
      CustomTask.fillGlobals(task, globals);
      CustomTask.fillDefaults(task, context);
      result.custom = [task];
    }

    result.custom = result.custom || [];
    result.configured = result.configured || [];
    return result;
  }
}

const uuidMaps: Map<string, UUIDMap> = new Map();

export function parse(
  workspaceFolder: IWorkspaceFolder,
  platform: Platform,
  configuration: ExternalTaskRunnerConfiguration,
  logger: IProblemReporter,
  taskDefinitionRegister: ITaskDefinitionRegistry,
  problemMatcherRegister: IProblemMatcherRegistry,
  problemPatternRegister: IProblemPatternRegistry,
): ParseResult {
  let uuidMap = uuidMaps.get(workspaceFolder.uri.toString());
  if (!uuidMap) {
    uuidMap = new UUIDMap();
    uuidMaps.set(workspaceFolder.uri.toString(), uuidMap);
  }
  try {
    uuidMap.start();
    return new ConfigurationParser(
      workspaceFolder,
      platform,
      logger,
      uuidMap,
      taskDefinitionRegister.createTaskIdentifier,
      problemMatcherRegister.get,
      problemPatternRegister.get,
    ).run(configuration, taskDefinitionRegister);
  } finally {
    uuidMap.finish();
  }
}

export function createCustomTask(
  contributedTask: TaskTypes.ContributedTask,
  configuredProps: TaskTypes.ConfiguringTask | TaskTypes.CustomTask,
): TaskTypes.CustomTask {
  return CustomTask.createCustomTask(contributedTask, configuredProps);
}
