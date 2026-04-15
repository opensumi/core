import { Injectable } from '@opensumi/di';

import { AttachFileContext, SerializedContext } from '../llm-context';

import { DefaultChatAgentPromptProvider } from './context-prompt-provider';

/**
 * 用于 acp agent，无 XML 标签的 prompt 格式
 * 当没有任何上下文时直接返回 userMessage
 */
@Injectable()
export class ACPChatAgentPromptProvider extends DefaultChatAgentPromptProvider {
  async provideContextPrompt(context: SerializedContext, userMessage: string): Promise<string> {
    const hasContextFields =
      context.globalRules.length > 0 ||
      context.attachedFolders.length > 0 ||
      context.attachedFiles.length > 0 ||
      context.attachedRules.length > 0;

    if (!hasContextFields) {
      const currentFileInfo = await this.getACPCurrentFileInfo();
      const hasCurrentFile =
        currentFileInfo && !context.attachedFiles.some((file) => file.path === currentFileInfo.path);
      if (!hasCurrentFile) {
        return userMessage;
      }
    }

    return this.buildACPPrompt(context, userMessage);
  }

  private async getACPCurrentFileInfo() {
    const editor = this.workbenchEditorService.currentEditor;
    const currentModel = editor?.currentDocumentModel;

    if (!currentModel?.uri) {
      return null;
    }

    const currentPath =
      (await this.workspaceService.asRelativePath(currentModel.uri))?.path || currentModel.uri.codeUri.fsPath;

    const selection = editor?.monacoEditor?.getSelection();
    const currentLine = selection ? selection.startLineNumber : undefined;
    let lineContent = '';

    if (currentLine && editor?.monacoEditor) {
      const model = editor.monacoEditor.getModel();
      if (model) {
        lineContent = model.getLineContent(currentLine)?.trim() || '';
      }
    }

    return { path: currentPath, currentLine, lineContent };
  }

  private async buildACPPrompt(context: SerializedContext, userMessage: string): Promise<string> {
    const sections: string[] = [];

    if (context.globalRules.length > 0) {
      sections.push(this.stripXmlTags(context.globalRules.join('\n')));
    }

    if (context.attachedFolders.length > 0) {
      sections.push(context.attachedFolders.join('\n'));
    }

    let currentFileInfo = await this.getACPCurrentFileInfo();
    if (currentFileInfo && context.attachedFiles.some((file) => file.path === currentFileInfo!.path)) {
      currentFileInfo = null;
    }
    if (currentFileInfo) {
      let currentFileSection = `Current file: ${currentFileInfo.path}`;
      if (currentFileInfo.currentLine && currentFileInfo.lineContent) {
        currentFileSection += ` (line ${currentFileInfo.currentLine}: \`${currentFileInfo.lineContent}\`)`;
      }
      sections.push(currentFileSection);
    }

    if (context.attachedFiles.length > 0) {
      const filesSections = context.attachedFiles.map((file) => this.buildACPFileSection(file));
      sections.push(filesSections.join('\n\n'));
    }

    if (context.attachedRules.length > 0) {
      sections.push(this.stripXmlTags(context.attachedRules.join('\n')));
    }

    sections.push('---');
    sections.push(userMessage);

    return sections.join('\n\n');
  }

  private buildACPFileSection(file: AttachFileContext): string {
    const header = file.selection
      ? `\`\`\`${file.path}, lines: ${file.selection[0]}-${file.selection[1]}`
      : `\`\`\`${file.path}`;
    const parts = [header, file.content, '```'];
    if (file.lineErrors.length > 0) {
      parts.push(`Errors: ${file.lineErrors.join(', ')}`);
    }
    return parts.join('\n');
  }

  private stripXmlTags(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
