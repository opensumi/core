import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { LabelService, RecentFilesManager, useInjectable } from '@opensumi/ide-core-browser';
import { getIcon } from '@opensumi/ide-core-browser/lib/components';
import { URI, localize } from '@opensumi/ide-core-common';
import { CommandService } from '@opensumi/ide-core-common/lib/command';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { FileSearchServicePath, IFileSearchService } from '@opensumi/ide-file-search';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IChatInternalService } from '../../common';
import { ChatInternalService } from '../chat/chat.internal.service';
import { OPEN_MCP_CONFIG_COMMAND } from '../mcp/config/mcp-config.commands';

import styles from './components.module.less';
import { MentionInput } from './mention-input/mention-input';
import { FooterButtonPosition, FooterConfig, MentionItem, MentionType } from './mention-input/types';

export interface IChatMentionInputProps {
  onSend: (value: string, agentId?: string, command?: string, option?: { model: string; [key: string]: any }) => void;
  onValueChange?: (value: string) => void;
  onExpand?: (value: boolean) => void;
  placeholder?: string;
  enableOptions?: boolean;
  disabled?: boolean;
  sendBtnClassName?: string;
  defaultHeight?: number;
  value?: string;
  autoFocus?: boolean;
  theme?: string | null;
  setTheme: (theme: string | null) => void;
  agentId: string;
  setAgentId: (id: string) => void;
  defaultAgentId?: string;
  command: string;
  setCommand: (command: string) => void;
}

// 指令命令激活组件
export const ChatMentionInput = React.forwardRef((props: IChatMentionInputProps) => {
  const { onSend, disabled = false } = props;

  const [value, setValue] = useState(props.value || '');
  const aiChatService = useInjectable<ChatInternalService>(IChatInternalService);
  const commandService = useInjectable<CommandService>(CommandService);
  const searchService = useInjectable<IFileSearchService>(FileSearchServicePath);
  const recentFilesManager = useInjectable<RecentFilesManager>(RecentFilesManager);
  const workspaceService = useInjectable<IWorkspaceService>(IWorkspaceService);
  const editorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);
  const labelService = useInjectable<LabelService>(LabelService);

  const handleShowMCPConfig = React.useCallback(() => {
    commandService.executeCommand(OPEN_MCP_CONFIG_COMMAND.id);
  }, [commandService]);

  useEffect(() => {
    if (props.value !== value) {
      setValue(props.value || '');
    }
  }, [props.value]);

  // 默认菜单项
  const defaultMenuItems: MentionItem[] = [
    // {
    //   id: 'code',
    //   type: 'code',
    //   text: 'Code',
    //   icon: getIcon('codebraces'),
    //   getHighestLevelItems: () => [],
    //   getItems: async (searchText: string) => {
    //     const currentEditor = editorService.currentEditor;
    //     if (!currentEditor) {
    //       return [];
    //     }
    //     const currentDocumentModel = currentEditor.currentDocumentModel;
    //     if (!currentDocumentModel) {
    //       return [];
    //     }
    //     const symbols = await commandService.executeCommand('_executeFormatDocumentProvider', currentDocumentModel.uri.codeUri);
    //     return [];
    //   },
    // },
    {
      id: MentionType.FILE,
      type: MentionType.FILE,
      text: 'File',
      icon: getIcon('file'),
      getHighestLevelItems: () => {
        const currentEditor = editorService.currentEditor;
        const currentUri = currentEditor?.currentUri;
        if (!currentUri) {
          return [];
        }
        return [
          {
            id: currentUri.codeUri.fsPath,
            type: MentionType.FILE,
            text: currentUri.displayName,
            value: currentUri.codeUri.fsPath,
            description: `(${localize('aiNative.chat.defaultContextFile')})`,
            contextId: currentUri.codeUri.fsPath,
            icon: labelService.getIcon(currentUri),
          },
        ];
      },
      getItems: async (searchText: string) => {
        if (!searchText) {
          const recentFile = await recentFilesManager.getMostRecentlyOpenedFiles();
          return Promise.all(
            recentFile.map(async (file) => {
              const uri = new URI(file);
              return {
                id: uri.codeUri.fsPath,
                type: MentionType.FILE,
                text: uri.displayName,
                value: uri.codeUri.fsPath,
                description: (await workspaceService.asRelativePath(uri.parent))?.path || '',
                contextId: uri.codeUri.fsPath,
                icon: labelService.getIcon(uri),
              };
            }),
          );
        } else {
          const rootUris = (await workspaceService.roots).map((root) => new URI(root.uri).codeUri.fsPath.toString());
          const results = await searchService.find(searchText, {
            rootUris,
            useGitIgnore: true,
            noIgnoreParent: true,
            fuzzyMatch: true,
            limit: 10,
          });
          return Promise.all(
            results.map(async (file) => {
              const uri = new URI(file);
              return {
                id: uri.codeUri.fsPath,
                type: MentionType.FILE,
                text: uri.displayName,
                value: uri.codeUri.fsPath,
                description: (await workspaceService.asRelativePath(uri.parent))?.path || '',
                contextId: uri.codeUri.fsPath,
                icon: labelService.getIcon(uri),
              };
            }),
          );
        }
      },
    },
    {
      id: MentionType.FOLDER,
      type: MentionType.FOLDER,
      text: 'Folder',
      icon: getIcon('folder'),
      getHighestLevelItems: () => {
        const currentEditor = editorService.currentEditor;
        const currentFolderUri = currentEditor?.currentUri?.parent;
        if (!currentFolderUri) {
          return [];
        }
        return [
          {
            id: currentFolderUri.codeUri.fsPath,
            type: MentionType.FOLDER,
            text: currentFolderUri.displayName,
            value: currentFolderUri.codeUri.fsPath,
            description: `(${localize('aiNative.chat.defaultContextFolder')})`,
            contextId: currentFolderUri.codeUri.fsPath,
            icon: getIcon('folder'),
          },
        ];
      },
      getItems: async (searchText: string) => {
        if (!searchText) {
          const recentFile = await recentFilesManager.getMostRecentlyOpenedFiles();
          const recentFolder = Array.from(new Set(recentFile.map((file) => new URI(file).parent.codeUri.fsPath)));
          return Promise.all(
            recentFolder.map(async (folder) => {
              const uri = new URI(folder);
              const relativePath = await workspaceService.asRelativePath(uri);
              return {
                id: uri.codeUri.fsPath,
                type: MentionType.FOLDER,
                text: uri.displayName,
                value: uri.codeUri.fsPath,
                description: relativePath?.root ? relativePath.path : '',
                contextId: uri.codeUri.fsPath,
                icon: getIcon('folder'),
              };
            }),
          );
        } else {
          const rootUris = (await workspaceService.roots).map((root) => new URI(root.uri).codeUri.fsPath.toString());
          const results = await searchService.find(searchText, {
            rootUris,
            useGitIgnore: true,
            noIgnoreParent: true,
            fuzzyMatch: true,
            limit: 10,
            onlyFolders: true,
          });
          return Promise.all(
            results.map(async (folder) => {
              const uri = new URI(folder);
              return {
                id: uri.codeUri.fsPath,
                type: MentionType.FOLDER,
                text: uri.displayName,
                value: uri.codeUri.fsPath,
                description: (await workspaceService.asRelativePath(uri.parent))?.path || '',
                contextId: uri.codeUri.fsPath,
                icon: getIcon('folder'),
              };
            }),
          );
        }
      },
    },
  ];

  const defaultMentionInputFooterOptions: FooterConfig = useMemo(
    () => ({
      modelOptions: [
        { label: 'QWQ 32B', value: 'qwq-32b' },
        { label: 'DeepSeek R1', value: 'deepseek-r1' },
      ],
      defaultModel: 'deepseek-r1',
      buttons: [
        {
          id: 'mcp-server',
          icon: 'mcp',
          title: 'MCP Server',
          onClick: handleShowMCPConfig,
          position: FooterButtonPosition.LEFT,
        },
      ],
      showModelSelector: true,
    }),
    [handleShowMCPConfig],
  );

  const handleStop = useCallback(() => {
    aiChatService.cancelRequest();
  }, []);

  const handleSend = useCallback(
    async (content: string, option?: { model: string; [key: string]: any }) => {
      if (disabled) {
        return;
      }
      onSend(content, undefined, undefined, option);
    },
    [onSend, editorService, disabled],
  );

  return (
    <div className={styles.chat_input_container}>
      <MentionInput
        mentionItems={defaultMenuItems}
        onSend={handleSend}
        onStop={handleStop}
        loading={disabled}
        labelService={labelService}
        placeholder={localize('aiNative.chat.input.placeholder.default')}
        footerConfig={defaultMentionInputFooterOptions}
      />
    </div>
  );
});
