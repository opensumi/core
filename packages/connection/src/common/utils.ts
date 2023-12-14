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

export function stringify(obj: ChannelMessage): string {
  return JSON.stringify(obj);
}

export function parse(input: string, reviver?: (this: any, key: string, value: any) => any): ChannelMessage {
  return JSON.parse(input, reviver);
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
