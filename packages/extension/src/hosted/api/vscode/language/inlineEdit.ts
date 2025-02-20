import vscode, { CancellationToken } from 'vscode';

import { DisposableStore, Uri as URI } from '@opensumi/ide-core-common';

import { ExtensionDocumentDataManager, IExtensionDescription, IdentifiableInlineEdit } from '../../../../common/vscode';
import * as typeConvert from '../../../../common/vscode/converter';
import { InlineEditTriggerKind } from '../../../../common/vscode/ext-types';
import * as languages from '../../../../common/vscode/languages';
import { CommandsConverter } from '../ext.host.command';

export class InlineEditAdapter {
  private readonly _references = new ReferenceMap<{
    dispose(): void;
    item: vscode.InlineEdit;
  }>();

  private languageTriggerKindToVSCodeTriggerKind: Record<InlineEditTriggerKind, InlineEditTriggerKind> = {
    [InlineEditTriggerKind.Automatic]: InlineEditTriggerKind.Automatic,
    [InlineEditTriggerKind.Invoke]: InlineEditTriggerKind.Invoke,
  };

  async provideInlineEdits(
    uri: URI,
    context: vscode.InlineEditContext,
    token: CancellationToken,
  ): Promise<IdentifiableInlineEdit | undefined> {
    const doc = this._documents.getDocument(uri);
    const result = await this._provider.provideInlineEdit(
      doc,
      {
        triggerKind: this.languageTriggerKindToVSCodeTriggerKind[context.triggerKind],
        requestUuid: context.requestUuid,
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
    let disposableStore: DisposableStore | undefined;
    const pid = this._references.createReferenceId({
      dispose() {
        disposableStore?.dispose();
      },
      item: result,
    });

    let acceptCommand: languages.Command | undefined;
    if (result.accepted) {
      if (!disposableStore) {
        disposableStore = new DisposableStore();
      }
      acceptCommand = this._commands.toInternal(result.accepted, disposableStore);
    }
    let rejectCommand: languages.Command | undefined;
    if (result.rejected) {
      if (!disposableStore) {
        disposableStore = new DisposableStore();
      }
      rejectCommand = this._commands.toInternal(result.rejected, disposableStore);
    }

    let shownCommand: languages.Command | undefined;
    if (result.shown) {
      if (!disposableStore) {
        disposableStore = new DisposableStore();
      }
      shownCommand = this._commands.toInternal(result.shown, disposableStore);
    }

    if (!disposableStore) {
      disposableStore = new DisposableStore();
    }
    const langResult: IdentifiableInlineEdit = {
      pid,
      text: result.text,
      range: typeConvert.Range.from(result.range),
      showRange: typeConvert.Range.from(result.showRange),
      accepted: acceptCommand,
      rejected: rejectCommand,
      shown: shownCommand,
      commands: result.commands?.map((c) => this._commands.toInternal(c, disposableStore)) as languages.Command[],
    };

    return langResult;
  }

  disposeEdit(pid: number) {
    const data = this._references.disposeReferenceId(pid);
    data?.dispose();
  }

  constructor(
    _extension: IExtensionDescription,
    private readonly _documents: ExtensionDocumentDataManager,
    private readonly _provider: vscode.InlineEditProvider,
    private readonly _commands: CommandsConverter,
  ) {}
}

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
