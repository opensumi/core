"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
class Configuration {
    constructor() {
        this.useSystemClipboard = false;
        this.useCtrlKeys = false;
        this.overrideCopy = true;
        this.textwidth = 80;
        this.hlsearch = false;
        this.ignorecase = true;
        this.smartcase = true;
        this.autoindent = true;
        this.camelCaseMotion = {
            enable: false,
        };
        this.replaceWithRegister = false;
        this.sneak = false;
        this.sneakUseIgnorecaseAndSmartcase = false;
        this.surround = true;
        this.easymotion = false;
        this.easymotionMarkerBackgroundColor = '';
        this.easymotionMarkerForegroundColorOneChar = '#ff0000';
        this.easymotionMarkerForegroundColorTwoChar = '#ffa500';
        this.easymotionMarkerWidthPerChar = 8;
        this.easymotionMarkerHeight = 14;
        this.easymotionMarkerFontFamily = 'Consolas';
        this.easymotionMarkerFontSize = '14';
        this.easymotionMarkerFontWeight = 'normal';
        this.easymotionMarkerYOffset = 0;
        this.easymotionKeys = 'hklyuiopnm,qwertzxcvbasdgjf;';
        this.autoSwitchInputMethod = {
            enable: false,
            defaultIM: '',
            switchIMCmd: '',
            obtainIMCmd: '',
        };
        this.timeout = 1000;
        this.showcmd = true;
        this.showmodename = true;
        this.leader = '//';
        this.history = 50;
        this.incsearch = true;
        this.startInInsertMode = false;
        this.statusBarColorControl = false;
        this.statusBarColors = {
            normal: ['#8FBCBB', '#434C5E'],
            insert: '#BF616A',
            visual: '#B48EAD',
            visualline: '#B48EAD',
            visualblock: '#A3BE8C',
            replace: '#D08770',
        };
        this.searchHighlightColor = 'rgba(150, 150, 255, 0.3)';
        this.tabstop = 2;
        this.editorCursorStyle = vscode.TextEditorCursorStyle.Line;
        this.expandtab = true;
        this.number = true;
        this.relativenumber = false;
        this.iskeyword = '/\\()"\':,.;<>~!@#$%^&*|+=[]{}`?-';
        this.visualstar = false;
        this.mouseSelectionGoesIntoVisualMode = true;
        this.changeWordIncludesWhitespace = false;
        this.foldfix = false;
        this.disableExtension = false;
        this.enableNeovim = false;
        this.neovimPath = 'nvim';
        this.substituteGlobalFlag = false;
        this.cursorStylePerMode = {
            normal: 'line',
            insert: 'block',
            visual: 'underline',
            visualline: 'thin-lin',
            visualblock: 'block-outline',
            replace: 'underline-thin,',
        };
        this.insertModeKeyBindings = [];
        this.insertModeKeyBindingsNonRecursive = [];
        this.normalModeKeyBindings = [];
        this.normalModeKeyBindingsNonRecursive = [];
        this.visualModeKeyBindings = [];
        this.visualModeKeyBindingsNonRecursive = [];
        this.whichwrap = '';
        this.wrapKeys = {};
        this.report = 2;
    }
}
exports.Configuration = Configuration;

//# sourceMappingURL=testConfiguration.js.map
