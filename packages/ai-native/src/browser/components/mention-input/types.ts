import { DocumentSymbol, SymbolKind } from '@opensumi/ide-monaco';

import { LLMContextService } from '../../../common/llm-context';

import type { LabelService } from '@opensumi/ide-core-browser';
import type { IWorkspaceService } from '@opensumi/ide-workspace';

export interface MentionItem {
  id: string;
  type: string;
  text: string;
  value?: string;
  description?: string;
  contextId?: string;
  symbol?: DocumentSymbol;
  icon?: string;
  kind?: SymbolKind;
  getHighestLevelItems?: () => MentionItem[];
  getItems?: (searchText: string) => Promise<MentionItem[]>;
}

export interface SecondLevelMenuConfig {
  getDefaultItems: () => MentionItem[];
  getHighestLevelItems: () => MentionItem[];
}

export interface MentionPosition {
  top: number;
  left: number;
}

export interface MentionState {
  active: boolean;
  startPos: number | null;
  filter: string;
  position: MentionPosition;
  activeIndex: number;
  level: number; // 0: 一级菜单, 1: 二级菜单
  parentType: string | null; // 二级菜单的父类型
  secondLevelFilter: string; // 二级菜单的筛选文本
  inlineSearchActive: boolean; // 是否在输入框中进行二级搜索
  inlineSearchStartPos: number | null; // 内联搜索的起始位置
  loading: boolean; // 加载状态
}

interface ModelOption {
  label: string;
  value: string;
  icon?: string;
  iconClass?: string;
  tags?: string[];
  description?: string;
  badge?: string;
  badgeColor?: string;
}

export interface ExtendedModelOption extends ModelOption {
  disabled?: boolean;
  selected?: boolean; // 由外部控制选中状态
}

export enum FooterButtonPosition {
  LEFT = 'left',
  RIGHT = 'right',
}

export enum MentionType {
  FILE = 'file',
  FOLDER = 'folder',
  CODE = 'code',
  RULE = 'rule',
}

interface FooterButton {
  id: string;
  icon?: string;
  iconClass?: string;
  title: string;
  onClick?: () => void;
  position: FooterButtonPosition;
}

export interface FooterConfig {
  modelOptions?: ModelOption[];
  extendedModelOptions?: ExtendedModelOption[];
  defaultModel?: string;
  buttons?: FooterButton[];
  showModelSelector?: boolean;
  disableModelSelector?: boolean;
  showThinking?: boolean;
  thinkingEnabled?: boolean;
  onThinkingChange?: (enabled: boolean) => void;
}

export interface MentionInputProps {
  mentionItems?: MentionItem[]; // 简化为单一菜单项配置
  onSend?: (content: string, config?: { model: string; [key: string]: any }) => void;
  onStop?: () => void;
  placeholder?: string;
  loading?: boolean;
  onSelectionChange?: (value: string) => void;
  onImageUpload?: (files: File[]) => Promise<void>;
  footerConfig?: FooterConfig; // 新增配置项
  mentionKeyword?: string;
  labelService?: LabelService;
  workspaceService?: IWorkspaceService;
  contextService?: LLMContextService;
}

export const MENTION_KEYWORD = '@';
