import { Injectable, Autowired } from '@opensumi/di';
import { MonacoSnippetSuggestProvider } from '@opensumi/ide-monaco/lib/browser/monaco-snippet-suggest-provider';

import { VSCodeContributePoint, Contributes } from '../../../common';

export interface SnippetContribution {
  path: string;
  source: string;
  language?: string;
}
export type SnippetSchema = Array<SnippetContribution>;

@Injectable()
@Contributes('snippets')
export class SnippetsContributionPoint extends VSCodeContributePoint<SnippetSchema> {
  @Autowired(MonacoSnippetSuggestProvider)
  protected readonly snippetSuggestProvider: MonacoSnippetSuggestProvider;

  contribute() {
    for (const snippet of this.json) {
      this.addDispose(
        this.snippetSuggestProvider.fromPath(snippet.path, {
          extPath: this.extension.path,
          language: snippet.language,
          source: this.extension.packageJSON.name,
        }),
      );
    }
  }
}
