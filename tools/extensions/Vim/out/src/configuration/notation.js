"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
class Notation {
    // Converts keystroke like <tab> to a single control character like \t
    static ToControlCharacter(key) {
        if (key === '<tab>') {
            return '\t';
        }
        return key;
    }
    static IsControlKey(key) {
        key = key.toLocaleUpperCase();
        return (this.isSurroundedByAngleBrackets(key) &&
            key !== '<BS>' &&
            key !== '<SHIFT+BS>' &&
            key !== '<TAB>');
    }
    /**
     * Normalizes key to AngleBracketNotation
     * (e.g. <ctrl+x>, Ctrl+x, <c-x> normalized to <C-x>)
     * and converts the characters to their literals
     * (e.g. <space>, <cr>, <leader>)
     */
    static NormalizeKey(key, leaderKey) {
        if (typeof key !== 'string') {
            return key;
        }
        if (!this.isSurroundedByAngleBrackets(key) && key.length > 1) {
            key = `<${key.toLocaleLowerCase()}>`;
        }
        if (key.toLocaleLowerCase() === '<leader>') {
            return leaderKey;
        }
        if (_.includes(['<up>', '<down>', '<left>', '<right>'], key.toLocaleLowerCase())) {
            return key.toLocaleLowerCase();
        }
        for (const notationMapKey in this._notationMap) {
            if (this._notationMap.hasOwnProperty(notationMapKey)) {
                const regex = new RegExp(this._notationMap[notationMapKey].join('|'), 'gi');
                if (regex.test(key)) {
                    key = key.replace(regex, notationMapKey);
                    break;
                }
            }
        }
        return key;
    }
    static isSurroundedByAngleBrackets(key) {
        return key.startsWith('<') && key.endsWith('>');
    }
}
// Mapping from the normalized string to regex strings that could match it.
Notation._notationMap = {
    'C-': ['ctrl\\+', 'c\\-'],
    'D-': ['cmd\\+', 'd\\-'],
    Esc: ['escape', 'esc'],
    BS: ['backspace', 'bs'],
    Del: ['delete', 'del'],
    Home: ['home'],
    End: ['end'],
    Insert: ['insert'],
    ' ': ['<space>'],
    '\n': ['<cr>', '<enter>'],
};
exports.Notation = Notation;

//# sourceMappingURL=notation.js.map
