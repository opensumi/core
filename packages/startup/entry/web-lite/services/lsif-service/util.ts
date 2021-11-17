import { Uri } from '@ide-framework/ide-core-common';

export function getRelatedFilePath(uri: string | undefined, projectRoot: string | undefined) {
  if (projectRoot) {
    const relatedPath = uri?.substr(projectRoot.length);
    return relatedPath;
  }
}

/**
 * 从uri中解析出commit等信息
 * @param uri
 * @param projectRoot
 */
export function getLsifLocation(uri: Uri, projectRoot: string | undefined) {
  const relatedPath = getRelatedFilePath(uri.path, projectRoot);
  // if git schema
  if (uri.scheme === 'git') {
    if (uri.query) {
      const queryObj = JSON.parse(uri.query);
      return {
        relatedPath,
        commit: queryObj.ref,
      };
    }
  }

  // 普通工作空间
  return {
    relatedPath,
  };
}
