import { Injectable, Autowired } from '@opensumi/di';
import { URI, WithEventBus, MaybePromise, getIcon, LabelService } from '@opensumi/ide-core-browser';

import { IResourceProvider, IResource } from '../../common';

@Injectable()
export class MergeEditorResourceProvider extends WithEventBus implements IResourceProvider {
  scheme = 'mergeEditor';

  @Autowired(LabelService)
  private readonly labelService: LabelService;

  public provideResource(uri: URI): MaybePromise<IResource<any>> {
    const { current, incoming, result, name } = uri.getParsedQuery();
    const resultEditorUri = new URI(result);
    const icon = this.labelService.getIcon(resultEditorUri);
    return {
      name,
      icon,
      uri,
      metadata: {
        current,
        incoming,
        result,
      },
    };
  }
}
