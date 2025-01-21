import * as path from 'path';

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { Autowired, Injectable } from '@opensumi/di';
import { URI } from '@opensumi/ide-core-common';
import { IFileSearchService } from '@opensumi/ide-file-search/lib/common';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { Logger, ToolDefinition } from '../types';

const inputSchema = z.object({
    nameSubstring: z.string().describe('The substring to search for in file names'),
});

@Injectable()
export class FindFilesByNameSubstringTool {
    @Autowired(IWorkspaceService)
    private readonly workspaceService: IWorkspaceService;

    @Autowired(IFileSearchService)
    private readonly fileSearchService: IFileSearchService;

    getToolDefinition(): ToolDefinition {
        return {
            name: 'find_files_by_name_substring',
            description: 'Searches for all files in the project whose names contain the specified substring (case-insensitive). ' +
                'Use this tool to locate files when you know part of the filename. ' +
                'Requires a nameSubstring parameter for the search term. ' +
                'Returns a JSON array of objects containing file information: ' +
                '- path: Path relative to project root ' +
                '- name: File name ' +
                'Returns an empty array ([]) if no matching files are found. ' +
                'Note: Only searches through files within the project directory, excluding libraries and external dependencies.',
            inputSchema: zodToJsonSchema(inputSchema),
            handler: this.handler.bind(this),
        };
    }

    private async handler(args: z.infer<typeof inputSchema>, logger: Logger) {
        try {
            // 获取工作区根目录
            const workspaceRoots = this.workspaceService.tryGetRoots();
            if (!workspaceRoots || workspaceRoots.length === 0) {
                logger.appendLine('Error: Cannot determine project directory');
                return {
                    content: [{ type: 'text', text: '[]' }],
                    isError: true,
                };
            }

            // 使用 OpenSumi 的文件搜索 API
            const searchPattern = `**/*${args.nameSubstring}*`;
            const searchResults = await this.fileSearchService.find(
                searchPattern,
                {
                    rootUris: [workspaceRoots[0].uri],
                    excludePatterns: ['**/node_modules/**'],
                    limit: 1000,
                },
            );

            // 转换结果为所需的格式
            const results = searchResults.map((file) => {
                const uri = URI.parse(file);
                const rootUri = URI.parse(workspaceRoots[0].uri);
                const relativePath = path.relative(rootUri.codeUri.fsPath, uri.codeUri.fsPath);
                const fileName = path.basename(uri.codeUri.fsPath);
                return {
                    path: relativePath,
                    name: fileName,
                };
            });

            // 将结果转换为 JSON 字符串
            const resultJson = JSON.stringify(results, null, 2);
            logger.appendLine(`Found ${results.length} files matching "${args.nameSubstring}"`);

            return {
                content: [{ type: 'text', text: resultJson }],
            };
        } catch (error) {
            logger.appendLine(`Error during file search: ${error}`);
            return {
                content: [{ type: 'text', text: '[]' }],
                isError: true,
            };
        }
    }
}
