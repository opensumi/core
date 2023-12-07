import { PlatformBuffer } from '@opensumi/ide-core-common/lib/connection/types';

import { wsChannelProtocolSerializer } from './protocols/base';

import { ChannelMessage } from '.';

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

export function stringify(obj: ChannelMessage): PlatformBuffer {
  return wsChannelProtocolSerializer.serialize(obj);
}

export function parse(input: PlatformBuffer): any {
  return wsChannelProtocolSerializer.deserialize(input);
}

export function getCapturer() {
  if (typeof window !== 'undefined' && window.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__?.captureRPC) {
    return window.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__.captureRPC;
  }
  return;
}

type CheckIsValidMethod<T> = (obj: T) => boolean;

type ValueOf<T> = T[keyof T];

export function getServiceMethods<T extends object>(
  service: T,
  checkIsValidMethod?: CheckIsValidMethod<ValueOf<T>>,
): string[] {
  if (!checkIsValidMethod) {
    checkIsValidMethod = (obj: any) => typeof obj === 'function';
  }
  let props: any[] = [];

  if (/^\s*class/.test(service.constructor.toString())) {
    let obj = service;
    do {
      props = props.concat(Object.getOwnPropertyNames(obj));
    } while ((obj = Object.getPrototypeOf(obj)));
    props = props.sort().filter((e, i, arr) => e !== arr[i + 1] && checkIsValidMethod!(service[e]));
  } else {
    for (const prop in service) {
      if (checkIsValidMethod!(service[prop])) {
        props.push(prop);
      }
    }
  }

  return props;
}

function getNotificationName(tag: string, name: string) {
  return `on:${tag}:${name}`;
}
function getRequestName(tag: string, name: string) {
  return `${tag}:${name}`;
}

export function getMethodName(tag: string, name: string) {
  return name.startsWith('on') ? getNotificationName(tag, name) : getRequestName(tag, name);
}
