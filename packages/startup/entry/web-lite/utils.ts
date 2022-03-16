import { CodePlatform } from './code-api/common/types';

export const DEFAULT_URL = 'https://github.com/opensumi/core';

export function parseUri(uri: string) {
  let requestUri = '';
  if (uri.startsWith('https') || uri.startsWith('http')) {
    requestUri = uri.split('://')[1] || '';
  }
  const [platform, owner, name, ...branch] = requestUri.split('/');
  const originBranch = branch.join('/').startsWith('tree') ? branch.join('/').slice(5) : '';
  return {
    uri: requestUri,
    // 固定为github
    platform: CodePlatform.github,
    owner,
    name,
    branch: originBranch,
  };
}
