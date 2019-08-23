import { ISCMResourceGroup, ISCMResource } from '../common';

export function isSCMResource(element: ISCMResourceGroup | ISCMResource): element is ISCMResource {
  return !!(element as ISCMResource).sourceUri;
}
