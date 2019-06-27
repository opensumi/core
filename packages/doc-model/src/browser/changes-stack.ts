import { Version } from '../common';

export enum ChangesStackSignType {
  equal = 0,
  front = 1,
  behind = 2,
}

/**
 * TODO: 逻辑需要详细说明
 */
export class ChangesStack {
  /**
   * 距离基版本的绝对修改，
   * 这意味着它可能落后于版本，也可能在版本前面
   */
  private absoluteStack: Array<monaco.editor.IModelContentChange[]> = [];
  /**
   * 记录 redo 后远离基版本的距离
   */
  private behindStack: Array<monaco.editor.IModelContentChange[]> = [];
  /**
   * 符号，标记当前在基版本之前还是之后，注意这是一个逻辑上的符号
   */
  private _sign: ChangesStackSignType = ChangesStackSignType.equal;

  forward(changes: monaco.editor.IModelContentChange[]) {
    this.absoluteStack.push(changes);
    this._sign = ChangesStackSignType.front;
  }

  undo(changes: monaco.editor.IModelContentChange[]) {
    switch (this.sign) {
      case ChangesStackSignType.equal:
        this.behindStack.push(changes);
        this._sign = ChangesStackSignType.behind;
        break;
      case ChangesStackSignType.behind:
        this.behindStack.push(changes);
        break;
      case ChangesStackSignType.front:
        this.absoluteStack.pop();
        break;
      default:
        break;
    }

    if (this.absoluteStack.length === 0) {
      this._sign = ChangesStackSignType.equal;
    }
  }

  redo(changes: monaco.editor.IModelContentChange[]) {
    switch (this.sign) {
      case ChangesStackSignType.equal:
        this.absoluteStack.push(changes);
        this._sign = ChangesStackSignType.front;
        break;
      case ChangesStackSignType.front:
        this.absoluteStack.push(changes);
        break;
      case ChangesStackSignType.behind:
        this.behindStack.pop();
        break;
      default:
        break;
    }

    if (this.absoluteStack.length === 0) {
      this._sign = ChangesStackSignType.equal;
    }
  }

  clear() {
    this.save();
  }

  save() {
    this.absoluteStack = [];
    this.behindStack = [];
    this._sign = ChangesStackSignType.equal;
  }

  get isClear() {
    return (this.absoluteStack.length === 0) && (this.sign === ChangesStackSignType.equal);
  }

  get value() {
    return  this.behindStack.reverse().concat(this.absoluteStack);
  }

  get sign() {
    return this._sign;
  }
}
