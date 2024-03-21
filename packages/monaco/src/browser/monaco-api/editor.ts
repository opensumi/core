import { ScrollbarVisibility } from '@opensumi/monaco-editor-core/esm/vs/base/common/scrollable';
import { URI } from '@opensumi/monaco-editor-core/esm/vs/base/common/uri';
import {
  ContentWidgetPositionPreference,
  ICodeEditor,
  MouseTargetType,
  OverlayWidgetPositionPreference,
} from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import {
  ConfigurationChangedEvent,
  EditorAutoIndentStrategy,
  EditorOption,
  EditorOptions,
  IDiffEditorOptions,
  IEditorOptions,
  RenderLineNumbersType,
  RenderMinimap,
  TextEditorCursorBlinkingStyle,
  TextEditorCursorStyle,
  WrappingIndent,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { BareFontInfo, FontInfo } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/fontInfo';
import { CursorChangeReason } from '@opensumi/monaco-editor-core/esm/vs/editor/common/cursorEvents';
import { EditorType, ScrollType } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';
import { ILanguageService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages/language';
import {
  DefaultEndOfLine,
  EndOfLinePreference,
  EndOfLineSequence,
  FindMatch,
  ITextModelUpdateOptions,
  MinimapPosition,
  OverviewRulerLane,
  TextModelResolvedOptions,
  TrackedRangeStickiness,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';
import {
  colorize,
  colorizeElement,
  colorizeModelLine,
  create,
  createDiffEditor,
  createWebWorker,
  defineTheme,
  getModel,
  getModelMarkers,
  getModels,
  onDidChangeModelLanguage,
  onDidCreateEditor,
  onDidCreateModel,
  onWillDisposeModel,
  createModel as rawCreateModel,
  remeasureFonts,
  setModelLanguage,
  setModelMarkers,
  setTheme,
  tokenize,
} from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneEditor';
import { AccessibilitySupport } from '@opensumi/monaco-editor-core/esm/vs/platform/accessibility/common/accessibility';
import { IMarkerData } from '@opensumi/monaco-editor-core/esm/vs/platform/markers/common/markers';

import { StandaloneServices } from './services';

import type {
  IDecorationOptions,
  IModelDecorationOptions,
  IModelDeltaDecoration,
  ITextBufferFactory,
  ITextModel,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';

export function createMonacoEditorApi() {
  return Object.freeze({
    // methods and events
    create,
    onDidCreateEditor,
    createDiffEditor,

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
  ICodeEditor,
  IDecorationOptions,
  IDiffEditorOptions,
  IEditorOptions,
  IMarkerData,
  IModelDecorationOptions,
  IModelDeltaDecoration,
  ITextModelUpdateOptions,
};

/**
 * Create a new editor model.
 * You can specify the language that should be set for this model or let the language be inferred from the `uri`.
 */
export function createModel(value: string | ITextBufferFactory, language?: string, uri?: URI): ITextModel {
  if (typeof value === 'string') {
    return rawCreateModel(value, language, uri);
  }
  return createModelFromBuffer(value, language, uri);
}

/**
 * Create a new editor model.
 * You can specify the language that should be set for this model or let the language be inferred from the `uri`.
 */
export function createModelFromBuffer(value: ITextBufferFactory, language?: string, uri?: URI): ITextModel {
  const modelService = StandaloneServices.get(IModelService);
  const languageService = StandaloneServices.get(ILanguageService);
  const languageId = languageService.getLanguageIdByMimeType(language) || language;
  return modelService.createModel(value, languageService.createById(languageId), uri);
}
