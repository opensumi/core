import React from 'react';
import { MentionsInput, Mention } from 'react-mentions';

import { Tabs } from '@opensumi/ide-components';
import { localize, useInjectable } from '@opensumi/ide-core-browser';

import { ICommentsFeatureRegistry } from '../common';

import { CommentsBody } from './comments-body';
import styles from './comments.module.less';
import { getMentionBoxStyle } from './mentions.style';


export interface ICommentTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  focusDelay?: number;
  minRows?: number;
  maxRows?: number;
  initialHeight?: string;
  value: string;
  dragFiles?: (files: FileList) => void;
}

const defaultTrigger = '@';
const defaultMarkup = '@[__display__](__id__)';
const defaultDisplayTransform = (id: string, display: string) => `@${display}`;

export const CommentsTextArea = React.forwardRef<HTMLTextAreaElement, ICommentTextAreaProps>((props, ref) => {
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
  const [index, setIndex] = React.useState(0);
  const commentsFeatureRegistry = useInjectable<ICommentsFeatureRegistry>(ICommentsFeatureRegistry);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const mentionsRef = React.useRef<HTMLDivElement | null>(null);
  const itemRef = React.useRef<HTMLDivElement | null>(null);
  // make `ref` to input works
  React.useImperativeHandle(ref, () => inputRef.current!);

  const handleFileSelect = React.useCallback(
    async (event: DragEvent) => {
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
    },
    [dragFiles],
  );

  const handleDragOver = React.useCallback((event) => {
    event.stopPropagation();
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const selectLastPosition = React.useCallback((value) => {
    const textarea = inputRef.current;
    if (textarea) {
      const position = value.toString().length;
      textarea.setSelectionRange(position, position);
    }
  }, []);

  React.useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) {
      return;
    }
    if (initialHeight && textarea.style) {
      textarea.style.height = initialHeight;
    }
    if (focusDelay) {
      setTimeout(() => {
        textarea.focus({
          preventScroll: true,
        });
      }, focusDelay);
    }
    // auto set last selection
    selectLastPosition(value);
    function handleMouseWheel(event: Event) {
      const target = event.target as Element;
      if (target) {
        if (
          // 当前文本框出现滚动时，防止被编辑器滚动拦截，阻止冒泡
          (target.nodeName.toUpperCase() === 'TEXTAREA' && target.scrollHeight > target.clientHeight) ||
          // 当是在弹出的提及里滚动，防止被编辑器滚动拦截，阻止冒泡
          target.nodeName.toUpperCase() === 'UL' ||
          target.parentElement?.nodeName.toUpperCase() === 'UL' ||
          target.parentElement?.parentElement?.nodeName.toUpperCase() === 'UL'
        ) {
          event.stopPropagation();
        }
      }
    }
    mentionsRef.current?.addEventListener('mousewheel', handleMouseWheel, true);
    return () => {
      mentionsRef.current?.removeEventListener('mousewheel', handleMouseWheel, true);
    };
  }, []);

  React.useEffect(() => {
    if (index === 0) {
      setTimeout(() => {
        inputRef.current?.focus({
          preventScroll: true,
        });
      }, focusDelay);
      selectLastPosition(value);
    }
  }, [index]);

  const style = React.useMemo(
    () =>
      getMentionBoxStyle({
        minRows,
        maxRows,
      }),
    [minRows, maxRows],
  );

  const mentionsOptions = React.useMemo(() => commentsFeatureRegistry.getMentionsOptions(), [commentsFeatureRegistry]);

  const providerData = React.useCallback(
    async (query: string, callback) => {
      if (mentionsOptions.providerData) {
        const data = await mentionsOptions.providerData(query);
        callback(data);
      } else {
        callback([]);
      }
    },
    [mentionsOptions],
  );

  return (
    <div className={styles.textarea_container}>
      <Tabs
        mini
        value={index}
        onChange={(index: number) => setIndex(index)}
        tabs={[localize('comments.thread.textarea.write'), localize('comments.thread.textarea.preview')]}
      />
      <div>
        {index === 0 ? (
          <div ref={mentionsRef}>
            <MentionsInput
              autoFocus={autoFocus}
              onDragOver={handleDragOver}
              onDrop={handleFileSelect}
              inputRef={inputRef}
              ref={itemRef}
              value={value}
              placeholder={placeholder}
              onChange={onChange}
              onFocus={onFocus}
              onBlur={onBlur}
              style={style}
            >
              <Mention
                markup={mentionsOptions.markup || defaultMarkup}
                renderSuggestion={mentionsOptions.renderSuggestion}
                trigger={defaultTrigger}
                data={providerData}
                displayTransform={mentionsOptions.displayTransform || defaultDisplayTransform}
              />
            </MentionsInput>
          </div>
        ) : (
          <div className={styles.textarea_preview}>
            <CommentsBody body={value} />
          </div>
        )}
      </div>
    </div>
  );
});
