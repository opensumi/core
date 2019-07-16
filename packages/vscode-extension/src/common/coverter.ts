import * as vscode from 'vscode';
import { Position, Range, RelativePattern } from './ext-types.host';
import * as model from './model.api';
import { isMarkdownString } from './markdown-string';

export function toPosition(position: model.Position): Position {
  return new Position(position.lineNumber - 1, position.column - 1);
}

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
      range: fromRange(hover.range),
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
