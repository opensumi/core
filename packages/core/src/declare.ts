export type ConstructorOf<T, K extends any[] = any[]> = new (...args: K) => T;

export class Disposable {
  protected disposations = new Set<() => void>();

  dispose() {
    const arr = Array.from(this.disposations);
    arr.forEach((fn) => fn());
  }
}
