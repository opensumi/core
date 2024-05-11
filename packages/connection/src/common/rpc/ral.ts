/**
 * Runtime Abstract Layer
 */

const globals =
  typeof self === 'object'
    ? self
    : typeof global === 'object'
    ? global
    : typeof window === 'object'
    ? window
    : ({} as any);

let _wrapper: ((callback: (...args: any[]) => void) => void) | null = null;
export function runInNextTick(callback: (...args: any[]) => void): void {
  if (_wrapper === null) {
    if (globals.setImmediate) {
      _wrapper = globals.setImmediate.bind(globals);
    } else if (typeof process !== 'undefined' && typeof process.nextTick === 'function') {
      _wrapper = process.nextTick.bind(process);
    } else {
      _wrapper = globals.setTimeout.bind(globals);
    }
  }
  return _wrapper!(callback);
}
