"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fileInfo_1 = require("../commands/fileInfo");
function parseFileInfoCommandArgs(args) {
    // TODO: implement bang, file name parameters. http://vimdoc.sourceforge.net/htmldoc/editing.html#CTRL-G
    return new fileInfo_1.FileInfoCommand();
}
exports.parseFileInfoCommandArgs = parseFileInfoCommandArgs;

//# sourceMappingURL=fileInfo.js.map
