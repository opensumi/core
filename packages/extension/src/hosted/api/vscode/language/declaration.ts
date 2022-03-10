import type vscode from 'vscode';

import { Uri as URI } from '@opensumi/ide-core-common';

import * as Converter from '../../../../common/vscode/converter';
import { ExtensionDocumentDataManager } from '../../../../common/vscode/doc';
import * as types from '../../../../common/vscode/ext-types';
import { Position, Definition, DefinitionLink, Location } from '../../../../common/vscode/model.api';

import { isDefinitionLinkArray, isLocationArray } from './util';

export class DeclarationAdapter {
  constructor(
    private readonly provider: vscode.DeclarationProvider,
    private readonly documents: ExtensionDocumentDataManager,
  ) {}

  provideDeclaration(
    resource: URI,
    position: Position,
    token: vscode.CancellationToken,
  ): Promise<Definition | DefinitionLink[] | undefined> {
    const documentData = this.documents.getDocumentData(resource);
    if (!documentData) {
      return Promise.reject(new Error(`There is no document for ${resource}`));
    }

    const document = documentData.document;
    const zeroBasedPosition = Converter.toPosition(position);

    return Promise.resolve(this.provider.provideDeclaration(document, zeroBasedPosition, token)).then((definition) => {
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
    });
  }
}
