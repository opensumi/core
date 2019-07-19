import * as vscode from 'vscode';
import * as types from './ext-types';
import * as model from './model.api';
import { isMarkdownString } from './markdown-string';
import { URI, ISelection, IRange } from '@ali/ide-core-common';
import { RenderLineNumbersType } from './editor';
import { EndOfLineSequence, IContentDecorationRenderOptions, IThemeDecorationRenderOptions, TrackedRangeStickiness, IDecorationRenderOptions } from '@ali/ide-editor';

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

export namespace TypeConverts {

  export namespace Selection {

    export function to(selection: ISelection): vscode.Selection {
      const { selectionStartLineNumber, selectionStartColumn, positionLineNumber, positionColumn } = selection;
      const start = new types.Position(selectionStartLineNumber - 1, selectionStartColumn - 1);
      const end = new types.Position(positionLineNumber - 1, positionColumn - 1);
      return new types.Selection(start, end);
    }

    export function from(selection: vscode.Selection): ISelection {
      const { anchor, active } = selection;
      return {
        selectionStartLineNumber: anchor.line + 1,
        selectionStartColumn: anchor.character + 1,
        positionLineNumber: active.line + 1,
        positionColumn: active.character + 1,
      };
    }
  }

  export namespace TextEditorLineNumbersStyle {
    export function from(style: types.TextEditorLineNumbersStyle): RenderLineNumbersType {
      switch (style) {
        case types.TextEditorLineNumbersStyle.Off:
          return RenderLineNumbersType.Off;
        case types.TextEditorLineNumbersStyle.Relative:
          return RenderLineNumbersType.Relative;
        case types.TextEditorLineNumbersStyle.On:
        default:
          return RenderLineNumbersType.On;
      }
    }
    export function to(style: RenderLineNumbersType): types.TextEditorLineNumbersStyle {
      switch (style) {
        case RenderLineNumbersType.Off:
          return types.TextEditorLineNumbersStyle.Off;
        case RenderLineNumbersType.Relative:
          return types.TextEditorLineNumbersStyle.Relative;
        case RenderLineNumbersType.On:
        default:
          return types.TextEditorLineNumbersStyle.On;
      }
    }
  }

  export namespace Range {

    export function from(range: undefined): undefined;
    export function from(range: vscode.Range): IRange;
    export function from(range: vscode.Range | undefined): IRange | undefined;
    export function from(range: vscode.Range | undefined): IRange | undefined {
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

    export function to(range: undefined): vscode.Range;
    export function to(range: IRange | undefined): vscode.Range | undefined;
    export function to(range: IRange | undefined): vscode.Range | undefined {
      if (!range) {
        return undefined;
      }
      const { startLineNumber, startColumn, endLineNumber, endColumn } = range;
      return new types.Range(startLineNumber - 1, startColumn - 1, endLineNumber - 1, endColumn - 1);
    }
  }

  export namespace EndOfLine {

    export function from(eol: types.EndOfLine): EndOfLineSequence | undefined {
      if (eol === types.EndOfLine.CRLF) {
        return EndOfLineSequence.CRLF;
      } else if (eol === types.EndOfLine.LF) {
        return EndOfLineSequence.LF;
      }
      return undefined;
    }

    export function to(eol: EndOfLineSequence): types.EndOfLine | undefined {
      if (eol === EndOfLineSequence.CRLF) {
        return types.EndOfLine.CRLF;
      } else if (eol === EndOfLineSequence.LF) {
        return types.EndOfLine.LF;
      }
      return undefined;
    }
  }
  export namespace DecorationRenderOptions {
    export function from(options: any): IDecorationRenderOptions {
      return {
        isWholeLine: options.isWholeLine,
        rangeBehavior: options.rangeBehavior ? DecorationRangeBehavior.from(options.rangeBehavior) : undefined,
        overviewRulerLane: options.overviewRulerLane,
        light: options.light ? ThemableDecorationRenderOptions.from(options.light) : undefined,
        dark: options.dark ? ThemableDecorationRenderOptions.from(options.dark) : undefined,

        backgroundColor: options.backgroundColor as string | types.ThemeColor,
        outline: options.outline,
        outlineColor: options.outlineColor as string | types.ThemeColor,
        outlineStyle: options.outlineStyle,
        outlineWidth: options.outlineWidth,
        border: options.border,
        borderColor: options.borderColor as string | types.ThemeColor,
        borderRadius: options.borderRadius,
        borderSpacing: options.borderSpacing,
        borderStyle: options.borderStyle,
        borderWidth: options.borderWidth,
        fontStyle: options.fontStyle,
        fontWeight: options.fontWeight,
        textDecoration: options.textDecoration,
        cursor: options.cursor,
        color: options.color as string | types.ThemeColor,
        opacity: options.opacity,
        letterSpacing: options.letterSpacing,
        gutterIconPath: options.gutterIconPath ? pathOrURIToURI(options.gutterIconPath) : undefined,
        gutterIconSize: options.gutterIconSize,
        overviewRulerColor: options.overviewRulerColor as string | types.ThemeColor,
        before: options.before ? ThemableDecorationAttachmentRenderOptions.from(options.before) : undefined,
        after: options.after ? ThemableDecorationAttachmentRenderOptions.from(options.after) : undefined,
      };
    }
  }
  export namespace ThemableDecorationRenderOptions {
    export function from(options: vscode.ThemableDecorationRenderOptions): IThemeDecorationRenderOptions {
      if (typeof options === 'undefined') {
        return options;
      }
      return {
        backgroundColor: options.backgroundColor as string | types.ThemeColor,
        outline: options.outline,
        outlineColor: options.outlineColor as string | types.ThemeColor,
        outlineStyle: options.outlineStyle,
        outlineWidth: options.outlineWidth,
        border: options.border,
        borderColor: options.borderColor as string | types.ThemeColor,
        borderRadius: options.borderRadius,
        borderSpacing: options.borderSpacing,
        borderStyle: options.borderStyle,
        borderWidth: options.borderWidth,
        fontStyle: options.fontStyle,
        fontWeight: options.fontWeight,
        textDecoration: options.textDecoration,
        cursor: options.cursor,
        color: options.color as string | types.ThemeColor,
        opacity: options.opacity,
        letterSpacing: options.letterSpacing,
        gutterIconPath: options.gutterIconPath ? pathOrURIToURI(options.gutterIconPath) : undefined,
        gutterIconSize: options.gutterIconSize,
        overviewRulerColor: options.overviewRulerColor as string | types.ThemeColor,
        before: options.before ? ThemableDecorationAttachmentRenderOptions.from(options.before) : undefined,
        after: options.after ? ThemableDecorationAttachmentRenderOptions.from(options.after) : undefined,
      };
    }
  }
  export namespace ThemableDecorationAttachmentRenderOptions {
    export function from(options: vscode.ThemableDecorationAttachmentRenderOptions): IContentDecorationRenderOptions {
      if (typeof options === 'undefined') {
        return options;
      }
      return {
        contentText: options.contentText,
        contentIconPath: options.contentIconPath ? pathOrURIToURI(options.contentIconPath) : undefined,
        border: options.border,
        borderColor: options.borderColor as string | types.ThemeColor,
        fontStyle: options.fontStyle,
        fontWeight: options.fontWeight,
        textDecoration: options.textDecoration,
        color: options.color as string | types.ThemeColor,
        backgroundColor: options.backgroundColor as string | types.ThemeColor,
        margin: options.margin,
        width: options.width,
        height: options.height,
      };
    }
  }

  export namespace DecorationRangeBehavior {
    export function from(value: types.DecorationRangeBehavior): TrackedRangeStickiness | undefined {
      if (typeof value === 'undefined') {
        return value;
      }
      switch (value) {
        case types.DecorationRangeBehavior.OpenOpen:
          return TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges;
        case types.DecorationRangeBehavior.ClosedClosed:
          return TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges;
        case types.DecorationRangeBehavior.OpenClosed:
          return TrackedRangeStickiness.GrowsOnlyWhenTypingBefore;
        case types.DecorationRangeBehavior.ClosedOpen:
          return TrackedRangeStickiness.GrowsOnlyWhenTypingAfter;
      }
    }
  }

}

export function pathOrURIToURI(value: string | types.Uri): types.Uri {
  if (typeof value === 'undefined') {
    return value;
  }
  if (typeof value === 'string') {
    return types.Uri.file(value);
  } else {
    return value;
  }
}
