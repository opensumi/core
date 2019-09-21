module.exports = {
  "activationEvents": "vscode",     // 代表沿用 vscode 的激活时机
  "browser": {
    "main": "out/browser/index.js",
    "componentId": ["comA", "comB"] // 考虑能与 src 的内容共同维护到一个地方
  },
  "worker": {
    "main": "out/worker/index.js"
  }
  // "node": {
  //   "main": "out/node/index.js"
  // }


}