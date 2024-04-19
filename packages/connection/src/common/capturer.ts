import { isUint8Array, randomString, transformErrorForSerialization } from '@opensumi/ide-core-common';

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
  requestId?: string | number;
  status?: ResponseStatus;
  data?: any;
  error?: any;

  source?: string;
}

const _global = (typeof window !== 'undefined' ? window : global) || {
  __OPENSUMI_DEVTOOLS_GLOBAL_HOOK__: undefined,
};

export function getCapturer() {
  const hook = _global.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__;
  if (hook) {
    return hook.captureRPC;
  }
  return;
}

export class Capturer {
  capturer: (data: any) => void;
  prefix: string;

  constructor(protected source: string) {
    this.prefix = randomString(6);
  }

  capture(message: ICapturedMessage): void {
    this.capturer = getCapturer();
    if (!this.capturer) {
      return;
    }

    const data: ICapturedMessage = {
      ...message,
      source: this.source,
    };

    if (data.data) {
      if (isUint8Array(data.data)) {
        data.data = '<Uint8Array>';
      }
    }

    if (message.requestId) {
      data.requestId = `${this.prefix}-${message.requestId}`;
    }

    if (message.error) {
      data.error = transformErrorForSerialization(message.error);
    }

    this.capturer(data);
  }

  captureOnRequest(requestId: ICapturedMessage['requestId'], serviceMethod: string, args: any[]): void {
    this.capture({ type: MessageType.OnRequest, requestId: `↓${requestId}`, serviceMethod, arguments: args });
  }

  captureOnRequestResult(requestId: ICapturedMessage['requestId'], serviceMethod: string, data: any): void {
    this.capture({
      type: MessageType.OnRequestResult,
      status: ResponseStatus.Success,
      requestId: `↓${requestId}`,
      serviceMethod,
      data,
    });
  }

  captureOnRequestFail(requestId: ICapturedMessage['requestId'], serviceMethod: string, error: any): void {
    this.capture({
      type: MessageType.OnRequestResult,
      status: ResponseStatus.Fail,
      requestId: `↓${requestId}`,
      serviceMethod,
      error,
    });
  }

  captureSendRequest(requestId: ICapturedMessage['requestId'] | number, serviceMethod: string, args: any[]): void {
    this.capture({ type: MessageType.SendRequest, requestId, serviceMethod, arguments: args });
  }

  captureSendRequestResult(requestId: ICapturedMessage['requestId'], serviceMethod: string, data: any): void {
    this.capture({
      type: MessageType.RequestResult,
      status: ResponseStatus.Success,
      requestId,
      serviceMethod,
      data,
    });
  }

  captureSendRequestFail(requestId: ICapturedMessage['requestId'], serviceMethod: string, error: any): void {
    this.capture({
      type: MessageType.RequestResult,
      status: ResponseStatus.Fail,
      requestId,
      serviceMethod,
      error,
    });
  }

  captureSendNotification(requestId: ICapturedMessage['requestId'], serviceMethod: string, args: any[]): void {
    this.capture({ type: MessageType.SendNotification, serviceMethod, arguments: args, requestId });
  }

  captureOnNotification(requestId: ICapturedMessage['requestId'], serviceMethod: string, args: any[]): void {
    this.capture({ type: MessageType.OnNotification, serviceMethod, arguments: args, requestId: `↓${requestId}` });
  }
}
