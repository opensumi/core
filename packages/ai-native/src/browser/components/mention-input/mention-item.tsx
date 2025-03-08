import * as React from 'react';

import styles from './mention-input.module.less';
import { MentionItem as MentionItemType } from './types';

interface MentionItemProps {
  item: MentionItemType;
  isActive: boolean;
  onClick: (item: MentionItemType) => void;
}

export const MentionItem: React.FC<MentionItemProps> = ({ item, isActive, onClick }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'file':
        return '📄';
      case 'folder':
        return '📁';
      case 'code':
        return '💻';
      case 'back':
        return '⬅️';
      default:
        return '📌';
    }
  };

  return (
    <div className={`${styles.mention_item} ${isActive ? styles.active : ''}`} onClick={() => onClick(item)}>
      <div className={styles.mention_item_left}>
        <span className={styles.mention_item_icon}>{getIcon(item.type)}</span>
        <span className={styles.mention_item_text}>{item.text}</span>
      </div>
      {item.hasSubmenu && <div className={styles.mention_item_right}>&gt;</div>}
    </div>
  );
};
