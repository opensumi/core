import { DataContent } from 'ai';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Image } from '@opensumi/ide-components/lib/image';
import { LabelService, RecentFilesManager, useInjectable } from '@opensumi/ide-core-browser';
import { Icon, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { ChatFeatureRegistryToken, URI, localize } from '@opensumi/ide-core-common';
import { CommandService } from '@opensumi/ide-core-common/lib/command';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { FileSearchServicePath, IFileSearchService } from '@opensumi/ide-file-search';
import { IMessageService } from '@opensumi/ide-overlay';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IChatInternalService } from '../../common';
import { ChatFeatureRegistry } from '../chat/chat.feature.registry';
import { ChatInternalService } from '../chat/chat.internal.service';
import { OPEN_MCP_CONFIG_COMMAND } from '../mcp/config/mcp-config.commands';

import styles from './components.module.less';
import { MentionInput } from './mention-input/mention-input';
import { FooterButtonPosition, FooterConfig, MentionItem, MentionType } from './mention-input/types';

export interface IChatMentionInputProps {
  onSend: (
    value: string,
    images?: string[],
    agentId?: string,
    command?: string,
    option?: { model: string; [key: string]: any },
  ) => void;
  onValueChange?: (value: string) => void;
  onExpand?: (value: boolean) => void;
  placeholder?: string;
  enableOptions?: boolean;
  disabled?: boolean;
  sendBtnClassName?: string;
  defaultHeight?: number;
  value?: string;
  images?: Array<DataContent | URL>;
  autoFocus?: boolean;
  theme?: string | null;
  setTheme: (theme: string | null) => void;
  agentId: string;
  setAgentId: (id: string) => void;
  defaultAgentId?: string;
  command: string;
  setCommand: (command: string) => void;
  disableModelSelector?: boolean;
  sessionModelId?: string;
}

// 指令命令激活组件
export const ChatMentionInput = (props: IChatMentionInputProps) => {
  const { onSend, disabled = false } = props;

  const [value, setValue] = useState(props.value || '');
  const [images, setImages] = useState(props.images || []);
  const aiChatService = useInjectable<ChatInternalService>(IChatInternalService);
  const commandService = useInjectable<CommandService>(CommandService);
  const searchService = useInjectable<IFileSearchService>(FileSearchServicePath);
  const recentFilesManager = useInjectable<RecentFilesManager>(RecentFilesManager);
  const workspaceService = useInjectable<IWorkspaceService>(IWorkspaceService);
  const editorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);
  const labelService = useInjectable<LabelService>(LabelService);
  const messageService = useInjectable<IMessageService>(IMessageService);
  const chatFeatureRegistry = useInjectable<ChatFeatureRegistry>(ChatFeatureRegistryToken);
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
              const relatveParentPath = (await workspaceService.asRelativePath(uri.parent))?.path;
              return {
                id: uri.codeUri.fsPath,
                type: MentionType.FILE,
                text: uri.displayName,
                value: uri.codeUri.fsPath,
                description: relatveParentPath || '',
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
              const relatveParentPath = (await workspaceService.asRelativePath(uri.parent))?.path;
              return {
                id: uri.codeUri.fsPath,
                type: MentionType.FILE,
                text: uri.displayName,
                value: uri.codeUri.fsPath,
                description: relatveParentPath || '',
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
        if (currentFolderUri.toString() === workspaceService.workspace?.uri) {
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
        let folders: MentionItem[] = [];
        if (!searchText) {
          const recentFile = await recentFilesManager.getMostRecentlyOpenedFiles();
          const recentFolder = Array.from(new Set(recentFile.map((file) => new URI(file).parent.codeUri.fsPath)));
          folders = await Promise.all(
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
          const files = await searchService.find(searchText, {
            rootUris,
            useGitIgnore: true,
            noIgnoreParent: true,
            fuzzyMatch: true,
            excludePatterns: ['**/node_modules/**/*', '**/.git/**/*'],
            limit: 10,
          });
          const folders = Array.from(
            new Set(
              files
                .map((file) => new URI(file).parent.toString())
                .filter((folder) => folder !== workspaceService.workspace?.uri.toString()),
            ),
          );
          return Promise.all(
            folders.map(async (folder) => {
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
        return folders.filter((folder) => folder.id !== new URI(workspaceService.workspace?.uri).codeUri.fsPath);
      },
    },
  ];

  const defaultMentionInputFooterOptions: FooterConfig = useMemo(
    () => ({
      modelOptions: [
        { label: 'QWQ 32B', value: 'qwq-32b' },
        { label: 'DeepSeek R1', value: 'deepseek-r1' },
      ],
      defaultModel: props.sessionModelId || 'deepseek-r1',
      buttons: [
        {
          id: 'mcp-server',
          icon: 'mcp',
          title: 'MCP Server',
          onClick: handleShowMCPConfig,
          position: FooterButtonPosition.LEFT,
        },
        {
          id: 'upload-image',
          icon: 'image',
          title: localize('aiNative.chat.imageUpload'),
          onClick: () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
              const files = (e.target as HTMLInputElement).files;
              if (files?.length) {
                handleImageUpload(Array.from(files));
              }
            };
            input.click();
          },
          position: FooterButtonPosition.LEFT,
        },
      ],
      showModelSelector: true,
      disableModelSelector: props.disableModelSelector,
    }),
    [handleShowMCPConfig, props.disableModelSelector, props.sessionModelId],
  );

  const handleStop = useCallback(() => {
    aiChatService.cancelRequest();
  }, []);

  const handleSend = useCallback(
    async (content: string, option?: { model: string; [key: string]: any }) => {
      if (disabled) {
        return;
      }
      onSend(
        content,
        images.map((image) => image.toString()),
        undefined,
        undefined,
        option,
      );
      setImages(props.images || []);
    },
    [onSend, images, disabled],
  );

  const handleImageUpload = useCallback(
    async (files: File[]) => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

      // Validate file types
      const invalidFiles = files.filter((file) => !allowedTypes.includes(file.type));
      if (invalidFiles.length > 0) {
        messageService.error('Only JPG, PNG, WebP and GIF images are supported');
        return;
      }

      const imageUploadProvider = chatFeatureRegistry.getImageUploadProvider();
      if (!imageUploadProvider) {
        messageService.error('No image upload provider found');
        return;
      }

      // Upload all files
      const uploadedData = await Promise.all(files.map((file) => imageUploadProvider.imageUpload(file)));

      const newImages = [...images, ...uploadedData];
      setImages(newImages);
    },
    [images],
  );

  const handleDeleteImage = useCallback(
    (index: number) => {
      setImages(images.filter((_, i) => i !== index));
    },
    [images],
  );

  return (
    <div className={styles.chat_input_container}>
      {images.length > 0 && <ImagePreviewer images={images} onDelete={handleDeleteImage} />}
      <MentionInput
        mentionItems={defaultMenuItems}
        onSend={handleSend}
        onStop={handleStop}
        loading={disabled}
        labelService={labelService}
        workspaceService={workspaceService}
        placeholder={localize('aiNative.chat.input.placeholder.default')}
        footerConfig={defaultMentionInputFooterOptions}
        onImageUpload={handleImageUpload}
      />
    </div>
  );
};

const ImagePreviewer = ({
  images,
  onDelete,
}: {
  images: Array<DataContent | URL>;
  onDelete: (index: number) => void;
}) => (
  <div>
    <div className={styles.thumbnail_container}>
      {images.map((image, index) => (
        <div key={index} className={styles.thumbnail}>
          <Image src={image.toString()} />
          <button onClick={() => onDelete(index)} className={styles.delete_button}>
            <Icon iconClass='codicon codicon-close' />
          </button>
        </div>
      ))}
    </div>
  </div>
);
