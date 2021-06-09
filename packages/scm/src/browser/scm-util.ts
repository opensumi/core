import { basename } from '@ali/ide-core-common/lib/path';
import { ISCMResourceGroup, ISCMResource, ISCMRepository } from '../common';

export function isSCMResource(element: ISCMResourceGroup | ISCMResource): element is ISCMResource {
  return !!(element as ISCMResource).sourceUri;
}

/**
 * @deprecated
 */
export function getSCMResourceGroupContextValue(resource: ISCMResourceGroup | ISCMResource): string {
  return isSCMResource(resource) ? resource.resourceGroup.id : resource.id;
}

export function getSCMRepositoryDesc(repository: ISCMRepository) {
  const hasRootUri = repository.provider.rootUri;
  const title = hasRootUri ? basename(repository.provider.rootUri!.toString()) : repository.provider.label;

  const type = hasRootUri ? repository.provider.label : '';

  return { title, type };
}
