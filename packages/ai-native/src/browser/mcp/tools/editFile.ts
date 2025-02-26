import { z } from 'zod';

import { Autowired } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';

import { IMCPServerRegistry, MCPLogger, MCPServerContribution, MCPToolDefinition } from '../../types';

import { EditFileToolComponent } from './components/EditFile';
import { EditFileHandler } from './handlers/EditFile';
const inputSchema = z
  .object({
    target_file: z
      .string()
      .describe(
        'The target file to modify. Always specify the target file as the first argument and use the relative path in the workspace of the file to edit',
      ),
    instructions: z
      .string()
      .optional()
      .describe(
        'A single sentence instruction describing what you are going to do for the sketched edit. This is used to assist the less intelligent model in applying the edit. Please use the first person to describe what you are going to do. Dont repeat what you have said previously in normal messages. And use it to disambiguate uncertainty in the edit.',
      ),
    code_edit: z
      .string()
      .describe(
        "Specify ONLY the precise lines of code that you wish to edit. **NEVER specify or write out unchanged code**. Instead, represent all unchanged code using the comment of the language you're editing in - example: `// ... existing code ...`",
      ),
  })
  .transform((data) => ({
    targetFile: data.target_file,
    instructions: data.instructions,
    codeEdit: data.code_edit,
  }));

@Domain(MCPServerContribution)
export class EditFileTool implements MCPServerContribution {
  @Autowired(EditFileHandler)
  private readonly editFileHandler: EditFileHandler;

  registerMCPServer(registry: IMCPServerRegistry): void {
    registry.registerMCPTool(this.getToolDefinition());
    registry.registerToolComponent('edit_file', EditFileToolComponent);
  }

  getToolDefinition(): MCPToolDefinition {
    return {
      name: 'edit_file',
      label: 'Edit File',
      description: `Use this tool to propose an edit to an existing file.
This will be read by a less intelligent model, which will quickly apply the edit. You should make it clear what the edit is, while also minimizing the unchanged code you write.
When writing the edit, you should specify each edit in sequence, with the special comment \`// ... existing code ...\` to represent unchanged code in between edited lines.
For example:
\`\`\`
// ... existing code ...
FIRST_EDIT
// ... existing code ...
SECOND_EDIT
// ... existing code ...
THIRD_EDIT
// ... existing code ...
\`\`\`
You should bias towards repeating as few lines of the original file as possible to convey the change.
But, each edit should contain sufficient context of unchanged lines around the code you're editing to resolve ambiguity.
DO NOT omit spans of pre-existing code without using the \`// ... existing code ...\` comment to indicate its absence.
Make sure it is clear what the edit should be.
You should specify the following arguments before the others: [target_file]`,
      inputSchema,
      handler: this.handler.bind(this),
    };
  }

  private async handler(args: z.infer<typeof inputSchema> & { toolCallId: string }, logger: MCPLogger) {
    const result = await this.editFileHandler.handler(args, args.toolCallId);
    return {
      content: [
        {
          type: 'text',
          // TODO: lint error
          text: result.applyResult
            ? `The apply model made the following changes to the file:

\`\`\`
${result.applyResult.diff}
\`\`\`
${
  result.applyResult.diagnosticInfos.length > 0
    ? `The edit introduced the following new linter errors:
${result.applyResult.diagnosticInfos
  .map((error) => `Line ${error.startLineNumber}: ${error.message.split('\n')[0]}`)
  .join('\n')}

Please fix the linter errors if it is clear how to (or you can easily figure out how to). Do not make uneducated guesses. And do not loop more than 3 times on fixing linter errors on the same file.`
    : ''
}`
            : 'User cancelled the edit.',
        },
      ],
    };
  }
}
