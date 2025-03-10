import * as React from 'react';

import styles from './mention-input.module.less';
import { MentionItem } from './mention-item';
import { MentionItem as MentionItemType, MentionPosition } from './types';

interface MentionPanelProps {
  items: MentionItemType[];
  activeIndex: number;
  onSelectItem: (item: MentionItemType, isTriggerByClick?: boolean) => void;
  position: MentionPosition;
  filter: string;
  visible: boolean;
  level: number;
  loading?: boolean;
}

export const MentionPanel: React.FC<MentionPanelProps> = ({
  items,
  activeIndex,
  onSelectItem,
  position,
  filter,
  visible,
  level,
  loading = false,
}) => {
  const panelRef = React.useRef<HTMLDivElement>(null);

  // 当活动项改变时滚动到可见区域
  React.useEffect(() => {
    if (visible && panelRef.current) {
      const activeItem = panelRef.current.querySelector(`.${styles.mention_item}.${styles.active}`);
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

  if (level === 0 && filteredItems.length === 0) {
    return null;
  }

  return (
    <div ref={panelRef} className={styles.mention_panel} style={{ top: position.top, left: position.left }}>
      {loading && <div className={styles.loading_bar}></div>}
      {items.length > 0 ? (
        <ul className={styles.mention_list}>
          {items.map((item, index) => (
            <MentionItem
              key={item.id}
              item={item}
              isActive={index === activeIndex}
              onClick={() => onSelectItem(item, true)}
            />
          ))}
        </ul>
      ) : (
        <div className={styles.no_results}>{loading ? '正在搜索...' : '无匹配结果'}</div>
      )}
    </div>
  );
};
