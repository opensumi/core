import {
  create,
  createDiffEditor,
  onDidCreateEditor,
  createDiffNavigator,
  createModel,
  setModelLanguage,
  setModelMarkers,
  getModelMarkers,
  getModels,
  getModel,
  onDidCreateModel,
  onWillDisposeModel,
  onDidChangeModelLanguage,
  createWebWorker,
  colorizeElement,
  colorize,
  colorizeModelLine,
  tokenize,
  defineTheme,
  setTheme,
  remeasureFonts,
} from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneEditor';
import { AccessibilitySupport } from '@opensumi/monaco-editor-core/esm/vs/platform/accessibility/common/accessibility';
import {
  ContentWidgetPositionPreference,
  MouseTargetType,
  OverlayWidgetPositionPreference,
  ICodeEditor,
} from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { CursorChangeReason } from '@opensumi/monaco-editor-core/esm/vs/editor/common/controller/cursorEvents';
import {
  DefaultEndOfLine,
  EndOfLinePreference,
  EndOfLineSequence,
  MinimapPosition,
  OverviewRulerLane,
  TrackedRangeStickiness,
  ITextModelUpdateOptions,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import {
  EditorAutoIndentStrategy,
  EditorOption,
  RenderLineNumbersType,
  RenderMinimap,
  TextEditorCursorBlinkingStyle,
  TextEditorCursorStyle,
  WrappingIndent,
  IEditorOptions,
  IDiffEditorOptions,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { ScrollbarVisibility } from '@opensumi/monaco-editor-core/esm/vs/base/common/scrollable';
import { ConfigurationChangedEvent, EditorOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { BareFontInfo, FontInfo } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/fontInfo';
import { FindMatch, TextModelResolvedOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { EditorType, ScrollType } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';
import type {
  IDecorationOptions,
  IModelDecorationOptions,
  IModelDeltaDecoration,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IMarkerData } from '@opensumi/monaco-editor-core/esm/vs/platform/markers/common/markers';

export function createMonacoEditorApi() {
  return Object.freeze({
    // methods and events
    create,
    onDidCreateEditor,
    createDiffEditor,
    createDiffNavigator,

    createModel,
    setModelLanguage,
    setModelMarkers,
    getModelMarkers,
    getModels,
    getModel,
    onDidCreateModel,
    onWillDisposeModel,
    onDidChangeModelLanguage,
    createWebWorker,

    colorizeElement,
    colorize,
    colorizeModelLine,
    tokenize,
    defineTheme,
    setTheme,
    remeasureFonts,

    // enums
    AccessibilitySupport,
    ContentWidgetPositionPreference,
    CursorChangeReason,
    DefaultEndOfLine,
    EditorAutoIndentStrategy,
    EditorOption,
    EndOfLinePreference,
    EndOfLineSequence,
    MinimapPosition,
    MouseTargetType,
    OverlayWidgetPositionPreference,
    OverviewRulerLane,
    RenderLineNumbersType,
    RenderMinimap,
    ScrollbarVisibility,
    ScrollType,
    TextEditorCursorBlinkingStyle,
    TextEditorCursorStyle,
    TrackedRangeStickiness,
    WrappingIndent,

    // Classes
    ConfigurationChangedEvent,
    BareFontInfo,
    FontInfo,
    TextModelResolvedOptions,
    FindMatch,

    // vars
    EditorType,
    EditorOptions,
  });
}

export {
  IDecorationOptions,
  IModelDecorationOptions,
  ICodeEditor,
  IModelDeltaDecoration,
  IEditorOptions,
  ITextModelUpdateOptions,
  IDiffEditorOptions,
  IMarkerData,
};
