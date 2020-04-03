import * as React from 'react';
import * as styles from './comments.module.less';

export interface ICommentTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
}

export const CommentsTextArea = React.forwardRef<HTMLTextAreaElement, ICommentTextAreaProps>(
  (props, ref) => {
    const {
      autoFocus = false,
      placeholder = '',
      onFocus,
      onBlur,
      onChange,
      rows = 2,
      value,
    } = props;

    return (
      <div className={styles.textarea_container}>
        <textarea
          ref={ref}
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
  },
);
