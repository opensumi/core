export interface MentionItem {
  id: string;
  type: string;
  text: string;
  hasSubmenu?: boolean;
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
}
