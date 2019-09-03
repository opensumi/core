import { IResourceProvider, IDiffResource, ResourceService } from '../../common';
import { URI, MaybePromise, Domain } from '@ali/ide-core-browser';
import * as url from 'url';
import { Injectable, Autowired } from '@ali/common-di';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { BrowserEditorContribution, EditorComponentRegistry } from '../types';

// diff URI:
// diff://?name=tabName&original=uri1&modified=uri2
// 例子:
// diff://?name=a.ts(on disk)<=>a.ts&original=file://path/to/a.ts&modified=fileOnDisk://path/to/a.ts

@Injectable()
export class DiffResourceProvider implements IResourceProvider {

  @Autowired()
  labelService: LabelService;

  scheme: string = 'diff';

  async provideResource(uri: URI): Promise<IDiffResource> {
    const { original, modified, name } = uri.getParsedQuery();
    const originalUri = new URI(original);
    const modifiedUri = new URI(modified);
    const icon = await this.labelService.getIcon(originalUri);
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
