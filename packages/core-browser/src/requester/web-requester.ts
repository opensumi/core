import { Requester, Request } from '@ali/ide-core';
import { Subject, from } from 'rxjs';
import { map, take, filter, combineLatest } from 'rxjs/operators';
import { connect } from 'socket.io-client';

export class WebRequester extends Requester {
  ws: SocketIOClient.Socket;

  response$ = new Subject<[string, any, any]>();

  constructor(host?: string) {
    super();

    if (host) {
      this.ws = connect(host);
    } else {
      this.ws = connect();
    }

    this.ws.on('response', (retId: string, error: any, result: any) => {
      this.response$.next([retId, error, result]);
    });
  }

  async sendRequest(request: Request) {
    const id = String(Date.now());
    this.ws.emit('request', id, request);
    return id;
  }

  async send<T>(request: Request): Promise<T> {
    const id$ = from(this.sendRequest(request));

    const result$ = id$.pipe(
      combineLatest(this.response$),
      filter(([id, [retId]]) => id === retId),
      map(([_id, [_retId, error, result]]) => {
        if (error) {
          throw error;
        }

        return result;
      }),
      take(1),
    );

    return result$.toPromise();
  }
}
