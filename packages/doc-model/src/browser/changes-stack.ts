import { Version } from '../common';

export enum ChangesStackSignType {
  base = 0,
  future = 1,
  past = 2,
}

/**
 * TODO: 逻辑需要详细说明
 */
export class ChangesStack {
  /**
   * 距离基版本的绝对修改，
   * 这意味着它可能落后于版本，也可能在版本前面
   */
  private future: Array<monaco.editor.IModelContentChange> = [];
  /**
   * 记录 redo 后远离基版本的距离
   */
  private past: Array<monaco.editor.IModelContentChange> = [];
  /**
   * 符号，标记当前在基版本之前还是之后，注意这是一个逻辑上的符号
   */
  private _sign: ChangesStackSignType = ChangesStackSignType.base;

  static mergeTimeout = 500;

  private _mergeChanges(a: monaco.editor.IModelContentChange[], b: monaco.editor.IModelContentChange[]): monaco.editor.IModelContentChange[] {
    return a.concat(b);
  }

  private _mergeOthers(a: monaco.editor.IModelContentChange[], future = true) {
    if (future) {
      this.future = this._mergeChanges(this.future, a);
    } else {
      this.past = this._mergeChanges(this.past, a);
    }
  }

  private _popMany(count: number, future = true) {
    for (let i = 0; i < count; i++) {
      future ? this.future.pop() : this.past.pop();
    }
  }

  forward(changes: monaco.editor.IModelContentChange[]) {
    this._mergeOthers(changes);
    this._sign = ChangesStackSignType.future;
  }

  undo(changes: monaco.editor.IModelContentChange[]) {
    switch (this.sign) {
      case ChangesStackSignType.base:
        this._mergeOthers(changes, false);
        this._sign = ChangesStackSignType.past;
        break;
      case ChangesStackSignType.past:
        this._mergeOthers(changes, false);
        break;
      case ChangesStackSignType.future:
        this._popMany(changes.length);
        break;
      default:
        break;
    }

    if (this.future.length === 0) {
      this._sign = ChangesStackSignType.base;
    }
  }

  redo(changes: monaco.editor.IModelContentChange[]) {
    switch (this.sign) {
      case ChangesStackSignType.base:
        this._mergeOthers(changes);
        this._sign = ChangesStackSignType.future;
        break;
      case ChangesStackSignType.future:
        this._mergeOthers(changes);
        break;
      case ChangesStackSignType.past:
        this._popMany(changes.length, false);
        break;
      default:
        break;
    }

    if (this.future.length === 0) {
      this._sign = ChangesStackSignType.base;
    }
  }

  clear() {
    this.save();
  }

  save() {
    this.future = [];
    this.past = [];
    this._sign = ChangesStackSignType.base;
  }

  get isClear() {
    return (this.future.length === 0) && (this.past.length === 0) && (this.sign === ChangesStackSignType.base);
  }

  get value() {
    return this.past.concat(this.future);
  }

  get sign() {
    return this._sign;
  }
}
