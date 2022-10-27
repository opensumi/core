import { Injectable, Autowired } from '@opensumi/di';
import { LifeCyclePhase } from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';
import { MonacoSnippetSuggestProvider } from '@opensumi/ide-monaco/lib/browser/monaco-snippet-suggest-provider';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';
import { AbstractExtInstanceManagementService } from '../../types';

export interface SnippetContribution {
  path: string;
  source: string;
  language?: string;
}
export type SnippetSchema = Array<SnippetContribution>;

@Injectable()
@Contributes('snippets')
@LifeCycle(LifeCyclePhase.Ready)
export class SnippetsContributionPoint extends VSCodeContributePoint<SnippetSchema> {
  @Autowired(MonacoSnippetSuggestProvider)
  protected readonly snippetSuggestProvider: MonacoSnippetSuggestProvider;

  @Autowired(AbstractExtInstanceManagementService)
  protected readonly extensionManageService: AbstractExtInstanceManagementService;

  contribute() {
    for (const contrib of this.contributesMap) {
      const { extensionId, contributes } = contrib;
      const extension = this.extensionManageService.getExtensionInstanceByExtId(extensionId);
      if (!extension) {
        continue;
      }
      for (const snippet of contributes) {
        this.addDispose(
          this.snippetSuggestProvider.fromPath(snippet.path, {
            extPath: extension.path,
            language: snippet.language,
            source: extension.packageJSON.name,
          }),
        );
      }
    }
  }
}
