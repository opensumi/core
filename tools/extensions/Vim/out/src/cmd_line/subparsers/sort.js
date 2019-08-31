"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node = require("../commands/sort");
const scanner_1 = require("../scanner");
function parseSortCommandArgs(args) {
    if (!args) {
        return new node.SortCommand({ reverse: false, ignoreCase: false });
    }
    let scannedArgs = { reverse: false, ignoreCase: false };
    let scanner = new scanner_1.Scanner(args);
    const c = scanner.next();
    scannedArgs.reverse = c === '!';
    scannedArgs.ignoreCase = scanner.nextWord() === 'i';
    return new node.SortCommand(scannedArgs);
}
exports.parseSortCommandArgs = parseSortCommandArgs;

//# sourceMappingURL=sort.js.map
