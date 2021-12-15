'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
class LogServiceClass {
  constructor(args) {
    console.log('LogServiceClass args', args);
  }
  debug(...args) {
    console.log('LogServiceClass debug', args);
  }
  error(...args) {
    console.log('LogServiceClass error', args);
  }
  log(...args) {
    console.log('LogServiceClass log', args);
  }
  warn(...args) {
    console.log('LogServiceClass warn', args);
  }
}
exports.default = LogServiceClass;
// # sourceMappingURL=mock-log-service.js.map
