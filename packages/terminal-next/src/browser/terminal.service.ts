import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { isElectronEnv, uuid, Emitter } from '@ali/ide-core-common';
import { electronEnv } from '@ali/ide-core-browser';
import { WSChanneHandler as IWSChanneHandler } from '@ali/ide-connection';
import { ITerminalServiceClient, ITerminalServicePath } from '@ali/ide-terminal2/lib/common';
import { Terminal } from 'xterm';
import { ITerminalExternalService } from '../common';

export interface EventMessage {
  data: string;
}

export interface WebSocketLike {
  addEventListener: (type: string, event: EventMessage) => void;
  removeEventListener: (tyoe: string) => void;
  readyState: number;
}
