export type ChannelMessage =
  | PingMessage
  | PongMessage
  | OpenMessage
  | ServerReadyMessage
  | DataMessage
  | BinaryMessage
  | CloseMessage
  | ErrorMessage;

/**
 * `ping` and `pong` are used to detect whether the connection is alive.
 */
export interface PingMessage {
  kind: 'ping';
  id: string;
}

/**
 * when server receive a `ping` message, it should reply a `pong` message, vice versa.
 */
export interface PongMessage {
  kind: 'pong';
  id: string;
}

/**
 * `data` message indicate that the channel has received some data.
 * the `content` field is the data, it should be a string.
 */
export interface DataMessage {
  kind: 'data';
  id: string;
  content: string;
}

export interface BinaryMessage {
  kind: 'binary';
  id: string;
  binary: Uint8Array;
}

export interface CloseMessage {
  kind: 'close';
  id: string;
  code: number;
  reason: string;
}

/**
 * `open` message is used to open a new channel.
 * `path` is used to identify which handler should be used to handle the channel.
 * `clientId` is used to identify the client.
 */
export interface OpenMessage {
  kind: 'open';
  id: string;
  path: string;
  clientId: string;
  connectionToken: string;
}

export enum ErrorMessageCode {
  ChannelNotFound = 1,
}

export interface ErrorMessage {
  kind: 'error';
  id: string;
  code: ErrorMessageCode;
  message: string;
}

/**
 * when server receive a `open` message, it should reply a `server-ready` message.
 * this is indicate that the channel is ready to use.
 */
export interface ServerReadyMessage {
  kind: 'server-ready';
  id: string;
  token: string;
}
