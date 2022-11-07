import nodeFetch from 'node-fetch';

import { AbstractMarketplace } from '../../common';
import { QueryParam, QueryResult, VSXSearchParam, VSXSearchResult } from '../../common/vsx-registry-types';

const commonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

export class OpentrsMarketplaceImpl extends AbstractMarketplace {
  constructor(config) {
    super(config);

    this.downloadHeaders = this.getAKHeaders();
  }

  private getAKHeaders() {
    const { masterKey, accountId } = this.config;
    const headers = {};

    if (masterKey) {
      headers['x-master-key'] = masterKey;
    }

    if (accountId) {
      headers['x-account-id'] = accountId;
    }

    return headers;
  }

  async getExtensionDetail(param: QueryParam): Promise<QueryResult | undefined> {
    const { endpoint } = this.config;

    const uri = `${endpoint}/openapi/ide/extension/${param.extensionId}`;
    const res = await nodeFetch(uri, {
      headers: {
        ...commonHeaders,
        ...this.getAKHeaders(),
      },
    });
    const { data } = await res.json();

    return {
      extensions: [
        {
          ...data,
          files: {
            license: data.licenseUrl,
          },
        },
      ],
    };
  }

  async search(param?: VSXSearchParam): Promise<VSXSearchResult> {
    const { endpoint } = this.config;
    const res = await nodeFetch(
      `${endpoint}/openapi/ide/search?${param && new URLSearchParams(param as any).toString()}`,
      {
        headers: {
          ...commonHeaders,
          ...this.getAKHeaders(),
        },
        timeout: 30000,
      },
    );

    const { count: totalSize, data: extensions } = await res.json();

    return {
      extensions: extensions.map((item) => {
        const { icon, publisher, extensionId, ...restItem } = item;

        return {
          ...restItem,
          extensionId,
          namespace: publisher,
          files: {
            icon,
            download: `${endpoint}/openapi/ide/download/${extensionId}`,
          },
        };
      }),
      offset: 0,
    };
  }
}
