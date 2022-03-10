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

// Some code copied and modified from https://github.com/eclipse-theia/theia/tree/v1.14.0/packages/plugin-ext/src/plugin/languages/lens.ts

import type vscode from 'vscode';

import { Uri as URI, Cache, CancellationToken } from '@opensumi/ide-core-common';
import { DisposableStore } from '@opensumi/ide-core-common';

import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import { CodeLens, ICodeLensListDto } from '../../../../common/vscode/model.api';
import { CommandsConverter } from '../ext.host.command';

/** Adapts the calls from main to extension thread for providing/resolving the code lenses. */
export class CodeLensAdapter {
  private static readonly BAD_CMD: vscode.Command = { command: 'missing', title: '<<MISSING COMMAND>>' };

  private readonly cache = new Cache<vscode.CodeLens>('CodeLens');
  private readonly disposableStore = new Map<number, DisposableStore>();

  constructor(
    private readonly provider: vscode.CodeLensProvider,
    private readonly documents: ExtensionDocumentDataManager,
    private readonly commandConverter: CommandsConverter,
  ) {}

  async provideCodeLenses(resource: URI, token: CancellationToken): Promise<ICodeLensListDto | undefined> {
    const doc = this.documents.getDocumentData(resource.toString());
    if (!doc) {
      return Promise.reject(new Error(`There is no document for ${resource}`));
    }

    const lenses = await this.provider.provideCodeLenses(doc.document, token);
    if (!lenses || token.isCancellationRequested) {
      return undefined;
    }
    const cacheId = this.cache.add(lenses);
    const disposables = new DisposableStore();
    this.disposableStore.set(cacheId, disposables);

    const result: ICodeLensListDto = {
      cacheId,
      lenses: [],
    };
    for (let i = 0; i < lenses.length; i++) {
      result.lenses.push({
        cacheId: [cacheId, i],
        range: Converter.fromRange(lenses[i].range),
        command: this.commandConverter.toInternal(lenses[i].command, disposables),
      });
    }

    return result;
  }

  async resolveCodeLens(symbol: CodeLens, token: CancellationToken): Promise<CodeLens | undefined> {
    const lens = symbol.cacheId && this.cache.get(...symbol.cacheId);
    if (!lens) {
      return Promise.resolve(undefined);
    }

    let resolvedLens: vscode.CodeLens | undefined | null;
    if (typeof this.provider.resolveCodeLens !== 'function' || lens.isResolved) {
      resolvedLens = lens;
    } else {
      resolvedLens = (await this.provider.resolveCodeLens(lens, token)) as any;
    }

    if (!resolvedLens) {
      resolvedLens = lens;
    }

    if (token.isCancellationRequested) {
      return undefined;
    }

    const disposables = new DisposableStore();

    symbol.command = this.commandConverter.toInternal(
      resolvedLens.command ? resolvedLens.command : CodeLensAdapter.BAD_CMD,
      disposables,
    );
    return symbol;
  }

  releaseCodeLens(cacheId: number): void {
    this.disposableStore.get(cacheId)?.dispose();
    this.disposableStore.delete(cacheId);
    this.cache.delete(cacheId);
  }
}
