import React, { useEffect, useMemo, useState } from 'react';

import { CommandService, LabelService, URI, path, useInjectable } from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IChatInternalService } from '../../../../common';
import { ChatInternalService } from '../../../chat/chat.internal.service';

import styles from './index.module.less';

interface FileInfo {
  uri: string;
  isDirectory: boolean;
}

interface ExpandableFileListProps {
  args: any;
  toolCallId: string;
  messageId: string;
  toolName: string;
  headerText?: string;
}

export const FileSearchToolComponent: React.FC<ExpandableFileListProps> = ({ args, toolCallId, messageId }) => (
  <ExpandableFileList
    args={args}
    toolCallId={toolCallId}
    messageId={messageId}
    toolName='fileSearch'
    headerText={`Searched files "${args.query}"`}
  />
);

export const GrepSearchToolComponent: React.FC<ExpandableFileListProps> = ({ args, toolCallId, messageId }) => (
  <ExpandableFileList
    args={args}
    toolCallId={toolCallId}
    messageId={messageId}
    toolName='grepSearch'
    headerText={`Grepped codebase "${args.query}"`}
  />
);

export const ListDirToolComponent: React.FC<ExpandableFileListProps> = ({ args, toolCallId, messageId }) => (
  <ExpandableFileList
    args={args}
    toolCallId={toolCallId}
    messageId={messageId}
    toolName='listDir'
    headerText={`Listed directory "${args.relative_workspace_path}"`}
  />
);

const ExpandableFileList: React.FC<ExpandableFileListProps> = ({
  args,
  toolCallId,
  toolName,
  messageId,
  headerText,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const labelService = useInjectable<LabelService>(LabelService);
  const editorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);
  const workspaceService = useInjectable<IWorkspaceService>(IWorkspaceService);
  const commandService = useInjectable<CommandService>(CommandService);
  const workspaceRoot = useMemo(() => URI.parse(workspaceService.tryGetRoots()?.[0]?.uri), []);

  const chatService = useInjectable<ChatInternalService>(IChatInternalService);
  const [fileList, setFileList] = useState<FileInfo[]>([]);

  useEffect(() => {
    const toDispose = chatService.sessionModel.history.onMessageAdditionalChange((additional) => {
      setFileList(additional[toolCallId]?.files || []);
    });
    return () => {
      toDispose.dispose();
    };
  }, []);

  const handleFileClick = async (fileInfo: FileInfo) => {
    // 处理文件点击跳转
    if (!fileInfo.isDirectory) {
      editorService.open(URI.parse(fileInfo.uri));
    } else {
      // 如果是目录，聚焦到文件树并展开该目录
      const uri = URI.parse(fileInfo.uri);
      commandService.executeCommand('filetree.location', uri);
    }
  };

  const parsedFiles = useMemo(
    () =>
      fileList.map((file) => {
        const uri = URI.parse(file.uri);
        const iconClass = labelService.getIcon(uri, { isDirectory: file.isDirectory });
        return {
          iconClass,
          name: uri.path.base,
          path: path.relative(workspaceRoot.codeUri.fsPath, uri.path.dir.toString()),
          uri: file.uri,
          isDirectory: file.isDirectory,
        };
      }),
    [fileList],
  );

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <span style={{ transform: `rotate(${isExpanded ? '90deg' : '0deg'})` }}>▶</span>
        <span>
          {headerText} · {fileList.length} files
        </span>
      </div>
      {isExpanded && (
        <ul className={styles.fileList}>
          {parsedFiles.map((file, index) => (
            <li
              key={index}
              className={styles.fileItem}
              onClick={() => handleFileClick({ uri: file.uri, isDirectory: file.isDirectory })}
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
