/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Awareness } from 'y-protocols/awareness';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

import { uuid } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';
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
  let wsProvider: WebsocketProvider;

  beforeEach(() => {
    doc = new Y.Doc();
    wsProvider = new WebsocketProvider('ws://127.0.0.1:12345', 'test', doc, { connect: false }); // we don't use wsProvider here
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

  it('should set value of TextModel when current content of TextModel is not the same with Y.Text', () => {
    user1.yText.insert(0, '1145141919810');

    const model = monaco.editor.createModel('114514');
    const modelSpy = jest.spyOn(model, 'setValue');
    const binding = new TextModelBinding(doc.getText('test'), model, wsProvider.awareness);

    expect(modelSpy).toBeCalled();
    expect(model.getValue()).toBe('1145141919810');
    expect(user1.textModel.getValue()).toBe('1145141919810');

    model.dispose();
    binding.dispose();
  });

  it('should correctly handle Y.Text event', () => {
    // insertion
    const textModel = user2.textModel;
    const insertionSpy = jest.spyOn(textModel, 'applyEdits');
    user1.yText.insert(0, 'insert');
    expect(insertionSpy).toBeCalled();
    expect(user2.textModel.getValue()).toBe('insert');
    // deletion
    const deletionSpy = jest.spyOn(textModel, 'applyEdits');
    user2.yText.delete(0, 3);
    expect(deletionSpy).toBeCalled();
    expect(user2.textModel.getValue()).toBe('ert');
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

  it('should undo and redo correctly', () => {
    // now here is simple undo and redo test
    let pos = user1.textModel.getPositionAt(0);
    let range = new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
    user1.textModel.applyEdits([{ range, text: '114514' }]);
    pos = user2.textModel.getPositionAt(3);
    range = new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
    user2.textModel.applyEdits([{ range, text: '1919810' }]);
    expect(user1.textModel.getValue()).toBe('1141919810514');
    user1.binding.undo();
    expect(user1.textModel.getValue()).toBe('1919810');
    user2.binding.undo();
    expect(user1.textModel.getValue()).toBe('');
    user1.binding.redo();
    expect(user1.textModel.getValue()).toBe('114514');
    user2.binding.redo();
    expect(user1.textModel.getValue()).toBe('1141919810514');
  });

  it('should randomly edit many times', () => {
    // just randomly insert or delete
    for (let i = 0; i < 100; i++) {
      const userCurrentTurn = Math.random() > 0.5 ? user2 : user1;
      const insert = Math.random() <= 0.5 ? true : false;
      const len = userCurrentTurn.textModel.getValueLength();
      if (insert) {
        const pos = userCurrentTurn.textModel.getPositionAt(Math.ceil(Math.random() * len));
        const range = new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
        userCurrentTurn.textModel.applyEdits([{ range, text: uuid() }]);
      } else {
        const startPos = userCurrentTurn.textModel.getPositionAt(Math.ceil(Math.random() * len));
        const deletionLen = Math.ceil(Math.random() * 10);
        const endPos = startPos.delta(0, deletionLen);
        const range = new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column);
        userCurrentTurn.textModel.applyEdits([{ range, text: '' }]);
      }
      expect(user1.textModel.getValue() === user2.textModel.getValue()).toBeTruthy();
      expect(user1.yText.toString() === user2.yText.toString()).toBeTruthy();
      expect(user1.textModel.getValue() === user2.yText.toString()).toBeTruthy();
      expect(user1.yText.toString() === user2.textModel.getValue()).toBeTruthy();
    }
  });
});

describe('TextModelBinding test for editor', () => {
  let editor: ICodeEditor;
  let doc: Y.Doc;
  let binding: TextModelBinding;
  let yText: Y.Text;
  let textModel: monaco.editor.ITextModel;

  beforeAll(() => {
    doc = new Y.Doc();
    const wsProvider = new WebsocketProvider('ws://127.0.0.1:12345', 'test', doc, { connect: false });

    const {
      binding: _binding,
      textModel: _textModel,
      yText: _yText,
    } = createBindingWithTextModel(doc, wsProvider.awareness);
    binding = _binding;
    yText = _yText;
    textModel = _textModel;

    // FIXME correct this type
    editor = monaco.editor.create(document.createElement('div'), { value: '' }) as any as ICodeEditor;

    editor.setModel(textModel);

    expect(editor.getModel() === textModel).toBeTruthy();
  });

  it('should add editor and register corresponding events', () => {
    const setSpy = jest.spyOn(binding, 'addEditor');
    const registerSpy = jest.spyOn(editor, 'onDidChangeCursorSelection');
    binding.addEditor(editor);
    expect(setSpy).toBeCalledTimes(1);
    expect(registerSpy).toBeCalledTimes(1);
  });

  it('should fire relevant events after changing selection', () => {
    // insert some text
    textModel.applyEdits([{ range: new monaco.Range(1, 1, 1, 1), text: '114514' }]);

    const probeFnForAwareness = jest.fn();
    binding['awareness'].on('change', probeFnForAwareness);
    const probeFnForEditor = jest.fn();
    const disposable = editor.onDidChangeCursorSelection(probeFnForEditor);

    // events are onDidChangeCursorSelection, awareness-related
    const range = new monaco.Range(1, 1, 1, 4); // text => 114
    // will fire events
    editor.setSelection(range);

    expect(probeFnForAwareness).toBeCalled();
    expect(probeFnForEditor).toBeCalled();

    const state = binding['awareness'].getLocalState()!;
    expect('selection' in state).toBeTruthy();
    // check correctness of awareness field
    const selectionField: {
      anchor: Y.RelativePosition;
      head: Y.RelativePosition;
    } = state['selection']!;
    expect(selectionField).toBeTruthy();

    {
      const relStart = selectionField.anchor;
      const relEnd = selectionField.head;
      expect(relStart).toBeInstanceOf(Y.RelativePosition);
      expect(relEnd).toBeInstanceOf(Y.RelativePosition);
      // convert back to abs position
      const absStart = Y.createAbsolutePositionFromRelativePosition(relStart, doc)!;
      const absEnd = Y.createAbsolutePositionFromRelativePosition(relEnd, doc)!;
      expect(absStart !== null).toBeTruthy();
      expect(absEnd !== undefined).toBeTruthy();
      // create range from relative position
      const start = textModel.getPositionAt(absStart.index);
      const end = textModel.getPositionAt(absEnd.index);
      const rangeFromYRelativePosition = new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
      expect(rangeFromYRelativePosition.equalsRange(range)).toBeTruthy();
    }

    // dust
    binding['awareness'].off('change', probeFnForAwareness);
    disposable.dispose();
  });

  it('should save current selections before Y transaction and restore current selections after Y.Text was changed', () => {
    // init value
    textModel.setValue('');
    textModel.applyEdits([{ range: new monaco.Range(1, 1, 1, 1), text: '114514' }]);

    const probeFnForYDocBeforeAllTransaction = jest.fn();
    doc.on('beforeAllTransactions', probeFnForYDocBeforeAllTransaction);

    // first set selection
    editor.setSelection(new monaco.Range(1, 1, 1, 4)); // => 114
    // then apply edits to editor
    yText.insert(1, '1919810'); // simulate edit from other person

    expect(probeFnForYDocBeforeAllTransaction).toBeCalled();

    // check selection backup result, check if it can be restored correctly
    expect(binding.savedSelections.has(editor)).toBeTruthy();
    {
      const savedSelection = binding.savedSelections.get(editor)!;
      const absStart = Y.createAbsolutePositionFromRelativePosition(savedSelection.start, doc)!;
      const absEnd = Y.createAbsolutePositionFromRelativePosition(savedSelection.end, doc)!;
      expect(absStart).toBeInstanceOf(Y.AbsolutePosition);
      expect(absEnd).toBeInstanceOf(Y.AbsolutePosition);
      // construct range
      const start = textModel.getPositionAt(absStart.index);
      const end = textModel.getPositionAt(absEnd.index);
      const range = new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
      const currentSelection = editor.getSelection()!;
      expect(currentSelection !== null).toBeTruthy();
      expect(currentSelection.equalsRange(range)).toBeTruthy();
      expect(currentSelection.equalsRange(new monaco.Range(1, 1, 1, 11))).toBeTruthy();
    }

    doc.off('beforeAllTransactions', probeFnForYDocBeforeAllTransaction);
  });

  afterAll(() => {
    binding.dispose();
  });
});
