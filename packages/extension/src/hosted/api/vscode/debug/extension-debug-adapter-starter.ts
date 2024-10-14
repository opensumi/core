import assert from 'assert';
import { ChildProcess, SpawnOptions, fork, spawn } from 'child_process';
import { EventEmitter } from 'events';
import net from 'net';
import stream from 'stream';

import { DebugAdapterForkExecutable, DebugStreamConnection } from '@opensumi/ide-debug';

import { CustomChildProcess, CustomChildProcessModule } from '../../../../common/ext.process';

import { DirectDebugAdapter } from './abstract-debug-adapter-session';

import type vscode from 'vscode';

/**
 * 启动调试适配器进程
 */
export function startDebugAdapter(
  executable: vscode.DebugAdapterExecutable,
  cp?: CustomChildProcessModule,
): DebugStreamConnection {
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

  let childProcess: ChildProcess | CustomChildProcess;

  if ('command' in executable) {
    const { command, args } = executable;
    const spawnOptions: SpawnOptions = {
      env,
    };
    if (options.cwd) {
      spawnOptions.cwd = options.cwd;
    }

    childProcess = cp ? cp.spawn(command, args, spawnOptions) : spawn(command, args, spawnOptions);
  } else if ('modulePath' in executable) {
    const forkExecutable = executable as unknown as DebugAdapterForkExecutable;
    const { modulePath, args } = forkExecutable;
    options.stdio.push('ipc');
    childProcess = fork(modulePath, args, options);
  } else {
    throw new Error(`It is not possible to launch debug adapter with the command: ${JSON.stringify(executable)}`);
  }

  assert(childProcess.stdin, 'child process spawn failed');
  assert(childProcess.stdout, 'child process spawn failed');

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
  const socket = net.createConnection({
    port: server.port,
    host: server.host || '127.0.0.1',
  });
  return {
    input: socket,
    output: socket,
    dispose: () => socket.end(),
  };
}

/**
 * Custom MessageReader to parse DAP messages from the input stream
 */
class MessageReader extends EventEmitter {
  private contentLength: number = -1;
  private buffer: Buffer = Buffer.alloc(0);

  constructor(private input: stream.Readable) {
    super();
    input.on('data', this.onData.bind(this));
  }

  private onData(data: Buffer) {
    this.buffer = Buffer.concat([this.buffer, data]);

    while (true) {
      if (this.contentLength === -1) {
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) {
          break; // Not enough data
        }
        const header = this.buffer.slice(0, headerEnd).toString();
        const match = header.match(/Content-Length: (\d+)/);
        if (match) {
          this.contentLength = parseInt(match[1], 10);
          this.buffer = this.buffer.slice(headerEnd + 4);
        } else {
          this.emit('error', new Error('Invalid header'));
          return;
        }
      }

      if (this.buffer.length >= this.contentLength) {
        const messageBytes = this.buffer.slice(0, this.contentLength);
        this.buffer = this.buffer.slice(this.contentLength);
        this.contentLength = -1;

        const message = JSON.parse(messageBytes.toString());
        this.emit('message', message);
      } else {
        break; // Not enough data
      }
    }
  }
}

/**
 * Custom MessageWriter to serialize DAP messages to the output stream
 */
class MessageWriter {
  constructor(private output: stream.Writable) {}

  write(message: any) {
    const json = message;
    const contentLength = Buffer.byteLength(message, 'utf8');
    const header = `Content-Length: ${contentLength}\r\n\r\n`;
    this.output.write(header + json);
  }
}

/**
 * 直接调用插件自己实现的调试适配器
 * 这里通过 server 服务来拉起适配器
 * Modify directDebugAdapter to directly interface with DebugStreamConnection
 */
export function directDebugAdapter(id: string, da: vscode.DebugAdapter): DebugStreamConnection {
  const input = new stream.PassThrough();
  const output = new stream.PassThrough();

  const adapter = new DirectDebugAdapter(id, da);
  adapter.start();

  const reader = new MessageReader(input);
  const writer = new MessageWriter(output);

  // Pass messages from the input stream to the adapter
  reader.on('message', (message) => {
    adapter.sendMessage(message);
  });

  // Send messages from the adapter to the output stream
  adapter.onMessageReceived((message) => {
    writer.write(message);
  });

  return {
    input,
    output,
    dispose: () => {
      input.destroy();
      output.destroy();
      adapter.dispose();
    },
  };
}

/**
 * 通过 NamedPipe(在 Windows) 或者 UNIX Domain Socket(IPC socket)(非 Windows) 连接到适配器的实现
 */
export function namedPipeDebugAdapter(server: vscode.DebugAdapterNamedPipeServer): DebugStreamConnection {
  const socket = net.createConnection(server.path);
  return {
    input: socket,
    output: socket,
    dispose: () => socket.end(),
  };
}
