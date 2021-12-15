export class IdGenerator {
  private _prefix: string;
  private _lastId: number;

  constructor(prefix: string) {
    this._prefix = prefix;
    this._lastId = 0;
  }

  public nextId(): string {
    return this._prefix + ++this._lastId;
  }
}

export const defaultGenerator = new IdGenerator('id#');
