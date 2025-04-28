import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, URI, WithEventBus } from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import {
  IResourceProvider,
  ResourceDecorationChangeEvent,
  ResourceDecorationNeedChangeEvent,
  ResourceService,
} from '../../common';
import { MULTI_DIFF_SCHEME } from '../../common/multi-diff';

@Injectable()
export class MultiDiffResourceProvider extends WithEventBus implements IResourceProvider {
  @Autowired()
  labelService: LabelService;

  @Autowired(ResourceService)
  resourceService: ResourceService;

  @Autowired(IFileServiceClient)
  protected fileServiceClient: IFileServiceClient;

  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  private modifiedToResource = new Map<string, URI>();

  private userhomePath: URI | null;

  async provideResource(uri: URI) {
    const { name, sources } = uri.getParsedQuery();
    const parsedSources = JSON.parse(sources);

    // Get icon from the first modified file
    const firstModifiedUri = new URI(parsedSources[0].modifiedUri);
    const icon = this.labelService.getIcon(firstModifiedUri);

    return {
      name: `Multi-Diff: ${name || parsedSources.length + ' files'}`,
      icon,
      uri,
      supportsRevive: this.appConfig.enableDiffRevive ?? true,
      metadata: {
        sources: parsedSources,
      },
    };
  }

  async shouldCloseResource(resource, openedResources): Promise<boolean> {
    // For now, always allow closing
    return true;
  }
}
