import * as vscode from 'vscode';
import { Position, RelativePattern, CompletionItemKind, isMarkdownString } from './ext-types';
import * as model from './model.api';
import { URI } from '@ali/ide-core-common';

export function toPosition(position: model.Position): Position {
  return new Position(position.lineNumber - 1, position.column - 1);
}

export function fromPosition(position: Position): model.Position {
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

interface Codeblock {
  language: string;
  value: string;
}

// tslint:disable-next-line:no-any
function isCodeblock(thing: any): thing is Codeblock {
  return thing && typeof thing === 'object'
      && typeof ( thing as Codeblock).language === 'string'
      && typeof ( thing as Codeblock).value === 'string';
}

export function fromMarkdown(markup: vscode.MarkdownString | vscode.MarkedString): model.MarkdownString {
  if (isCodeblock(markup)) {
      const { language, value } = markup;
      return { value: '```' + language + '\n' + value + '\n```\n' };
  } else if (isMarkdownString(markup)) {
      return markup;
  } else if (typeof markup === 'string') {
      return { value:  markup as string };
  } else {
      return { value: '' };
  }
}

export function fromManyMarkdown(markup: (vscode.MarkdownString | vscode.MarkedString)[]): model.MarkdownString[] {
  return markup.map(fromMarkdown);
}

export function fromHover(hover: vscode.Hover): model.Hover {
  return  {
      range: hover.range && fromRange(hover.range),
      contents: fromManyMarkdown(hover.contents),
  } as model.Hover;
}

export function fromLanguageSelector(selector: vscode.DocumentSelector): model.LanguageSelector | undefined {
  if (!selector) {
      return undefined;
  } else if (Array.isArray(selector)) {
      return  selector.map(fromLanguageSelector) as model.LanguageSelector;
  } else if (typeof selector === 'string') {
      return selector;
  } else {
      return  {
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
      return new RelativePattern(pattern.base, pattern.pattern);
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

export function fromCompletionItemKind(kind?: CompletionItemKind): model.CompletionType {
  switch (kind) {
      case CompletionItemKind.Method: return 'method';
      case CompletionItemKind.Function: return 'function';
      case CompletionItemKind.Constructor: return 'constructor';
      case CompletionItemKind.Field: return 'field';
      case CompletionItemKind.Variable: return 'variable';
      case CompletionItemKind.Class: return 'class';
      case CompletionItemKind.Interface: return 'interface';
      case CompletionItemKind.Struct: return 'struct';
      case CompletionItemKind.Module: return 'module';
      case CompletionItemKind.Property: return 'property';
      case CompletionItemKind.Unit: return 'unit';
      case CompletionItemKind.Value: return 'value';
      case CompletionItemKind.Constant: return 'constant';
      case CompletionItemKind.Enum: return 'enum';
      case CompletionItemKind.EnumMember: return 'enum-member';
      case CompletionItemKind.Keyword: return 'keyword';
      case CompletionItemKind.Snippet: return 'snippet';
      case CompletionItemKind.Text: return 'text';
      case CompletionItemKind.Color: return 'color';
      case CompletionItemKind.File: return 'file';
      case CompletionItemKind.Reference: return 'reference';
      case CompletionItemKind.Folder: return 'folder';
      case CompletionItemKind.Event: return 'event';
      case CompletionItemKind.Operator: return 'operator';
      case CompletionItemKind.TypeParameter: return 'type-parameter';
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
  return  {
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
