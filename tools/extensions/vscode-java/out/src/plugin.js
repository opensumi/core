'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const commands_1 = require("./commands");
let existingExtensions;
function collectJavaExtensions(extensions) {
    const result = [];
    if (extensions && extensions.length) {
        for (const extension of extensions) {
            const contributesSection = extension.packageJSON['contributes'];
            if (contributesSection) {
                const javaExtensions = contributesSection['javaExtensions'];
                if (Array.isArray(javaExtensions) && javaExtensions.length) {
                    for (const javaExtensionPath of javaExtensions) {
                        result.push(path.resolve(extension.extensionPath, javaExtensionPath));
                    }
                }
            }
        }
    }
    // Make a copy of extensions:
    existingExtensions = result.slice();
    return result;
}
exports.collectJavaExtensions = collectJavaExtensions;
function onExtensionChange(extensions) {
    if (!existingExtensions) {
        return;
    }
    const oldExtensions = new Set(existingExtensions.slice());
    const newExtensions = collectJavaExtensions(extensions);
    let hasChanged = (oldExtensions.size !== newExtensions.length);
    if (!hasChanged) {
        for (const newExtension of newExtensions) {
            if (!oldExtensions.has(newExtension)) {
                hasChanged = true;
                break;
            }
        }
    }
    if (hasChanged) {
        const msg = 'Extensions to the Java Language Server changed, reloading Visual Studio Code is required for the changes to take effect.';
        const action = 'Reload';
        const restartId = commands_1.Commands.RELOAD_WINDOW;
        vscode.window.showWarningMessage(msg, action).then((selection) => {
            if (action === selection) {
                vscode.commands.executeCommand(restartId);
            }
        });
    }
}
exports.onExtensionChange = onExtensionChange;
//# sourceMappingURL=plugin.js.map