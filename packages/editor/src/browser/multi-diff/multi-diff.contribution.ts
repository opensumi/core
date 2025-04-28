import { Autowired } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-browser';

import { ResourceService } from '../../common';
import { MULTI_DIFF_SCHEME } from '../../common/multi-diff';
import { BrowserEditorContribution, EditorComponentRegistry, EditorOpenType } from '../types';

import { MultiDiffResourceProvider } from './multi-diff-resource';

@Domain(BrowserEditorContribution)
export class MultiDiffEditorContribution implements BrowserEditorContribution {
  @Autowired()
  private resourceService: ResourceService;

  @Autowired()
  multiDiffResourceProvider: MultiDiffResourceProvider;

  registerResource(resourceService: ResourceService): void {
    resourceService.registerResourceProvider(this.multiDiffResourceProvider);
  }

  registerEditorComponent(registry: EditorComponentRegistry) {
    registry.registerEditorComponentResolver(MULTI_DIFF_SCHEME, (resource, results) => {
      results.push({
        type: EditorOpenType.multiDiff,
      });
    });
  }
}
