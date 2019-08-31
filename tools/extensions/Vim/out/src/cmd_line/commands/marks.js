"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const node = require("../node");
const textEditor_1 = require("../../textEditor");
const range_1 = require("../../common/motion/range");
class MarkQuickPickItem {
    constructor(mark) {
        this.picked = false;
        this.alwaysShow = false;
        this.mark = mark;
        this.label = mark.name;
        this.description = textEditor_1.TextEditor.getLineAt(mark.position).text.trim();
        this.detail = `line ${mark.position.line} col ${mark.position.character}`;
    }
}
class MarksCommand extends node.CommandBase {
    constructor(marksFilter) {
        super();
        this.marksFilter = marksFilter;
    }
    execute(vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const quickPickItems = vimState.historyTracker
                .getMarks()
                .filter(mark => {
                return !this.marksFilter || this.marksFilter.includes(mark.name);
            })
                .map(mark => new MarkQuickPickItem(mark));
            if (quickPickItems.length > 0) {
                const item = yield vscode_1.window.showQuickPick(quickPickItems, {
                    canPickMany: false,
                });
                if (item) {
                    vimState.cursors = [new range_1.Range(item.mark.position, item.mark.position)];
                }
            }
            else {
                vscode_1.window.showInformationMessage('No marks set');
            }
        });
    }
}
exports.MarksCommand = MarksCommand;

//# sourceMappingURL=marks.js.map
