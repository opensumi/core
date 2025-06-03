import { DataContent } from 'ai';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Image } from '@opensumi/ide-components/lib/image';
import {
  LabelService,
  PreferenceService,
  RecentFilesManager,
  getSymbolIcon,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { Icon, getIcon } from '@opensumi/ide-core-browser/lib/components';
import {
  AINativeSettingSectionsId,
  ChatFeatureRegistryToken,
  RulesServiceToken,
  URI,
  localize,
} from '@opensumi/ide-core-common';
import { CommandService } from '@opensumi/ide-core-common/lib/command';
import { defaultFilesWatcherExcludes } from '@opensumi/ide-core-common/lib/preferences/file-watch';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { FileSearchServicePath, IFileSearchService } from '@opensumi/ide-file-search';
import { OutlineCompositeTreeNode, OutlineTreeNode } from '@opensumi/ide-outline/lib/browser/outline-node.define';
import { OutlineTreeService } from '@opensumi/ide-outline/lib/browser/services/outline-tree.service';
import { IMessageService } from '@opensumi/ide-overlay';
import { IconType } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IChatInternalService } from '../../common';
import { LLMContextService } from '../../common/llm-context';
import { ChatFeatureRegistry } from '../chat/chat.feature.registry';
import { ChatInternalService } from '../chat/chat.internal.service';
import { MCPConfigCommands } from '../mcp/config/mcp-config.commands';
import { RulesCommands } from '../rules/rules.contribution';
import { RulesService } from '../rules/rules.service';

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
  contextService?: LLMContextService;
}

export const ChatMentionInput = (props: IChatMentionInputProps) => {
  const { onSend, disabled = false, contextService } = props;

  const [value, setValue] = useState(props.value || '');
  const [images, setImages] = useState(props.images || []);
  const aiChatService = useInjectable<ChatInternalService>(IChatInternalService);
  const commandService = useInjectable<CommandService>(CommandService);
  const searchService = useInjectable<IFileSearchService>(FileSearchServicePath);
  const recentFilesManager = useInjectable<RecentFilesManager>(RecentFilesManager);
  const workspaceService = useInjectable<IWorkspaceService>(IWorkspaceService);
  const editorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);
  const labelService = useInjectable<LabelService>(LabelService);
  const iconService = useInjectable<IconService>(IconService);
  const messageService = useInjectable<IMessageService>(IMessageService);
  const chatFeatureRegistry = useInjectable<ChatFeatureRegistry>(ChatFeatureRegistryToken);
  const outlineTreeService = useInjectable<OutlineTreeService>(OutlineTreeService);
  const prevOutlineItems = useRef<MentionItem[]>([]);
  const preferenceService = useInjectable<PreferenceService>(PreferenceService);
  const rulesService = useInjectable<RulesService>(RulesServiceToken);
  const handleShowMCPConfig = React.useCallback(() => {
    commandService.executeCommand(MCPConfigCommands.OPEN_MCP_CONFIG.id);
  }, [commandService]);

  const handleShowRules = React.useCallback(() => {
    commandService.executeCommand(RulesCommands.OPEN_RULES_FILE.id);
  }, [commandService]);

  useEffect(() => {
    if (props.value !== value) {
      setValue(props.value || '');
    }
  }, [props.value]);

  const resolveSymbols = useCallback(
    async (parent?: OutlineCompositeTreeNode, symbols: (OutlineTreeNode | OutlineCompositeTreeNode)[] = []) => {
      if (!parent) {
        parent = (await outlineTreeService.resolveChildren())[0] as OutlineCompositeTreeNode;
      }
      const children = (await outlineTreeService.resolveChildren(parent)) as (
        | OutlineTreeNode
        | OutlineCompositeTreeNode
      )[];
      for (const child of children) {
        symbols.push(child);
        if (OutlineCompositeTreeNode.is(child)) {
          await resolveSymbols(child, symbols);
        }
      }
      return symbols;
    },
    [outlineTreeService],
  );

  // 拆分目录路径为多个层级的辅助函数
  const expandFolderPaths = async (folderPaths: string[], workspaceRootPath: string): Promise<MentionItem[]> => {
    const expandedPaths = new Set<string>();
    const workspaceUri = new URI(workspaceRootPath);

    // 将所有路径展开为多层级
    for (const folderPath of folderPaths) {
      const uri = new URI(folderPath);
      const relativePath = await workspaceService.asRelativePath(uri);

      if (relativePath?.path) {
        const pathSegments = relativePath.path.split('/').filter(Boolean);

        // 为每个层级创建路径
        for (let i = 0; i < pathSegments.length; i++) {
          const segmentPath = pathSegments.slice(0, i + 1).join('/');
          const fullPath = workspaceUri.resolve(segmentPath).codeUri.fsPath;

          // 避免添加工作区本身或其上级目录
          if (fullPath !== workspaceRootPath && !workspaceRootPath.startsWith(fullPath)) {
            expandedPaths.add(fullPath);
          }
        }
      } else {
        // 如果无法获取相对路径，直接添加（但仍要过滤工作区路径）
        if (folderPath !== workspaceRootPath && !workspaceRootPath.startsWith(folderPath)) {
          expandedPaths.add(folderPath);
        }
      }
    }

    // 转换为 MentionItem 格式
    return Promise.all(
      Array.from(expandedPaths).map(async (folderPath) => {
        const uri = new URI(folderPath);
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
  };

  // 默认菜单项
  const defaultMenuItems: MentionItem[] = [
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
          const recentFolder = Array.from(
            new Set(
              recentFile
                .map((file) => new URI(file).parent.codeUri.fsPath)
                .filter((folder) => folder !== workspaceService.workspace?.uri.toString() && folder !== '/'),
            ),
          );
          folders = await expandFolderPaths(recentFolder, workspaceService.workspace?.uri.toString() || '');
        } else {
          const rootUris = (await workspaceService.roots).map((root) => new URI(root.uri).codeUri.fsPath.toString());
          const files = await searchService.find(searchText, {
            rootUris,
            useGitIgnore: true,
            noIgnoreParent: true,
            fuzzyMatch: true,
            excludePatterns: Object.keys(defaultFilesWatcherExcludes),
            limit: 10,
          });
          const folders = Array.from(
            new Set(
              files
                .map((file) => new URI(file).parent.toString())
                .filter((folder) => folder !== workspaceService.workspace?.uri.toString()),
            ),
          );
          return await expandFolderPaths(folders, workspaceService.workspace?.uri.toString() || '');
        }
        return folders
          .filter(Boolean)
          .filter((folder) => folder.id !== new URI(workspaceService.workspace?.uri).codeUri.fsPath);
      },
    },
    {
      id: 'code',
      type: 'code',
      text: 'Code',
      icon: getIcon('codebraces'),
      getHighestLevelItems: () => [],
      getItems: async (searchText: string) => {
        if (!searchText || prevOutlineItems.current.length === 0) {
          const uri = outlineTreeService.currentUri;
          if (!uri) {
            return [];
          }
          const treeNodes = await resolveSymbols();
          prevOutlineItems.current = await Promise.all(
            treeNodes.map(async (treeNode) => {
              const relativePath = await workspaceService.asRelativePath(uri);
              return {
                id: treeNode.raw.id,
                type: MentionType.CODE,
                text: treeNode.raw.name,
                symbol: treeNode.raw,
                value: treeNode.raw.id,
                description: `${relativePath?.root ? relativePath.path : ''}:L${treeNode.raw.range.startLineNumber}-${
                  treeNode.raw.range.endLineNumber
                }`,
                kind: treeNode.raw.kind,
                contextId: `${outlineTreeService.currentUri?.codeUri.fsPath}:L${treeNode.raw.range.startLineNumber}-${treeNode.raw.range.endLineNumber}`,
                icon: getSymbolIcon(treeNode.raw.kind) + ' outline-icon',
              };
            }),
          );
          return prevOutlineItems.current;
        } else {
          searchText = searchText.toLocaleLowerCase();
          return prevOutlineItems.current.sort((a, b) => {
            if (a.text.toLocaleLowerCase().includes(searchText) && b.text.toLocaleLowerCase().includes(searchText)) {
              return 0;
            }
            if (a.text.toLocaleLowerCase().includes(searchText)) {
              return -1;
            } else if (b.text.toLocaleLowerCase().includes(searchText)) {
              return 1;
            }
            return 0;
          });
        }
      },
    },
    {
      id: MentionType.RULE,
      type: MentionType.RULE,
      text: 'Rule',
      icon: getIcon('rules'),
      getHighestLevelItems: () => [],
      getItems: async (searchText: string) => {
        const rules = await rulesService.projectRules;
        const mappedRules = rules.map((rule) => {
          const uri = new URI(rule.path);
          return {
            id: uri.codeUri.fsPath,
            type: MentionType.RULE,
            text: uri.displayName,
            value: uri.codeUri.fsPath,
            contextId: uri.codeUri.fsPath,
            description: rule.description,
            icon: getIcon('rules'),
          };
        });

        if (!searchText) {
          return mappedRules.slice(0, 10);
        }

        const lowerSearchText = searchText.toLocaleLowerCase();
        return mappedRules
          .filter((rule) => rule.text.toLocaleLowerCase().includes(lowerSearchText))
          .sort((a, b) => {
            const aTextLower = a.text.toLocaleLowerCase();
            const bTextLower = b.text.toLocaleLowerCase();
            const aDescLower = a.description?.toLocaleLowerCase() || '';
            const bDescLower = b.description?.toLocaleLowerCase() || '';

            // 优先级：文件名包含搜索文本 > 描述包含搜索文本
            const aTextMatch = aTextLower.includes(lowerSearchText);
            const bTextMatch = bTextLower.includes(lowerSearchText);
            const aDescMatch = aDescLower.includes(lowerSearchText);
            const bDescMatch = bDescLower.includes(lowerSearchText);

            if (aTextMatch && bTextMatch) {
              // 如果都匹配文件名，按文件名字母序排序
              return aTextLower.localeCompare(bTextLower);
            }
            if (aTextMatch && !bTextMatch) {
              return -1;
            }
            if (!aTextMatch && bTextMatch) {
              return 1;
            }

            // 如果文件名都不匹配，比较描述
            if (aDescMatch && bDescMatch) {
              return aTextLower.localeCompare(bTextLower);
            }
            if (aDescMatch && !bDescMatch) {
              return -1;
            }
            if (!aDescMatch && bDescMatch) {
              return 1;
            }

            // 如果都不匹配，按文件名字母序排序
            return aTextLower.localeCompare(bTextLower);
          })
          .slice(0, 10);
      },
    },
  ];
  const defaultMentionInputFooterOptions: FooterConfig = useMemo(
    () => ({
      modelOptions: [
        {
          label: 'Claude 4 Sonnet',
          value: 'claude_sonnet4',
          iconClass: iconService.fromIcon(
            '',
            'https://img.alicdn.com/imgextra/i3/O1CN01p0mziz1Nsl40lp1HO_!!6000000001626-55-tps-92-65.svg',
            IconType.Background,
          ),
          tags: ['多模态', '长上下文理解', '思考模式'],
          description: '高性能模型，支持多模态输入',
        },
        {
          label: 'DeepSeek R1',
          value: 'deepseek-r1',
          iconClass: iconService.fromIcon(
            '',
            'https://img.alicdn.com/imgextra/i3/O1CN01ClcK2w1JwdxcbAB3a_!!6000000001093-55-tps-30-30.svg',
            IconType.Background,
          ),
          tags: ['思考模式', '长上下文理解'],
          description: '专业创作，支持多模态输入',
        },
      ],
      defaultModel:
        props.sessionModelId || preferenceService.get<string>(AINativeSettingSectionsId.ModelID) || 'deepseek-r1',
      buttons: [
        {
          id: 'mcp-server',
          icon: 'mcp',
          title: 'MCP Server',
          onClick: handleShowMCPConfig,
          position: FooterButtonPosition.LEFT,
        },
        {
          id: 'rules',
          icon: 'rules',
          title: 'Rules',
          onClick: handleShowRules,
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
    [iconService, handleShowMCPConfig, handleShowRules, props.disableModelSelector, props.sessionModelId],
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
        contextService={contextService}
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
