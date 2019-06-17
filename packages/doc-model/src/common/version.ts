import { URI } from '@ali/ide-core-common';

export enum VersionType {
  browser = 0,
  raw = 1,
}

export interface IVersion {
  id: number;
  type: VersionType;
}

export interface IVersionMirror {
  id: number;
  baseId: number;
  uri: URI;
}

export class Version implements IVersion {
  protected _id: number;
  protected _type = VersionType.raw;

  static init(type: VersionType) {
    return new Version(0, type);
  }

  static from(id: number, type: VersionType) {
    return new Version(id, type);
  }

  static next(version: IVersion) {
    return new Version(version.id + 1, version.type);
  }

  static equal(v1: IVersion, v2: IVersion) {
    return (v1.id === v2.id) && (v1.type === v2.type);
  }

  constructor(id: number, type: VersionType) {
    this._id = id;
    this._type = type;
  }

  get id() {
    return this._id;
  }

  get type() {
    return this._type;
  }

  toJSON() {
    return {
      id: this._id,
      type: this._type,
    };
  }
}
