import { Event, URI } from '@opensumi/ide-core-common/lib/utils';

export interface LLMContextService {
  startAutoCollection(): void;

  stopAutoCollection(): void;

  /**
   * 添加文件到 context 中
   */
  addFileToContext(uri: URI, selection?: [number, number], isManual?: boolean): void;

  /**
   * 清除上下文
   */
  cleanFileContext(): void;

  onDidContextFilesChangeEvent: Event<FileContext[]>;

  /**
   * 从 context 中移除文件
   * @param uri URI
   */
  removeFileFromContext(uri: URI): void;

  /** 导出为可序列化格式 */
  serialize(): SerializedContext;
}

export interface FileContext {
  uri: URI;
  selection?: [number, number];
  isManual: boolean;
}

export const LLMContextServiceToken = Symbol('LLMContextService');

export interface SerializedContext {
  recentlyViewFiles: string[];
  attachedFiles: Array<{ content: string; lineErrors: string[]; path: string; language: string }>;
}

/**
 * 拼接上下文
 * @param context
 * @param msg
 * @returns
 */
export function formatUerPrompt(context: SerializedContext, msg: string): string {
  return `
<additional_data>
Below are some potentially helpful/relevant pieces of information for figuring out to respond
<recently_viewed_files>
${context.recentlyViewFiles.map((file, idx) => (
    `${idx} + 1: ${file}`
  ))}
</recently_viewed_files>
<attached_files>
${context.attachedFiles.map((file) => (
    `
<file_contents>
\`\`\`${file.language} ${file.path}
${file.content}
\`\`\`
</file_contents>
<linter_errors>
${file.lineErrors.join('`n')}
</linter_errors>
`
  ))}

</attached_files>
</additional_data>
<user_query>
${msg}
</user_query>`;

}
