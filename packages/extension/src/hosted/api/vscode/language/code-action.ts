/** ******************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import type { CodeActionContext, WorkspaceEdit } from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';
import type vscode from 'vscode';
import { Uri as URI, Cache } from '@opensumi/ide-core-common';
import { CodeActionKind } from '../../../../common/vscode/ext-types';
import { Selection, Range, ChainedCacheId, IWorkspaceEditDto } from '../../../../common/vscode/model.api';
import * as Converter from '../../../../common/vscode/converter';
import { createToken } from './util';
import { ExtensionDocumentDataManager, ICodeActionDto, ICodeActionListDto } from '../../../../common/vscode';
import { Diagnostics } from './diagnostics';
import { CommandsConverter } from '../ext.host.command';
import { DisposableStore } from '@opensumi/ide-core-common';

export class CodeActionAdapter {
  private readonly _cache = new Cache<vscode.CodeAction | vscode.Command>('CodeAction');
  private readonly _disposables = new Map<number, DisposableStore>();

  constructor(
    private readonly provider: vscode.CodeActionProvider,
    private readonly document: ExtensionDocumentDataManager,
    private readonly diagnostics: Diagnostics,
  ) {}

  async provideCodeAction(
    resource: URI,
    rangeOrSelection: Range | Selection,
    context: CodeActionContext,
    commandConverter: CommandsConverter,
  ): Promise<ICodeActionListDto | undefined> {
    const document = this.document.getDocumentData(resource);
    if (!document) {
      return Promise.reject(new Error(`There are no document for ${resource}`));
    }

    const doc = document.document;
    const ran = CodeActionAdapter._isSelection(rangeOrSelection)
      ? (Converter.toSelection(rangeOrSelection) as vscode.Selection)
      : (Converter.toRange(rangeOrSelection) as vscode.Range);
    const allDiagnostics: vscode.Diagnostic[] = [];

    for (const diagnostic of this.diagnostics.getDiagnostics(resource)) {
      if (ran.intersection(diagnostic.range)) {
        allDiagnostics.push(diagnostic);
      }
    }

    const codeActionContext: vscode.CodeActionContext = {
      diagnostics: allDiagnostics,
      only: context.only ? new CodeActionKind(context.only) : undefined,
      triggerKind: Converter.CodeActionTriggerKind.to(context.trigger),
    };
    let cacheId: number | undefined;
    const actions = await Promise.resolve(
      this.provider.provideCodeActions(doc, ran, codeActionContext, createToken()),
    ).then((commandsOrActions) => {
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
              console.warn(
                `Code actions of kind '${codeActionContext.only.value}' requested but returned code action does not have a 'kind'. Code action will be dropped. Please set 'CodeAction.kind'.`,
              );
            } else if (!codeActionContext.only.contains(candidate.kind)) {
              console.warn(
                `Code actions of kind '${codeActionContext.only.value}' requested but returned code action is of kind '${candidate.kind.value}'. Code action will be dropped. Please check 'CodeActionContext.only' to only return requested code action.`,
              );
            }
          }

          actions.push({
            cacheId: [cacheId, i],
            title: candidate.title,
            command: candidate.command && commandConverter.toInternal(candidate.command, disposables),
            diagnostics: candidate.diagnostics && candidate.diagnostics.map(Converter.convertDiagnosticToMarkerData),
            edit: candidate.edit && (Converter.WorkspaceEdit.from(candidate.edit) as WorkspaceEdit),
            kind: candidate.kind && candidate.kind.value,
            isPreferred: candidate.isPreferred,
            disabled: candidate.disabled?.reason,
          });
        }
      }

      return actions;
    });

    if (actions) {
      return {
        actions,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
