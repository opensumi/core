import { Injectable } from '@opensumi/di';

import { BasePromptManager } from './base-prompt-manager';

@Injectable()
export class TerminalDetectionPromptManager extends BasePromptManager {
  public generateBasePrompt(text: string): string {
    const prompt = `When developing in the IDE, the terminal outputs some error messages. There may be multiple errors, and you need to provide a solution for each error. The error message is as follows: \`\`\`\n${text}\n\`\`\``;
    return prompt;
  }

  public generateTsPrompt(text: string) {
    return `When developing in the IDE, the terminal outputs some error messages. There may be multiple errors, and you need to provide a solution for each error. The error message is as follows: \`\`\`\n${text}\n\`\`\``;
  }

  public pickFileInfo(text: string) {
    const fileReg = /(?<path>[\w\/]+\.tsx?):(?<row>\d+):(?<col>\d+)/;
    const match = fileReg.exec(text);
    return match ? (match.groups as { path: string; row: string; col: string }) : undefined;
  }

  public generateShellPrompt(stdout: string, stdin: string) {
    const inputPrompt = `Please provide a specific solution based on my input information: Input information: ${stdin}, `;
    const prompt = `An error occurred when entering commands in the terminal, ${
      stdin ? inputPrompt : 'please provide a possible solution'
    }, Error message: \`\`\`\n${stdout}\n\`\`\` `;

    return prompt;
  }

  public generateJavaPrompt(text: string) {
    const errorTextArray = text.split('\n');
    // Cut off 10 lines of stack information, too much will cause the token to exceed the limit
    const errorText = errorTextArray.slice(0, 10).join('\n');
    const prompt = `The Java application has generated some errors during operation. Please provide a possible solution based on the error message. The error message is as follows: \`\`\`\n${errorText}\n\`\`\` `;

    return prompt;
  }
}
