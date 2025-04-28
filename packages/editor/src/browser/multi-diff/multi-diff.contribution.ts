import { Autowired } from '@opensumi/di';
import { Domain, IDisposable, URI } from '@opensumi/ide-core-browser';

import { ResourceService } from '../../common';
import { IMultiDiffSourceResolverService, IResolvedMultiDiffSource, MULTI_DIFF_SCHEME } from '../../common/multi-diff';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  EditorOpenType,
  MultiDiffSourceContribution,
} from '../types';

import { MultiDiffResourceProvider } from './multi-diff-resource';

@Domain(BrowserEditorContribution, MultiDiffSourceContribution)
export class MultiDiffEditorContribution implements BrowserEditorContribution, MultiDiffSourceContribution {
  @Autowired(IMultiDiffSourceResolverService)
  private readonly multiDiffSourceResolverService: IMultiDiffSourceResolverService;

  @Autowired()
  multiDiffResourceProvider: MultiDiffResourceProvider;

  registerMultiDiffSourceResolver(resolverService: IMultiDiffSourceResolverService): IDisposable {
    // 内置静态实现，读取uri中的query实现
    return resolverService.registerResolver({
      canHandleUri(uri: URI): boolean {
        return uri.scheme === MULTI_DIFF_SCHEME;
      },
      async resolveDiffSource(): Promise<IResolvedMultiDiffSource | undefined> {
        return undefined;
      },
    });
  }

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
