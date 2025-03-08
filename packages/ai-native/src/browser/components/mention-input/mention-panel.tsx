import * as React from 'react';

import styles from './mention-input.module.less';
import { MentionItem } from './mention-item';
import { MentionItem as MentionItemType, MentionPosition } from './types';

interface MentionPanelProps {
  items: MentionItemType[];
  activeIndex: number;
  onSelectItem: (item: MentionItemType) => void;
  onBackToParent: () => void;
  position: MentionPosition;
  filter: string;
  visible: boolean;
  level: number;
  parentType: string | null;
}

export const MentionPanel: React.FC<MentionPanelProps> = ({
  items,
  activeIndex,
  onSelectItem,
  onBackToParent,
  position,
  filter,
  visible,
  level,
  parentType,
}) => {
  const panelRef = React.useRef<HTMLDivElement>(null);

  // 当活动项改变时滚动到可见区域
  React.useEffect(() => {
    if (visible && panelRef.current) {
      const activeItem = panelRef.current.querySelector('.mention-item.active');
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex, visible]);

  if (!visible) {
    return null;
  }

  // 根据过滤条件筛选项目
  const getFilteredItems = () => {
    let filteredItems = items;

    if (level === 0) {
      // 一级菜单根据 @ 后面的文本过滤
      if (filter && filter.length > 1) {
        const searchText = filter.substring(1).toLowerCase();
        filteredItems = items.filter((item) => item.text.toLowerCase().includes(searchText));
      }
    } else {
      // 二级菜单根据 @file: 后面的文本过滤
      if (filter && filter.length > 0) {
        filteredItems = items.filter((item) => item.text.toLowerCase().includes(filter.toLowerCase()));
      }
    }

    return filteredItems;
  };

  const filteredItems = getFilteredItems();

  // 获取面板标题
  const getPanelTitle = () => {
    if (level === 0) {
      return '选择要提及的内容';
    }

    switch (parentType) {
      case 'file':
        return '选择文件';
      case 'folder':
        return '选择文件夹';
      default:
        return '选择项目';
    }
  };

  return (
    <div
      ref={panelRef}
      className={styles['mention-panel']}
      style={{
        bottom: position.bottom + 'px',
        left: position.left + 'px',
      }}
    >
      <div className={styles.mention_panel_title}>
        {getPanelTitle()}
        {level > 0 && (
          <button className={styles.back_button} onClick={onBackToParent}>
            <span className={styles.back_icon}>←</span>
            ESC 返回/关闭
          </button>
        )}
      </div>

      {filteredItems.length === 0 ? (
        <div className={styles.empty_state}>没有找到匹配的内容</div>
      ) : (
        <>
          {filteredItems.map((item, index) => (
            <MentionItem key={item.id} item={item} isActive={index === activeIndex} onClick={onSelectItem} />
          ))}
        </>
      )}

      <div className={styles.keyboard_hint}>使用 ↑↓ 键导航，Enter 确认选择</div>
    </div>
  );
};
