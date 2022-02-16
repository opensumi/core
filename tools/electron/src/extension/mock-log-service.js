/* eslint-disable no-console */
'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
class LogServiceClass {
  constructor(args) {
    console.log('tool electron LogServiceClass args', args);
  }
  debug(...args) {
    console.log('tool electron LogServiceClass debug', args);
  }
  error(...args) {
    console.log('tool electron LogServiceClass error', args);
  }
  log(...args) {
    console.log('tool electron LogServiceClass log', args);
  }
  warn(...args) {
    console.log('tool electron LogServiceClass warn', args);
  }
}
exports.default = LogServiceClass;
// # sourceMappingURL=mock-log-service.js.map
