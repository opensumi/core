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

import type vscode from 'vscode';

import { Uri as URI } from '@opensumi/ide-core-common';

import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import * as types from '../../../../common/vscode/ext-types';
import { ColorPresentation, RawColorInfo } from '../../../../common/vscode/model.api';

export class ColorProviderAdapter {
  constructor(private documents: ExtensionDocumentDataManager, private provider: vscode.DocumentColorProvider) {}

  provideColors(resource: URI, token: vscode.CancellationToken): Promise<RawColorInfo[]> {
    const document = this.documents.getDocumentData(resource);
    if (!document) {
      return Promise.reject(new Error(`There are no document for ${resource}`));
    }

    const doc = document.document;

    return Promise.resolve(this.provider.provideDocumentColors(doc, token)).then((colors) => {
      if (!Array.isArray(colors)) {
        return [];
      }

      const colorInfos: RawColorInfo[] = colors.map((colorInfo) => ({
        color: Converter.fromColor(colorInfo.color),
        range: Converter.fromRange(colorInfo.range)!,
      }));

      return colorInfos;
    });
  }

  provideColorPresentations(
    resource: URI,
    raw: RawColorInfo,
    token: vscode.CancellationToken,
  ): Promise<ColorPresentation[]> {
    const document = this.documents.getDocumentData(resource);
    if (!document) {
      return Promise.reject(new Error(`There are no document for ${resource}`));
    }

    const doc = document.document;
    const range = Converter.toRange(raw.range) as types.Range;
    const color = Converter.toColor(raw.color);
    return Promise.resolve(this.provider.provideColorPresentations(color, { document: doc, range }, token)).then(
      (value) => {
        if (!Array.isArray(value)) {
          return [];
        }

        return value.map(Converter.fromColorPresentation);
      },
    );
  }
}
