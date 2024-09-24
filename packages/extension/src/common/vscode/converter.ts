import { Position as P, Range as R, SymbolKind as S, SymbolInformation } from 'vscode-languageserver-types';

import { IChatFollowup, IChatReplyFollowup, IChatResponseCommandFollowup } from '@opensumi/ide-ai-native/lib/common';
import { createMarkedRenderer, toMarkdownHtml } from '@opensumi/ide-components/lib/utils';
import {
  IMarkdownString,
  IMarkerData,
  IRelatedInformation,
  IRelativePattern,
  ISelection,
  IThemeColor,
  ProgressLocation as MainProgressLocation,
  MarkerSeverity,
  MarkerTag,
  URI,
  Uri,
  UriComponents,
  arrays,
  isDefined,
  isNumber,
  objects,
  once,
  path,
  randomString,
} from '@opensumi/ide-core-common';
import { ChatMessageRole as ChatMessageRoleEnum, IChatMessage } from '@opensumi/ide-core-common/lib/types/ai-native';
import * as debugModel from '@opensumi/ide-debug';
import { IEvaluatableExpression } from '@opensumi/ide-debug/lib/common/evaluatable-expression';
import {
  CellKind,
  EditorGroupColumn,
  ICellRange,
  IContentDecorationRenderOptions,
  IDecorationRenderOptions,
  IThemeDecorationRenderOptions,
  LanguageFilter,
  LanguageSelector,
  NotebookCellInternalMetadata,
  TrackedRangeStickiness,
} from '@opensumi/ide-editor/lib/common';
import { FileStat, FileType } from '@opensumi/ide-file-service';
import { CodeActionTriggerType, EndOfLineSequence } from '@opensumi/ide-monaco/lib/common/types';
import { TestId } from '@opensumi/ide-testing/lib/common';
import {
  CoverageDetails,
  DetailType,
  ICoveredCount,
  IFileCoverage,
  ISerializedTestResults,
  ITestErrorMessage,
  ITestItem,
  ITestItemContext,
  ITestTag,
  SerializedTestErrorMessage,
  SerializedTestResultItem,
  TestMessageType,
} from '@opensumi/ide-testing/lib/common/testCollection';
import { RenderLineNumbersType } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import * as languages from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';

import { CommandsConverter } from '../../hosted/api/vscode/ext.host.command';

import { IDataTransferItem, VSDataTransfer } from './data-transfer';
import { ExtensionDocumentDataManager } from './doc';
import { ViewColumn as ViewColumnEnums } from './enums';
import * as types from './ext-types';
import { IInlineValueContextDto } from './languages';
import * as model from './model.api';
import { isMarkdownString, parseHrefAndDimensions } from './models';
import { TestItemImpl, getPrivateApiFor } from './testing/testApi';
import { DataTransferDTO } from './treeview';

import type vscode from 'vscode';

const { parse } = path;
const { cloneAndChange } = objects;
const { coalesce, asArray } = arrays;

export interface TextEditorOpenOptions extends vscode.TextDocumentShowOptions {
  background?: boolean;
  override?: boolean;
}

export namespace TextEditorOpenOptions {
  export function from(options?: TextEditorOpenOptions): any | /* ITextEditorOptions */ undefined {
    if (options) {
      return {
        pinned: typeof options.preview === 'boolean' ? !options.preview : undefined,
        inactive: options.background,
        preserveFocus: options.preserveFocus,
        selection: typeof options.selection === 'object' ? Range.from(options.selection) : undefined,
        override: typeof options.override === 'boolean' ? false : undefined,
      };
    }

    return undefined;
  }
}

export function toPosition(position: model.Position): types.Position {
  return new types.Position(position.lineNumber - 1, position.column - 1);
}

export function fromPosition(position: types.Position): model.Position {
  return { lineNumber: position.line + 1, column: position.character + 1 };
}

export namespace Range {
  export function from(range: undefined): undefined;
  export function from(range: vscode.Range): model.Range;
  export function from(range: vscode.Range | undefined): model.Range | undefined;
  export function from(range: vscode.Range | undefined): model.Range | undefined {
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

  export function to(range: undefined): undefined;
  export function to(range: model.Range): types.Range;
  export function to(range: model.Range | undefined): types.Range | undefined;
  export function to(range: model.Range | undefined): types.Range | undefined {
    if (!range) {
      return undefined;
    }
    const { startLineNumber, startColumn, endLineNumber, endColumn } = range;
    return new types.Range(startLineNumber - 1, startColumn - 1, endLineNumber - 1, endColumn - 1);
  }
}

/**
 * @deprecated 之后使用 vscode 的形式 Range.from 代替
 * @param range
 */
export function fromRange(range: undefined): undefined;
export function fromRange(range: vscode.Range): model.Range;
export function fromRange(range: vscode.Range | undefined): model.Range | undefined {
  return Range.from(range);
}

/**
 * @deprecated 之后使用 vscode 的形式 Range.to 代替
 * @param range
 */
export function toRange(range: model.Range): types.Range {
  return Range.to(range);
}

interface Codeblock {
  language: string;
  value: string;
}

function isCodeblock(thing: any): thing is Codeblock {
  return (
    thing &&
    typeof thing === 'object' &&
    typeof (thing as Codeblock).language === 'string' &&
    typeof (thing as Codeblock).value === 'string'
  );
}

export function fromMarkdown(markup: vscode.MarkdownString | vscode.MarkedString): model.IMarkdownString {
  if (isCodeblock(markup)) {
    const { language, value } = markup;
    return { value: '```' + language + '\n' + value + '\n```\n' };
  } else if (isMarkdownString(markup)) {
    return markup;
  } else if (typeof markup === 'string') {
    return { value: markup as string };
  } else {
    return { value: '' };
  }
}

export namespace MarkdownString {
  export function fromMany(markup: (vscode.MarkdownString | vscode.MarkedString)[]): IMarkdownString[] {
    return markup.map(MarkdownString.from);
  }

  interface Codeblock {
    language: string;
    value: string;
  }

  function isCodeblock(thing: any): thing is Codeblock {
    return (
      thing &&
      typeof thing === 'object' &&
      typeof (thing as Codeblock).language === 'string' &&
      typeof (thing as Codeblock).value === 'string'
    );
  }

  export function from(markup: vscode.MarkdownString | vscode.MarkedString): IMarkdownString {
    let res: IMarkdownString;
    if (isCodeblock(markup)) {
      const { language, value } = markup;
      res = { value: '```' + language + '\n' + value + '\n```\n' };
    } else if (types.MarkdownString.isMarkdownString(markup)) {
      res = {
        value: markup.value,
        isTrusted: markup.isTrusted,
        supportHtml: markup.supportHtml,
        supportThemeIcons: markup.supportThemeIcons,
        baseUri: markup.baseUri,
      };
    } else if (typeof markup === 'string') {
      res = { value: markup };
    } else {
      res = { value: '' };
    }

    // extract uris into a separate object
    const resUris: { [href: string]: UriComponents } = Object.create(null);
    res.uris = resUris;

    const collectUri = (href: string): string => {
      try {
        let uri = Uri.parse(href);
        uri = uri.with({ query: _uriMassage(uri.query, resUris) });
        resUris[href] = uri;
      } catch (e) {
        // ignore
      }
      return '';
    };
    const renderer = createMarkedRenderer();
    renderer.link = collectUri;
    renderer.image = (href) => (href ? collectUri(parseHrefAndDimensions(href).href) : '');

    toMarkdownHtml(res.value, { renderer });

    return res;
  }

  function _uriMassage(part: string, bucket: { [n: string]: UriComponents }): string {
    if (!part) {
      return part;
    }
    let data: any;
    try {
      data = parse(part);
    } catch (e) {
      // ignore
    }
    if (!data) {
      return part;
    }
    let changed = false;
    data = cloneAndChange(data, (value) => {
      if (Uri.isUri(value)) {
        const key = `__uri_${randomString(6)}`;
        bucket[key] = value;
        changed = true;
        return key;
      } else {
        return undefined;
      }
    });

    if (!changed) {
      return part;
    }

    return JSON.stringify(data);
  }

  export function to(value: IMarkdownString): vscode.MarkdownString {
    const result = new types.MarkdownString(value.value, value.supportThemeIcons);
    result.isTrusted = value.isTrusted;
    result.supportHtml = value.supportHtml;
    result.baseUri = value.baseUri ? URI.revive(value.baseUri) : undefined;
    return result;
  }

  export function fromStrict(value: string | vscode.MarkdownString | undefined): undefined | string | IMarkdownString {
    if (!value) {
      return undefined;
    }
    return typeof value === 'string' ? value : MarkdownString.from(value);
  }
}

/**
 * @deprecated
 */
export function fromManyMarkdown(markup: (vscode.MarkdownString | vscode.MarkedString)[]): model.IMarkdownString[] {
  return markup.map(fromMarkdown);
}

export namespace Hover {
  export function from(hover: vscode.Hover): model.Hover {
    return {
      range: Range.from(hover.range),
      contents: MarkdownString.fromMany(hover.contents),
    } as model.Hover;
  }

  export function to(info: model.Hover): types.Hover {
    return new types.Hover(info.contents.map(MarkdownString.to), Range.to(info.range));
  }
}

export function fromHover(hover: vscode.Hover): model.Hover {
  return {
    range: hover.range && fromRange(hover.range),
    contents: fromManyMarkdown(hover.contents),
  } as model.Hover;
}

export function fromLanguageSelector(selector: vscode.DocumentSelector): LanguageSelector | undefined {
  if (!selector) {
    return undefined;
  } else if (Array.isArray(selector)) {
    return selector.map(fromLanguageSelector) as LanguageSelector;
  } else if (typeof selector === 'string') {
    return selector;
  } else {
    return {
      language: (selector as vscode.DocumentFilter).language,
      scheme: (selector as vscode.DocumentFilter).scheme,
      pattern: fromGlobPattern((selector as vscode.DocumentFilter).pattern!),
    } as LanguageFilter;
  }
}

export function fromGlobPattern(pattern: vscode.GlobPattern): string | IRelativePattern {
  if (typeof pattern === 'string') {
    return pattern;
  }

  if (isRelativePattern(pattern)) {
    return new types.RelativePattern(pattern.base, pattern.pattern);
  }

  return pattern;
}

function isRelativePattern(obj: any): obj is vscode.RelativePattern {
  const rp = obj as vscode.RelativePattern;
  return rp && typeof rp.base === 'string' && typeof rp.pattern === 'string';
}

export namespace location {
  export function from(value: vscode.Location): model.Location {
    return {
      range: value.range && Range.from(value.range),
      uri: value.uri,
    };
  }

  export function to(value: model.Location): types.Location {
    return new types.Location(value.uri, Range.to(value.range));
  }
}

/**
 * @deprecated
 */
export function fromLocation(value: vscode.Location): model.Location {
  return {
    range: value.range && fromRange(value.range),
    uri: value.uri,
  };
}

/**
 * @deprecated
 */
export function toLocation(value: model.Location): types.Location {
  return new types.Location(value.uri, toRange(value.range));
}

export namespace EndOfLine {
  export function from(eol: vscode.EndOfLine): EndOfLineSequence | undefined {
    if (eol === types.EndOfLine.CRLF) {
      return EndOfLineSequence.CRLF;
    } else if (eol === types.EndOfLine.LF) {
      return EndOfLineSequence.LF;
    }
    return undefined;
  }

  export function to(eol: EndOfLineSequence): vscode.EndOfLine | undefined {
    if (eol === EndOfLineSequence.CRLF) {
      return types.EndOfLine.CRLF;
    } else if (eol === EndOfLineSequence.LF) {
      return types.EndOfLine.LF;
    }
    return undefined;
  }
}

export namespace TextEdit {
  export function from(edit: vscode.TextEdit): model.TextEdit {
    return {
      text: edit.newText,
      eol: edit.newEol && EndOfLine.from(edit.newEol),
      range: Range.from(edit.range),
    } as model.TextEdit;
  }

  export function to(edit: model.TextEdit): types.TextEdit {
    const result = new types.TextEdit(Range.to(edit.range), edit.text);
    result.newEol = (
      typeof edit.eol === 'undefined' ? undefined : EndOfLine.to(edit.eol as unknown as EndOfLineSequence)
    )!;
    return result;
  }
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

export namespace ColorPresentation {
  export function to(colorPresentation: model.IColorPresentation): types.ColorPresentation {
    const cp = new types.ColorPresentation(colorPresentation.label);
    if (colorPresentation.textEdit) {
      cp.textEdit = TextEdit.to(colorPresentation.textEdit);
    }
    if (colorPresentation.additionalTextEdits) {
      cp.additionalTextEdits = colorPresentation.additionalTextEdits.map((value) => TextEdit.to(value));
    }
    return cp;
  }

  export function from(colorPresentation: vscode.ColorPresentation): model.IColorPresentation {
    return {
      label: colorPresentation.label,
      textEdit: colorPresentation.textEdit ? TextEdit.from(colorPresentation.textEdit) : undefined,
      additionalTextEdits: colorPresentation.additionalTextEdits
        ? colorPresentation.additionalTextEdits.map((value) => TextEdit.from(value))
        : undefined,
    };
  }
}

export namespace Color {
  export function to(c: [number, number, number, number]): types.Color {
    return new types.Color(c[0], c[1], c[2], c[3]);
  }
  export function from(color: types.Color): [number, number, number, number] {
    return [color.red, color.green, color.blue, color.alpha];
  }
}

/**
 * @deprecated
 */
export function fromColor(color: types.Color): [number, number, number, number] {
  return [color.red, color.green, color.blue, color.alpha];
}

export function toColor(color: [number, number, number, number]): types.Color {
  return new types.Color(color[0], color[1], color[2], color[3]);
}

/**
 * @description
 * @param colorPresentation
 */
export function fromColorPresentation(colorPresentation: vscode.ColorPresentation): model.ColorPresentation {
  return {
    label: colorPresentation.label,
    textEdit: colorPresentation.textEdit ? fromTextEdit(colorPresentation.textEdit) : undefined,
    additionalTextEdits: colorPresentation.additionalTextEdits
      ? colorPresentation.additionalTextEdits.map((value) => fromTextEdit(value))
      : undefined,
  };
}

export namespace DocumentHighlight {
  export function from(documentHighlight: vscode.DocumentHighlight): model.DocumentHighlight {
    return {
      range: fromRange(documentHighlight.range),
      kind: documentHighlight.kind,
    };
  }
  export function to(occurrence: model.DocumentHighlight): types.DocumentHighlight {
    return new types.DocumentHighlight(toRange(occurrence.range), occurrence.kind);
  }
}

export function fromDocumentHighlightKind(
  kind?: vscode.DocumentHighlightKind,
): model.DocumentHighlightKind | undefined {
  switch (kind) {
    case types.DocumentHighlightKind.Text:
      return model.DocumentHighlightKind.Text;
    case types.DocumentHighlightKind.Read:
      return model.DocumentHighlightKind.Read;
    case types.DocumentHighlightKind.Write:
      return model.DocumentHighlightKind.Write;
  }
  return model.DocumentHighlightKind.Text;
}

export namespace Diagnostic {
  export function convertCode(
    code?:
      | string
      | number
      | {
          value: string | number;
          target: Uri;
        },
  ): string | undefined {
    if (typeof code === 'number') {
      return String(code);
    } else if (typeof code === 'object') {
      return String(code.value);
    } else {
      return code;
    }
  }

  export function toMarker(diagnostic: vscode.Diagnostic): IMarkerData {
    return {
      code: convertCode(diagnostic.code),
      codeHref: typeof diagnostic.code === 'object' ? Uri.from(diagnostic.code.target) : undefined,
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
  export function convertSeverity(severity: types.DiagnosticSeverity): MarkerSeverity {
    switch (severity) {
      case types.DiagnosticSeverity.Error:
        return MarkerSeverity.Error;
      case types.DiagnosticSeverity.Warning:
        return MarkerSeverity.Warning;
      case types.DiagnosticSeverity.Information:
        return MarkerSeverity.Info;
      case types.DiagnosticSeverity.Hint:
        return MarkerSeverity.Hint;
    }
  }

  export function convertRelatedInformation(
    diagnosticsRelatedInformation: vscode.DiagnosticRelatedInformation[] | undefined,
  ): IRelatedInformation[] | undefined {
    if (!diagnosticsRelatedInformation) {
      return undefined;
    }

    const relatedInformation: IRelatedInformation[] = [];
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
  function convertTags(tags: types.DiagnosticTag[] | undefined): MarkerTag[] | undefined {
    if (!tags) {
      return undefined;
    }

    const markerTags: MarkerTag[] = [];
    for (const tag of tags) {
      switch (tag) {
        case types.DiagnosticTag.Unnecessary:
          markerTags.push(MarkerTag.Unnecessary);
          break;
        case types.DiagnosticTag.Deprecated:
          markerTags.push(MarkerTag.Deprecated);
          break;
      }
    }
    return markerTags;
  }
}

export function toSelection(selection: model.Selection): types.Selection {
  const { selectionStartLineNumber, selectionStartColumn, positionLineNumber, positionColumn } = selection;
  const start = new types.Position(selectionStartLineNumber - 1, selectionStartColumn - 1);
  const end = new types.Position(positionLineNumber - 1, positionColumn - 1);
  return new types.Selection(start, end);
}

export function fromSelection(selection: vscode.Selection): model.Selection {
  const { active, anchor } = selection;
  return {
    selectionStartLineNumber: anchor.line + 1,
    selectionStartColumn: anchor.character + 1,
    positionLineNumber: active.line + 1,
    positionColumn: active.character + 1,
  };
}

export namespace DocumentLink {
  export function from(link: vscode.DocumentLink): model.ILink {
    return {
      range: Range.from(link.range),
      url: link.target,
      tooltip: link.tooltip,
    };
  }

  export function to(link: model.ILink): vscode.DocumentLink {
    let target: Uri | undefined;
    if (link.url) {
      try {
        target = typeof link.url === 'string' ? Uri.parse(link.url) : Uri.revive(link.url);
      } catch (err) {
        // ignore
      }
    }
    return new types.DocumentLink(Range.to(link.range), target);
  }
}

/**
 * @deprecated
 */
export function fromDocumentLink(link: vscode.DocumentLink): model.ILink {
  return {
    range: fromRange(link.range),
    url: link.target,
    tooltip: link.tooltip,
  };
}

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

export namespace DecorationRenderOptions {
  export function from(options: any): IDecorationRenderOptions {
    return {
      isWholeLine: options.isWholeLine,
      rangeBehavior: options.rangeBehavior ? DecorationRangeBehavior.from(options.rangeBehavior) : undefined,
      overviewRulerLane: options.overviewRulerLane,
      light: options.light ? ThemableDecorationRenderOptions.from(options.light) : undefined,
      dark: options.dark ? ThemableDecorationRenderOptions.from(options.dark) : undefined,

      backgroundColor: options.backgroundColor as string | IThemeColor,
      outline: options.outline,
      outlineColor: options.outlineColor as string | IThemeColor,
      outlineStyle: options.outlineStyle,
      outlineWidth: options.outlineWidth,
      border: options.border,
      borderColor: options.borderColor as string | IThemeColor,
      borderRadius: options.borderRadius,
      borderSpacing: options.borderSpacing,
      borderStyle: options.borderStyle,
      borderWidth: options.borderWidth,
      fontStyle: options.fontStyle,
      fontWeight: options.fontWeight,
      textDecoration: options.textDecoration,
      textUnderlinePosition: options.textUnderlinePosition,
      cursor: options.cursor,
      color: options.color as string | IThemeColor,
      opacity: options.opacity,
      letterSpacing: options.letterSpacing,
      gutterIconPath: options.gutterIconPath ? pathOrURIToURI(options.gutterIconPath) : undefined,
      gutterIconSize: options.gutterIconSize,
      overviewRulerColor: options.overviewRulerColor as string | IThemeColor,
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
      backgroundColor: options.backgroundColor as string | IThemeColor,
      outline: options.outline,
      outlineColor: options.outlineColor as string | IThemeColor,
      outlineStyle: options.outlineStyle,
      outlineWidth: options.outlineWidth,
      border: options.border,
      borderColor: options.borderColor as string | IThemeColor,
      borderRadius: options.borderRadius,
      borderSpacing: options.borderSpacing,
      borderStyle: options.borderStyle,
      borderWidth: options.borderWidth,
      fontStyle: options.fontStyle,
      fontWeight: options.fontWeight,
      textDecoration: options.textDecoration,
      textUnderlinePosition: options.textUnderlinePosition,
      cursor: options.cursor,
      color: options.color as string | IThemeColor,
      opacity: options.opacity,
      letterSpacing: options.letterSpacing,
      gutterIconPath: options.gutterIconPath ? pathOrURIToURI(options.gutterIconPath) : undefined,
      gutterIconSize: options.gutterIconSize,
      overviewRulerColor: options.overviewRulerColor as string | IThemeColor,
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
      borderColor: options.borderColor as string | IThemeColor,
      fontStyle: options.fontStyle,
      fontWeight: options.fontWeight,
      textDecoration: options.textDecoration,
      color: options.color as string | IThemeColor,
      backgroundColor: options.backgroundColor as string | IThemeColor,
      margin: options.margin,
      width: options.width,
      height: options.height,
    };
  }
}

export namespace WorkspaceEdit {
  export function from(value: vscode.WorkspaceEdit, documents?: ExtensionDocumentDataManager): model.WorkspaceEditDto {
    const result: model.WorkspaceEditDto = {
      edits: [],
    };
    for (const entry of (value as types.WorkspaceEdit).allEntries()) {
      if (entry._type === types.WorkspaceEditType.File) {
        // file operation
        result.edits.push({
          _type: types.WorkspaceEditType.File,
          oldResource: entry.from,
          newResource: entry.to,
          options: entry.options,
          metadata: entry.metadata,
        } as model.ResourceFileEditDto);
      } else if (entry._type === types.WorkspaceEditType.Text) {
        // text edits
        const doc = documents?.getDocument(entry.uri);
        result.edits.push({
          _type: types.WorkspaceEditType.Text,
          resource: entry.uri,
          textEdit: TextEdit.from(entry.edit),
          versionId: doc?.version,
          metadata: entry.metadata,
        } as model.ResourceTextEditDto);
      }
    }
    return result;
  }

  export function to(value: model.WorkspaceEditDto) {
    const result = new types.WorkspaceEdit();
    for (const edit of value.edits) {
      if ((edit as model.ResourceTextEditDto).textEdit) {
        result.replace(
          URI.revive((edit as model.ResourceTextEditDto).resource),
          Range.to((edit as model.ResourceTextEditDto).textEdit.range),
          (edit as model.ResourceTextEditDto).textEdit.text,
        );
      } else {
        result.renameFile(
          URI.revive((edit as model.ResourceFileEditDto).oldResource!),
          URI.revive((edit as model.ResourceFileEditDto).newResource!),
          (edit as model.ResourceFileEditDto).options,
        );
      }
    }
    return result;
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

export namespace GlobPattern {
  export function from(pattern: vscode.GlobPattern): string | types.RelativePattern;
  export function from(pattern: undefined): undefined;
  export function from(pattern: null): null;
  export function from(
    pattern: vscode.GlobPattern | undefined | null,
  ): string | types.RelativePattern | undefined | null;
  export function from(
    pattern: vscode.GlobPattern | undefined | null,
  ): string | types.RelativePattern | undefined | null {
    if (pattern instanceof types.RelativePattern) {
      return pattern;
    }

    if (typeof pattern === 'string') {
      return pattern;
    }

    if (isRelativePattern(pattern)) {
      return new types.RelativePattern(pattern.base, pattern.pattern);
    }

    return pattern; // preserve `undefined` and `null`
  }

  function isRelativePattern(obj: any): obj is vscode.RelativePattern {
    const rp = obj as vscode.RelativePattern;
    return rp && typeof rp.base === 'string' && typeof rp.pattern === 'string';
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

export namespace SymbolKind {
  const fromMapping: { [kind: number]: types.SymbolKind } = Object.create(null);
  fromMapping[types.SymbolKind.File] = types.SymbolKind.File;
  fromMapping[types.SymbolKind.Module] = types.SymbolKind.Module;
  fromMapping[types.SymbolKind.Namespace] = types.SymbolKind.Namespace;
  fromMapping[types.SymbolKind.Package] = types.SymbolKind.Package;
  fromMapping[types.SymbolKind.Class] = types.SymbolKind.Class;
  fromMapping[types.SymbolKind.Method] = types.SymbolKind.Method;
  fromMapping[types.SymbolKind.Property] = types.SymbolKind.Property;
  fromMapping[types.SymbolKind.Field] = types.SymbolKind.Field;
  fromMapping[types.SymbolKind.Constructor] = types.SymbolKind.Constructor;
  fromMapping[types.SymbolKind.Enum] = types.SymbolKind.Enum;
  fromMapping[types.SymbolKind.Interface] = types.SymbolKind.Interface;
  fromMapping[types.SymbolKind.Function] = types.SymbolKind.Function;
  fromMapping[types.SymbolKind.Variable] = types.SymbolKind.Variable;
  fromMapping[types.SymbolKind.Constant] = types.SymbolKind.Constant;
  fromMapping[types.SymbolKind.String] = types.SymbolKind.String;
  fromMapping[types.SymbolKind.Number] = types.SymbolKind.Number;
  fromMapping[types.SymbolKind.Boolean] = types.SymbolKind.Boolean;
  fromMapping[types.SymbolKind.Array] = types.SymbolKind.Array;
  fromMapping[types.SymbolKind.Object] = types.SymbolKind.Object;
  fromMapping[types.SymbolKind.Key] = types.SymbolKind.Key;
  fromMapping[types.SymbolKind.Null] = types.SymbolKind.Null;
  fromMapping[types.SymbolKind.EnumMember] = types.SymbolKind.EnumMember;
  fromMapping[types.SymbolKind.Struct] = types.SymbolKind.Struct;
  fromMapping[types.SymbolKind.Event] = types.SymbolKind.Event;
  fromMapping[types.SymbolKind.Operator] = types.SymbolKind.Operator;
  fromMapping[types.SymbolKind.TypeParameter] = types.SymbolKind.TypeParameter;

  export function from(kind: vscode.SymbolKind): types.SymbolKind {
    return fromMapping[kind] || types.SymbolKind.Property;
  }

  export function to(kind: types.SymbolKind): vscode.SymbolKind {
    for (const k in fromMapping) {
      if (fromMapping[k] === kind) {
        return Number(k);
      }
    }
    return types.SymbolKind.Property;
  }

  /**
   * @deprecated
   */
  export function fromSymbolKind(kind: vscode.SymbolKind): types.SymbolKind {
    return fromMapping[kind] || types.SymbolKind.Property;
  }

  /**
   * @deprecated
   */
  export function toSymbolKind(kind: types.SymbolKind): vscode.SymbolKind {
    for (const k in fromMapping) {
      if (fromMapping[k] === kind) {
        return Number(k);
      }
    }
    return types.SymbolKind.Property;
  }
}
export function fromDocumentSymbol(info: vscode.DocumentSymbol): model.DocumentSymbol {
  const result: model.DocumentSymbol = {
    name: info.name,
    detail: info.detail,
    range: fromRange(info.range)!,
    selectionRange: fromRange(info.selectionRange)!,
    kind: SymbolKind.fromSymbolKind(info.kind),
    tags: info.tags?.map(SymbolTag.from) ?? [],
  };
  if (info.children) {
    result.children = info.children.map(fromDocumentSymbol);
  }
  return result;
}

export function fromSymbolInformation(symbolInformation: vscode.SymbolInformation): SymbolInformation | undefined {
  if (!symbolInformation) {
    return undefined;
  }

  if (symbolInformation.location && symbolInformation.location.range) {
    const p1 = P.create(symbolInformation.location.range.start.line, symbolInformation.location.range.start.character);
    const p2 = P.create(symbolInformation.location.range.end.line, symbolInformation.location.range.end.character);
    return SymbolInformation.create(
      symbolInformation.name,
      symbolInformation.kind++ as S,
      R.create(p1, p2),
      symbolInformation.location.uri.toString(),
      symbolInformation.containerName,
    );
  }

  return {
    name: symbolInformation.name,
    containerName: symbolInformation.containerName,
    kind: symbolInformation.kind++ as S,
    location: {
      uri: symbolInformation.location.uri.toString(),
    },
  } as SymbolInformation;
}

export function toSymbolInformation(symbolInformation: SymbolInformation): vscode.SymbolInformation | undefined {
  if (!symbolInformation) {
    return undefined;
  }

  return {
    name: symbolInformation.name,
    containerName: symbolInformation.containerName,
    kind: symbolInformation.kind,
    location: {
      uri: URI.revive(symbolInformation.location.uri),
      range: symbolInformation.location.range,
    },
  } as vscode.SymbolInformation;
}

export namespace SymbolTag {
  export function from(kind: types.SymbolTag): model.SymbolTag {
    switch (kind) {
      case types.SymbolTag.Deprecated:
        return model.SymbolTag.Deprecated;
    }
  }

  export function to(kind: model.SymbolTag): types.SymbolTag {
    switch (kind) {
      case model.SymbolTag.Deprecated:
        return types.SymbolTag.Deprecated;
    }
  }
}

export namespace CompletionItemKind {
  const _from = new Map<types.CompletionItemKind, model.CompletionItemKind>([
    [types.CompletionItemKind.Method, model.CompletionItemKind.Method],
    [types.CompletionItemKind.Function, model.CompletionItemKind.Function],
    [types.CompletionItemKind.Constructor, model.CompletionItemKind.Constructor],
    [types.CompletionItemKind.Field, model.CompletionItemKind.Field],
    [types.CompletionItemKind.Variable, model.CompletionItemKind.Variable],
    [types.CompletionItemKind.Class, model.CompletionItemKind.Class],
    [types.CompletionItemKind.Interface, model.CompletionItemKind.Interface],
    [types.CompletionItemKind.Struct, model.CompletionItemKind.Struct],
    [types.CompletionItemKind.Module, model.CompletionItemKind.Module],
    [types.CompletionItemKind.Property, model.CompletionItemKind.Property],
    [types.CompletionItemKind.Unit, model.CompletionItemKind.Unit],
    [types.CompletionItemKind.Value, model.CompletionItemKind.Value],
    [types.CompletionItemKind.Constant, model.CompletionItemKind.Constant],
    [types.CompletionItemKind.Enum, model.CompletionItemKind.Enum],
    [types.CompletionItemKind.EnumMember, model.CompletionItemKind.EnumMember],
    [types.CompletionItemKind.Keyword, model.CompletionItemKind.Keyword],
    [types.CompletionItemKind.Snippet, model.CompletionItemKind.Snippet],
    [types.CompletionItemKind.Text, model.CompletionItemKind.Text],
    [types.CompletionItemKind.Color, model.CompletionItemKind.Color],
    [types.CompletionItemKind.File, model.CompletionItemKind.File],
    [types.CompletionItemKind.Reference, model.CompletionItemKind.Reference],
    [types.CompletionItemKind.Folder, model.CompletionItemKind.Folder],
    [types.CompletionItemKind.Event, model.CompletionItemKind.Event],
    [types.CompletionItemKind.Operator, model.CompletionItemKind.Operator],
    [types.CompletionItemKind.TypeParameter, model.CompletionItemKind.TypeParameter],
    [types.CompletionItemKind.Issue, model.CompletionItemKind.Issue],
    [types.CompletionItemKind.User, model.CompletionItemKind.User],
  ]);

  export function from(kind: types.CompletionItemKind): model.CompletionItemKind {
    return _from.get(kind) ?? model.CompletionItemKind.Property;
  }

  const _to = new Map<model.CompletionItemKind, types.CompletionItemKind>([
    [model.CompletionItemKind.Method, types.CompletionItemKind.Method],
    [model.CompletionItemKind.Function, types.CompletionItemKind.Function],
    [model.CompletionItemKind.Constructor, types.CompletionItemKind.Constructor],
    [model.CompletionItemKind.Field, types.CompletionItemKind.Field],
    [model.CompletionItemKind.Variable, types.CompletionItemKind.Variable],
    [model.CompletionItemKind.Class, types.CompletionItemKind.Class],
    [model.CompletionItemKind.Interface, types.CompletionItemKind.Interface],
    [model.CompletionItemKind.Struct, types.CompletionItemKind.Struct],
    [model.CompletionItemKind.Module, types.CompletionItemKind.Module],
    [model.CompletionItemKind.Property, types.CompletionItemKind.Property],
    [model.CompletionItemKind.Unit, types.CompletionItemKind.Unit],
    [model.CompletionItemKind.Value, types.CompletionItemKind.Value],
    [model.CompletionItemKind.Constant, types.CompletionItemKind.Constant],
    [model.CompletionItemKind.Enum, types.CompletionItemKind.Enum],
    [model.CompletionItemKind.EnumMember, types.CompletionItemKind.EnumMember],
    [model.CompletionItemKind.Keyword, types.CompletionItemKind.Keyword],
    [model.CompletionItemKind.Snippet, types.CompletionItemKind.Snippet],
    [model.CompletionItemKind.Text, types.CompletionItemKind.Text],
    [model.CompletionItemKind.Color, types.CompletionItemKind.Color],
    [model.CompletionItemKind.File, types.CompletionItemKind.File],
    [model.CompletionItemKind.Reference, types.CompletionItemKind.Reference],
    [model.CompletionItemKind.Folder, types.CompletionItemKind.Folder],
    [model.CompletionItemKind.Event, types.CompletionItemKind.Event],
    [model.CompletionItemKind.Operator, types.CompletionItemKind.Operator],
    [model.CompletionItemKind.TypeParameter, types.CompletionItemKind.TypeParameter],
    // [model.CompletionItemKind.User, types.CompletionItemKind.User],
    // [model.CompletionItemKind.Issue, types.CompletionItemKind.Issue],
  ]);

  export function to(kind: model.CompletionItemKind): types.CompletionItemKind {
    return _to.get(kind) ?? types.CompletionItemKind.Property;
  }
}

export namespace CompletionItem {
  export function to(suggestion: model.CompletionItem, converter?: CommandsConverter): types.CompletionItem {
    const result = new types.CompletionItem(suggestion.label);
    if (typeof suggestion.label !== 'string') {
      result.label2 = suggestion.label;
    }

    result.insertText = suggestion.insertText;
    result.kind = CompletionItemKind.to(suggestion.kind);
    result.tags = suggestion.tags?.map(CompletionItemTag.to);
    result.detail = suggestion.detail;
    result.documentation = isMarkdownString(suggestion.documentation)
      ? MarkdownString.to(suggestion.documentation)
      : suggestion.documentation;
    result.sortText = suggestion.sortText;
    result.filterText = suggestion.filterText;
    result.preselect = suggestion.preselect;
    result.commitCharacters = suggestion.commitCharacters;

    // range
    if (model.isIRange(suggestion.range)) {
      result.range = Range.to(suggestion.range);
    } else if (typeof suggestion.range === 'object') {
      result.range = {
        inserting: Range.to(suggestion.range.insert),
        replacing: Range.to(suggestion.range.replace),
      };
    }

    result.keepWhitespace =
      typeof suggestion.insertTextRules === 'undefined'
        ? false
        : Boolean(suggestion.insertTextRules & model.CompletionItemInsertTextRule.KeepWhitespace);
    // 'insertText'-logic
    if (
      typeof suggestion.insertTextRules !== 'undefined' &&
      suggestion.insertTextRules & model.CompletionItemInsertTextRule.InsertAsSnippet
    ) {
      result.insertText = new types.SnippetString(suggestion.insertText);
    } else {
      result.insertText = suggestion.insertText;
      result.textEdit =
        result.range instanceof types.Range ? new types.TextEdit(result.range, result.insertText) : undefined;
    }
    if (suggestion.additionalTextEdits && suggestion.additionalTextEdits.length > 0) {
      result.additionalTextEdits = suggestion.additionalTextEdits.map((e) => TextEdit.to(e as model.TextEdit));
    }
    result.command = converter && suggestion.command ? converter.fromInternal(suggestion.command) : undefined;

    return result;
  }
}

export namespace CompletionItemTag {
  export function from(kind: types.CompletionItemTag): model.CompletionItemTag {
    switch (kind) {
      case types.CompletionItemTag.Deprecated:
        return model.CompletionItemTag.Deprecated;
    }
  }

  export function to(kind: model.CompletionItemTag): types.CompletionItemTag {
    switch (kind) {
      case model.CompletionItemTag.Deprecated:
        return types.CompletionItemTag.Deprecated;
    }
  }
}

export function viewColumnToResourceOpenOptions(viewColumn?: ViewColumnEnums): {
  groupIndex?: number;
  relativeGroupIndex?: number;
} {
  const result: { groupIndex?: number; relativeGroupIndex?: number } = {};
  if (viewColumn) {
    if (viewColumn === ViewColumnEnums.Beside) {
      result.relativeGroupIndex = 1;
    } else if (viewColumn === ViewColumnEnums.Active) {
      result.relativeGroupIndex = 0;
    } else {
      result.groupIndex = viewColumn - 1;
    }
  }
  return result;
}

export namespace WorkspaceSymbol {
  export function from(info: vscode.SymbolInformation): model.IWorkspaceSymbol {
    return {
      name: info.name,
      kind: SymbolKind.from(info.kind),
      tags: info.tags && info.tags.map(SymbolTag.from),
      containerName: info.containerName,
      location: location.from(info.location),
    } as model.IWorkspaceSymbol;
  }
  export function to(info: model.IWorkspaceSymbol): types.SymbolInformation {
    const result = new types.SymbolInformation(
      info.name,
      SymbolKind.to(info.kind),
      info.containerName,
      location.to(info.location),
    );
    result.tags = info.tags && info.tags.map(SymbolTag.to);
    return result;
  }
}

export namespace Position {
  export function to(position: model.Position): types.Position {
    return new types.Position(position.lineNumber - 1, position.column - 1);
  }
  export function from(position: types.Position | vscode.Position): model.Position {
    return { lineNumber: position.line + 1, column: position.character + 1 };
  }
}

export namespace ProgressLocation {
  export function from(loc: vscode.ProgressLocation | { viewId: string }): MainProgressLocation | string {
    if (typeof loc === 'object') {
      return loc.viewId;
    }

    switch (loc) {
      case types.ProgressLocation.SourceControl:
        return MainProgressLocation.Scm;
      case types.ProgressLocation.Window:
        return MainProgressLocation.Window;
      case types.ProgressLocation.Notification:
        return MainProgressLocation.Notification;
    }
    throw new Error("Unknown 'ProgressLocation'");
  }
}

export function fromFileStat(stat: vscode.FileStat, uri: types.Uri) {
  const isSymbolicLink = stat.type.valueOf() === FileType.SymbolicLink.valueOf();
  const isDirectory = stat.type.valueOf() === FileType.Directory.valueOf();

  const result: FileStat = {
    uri: uri.toString(),
    lastModification: stat.mtime,
    createTime: stat.ctime,
    isSymbolicLink,
    isDirectory,
    size: stat.size,
  };

  return result;
}

export function toFileStat(stat: FileStat): vscode.FileStat {
  return {
    ctime: stat?.createTime || 0,
    mtime: stat?.lastModification,
    size: stat?.size || 0,
    type: stat?.type || FileType.Unknown,
  };
}

export function isLikelyVscodeRange(thing: any): thing is types.Range {
  if (!thing) {
    return false;
  }
  return (thing as types.Range).start !== undefined && (thing as types.Range).end !== undefined;
}

export namespace CallHierarchyItem {
  export function to(item: model.ICallHierarchyItemDto): types.CallHierarchyItem {
    const result = new types.CallHierarchyItem(
      SymbolKind.toSymbolKind(item.kind),
      item.name,
      item.detail || '',
      URI.revive(item.uri),
      toRange(item.range),
      toRange(item.selectionRange),
    );

    result._sessionId = item._sessionId;
    result._itemId = item._itemId;

    return result;
  }
}

export namespace TypeHierarchyItem {
  export function to(item: model.ITypeHierarchyItemDto): types.TypeHierarchyItem {
    const result = new types.TypeHierarchyItem(
      SymbolKind.to(item.kind),
      item.name,
      item.detail || '',
      URI.revive(item.uri),
      Range.to(item.range),
      Range.to(item.selectionRange),
    );

    result._sessionId = item._sessionId;
    result._itemId = item._itemId;

    return result;
  }

  export function from(
    item: vscode.TypeHierarchyItem,
    sessionId?: string,
    itemId?: string,
  ): model.ITypeHierarchyItemDto {
    sessionId = sessionId ?? (item as types.TypeHierarchyItem)._sessionId;
    itemId = itemId ?? (item as types.TypeHierarchyItem)._itemId;

    if (sessionId === undefined || itemId === undefined) {
      throw new Error('invalid item');
    }

    return {
      _sessionId: sessionId,
      _itemId: itemId,
      kind: SymbolKind.from(item.kind),
      name: item.name,
      detail: item.detail ?? '',
      uri: item.uri,
      range: Range.from(item.range),
      selectionRange: Range.from(item.selectionRange),
      tags: item.tags?.map(SymbolTag.from),
    };
  }
}

export namespace CallHierarchyIncomingCall {
  export function to(item: model.IIncomingCallDto): types.CallHierarchyIncomingCall {
    return new types.CallHierarchyIncomingCall(
      CallHierarchyItem.to(item.from),
      item.fromRanges.map((r) => toRange(r)),
    );
  }
}

export namespace CallHierarchyOutgoingCall {
  export function to(item: model.IOutgoingCallDto): types.CallHierarchyOutgoingCall {
    return new types.CallHierarchyOutgoingCall(
      CallHierarchyItem.to(item.to),
      item.fromRanges.map((r) => toRange(r)),
    );
  }
}

export namespace ParameterInformation {
  export function from(info: types.ParameterInformation): model.ParameterInformation {
    return {
      label: info.label,
      documentation: info.documentation ? MarkdownString.fromStrict(info.documentation) : undefined,
    };
  }
  export function to(info: model.ParameterInformation): types.ParameterInformation {
    return {
      label: info.label,
      documentation: isMarkdownString(info.documentation) ? MarkdownString.to(info.documentation) : info.documentation,
    };
  }
}

export namespace SignatureInformation {
  export function from(info: types.SignatureInformation): model.SignatureInformation {
    return {
      label: info.label,
      documentation: info.documentation ? MarkdownString.fromStrict(info.documentation) : undefined,
      parameters: Array.isArray(info.parameters) ? info.parameters.map(ParameterInformation.from) : [],
      activeParameter: info.activeParameter,
    };
  }

  export function to(info: model.SignatureInformation): types.SignatureInformation {
    return {
      label: info.label,
      documentation: isMarkdownString(info.documentation) ? MarkdownString.to(info.documentation) : info.documentation,
      parameters: Array.isArray(info.parameters) ? info.parameters.map(ParameterInformation.to) : [],
      activeParameter: info.activeParameter,
    };
  }
}

export namespace SignatureHelp {
  export function from(help: types.SignatureHelp): model.SignatureHelp {
    return {
      activeSignature: help.activeSignature,
      activeParameter: help.activeParameter,
      signatures: Array.isArray(help.signatures) ? help.signatures.map(SignatureInformation.from) : [],
    };
  }

  export function to(help: model.SignatureHelp): types.SignatureHelp {
    return {
      activeSignature: help.activeSignature,
      activeParameter: help.activeParameter,
      signatures: Array.isArray(help.signatures) ? help.signatures.map(SignatureInformation.to) : [],
    };
  }
}

export const ACTIVE_GROUP = -1;
export type ACTIVE_GROUP_TYPE = typeof ACTIVE_GROUP;

export const SIDE_GROUP = -2;
export type SIDE_GROUP_TYPE = typeof SIDE_GROUP;

export namespace ViewColumn {
  export function from(column?: vscode.ViewColumn): EditorGroupColumn {
    if (typeof column === 'number' && column >= types.ViewColumn.One) {
      return column - 1; // adjust zero index (ViewColumn.ONE => 0)
    }

    if (column === types.ViewColumn.Beside) {
      return SIDE_GROUP;
    }

    return ACTIVE_GROUP; // default is always the active group
  }

  export function to(position: EditorGroupColumn): vscode.ViewColumn {
    if (typeof position === 'number' && position >= 0) {
      return position + 1; // adjust to index (ViewColumn.ONE => 1)
    }

    throw new Error("invalid 'EditorGroupColumn'");
  }
}

export namespace DefinitionLink {
  export function from(value: vscode.Location | vscode.DefinitionLink): model.LocationLink {
    const definitionLink = value as vscode.DefinitionLink;
    const location = value as vscode.Location;
    return {
      originSelectionRange: definitionLink.originSelectionRange
        ? Range.from(definitionLink.originSelectionRange)
        : undefined,
      uri: definitionLink.targetUri ? definitionLink.targetUri : location.uri,
      range: Range.from(definitionLink.targetRange ? definitionLink.targetRange : location.range),
      targetSelectionRange: definitionLink.targetSelectionRange
        ? Range.from(definitionLink.targetSelectionRange)
        : undefined,
    };
  }

  export function to(value: model.LocationLink): vscode.LocationLink {
    return {
      targetUri: value.uri,
      targetRange: Range.to(value.range),
      targetSelectionRange: value.targetSelectionRange ? Range.to(value.targetSelectionRange) : undefined,
      originSelectionRange: value.originSelectionRange ? Range.to(value.originSelectionRange) : undefined,
    };
  }
}

export namespace EvaluatableExpression {
  export function from(expression: vscode.EvaluatableExpression): IEvaluatableExpression {
    return {
      range: fromRange(expression.range),
      expression: expression.expression,
    } as IEvaluatableExpression;
  }

  export function to(info: IEvaluatableExpression): types.EvaluatableExpression {
    return new types.EvaluatableExpression(toRange(info.range), info.expression);
  }
}
export namespace InlineValue {
  export function from(inlineValue: vscode.InlineValue): debugModel.InlineValue {
    if (inlineValue instanceof types.InlineValueText) {
      return {
        type: 'text',
        range: Range.from(inlineValue.range),
        text: inlineValue.text,
      } as debugModel.InlineValueText;
    } else if (inlineValue instanceof types.InlineValueVariableLookup) {
      return {
        type: 'variable',
        range: Range.from(inlineValue.range),
        variableName: inlineValue.variableName,
        caseSensitiveLookup: inlineValue.caseSensitiveLookup,
      } as debugModel.InlineValueVariableLookup;
    } else if (inlineValue instanceof types.InlineValueEvaluatableExpression) {
      return {
        type: 'expression',
        range: Range.from(inlineValue.range),
        expression: inlineValue.expression,
      } as debugModel.InlineValueExpression;
    } else {
      throw new Error("Unknown 'InlineValue' type");
    }
  }

  export function to(inlineValue: debugModel.InlineValue): vscode.InlineValue {
    switch (inlineValue.type) {
      case 'text':
        return {
          range: Range.to(inlineValue.range),
          text: inlineValue.text,
        } as vscode.InlineValueText;
      case 'variable':
        return {
          range: Range.to(inlineValue.range),
          variableName: inlineValue.variableName,
          caseSensitiveLookup: inlineValue.caseSensitiveLookup,
        } as vscode.InlineValueVariableLookup;
      case 'expression':
        return {
          range: Range.to(inlineValue.range),
          expression: inlineValue.expression,
        } as vscode.InlineValueEvaluatableExpression;
    }
  }
}

export namespace InlineValueContext {
  export function from(inlineValueContext: vscode.InlineValueContext): IInlineValueContextDto {
    return {
      frameId: inlineValueContext.frameId,
      stoppedLocation: Range.from(inlineValueContext.stoppedLocation),
    } as IInlineValueContextDto;
  }

  export function to(inlineValueContext: IInlineValueContextDto): types.InlineValueContext {
    return new types.InlineValueContext(inlineValueContext.frameId, Range.to(inlineValueContext.stoppedLocation));
  }
}

export namespace InlayHint {
  export function from(hint: vscode.InlayHint): languages.InlayHint {
    return {
      label: hint.label as any,
      position: Position.from(hint.position),
      kind: hint.kind && InlayHintKind.from(hint.kind),
      paddingLeft: hint.paddingLeft,
      paddingRight: hint.paddingRight,
    };
  }

  export function to(converter: CommandsConverter, hint: languages.InlayHint): vscode.InlayHint {
    const res = new types.InlayHint(
      Position.to(hint.position),
      typeof hint.label === 'string' ? hint.label : hint.label.map(InlayHintLabelPart.to.bind(undefined, converter)),
      hint.kind && InlayHintKind.to(hint.kind),
    );
    res.paddingLeft = hint.paddingLeft;
    res.paddingRight = hint.paddingRight;
    return res;
  }
}

export namespace InlayHintLabelPart {
  export function to(converter: CommandsConverter, part: languages.InlayHintLabelPart): types.InlayHintLabelPart {
    const result = new types.InlayHintLabelPart(part.label);
    result.tooltip = isMarkdownString(part.tooltip) ? MarkdownString.to(part.tooltip) : (part.tooltip as string);
    if (languages.Command.is(part.command)) {
      result.command = converter.fromInternal(part.command);
    }
    if (part.location) {
      result.location = location.to(part.location as model.Location);
    }
    return result;
  }
}

export namespace InlayHintKind {
  export function from(kind: vscode.InlayHintKind): languages.InlayHintKind {
    return kind;
  }
  export function to(kind: languages.InlayHintKind): vscode.InlayHintKind {
    return kind;
  }
}

export namespace CodeActionTriggerKind {
  export function to(value: CodeActionTriggerType): types.CodeActionTriggerKind {
    switch (value) {
      case CodeActionTriggerType.Invoke:
        return types.CodeActionTriggerKind.Invoke;

      case CodeActionTriggerType.Auto:
        return types.CodeActionTriggerKind.Automatic;
    }
  }
}

// #region Test Adapter

export namespace TestMessage {
  export function from(message: vscode.TestMessage): SerializedTestErrorMessage {
    return {
      message: MarkdownString.fromStrict(message.message) || '',
      type: TestMessageType.Error,
      expected: message.expectedOutput,
      actual: message.actualOutput,
      location: message.location ? (location.from(message.location) as any) : undefined,
    };
  }

  export function to(item: SerializedTestErrorMessage): vscode.TestMessage {
    const message = new types.TestMessage(
      typeof item.message === 'string' ? item.message : MarkdownString.to(item.message),
    );
    message.actualOutput = item.actual;
    message.expectedOutput = item.expected;
    message.location = item.location ? location.to(item.location) : undefined;
    return message;
  }
}

export namespace TestTag {
  const enum Constants {
    Delimiter = '\0',
  }

  export const namespace = (ctrlId: string, tagId: string) => ctrlId + Constants.Delimiter + tagId;

  export const denamespace = (namespaced: string) => {
    const index = namespaced.indexOf(Constants.Delimiter);
    return { ctrlId: namespaced.slice(0, index), tagId: namespaced.slice(index + 1) };
  };
}

export namespace TestItem {
  export type Raw = vscode.TestItem;

  export function from(item: vscode.TestItem): ITestItem {
    const ctrlId = getPrivateApiFor(item).controllerId;
    return {
      extId: TestId.fromExtHostTestItem(item, ctrlId).toString(),
      label: item.label,
      uri: item.uri,
      tags: item.tags.map((t) => TestTag.namespace(ctrlId, t.id)),
      range: Range.from(item.range) || null,
      description: item.description || null,
      sortText: item.sortText || null,
      error: item.error ? MarkdownString.fromStrict(item.error) || null : null,
    };
  }

  export function toPlain(item: ITestItem): Omit<vscode.TestItem, 'children' | 'invalidate' | 'discoverChildren'> {
    return {
      parent: undefined,
      error: undefined,
      id: TestId.fromString(item.extId).localId,
      label: item.label,
      uri: URI.revive(item.uri),
      tags: (item.tags || []).map((t) => {
        const { tagId } = TestTag.denamespace(t);
        return new types.TestTag(tagId);
      }),
      range: Range.to(item.range || undefined),
      invalidateResults: () => undefined,
      canResolveChildren: false,
      busy: false,
      description: item.description || undefined,
      sortText: item.sortText || undefined,
    };
  }

  function to(item: ITestItem): TestItemImpl {
    const testId = TestId.fromString(item.extId);
    const testItem = new TestItemImpl(testId.controllerId, testId.localId, item.label, URI.revive(item.uri));
    testItem.range = Range.to(item.range || undefined);
    testItem.description = item.description || undefined;
    return testItem;
  }

  export function toItemFromContext(context: ITestItemContext): TestItemImpl {
    let node: TestItemImpl | undefined;
    for (const test of context.tests) {
      const next = to(test.item);
      getPrivateApiFor(next).parent = node;
      node = next;
    }

    return node!;
  }
}

export namespace TestTag {
  export function from(tag: vscode.TestTag): ITestTag {
    return { id: tag.id };
  }

  export function to(tag: ITestTag): vscode.TestTag {
    return new types.TestTag(tag.id);
  }
}

export namespace TestResults {
  const convertTestResultItem = (
    item: SerializedTestResultItem,
    byInternalId: Map<string, SerializedTestResultItem>,
  ): vscode.TestResultSnapshot => {
    const snapshot: vscode.TestResultSnapshot = {
      ...TestItem.toPlain(item.item),
      parent: undefined,
      taskStates: item.tasks.map((t) => ({
        state: t.state as number as types.TestResultState,
        duration: t.duration,
        messages: t.messages
          .filter((m): m is ITestErrorMessage => m.type === TestMessageType.Error)
          .map(TestMessage.to),
      })),
      children: item.children
        .map((c) => byInternalId.get(c))
        .filter(isDefined)
        .map((c) => convertTestResultItem(c, byInternalId)),
    };

    for (const child of snapshot.children) {
      (child as any).parent = snapshot;
    }

    return snapshot;
  };

  export function to(serialized: ISerializedTestResults): vscode.TestRunResult {
    const roots: SerializedTestResultItem[] = [];
    const byInternalId = new Map<string, SerializedTestResultItem>();
    for (const item of serialized.items) {
      byInternalId.set(item.item.extId, item);
      if (
        serialized.request.targets.some(
          (t) => t.controllerId === item.controllerId && t.testIds.includes(item.item.extId),
        )
      ) {
        roots.push(item);
      }
    }

    return {
      completedAt: serialized.completedAt,
      results: roots.map((r) => convertTestResultItem(r, byInternalId)),
    };
  }
}

export namespace TestCoverage {
  function fromCoveredCount(count: vscode.CoveredCount): ICoveredCount {
    return { covered: count.covered, total: count.covered };
  }

  function fromLocation(location: vscode.Range | vscode.Position) {
    return 'line' in location ? Position.from(location) : Range.from(location);
  }

  export function fromDetailed(coverage: vscode.DetailedCoverage): CoverageDetails {
    if ('branches' in coverage) {
      return {
        count: coverage.executionCount,
        location: fromLocation(coverage.location),
        type: DetailType.Statement,
        branches: coverage.branches.length
          ? coverage.branches.map((b) => ({
              count: b.executionCount,
              location: b.location && fromLocation(b.location),
            }))
          : undefined,
      };
    } else {
      return {
        type: DetailType.Function,
        count: coverage.executionCount,
        location: fromLocation(coverage.location),
      };
    }
  }

  export function fromFile(coverage: vscode.FileCoverage): IFileCoverage {
    return {
      uri: coverage.uri,
      statement: fromCoveredCount(coverage.statementCoverage),
      branch: coverage.branchCoverage && fromCoveredCount(coverage.branchCoverage),
      function: coverage.functionCoverage && fromCoveredCount(coverage.functionCoverage),
      details: coverage.detailedCoverage?.map(fromDetailed),
    };
  }
}
// #endregion

export interface IURITransformer {
  transformIncoming(uri: UriComponents): UriComponents;
  transformOutgoing(uri: UriComponents): UriComponents;
  transformOutgoingURI(uri: URI): URI;
  transformOutgoingScheme(scheme: string): string;
}

export interface IDocumentFilterDto {
  $serialized: true;
  language?: string;
  scheme?: string;
  pattern?: string | IRelativePattern;
  exclusive?: boolean;
}

export namespace DocumentSelector {
  export function from(value: vscode.DocumentSelector, uriTransformer?: IURITransformer): IDocumentFilterDto[] {
    return coalesce(asArray(value).map((sel) => _doTransformDocumentSelector(sel, uriTransformer)));
  }

  function _doTransformDocumentSelector(
    selector: string | vscode.DocumentFilter,
    uriTransformer: IURITransformer | undefined,
  ): IDocumentFilterDto | undefined {
    if (typeof selector === 'string') {
      return {
        $serialized: true,
        language: selector,
      };
    }

    if (selector) {
      return {
        $serialized: true,
        language: selector.language,
        scheme: _transformScheme(selector.scheme, uriTransformer),
        pattern: typeof selector.pattern === 'undefined' ? undefined : GlobPattern.from(selector.pattern),
        exclusive: selector.exclusive,
      };
    }

    return undefined;
  }

  function _transformScheme(
    scheme: string | undefined,
    uriTransformer: IURITransformer | undefined,
  ): string | undefined {
    if (uriTransformer && typeof scheme === 'string') {
      return uriTransformer.transformOutgoingScheme(scheme);
    }
    return scheme;
  }
}

export interface IDataTransferFileDTO {
  readonly name: string;
  readonly uri?: UriComponents;
}

export interface DataTransferItemDTO {
  readonly id: string;
  readonly asString: string;
  readonly fileData: IDataTransferFileDTO | undefined;
}

export namespace DataTransferItem {
  export function toDataTransferItem(
    item: DataTransferItemDTO,
    resolveFileData: () => Promise<Uint8Array>,
  ): types.DataTransferItem {
    const file = item.fileData;
    if (file) {
      return new (class extends types.DataTransferItem {
        override asFile(): vscode.DataTransferFile {
          return {
            name: file.name,
            uri: URI.revive(file.uri),
            data: once(() => resolveFileData()),
          };
        }
      })('', item.id);
    } else {
      return new types.DataTransferItem(item.asString);
    }
  }
}

export namespace DataTransfer {
  export function toDataTransfer(
    value: DataTransferDTO,
    resolveFileData: (itemId: string) => Promise<Uint8Array>,
  ): types.DataTransfer {
    const init = value.items.map(
      ([type, item]) => [type, DataTransferItem.toDataTransferItem(item, () => resolveFileData(item.id))] as const,
    );
    return new types.DataTransfer(init);
  }

  export async function toDataTransferDTO(value: vscode.DataTransfer | VSDataTransfer): Promise<DataTransferDTO> {
    const newDTO: DataTransferDTO = { items: [] };

    const promises: Promise<any>[] = [];

    value.forEach((value, key) => {
      promises.push(
        (async () => {
          const stringValue = await value.asString();
          const fileValue = value.asFile();
          newDTO.items.push([
            key,
            {
              id: (value as IDataTransferItem | types.DataTransferItem).id,
              asString: stringValue,
              fileData: fileValue ? { name: fileValue.name, uri: fileValue.uri } : undefined,
            },
          ]);
        })(),
      );
    });

    await Promise.all(promises);

    return newDTO;
  }
}

export namespace ChatReplyFollowup {
  export function from(
    followup: vscode.InteractiveSessionReplyFollowup | vscode.InteractiveEditorReplyFollowup,
  ): IChatReplyFollowup {
    return {
      kind: 'reply',
      message: followup.message,
      title: followup.title,
      tooltip: followup.tooltip,
    };
  }
}

export namespace ChatFollowup {
  export function from(followup: string | vscode.ChatAgentFollowup): IChatFollowup {
    if (typeof followup === 'string') {
      return { title: followup, message: followup, kind: 'reply' } as IChatReplyFollowup;
    } else if ('commandId' in followup) {
      return {
        kind: 'command',
        title: followup.title ?? '',
        commandId: followup.commandId ?? '',
        when: followup.when ?? '',
        args: followup.args,
      } as IChatResponseCommandFollowup;
    } else {
      return ChatReplyFollowup.from(followup);
    }
  }
}

export namespace ChatMessage {
  export function to(message: IChatMessage): vscode.ChatMessage {
    const res = new types.ChatMessage(ChatMessageRole.to(message.role), message.content);
    res.name = message.name;
    return res;
  }

  export function from(message: vscode.ChatMessage): IChatMessage {
    return {
      role: ChatMessageRole.from(message.role),
      content: message.content,
      name: message.name,
    };
  }
}

export namespace ChatMessageRole {
  export function to(role: ChatMessageRoleEnum): vscode.ChatMessageRole {
    switch (role) {
      case ChatMessageRoleEnum.System:
        return types.ChatMessageRole.System;
      case ChatMessageRoleEnum.User:
        return types.ChatMessageRole.User;
      case ChatMessageRoleEnum.Assistant:
        return types.ChatMessageRole.Assistant;
      case ChatMessageRoleEnum.Function:
        return types.ChatMessageRole.Function;
    }
  }

  export function from(role: vscode.ChatMessageRole): ChatMessageRoleEnum {
    switch (role) {
      case types.ChatMessageRole.System:
        return ChatMessageRoleEnum.System;
      case types.ChatMessageRole.Assistant:
        return ChatMessageRoleEnum.Assistant;
      case types.ChatMessageRole.Function:
        return ChatMessageRoleEnum.Function;
      case types.ChatMessageRole.User:
      default:
        return ChatMessageRoleEnum.User;
    }
  }
}

export namespace NotebookRange {
  export function from(range: vscode.NotebookRange): ICellRange {
    return { start: range.start, end: range.end };
  }

  export function to(range: ICellRange): types.NotebookRange {
    return new types.NotebookRange(range.start, range.end);
  }
}

export namespace NotebookCellExecutionSummary {
  export function to(data: NotebookCellInternalMetadata): vscode.NotebookCellExecutionSummary {
    return {
      timing:
        isNumber(data.runStartTime) && isNumber(data.runEndTime)
          ? { startTime: data.runStartTime, endTime: data.runEndTime }
          : undefined,
      executionOrder: data.executionOrder,
      success: data.lastRunSuccess,
    };
  }

  export function from(data: vscode.NotebookCellExecutionSummary): Partial<NotebookCellInternalMetadata> {
    return {
      lastRunSuccess: data.success,
      runStartTime: data.timing?.startTime,
      runEndTime: data.timing?.endTime,
      executionOrder: data.executionOrder,
    };
  }
}

export namespace NotebookCellKind {
  export function from(data: vscode.NotebookCellKind): CellKind {
    switch (data) {
      case types.NotebookCellKind.Markup:
        return CellKind.Markup;
      case types.NotebookCellKind.Code:
      default:
        return CellKind.Code;
    }
  }

  export function to(data: CellKind): vscode.NotebookCellKind {
    switch (data) {
      case CellKind.Markup:
        return types.NotebookCellKind.Markup;
      case CellKind.Code:
      default:
        return types.NotebookCellKind.Code;
    }
  }
}
