import { Autowired, Injectable } from '@opensumi/di';
import { WorkbenchEditorService } from '@opensumi/ide-editor/lib/common/editor';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { AttachFileContext, SerializedContext } from '../llm-context';

export const ChatAgentPromptProvider = Symbol('ChatAgentPromptProvider');

export interface ChatAgentPromptProvider {
  /**
   * 提供上下文提示
   * @param context 上下文
   */
  provideContextPrompt(context: SerializedContext, userMessage: string): Promise<string>;
}

@Injectable()
export class DefaultChatAgentPromptProvider implements ChatAgentPromptProvider {
  @Autowired(WorkbenchEditorService)
  protected readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(IWorkspaceService)
  protected readonly workspaceService: IWorkspaceService;

  async provideContextPrompt(context: SerializedContext, userMessage: string) {
    let currentFileInfo = await this.getCurrentFileInfo();
    if (context.attachedFiles.some((file) => file.path === currentFileInfo?.path)) {
      currentFileInfo = null;
    }

    return this.buildPromptTemplate({
      attachedFiles: context.attachedFiles,
      attachedFolders: context.attachedFolders,
      currentFile: currentFileInfo,
      attachedRules: context.attachedRules,
      userMessage,
    });
  }

  private async getCurrentFileInfo() {
    const editor = this.workbenchEditorService.currentEditor;
    const currentModel = editor?.currentDocumentModel;

    if (!currentModel?.uri) {
      return null;
    }

    const currentPath =
      (await this.workspaceService.asRelativePath(currentModel.uri))?.path || currentModel.uri.codeUri.fsPath;

    // 获取当前选中行信息
    const selection = editor?.monacoEditor?.getSelection();
    const currentLine = selection ? selection.startLineNumber : undefined;
    let lineContent = '';

    if (currentLine && currentModel) {
      const lineText = currentModel.getText().split('\n')[currentLine - 1];
      lineContent = lineText?.trim() || '';
    }

    return {
      path: currentPath,
      languageId: currentModel.languageId,
      content: currentModel.getText(),
      currentLine,
      lineContent,
    };
  }

  private async buildPromptTemplate({
    attachedFiles,
    attachedFolders,
    currentFile,
    attachedRules,
    userMessage,
  }: {
    attachedFiles: AttachFileContext[];
    attachedFolders: string[];
    currentFile: {
      path: string;
      languageId: string;
      content: string;
      currentLine?: number;
      lineContent?: string;
    } | null;
    attachedRules: string[];
    userMessage: string;
  }) {
    const sections = [
      ...attachedFolders,
      '<additional_data>',
      'Below are some potentially helpful/relevant pieces of information for figuring out to respond',
      this.buildCurrentFileSection(currentFile),
      this.buildAttachedFilesSection(attachedFiles),
      ...attachedRules,
      '</additional_data>',
      '<user_query>',
      userMessage,
      '</user_query>',
    ].filter(Boolean);

    return sections.join('\n');
  }

  private buildAttachedFilesSection(files: AttachFileContext[]): string {
    if (!files.length) {
      return '';
    }

    const fileContents = files
      .map((file) => {
        const sections = [
          this.buildFileContentSection(file),
          file.lineErrors.length ? this.buildLineErrorsSection(file.lineErrors) : '',
        ].filter(Boolean);

        return sections.join('\n');
      })
      .filter(Boolean)
      .join('\n');

    return `<attached_files>\n${fileContents}\n</attached_files>`;
  }

  private buildFileContentSection(file: AttachFileContext): string {
    return `<file_contents>
\`\`\`${file.path}${file.selection ? `, lines: ${file.selection?.[0]}-${file.selection?.[1]}` : ''}
${file.content}
\`\`\`
</file_contents>`;
  }

  private buildLineErrorsSection(errors: string[]): string {
    if (!errors.length) {
      return '';
    }

    return `<linter_errors>\n${errors.join('\n')}\n</linter_errors>`;
  }

  private buildCurrentFileSection(
    fileInfo: { path: string; languageId: string; content: string; currentLine?: number; lineContent?: string } | null,
  ): string {
    if (!fileInfo) {
      return '';
    }

    let currentFileSection = `<current_file>\nPath: ${fileInfo.path}`;

    if (fileInfo.currentLine && fileInfo.lineContent) {
      currentFileSection += `\nCurrently selected line: ${fileInfo.currentLine}`;
      currentFileSection += `\nLine ${fileInfo.currentLine} content: \`${fileInfo.lineContent}\``;
    }

    currentFileSection += '\n</current_file>';

    return currentFileSection;
  }
}
