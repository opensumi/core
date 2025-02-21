import React, { useEffect, useMemo, useState } from 'react';

import { LabelService, URI, path, useInjectable } from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IChatInternalService } from '../../../../../';
import { ChatInternalService } from '../../../chat/chat.internal.service';

import styles from './index.module.less';

interface SearchResultProps {
  args: any;
  toolCallId: string;
  messageId: string;
  toolName: string;
}

export const FileSearchToolComponent: React.FC<SearchResultProps> = ({ args, toolCallId, messageId }) => (
  <SearchResult args={args} toolCallId={toolCallId} messageId={messageId} toolName='fileSearch' />
);

export const GrepSearchToolComponent: React.FC<SearchResultProps> = ({ args, toolCallId, messageId }) => (
  <SearchResult args={args} toolCallId={toolCallId} messageId={messageId} toolName='grepSearch' />
);

const SearchResult: React.FC<SearchResultProps> = ({ args, toolCallId, toolName, messageId }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const labelService = useInjectable<LabelService>(LabelService);
  const editorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);
  const workspaceService = useInjectable<IWorkspaceService>(IWorkspaceService);
  const workspaceRoot = useMemo(() => URI.parse(workspaceService.tryGetRoots()?.[0]?.uri), []);

  const chatService = useInjectable<ChatInternalService>(IChatInternalService);
  const [files, setFiles] = useState<string[]>(
    chatService.sessionModel.history.getMessageAdditional(messageId)?.[toolCallId]?.files || [],
  );
  useEffect(() => {
    const toDispose = chatService.sessionModel.history.onMessageAdditionalChange((additional) => {
      setFiles(additional[toolCallId]?.files || []);
    });
    return () => {
      toDispose.dispose();
    };
  }, []);

  const handleFileClick = (uri: URI) => {
    // 处理文件点击跳转
    editorService.open(uri);
  };

  const parsedFiles = useMemo(
    () =>
      files.map((file) => {
        const uri = URI.parse(file);
        const iconClass = labelService.getIcon(uri);
        return {
          iconClass,
          name: uri.path.base,
          path: path.relative(workspaceRoot.codeUri.fsPath, uri.path.dir.toString()),
        };
      }),
    [files],
  );

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <span style={{ transform: `rotate(${isExpanded ? '90deg' : '0deg'})` }}>▶</span>
        <span>
          {toolName === 'fileSearch' ? `Searched files "${args.query}"` : `Grepped codebase "${args.query}"`} ·{' '}
          {files.length} files
        </span>
      </div>
      {isExpanded && (
        <ul className={styles.fileList}>
          {parsedFiles.map((file, index) => (
            <li
              key={index}
              className={styles.fileItem}
              onClick={() => handleFileClick(URI.file(path.join(workspaceRoot.codeUri.fsPath, file.path, file.name)))}
            >
              <span className={file.iconClass}></span>
              <span style={{ flex: 1 }}>{file.name}</span>
              <span className={styles.filePath}>{file.path}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
