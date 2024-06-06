import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, Domain, OnEvent, URI, WithEventBus } from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import {
  DIFF_SCHEME,
  IDiffResource,
  IResourceProvider,
  ResourceDecorationChangeEvent,
  ResourceDecorationNeedChangeEvent,
  ResourceService,
} from '../../common';
import { BrowserEditorContribution, EditorComponentRegistry, EditorOpenType } from '../types';

// diff URI:
// diff://?name=tabName&original=uri1&modified=uri2
// 例子:
// diff://?name=a.ts(on disk)<=>a.ts&original=file://path/to/a.ts&modified=fileOnDisk://path/to/a.ts

@Injectable()
export class DiffResourceProvider extends WithEventBus implements IResourceProvider {
  @Autowired()
  labelService: LabelService;

  @Autowired(ResourceService)
  resourceService: ResourceService;

  @Autowired(IFileServiceClient)
  protected fileServiceClient: IFileServiceClient;

  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  scheme = DIFF_SCHEME;

  private modifiedToResource = new Map<string, URI>();

  private userhomePath: URI | null;

  @OnEvent(ResourceDecorationChangeEvent)
  onResourceDecorationChangeEvent(e: ResourceDecorationChangeEvent) {
    if (e.payload.uri && this.modifiedToResource.has(e.payload.uri.toString())) {
      this.eventBus.fire(
        new ResourceDecorationNeedChangeEvent({
          uri: this.modifiedToResource.get(e.payload.uri.toString())!,
          decoration: e.payload.decoration,
        }),
      );
    }
  }

  private async getCurrentUserHome() {
    if (!this.userhomePath) {
      try {
        const userhome = await this.fileServiceClient.getCurrentUserHome();
        if (userhome) {
          this.userhomePath = new URI(userhome.uri);
        }
      } catch (err) {}
    }
    return this.userhomePath;
  }

  private async getReadableTooltip(path: URI) {
    const pathStr = path.toString();
    const userhomePath = await this.getCurrentUserHome();
    if (!userhomePath) {
      return decodeURIComponent(path.withScheme('').toString());
    }
    if (userhomePath.isEqualOrParent(path)) {
      const userhomePathStr = userhomePath && userhomePath.toString();
      return decodeURIComponent(pathStr.replace(userhomePathStr, '~'));
    }
    return decodeURIComponent(path.withScheme('').toString());
  }

  async provideResource(uri: URI): Promise<IDiffResource> {
    const { original, modified, name } = uri.getParsedQuery();
    const originalUri = new URI(original);
    const modifiedUri = new URI(modified);
    this.modifiedToResource.set(modifiedUri.toString(), uri);
    return Promise.all([
      this.labelService.getIcon(originalUri),
      // 默认显示 modified 文件路径
      this.getReadableTooltip(modifiedUri),
    ]).then(([icon, title]) => ({
      name,
      icon,
      uri,
      supportsRevive: this.appConfig.enableDiffRevive ?? true,
      metadata: {
        original: originalUri,
        modified: modifiedUri,
      },
      title,
    }));
  }

  async shouldCloseResource(resource, openedResources): Promise<boolean> {
    const { modified } = resource.uri.getParsedQuery();
    const modifiedUri = new URI(modified);
    const modifiedResource = await this.resourceService.getResource(modifiedUri);
    if (modifiedResource) {
      return await this.resourceService.shouldCloseResource(modifiedResource, openedResources);
    }
    return true;
  }
}

@Domain(BrowserEditorContribution)
export class DefaultDiffEditorContribution implements BrowserEditorContribution {
  @Autowired()
  diffResourceProvider: DiffResourceProvider;

  registerResource(resourceService: ResourceService): void {
    resourceService.registerResourceProvider(this.diffResourceProvider);
  }

  registerEditorComponent(registry: EditorComponentRegistry) {
    registry.registerEditorComponentResolver(DIFF_SCHEME, (resource: IDiffResource, results) => {
      results.push({
        type: EditorOpenType.diff,
      });
    });
  }
}
