import { quickEvent, quickFireEvent, partialMock } from './common/util';
import { MockedStandaloneCodeEditor } from './editor/code-editor';
import { MockedDiffEditor, MockedDiffNavigator } from './editor/diff-editor';
import { MockedMonacoModel } from './editor/model';

export function createMockedMonacoEditorApi(): typeof monaco.editor {
  const mockedMonacoEditorApi: Partial<typeof monaco.editor> = {
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
    createDiffNavigator: (diffEditor, opts) => {
      return new MockedDiffNavigator(diffEditor, opts);
    },
    onDidCreateModel: quickEvent(' onDidCreateModel'),
    createModel: (value, language, uri) => {
      return new MockedMonacoModel(value, language, uri);
    },
    setModelLanguage: (model, languageId) => {
      (model as MockedMonacoModel).language = languageId;
    },
    setModelMarkers: () => {

    },
    getModelMarkers: () => {
      return [];
    },
    getModel: (uri) => {
      return null;
    },
    getModels: () => {
      return [];
    },
  };

  return partialMock('monaco.editor', mockedMonacoEditorApi);
}
