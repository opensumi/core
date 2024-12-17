// eslint-disable-next-line import/no-unresolved
import { CancellationToken } from 'vscode';

import { DisposableStore, Uri as URI } from '@opensumi/ide-core-common';

// import { languages } from '@opensumi/ide-monaco/lib/common';

import * as typeConvert from '../../../../common/vscode/converter';
import { ExtensionDocumentDataManager } from '../../../../common/vscode/doc';
import { InlineCompletionTriggerKind } from '../../../../common/vscode/ext-types';
import { IExtensionDescription } from '../../../../common/vscode/extension';
import * as languages from '../../../../common/vscode/languages';
import { IdentifiableInlineCompletion, IdentifiableInlineCompletions } from '../../../../common/vscode/languages';
import { CommandsConverter } from '../ext.host.command';

import type { IPosition } from '@opensumi/ide-monaco/lib/common';
import type vscode from 'vscode';

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
    position: IPosition,
    context: languages.InlineCompletionContext,
    token: CancellationToken,
  ): Promise<IdentifiableInlineCompletions | undefined> {
    return undefined;
  }

  disposeCompletions(pid: number): void {}

  handleDidShowCompletionItem(pid: number, idx: number, updatedInsertText: string): void {}

  handlePartialAccept(pid: number, idx: number, acceptedCharacters: number): void {}
}

export class InlineCompletionAdapter extends InlineCompletionAdapterBase {
  private readonly _references = new ReferenceMap<{
    dispose(): void;
    items: readonly vscode.InlineCompletionItem[];
  }>();

  constructor(
    private readonly _extension: IExtensionDescription,
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
    position: IPosition,
    context: languages.InlineCompletionContext,
    token: CancellationToken,
  ): Promise<IdentifiableInlineCompletions | undefined> {
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
    const commands = Array.isArray(result) ? [] : result.commands || [];
    const enableForwardStability = !Array.isArray(result) ? result.enableForwardStability : undefined;

    let disposableStore: DisposableStore | undefined;
    const pid = this._references.createReferenceId({
      dispose() {
        disposableStore?.dispose();
      },
      items: normalizedResult,
    });

    return {
      pid,
      items: normalizedResult.map<IdentifiableInlineCompletion>((item, idx) => {
        let command: languages.Command | undefined;
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
          completeBracketPairs: item.completeBracketPairs,
        };
      }),
      commands: commands.map((c) => {
        if (!disposableStore) {
          disposableStore = new DisposableStore();
        }
        return this._commands.toInternal(c, disposableStore);
      }) as languages.Command[],
      suppressSuggestions: false,
      enableForwardStability,
    };
  }

  override disposeCompletions(pid: number) {
    const data = this._references.disposeReferenceId(pid);
    data?.dispose();
  }

  override handleDidShowCompletionItem(pid: number, idx: number, updatedInsertText: string): void {
    const completionItem = this._references.get(pid)?.items[idx];
    if (completionItem) {
      if (this._provider.handleDidShowCompletionItem) {
        this._provider.handleDidShowCompletionItem(completionItem, updatedInsertText);
      }
    }
  }

  override handlePartialAccept(pid: number, idx: number, acceptedCharacters: number): void {
    const completionItem = this._references.get(pid)?.items[idx];
    if (completionItem) {
      if (this._provider.handleDidPartiallyAcceptCompletionItem) {
        this._provider.handleDidPartiallyAcceptCompletionItem(completionItem, acceptedCharacters);
      }
    }
  }
}
