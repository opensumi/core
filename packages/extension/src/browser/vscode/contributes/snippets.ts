import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { LifeCyclePhase } from '@opensumi/ide-core-common';
import { FileServiceClientToken, IFileServiceClientService } from '@opensumi/ide-file-service';
import { MonacoSnippetSuggestProvider } from '@opensumi/ide-monaco/lib/browser/monaco-snippet-suggest-provider';

import { Contributes, LifeCycle, VSCodeContributePoint } from '../../../common';
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
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(FileServiceClientToken)
  protected readonly filesystem: IFileServiceClientService;

  @Autowired(AbstractExtInstanceManagementService)
  protected readonly extensionManageService: AbstractExtInstanceManagementService;

  contribute() {
    const snippetSuggestProvider = this.injector.get(MonacoSnippetSuggestProvider, [this.filesystem]);
    for (const contrib of this.contributesMap) {
      const { extensionId, contributes } = contrib;
      const extension = this.extensionManageService.getExtensionInstanceByExtId(extensionId);
      if (!extension) {
        continue;
      }
      for (const snippet of contributes) {
        this.addDispose(
          snippetSuggestProvider.fromPath(snippet.path, {
            extPath: extension.path,
            language: snippet.language,
            source: extension.packageJSON.name,
          }),
        );
      }
    }
    this.addDispose(snippetSuggestProvider.registerSnippetsProvider());
  }
}
