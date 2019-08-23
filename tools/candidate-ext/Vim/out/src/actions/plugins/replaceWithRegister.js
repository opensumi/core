"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const position_1 = require("../../common/motion/position");
const configuration_1 = require("../../configuration/configuration");
const mode_1 = require("../../mode/mode");
const register_1 = require("../../register/register");
const textEditor_1 = require("../../textEditor");
const operator_1 = require("../operator");
const base_1 = require("./../base");
let ReplaceOperator = class ReplaceOperator extends operator_1.BaseOperator {
    constructor() {
        super(...arguments);
        this.keys = ['g', 'r'];
        this.modes = [mode_1.ModeName.Normal];
    }
    doesActionApply(vimState, keysPressed) {
        return configuration_1.configuration.replaceWithRegister && super.doesActionApply(vimState, keysPressed);
    }
    couldActionApply(vimState, keysPressed) {
        return configuration_1.configuration.replaceWithRegister && super.doesActionApply(vimState, keysPressed);
    }
    run(vimState, start, end) {
        return __awaiter(this, void 0, void 0, function* () {
            const range = new vscode.Range(start, end.getRight());
            const register = yield register_1.Register.get(vimState);
            const replaceWith = register.text;
            yield textEditor_1.TextEditor.replace(range, replaceWith);
            return updateCursorPosition(vimState, range, replaceWith);
        });
    }
};
ReplaceOperator = __decorate([
    base_1.RegisterAction
], ReplaceOperator);
exports.ReplaceOperator = ReplaceOperator;
const updateCursorPosition = (vimState, range, replaceWith) => {
    const { recordedState: { actionKeys }, } = vimState;
    const lines = replaceWith.split('\n');
    const wasRunAsLineAction = actionKeys.indexOf('r') === 0 && actionKeys.length === 1; // ie. grr
    const registerAndRangeAreSingleLines = lines.length === 1 && range.isSingleLine;
    const singleLineAction = registerAndRangeAreSingleLines && !wasRunAsLineAction;
    const cursorPosition = singleLineAction
        ? cursorAtEndOfReplacement(range, replaceWith)
        : cursorAtFirstNonBlankCharOfLine(range);
    return vimStateWithCursorPosition(vimState, cursorPosition);
};
const cursorAtEndOfReplacement = (range, replacement) => new position_1.Position(range.start.line, Math.max(0, range.start.character + replacement.length - 1));
const cursorAtFirstNonBlankCharOfLine = (range) => new position_1.Position(range.start.line, 0).getFirstLineNonBlankChar();
const vimStateWithCursorPosition = (vimState, cursorPosition) => {
    vimState.cursorStopPosition = cursorPosition;
    vimState.cursorStartPosition = cursorPosition;
    return vimState;
};

//# sourceMappingURL=replaceWithRegister.js.map
