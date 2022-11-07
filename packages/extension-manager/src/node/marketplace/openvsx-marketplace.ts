import nodeFetch from 'node-fetch';

import { AbstractMarketplace } from '../../common';
import { QueryParam, QueryResult, VSXSearchParam, VSXSearchResult } from '../../common/vsx-registry-types';

const commonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

export class OpenvsxMarketplaceImpl extends AbstractMarketplace {
  async getExtensionDetail(param: QueryParam): Promise<QueryResult | undefined> {
    const uri = `${this.config.endpoint}/api/-/query`;
    const res = await nodeFetch(uri, {
      headers: {
        ...commonHeaders,
      },
      method: 'POST',
      body: JSON.stringify(param),
    });

    return await res.json();
  }

  async search(param?: VSXSearchParam): Promise<VSXSearchResult> {
    const uri = `${this.config.endpoint}/api/-/search?${param && new URLSearchParams(param as any).toString()}`;
    const res = await nodeFetch(uri, {
      headers: {
        ...commonHeaders,
      },
      timeout: 30000,
    });
    return await res.json();
  }
}
