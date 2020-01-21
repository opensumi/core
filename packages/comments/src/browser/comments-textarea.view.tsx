import * as React from 'react';
import * as styles from './comments.module.less';

export interface ICommentTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
}

export const CommentsTextArea: React.FC<ICommentTextAreaProps> = ({
  autoFocus = true,
  placeholder = '',
  onFocus,
  onBlur,
  onChange,
  rows = 5,
  value,
}) => {

  return (
    <div className={styles.textarea_container}>
      <textarea
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={onChange}
        className={styles.textarea}
        rows={rows}>
      </textarea>
    </div>
  );
};
