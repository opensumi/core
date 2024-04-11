import { Injectable } from '@opensumi/di';

import { BasePromptManager } from './base-prompt-manager';

@Injectable()
export class RenamePromptManager extends BasePromptManager {
  requestPrompt(varName: string) {
    const prompt = `please rename this variable: \`\`\`\n${varName}\n\`\`\`, put all the possible names in a code block line by line.`;
    return prompt;
  }

  extractResponse(data: string) {
    const codeBlock = /```([\s\S]*?)```/g;
    const result = data.match(codeBlock);

    if (!result) {
      return [];
    }

    const lines = result[0].replace(/```/g, '').trim().split('\n');
    return lines;
  }
}
