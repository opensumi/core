import { Autowired } from '@opensumi/di';
import { Domain, URI } from '@opensumi/ide-core-browser';

import { ResourceService } from '../../common';
import { IMultiDiffSourceResolverService } from '../../common/multi-diff';
import { BrowserEditorContribution, EditorComponentRegistry, EditorOpenType } from '../types';

import { MultiDiffResourceProvider } from './multi-diff-resource';

@Domain(BrowserEditorContribution)
export class MultiDiffEditorContribution implements BrowserEditorContribution {
  @Autowired(IMultiDiffSourceResolverService)
  private readonly multiDiffSourceResolverService: IMultiDiffSourceResolverService;

  @Autowired()
  multiDiffResourceProvider: MultiDiffResourceProvider;

  registerResource(resourceService: ResourceService): void {
    resourceService.registerResourceProvider(this.multiDiffResourceProvider);
  }

  registerEditorComponent(registry: EditorComponentRegistry) {
    registry.registerEditorComponentResolver(
      (scheme) => {
        const resolvers = this.multiDiffSourceResolverService.getResolvers();
        for (const resolver of resolvers) {
          if (resolver.canHandleUri(new URI(`${scheme}:/empty`))) {
            return 10;
          }
        }
        return -1;
      },
      (resource, results) => {
        results.push({
          type: EditorOpenType.multiDiff,
        });
      },
    );
  }
}
