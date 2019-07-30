import * as vscode from 'vscode';
import * as types from './ext-types';
import * as model from './model.api';
import { URI, ISelection, IRange } from '@ali/ide-core-common';
import { RenderLineNumbersType } from './editor';
import { EndOfLineSequence, IDecorationRenderOptions, IThemeDecorationRenderOptions, IContentDecorationRenderOptions, TrackedRangeStickiness } from '@ali/ide-editor';

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

export function toRange(range: model.Range): types.Range {
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

export function toLocation(value: model.Location): types.Location {
  return new types.Location(value.uri, toRange(value.range));
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

export function convertDiagnosticToMarkerData(diagnostic: vscode.Diagnostic): model.MarkerData {
  return {
    code: convertCode(diagnostic.code),
    severity: convertSeverity(diagnostic.severity),
    message: diagnostic.message,
    source: diagnostic.source,
    startLineNumber: diagnostic.range.start.line + 1,
    startColumn: diagnostic.range.start.character + 1,
    endLineNumber: diagnostic.range.end.line + 1,
    endColumn: diagnostic.range.end.character + 1,
    relatedInformation: convertRelatedInformation(diagnostic.relatedInformation),
    tags: convertTags(diagnostic.tags),
  };
}

function convertCode(code: string | number | undefined): string | undefined {
  if (typeof code === 'number') {
    return String(code);
  } else {
    return code;
  }
}

function convertSeverity(severity: types.DiagnosticSeverity): types.MarkerSeverity {
  switch (severity) {
    case types.DiagnosticSeverity.Error: return types.MarkerSeverity.Error;
    case types.DiagnosticSeverity.Warning: return types.MarkerSeverity.Warning;
    case types.DiagnosticSeverity.Information: return types.MarkerSeverity.Info;
    case types.DiagnosticSeverity.Hint: return types.MarkerSeverity.Hint;
  }
}

function convertRelatedInformation(diagnosticsRelatedInformation: vscode.DiagnosticRelatedInformation[] | undefined): model.RelatedInformation[] | undefined {
  if (!diagnosticsRelatedInformation) {
    return undefined;
  }

  const relatedInformation: model.RelatedInformation[] = [];
  for (const item of diagnosticsRelatedInformation) {
    relatedInformation.push({
      resource: item.location.uri.toString(),
      message: item.message,
      startLineNumber: item.location.range.start.line + 1,
      startColumn: item.location.range.start.character + 1,
      endLineNumber: item.location.range.end.line + 1,
      endColumn: item.location.range.end.character + 1,
    });
  }
  return relatedInformation;
}

function convertTags(tags: types.DiagnosticTag[] | undefined): types.MarkerTag[] | undefined {
  if (!tags) {
    return undefined;
  }

  const markerTags: types.MarkerTag[] = [];
  for (const tag of tags) {
    switch (tag) {
      case types.DiagnosticTag.Unnecessary: markerTags.push(types.MarkerTag.Unnecessary);
    }
  }
  return markerTags;
}

export function toSelection(selection: model.Selection): types.Selection {
  const { selectionStartLineNumber, selectionStartColumn, positionLineNumber, positionColumn } = selection;
  const start = new types.Position(selectionStartLineNumber - 1, selectionStartColumn - 1);
  const end = new types.Position(positionLineNumber - 1, positionColumn - 1);
  return new types.Selection(start, end);
}

// tslint:disable-next-line:no-any
export function fromWorkspaceEdit(value: vscode.WorkspaceEdit, documents?: any): model.WorkspaceEditDto {
  const result: model.WorkspaceEditDto = {
    edits: [],
  };
  for (const entry of (value as types.WorkspaceEdit)._allEntries()) {
    const [uri, uriOrEdits] = entry;
    if (Array.isArray(uriOrEdits)) {
      // text edits
      const doc = documents ? documents.getDocument(uri.toString()) : undefined;
      result.edits.push({ resource: uri, modelVersionId: doc && doc.version, edits: uriOrEdits.map(fromTextEdit) } as model.ResourceTextEditDto);
    } else {
      // resource edits
      result.edits.push({ oldUri: uri, newUri: uriOrEdits, options: entry[2] } as model.ResourceFileEditDto);
    }
  }
  return result;
}

export function fromDocumentLink(link: vscode.DocumentLink): model.ILink {
  return {
    range: fromRange(link.range),
    url: link.target,
    tooltip: link.tooltip,
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
