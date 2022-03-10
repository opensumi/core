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

 // Some code copied and modified from https://github.com/eclipse-theia/theia/tree/v1.14.0/packages/plugin-ext/src/plugin/languages/type-definition.ts

import type vscode from 'vscode';

import { Uri } from '@opensumi/ide-core-common';

import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import * as types from '../../../../common/vscode/ext-types';
import { Definition, DefinitionLink, Location, Position } from '../../../../common/vscode/model.api';
import { isDefinitionLinkArray, isLocationArray } from '../../../../common/vscode/utils';

export class TypeDefinitionAdapter {
  constructor(
    private readonly provider: vscode.TypeDefinitionProvider,
    private readonly documents: ExtensionDocumentDataManager,
  ) {}

  provideTypeDefinition(
    resource: Uri,
    position: Position,
    token: vscode.CancellationToken,
  ): Promise<Definition | DefinitionLink[] | undefined> {
    const documentData = this.documents.getDocumentData(resource);
    if (!documentData) {
      return Promise.reject(new Error(`There is no document for ${resource}`));
    }

    const document = documentData.document;
    const zeroBasedPosition = Converter.toPosition(position);

    return Promise.resolve(this.provider.provideTypeDefinition(document, zeroBasedPosition, token)).then(
      (definition) => {
        if (!definition) {
          return undefined;
        }

        if (definition instanceof types.Location) {
          return Converter.fromLocation(definition);
        }

        if (isLocationArray(definition)) {
          const locations: Location[] = [];

          for (const location of definition) {
            locations.push(Converter.fromLocation(location));
          }

          return locations;
        }

        if (isDefinitionLinkArray(definition)) {
          const definitionLinks: DefinitionLink[] = [];

          for (const definitionLink of definition) {
            definitionLinks.push(Converter.DefinitionLink.from(definitionLink));
          }

          return definitionLinks;
        }
      },
    );
  }
}
