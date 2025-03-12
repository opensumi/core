import { Autowired, Injectable } from '@opensumi/di';
import { WorkbenchEditorService } from '@opensumi/ide-editor/lib/common/editor';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { SerializedContext } from '../llm-context';

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
    const currentFileInfo = await this.getCurrentFileInfo();

    return this.buildPromptTemplate({
      recentFiles: this.buildRecentFilesSection(context.recentlyViewFiles),
      attachedFiles: this.buildAttachedFilesSection(context.attachedFiles),
      attachedFolders: this.buildAttachedFoldersSection(context.attachedFolders),
      currentFile: currentFileInfo,
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

    return {
      path: currentPath,
      languageId: currentModel.languageId,
      content: currentModel.getText(),
    };
  }

  private buildPromptTemplate({
    recentFiles,
    attachedFiles,
    attachedFolders,
    currentFile,
    userMessage,
  }: {
    recentFiles: string;
    attachedFiles: string;
    attachedFolders: string;
    currentFile: { path: string; languageId: string; content: string } | null;
    userMessage: string;
  }) {
    const sections = [
      '<additional_data>',
      'Below are some potentially helpful/relevant pieces of information for figuring out to respond',
      recentFiles,
      attachedFiles,
      attachedFolders,
      this.buildCurrentFileSection(currentFile),
      '</additional_data>',
      '<user_query>',
      userMessage,
      '</user_query>',
    ].filter(Boolean);

    return sections.join('\n');
  }

  private buildRecentFilesSection(files: string[]): string {
    if (!files.length) {
      return '';
    }

    return `<recently_viewed_files>
${files.map((file, idx) => `    ${idx + 1}: ${file}`).join('\n')}
</recently_viewed_files>`;
  }

  private buildAttachedFilesSection(files: { path: string; content: string; lineErrors: string[] }[]): string {
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

  private buildFileContentSection(file: { path: string; content: string }): string {
    return `<file_contents>
\`\`\`${file.path}
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

  private buildAttachedFoldersSection(folders: string[]): string {
    if (!folders.length) {
      return '';
    }

    return `<attached_folders>\n${folders.join('\n')}</attached_folders>`;
  }

  private buildCurrentFileSection(fileInfo: { path: string; languageId: string; content: string } | null): string {
    if (!fileInfo) {
      return '';
    }

    return `<current_opened_file>
\`\`\`${fileInfo.languageId} ${fileInfo.path}
${fileInfo.content}
\`\`\`
</current_opened_file>`;
  }
}
