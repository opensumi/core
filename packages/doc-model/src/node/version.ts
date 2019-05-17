import { URI } from '@ali/ide-core-node';

export class VersionRecord {
  private uri: URI;
  private type: string;
  private stamp: number;

  constructor(uri: string | URI, type: string, stamp: number) {
    this.uri = new URI(uri.toString());
    this.type = type;
    this.stamp = stamp;
  }

  static fromJSON(json: {
    uri: string | URI,
    type: string,
    stamp: number,
  }) {
    return new VersionRecord(json.uri, json.type, json.stamp);
  }

  static next(record: VersionRecord) {
    return VersionRecord.fromJSON({
      ...record.toJSON(),
      stamp: record.stamp + 1,
    })
  }

  toString() {
    return `${this.type}:${this.stamp}`;
  }

  toJSON() {
    return {
      uri: this.uri.toString(),
      type: this.type,
      stamp: this.stamp,
    }
  }
}
