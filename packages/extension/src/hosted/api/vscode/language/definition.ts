import type vscode from 'vscode';

import { Uri as URI } from '@opensumi/ide-core-common';

import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import * as types from '../../../../common/vscode/ext-types';
import { Definition, DefinitionLink, Location, Position } from '../../../../common/vscode/model.api';
import { isDefinitionLinkArray, isLocationArray } from '../../../../common/vscode/utils';

export class DefinitionAdapter {
  constructor(
    private readonly delegate: vscode.DefinitionProvider,
    private readonly documents: ExtensionDocumentDataManager,
  ) {}

  provideDefinition(
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
    return Promise.resolve(this.delegate.provideDefinition(document, zeroBasedPosition, token)).then((definition) => {
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
