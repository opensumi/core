import {
  DisposableStore,
  IDisposable,
  isUint8Array,
  randomString,
  transformErrorForSerialization,
} from '@opensumi/ide-core-common';
import { DevtoolsLantencyCommand, EDevtoolsEvent } from '@opensumi/ide-core-common/lib/devtools';

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

const _global: any =
  typeof global === 'undefined'
    ? typeof window === 'undefined'
      ? {
          __OPENSUMI_DEVTOOLS_GLOBAL_HOOK__: undefined,
        }
      : window
    : global;

export function getCapturer() {
  const hook = _global.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__;
  if (hook) {
    return hook.captureRPC;
  }
  return;
}

export class Capturer implements IDisposable {
  protected _disposables = new DisposableStore();

  protected capturer: ((data: any) => void) | null = null;
  protected prefix: string;

  protected setupListener = (event: CustomEvent) => {
    const { command } = event.detail;
    if (command === DevtoolsLantencyCommand.Start) {
      this.capturer = getCapturer();
    } else if (command === DevtoolsLantencyCommand.Stop) {
      this.capturer = null;
    }
  };

  constructor(public source: string) {
    this.prefix = randomString(6);
    this.capturer = getCapturer();

    // capturer should only be used in browser environment
    if (typeof _global.addEventListener === 'function') {
      _global.addEventListener(EDevtoolsEvent.Latency, this.setupListener);
      this._disposables.add({
        dispose: () => {
          _global.removeEventListener(EDevtoolsEvent.Latency, this.setupListener);
        },
      });
    }
  }

  capture(message: ICapturedMessage): void {
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
    if (!this.capturer) {
      return;
    }

    this.capture({ type: MessageType.OnRequest, requestId: `↓${requestId}`, serviceMethod, arguments: args });
  }

  captureOnRequestResult(requestId: ICapturedMessage['requestId'], serviceMethod: string, data: any): void {
    if (!this.capturer) {
      return;
    }

    this.capture({
      type: MessageType.OnRequestResult,
      status: ResponseStatus.Success,
      requestId: `↓${requestId}`,
      serviceMethod,
      data,
    });
  }

  captureOnRequestFail(requestId: ICapturedMessage['requestId'], serviceMethod: string, error: any): void {
    if (!this.capturer) {
      return;
    }

    this.capture({
      type: MessageType.OnRequestResult,
      status: ResponseStatus.Fail,
      requestId: `↓${requestId}`,
      serviceMethod,
      error,
    });
  }

  captureSendRequest(requestId: ICapturedMessage['requestId'] | number, serviceMethod: string, args: any[]): void {
    if (!this.capturer) {
      return;
    }

    this.capture({ type: MessageType.SendRequest, requestId, serviceMethod, arguments: args });
  }

  captureSendRequestResult(requestId: ICapturedMessage['requestId'], serviceMethod: string, data: any): void {
    if (!this.capturer) {
      return;
    }

    this.capture({
      type: MessageType.RequestResult,
      status: ResponseStatus.Success,
      requestId,
      serviceMethod,
      data,
    });
  }

  captureSendRequestFail(requestId: ICapturedMessage['requestId'], serviceMethod: string, error: any): void {
    if (!this.capturer) {
      return;
    }

    this.capture({
      type: MessageType.RequestResult,
      status: ResponseStatus.Fail,
      requestId,
      serviceMethod,
      error,
    });
  }

  captureSendNotification(requestId: ICapturedMessage['requestId'], serviceMethod: string, args: any[]): void {
    if (!this.capturer) {
      return;
    }

    this.capture({ type: MessageType.SendNotification, serviceMethod, arguments: args, requestId });
  }

  captureOnNotification(requestId: ICapturedMessage['requestId'], serviceMethod: string, args: any[]): void {
    if (!this.capturer) {
      return;
    }

    this.capture({ type: MessageType.OnNotification, serviceMethod, arguments: args, requestId: `↓${requestId}` });
  }

  dispose(): void {
    this._disposables.dispose();
  }
}
