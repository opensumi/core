import _debounce = require('lodash.debounce');
import _throttle = require('lodash.throttle');

export function debounce(wait, options = {}) {
  return (target, name, descriptor) => {
    return {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() {
        Object.defineProperty(this, name, {
          configurable: true,
          enumerable: descriptor.enumerable,
          value: _debounce(descriptor.value, wait, options),
        });

        return this[name];
      },
    };
  };
}

export function throttle(wait, options = {}) {
  return (target, name, descriptor) => {
    return {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() {
        Object.defineProperty(this, name, {
          configurable: true,
          enumerable: descriptor.enumerable,
          value: _throttle(descriptor.value, wait, options),
        });

        return this[name];
      },
    };
  };
}
