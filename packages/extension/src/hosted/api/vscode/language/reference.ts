import { Uri as URI } from '@ide-framework/ide-core-common';
import type vscode from 'vscode';
import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import { Location, Position, ReferenceContext } from '../../../../common/vscode/model.api';
import { isLocationArray } from '../../../../common/vscode/utils';
import * as Converter from '../../../../common/vscode/converter';

export class ReferenceAdapter {

    constructor(
        private readonly provider: vscode.ReferenceProvider,
        private readonly documents: ExtensionDocumentDataManager,
    ) { }

    provideReferences(resource: URI, position: Position, context: ReferenceContext, token: vscode.CancellationToken): Promise<Location[] | undefined> {
        const documentData = this.documents.getDocumentData(resource);
        if (!documentData) {
            return Promise.reject(new Error(`There is no document for ${resource}`));
        }

        const document = documentData.document;
        const zeroBasedPosition = Converter.toPosition(position);

        return Promise.resolve(this.provider.provideReferences(document, zeroBasedPosition, context, token)).then((reference) => {
            if (!reference) {
                return undefined;
            }

            if (isLocationArray(reference)) {
                const locations: Location[] = [];

                for (const location of reference) {
                    locations.push(Converter.fromLocation(location));
                }

                return locations;
            }
        });
    }

}
