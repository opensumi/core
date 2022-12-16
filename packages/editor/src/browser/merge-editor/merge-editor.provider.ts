import { Injectable, Autowired } from '@opensumi/di';
import { URI, WithEventBus, MaybePromise, LabelService } from '@opensumi/ide-core-browser';

import { IResourceProvider, IResource } from '../../common';

@Injectable()
export class MergeEditorResourceProvider extends WithEventBus implements IResourceProvider {
  scheme = 'mergeEditor';

  @Autowired(LabelService)
  private readonly labelService: LabelService;

  public provideResource(uri: URI): MaybePromise<IResource<any>> {
    const { openMetadata, name } = uri.getParsedQuery();

    try {
      const parseMetaData = JSON.parse(openMetadata);
      const { ancestor, input1, input2, output } = parseMetaData;
      const resultEditorUri = new URI(output);
      const icon = this.labelService.getIcon(resultEditorUri);
      return {
        name,
        icon,
        uri,
        metadata: {
          ancestor,
          input1,
          input2,
          output,
        },
      };
    } catch (error) {
      throw Error('invalid merge editor resource parse');
    }
  }
}
