import * as React from 'react';
import * as styles from './comments.module.less';
import { IComment } from '../common';

export const CommentItem: React.FC<IComment> = (
  {
    body,
    author,
    label,
  },
) => {
  const iconUrl = author.iconPath?.toString();

  return (
  <div className={styles.comment_item}>
    <div className={styles.comment_item_head}>
      {iconUrl && <img className={styles.comment_item_icon} src={iconUrl} alt={author.name}/>}
      <div>
        <span className={styles.comment_item_author_name}>{author.name}</span>
        {typeof label === 'string' ? <span className={styles.comment_item_label}>{label}</span> : label}
      </div>
    </div>
    <div>{body}</div>
  </div>
  );
};
