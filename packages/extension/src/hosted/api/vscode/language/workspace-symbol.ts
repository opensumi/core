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

// Some code copied and modified from https://github.com/eclipse-theia/theia/tree/v1.14.0/packages/plugin-ext/src/plugin/languages/workspace-symbol.ts

import type vscode from 'vscode';
import { SymbolInformation } from 'vscode-languageserver-types';

import * as Converter from '../../../../common/vscode/converter';

export class WorkspaceSymbolAdapter {
  constructor(private readonly provider: vscode.WorkspaceSymbolProvider) {}

  provideWorkspaceSymbols(query: string, token: vscode.CancellationToken): Promise<SymbolInformation[]> {
    return Promise.resolve(this.provider.provideWorkspaceSymbols(query, token)).then((workspaceSymbols) => {
      if (!workspaceSymbols) {
        return [];
      }

      const newSymbols: SymbolInformation[] = [];
      for (const sym of workspaceSymbols) {
        const convertedSymbol = Converter.fromSymbolInformation(sym);
        if (convertedSymbol) {
          newSymbols.push(convertedSymbol);
        }
      }
      return newSymbols;
    });
  }

  resolveWorkspaceSymbol(symbol: SymbolInformation, token: vscode.CancellationToken): Promise<SymbolInformation> {
    if (this.provider.resolveWorkspaceSymbol && typeof this.provider.resolveWorkspaceSymbol === 'function') {
      const vscodeSymbol = Converter.toSymbolInformation(symbol);
      if (!vscodeSymbol) {
        return Promise.resolve(symbol);
      } else {
        return Promise.resolve(this.provider.resolveWorkspaceSymbol(vscodeSymbol, token)).then((workspaceSymbol) => {
          if (!workspaceSymbol) {
            return symbol;
          }

          const converted = Converter.fromSymbolInformation(workspaceSymbol);
          if (converted) {
            return converted;
          }
          return symbol;
        });
      }
    }
    return Promise.resolve(symbol);
  }
}
