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
import { MULTI_DIFF_SCHEME } from '../../common/multi-file-diff';

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

  scheme = MULTI_DIFF_SCHEME;

  private modifiedToResource = new Map<string, URI>();

  private userhomePath: URI | null;

  async provideResource(uri: URI) {
    const { name, sources } = uri.getParsedQuery();
    const parsedSources = JSON.parse(sources);

    // Get icon from the first modified file
    const firstModifiedUri = new URI(parsedSources[0].modifiedUri);
    const icon = this.labelService.getIcon(firstModifiedUri);

    return {
      name: name || 'Multi-Diff',
      icon,
      uri,
      supportsRevive: this.appConfig.enableDiffRevive ?? true,
      metadata: {
        sources: parsedSources,
      },
      title: `Multi-Diff: ${name || parsedSources.length + ' files'}`,
    };
  }

  async shouldCloseResource(resource, openedResources): Promise<boolean> {
    // For now, always allow closing
    return true;
  }
}
