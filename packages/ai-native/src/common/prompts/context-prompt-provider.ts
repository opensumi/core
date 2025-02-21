import { Injectable } from '@opensumi/di';
import { MaybePromise } from '@opensumi/ide-core-common/lib/utils';

import { SerializedContext } from '../llm-context';

export const ChatAgentPromptProvider = Symbol('ChatAgentPromptProvider');

export interface ChatAgentPromptProvider {
  /**
   * 提供上下文提示
   * @param context 上下文
   */
  provideContextPrompt(context: SerializedContext, userMessage: string): MaybePromise<string>;
}

@Injectable()
export class DefaultChatAgentPromptProvider implements ChatAgentPromptProvider {
  provideContextPrompt(context: SerializedContext, userMessage: string): MaybePromise<string> {
    return `
          <additional_data>
          Below are some potentially helpful/relevant pieces of information for figuring out to respond
          <recently_viewed_files>
          ${context.recentlyViewFiles.map((file, idx) => `${idx} + 1: ${file}`)}
          </recently_viewed_files>
          <attached_files>
          ${context.attachedFiles.map(
            (file) =>
              `
          <file_contents>
          \`\`\`${file.language} ${file.path}
          ${file.content}
          \`\`\`
          </file_contents>
          <linter_errors>
          ${file.lineErrors.join('`n')}
          </linter_errors>
          `,
          )}
          
          </attached_files>
          </additional_data>
          <user_query>
          ${userMessage}
          </user_query>`;
  }
}
