import { path } from '@opensumi/ide-core-browser';

import { ISCMRepository, ISCMResource, ISCMResourceGroup } from '../common';

const { basename } = path;

export function isSCMResource(element: ISCMResourceGroup | ISCMResource): element is ISCMResource {
  return !!(element as ISCMResource).sourceUri && isSCMResourceGroup((element as ISCMResource).resourceGroup);
}

export function isSCMResourceGroup(element: ISCMResourceGroup | ISCMResource): element is ISCMResourceGroup {
  return !!(element as ISCMResourceGroup).provider && !!(element as ISCMResourceGroup).elements;
}

/**
 * @deprecated
 */
export function getSCMResourceGroupContextValue(resource: ISCMResourceGroup | ISCMResource): string {
  return isSCMResource(resource) ? resource.resourceGroup.id : resource.id;
}

export function getSCMRepositoryDesc(repository: ISCMRepository) {
  const hasRootUri = repository.provider.rootUri;
  const title = hasRootUri ? basename(repository.provider.rootUri.path) : repository.provider.label;

  const type = hasRootUri ? repository.provider.label : '';

  return { title, type };
}
