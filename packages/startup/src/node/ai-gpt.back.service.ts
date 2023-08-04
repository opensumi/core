import nodeFetch from 'node-fetch';
import { config } from '../common/config';
import { Injectable } from '@opensumi/di';

@Injectable()
export class AiGPTBackService {
  /**
   * AI 智能搜索，接入文档 https://yuque.antfin-inc.com/iikq97/iy8i8p/tphocb92lcgfe17i#duNP2
   */
  public async aiSearchRequest(value: string, mode: 'code' | 'overall' = 'overall'): Promise<any> {
    const result = await nodeFetch(
      config.AI_SEARCH_HOST,
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

  /**
   * gpt 对话模型接口
   */
  public async aiGPTcompletionRequest(value: string): Promise<any> {
    const { user, token } = config.CODE_GPT;
    const result = await nodeFetch(
      config.CODE_GPT.host + '/api/chat/codegpt/completion',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'codegpt_user': user,
          'codegpt_token': token
        },
        body: JSON.stringify({
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
    return toJson
  }
}
