import type vscode from 'vscode';
import { CancellationToken } from 'vscode';

import { Uri as URI, DisposableStore } from '@opensumi/ide-core-common';
import { Command } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';

import * as typeConvert from '../../../../common/vscode/converter';
import { ExtensionDocumentDataManager } from '../../../../common/vscode/doc';
import { InlineCompletionTriggerKind } from '../../../../common/vscode/ext-types';
import * as languages from '../../../../common/vscode/languages';
import { Position } from '../../../../common/vscode/model.api';
import { CommandsConverter } from '../ext.host.command';

class ReferenceMap<T> {
  private readonly _references = new Map<number, T>();
  private _idPool = 1;

  createReferenceId(value: T): number {
    const id = this._idPool++;
    this._references.set(id, value);
    return id;
  }

  disposeReferenceId(referenceId: number): T | undefined {
    const value = this._references.get(referenceId);
    this._references.delete(referenceId);
    return value;
  }

  get(referenceId: number): T | undefined {
    return this._references.get(referenceId);
  }
}

export class InlineCompletionAdapterBase {
  async provideInlineCompletions(
    resource: URI,
    position: Position,
    context: languages.InlineCompletionContext,
    token: CancellationToken,
  ): Promise<languages.IdentifiableInlineCompletions | undefined> {
    return undefined;
  }

  disposeCompletions(pid: number): void {}

  handleDidShowCompletionItem(pid: number, idx: number): void {}
}

export class InlineCompletionAdapter extends InlineCompletionAdapterBase {
  private readonly _references = new ReferenceMap<{
    dispose(): void;
    items: readonly vscode.InlineCompletionItem[];
  }>();

  constructor(
    private readonly _documents: ExtensionDocumentDataManager,
    private readonly _provider: vscode.InlineCompletionItemProvider,
    private readonly _commands: CommandsConverter,
  ) {
    super();
  }

  private readonly languageTriggerKindToVSCodeTriggerKind: Record<
    languages.InlineCompletionTriggerKind,
    InlineCompletionTriggerKind
  > = {
    [languages.InlineCompletionTriggerKind.Automatic]: InlineCompletionTriggerKind.Automatic,
    [languages.InlineCompletionTriggerKind.Explicit]: InlineCompletionTriggerKind.Invoke,
  };

  override async provideInlineCompletions(
    resource: URI,
    position: Position,
    context: languages.InlineCompletionContext,
    token: CancellationToken,
  ): Promise<languages.IdentifiableInlineCompletions | undefined> {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);

    const result = await this._provider.provideInlineCompletionItems(
      doc,
      pos,
      {
        selectedCompletionInfo: context.selectedSuggestionInfo
          ? {
              range: typeConvert.Range.to(context.selectedSuggestionInfo.range),
              text: context.selectedSuggestionInfo.text,
            }
          : undefined,
        triggerKind: this.languageTriggerKindToVSCodeTriggerKind[context.triggerKind],
      },
      token,
    );

    if (!result) {
      // undefined and null are valid results
      return undefined;
    }

    if (token.isCancellationRequested) {
      // cancelled -> return without further ado, esp no caching
      // of results as they will leak
      return undefined;
    }

    const normalizedResult = Array.isArray(result) ? result : result.items;
    // proposed api
    // @ts-ignore
    const commands = Array.isArray(result) ? [] : result.commands || [];

    let disposableStore: DisposableStore | undefined;
    const pid = this._references.createReferenceId({
      dispose() {
        disposableStore?.dispose();
      },
      items: normalizedResult,
    });

    return {
      pid,
      items: normalizedResult.map<languages.IdentifiableInlineCompletion>((item, idx) => {
        let command: Command | undefined;
        if (item.command) {
          if (!disposableStore) {
            disposableStore = new DisposableStore();
          }
          command = this._commands.toInternal(item.command, disposableStore);
        }

        const insertText = item.insertText;
        return {
          insertText: typeof insertText === 'string' ? insertText : { snippet: insertText.value },
          filterText: item.filterText,
          range: item.range ? typeConvert.Range.from(item.range) : undefined,
          command,
          idx,
          // proposed api
          // @ts-ignore
          completeBracketPairs: !!item.completeBracketPairs,
        };
      }),
      commands: commands.map((c) => {
        if (!disposableStore) {
          disposableStore = new DisposableStore();
        }
        return this._commands.toInternal(c, disposableStore);
      }),
    };
  }

  override disposeCompletions(pid: number) {
    const data = this._references.disposeReferenceId(pid);
    data?.dispose();
  }

  // proposed api
  // 暂不实现
  override handleDidShowCompletionItem(pid: number, idx: number): void {
    throw new Error('Method not implemented.');
  }
}
