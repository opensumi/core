import stream = require('stream');

/**
 * A Node stream like `/dev/null`.
 *
 * Writing goes to a black hole, reading returns `EOF`.
 */
export class DevNullStream extends stream.Duplex {
  _write(chunk: any, encoding: string, callback: (err?: Error) => void): void {
    callback();
  }

  _read(size: number): void {
    this.push(null);
  }
}
