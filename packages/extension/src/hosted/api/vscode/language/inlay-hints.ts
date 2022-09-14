import type vscode from 'vscode';

import { Uri, CancellationToken, IRange, Cache, DisposableStore } from '@opensumi/ide-core-common';
import * as languages from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';

import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as typeConvert from '../../../../common/vscode/converter';
import * as types from '../../../../common/vscode/ext-types';
import { IInlayHintsDto, IInlayHintDto } from '../../../../common/vscode/languages';
import { ChainedCacheId } from '../../../../common/vscode/model.api';
import { CommandsConverter } from '../ext.host.command';

export class InlayHintsAdapter {
  private _cache = new Cache<vscode.InlayHint>('InlayHints');
  private readonly _disposables = new Map<number, DisposableStore>();

  constructor(
    private readonly _documents: ExtensionDocumentDataManager,
    private readonly _provider: vscode.InlayHintsProvider,
    private readonly _commands: CommandsConverter,
  ) {}

  async provideInlayHints(resource: Uri, ran: IRange, token: CancellationToken): Promise<IInlayHintsDto | undefined> {
    const doc = this._documents.getDocument(resource);
    const range = typeConvert.Range.to(ran);

    const hints = await this._provider.provideInlayHints(doc, range, token);
    if (!Array.isArray(hints) || hints.length === 0) {
      // bad result
      // this._logService.trace(`[InlayHints] NO inlay hints from '${this._extension.identifier.value}' for ${ran}`);
      return undefined;
    }
    if (token.isCancellationRequested) {
      // cancelled -> return without further ado, esp no caching
      // of results as they will leak
      return undefined;
    }
    const pid = this._cache.add(hints);
    this._disposables.set(pid, new DisposableStore());
    const result: IInlayHintsDto = { hints: [], cacheId: pid };
    for (let i = 0; i < hints.length; i++) {
      if (this._isValidInlayHint(hints[i], range)) {
        result.hints.push(this._convertInlayHint(hints[i], [pid, i]));
      }
    }
    // this._logService.trace(`[InlayHints] ${result.hints.length} inlay hints from '${this._extension.identifier.value}' for ${ran}`);
    return result;
  }

  async resolveInlayHint(id: ChainedCacheId, token: CancellationToken) {
    if (typeof this._provider.resolveInlayHint !== 'function') {
      return undefined;
    }
    const item = this._cache.get(...id);
    if (!item) {
      return undefined;
    }
    const hint = await this._provider.resolveInlayHint!(item, token);
    if (!hint) {
      return undefined;
    }
    if (!this._isValidInlayHint(hint)) {
      return undefined;
    }
    return this._convertInlayHint(hint, id);
  }

  releaseHints(id: number): any {
    this._disposables.get(id)?.dispose();
    this._disposables.delete(id);
    this._cache.delete(id);
  }

  private _isValidInlayHint(hint: vscode.InlayHint, range?: vscode.Range): boolean {
    if (hint.label.length === 0 || (Array.isArray(hint.label) && hint.label.every((part) => part.value.length === 0))) {
      // console.log('INVALID inlay hint, empty label', hint);
      return false;
    }
    if (range && !range.contains(hint.position)) {
      // console.log('INVALID inlay hint, position outside range', range, hint);
      return false;
    }
    return true;
  }

  private _convertInlayHint(hint: vscode.InlayHint, id: ChainedCacheId): IInlayHintDto {
    const disposables = this._disposables.get(id[0]);
    if (!disposables) {
      throw Error('DisposableStore is missing...');
    }

    const result: IInlayHintDto = {
      label: '', // fill-in below
      tooltip: typeConvert.MarkdownString.fromStrict(hint.tooltip),
      position: typeConvert.Position.from(hint.position),
      textEdits: hint.textEdits && hint.textEdits.map(typeConvert.TextEdit.from),
      kind: hint.kind && typeConvert.InlayHintKind.from(hint.kind),
      paddingLeft: hint.paddingLeft,
      paddingRight: hint.paddingRight,
      cacheId: id,
    };

    if (typeof hint.label === 'string') {
      result.label = hint.label;
    } else {
      result.label = hint.label.map((part) => {
        const result: languages.InlayHintLabelPart = { label: part.value };
        result.tooltip = typeConvert.MarkdownString.fromStrict(part.tooltip);
        if (types.Location.isLocation(part.location)) {
          result.location = typeConvert.location.from(part.location);
        }
        if (part.command) {
          result.command = this._commands.toInternal(part.command, disposables);
        }
        return result;
      });
    }
    return result;
  }
}
