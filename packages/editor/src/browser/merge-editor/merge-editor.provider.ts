import { Autowired, Injectable } from '@opensumi/di';
import { LabelService, MaybePromise, URI, WithEventBus } from '@opensumi/ide-core-browser';
import { MergeEditorService } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/merge-editor.service';

import { IResource, IResourceProvider } from '../../common';
@Injectable()
export class MergeEditorResourceProvider extends WithEventBus implements IResourceProvider {
  scheme = 'mergeEditor';

  @Autowired(LabelService)
  private readonly labelService: LabelService;

  @Autowired(MergeEditorService)
  private readonly mergeEditorService: MergeEditorService;

  public provideResource(uri: URI): MaybePromise<IResource<any>> {
    const { openMetadata, name } = uri.getParsedQuery();

    try {
      const parseMetaData = JSON.parse(openMetadata);
      const { ancestor, input1, input2, output } = parseMetaData;
      const resultEditorUri = new URI(output);
      const icon = this.labelService.getIcon(resultEditorUri);
      return {
        supportsRevive: true,
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

  public shouldCloseResource(resource: IResource<any>, openedResources: IResource<any>[][]): MaybePromise<boolean> {
    const { openMetadata } = resource.uri.getParsedQuery();

    try {
      const parseMetaData = JSON.parse(openMetadata);
      const { output } = parseMetaData;
      const outputUri = new URI(output);
      this.mergeEditorService.fireRestoreState(outputUri);
      return true;
    } catch (error) {
      throw Error('invalid merge editor resource parse');
    }
  }
}
