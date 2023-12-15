import type net from 'net';
import { Stream } from 'stream';

import { IDisposable, Sequencer } from '@opensumi/ide-core-common';

import { BaseConnection } from './base';
import { SumiStreamPacketDecoder, createSumiStreamPacket } from './stream-packet';

export class NetSocketConnection extends BaseConnection<Uint8Array> {
  stream: Stream;
  encoding = 'utf8';
  sequencer = new Sequencer();

  constructor(private socket: net.Socket) {
    super();
    this.stream = socket.pipe(new SumiStreamPacketDecoder());
  }

  send(data: Uint8Array): void {
    this.sequencer.queue(async () => {
      await new Promise<void>((resolve, reject) => {
        this.socket.write(createSumiStreamPacket(data), this.encoding, (err: Error) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      }).catch((err) => {
        this.onError(err);
      });
    });
  }

  onMessage(cb: (data: Uint8Array) => void): IDisposable {
    const handler = (data: Uint8Array) => {
      cb(data);
    };
    this.stream.on('data', handler);
    return {
      dispose: () => {
        this.stream.off('data', handler);
      },
    };
  }

  onceClose(cb: () => void): IDisposable {
    this.socket.once('close', cb);
    return {
      dispose: () => {
        this.socket.off('close', cb);
      },
    };
  }

  onOpen(cb: () => void): IDisposable {
    this.socket.on('connect', cb);
    return {
      dispose: () => {
        this.socket.off('connect', cb);
      },
    };
  }

  onError(cb: (err: Error) => void): IDisposable {
    this.socket.on('error', cb);
    return {
      dispose: () => {
        this.socket.off('error', cb);
      },
    };
  }
}
