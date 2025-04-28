import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, URI, WithEventBus, getIcon } from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import { IResourceProvider, ResourceService } from '../../common';
import { IMultiDiffSourceResolverService } from '../../common/multi-diff';

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

  @Autowired(IMultiDiffSourceResolverService)
  private readonly multiDiffSourceResolverService: IMultiDiffSourceResolverService;

  handlesUri(uri: URI): number {
    const resolvers = this.multiDiffSourceResolverService.getResolvers();
    for (const resolver of resolvers) {
      if (resolver.canHandleUri(uri)) {
        return 10;
      }
    }
    return -1;
  }

  async provideResource(uri: URI) {
    const { name, sources } = uri.getParsedQuery();
    const parsedSources = sources ? JSON.parse(sources) : [];

    // Get icon from the first modified file
    const firstModifiedUri = parsedSources.length > 0 ? new URI(parsedSources[0].modifiedUri) : undefined;
    const icon = firstModifiedUri ? this.labelService.getIcon(firstModifiedUri) : undefined;

    return {
      name: `Multi-Diff: ${name || parsedSources.length + ' files'}`,
      icon: icon || getIcon('diff'),
      uri,
      supportsRevive: this.appConfig.enableDiffRevive ?? true,
      metadata: {
        sources: parsedSources,
      },
    };
  }

  async shouldCloseResource(resource, openedResources): Promise<boolean> {
    // TODO: For now, always allow closing
    return true;
  }
}
