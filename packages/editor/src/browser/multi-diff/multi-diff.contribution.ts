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

import { MultiDiffResolver } from './multi-diff-resolver';
import { MultiDiffResourceProvider } from './multi-diff-resource';

@Domain(BrowserEditorContribution, MultiDiffSourceContribution)
export class MultiDiffEditorContribution implements BrowserEditorContribution, MultiDiffSourceContribution {
  @Autowired(IMultiDiffSourceResolverService)
  private readonly multiDiffSourceResolverService: IMultiDiffSourceResolverService;

  @Autowired(MultiDiffResolver)
  private readonly multiDiffResolver: MultiDiffResolver;

  @Autowired()
  private readonly multiDiffResourceProvider: MultiDiffResourceProvider;

  registerMultiDiffSourceResolver(resolverService: IMultiDiffSourceResolverService): IDisposable {
    // 内置实现，通过 command 使用
    return resolverService.registerResolver(this.multiDiffResolver);
  }

  registerResource(resourceService: ResourceService): void {
    resourceService.registerResourceProvider(this.multiDiffResourceProvider);
  }

  registerEditorComponent(registry: EditorComponentRegistry) {
    registry.registerEditorComponentResolver(
      (scheme) => {
        const resolvers = this.multiDiffSourceResolverService.getResolvers();
        for (const resolver of resolvers) {
          if (
            resolver.canHandleUri(
              URI.from({
                scheme,
                path: 'empty',
              }),
            )
          ) {
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
