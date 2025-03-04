import { z } from 'zod';

import { Autowired } from '@opensumi/di';
import { getValidateInput } from '@opensumi/ide-addons/lib/browser/file-search.contribution';
import { Domain, URI } from '@opensumi/ide-core-common';
import { FileSearchServicePath, IFileSearchService } from '@opensumi/ide-file-search/lib/common';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IChatInternalService } from '../../../common';
import { ChatInternalService } from '../../chat/chat.internal.service';
import { IMCPServerRegistry, MCPLogger, MCPServerContribution, MCPToolDefinition } from '../../types';

import { FileSearchToolComponent } from './components/ExpandableFileList';

const inputSchema = z.object({
  query: z.string().describe('Fuzzy filename to search for'),
  explanation: z
    .string()
    .describe('One sentence explanation as to why this tool is being used, and how it contributes to the goal.'),
});

const MAX_RESULTS = 10;

@Domain(MCPServerContribution)
export class FileSearchTool implements MCPServerContribution {
  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(FileSearchServicePath)
  private readonly fileSearchService: IFileSearchService;

  @Autowired(IChatInternalService)
  private readonly chatInternalService: ChatInternalService;

  registerMCPServer(registry: IMCPServerRegistry): void {
    registry.registerMCPTool(this.getToolDefinition());
    registry.registerToolComponent('file_search', FileSearchToolComponent);
  }

  getToolDefinition(): MCPToolDefinition {
    return {
      name: 'file_search',
      label: 'Search Files',
      description:
        "Fast file search based on fuzzy matching against file path. Use if you know part of the file path but don't know where it's located exactly. Response will be capped to 10 results. Make your query more specific if need to filter results further.",
      inputSchema,
      handler: this.handler.bind(this),
    };
  }

  private async handler(args: z.infer<typeof inputSchema> & { toolCallId: string }, logger: MCPLogger) {
    if (!args.query) {
      throw new Error('No fileSearch parameters provided. Need to give a query.');
    }
    // 获取工作区根目录
    const workspaceRoots = this.workspaceService.tryGetRoots();
    if (!workspaceRoots || workspaceRoots.length === 0) {
      throw new Error('Cannot determine project directory');
    }

    // 使用 OpenSumi 的文件搜索 API
    const searchPattern = this.normalizeQuery(args.query);
    const searchResults = await this.fileSearchService.find(searchPattern, {
      rootUris: [new URI(workspaceRoots[0].uri).codeUri.fsPath],
      // TODO: 忽略配置
      excludePatterns: ['**/node_modules/**'],
      limit: 100,
      useGitIgnore: true,
      noIgnoreParent: true,
      fuzzyMatch: true,
    });

    const files = searchResults.slice(0, MAX_RESULTS).map((file) => {
      const uri = URI.parse(file);
      return {
        uri: uri.codeUri.fsPath,
        isDirectory: false, // 文件搜索结果都是文件
      };
    });

    const messages = this.chatInternalService.sessionModel.history.getMessages();
    this.chatInternalService.sessionModel.history.setMessageAdditional(messages[messages.length - 1].id, {
      [args.toolCallId]: {
        files,
      },
    });

    logger.appendLine(`Found ${files.length} files matching "${args.query}"`);

    return {
      content: [
        {
          type: 'text',
          text: `${files.map((f) => f.uri).join('\n')}\n${
            searchResults.length > MAX_RESULTS
              ? `\nFound ${searchResults.length} files matching "${args.query}", only return the first ${MAX_RESULTS} results`
              : ''
          }`,
        },
      ],
    };
  }

  private normalizeQuery(query: string): string {
    const nonBlank = query.trim().replace(/\s/g, '');
    const validated = getValidateInput(nonBlank);
    return validated;
  }
}
