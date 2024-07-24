import { IDiffChangeResult } from '@opensumi/ide-ai-native/lib/browser/contrib/intelligent-completions/diff-computer';
import {
  GHOST_TEXT,
  GHOST_TEXT_DESCRIPTION,
  MultiLineDecorationModel,
} from '@opensumi/ide-ai-native/lib/browser/contrib/intelligent-completions/multi-line.decoration';
import {
  ICodeEditor,
  IEditorDecorationsCollection,
  IModelDeltaDecoration,
  IPosition,
  ITextModel,
  Position,
  Range,
} from '@opensumi/ide-monaco';
import { monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';

describe('MultiLineDecorationModel', () => {
  let editor: ICodeEditor;
  let decorationsCollection: IEditorDecorationsCollection;
  let multiLineDecorationModel: MultiLineDecorationModel;

  beforeEach(() => {
    editor = monacoApi.editor.create(document.createElement('div'), {});
    multiLineDecorationModel = new MultiLineDecorationModel(editor);
    decorationsCollection = multiLineDecorationModel['ghostTextDecorations'];

    editor.setValue(`export class Person {
  name: string;
  age: number;
}

// 注释内容
const person: Person = {
  name: "OpenSumi",
  age: 18
};

function greet(person: Person) {
  console.log(\`Hello, \${person.name}!\`);
}

greet(person); // Output: "Hello, OpenSumi!"`);
  });

  it('should initialize correctly', () => {
    expect(multiLineDecorationModel).toBeDefined();
    expect(decorationsCollection.clear).toBeDefined();
  });

  it('should split diff changes correctly', () => {
    const lines: IDiffChangeResult[] = [
      { value: 'line1\nline2', added: true, removed: false },
      { value: 'line3', added: false, removed: true },
    ];
    const result = multiLineDecorationModel['splitDiffChanges'](lines, '\n');
    expect(result).toEqual([
      { value: 'line1', added: true, removed: false },
      { value: '\n', added: true, removed: false },
      { value: 'line2', added: true, removed: false },
      { value: 'line3', added: false, removed: true },
    ]);
  });

  it('should combine continuous modifications correctly', () => {
    const modifications = [
      { newValue: 'line1', oldValue: '', isEolLine: false },
      { newValue: 'line2', oldValue: '', isEolLine: true },
      { newValue: 'line3', oldValue: '', isEolLine: false },
    ];
    const result = multiLineDecorationModel['combineContinuousMods'](modifications);
    expect(result).toEqual(['line1', 'line3']);
  });

  it('should process line modifications correctly', () => {
    const modifications = [
      { newValue: 'line1', oldValue: '', isEolLine: false },
      { newValue: 'line2', oldValue: '', isEolLine: true },
    ];
    const previous = { value: 'prev', added: false, removed: true };
    const next = { value: 'next', added: true, removed: false };
    const result = multiLineDecorationModel['processLineModifications'](modifications, '\n', previous, next);
    expect(result).toEqual({
      fullLineMods: [],
      inlineMods: [{ status: 'beginning', newValue: 'prevline1', oldValue: 'prev' }],
    });
  });

  it('should apply inline decorations correctly', () => {
    const changes: IDiffChangeResult[] = [
      { value: 'const person: Person = {\n  name: "' },
      { value: 'Hello ', added: true, removed: undefined },
      { value: 'OpenSumi",\n  age: 18' },
      { value: ' + 1', added: true, removed: undefined },
      { value: '\n};' },
    ];
    const cursorPosition: IPosition = { lineNumber: 7, column: 1 };
    const result = multiLineDecorationModel.applyInlineDecorations(
      editor,
      changes,
      cursorPosition.lineNumber,
      cursorPosition,
    );

    expect(result).toEqual([
      {
        lineNumber: 8,
        column: 10,
        newValue: '  name: "Hello ',
        oldValue: '  name: "',
      },
      {
        lineNumber: 9,
        column: 10,
        newValue: '  age: 18 + 1',
        oldValue: '  age: 18',
      },
    ]);
  });

  it('should update line modification decorations correctly', () => {
    /**
     * 例如原始内容是:
     * const person: Person = {
     *  name: "OpenSumi",
     *  age: 18
     * };
     *
     * 修改后的内容是:
     * const person: Person = {
     *  name: "Hello OpenSumi",
     *  age: 18 + 1
     * };
     *
     * 则期望在 editor 当中的 ghost-text 装饰器应该是在第 8 行中的 "Hello " 和第 9 行的 " + 1"。
     */
    let modifications = [
      {
        lineNumber: 8,
        column: 10,
        newValue: '  name: "Hello ',
        oldValue: '  name: "',
      },
      {
        lineNumber: 9,
        column: 10,
        newValue: '  age: 18 + 1',
        oldValue: '  age: 18',
      },
    ];

    multiLineDecorationModel.updateLineModificationDecorations(modifications);

    jest.setTimeout(10);

    let lineDecorations = editor.getLineDecorations(8) || [];
    let findDecoration = lineDecorations.find((lineDecoration) => lineDecoration.options.description === GHOST_TEXT);

    expect(findDecoration).not.toBeUndefined();
    expect(findDecoration!.options.after?.content).toEqual('Hello ');
    expect(findDecoration!.options.after?.inlineClassName).toEqual(GHOST_TEXT_DESCRIPTION);

    lineDecorations = editor.getLineDecorations(9) || [];
    findDecoration = lineDecorations.find((lineDecoration) => lineDecoration.options.description === GHOST_TEXT);

    expect(findDecoration).not.toBeUndefined();
    expect(findDecoration!.options.after?.content).toEqual(' + 1');
    expect(findDecoration!.options.after?.inlineClassName).toEqual(GHOST_TEXT_DESCRIPTION);

    /**
     * 例如原始内容是:
     * function greet(person: Person) {
     *   console.log(\`Hello, \${person.name}!\`);
     * }
     *
     * 修改后的内容是:
     * function greets(persons: Persons) {
     *   console.log(\`Hello, \${persons.name}!\`);
     * }
     *
     * 则期望在 editor 当中的 ghost-text 装饰器应该分别是：
     *  在第 12 行中 "function greet" 后面的 "s"、"person" 后面的 "s" 以及 "Person" 后面的 "s"；
     *  在第 13 行的 "console.log(\`Hello, \${person" 后面的 "s"
     */
    modifications = [
      {
        lineNumber: 12,
        column: 15,
        newValue: 'function greets',
        oldValue: 'function greet',
      },
      {
        lineNumber: 12,
        column: 22,
        newValue: '(persons',
        oldValue: '(person',
      },
      {
        lineNumber: 12,
        column: 30,
        newValue: ': Persons',
        oldValue: ': Person',
      },
      {
        lineNumber: 13,
        column: 33,
        newValue: '${persons',
        oldValue: '${person',
      },
    ];

    multiLineDecorationModel.updateLineModificationDecorations(modifications);

    jest.setTimeout(10);

    lineDecorations = editor.getLineDecorations(12) || [];
    const filterDecoration = lineDecorations.filter(
      (lineDecoration) => lineDecoration.options.description === GHOST_TEXT,
    );

    expect(filterDecoration.length).toBe(3);

    lineDecorations = editor.getLineDecorations(13) || [];
    findDecoration = lineDecorations.find((lineDecoration) => lineDecoration.options.description === GHOST_TEXT);

    expect(findDecoration).not.toBeUndefined();
    expect(findDecoration!.options.after?.content).toEqual('s');
    expect(findDecoration!.options.after?.inlineClassName).toEqual(GHOST_TEXT_DESCRIPTION);
  });
});
