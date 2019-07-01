export enum VersionType {
  browser = 'browser',
  raw = 'raw',
}

export interface IVersion {
  id: number;
  type: VersionType;
}

export class Version implements IVersion {
  protected _id: number;
  protected _type = VersionType.raw;

  /**
   * 初始化一个新的版本号，0 开始
   * @param type
   */
  static init(type: VersionType) {
    return new Version(0, type);
  }

  /**
   * 从一个已有的版本号生成一个相同版本号
   * @param id
   * @param type
   */
  static from(id: number | IVersion, type: VersionType = VersionType.raw): Version {
    if (typeof id === 'number') {
      return new Version(id, type);
    } else {
      return new Version(id.id, id.type);
    }
  }

  /**
   * 从一个旧的版本号生成下一个新的版本号
   * @param version
   */
  static next(version: IVersion) {
    return new Version(version.id + 1, version.type);
  }

  /**
   * 判断两个版本好是否相同
   * @param v1
   * @param v2
   */
  static equal(v1: IVersion, v2: IVersion) {
    return (v1.id === v2.id) && (v1.type === v2.type);
  }

  /**
   * 判断两个版本号类型相同但 id 不同
   * @param v1
   * @param v2
   */
  static diff(v1: IVersion, v2: IVersion) {
    return (v1.id !== v2.id) && (v1.type === v2.type);
  }

  /**
   * 判断两个版本号是否完全相同
   * @param v1
   * @param v2
   */
  static same(v1: IVersion, v2: IVersion) {
    return v1.type === v2.type;
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
