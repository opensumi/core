"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mode_1 = require("../mode/mode");
const statusBar_1 = require("../statusBar");
const configuration_1 = require("../configuration/configuration");
function ReportClear(vimState) {
    statusBar_1.StatusBar.Set('', vimState.currentMode, vimState.isRecordingMacro, true);
}
exports.ReportClear = ReportClear;
function ReportLinesChanged(numLinesChanged, vimState) {
    if (numLinesChanged > configuration_1.configuration.report) {
        statusBar_1.StatusBar.Set(numLinesChanged + ' more lines', vimState.currentMode, vimState.isRecordingMacro, true);
    }
    else if (-numLinesChanged > configuration_1.configuration.report) {
        statusBar_1.StatusBar.Set(Math.abs(numLinesChanged) + ' fewer lines', vimState.currentMode, vimState.isRecordingMacro, true);
    }
    else {
        ReportClear(vimState);
    }
}
exports.ReportLinesChanged = ReportLinesChanged;
function ReportLinesYanked(numLinesYanked, vimState) {
    if (numLinesYanked > configuration_1.configuration.report) {
        if (vimState.currentMode === mode_1.ModeName.VisualBlock) {
            statusBar_1.StatusBar.Set('block of ' + numLinesYanked + ' lines yanked', vimState.currentMode, vimState.isRecordingMacro, true);
        }
        else {
            statusBar_1.StatusBar.Set(numLinesYanked + ' lines yanked', vimState.currentMode, vimState.isRecordingMacro, true);
        }
    }
    else {
        ReportClear(vimState);
    }
}
exports.ReportLinesYanked = ReportLinesYanked;
/**
 * Shows the active file's path and line count as well as position in the file as a percentage.
 * Triggered via `ctrl-g` or `:file`.
 */
function ReportFileInfo(position, vimState) {
    const doc = vimState.editor.document;
    const progress = Math.floor(((position.line + 1) / doc.lineCount) * 100);
    statusBar_1.StatusBar.Set(`"${doc.fileName}" ${doc.lineCount} lines --${progress}%--`, vimState.currentMode, vimState.isRecordingMacro, true);
}
exports.ReportFileInfo = ReportFileInfo;
/**
 * Shows the number of matches and current match index of a search.
 * @param matchIdx Index of current match, starting at 0
 * @param numMatches Total number of matches
 * @param vimState The current `VimState`
 */
function ReportSearch(matchIdx, numMatches, vimState) {
    statusBar_1.StatusBar.Set(`match ${matchIdx + 1} of ${numMatches}`, vimState.currentMode, vimState.isRecordingMacro, true);
}
exports.ReportSearch = ReportSearch;

//# sourceMappingURL=statusBarTextUtils.js.map
