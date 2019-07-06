const _hasOwnProperty = Object.prototype.hasOwnProperty;

export function deepFreeze<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
      return obj;
  }
  const stack: any[] = [obj];
  while (stack.length > 0) {
      const objectToFreeze = stack.shift();
      Object.freeze(objectToFreeze);
      for (const key in objectToFreeze) {
          if (_hasOwnProperty.call(objectToFreeze, key)) {
              const prop = objectToFreeze[key];
              if (typeof prop === 'object' && !Object.isFrozen(prop)) {
                  stack.push(prop);
              }
          }
      }
  }
  return obj;
}