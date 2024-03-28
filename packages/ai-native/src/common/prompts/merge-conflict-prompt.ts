import { Injectable } from '@opensumi/di';
import { IConflictContentMetadata } from '@opensumi/ide-core-common';

import { BasePromptManager } from './base-prompt-manager';

@Injectable()
export class MergeConflictPromptManager extends BasePromptManager {
  private toPrompt(text: string) {
    return `You are an intelligent expert in resolving code conflicts. I've encountered a code conflict, and I need you to carefully consider it and provide me with the most suitable solution after understanding the code semantics. Here is the conflicting part of the code: \n\`\`\`\n${text}\n\`\`\`\n`;
  }

  private toRegeneratePrompt(text: string) {
    return `The current solution to the code conflict is \n\`\`\`\n${text}\n\`\`\`\n, but I'm not fully satisfied with it. Could you please provide an alternative solution?`;
  }

  public toThreeWayCodeAssemble(metadata: IConflictContentMetadata) {
    return `<<<<<<< HEAD\n${metadata.current}\n||||||| base\n${metadata.base}\n>>>>>>>\n${metadata.incoming}`;
  }

  public convertDefaultThreeWayPrompt(metadata: IConflictContentMetadata) {
    const codeAssemble = this.toThreeWayCodeAssemble(metadata);
    return this.toPrompt(codeAssemble);
  }

  public convertDefaultThreeWayRegeneratePrompt(metadata: IConflictContentMetadata) {
    const codeAssemble = this.toThreeWayCodeAssemble(metadata);
    return this.toRegeneratePrompt(codeAssemble);
  }
}
