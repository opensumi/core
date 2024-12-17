import { Cache, CancellationToken, DisposableStore, Uri as URI } from '@opensumi/ide-core-common';
import { coalesce } from '@opensumi/ide-utils/lib/arrays';

import { ExtensionDocumentDataManager, ICodeActionDto, ICodeActionListDto } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import { CodeActionKind } from '../../../../common/vscode/ext-types';
import { ChainedCacheId, IWorkspaceEditDto, Range, Selection } from '../../../../common/vscode/model.api';
import { CodeActionTriggerType } from '../../../../common/vscode/models';
import { CommandsConverter } from '../ext.host.command';

import { Diagnostics } from './diagnostics';

import type { CodeActionContext, WorkspaceEdit } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';
import type vscode from 'vscode';

export class CodeActionAdapter {
  private static readonly _maxCodeActionsPerFile: number = 1000;

  private readonly _cache = new Cache<vscode.CodeAction | vscode.Command>('CodeAction');
  private readonly _disposables = new Map<number, DisposableStore>();

  constructor(
    private readonly provider: vscode.CodeActionProvider,
    private readonly document: ExtensionDocumentDataManager,
    private readonly diagnostics: Diagnostics,
  ) {}

  async provideCodeActions(
    resource: URI,
    rangeOrSelection: Range | Selection,
    context: CodeActionContext,
    commandConverter: CommandsConverter,
    token: CancellationToken,
  ): Promise<ICodeActionListDto | undefined> {
    const document = this.document.getDocumentData(resource);
    if (!document) {
      return Promise.reject(new Error(`There are no document for ${resource}`));
    }

    const doc = document.document;
    const ran = CodeActionAdapter._isSelection(rangeOrSelection)
      ? (Converter.Selection.to(rangeOrSelection) as vscode.Selection)
      : (Converter.Range.to(rangeOrSelection) as vscode.Range);

    const allDiagnostics: vscode.Diagnostic[] = [];

    for (const diagnostic of this.diagnostics.getDiagnostics(resource)) {
      if (ran.intersection(diagnostic.range)) {
        const newLen = allDiagnostics.push(diagnostic);
        if (newLen > CodeActionAdapter._maxCodeActionsPerFile) {
          break;
        }
      }
    }

    const codeActionContext: vscode.CodeActionContext = {
      diagnostics: allDiagnostics,
      only: context.only ? new CodeActionKind(context.only) : undefined,
      triggerKind: Converter.CodeActionTriggerKind.to(context.trigger as unknown as CodeActionTriggerType),
    };
    let cacheId: number | undefined;

    const actions = await Promise.resolve(this.provider.provideCodeActions(doc, ran, codeActionContext, token)).then(
      (commandsOrActions) => {
        if (!Array.isArray(commandsOrActions) || commandsOrActions.length === 0) {
          return undefined;
        }

        cacheId = this._cache.add(commandsOrActions);
        const disposables = new DisposableStore();
        this._disposables.set(cacheId, disposables);

        const actions: ICodeActionDto[] = [];
        for (let i = 0; i < commandsOrActions.length; i++) {
          const candidate = commandsOrActions[i];
          if (!candidate) {
            continue;
          }
          if (CodeActionAdapter._isCommand(candidate)) {
            actions.push({
              title: candidate.title || '',
              command: commandConverter.toInternal(candidate, disposables),
            });
          } else {
            if (codeActionContext.only) {
              if (!candidate.kind) {
                // TODO: 当 kind 是 Empty 时， kind === ''，此时似乎不应该提示这个 warning
                // eslint-disable-next-line no-console
                console.warn(
                  `Code actions of kind '${codeActionContext.only.value}' requested but returned code action does not have a 'kind'. Code action will be dropped. Please set 'CodeAction.kind'.`,
                );
              } else if (!codeActionContext.only.contains(candidate.kind)) {
                // eslint-disable-next-line no-console
                console.warn(
                  `Code actions of kind '${codeActionContext.only.value}' requested but returned code action is of kind '${candidate.kind.value}'. Code action will be dropped. Please check 'CodeActionContext.only' to only return requested code action.`,
                );
              }
            }

            actions.push({
              cacheId: [cacheId, i],
              title: candidate.title,
              command: candidate.command && commandConverter.toInternal(candidate.command, disposables),
              diagnostics: candidate.diagnostics && candidate.diagnostics.map(Converter.Diagnostic.toMarker),
              edit: candidate.edit && (Converter.WorkspaceEdit.from(candidate.edit) as WorkspaceEdit),
              kind: candidate.kind && candidate.kind.value,
              isPreferred: candidate.isPreferred,
              isAI: candidate.isAI,
              disabled: candidate.disabled?.reason,
              ranges: candidate.ranges ? coalesce(candidate.ranges.map(Converter.Range.from)) : [],
            });
          }
        }

        return actions;
      },
    );

    if (actions) {
      return {
        actions,
        cacheId: cacheId!,
      };
    }

    return undefined;
  }

  public async resolveCodeAction(
    id: ChainedCacheId,
    token: vscode.CancellationToken,
  ): Promise<IWorkspaceEditDto | undefined> {
    const [sessionId, itemId] = id;
    const item = this._cache.get(sessionId, itemId);
    if (!item || CodeActionAdapter._isCommand(item)) {
      return undefined; // code actions only!
    }
    if (!this.provider.resolveCodeAction) {
      return; // this should not happen...
    }
    const resolvedItem = (await this.provider.resolveCodeAction(item, token)) ?? item;
    return resolvedItem?.edit ? Converter.WorkspaceEdit.from(resolvedItem.edit) : undefined;
  }

  public releaseCodeActions(cachedId: number): void {
    this._disposables.get(cachedId)?.dispose();
    this._disposables.delete(cachedId);
    this._cache.delete(cachedId);
  }

  private static _isCommand(smth: any): smth is vscode.Command {
    return typeof (smth as vscode.Command).command === 'string';
  }

  private static _isSelection(obj: any): obj is Selection {
    return (
      obj &&
      typeof obj.selectionStartLineNumber === 'number' &&
      typeof obj.selectionStartColumn === 'number' &&
      typeof obj.positionLineNumber === 'number' &&
      typeof obj.positionColumn === 'number'
    );
  }
}
