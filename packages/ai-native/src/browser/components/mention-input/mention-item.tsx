import cls from 'classnames';
import * as React from 'react';

import { Icon, getIcon } from '@opensumi/ide-core-browser/lib/components';

import styles from './mention-input.module.less';
import { MentionItem as MentionItemType } from './types';

interface MentionItemProps {
  item: MentionItemType;
  isActive: boolean;
  onClick: (item: MentionItemType) => void;
}

export const MentionItem: React.FC<MentionItemProps> = ({ item, isActive, onClick }) => (
  <div className={`${styles.mention_item} ${isActive ? styles.active : ''}`} onClick={() => onClick(item)}>
    <div className={styles.mention_item_left}>
      <Icon className={cls(styles.mention_item_icon, item.icon)} />
      <span className={styles.mention_item_text}>{item.text}</span>
      <span className={styles.mention_item_description}>{item.description}</span>
    </div>
    {item.getItems && <Icon className={cls(styles.mention_item_right, getIcon('arrowright'))} />}
  </div>
);
