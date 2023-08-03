import nodeFetch from 'node-fetch';

import { Injectable } from '@opensumi/di';

const AI_SEARCH_HOST = '';

@Injectable()
export class AiGPTBackService {
  /**
   * AI 只能搜索，接入文档 https://yuque.antfin-inc.com/iikq97/iy8i8p/tphocb92lcgfe17i#duNP2
   */
  public async aiSearchRequest(value: string, mode: 'code' | 'overall' = 'overall'): Promise<any> {
    const result = await nodeFetch(
      AI_SEARCH_HOST,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customConfig: {
            // code | overall
            searchMode: mode,
            mayaIp: '',
          },
          messages: [
            {
              role: 'user',
              content: value,
            },
          ],
        }),
      },
    );

    const toJson = await result.json();

    // 取 responseText 和 urlMessage
    const responseText = toJson.result.CodegptSgchainService.results.responseText;
    const urlMessage = toJson.result.CodegptSgchainService.results.urlMessage;
    console.log('aiSearchRequest::>>>>>>', toJson);
    return {
      responseText,
      urlMessage,
    };
  }
}
