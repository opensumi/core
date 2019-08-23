"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const untildify = require("untildify");
/**
 * Given relative path, calculate absolute path.
 */
function GetAbsolutePath(partialPath) {
    const editorFilePath = vscode.window.activeTextEditor.document.uri.fsPath;
    let basePath;
    if (partialPath.startsWith('/')) {
        basePath = '/';
    }
    else if (partialPath.startsWith('~/')) {
        basePath = untildify(partialPath);
        partialPath = '';
    }
    else if (partialPath.startsWith('./')) {
        basePath = path.dirname(editorFilePath);
        partialPath = partialPath.replace('./', '');
    }
    else if (partialPath.startsWith('../')) {
        basePath = path.dirname(editorFilePath) + '/';
    }
    else {
        basePath = path.dirname(editorFilePath);
    }
    return basePath + partialPath;
}
exports.GetAbsolutePath = GetAbsolutePath;

//# sourceMappingURL=path.js.map
