/**
 * 为了模拟断连而设计的 pty 和 proxy 服务
 */
import os from 'os';

import httpProxy from 'http-proxy';
import * as pty from 'node-pty';
import WebSocket from 'ws';

import { WSChannel } from '@opensumi/ide-connection';
import { createWSChannelForClient } from '@opensumi/ide-connection/__test__/common/ws-channel';
import { WSWebSocketConnection } from '@opensumi/ide-connection/lib/common/connection';
import { uuid } from '@opensumi/ide-core-browser';

function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

let port = getRandomInt(30000, 40000);
let proxyPort = port + getRandomInt(100, 200);
export function resetPort() {
  port = getRandomInt(30000, 40000);
  proxyPort = port + getRandomInt(100, 200);
}
export function getPort() {
  return port;
}
export function getProxyPort() {
  return proxyPort;
}
export const existPtyProcessId = uuid();
const cache = new Map<string, pty.IPty>();
const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

export function localhost(port: number) {
  return `ws://localhost:${port}`;
}

export interface PtyStdOut {
  sessionId: string;
  data: string;
}

export interface PtyStdIn {
  sessionId: string;
  data: string;
}

export interface RPCRequest<T = any> {
  id: string;
  method: string;
  params: T;
}

export interface RPCResponse<T = any> {
  id: string;
  method: string;
  data: T;
}

export enum MessageMethod {
  create = 'create',
  resize = 'resize',
  close = 'close',
}

function _makeResponse(json: RPCRequest, data: any) {
  return {
    id: json.id,
    method: json.method,
    data,
  };
}

export function killPty(json: RPCRequest<{ sessionId: string }>) {
  const { sessionId } = json.params;
  const ptyProcess = cache.get(sessionId);

  if (ptyProcess) {
    ptyProcess.kill();
  }

  return _makeResponse(json, { sessionId });
}

export function createPty(
  channel: WSChannel,
  json: RPCRequest<{ sessionId: string; cols: number; rows: number }>,
): RPCResponse<{ sessionId: string }> {
  const { sessionId, cols, rows } = json.params;

  const ptyProcess = pty.spawn(shell, [], {
    name: shell,
    cols,
    rows,
    cwd: process.env.HOME,
    env: process.env as any,
  });

  ptyProcess.onData((data) => {
    // handleStdOutMessage
    channel.send(JSON.stringify({ sessionId, data } as PtyStdOut));
  });

  ptyProcess.onExit(() => {
    try {
      channel.close();
    } catch (_e) {}
  });

  cache.set(sessionId, ptyProcess);
  return _makeResponse(json, { sessionId });
}

export function resizePty(json: RPCRequest<{ sessionId: string; cols: number; rows: number }>) {
  const { sessionId, cols, rows } = json.params;
  const ptyProcess = cache.get(sessionId);

  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
  }
  return _makeResponse(json, { sessionId });
}

export function handleServerMethod(channel: WSChannel, json: RPCRequest): RPCResponse {
  switch (json.method) {
    case MessageMethod.create:
      return createPty(channel, json);
    case MessageMethod.resize:
      return resizePty(json);
    case MessageMethod.close:
      return killPty(json);
    default:
      throw new Error(`Method ${json.method} not supported`);
  }
}

export function handleStdinMessage(json: PtyStdIn) {
  const ptyProcess = cache.get(json.sessionId);
  if (ptyProcess) {
    ptyProcess.write(json.data);
  }
}

export function createWsServer() {
  const server = new WebSocket.Server({ port: getPort() });
  server.on('connection', (socket) => {
    const channel = createWSChannelForClient(new WSWebSocketConnection(socket), {
      id: 'ws-server',
    });

    channel.onMessage((data) => {
      const json = JSON.parse(data.toString());

      if (json.method) {
        const res = handleServerMethod(channel, json);
        channel.send(JSON.stringify(res));
      } else {
        handleStdinMessage(json);
      }
    });

    socket.on('error', () => {});
  });

  return server;
}

export function createProxyServer() {
  return httpProxy
    .createServer({
      target: localhost(getPort()),
      ws: true,
    })
    .listen(getProxyPort());
}
