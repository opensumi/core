/********************************************************************************
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

import { createPatch } from 'diff';
import type vscode from 'vscode';
import { Uri as URI } from '@ali/ide-core-common';
import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import { FormattingOptions, Range, SingleEditOperation } from '../../../../common/vscode/model.api';
import { createToken } from './util';

export class RangeFormattingAdapter {

  constructor(
    private readonly provider: vscode.DocumentRangeFormattingEditProvider,
    private readonly documents: ExtensionDocumentDataManager,
  ) { }

  provideDocumentRangeFormattingEdits(resource: URI, range: Range, options: FormattingOptions): Promise<SingleEditOperation[] | undefined> {
    const document = this.documents.getDocumentData(resource.toString());
    if (!document) {
      return Promise.reject(new Error(`There are no document for ${resource}`));
    }

    const doc = document.document;
    const ran = Converter.toRange(range);
    const oldText = (doc as vscode.TextDocument).getText();

    // tslint:disable-next-line:no-any
    return Promise.resolve(this.provider.provideDocumentRangeFormattingEdits(doc, ran as any, options as any, createToken())).then((value) => {
      if (Array.isArray(value)) {
        if (value.length === 1) {
          const newText = value[0].newText;
          const diff = createPatch('a', oldText, newText, undefined, undefined, { context: 0 }).slice(89);
          const delta = diff.length / newText.length;
          // diff 小于原始文字的 1/10 的时候，只传输 diff
          if (delta < 0.1) {
            return [{
              text: diff,
              range: Converter.fromRange(value[0].range),
              onlyPatch: true,
            } as SingleEditOperation];
          }
        }
        return value.map(Converter.fromTextEdit);
      }
      return undefined;
    });
  }
}

export class FormattingAdapter {

  constructor(
    private readonly provider: vscode.DocumentFormattingEditProvider,
    private readonly documents: ExtensionDocumentDataManager,
  ) { }

  provideDocumentFormattingEdits(resource: URI, options: FormattingOptions): Promise<SingleEditOperation[] | undefined> {
    const document = this.documents.getDocumentData(resource.toString());
    if (!document) {
      return Promise.reject(new Error(`There are no document for ${resource}`));
    }

    const doc = document.document;

    // tslint:disable-next-line:no-any
    return Promise.resolve(this.provider.provideDocumentFormattingEdits(doc, options as any, createToken())).then((value) => {
      if (Array.isArray(value)) {
        return value.map(Converter.fromTextEdit);
      }
      return undefined;
    });
  }
}
