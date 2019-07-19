import * as vscode from 'vscode';
import * as types from './ext-types';
import * as model from './model.api';
import { URI } from '@ali/ide-core-common';

export function toPosition(position: model.Position): types.Position {
  return new types.Position(position.lineNumber - 1, position.column - 1);
}

export function fromPosition(position: types.Position): model.Position {
  return { lineNumber: position.line + 1, column: position.character + 1 };
}

export function fromRange(range: undefined): undefined;
export function fromRange(range: vscode.Range): model.Range;
export function fromRange(range: vscode.Range | undefined): model.Range | undefined {
  if (!range) {
    return undefined;
  }
  const { start, end } = range;
  return {
    startLineNumber: start.line + 1,
    startColumn: start.character + 1,
    endLineNumber: end.line + 1,
    endColumn: end.character + 1,
  };
}

export function toRange(range: model.Range | undefined): types.Range | undefined {
  if (!range) {
    return undefined;
  }

  const { startLineNumber, startColumn, endLineNumber, endColumn } = range;
  return new types.Range(startLineNumber - 1, startColumn - 1, endLineNumber - 1, endColumn - 1);
}

interface Codeblock {
  language: string;
  value: string;
}

// tslint:disable-next-line:no-any
function isCodeblock(thing: any): thing is Codeblock {
  return thing && typeof thing === 'object'
    && typeof (thing as Codeblock).language === 'string'
    && typeof (thing as Codeblock).value === 'string';
}

export function fromMarkdown(markup: vscode.MarkdownString | vscode.MarkedString): model.MarkdownString {
  if (isCodeblock(markup)) {
    const { language, value } = markup;
    return { value: '```' + language + '\n' + value + '\n```\n' };
  } else if (types.isMarkdownString(markup)) {
    return markup;
  } else if (typeof markup === 'string') {
    return { value: markup as string };
  } else {
    return { value: '' };
  }
}

export function fromManyMarkdown(markup: (vscode.MarkdownString | vscode.MarkedString)[]): model.MarkdownString[] {
  return markup.map(fromMarkdown);
}

export function fromHover(hover: vscode.Hover): model.Hover {
  return {
    range: hover.range && fromRange(hover.range),
    contents: fromManyMarkdown(hover.contents),
  } as model.Hover;
}

export function fromLanguageSelector(selector: vscode.DocumentSelector): model.LanguageSelector | undefined {
  if (!selector) {
    return undefined;
  } else if (Array.isArray(selector)) {
    return selector.map(fromLanguageSelector) as model.LanguageSelector;
  } else if (typeof selector === 'string') {
    return selector;
  } else {
    return {
      language: selector.language,
      scheme: selector.scheme,
      pattern: fromGlobPattern(selector.pattern!),
    } as model.LanguageFilter;
  }
}

export function fromGlobPattern(pattern: vscode.GlobPattern): string | model.RelativePattern {
  if (typeof pattern === 'string') {
    return pattern;
  }

  if (isRelativePattern(pattern)) {
    return new types.RelativePattern(pattern.base, pattern.pattern);
  }

  return pattern;
}

function isRelativePattern(obj: {}): obj is vscode.RelativePattern {
  const rp = obj as vscode.RelativePattern;
  return rp && typeof rp.base === 'string' && typeof rp.pattern === 'string';
}

export function fromLocation(value: vscode.Location): model.Location {
  return {
    range: value.range && fromRange(value.range),
    uri: value.uri,
  };
}

export function fromCompletionItemKind(kind?: types.CompletionItemKind): model.CompletionType {
  switch (kind) {
    case types.CompletionItemKind.Method: return 'method';
    case types.CompletionItemKind.Function: return 'function';
    case types.CompletionItemKind.Constructor: return 'constructor';
    case types.CompletionItemKind.Field: return 'field';
    case types.CompletionItemKind.Variable: return 'variable';
    case types.CompletionItemKind.Class: return 'class';
    case types.CompletionItemKind.Interface: return 'interface';
    case types.CompletionItemKind.Struct: return 'struct';
    case types.CompletionItemKind.Module: return 'module';
    case types.CompletionItemKind.Property: return 'property';
    case types.CompletionItemKind.Unit: return 'unit';
    case types.CompletionItemKind.Value: return 'value';
    case types.CompletionItemKind.Constant: return 'constant';
    case types.CompletionItemKind.Enum: return 'enum';
    case types.CompletionItemKind.EnumMember: return 'enum-member';
    case types.CompletionItemKind.Keyword: return 'keyword';
    case types.CompletionItemKind.Snippet: return 'snippet';
    case types.CompletionItemKind.Text: return 'text';
    case types.CompletionItemKind.Color: return 'color';
    case types.CompletionItemKind.File: return 'file';
    case types.CompletionItemKind.Reference: return 'reference';
    case types.CompletionItemKind.Folder: return 'folder';
    case types.CompletionItemKind.Event: return 'event';
    case types.CompletionItemKind.Operator: return 'operator';
    case types.CompletionItemKind.TypeParameter: return 'type-parameter';
  }
  return 'property';
}

export function fromTextEdit(edit: vscode.TextEdit): model.SingleEditOperation {
  return {
    text: edit.newText,
    range: fromRange(edit.range),
  } as model.SingleEditOperation;
}

export function fromDefinitionLink(definitionLink: vscode.DefinitionLink): model.DefinitionLink {
  return {
    uri: definitionLink.targetUri,
    range: fromRange(definitionLink.targetRange),
    origin: definitionLink.originSelectionRange ? fromRange(definitionLink.originSelectionRange) : undefined,
    selectionRange: definitionLink.targetSelectionRange ? fromRange(definitionLink.targetSelectionRange) : undefined,
  } as model.DefinitionLink;
}

export function fromInsertText(item: vscode.CompletionItem): string {
  if (typeof item.insertText === 'string') {
    return item.insertText;
  }
  // TODO vscode.SnippetString 应该不是这么简单的兼容的，有一个匹配的逻辑，不属于converter
  if (typeof item.insertText === 'object') {
    return item.insertText.value;
  }
  return item.label;
}

export function fromFoldingRange(foldingRange: vscode.FoldingRange): model.FoldingRange {
  const range: model.FoldingRange = {
    start: foldingRange.start + 1,
    end: foldingRange.end + 1,
  };
  if (foldingRange.kind) {
    range.kind = fromFoldingRangeKind(foldingRange.kind);
  }
  return range;
}

export function fromFoldingRangeKind(kind: vscode.FoldingRangeKind | undefined): model.FoldingRangeKind | undefined {
  if (kind) {
    switch (kind) {
      case types.FoldingRangeKind.Comment:
        return model.FoldingRangeKind.Comment;
      case types.FoldingRangeKind.Imports:
        return model.FoldingRangeKind.Imports;
      case types.FoldingRangeKind.Region:
        return model.FoldingRangeKind.Region;
    }
  }
  return undefined;
}

export function fromSelectionRange(obj: vscode.SelectionRange): model.SelectionRange {
  return { range: fromRange(obj.range) };
}

export function fromColor(color: types.Color): [number, number, number, number] {
  return [color.red, color.green, color.blue, color.alpha];
}

export function toColor(color: [number, number, number, number]): types.Color {
  return new types.Color(color[0], color[1], color[2], color[3]);
}

export function fromColorPresentation(colorPresentation: vscode.ColorPresentation): model.ColorPresentation {
  return {
    label: colorPresentation.label,
    textEdit: colorPresentation.textEdit ? fromTextEdit(colorPresentation.textEdit) : undefined,
    additionalTextEdits: colorPresentation.additionalTextEdits ? colorPresentation.additionalTextEdits.map((value) => fromTextEdit(value)) : undefined,
  };
}

export function fromDocumentHighlightKind(kind?: vscode.DocumentHighlightKind): model.DocumentHighlightKind | undefined {
  switch (kind) {
    case types.DocumentHighlightKind.Text: return model.DocumentHighlightKind.Text;
    case types.DocumentHighlightKind.Read: return model.DocumentHighlightKind.Read;
    case types.DocumentHighlightKind.Write: return model.DocumentHighlightKind.Write;
  }
  return model.DocumentHighlightKind.Text;
}

export function fromDocumentHighlight(documentHighlight: vscode.DocumentHighlight): model.DocumentHighlight {
  return {
    range: fromRange(documentHighlight.range),
    kind: fromDocumentHighlightKind(documentHighlight.kind),
  } as model.DocumentHighlight;
}

export function toInternalCommand(external: vscode.Command): model.Command {
  // we're deprecating Command.id, so it has to be optional.
  // Existing code will have compiled against a non - optional version of the field, so asserting it to exist is ok
  // tslint:disable-next-line: no-any
  return KnownCommands.map(external.command!, external.arguments, (mappedId: string, mappedArgs: any) =>
    ({
      id: mappedId,
      title: external.title || ' ',
      tooltip: external.tooltip,
      arguments: mappedArgs,
    }));
}

function toArrayConversion<T, U>(f: (a: T) => U): (a: T[]) => U[] {
  return (a: T[]) => {
    return a.map(f);
  };
}

export namespace KnownCommands {
  // tslint:disable: no-any
  const mappings: { [id: string]: [string, (args: any[] | undefined) => any[] | undefined] } = {};
  mappings['editor.action.showReferences'] = ['textEditor.commands.showReferences', createConversionFunction(
    (uri: URI) => uri.toString(),
    fromPositionToP,
    toArrayConversion(fromLocationToL))];

  export function map<T>(id: string, args: any[] | undefined, toDo: (mappedId: string, mappedArgs: any[] | undefined) => T): T {
    if (mappings[id]) {
      return toDo(mappings[id][0], mappings[id][1](args));
    } else {
      return toDo(id, args);
    }
  }

  type conversionFunction = ((parameter: any) => any) | undefined;
  function createConversionFunction(...conversions: conversionFunction[]): (args: any[] | undefined) => any[] | undefined {
    return (args: any[] | undefined): any[] | undefined => {
      if (!args) {
        return args;
      }
      return args.map((arg: any, index: number): any => {
        if (index < conversions.length) {
          const conversion = conversions[index];
          if (conversion) {
            return conversion(arg);
          }
        }
        return arg;
      });
    };
  }
  // tslint:enable: no-any
  function fromPositionToP(p: vscode.Position): types.Position {
    return new types.Position(p.line, p.character);
  }

  function fromRangeToR(r: vscode.Range): types.Range {
    return new types.Range(fromPositionToP(r.start), fromPositionToP(r.end));
  }

  function fromLocationToL(l: vscode.Location): types.Location {
    return new types.Location(l.uri, fromRangeToR(l.range));
  }
}

export function fromDocumentLink(definitionLink: vscode.DocumentLink): model.DocumentLink {
  return  {
    range: fromRange(definitionLink.range),
    url: definitionLink.target && definitionLink.target.toString(),
  } as model.DocumentLink;
}
