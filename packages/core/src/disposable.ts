/**
 * 可销毁对象相关的接口定义和基本 class 定义
 */

export interface IDisposable {
  disposations: Set<() => void>;
  dispose: () => void;
}

export class Disposable implements IDisposable {
  disposations = new Set<() => void>();

  dispose() {
    const arr = Array.from(this.disposations);
    arr.forEach((fn) => fn());
  }
}
