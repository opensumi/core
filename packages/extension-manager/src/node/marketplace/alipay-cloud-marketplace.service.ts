import nodeFetch from 'node-fetch';

import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-node/lib/types';
import pkg from '@opensumi/ide-core-node/package.json';

import { IMarketplaceService } from '../../common';
import { QueryParam, QueryResult, VSXSearchParam, VSXSearchResult } from '../../common/vsx-registry-types';

const alipayCloudCommonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'x-framework-version': pkg.version,
  'x-webgw-version': '2.0',
  'X-Webgw-Appid': '180020010001254774',
};

@Injectable()
export class AlipayCloudMarketplaceService implements IMarketplaceService {
  @Autowired(AppConfig)
  private appConfig: AppConfig;

  public downloadHeaders = {
    ...this.getAKHeaders(),
    ...alipayCloudCommonHeaders,
    'x-download-model': 'redirect',
  };

  private getAKHeaders() {
    const { masterKey, accountId } = this.appConfig.marketplace;
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
    const { endpoint } = this.appConfig.marketplace;
    const uri = `${endpoint}/openapi/ide/extension/${param.extensionId}`;
    const res = await nodeFetch(uri, {
      headers: {
        ...alipayCloudCommonHeaders,
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
    const { endpoint } = this.appConfig.marketplace;
    const res = await nodeFetch(
      `${endpoint}/openapi/ide/search?${param && new URLSearchParams(param as any).toString()}`,
      {
        headers: {
          ...alipayCloudCommonHeaders,
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
