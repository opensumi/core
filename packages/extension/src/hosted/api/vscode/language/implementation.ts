import { Uri as URI } from '@opensumi/ide-core-common';

import * as Converter from '../../../../common/vscode/converter';
import { ExtensionDocumentDataManager } from '../../../../common/vscode/doc';
import * as types from '../../../../common/vscode/ext-types';
import { Definition, DefinitionLink, Location, Position } from '../../../../common/vscode/model.api';

import { createToken, isDefinitionLinkArray, isLocationArray } from './util';

import type vscode from 'vscode';

export class ImplementationAdapter {
  constructor(
    private readonly provider: vscode.ImplementationProvider,
    private readonly documents: ExtensionDocumentDataManager,
  ) {}

  provideImplementation(resource: URI, position: Position): Promise<Definition | DefinitionLink[] | undefined> {
    const documentData = this.documents.getDocumentData(resource);
    if (!documentData) {
      return Promise.reject(new Error(`There is no document for ${resource}`));
    }

    const document = documentData.document;
    const zeroBasedPosition = Converter.toPosition(position);

    return Promise.resolve(this.provider.provideImplementation(document, zeroBasedPosition, createToken())).then(
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
