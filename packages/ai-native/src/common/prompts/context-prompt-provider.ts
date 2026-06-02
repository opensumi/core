import { Autowired, Injectable } from '@opensumi/di';
import { ILogger } from '@opensumi/ide-core-common';
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

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  async provideContextPrompt(context: SerializedContext, userMessage: string) {
    const startTime = Date.now();
    this.logger.log(
      `[ChatAgentPromptProvider] provideContextPrompt start — userMessageChars=${userMessage.length}, attachedFiles=${context.attachedFiles.length}, attachedFolders=${context.attachedFolders.length}, attachedRules=${context.attachedRules.length}, globalRules=${context.globalRules.length}`,
    );
    let currentFileInfo = await this.getCurrentFileInfo();
    this.logger.log(
      `[ChatAgentPromptProvider] current file resolved — hasCurrentFile=${Boolean(currentFileInfo)}, elapsedMs=${
        Date.now() - startTime
      }`,
    );
    if (context.attachedFiles.some((file) => file.path === currentFileInfo?.path)) {
      currentFileInfo = null;
    }

    const prompt = await this.buildPromptTemplate({
      attachedFiles: context.attachedFiles,
      attachedFolders: context.attachedFolders,
      currentFile: currentFileInfo,
      attachedRules: context.attachedRules,
      globalRules: context.globalRules,
      userMessage,
    });
    this.logger.log(
      `[ChatAgentPromptProvider] provideContextPrompt done — promptChars=${prompt.length}, elapsedMs=${
        Date.now() - startTime
      }`,
    );
    return prompt;
  }

  private async getCurrentFileInfo() {
    const startTime = Date.now();
    const editor = this.workbenchEditorService.currentEditor;
    const currentModel = editor?.currentDocumentModel;

    if (!currentModel?.uri) {
      this.logger.log('[ChatAgentPromptProvider] getCurrentFileInfo skipped — no current model');
      return null;
    }

    const currentPath =
      (await this.workspaceService.asRelativePath(currentModel.uri))?.path || currentModel.uri.codeUri.fsPath;
    this.logger.log(
      `[ChatAgentPromptProvider] getCurrentFileInfo path resolved — path=${currentPath}, elapsedMs=${
        Date.now() - startTime
      }`,
    );

    // 获取当前选中行信息
    const selection = editor?.monacoEditor?.getSelection();
    const currentLine = selection ? selection.startLineNumber : undefined;
    let lineContent = '';

    if (currentLine && editor?.monacoEditor) {
      const model = editor.monacoEditor.getModel();
      if (model) {
        lineContent = model.getLineContent(currentLine)?.trim() || '';
      }
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
    globalRules,
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
    globalRules: string[];
    userMessage: string;
  }) {
    const sections = [
      ...globalRules,
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
