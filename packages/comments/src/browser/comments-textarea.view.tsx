import * as React from 'react';
import * as styles from './comments.module.less';

export interface ICommentTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  focusDelay?: number;
}

export const CommentsTextArea = React.forwardRef<HTMLTextAreaElement, ICommentTextAreaProps>(
  (props, ref) => {
    const {
      focusDelay = 0,
      autoFocus = false,
      placeholder = '',
      onFocus,
      onBlur,
      onChange,
      rows = 2,
      value,
    } = props;

    const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
     // make `ref` to input works
    React.useImperativeHandle(ref, () => inputRef.current!);

    React.useEffect(() => {
      if (focusDelay) {
        setTimeout(() => {
          inputRef?.current?.focus();
        }, focusDelay);
      }
      // auto set last selection
      if (value && inputRef) {
        const position = value.toString().length;
        inputRef.current?.setSelectionRange(position, position);
      }
    }, []);

    return (
      <div className={styles.textarea_container}>
        <textarea
          ref={inputRef}
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
