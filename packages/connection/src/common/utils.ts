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

export function stringify(obj: any): string {
  return JSON.stringify(obj);
}

export function parse(input: string, reviver?: (this: any, key: string, value: any) => any): any {
  return JSON.parse(input, reviver);
}

export function getCapturer() {
  if (typeof window !== 'undefined' && window.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__?.captureRPC) {
    return window.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__.captureRPC;
  }
  return;
}
