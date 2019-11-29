import * as net from 'net';
import * as vscode from 'vscode';
import { DebugStreamConnection, DebugAdapterForkExecutable } from '@ali/ide-debug';
import { ChildProcess, spawn, fork, SpawnOptions } from 'child_process';
import URI from 'vscode-uri';

/**
 * 启动调试适配器进程
 */
export function startDebugAdapter(executable: vscode.DebugAdapterExecutable): DebugStreamConnection {
  const options: any = { stdio: ['pipe', 'pipe', 2] };

  if (executable.options) {
    options.cwd = executable.options.cwd;
    options.env = Object.assign({}, process.env);
    Object.assign(options.env, executable.options.env);
  }

  let env = {
    ...process.env,
  };
  if (options.env) {
    env = {
      ...env,
      ...options.env,
    };
  }

  let childProcess: ChildProcess;

  if ('command' in executable) {
    const { command, args } = executable;
    const spawnOptions: SpawnOptions = {
      env,
    };
    if (options.cwd) {
      spawnOptions.cwd = options.cwd;
    }
    childProcess = spawn(command, args, spawnOptions);
  } else if ('modulePath' in executable) {
    const forkExecutable = executable as DebugAdapterForkExecutable;
    const { modulePath, args } = forkExecutable;
    options.stdio.push('ipc');
    childProcess = fork(modulePath, args, options);
  } else {
    throw new Error(`It is not possible to launch debug adapter with the command: ${JSON.stringify(executable)}`);
  }
  return {
    input: childProcess.stdin,
    output: childProcess.stdout,
    dispose: () => childProcess.kill(),
  };
}

/**
 * 链接远程调试服务
 */
export function connectDebugAdapter(server: vscode.DebugAdapterServer): DebugStreamConnection {
  const socket = net.createConnection(server.port, server.host);
  return {
    input: socket,
    output: socket,
    dispose: () => socket.end(),
  };
}
