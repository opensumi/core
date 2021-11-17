import { Injectable } from '@ide-framework/common-di';

import { ICodeService } from './base';
import { base64ToUnicode } from '../../utils';

@Injectable()
export class CodeServiceImpl implements ICodeService {
  async fetchContent(repo: string, path: string, ref: string) {
    // aone 和 antcode 使用的 api 不太一样
    const targetUrl = process.env.SCM_PLATFORM === 'aone'
      ? `/code-service/v3/projects/${encodeURIComponent(repo)}/repository/files?file_path=${encodeURIComponent(path.slice(1))}&ref=${ref}`
      : `/code-service/v4/projects/${encodeURIComponent(repo)}/repository/files/${encodeURIComponent(path.slice(1))}?ref=${ref}`;
    return await fetch(
      targetUrl,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
      .then((res) => res.json())
      .then((ret) => {
        if (ret.encoding === 'base64') {
          ret.content = base64ToUnicode(ret.content);
        }
        return ret.content;
      });
  }
}
