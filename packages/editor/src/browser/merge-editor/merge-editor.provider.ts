import { Injectable } from '@opensumi/di';
import { URI, WithEventBus, MaybePromise, getIcon } from '@opensumi/ide-core-browser';

import { IResourceProvider, IResource } from '../../common';

@Injectable()
export class MergeEditorResourceProvider extends WithEventBus implements IResourceProvider {
  public provideResource(uri: URI): MaybePromise<IResource<any>> {
    return {
      name: '解决合并冲突视图',
      icon: getIcon('share'),
      uri,
    };
  }

  scheme = 'mergeEditor';
}
