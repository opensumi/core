import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { quickEvent, quickFireEvent, partialMock } from './common/util';
import { MockedStandaloneCodeEditor } from './editor/code-editor';
import { MockedDiffEditor, MockedDiffNavigator } from './editor/diff-editor';
import { MockedMonacoModel } from './editor/model';

enum TrackedRangeStickiness {
  AlwaysGrowsWhenTypingAtEdges = 0,
  NeverGrowsWhenTypingAtEdges = 1,
  GrowsOnlyWhenTypingBefore = 2,
  GrowsOnlyWhenTypingAfter = 3,
}

// copied from monaco-editor-core@0.17.0/monaco.d.ts
enum MouseTargetType {
  UNKNOWN = 0,
  TEXTAREA = 1,
  GUTTER_GLYPH_MARGIN = 2,
  GUTTER_LINE_NUMBERS = 3,
  GUTTER_LINE_DECORATIONS = 4,
  GUTTER_VIEW_ZONE = 5,
  CONTENT_TEXT = 6,
  CONTENT_EMPTY = 7,
  CONTENT_VIEW_ZONE = 8,
  CONTENT_WIDGET = 9,
  OVERVIEW_RULER = 10,
  SCROLLBAR = 11,
  OVERLAY_WIDGET = 12,
  OUTSIDE_EDITOR = 13,
}

export function createMockedMonacoEditorApi(): any {
  const models = new Map<string, MockedMonacoModel>();

  const mockedMonacoEditorApi = {
    onDidCreateEditor: quickEvent('onDidCreateEditor'),
    create: (dom, options, override) => {
      const editor = new MockedStandaloneCodeEditor(dom, options, override);
      quickFireEvent('onDidCreateEditor', editor);
      return editor;
    },
    createDiffEditor: (dom, options, override) => {
      const editor = new MockedDiffEditor(dom, options, override);
      quickFireEvent('onDidCreateEditor', editor.getOriginalEditor());
      quickFireEvent('onDidCreateEditor', editor.getModifiedEditor());
      return editor;
    },
    createDiffNavigator: (diffEditor, opts) => new MockedDiffNavigator(diffEditor, opts),
    onDidCreateModel: quickEvent(' onDidCreateModel'),
    createModel: (value, language, uri) => {
      const model = new MockedMonacoModel(value, language, uri);
      models.set(uri ? uri.toString() : 'model_' + Math.random() * 1000, model);
      return model as unknown as monaco.editor.ITextModel;
    },
    setModelLanguage: (model, languageId) => {
      (model as unknown as MockedMonacoModel).language = languageId;
    },
    setModelMarkers: () => {},
    getModelMarkers: () => [],
    getModel: (uri) => (models.get(uri.toString()) as unknown as monaco.editor.ITextModel) || null,
    getModels: () => [],
    TrackedRangeStickiness,
    MouseTargetType,
  };

  return partialMock('monaco.editor', mockedMonacoEditorApi);
}
