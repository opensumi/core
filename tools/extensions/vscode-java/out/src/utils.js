'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
function getJavaConfiguration() {
    return vscode_1.workspace.getConfiguration('java');
}
exports.getJavaConfiguration = getJavaConfiguration;
//# sourceMappingURL=utils.js.map