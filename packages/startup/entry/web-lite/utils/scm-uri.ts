import { URI } from '@opensumi/ide-core-common';

interface SCMUriQueryParams {
  ref: string; // commitId
  branch?: string; // 分支名
}

interface SCMUriParams extends SCMUriQueryParams {
  platform: string; // 例如 antcode/aone/gitlab 等
  repo: string; // groupName/repoName 项目名称
  path: string; // 文件路径
}

export function fromSCMUri(uri: URI): SCMUriParams {
  const codeUri = uri.codeUri;
  const query = JSON.parse(uri.codeUri.query);

  const result: SCMUriParams = {
    platform: codeUri.scheme,
    repo: codeUri.authority,
    path: codeUri.path,
    ref: query.ref,
  };

  if (query.branch) {
    result.branch = query.branch;
  }

  return result;
}

export function toSCMUri(uriParams: SCMUriParams) {
  const query: SCMUriQueryParams = {
    ref: uriParams.ref,
  };

  if (uriParams.branch) {
    query.branch = uriParams.branch;
  }

  return URI.from({
    scheme: uriParams.platform,
    authority: uriParams.repo,
    path: uriParams.path,
    query: JSON.stringify(query),
  });
}
