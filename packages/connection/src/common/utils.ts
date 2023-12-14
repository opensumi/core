import Fury, { Type } from '@furyjs/fury';

import { ChannelMessage } from './ws-channel';

declare global {
  interface Window {
    __OPENSUMI_DEVTOOLS_GLOBAL_HOOK__: any;
  }
}

export enum MessageType {
  SendNotification = 'sendNotification',
  SendRequest = 'sendRequest',
  RequestResult = 'requestResult',
  OnNotification = 'onNotification',
  OnRequest = 'onRequest',
  OnRequestResult = 'onRequestResult',
}

export enum ResponseStatus {
  Success = 'success',
  Fail = 'fail',
}

export interface ICapturedMessage {
  type: MessageType;
  serviceMethod: string;
  arguments?: any;
  requestId?: string;
  status?: ResponseStatus;
  data?: any;
  error?: any;
}

export interface ConnectionInfo {
  type: string;
  downlink: number;
  uplink: number;
  rtt: number;
}

export interface WSCloseInfo {
  channelPath: string;
  closeEvent: { code: number; reason: string };
  connectInfo: ConnectionInfo;
}

export function getCapturer() {
  if (typeof window !== 'undefined' && window.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__?.captureRPC) {
    return window.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__.captureRPC;
  }
  return;
}

export function getServiceMethods(service: any): string[] {
  let props: any[] = [];

  if (/^\s*class/.test(service.constructor.toString())) {
    let obj = service;
    do {
      props = props.concat(Object.getOwnPropertyNames(obj));
    } while ((obj = Object.getPrototypeOf(obj)));
    props = props.sort().filter((e, i, arr) => e !== arr[i + 1] && typeof service[e] === 'function');
  } else {
    for (const prop in service) {
      if (service[prop] && typeof service[prop] === 'function') {
        props.push(prop);
      }
    }
  }

  return props;
}

export function getNotificationName(serviceName: string, name: string) {
  return `on:${serviceName}:${name}`;
}
export function getRequestName(serviceName: string, name: string) {
  return `${serviceName}:${name}`;
}

export function getMethodName(serviceName: string, name: string) {
  return name.startsWith('on') ? getNotificationName(serviceName, name) : getRequestName(serviceName, name);
}

/**
 * @furyjs/hps use v8's fast-calls-api that can be called directly by jit, ensure that the version of Node is 20 or above.
 * Experimental feature, installation success cannot be guaranteed at this moment
 **/
// import hps from '@furyjs/hps';

const hps = undefined;

const fury = new Fury({ hps });

export const wsChannelProtocol = Type.object('ws-channel-protocol', {
  kind: Type.string(),
  clientId: Type.string(),
  id: Type.string(),
  path: Type.string(),
  content: Type.string(),
  code: Type.uint32(),
  reason: Type.string(),
});

const wsChannelProtocolSerializer = fury.registerSerializer(wsChannelProtocol);

export function stringify(obj: ChannelMessage): Uint8Array {
  return wsChannelProtocolSerializer.serialize(obj);
}

export function parse(input: Uint8Array): ChannelMessage {
  return wsChannelProtocolSerializer.deserialize(input) as any;
}
