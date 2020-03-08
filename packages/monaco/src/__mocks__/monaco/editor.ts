import { quickEvent, quickFireEvent, partialMock } from './common/util';
import { MockedStandaloneCodeEditor } from './editor/code-editor';
import { MockedDiffEditor, MockedDiffNavigator } from './editor/diff-editor';
import { MockedMonacoModel } from './editor/model';

export function createMockedMonacoEditorApi(): typeof monaco.editor {

  const models = new Map<string, MockedMonacoModel>();

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
      const model = new MockedMonacoModel(value, language, uri);
      models.set(uri ? uri.toString() : ('model_' + Math.random() * 1000), model);
      return model;
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
      return models.get(uri.toString()) || null;
    },
    getModels: () => {
      return [];
    },
  };

  return partialMock('monaco.editor', mockedMonacoEditorApi);
}
