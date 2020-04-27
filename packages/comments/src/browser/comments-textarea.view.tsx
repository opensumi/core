import * as React from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import * as styles from './comments.module.less';

export interface ICommentTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  focusDelay?: number;
  minRows?: number;
  maxRows?: number;
  initialHeight?: string;
  dragFiles?: (files: FileList) => void;
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
      dragFiles,
    } = props;
    const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
     // make `ref` to input works
    React.useImperativeHandle(ref, () => inputRef.current!);

    const handleFileSelect = React.useCallback(async (event: DragEvent) => {
      event.stopPropagation();
      event.preventDefault();

      const files = event.dataTransfer?.files; // FileList object.
      if (files && dragFiles) {
        await dragFiles(files);
      }

      if (inputRef.current) {
        inputRef.current.focus();
        selectLastPosition(inputRef.current.value);
      }
    }, [ dragFiles ]);

    const handleDragOver = React.useCallback((event) => {
      event.stopPropagation();
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }, []);

    const selectLastPosition = React.useCallback((value) => {
      const textarea = inputRef?.current;
      if (textarea) {
        const position = value.toString().length;
        textarea.setSelectionRange(position, position);
      }
    }, []);

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
      selectLastPosition(value);

    }, []);

    return (
      <div className={styles.textarea_container}>
        <TextareaAutosize
          onDragOver={handleDragOver}
          onDrop={handleFileSelect}
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
