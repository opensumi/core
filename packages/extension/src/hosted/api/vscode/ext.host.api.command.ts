/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';

import { Uri as URI } from '@opensumi/ide-core-common';
import { isFalsyOrEmpty } from '@opensumi/ide-core-common/lib/arrays';
import type { ITextEditorOptions } from '@opensumi/monaco-editor-core/esm/vs/platform/editor/common/editor';

import * as typeConverters from '../../../common/vscode/converter';
import * as types from '../../../common/vscode/ext-types';
import * as modes from '../../../common/vscode/model.api';


import { CommandsConverter } from './ext.host.command';

type IPosition = modes.Position;
type IRange = modes.Range;
type ISelection = modes.Selection;

export class ApiCommandArgument<V, O = V> {
  static readonly Uri = new ApiCommandArgument<URI>(
    'uri',
    'Uri of a text document',
    (v) => URI.isUri(v),
    (v) => v,
  );
  static readonly Position = new ApiCommandArgument<types.Position, IPosition>(
    'position',
    'A position in a text document',
    (v) => types.Position.isPosition(v),
    typeConverters.fromPosition,
  );
  static readonly Range = new ApiCommandArgument<types.Range, IRange>(
    'range',
    'A range in a text document',
    (v) => types.Range.isRange(v),
    typeConverters.fromRange,
  );
  static readonly Selection = new ApiCommandArgument<types.Selection, ISelection>(
    'selection',
    'A selection in a text document',
    (v) => types.Selection.isSelection(v),
    typeConverters.fromSelection,
  );
  static readonly Number = new ApiCommandArgument<number>(
    'number',
    '',
    (v) => typeof v === 'number',
    (v) => v,
  );
  static readonly String = new ApiCommandArgument<string>(
    'string',
    '',
    (v) => typeof v === 'string',
    (v) => v,
  );

  static readonly CallHierarchyItem = new ApiCommandArgument(
    'item',
    'A call hierarchy item',
    (v) => v instanceof types.CallHierarchyItem,
    typeConverters.CallHierarchyItem.to,
  );

  constructor(
    readonly name: string,
    readonly description: string,
    readonly validate: (v: V) => boolean,
    readonly convert: (v: V) => O,
  ) {}

  optional(): ApiCommandArgument<V | undefined | null, O | undefined | null> {
    return new ApiCommandArgument(
      this.name,
      `(optional) ${this.description}`,
      (value) => value === undefined || value === null || this.validate(value),
      (value) => (value === undefined ? undefined : value === null ? null : this.convert(value)),
    );
  }

  with(name: string | undefined, description: string | undefined): ApiCommandArgument<V, O> {
    return new ApiCommandArgument(name ?? this.name, description ?? this.description, this.validate, this.convert);
  }
}

export class ApiCommandResult<V, O = V> {
  static readonly Void = new ApiCommandResult<void, void>('no result', (v) => v);

  constructor(
    readonly description: string,
    readonly convert: (v: V, apiArgs: any[], cmdConverter: CommandsConverter) => O,
  ) {}
}

export class ApiCommand {
  constructor(
    readonly id: string,
    readonly internalId: string,
    readonly description: string,
    readonly args: ApiCommandArgument<any, any>[],
    readonly result: ApiCommandResult<any, any>,
  ) {}
}

// some code copied and modified from https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/common/extHostApiCommands.ts#L25-L475
export const newCommands: ApiCommand[] = [
  // -- document highlights
  new ApiCommand(
    'vscode.executeDocumentHighlights',
    '_executeDocumentHighlights',
    'Execute document highlight provider.',
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult<modes.DocumentHighlight[], types.DocumentHighlight[] | undefined>(
      'A promise that resolves to an array of SymbolInformation and DocumentSymbol instances.',
      tryMapWith(typeConverters.DocumentHighlight.to),
    ),
  ),
  // -- document symbols
  new ApiCommand(
    'vscode.executeDocumentSymbolProvider',
    '_executeDocumentSymbolProvider',
    'Execute document symbol provider.',
    [ApiCommandArgument.Uri],
    new ApiCommandResult<modes.DocumentSymbol[], vscode.SymbolInformation[] | undefined>(
      'A promise that resolves to an array of DocumentHighlight-instances.',
      (value, apiArgs) => {
        if (isFalsyOrEmpty(value)) {
          return undefined;
        }
        class MergedInfo extends types.SymbolInformation implements vscode.DocumentSymbol {
          static to(symbol: modes.DocumentSymbol): MergedInfo {
            const res = new MergedInfo(
              symbol.name,
              typeConverters.SymbolKind.toSymbolKind(symbol.kind),
              symbol.containerName || '',
              new types.Location(apiArgs[0], typeConverters.toRange(symbol.range)),
            );
            res.detail = symbol.detail;
            res.range = res.location.range;
            res.selectionRange = typeConverters.toRange(symbol.selectionRange);
            res.children = symbol.children ? symbol.children.map(MergedInfo.to) : [];
            return res;
          }

          detail!: string;
          range!: vscode.Range;
          selectionRange!: vscode.Range;
          children!: vscode.DocumentSymbol[];
          containerName!: string;
        }
        return value.map(MergedInfo.to);
      },
    ),
  ),
  // -- formatting
  new ApiCommand(
    'vscode.executeFormatDocumentProvider',
    '_executeFormatDocumentProvider',
    'Execute document format provider.',
    [
      ApiCommandArgument.Uri,
      new ApiCommandArgument(
        'options',
        'Formatting options',
        (_) => true,
        (v) => v,
      ),
    ],
    new ApiCommandResult<modes.TextEdit[], types.TextEdit[] | undefined>(
      'A promise that resolves to an array of TextEdits.',
      tryMapWith(typeConverters.TextEdit.to),
    ),
  ),
  new ApiCommand(
    'vscode.executeFormatRangeProvider',
    '_executeFormatRangeProvider',
    'Execute range format provider.',
    [
      ApiCommandArgument.Uri,
      ApiCommandArgument.Range,
      new ApiCommandArgument(
        'options',
        'Formatting options',
        (_) => true,
        (v) => v,
      ),
    ],
    new ApiCommandResult<modes.TextEdit[], types.TextEdit[] | undefined>(
      'A promise that resolves to an array of TextEdits.',
      tryMapWith(typeConverters.TextEdit.to),
    ),
  ),
  new ApiCommand(
    'vscode.executeFormatOnTypeProvider',
    '_executeFormatOnTypeProvider',
    'Execute format on type provider.',
    [
      ApiCommandArgument.Uri,
      ApiCommandArgument.Position,
      new ApiCommandArgument(
        'ch',
        'Trigger character',
        (v) => typeof v === 'string',
        (v) => v,
      ),
      new ApiCommandArgument(
        'options',
        'Formatting options',
        (_) => true,
        (v) => v,
      ),
    ],
    new ApiCommandResult<modes.TextEdit[], types.TextEdit[] | undefined>(
      'A promise that resolves to an array of TextEdits.',
      tryMapWith(typeConverters.TextEdit.to),
    ),
  ),
  // -- go to symbol (definition, type definition, declaration, impl, references)
  new ApiCommand(
    'vscode.executeDefinitionProvider',
    '_executeDefinitionProvider',
    'Execute all definition providers.',
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult<(modes.Location | modes.LocationLink)[], (types.Location | vscode.LocationLink)[] | undefined>(
      'A promise that resolves to an array of Location or LocationLink instances.',
      mapLocationOrLocationLink,
    ),
  ),
  new ApiCommand(
    'vscode.executeTypeDefinitionProvider',
    '_executeTypeDefinitionProvider',
    'Execute all type definition providers.',
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult<(modes.Location | modes.LocationLink)[], (types.Location | vscode.LocationLink)[] | undefined>(
      'A promise that resolves to an array of Location or LocationLink instances.',
      mapLocationOrLocationLink,
    ),
  ),
  new ApiCommand(
    'vscode.executeDeclarationProvider',
    '_executeDeclarationProvider',
    'Execute all declaration providers.',
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult<(modes.Location | modes.LocationLink)[], (types.Location | vscode.LocationLink)[] | undefined>(
      'A promise that resolves to an array of Location or LocationLink instances.',
      mapLocationOrLocationLink,
    ),
  ),
  new ApiCommand(
    'vscode.executeImplementationProvider',
    '_executeImplementationProvider',
    'Execute all implementation providers.',
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult<(modes.Location | modes.LocationLink)[], (types.Location | vscode.LocationLink)[] | undefined>(
      'A promise that resolves to an array of Location or LocationLink instances.',
      mapLocationOrLocationLink,
    ),
  ),
  new ApiCommand(
    'vscode.executeReferenceProvider',
    '_executeReferenceProvider',
    'Execute all reference providers.',
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult<modes.Location[], types.Location[] | undefined>(
      'A promise that resolves to an array of Location-instances.',
      tryMapWith(typeConverters.location.to),
    ),
  ),
  // -- hover
  new ApiCommand(
    'vscode.executeHoverProvider',
    '_executeHoverProvider',
    'Execute all hover providers.',
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult<modes.Hover[], types.Hover[] | undefined>(
      'A promise that resolves to an array of Hover-instances.',
      tryMapWith(typeConverters.Hover.to),
    ),
  ),
  // -- selection range
  new ApiCommand(
    'vscode.executeSelectionRangeProvider',
    '_executeSelectionRangeProvider',
    'Execute selection range provider.',
    [
      ApiCommandArgument.Uri,
      new ApiCommandArgument<types.Position[], IPosition[]>(
        'position',
        'A positions in a text document',
        (v) => Array.isArray(v) && v.every((v) => types.Position.isPosition(v)),
        (v) => v.map(typeConverters.Position.from),
      ),
    ],
    new ApiCommandResult<IRange[][], types.SelectionRange[]>(
      'A promise that resolves to an array of ranges.',
      (result) =>
        result.map((ranges) => {
          let node: types.SelectionRange | undefined;
          for (const range of ranges.reverse()) {
            node = new types.SelectionRange(typeConverters.Range.to(range), node);
          }
          return node!;
        }),
    ),
  ),
  // -- symbol search
  new ApiCommand(
    'vscode.executeWorkspaceSymbolProvider',
    '_executeWorkspaceSymbolProvider',
    'Execute all workspace symbol providers.',
    [ApiCommandArgument.String.with('query', 'Search string')],
    new ApiCommandResult<[modes.WorkspaceSymbolProvider, modes.IWorkspaceSymbol[]][], types.SymbolInformation[]>(
      'A promise that resolves to an array of SymbolInformation-instances.',
      (value) => {
        const result: types.SymbolInformation[] = [];
        if (Array.isArray(value)) {
          for (const tuple of value) {
            result.push(...tuple[1].map(typeConverters.WorkspaceSymbol.to));
          }
        }
        return result;
      },
    ),
  ),
  // --- call hierarchy
  new ApiCommand(
    'vscode.prepareCallHierarchy',
    '_executePrepareCallHierarchy',
    'Prepare call hierarchy at a position inside a document',
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult<modes.ICallHierarchyItemDto[], types.CallHierarchyItem[]>(
      'A CallHierarchyItem or undefined',
      (v) => v.map(typeConverters.CallHierarchyItem.to),
    ),
  ),
  new ApiCommand(
    'vscode.provideIncomingCalls',
    '_executeProvideIncomingCalls',
    'Compute incoming calls for an item',
    [ApiCommandArgument.CallHierarchyItem],
    new ApiCommandResult<modes.IIncomingCallDto[], types.CallHierarchyIncomingCall[]>(
      'A CallHierarchyItem or undefined',
      (v) => v.map(typeConverters.CallHierarchyIncomingCall.to),
    ),
  ),
  new ApiCommand(
    'vscode.provideOutgoingCalls',
    '_executeProvideOutgoingCalls',
    'Compute outgoing calls for an item',
    [ApiCommandArgument.CallHierarchyItem],
    new ApiCommandResult<modes.IOutgoingCallDto[], types.CallHierarchyOutgoingCall[]>(
      'A CallHierarchyItem or undefined',
      (v) => v.map(typeConverters.CallHierarchyOutgoingCall.to),
    ),
  ),
  // --- rename
  new ApiCommand(
    'vscode.executeDocumentRenameProvider',
    '_executeDocumentRenameProvider',
    'Execute rename provider.',
    [
      ApiCommandArgument.Uri,
      ApiCommandArgument.Position,
      ApiCommandArgument.String.with('newName', 'The new symbol name'),
    ],
    new ApiCommandResult<modes.IWorkspaceEditDto, types.WorkspaceEdit | undefined>(
      'A promise that resolves to a WorkspaceEdit.',
      (value) => {
        if (!value) {
          return undefined;
        }
        if (value.rejectReason) {
          throw new Error(value.rejectReason);
        }
        return typeConverters.WorkspaceEdit.to(value);
      },
    ),
  ),
  // --- links
  new ApiCommand(
    'vscode.executeLinkProvider',
    '_executeLinkProvider',
    'Execute document link provider.',
    [
      ApiCommandArgument.Uri,
      ApiCommandArgument.Number.with(
        'linkResolveCount',
        'Number of links that should be resolved, only when links are unresolved.',
      ).optional(),
    ],
    new ApiCommandResult<modes.ILink[], vscode.DocumentLink[]>(
      'A promise that resolves to an array of DocumentLink-instances.',
      (value) => value.map(typeConverters.DocumentLink.to),
    ),
  ),
  // --- completions
  new ApiCommand(
    'vscode.executeCompletionItemProvider',
    '_executeCompletionItemProvider',
    'Execute completion item provider.',
    [
      ApiCommandArgument.Uri,
      ApiCommandArgument.Position,
      ApiCommandArgument.String.with(
        'triggerCharacter',
        'Trigger completion when the user types the character, like `,` or `(`',
      ).optional(),
      ApiCommandArgument.Number.with(
        'itemResolveCount',
        'Number of completions to resolve (too large numbers slow down completions)',
      ).optional(),
    ],
    new ApiCommandResult<modes.CompletionList, vscode.CompletionList>(
      'A promise that resolves to a CompletionList-instance.',
      (value, _args, converter) => {
        if (!value) {
          return new types.CompletionList([]);
        }
        const items = value.suggestions.map((suggestion) => typeConverters.CompletionItem.to(suggestion, converter));
        return new types.CompletionList(items, value.incomplete);
      },
    ),
  ),
  // --- signature help
  new ApiCommand(
    'vscode.executeSignatureHelpProvider',
    '_executeSignatureHelpProvider',
    'Execute signature help provider.',
    [
      ApiCommandArgument.Uri,
      ApiCommandArgument.Position,
      ApiCommandArgument.String.with(
        'triggerCharacter',
        'Trigger signature help when the user types the character, like `,` or `(`',
      ).optional(),
    ],
    new ApiCommandResult<modes.SignatureHelp, vscode.SignatureHelp | undefined>(
      'A promise that resolves to SignatureHelp.',
      (value) => {
        if (value) {
          return typeConverters.SignatureHelp.to(value);
        }
        return undefined;
      },
    ),
  ),
  // --- code lens
  new ApiCommand(
    'vscode.executeCodeLensProvider',
    '_executeCodeLensProvider',
    'Execute code lens provider.',
    [
      ApiCommandArgument.Uri,
      ApiCommandArgument.Number.with(
        'itemResolveCount',
        'Number of lenses that should be resolved and returned. Will only return resolved lenses, will impact performance)',
      ).optional(),
    ],
    new ApiCommandResult<modes.CodeLens[], vscode.CodeLens[] | undefined>(
      'A promise that resolves to an array of CodeLens-instances.',
      (value, _args, converter) =>
        tryMapWith<modes.CodeLens, vscode.CodeLens>(
          (item) =>
            new types.CodeLens(
              typeConverters.Range.to(item.range),
              item.command && converter.fromInternal(item.command),
            ),
        )(value),
    ),
  ),
  // --- code actions
  new ApiCommand(
    'vscode.executeCodeActionProvider',
    '_executeCodeActionProvider',
    'Execute code action provider.',
    [
      ApiCommandArgument.Uri,
      new ApiCommandArgument(
        'rangeOrSelection',
        'Range in a text document. Some refactoring provider requires Selection object.',
        (v) => types.Range.isRange(v),
        (v) => (types.Selection.isSelection(v) ? typeConverters.Selection.from(v) : typeConverters.Range.from(v)),
      ),
      ApiCommandArgument.String.with('kind', 'Code action kind to return code actions for').optional(),
      ApiCommandArgument.Number.with(
        'itemResolveCount',
        'Number of code actions to resolve (too large numbers slow down code actions)',
      ).optional(),
    ],
    new ApiCommandResult<modes.CustomCodeAction[], (vscode.CodeAction | vscode.Command | undefined)[] | undefined>(
      'A promise that resolves to an array of Command-instances.',
      (value, _args, converter) =>
        tryMapWith<modes.CustomCodeAction, vscode.CodeAction | vscode.Command | undefined>((codeAction) => {
          if (codeAction._isSynthetic) {
            if (!codeAction.command) {
              throw new Error('Synthetic code actions must have a command');
            }
            return converter.fromInternal(codeAction.command);
          } else {
            const ret = new types.CodeAction(
              codeAction.title,
              codeAction.kind ? new types.CodeActionKind(codeAction.kind) : undefined,
            );
            if (codeAction.edit) {
              ret.edit = typeConverters.WorkspaceEdit.to(codeAction.edit);
            }
            if (codeAction.command) {
              ret.command = converter.fromInternal(codeAction.command);
            }
            ret.isPreferred = codeAction.isPreferred;
            return ret;
          }
        })(value),
    ),
  ),
  // --- colors
  new ApiCommand(
    'vscode.executeDocumentColorProvider',
    '_executeDocumentColorProvider',
    'Execute document color provider.',
    [ApiCommandArgument.Uri],
    new ApiCommandResult<modes.IRawColorInfo[], vscode.ColorInformation[]>(
      'A promise that resolves to an array of ColorInformation objects.',
      (result) => {
        if (result) {
          return result.map(
            (ci) => new types.ColorInformation(typeConverters.Range.to(ci.range), typeConverters.Color.to(ci.color)),
          );
        }
        return [];
      },
    ),
  ),
  new ApiCommand(
    'vscode.executeColorPresentationProvider',
    '_executeColorPresentationProvider',
    'Execute color presentation provider.',
    [
      new ApiCommandArgument<types.Color, [number, number, number, number]>(
        'color',
        'The color to show and insert',
        (v) => v instanceof types.Color,
        typeConverters.Color.from,
      ),
      new ApiCommandArgument<{ uri: URI; range: types.Range }, { uri: URI; range: IRange }>(
        'context',
        'Context object with uri and range',
        (_v) => true,
        (v) => ({ uri: v.uri, range: typeConverters.Range.from(v.range) }),
      ),
    ],
    new ApiCommandResult<modes.IColorPresentation[], types.ColorPresentation[]>(
      'A promise that resolves to an array of ColorPresentation objects.',
      (result) => {
        if (result) {
          return result.map(typeConverters.ColorPresentation.to);
        }
        return [];
      },
    ),
  ),
  // --- open'ish commands
  new ApiCommand(
    'vscode.open',
    '_workbench.open',
    'Opens the provided resource in the editor. Can be a text or binary file, or a http(s) url. If you need more control over the options for opening a text file, use vscode.window.showTextDocument instead.',
    [
      ApiCommandArgument.Uri,
      new ApiCommandArgument<
        vscode.ViewColumn | typeConverters.TextEditorOpenOptions | undefined,
        [number?, ITextEditorOptions?] | undefined
      >(
        'columnOrOptions',
        'Either the column in which to open or editor options, see vscode.TextDocumentShowOptions',
        (v) => v === undefined || typeof v === 'number' || typeof v === 'object',
        (v) =>
          !v
            ? v
            : typeof v === 'number'
            ? [v, undefined]
            : [typeConverters.ViewColumn.from(v.viewColumn), typeConverters.TextEditorOpenOptions.from(v)],
      ).optional(),
      ApiCommandArgument.String.with('label', '').optional(),
    ],
    ApiCommandResult.Void,
  ),
  new ApiCommand(
    'vscode.openWith',
    '_workbench.openWith',
    'Opens the provided resource with a specific editor.',
    [
      ApiCommandArgument.Uri.with('resource', 'Resource to open'),
      ApiCommandArgument.String.with('viewId', "Custom editor view id or 'default' to use VS Code's default editor"),
      new ApiCommandArgument<
        vscode.ViewColumn | typeConverters.TextEditorOpenOptions | undefined,
        [number?, ITextEditorOptions?] | undefined
      >(
        'columnOrOptions',
        'Either the column in which to open or editor options, see vscode.TextDocumentShowOptions',
        (v) => v === undefined || typeof v === 'number' || typeof v === 'object',
        (v) =>
          !v
            ? v
            : typeof v === 'number'
            ? [v, undefined]
            : [typeConverters.ViewColumn.from(v.viewColumn), typeConverters.TextEditorOpenOptions.from(v)],
      ).optional(),
    ],
    ApiCommandResult.Void,
  ),
  new ApiCommand(
    'vscode.diff',
    '_workbench.diff',
    'Opens the provided resources in the diff editor to compare their contents.',
    [
      ApiCommandArgument.Uri.with('left', 'Left-hand side resource of the diff editor'),
      ApiCommandArgument.Uri.with('right', 'Rigth-hand side resource of the diff editor'),
      ApiCommandArgument.String.with('title', 'Human readable title for the diff editor').optional(),
      new ApiCommandArgument<
        typeConverters.TextEditorOpenOptions | undefined,
        [number?, ITextEditorOptions?] | undefined
      >(
        'columnOrOptions',
        'Either the column in which to open or editor options, see vscode.TextDocumentShowOptions',
        (v) => v === undefined || typeof v === 'object',
        (v) => v && [typeConverters.ViewColumn.from(v.viewColumn), typeConverters.TextEditorOpenOptions.from(v)],
      ).optional(),
    ],
    ApiCommandResult.Void,
  ),
];

function tryMapWith<T, R>(f: (x: T) => R) {
  return (value: T[]) => {
    if (Array.isArray(value)) {
      return value.map(f);
    }
    return undefined;
  };
}

function mapLocationOrLocationLink(
  values: (modes.Location | modes.LocationLink)[],
): (types.Location | vscode.LocationLink)[] | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }
  const result: (types.Location | vscode.LocationLink)[] = [];
  for (const item of values) {
    if (modes.isLocationLink(item)) {
      result.push(typeConverters.DefinitionLink.to(item));
    } else {
      result.push(typeConverters.location.to(item));
    }
  }
  return result;
}
