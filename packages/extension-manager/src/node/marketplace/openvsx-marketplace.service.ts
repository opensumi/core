import nodeFetch from 'node-fetch';

import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-node/lib/types';

import { IMarketplaceService } from '../../common';
import { QueryParam, QueryResult, VSXSearchParam, VSXSearchResult } from '../../common/vsx-registry-types';

const openvsxCommonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

@Injectable()
export class OpenvsxMarketplaceService implements IMarketplaceService {
  @Autowired(AppConfig)
  private appConfig: AppConfig;

  async getExtensionDetail(param: QueryParam): Promise<QueryResult | undefined> {
    const uri = `${this.appConfig.marketplace.endpoint}/api/-/query`;
    const res = await nodeFetch(uri, {
      headers: {
        ...openvsxCommonHeaders,
      },
      method: 'POST',
      body: JSON.stringify(param),
    });

    return await res.json();
  }

  async search(param?: VSXSearchParam): Promise<VSXSearchResult> {
    const uri = `${this.appConfig.marketplace.endpoint}/api/-/search?${
      param && new URLSearchParams(param as any).toString()
    }`;
    const res = await nodeFetch(uri, {
      headers: {
        ...openvsxCommonHeaders,
      },
      timeout: 30000,
    });
    return await res.json();
  }
}
