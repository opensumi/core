/* eslint-disable @typescript-eslint/ban-types */
interface CustomPromisify<TCustom extends Function> extends Function {
  __promisify__: TCustom;
}

export function promisify<TCustom extends Function>(fn: CustomPromisify<TCustom>): TCustom;
export function promisify<TResult>(fn: (callback: (err: any, result: TResult) => void) => void): () => Promise<TResult>;
export function promisify(fn: (callback: (err?: any) => void) => void): () => Promise<void>;
export function promisify<T1, TResult>(
  fn: (arg1: T1, callback: (err: any, result: TResult) => void) => void,
): (arg1: T1) => Promise<TResult>;
export function promisify<T1>(fn: (arg1: T1, callback: (err?: any) => void) => void): (arg1: T1) => Promise<void>;
export function promisify<T1, T2, TResult>(
  fn: (arg1: T1, arg2: T2, callback: (err: any, result: TResult) => void) => void,
): (arg1: T1, arg2: T2) => Promise<TResult>;
export function promisify<T1, T2>(
  fn: (arg1: T1, arg2: T2, callback: (err?: any) => void) => void,
): (arg1: T1, arg2: T2) => Promise<void>;
export function promisify<T1, T2, T3, TResult>(
  fn: (arg1: T1, arg2: T2, arg3: T3, callback: (err: any, result: TResult) => void) => void,
): (arg1: T1, arg2: T2, arg3: T3) => Promise<TResult>;
export function promisify<T1, T2, T3>(
  fn: (arg1: T1, arg2: T2, arg3: T3, callback: (err?: any) => void) => void,
): (arg1: T1, arg2: T2, arg3: T3) => Promise<void>;
export function promisify<T1, T2, T3, T4, TResult>(
  fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, callback: (err: any, result: TResult) => void) => void,
): (arg1: T1, arg2: T2, arg3: T3, arg4: T4) => Promise<TResult>;
export function promisify<T1, T2, T3, T4>(
  fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, callback: (err?: any) => void) => void,
): (arg1: T1, arg2: T2, arg3: T3, arg4: T4) => Promise<void>;
export function promisify<T1, T2, T3, T4, T5, TResult>(
  fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5, callback: (err: any, result: TResult) => void) => void,
): (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5) => Promise<TResult>;
export function promisify<T1, T2, T3, T4, T5>(
  fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5, callback: (err?: any) => void) => void,
): (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5) => Promise<void>;
export function promisify(fn: Function): Function {
  // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html#this-parameters-in-callbacks
  return function (this: void, ...args: any[]) {
    const that = this;
    return new Promise((resolve, reject) => {
      const callback = (err: Error, result: any) => {
        if (err) {
          reject(err);
        }
        resolve(result);
      };
      const newArgs = args.concat(callback);
      fn.apply(that, newArgs);
    });
  };
}
