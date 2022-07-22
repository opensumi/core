import { Awareness } from 'y-protocols/awareness';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { TextModelBinding } from '../../src/browser/textmodel-binding';

const createBindingWithTextModel = (doc: Y.Doc, awareness: Awareness) => {
  const textModel = monaco.editor.createModel('');
  const yText = doc.getText('test');
  const binding = new TextModelBinding(yText, textModel, awareness);
  return {
    textModel,
    binding,
    yText,
  };
};

describe('TextModelBinding test for yText and TextModel', () => {
  let doc: Y.Doc;
  let user1: ReturnType<typeof createBindingWithTextModel>;
  let user2: ReturnType<typeof createBindingWithTextModel>;

  beforeEach(() => {
    doc = new Y.Doc();
    const wsProvider = new WebsocketProvider('ws://127.0.0.1:12345', 'test', doc, { connect: false }); // we don't use wsProvider here
    user1 = createBindingWithTextModel(doc, wsProvider.awareness);
    user2 = createBindingWithTextModel(doc, wsProvider.awareness);
  });

  afterEach(() => {
    user1.binding.dispose();
    user2.binding.dispose();
    doc.destroy();
  });

  it('should initialize properly', () => {
    const yText = doc.getText('test');

    expect(user1.binding.undoManger).toBeTruthy();
    expect(user2.binding.undoManger).toBeTruthy();
    expect(user1.binding['textModel'] === user1.textModel).toBeTruthy();
    expect(user2.binding['textModel'] === user2.textModel).toBeTruthy();
    expect(user1.binding['yText'] === yText).toBeTruthy();
    expect(user2.binding['yText'] === yText).toBeTruthy();
    expect(user1.binding.doc === doc).toBeTruthy();
    expect(user2.binding.doc === doc).toBeTruthy();
  });

  it('should fire event onDidChangeContent when yText is modified or text model content is changed', () => {
    const f1 = jest.fn();
    const disposable1 = user1.textModel.onDidChangeContent(f1);
    const f2 = jest.fn();
    const disposable2 = user2.textModel.onDidChangeContent(f2);

    user1.yText.insert(0, '810');
    user2.yText.insert(0, '1919');
    const pos = user1.textModel.getPositionAt(0);
    const range = new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
    user1.textModel.applyEdits([{ range, text: '514' }]);
    user2.textModel.applyEdits([{ range, text: '114' }]);

    expect(user1.yText.toString() === user2.yText.toString()).toBeTruthy();
    expect(user1.textModel.getValue() === user2.textModel.getValue()).toBeTruthy();
    expect(user1.yText.toString() === '1145141919810').toBeTruthy();
    expect(user2.yText.toString() === '1145141919810').toBeTruthy();
    expect(user1.textModel.getValue() === '1145141919810').toBeTruthy();
    expect(user2.textModel.getValue() === '1145141919810').toBeTruthy();

    expect(f1).toBeCalled();
    expect(f2).toBeCalled();

    disposable1.dispose();
    disposable2.dispose();
  });

  it('should correctly handle Y.Text event', () => {
    // insertion
    // deletion
  });

  it('should mutex on two events mentioned above', () => {
    let mutex = user1.binding.mutex;
    let yTextEventFn = jest.fn();
    let TextModelEventFn = jest.fn();

    // editing on yText will trigger yText event
    // and onDidChangeContent will be triggered in yText observer
    // but wont execute fn in event onDidChangeContent while executing yText observer
    user1.yText.observe(() => mutex(() => yTextEventFn()));
    user1.textModel.onDidChangeContent(() => mutex(() => TextModelEventFn()));

    user1.yText.insert(0, 'foo');
    expect(yTextEventFn).toBeCalledTimes(1);
    expect(TextModelEventFn).toBeCalledTimes(0);

    // the same
    mutex = user2.binding.mutex;
    yTextEventFn = jest.fn();
    TextModelEventFn = jest.fn();

    user2.yText.observe(() => mutex(() => yTextEventFn()));
    user2.textModel.onDidChangeContent(() => mutex(() => TextModelEventFn()));

    const pos = user2.textModel.getPositionAt(0);
    const range = new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
    user2.textModel.applyEdits([{ range, text: 'bar' }]);

    expect(yTextEventFn).toBeCalledTimes(0);
    expect(TextModelEventFn).toBeCalledTimes(1);
  });

  it('should undo and redo correctly', () => {});

  it('should edit many times', () => {});
});

describe('TextModelBinding test for editor', () => {
  beforeAll(() => {});

  it('should add editor and register corresponding events', () => {});

  it('should react on event onDidChangeCursorSelection fired from editor', () => {});

  it('should render decoration on editor when awareness changed', () => {});

  it('should save before Y transaction and restore selections after Y.Text was changed', () => {});

  afterAll(() => {});
});

describe('TextModelBinding test for awareness field', () => {
  it('should foo', () => {});
});
