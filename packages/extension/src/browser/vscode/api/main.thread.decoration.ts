import { Injectable, Optional, Autowired } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { UriComponents, Uri as URI, Emitter, CancellationToken } from '@opensumi/ide-core-common';
import { IDisposable, dispose } from '@opensumi/ide-core-common/lib/disposable';
import { IDecorationsService, IDecorationData } from '@opensumi/ide-decoration';

import { ExtHostAPIIdentifier } from '../../../common/vscode';
import {
  IExtHostDecorationsShape,
  IMainThreadDecorationsShape,
  DecorationRequest,
  DecorationData,
} from '../../../common/vscode/decoration';

class DecorationRequestsQueue {
  private _idPool = 0;
  private _requests: { [id: number]: DecorationRequest } = Object.create(null);
  private _resolver: { [id: number]: (data: DecorationData) => any } = Object.create(null);

  private _timer: any;

  constructor(private readonly _proxy: IExtHostDecorationsShape) {
    //
  }

  enqueue(handle: number, uri: URI, token: CancellationToken): Promise<DecorationData> {
    const id = ++this._idPool;
    const result = new Promise<DecorationData>((resolve) => {
      this._requests[id] = { id, handle, uri };
      this._resolver[id] = resolve;
      this._processQueue();
    });
    token.onCancellationRequested(() => {
      delete this._requests[id];
      delete this._resolver[id];
    });
    return result;
  }

  private _processQueue(): void {
    if (typeof this._timer === 'number') {
      // already queued
      return;
    }
    this._timer = setTimeout(() => {
      // make request
      const requests = this._requests;
      const resolver = this._resolver;
      this._proxy.$provideDecorations(Object.values(requests), CancellationToken.None).then((data) => {
        // eslint-disable-next-line guard-for-in
        for (const id in resolver) {
          resolver[id](data[id]);
        }
      });

      // reset
      this._requests = [];
      this._resolver = [];
      this._timer = undefined;
    }, 0);
  }
}

@Injectable({ multiple: true })
export class MainThreadDecorations implements IMainThreadDecorationsShape {
  @Autowired(IDecorationsService)
  protected readonly decorationsService: IDecorationsService;

  private readonly proxy: IExtHostDecorationsShape;
  private readonly _provider = new Map<number, [Emitter<URI[]>, IDisposable]>();
  private readonly _requestQueue: DecorationRequestsQueue;

  constructor(@Optional(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostDecorations);
    this._requestQueue = new DecorationRequestsQueue(this.proxy);
  }

  dispose() {
    this._provider.forEach((value) => dispose(value));
    this._provider.clear();
  }

  $registerDecorationProvider(handle: number, label: string): void {
    const emitter = new Emitter<URI[]>();
    const registration = this.decorationsService.registerDecorationsProvider({
      label,
      onDidChange: emitter.event,
      provideDecorations: (uri, token) =>
        this._requestQueue.enqueue(handle, uri, token).then((data) => {
          if (!data) {
            return undefined;
          }
          const [propagate, tooltip, badge, themeColor] = data;
          return {
            weight: 10 /* 向下兼容 */,
            bubble: propagate || false,
            color: themeColor?.id,
            tooltip,
            letter: badge,
          } as IDecorationData;
        }),
    });
    this._provider.set(handle, [emitter, registration]);
  }

  $onDidChange(handle: number, resources: UriComponents[]): void {
    const provider = this._provider.get(handle);
    if (provider) {
      const [emitter] = provider;
      emitter.fire(resources && resources.map((r) => URI.revive(r)));
    }
  }

  $unregisterDecorationProvider(handle: number): void {
    const provider = this._provider.get(handle);
    if (provider) {
      dispose(provider);
      this._provider.delete(handle);
    }
  }
}
