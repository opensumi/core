import type vscode from 'vscode';

import * as types from '../../../../common/vscode/ext-types';
import { Uri } from '../../../../common/vscode/ext-types';

export interface TaskDto {
  type: string;
  label: string;
  source?: string;
  scope?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export function fromTask(task: types.Task): TaskDto | undefined {
  if (!task) {
    return undefined;
  }

  const taskDto = {} as TaskDto;
  taskDto.label = task.name;
  taskDto.source = task.source;
  taskDto.scope = typeof task.scope === 'object' ? task.scope.uri.toString() : undefined;

  const taskDefinition = task.definition;
  if (!taskDefinition) {
    return taskDto;
  }

  taskDto.type = taskDefinition.type;
  const { type, ...properties } = taskDefinition;
  for (const key in properties) {
    if (properties.hasOwnProperty(key)) {
      taskDto[key] = properties[key];
    }
  }

  const execution = task.execution;
  if (!execution) {
    return taskDto;
  }

  if (taskDefinition.type === 'shell' || types.ShellExecution.is(execution)) {
    return fromShellExecution(execution as types.ShellExecution, taskDto);
  }

  if (taskDefinition.type === 'process' || types.ProcessExecution.is(execution)) {
    return fromProcessExecution(execution as types.ProcessExecution, taskDto);
  }

  return taskDto;
}

export function toTask(taskDto: TaskDto): types.Task {
  if (!taskDto) {
    throw new Error('Task should be provided for converting');
  }

  const { type, label, source, scope, command, args, options, windows, ...properties } = taskDto;
  const result = {} as types.Task;
  result.name = label;
  result.source = source!;
  if (scope) {
    const uri = Uri.parse(scope);
    // @ts-ignore
    result.scope = {
      uri,
      name: uri.toString(),
      index: 0,
    };
  }

  const taskType = type;
  const taskDefinition: types.TaskDefinition = {
    type: taskType,
  };

  result.definition = taskDefinition;

  if (taskType === 'process') {
    result.execution = getProcessExecution(taskDto);
  }

  const execution = { command, args, options };
  if (taskType === 'shell' || types.ShellExecution.is(execution as types.ShellExecution)) {
    result.execution = getShellExecution(taskDto);
  }

  if (!properties) {
    return result;
  }

  for (const key in properties) {
    if (properties.hasOwnProperty(key)) {
      taskDefinition[key] = properties[key];
    }
  }

  return result;
}

export function fromProcessExecution(execution: types.ProcessExecution, taskDto: TaskDto): TaskDto {
  taskDto.command = execution.process;
  taskDto.args = execution.args;

  const options = execution.options;
  if (options) {
    taskDto.options = options;
  }
  return taskDto;
}

export function fromShellExecution(execution: types.ShellExecution, taskDto: TaskDto): TaskDto {
  const options = execution.options;
  if (options) {
    taskDto.options = getShellExecutionOptions(options);
  }

  const commandLine = execution.commandLine;
  if (commandLine) {
    taskDto.command = commandLine;
    return taskDto;
  }

  const command = execution.command;
  if (typeof command === 'string') {
    taskDto.command = command;
    taskDto.args = getShellArgs(execution.args);
    return taskDto;
  } else {
    throw new Error('Converting ShellQuotedString command is not implemented');
  }
}

export function getProcessExecution(taskDto: TaskDto): types.ProcessExecution {
  return new types.ProcessExecution(taskDto.command, taskDto.args || [], taskDto.options || {});
}

export function getShellExecution(taskDto: TaskDto): types.ShellExecution {
  if (taskDto.command && Array.isArray(taskDto.args) && taskDto.args.length !== 0) {
    return new types.ShellExecution(taskDto.command, taskDto.args, taskDto.options || {});
  }
  return new types.ShellExecution(taskDto.command || taskDto.commandLine, taskDto.options || {});
}

export function getShellArgs(args: undefined | (string | vscode.ShellQuotedString)[]): string[] {
  if (!args || args.length === 0) {
    return [];
  }

  const element = args[0];
  if (typeof element === 'string') {
    return args as string[];
  }

  const result: string[] = [];
  const shellQuotedArgs = args as vscode.ShellQuotedString[];

  shellQuotedArgs.forEach((arg) => {
    result.push(arg.value);
  });

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getShellExecutionOptions(options: types.ShellExecutionOptions): { [key: string]: any } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = {} as { [key: string]: any };

  const env = options.env;
  if (env) {
    result['env'] = env;
  }

  const executable = options.executable;
  if (executable) {
    result['executable'] = executable;
  }

  const shellQuoting = options.shellQuoting;
  if (shellQuoting) {
    result['shellQuoting'] = shellQuoting;
  }

  const shellArgs = options.shellArgs;
  if (shellArgs) {
    result['shellArgs'] = shellArgs;
  }

  const cwd = options.cwd;
  if (cwd) {
    Object.assign(result, { cwd });
  }

  return result;
}
