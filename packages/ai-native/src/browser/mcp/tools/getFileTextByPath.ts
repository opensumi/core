import * as path from 'path';

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { Autowired, Injectable } from '@opensumi/di';
import { URI } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { Logger, ToolDefinition } from '../types';

const inputSchema = z.object({
    pathInProject: z.string().describe('The file location relative to project root'),
});

@Injectable()
export class GetFileTextByPathTool {
    @Autowired(IWorkspaceService)
    private readonly workspaceService: IWorkspaceService;

    @Autowired(IFileServiceClient)
    private readonly fileService: IFileServiceClient;

    getToolDefinition(): ToolDefinition {
        return {
            name: 'get_file_text_by_path',
            description: 'Retrieves the text content of a file using its path relative to project root. ' +
                'Use this tool to read file contents when you have the file\'s project-relative path. ' +
                'Requires a pathInProject parameter specifying the file location from project root. ' +
                'Returns one of these responses: ' +
                '- The file\'s content if the file exists and belongs to the project ' +
                '- error "project dir not found" if project directory cannot be determined ' +
                '- error "file not found" if the file doesn\'t exist or is outside project scope ' +
                'Note: Automatically refreshes the file system before reading',
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
                    content: [{ type: 'text', text: 'project dir not found' }],
                    isError: true,
                };
            }

            // 构建完整的文件路径
            const rootUri = URI.parse(workspaceRoots[0].uri);
            const fullPath = path.join(rootUri.codeUri.fsPath, args.pathInProject);
            const fileUri = URI.file(fullPath);

            // 检查文件是否在项目目录内
            const relativePath = path.relative(rootUri.codeUri.fsPath, fullPath);
            if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
                logger.appendLine('Error: File is outside of project scope');
                return {
                    content: [{ type: 'text', text: 'file not found' }],
                    isError: true,
                };
            }

            // 检查文件是否存在并读取内容
            try {
                const result = await this.fileService.readFile(fileUri.toString());
                const content = result.content.toString();
                logger.appendLine(`Successfully read file: ${args.pathInProject}`);

                return {
                    content: [{ type: 'text', text: content }],
                };
            } catch (error) {
                logger.appendLine('Error: File does not exist');
                return {
                    content: [{ type: 'text', text: 'file not found' }],
                    isError: true,
                };
            }
        } catch (error) {
            logger.appendLine(`Error reading file: ${error}`);
            return {
                content: [{ type: 'text', text: 'file not found' }],
                isError: true,
            };
        }
    }
} 