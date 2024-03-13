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

// Some code copied and modified from https://github.com/eclipse-theia/theia/tree/v1.14.0/packages/plugin-ext/src/plugin/languages/range-formatting.ts

import { Uri as URI } from '@opensumi/ide-core-common';

import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import { FormattingOptions, Range, SingleEditOperation } from '../../../../common/vscode/model.api';

import { createToken } from './util';

import type vscode from 'vscode';

export class RangeFormattingAdapter {
  constructor(
    private readonly provider: vscode.DocumentRangeFormattingEditProvider,
    private readonly documents: ExtensionDocumentDataManager,
  ) {}

  provideDocumentRangeFormattingEdits(
    resource: URI,
    range: Range,
    options: FormattingOptions,
  ): Promise<SingleEditOperation[] | undefined> {
    const document = this.documents.getDocumentData(resource.toString());
    if (!document) {
      return Promise.reject(new Error(`There are no document for ${resource}`));
    }

    const doc = document.document;
    const ran = Converter.toRange(range);

    return Promise.resolve(
      this.provider.provideDocumentRangeFormattingEdits(doc, ran as any, options as any, createToken()),
    ).then((value) => {
      if (Array.isArray(value)) {
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
  ) {}

  provideDocumentFormattingEdits(
    resource: URI,
    options: FormattingOptions,
  ): Promise<SingleEditOperation[] | undefined> {
    const document = this.documents.getDocumentData(resource.toString());
    if (!document) {
      return Promise.reject(new Error(`There are no document for ${resource}`));
    }

    const doc = document.document;

    return Promise.resolve(this.provider.provideDocumentFormattingEdits(doc, options as any, createToken())).then(
      (value) => {
        if (Array.isArray(value)) {
          return value.map(Converter.fromTextEdit);
        }
        return undefined;
      },
    );
  }
}
