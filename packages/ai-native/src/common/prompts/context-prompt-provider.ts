import { Autowired, Injectable } from '@opensumi/di';
import { WorkbenchEditorService } from '@opensumi/ide-editor/lib/common/editor';

import { SerializedContext } from '../llm-context';

export const ChatAgentPromptProvider = Symbol('ChatAgentPromptProvider');

export interface ChatAgentPromptProvider {
  /**
   * 提供上下文提示
   * @param context 上下文
   */
  provideContextPrompt(context: SerializedContext, userMessage: string): string;
}

@Injectable()
export class DefaultChatAgentPromptProvider implements ChatAgentPromptProvider {
  @Autowired(WorkbenchEditorService)
  protected readonly workbenchEditorService: WorkbenchEditorService;

  provideContextPrompt(context: SerializedContext, userMessage: string): string {
    const editor = this.workbenchEditorService.currentEditor;
    const currentModel = editor?.currentDocumentModel;
    return `
<additional_data>
  Below are some potentially helpful/relevant pieces of information for figuring out to respond
  <recently_viewed_files>
${context.recentlyViewFiles.map((file, idx) => `    ${idx + 1}: ${file}`).join('\n')}
  </recently_viewed_files>
  <attached_files>
    ${context.attachedFiles.map(
      (file) =>
        `
    <file_contents>
    \`\`\`${file.path}
    ${file.content}
    \`\`\`
    </file_contents>
    <linter_errors>
    ${file.lineErrors.join('\n')}
    </linter_errors>
              `,
    )}
  </attached_files>
${currentModel ? `<current_opened_file>
  \`\`\`${currentModel.languageId} ${currentModel.uri.toString()}
${currentModel.getText()}
  \`\`\`
  </current_opened_file>` : ''}
</additional_data>
<user_query>
${userMessage}
</user_query>`;
  }
}
