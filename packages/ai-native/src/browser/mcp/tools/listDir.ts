import { z } from 'zod';

import { Autowired } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';

import { IChatInternalService } from '../../../common';
import { ChatInternalService } from '../../chat/chat.internal.service';
import { IMCPServerRegistry, MCPLogger, MCPServerContribution, MCPToolDefinition } from '../../types';

import { ListDirToolComponent } from './components/ExpandableFileList';
import { ListDirHandler } from './handlers/ListDir';

const inputSchema = z
  .object({
    relative_workspace_path: z
      .string()
      .describe("Path to list contents of, relative to the workspace root. Ex: './' is the root of the workspace"),
    explanation: z
      .string()
      .optional()
      .describe('One sentence explanation as to why this tool is being used, and how it contributes to the goal.'),
  })
  .transform((data) => ({
    relativeWorkspacePath: data.relative_workspace_path,
  }));

@Domain(MCPServerContribution)
export class ListDirTool implements MCPServerContribution {
  @Autowired(ListDirHandler)
  private readonly listDirHandler: ListDirHandler;

  @Autowired(IChatInternalService)
  private readonly chatInternalService: ChatInternalService;

  registerMCPServer(registry: IMCPServerRegistry): void {
    registry.registerMCPTool(this.getToolDefinition());
    registry.registerToolComponent('list_dir', ListDirToolComponent);
  }

  getToolDefinition(): MCPToolDefinition {
    return {
      name: 'list_dir',
      label: 'List Directory',
      description:
        'List the contents of a directory. The quick tool to use for discovery, before using more targeted tools like semantic search or file reading. Useful to try to understand the file structure before diving deeper into specific files. Can be used to explore the codebase.',
      inputSchema,
      handler: this.handler.bind(this),
    };
  }

  private async handler(args: z.infer<typeof inputSchema> & { toolCallId: string }, logger: MCPLogger) {
    const result = await this.listDirHandler.handler(args);

    // 构建文件 URI 列表，用于前端渲染
    const fileUris = result.files.map((file) => {
      const filePath = `${this.listDirHandler.getWorkspaceDir()}/${result.directoryRelativeWorkspacePath}/${file.name}`;
      return {
        uri: filePath,
        isDirectory: file.isDirectory,
      };
    });

    // 设置消息的附加数据
    const messages = this.chatInternalService.sessionModel.history.getMessages();
    this.chatInternalService.sessionModel.history.setMessageAdditional(messages[messages.length - 1].id, {
      [args.toolCallId]: {
        files: fileUris,
        title: `Listed directory "${args.relativeWorkspacePath}"`,
        details: result.files.map((file) => ({
          type: file.isDirectory ? 'dir' : 'file',
          name: file.name,
          info: file.isDirectory ? `${file.numChildren ?? '?'} items` : `${file.size}KB, ${file.numLines} lines`,
          lastModified: file.lastModified,
        })),
      },
    });

    logger.appendLine(`Listed ${fileUris.length} files in directory "${args.relativeWorkspacePath}"`);

    return {
      content: [
        {
          type: 'text',
          text: `Contents of directory "${args.relativeWorkspacePath}":\n${result.files
            .map(
              (file) =>
                `[${file.isDirectory ? 'dir' : 'file'}] ${file.name} ${
                  file.isDirectory ? `(${file.numChildren ?? '?'} items)` : `(${file.size}KB, ${file.numLines} lines)`
                } - ${new Date(file.lastModified).toLocaleString()}`,
            )
            .join('\n')}`,
        },
      ],
    };
  }
}
