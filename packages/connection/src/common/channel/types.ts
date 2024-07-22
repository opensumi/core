export type ChannelMessage =
  | PingMessage
  | PongMessage
  | OpenMessage
  | ServerReadyMessage
  | DataMessage
  | BinaryMessage
  | CloseMessage
  | ErrorMessage;

export interface BaseMessage {
  kind: string;
  id: string;
  traceId?: string;
}

/**
 * `ping` and `pong` are used to detect whether the connection is alive.
 */
export interface PingMessage extends BaseMessage {
  kind: 'ping';
}

/**
 * when server receive a `ping` message, it should reply a `pong` message, vice versa.
 */
export interface PongMessage extends BaseMessage {
  kind: 'pong';
}

/**
 * `data` message indicate that the channel has received some data.
 * the `content` field is the data, it should be a string.
 */
export interface DataMessage extends BaseMessage {
  kind: 'data';
  content: string;
}

export interface BinaryMessage extends BaseMessage {
  kind: 'binary';
  binary: Uint8Array;
}

export interface CloseMessage extends BaseMessage {
  kind: 'close';
  code: number;
  reason: string;
}

/**
 * `open` message is used to open a new channel.
 * `path` is used to identify which handler should be used to handle the channel.
 * `clientId` is used to identify the client.
 */
export interface OpenMessage extends BaseMessage {
  kind: 'open';
  path: string;
  clientId: string;
  traceId: string;
}

export enum ErrorMessageCode {
  ChannelNotFound = 1,
}

export interface ErrorMessage extends BaseMessage {
  kind: 'error';
  id: string;
  code: ErrorMessageCode;
  message: string;
}

/**
 * when server receive a `open` message, it should reply a `server-ready` message.
 * this is indicate that the channel is ready to use.
 */
export interface ServerReadyMessage extends BaseMessage {
  kind: 'server-ready';
  id: string;
  traceId: string;
}
