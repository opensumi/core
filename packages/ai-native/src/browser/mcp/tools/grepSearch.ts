import { z } from 'zod';

import { Autowired } from '@opensumi/di';
import { CancellationToken, Deferred, Domain } from '@opensumi/ide-core-common';
import { ContentSearchResult, IContentSearchClientService } from '@opensumi/ide-search';
import { ContentSearchClientService } from '@opensumi/ide-search/lib/browser/search.service';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IChatInternalService } from '../../../common';
import { ChatInternalService } from '../../chat/chat.internal.service';
import { IMCPServerRegistry, MCPLogger, MCPServerContribution, MCPToolDefinition } from '../../types';

import { GrepSearchToolComponent } from './components/ExpandableFileList';

const inputSchema = z.object({
  query: z.string().describe('The regex pattern to search for'),
  case_sensitive: z.boolean().optional().describe('Whether the search should be case sensitive'),
  include_pattern: z
    .string()
    .optional()
    .describe('Glob pattern for files to include (e.g. "*.ts" for TypeScript files)'),
  exclude_pattern: z.string().optional().describe('Glob pattern for files to exclude'),
  explanation: z
    .string()
    .optional()
    .describe('One sentence explanation as to why this tool is being used, and how it contributes to the goal.'),
});

const MAX_RESULTS = 50;

@Domain(MCPServerContribution)
export class GrepSearchTool implements MCPServerContribution {
  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(IContentSearchClientService)
  private readonly searchService: ContentSearchClientService;

  @Autowired(IChatInternalService)
  private readonly chatInternalService: ChatInternalService;

  registerMCPServer(registry: IMCPServerRegistry): void {
    registry.registerMCPTool(this.getToolDefinition());
    registry.registerToolComponent('grep_search', GrepSearchToolComponent);
  }

  getToolDefinition(): MCPToolDefinition {
    return {
      name: 'grep_search',
      label: 'Search Contents',
      description:
        // TODO: 支持语义化搜索后需要描述清楚优劣势
        'Fast text-based regex search that finds exact pattern matches within files or directories, utilizing the ripgrep command for efficient searching.\nResults will be formatted in the style of ripgrep and can be configured to include line numbers and content.\nTo avoid overwhelming output, the results are capped at 50 matches.\nUse the include or exclude patterns to filter the search scope by file type or specific paths.\n\nThis is best for finding exact text matches or regex patterns.',
      inputSchema,
      handler: this.handler.bind(this),
    };
  }

  private async handler(args: z.infer<typeof inputSchema> & { toolCallId: string }, logger: MCPLogger) {
    if (!args.query) {
      throw new Error('No ripgrep search parameters provided. Need to give at least a query.');
    }
    // 获取工作区根目录
    const workspaceRoots = this.workspaceService.tryGetRoots();
    if (!workspaceRoots || workspaceRoots.length === 0) {
      throw new Error('Cannot determine project directory');
    }

    // 使用 OpenSumi 的文件搜索 API
    const searchPattern = args.query;
    await this.searchService.doSearch(
      searchPattern,
      {
        isMatchCase: !!args.case_sensitive,
        include: args.include_pattern?.split(','),
        exclude: args.exclude_pattern?.split(','),
        maxResults: MAX_RESULTS,
        isUseRegexp: true,
        isToggleOpen: false,
        isDetailOpen: false,
        isWholeWord: false,
        isOnlyOpenEditors: false,
        isIncludeIgnored: false,
      },
      CancellationToken.None,
    );
    const deferred = new Deferred<string>();
    this.searchService.onDidChange(() => {
      if (this.searchService.isSearching) {
        return;
      }
      const results: string[] = [];
      const files: Array<{ uri: string; isDirectory: boolean }> = [];
      for (const [fileUri, result] of this.searchService.searchResults.entries()) {
        results.push(
          `File: ${fileUri}\n${result
            .reduce((acc, r) => {
              if (acc.find((a) => a.line === r.line)) {
                return acc;
              }
              return [...acc, r];
            }, [] as ContentSearchResult[])
            .map((r) => `Line: ${r.line}\nContent: ${r.lineText || r.renderLineText}`)
            .join('\n')}`,
        );
        files.push({
          uri: fileUri,
          isDirectory: false, // grep 搜索结果都是文件
        });
      }
      deferred.resolve(results.join('\n\n'));
      const messages = this.chatInternalService.sessionModel.history.getMessages();
      this.chatInternalService.sessionModel.history.setMessageAdditional(messages[messages.length - 1].id, {
        [args.toolCallId]: {
          files,
        },
      });
    });
    const text = await deferred.promise;
    return {
      content: [{ type: 'text', text }],
    };
  }
}
