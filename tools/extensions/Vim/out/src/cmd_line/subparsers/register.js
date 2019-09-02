"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const register_1 = require("../commands/register");
const scanner_1 = require("../scanner");
function parseRegisterCommandArgs(args) {
    if (!args || !args.trim()) {
        return new register_1.RegisterCommand({
            registers: [],
        });
    }
    let scanner = new scanner_1.Scanner(args);
    let regs = [];
    let reg = scanner.nextWord();
    while (reg !== scanner_1.Scanner.EOF) {
        regs.push(reg);
        reg = scanner.nextWord();
    }
    return new register_1.RegisterCommand({
        registers: regs,
    });
}
exports.parseRegisterCommandArgs = parseRegisterCommandArgs;

//# sourceMappingURL=register.js.map
