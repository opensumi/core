import type vscode from 'vscode';

import { Uri, Cache } from '@opensumi/ide-core-common';

import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import { ChainedCacheId, ILink, ILinkDto, ILinksListDto } from '../../../../common/vscode/model.api';

export class LinkProviderAdapter {
  private cache = new Cache<vscode.DocumentLink>('DocumentLink');

  constructor(
    private readonly provider: vscode.DocumentLinkProvider,
    private readonly documents: ExtensionDocumentDataManager,
  ) {}

  provideLinks(resource: Uri, token: vscode.CancellationToken): Promise<ILinksListDto | undefined> {
    const document = this.documents.getDocumentData(resource);
    if (!document) {
      return Promise.reject(new Error(`There is no document for ${resource}`));
    }

    const doc = document.document;

    return Promise.resolve(this.provider.provideDocumentLinks(doc, token)).then((links) => {
      if (!Array.isArray(links)) {
        return undefined;
      }

      if (typeof this.provider.resolveDocumentLink !== 'function') {
        return { links: links.map(Converter.fromDocumentLink) };
      }

      const pid = this.cache.add(links);
      const result: ILinksListDto = {
        id: pid,
        links: [],
      };

      for (let i = 0; i < links.length; i++) {
        const data: ILinkDto = Converter.fromDocumentLink(links[i]);
        data.cacheId = [pid, i];
        result.links.push(data);
      }
      return result;
    });
  }

  resolveLink(id: ChainedCacheId, token: vscode.CancellationToken): Promise<ILink | undefined> {
    if (typeof this.provider.resolveDocumentLink !== 'function') {
      return Promise.resolve(undefined);
    }
    const item = this.cache.get(...id);
    if (!item) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.provider.resolveDocumentLink(item, token)).then((value) => {
      if (value) {
        return Converter.fromDocumentLink(value);
      }
      return undefined;
    });
  }

  releaseLink(cacheId: number) {
    this.cache.delete(cacheId);
  }
}
