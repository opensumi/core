import { Injectable, Autowired } from '@opensumi/di';
import { URI, Domain, WithEventBus, OnEvent } from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';

import { IResourceProvider, IDiffResource, ResourceService, ResourceDecorationChangeEvent } from '../../common';
import { BrowserEditorContribution, EditorComponentRegistry } from '../types';

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

  scheme = 'diff';

  private modifiedToResource = new Map<string, URI>();

  @OnEvent(ResourceDecorationChangeEvent)
  onResourceDecorationChangeEvent(e: ResourceDecorationChangeEvent) {
    if (e.payload.uri && this.modifiedToResource.has(e.payload.uri.toString())) {
      this.eventBus.fire(
        new ResourceDecorationChangeEvent({
          uri: this.modifiedToResource.get(e.payload.uri.toString())!,
          decoration: e.payload.decoration,
        }),
      );
    }
  }

  async provideResource(uri: URI): Promise<IDiffResource> {
    const { original, modified, name } = uri.getParsedQuery();
    const originalUri = new URI(original);
    const modifiedUri = new URI(modified);
    const icon = await this.labelService.getIcon(originalUri);
    this.modifiedToResource.set(modifiedUri.toString(), uri);
    return {
      name,
      icon,
      uri,
      metadata: {
        original: originalUri,
        modified: modifiedUri,
      },
    };
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
    registry.registerEditorComponentResolver('diff', (resource: IDiffResource, results) => {
      results.push({
        type: 'diff',
      });
    });
  }
}
