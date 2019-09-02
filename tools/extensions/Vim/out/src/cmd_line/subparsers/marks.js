"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const marks_1 = require("../commands/marks");
function parseMarksCommandArgs(args) {
    if (!args) {
        return new marks_1.MarksCommand();
    }
    return new marks_1.MarksCommand(args.split(''));
}
exports.parseMarksCommandArgs = parseMarksCommandArgs;

//# sourceMappingURL=marks.js.map
