import * as React from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import * as styles from './comments.module.less';

export interface ICommentTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  focusDelay?: number;
  minRows?: number;
  maxRows?: number;
  initialHeight?: string;
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
      maxRows = 10,
      minRows = 2,
      value,
      initialHeight,
    } = props;

    const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
     // make `ref` to input works
    React.useImperativeHandle(ref, () => inputRef.current!);

    React.useEffect(() => {
      const textarea = inputRef?.current;
      if (!textarea) {
        return;
      }
      if (initialHeight && textarea.style) {
        textarea.style.height = initialHeight;
      }
      if (focusDelay) {
        setTimeout(() => {
          textarea.focus();
        }, focusDelay);
      }
      // auto set last selection
      if (value) {
        const position = value.toString().length;
        textarea.setSelectionRange(position, position);
      }
    }, []);

    return (
      <div className={styles.textarea_container}>
        <TextareaAutosize
          inputRef={inputRef}
          value={value}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={onChange}
          className={styles.textarea}
          minRows={minRows}
          maxRows={maxRows}
        />
      </div>
    );
  },
);
