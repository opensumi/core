import cls from 'classnames';
import React, { MutableRefObject, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import { IInputBaseProps, Popover, PopoverPosition, TextArea, getIcon } from '@opensumi/ide-components';
import { isUndefined, localize, uuid } from '@opensumi/ide-core-common';

import { Key } from '../../../keyboard';
import { useInjectable } from '../../../react-hooks';
import { GlobalBrowserStorageService } from '../../../services/storage-service';
import { EnhanceIcon } from '../index';

import styles from './index.module.less';

const MAX_WRAPPER_HEIGHT = 160;
const DEFAULT_HEIGHT = 32;

export interface IInteractiveInputProps extends IInputBaseProps<HTMLTextAreaElement> {
  style?: React.CSSProperties;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onHeightChange?: (height: number) => void;
  onSend?: (value: string) => void;
  onStop?: () => void;
  width?: number;
  height?: number;
  sendBtnClassName?: string;
  popoverPosition?: PopoverPosition;
}

const GLOBAL_AI_NATIVE_CHAT_INPUT_HISTORY_KEY = 'ai-native-chat-input-history';
const MAX_HISOTRY_SIZE = 10;

export const InteractiveInput = React.forwardRef(
  (props: IInteractiveInputProps, ref: MutableRefObject<HTMLTextAreaElement>) => {
    const {
      placeholder,
      onKeyDown,
      onBlur,
      onValueChange,
      onHeightChange,
      onFocus,
      onSend,
      onStop,
      disabled = false,
      className,
      height,
      width,
      sendBtnClassName,
      popoverPosition,
      autoFocus,
      defaultValue,
    } = props;

    const internalRef = useRef<HTMLTextAreaElement>(null);
    const globalStroageService = useInjectable<GlobalBrowserStorageService>(GlobalBrowserStorageService);
    const history = useRef<string[]>();
    const historyIndex = useRef<number>(0);
    const [internalValue, setInternalValue] = useState(defaultValue || props.value || '');
    const [wrapperHeight, setWrapperHeight] = useState(height || DEFAULT_HEIGHT);
    const [focus, setFocus] = useState(false);
    const isDirtyInput = React.useRef<boolean>(false);

    useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement);

    useEffect(() => {
      const historyStore = globalStroageService.getData<string[]>(GLOBAL_AI_NATIVE_CHAT_INPUT_HISTORY_KEY);
      if (historyStore) {
        history.current = historyStore;
      }
    }, []);

    useEffect(() => {
      if (internalRef && internalRef.current && autoFocus) {
        internalRef.current.focus();
      }
    }, [internalRef]);

    useEffect(() => {
      const value = props.value;
      if (isUndefined(value)) {
        return;
      }

      if (value !== internalRef.current?.value) {
        setInternalValue(value || '');
      }
    }, [props.value, internalValue, internalRef]);

    useEffect(() => {
      if (isUndefined(height)) {
        return;
      }

      if (height !== wrapperHeight) {
        setWrapperHeight(height);
      }
    }, [height, wrapperHeight, onHeightChange]);

    useEffect(() => {
      if (!internalValue) {
        setWrapperHeight(DEFAULT_HEIGHT);
        return;
      }

      if (internalRef && internalRef.current && wrapperHeight <= MAX_WRAPPER_HEIGHT) {
        internalRef.current.style.height = 0 + 'px';
        const scrollHeight = internalRef.current.scrollHeight;
        internalRef.current.style.height = Math.min(scrollHeight, MAX_WRAPPER_HEIGHT) + 'px';
        const wrapperHeight = Math.min(scrollHeight + 12, MAX_WRAPPER_HEIGHT);
        setWrapperHeight(wrapperHeight);
      }
    }, [internalRef, internalValue, onHeightChange, wrapperHeight]);

    useEffect(() => {
      onHeightChange?.(wrapperHeight);
    }, [wrapperHeight]);

    const handleInputChange = useCallback(
      (value: string) => {
        isDirtyInput.current = true;
        setInternalValue(value);
        onValueChange?.(value);
      },
      [onValueChange],
    );

    const handleFocus = useCallback(
      (e) => {
        setFocus(true);
        onFocus?.(e);
      },
      [onFocus],
    );

    const handleBlur = useCallback(
      (e) => {
        setFocus(false);
        onBlur?.(e);
      },
      [onBlur],
    );

    const handleStop = useCallback(() => {
      if (onStop) {
        onStop();
      }
    }, []);

    const handleSend = useCallback(() => {
      if (disabled) {
        return;
      }

      if (!internalValue.trim()) {
        return;
      }
      history.current = history.current || [];
      history.current.push(internalValue);
      historyIndex.current = 0;
      globalStroageService.setData(GLOBAL_AI_NATIVE_CHAT_INPUT_HISTORY_KEY, history.current.slice(-MAX_HISOTRY_SIZE));
      isDirtyInput.current = false;

      onSend?.(internalValue);
    }, [onSend, internalValue, disabled]);

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === Key.ENTER.code && !event.nativeEvent.isComposing) {
          if (event.shiftKey) {
            return;
          }

          event.preventDefault();
          handleSend();
          return;
        } else if (
          (event.key === Key.ARROW_UP.code || event.key === Key.ARROW_DOWN.code) &&
          (!internalValue || !isDirtyInput.current)
        ) {
          event.preventDefault();
          if (event.key === Key.ARROW_UP.code) {
            const value = history.current?.[history.current.length - 1 - historyIndex.current];
            if (value) {
              setInternalValue(value);
              onValueChange?.(value);
              historyIndex.current = Math.min(historyIndex.current + 1, history.current?.length || 0);
            }
          } else if (event.key === Key.ARROW_DOWN.code) {
            event.preventDefault();
            const value = history.current?.[history.current.length - 1 - historyIndex.current];
            if (value) {
              setInternalValue(value);
              onValueChange?.(value);
              historyIndex.current = Math.max(historyIndex.current - 1, 0);
            }
          }
        }
        onKeyDown?.(event);
      },
      [onKeyDown, handleSend, internalValue],
    );

    const renderAddonAfter = useMemo(
      () => (
        <div className={styles.input_icon_container}>
          <div
            className={cls(styles.send_chat_btn, focus && styles.active, disabled && styles.disabled, sendBtnClassName)}
          >
            {disabled ? (
              onStop ? (
                <Popover
                  id={`ai_chat_input_send_${uuid(4)}`}
                  content={localize('aiNative.chat.enter.send')}
                  delay={1500}
                  position={popoverPosition ?? PopoverPosition.top}
                  disable={disabled}
                >
                  <EnhanceIcon
                    wrapperClassName={styles.stop_icon}
                    className={'codicon codicon-debug-stop'}
                    onClick={handleStop}
                    tabIndex={0}
                    role='button'
                    ariaLabel={localize('aiNative.chat.enter.send')}
                  />
                </Popover>
              ) : (
                <div className={styles.ai_loading}>
                  <div className={styles.loader}></div>
                  <div className={styles.loader}></div>
                  <div className={styles.loader}></div>
                </div>
              )
            ) : (
              <Popover
                id={`ai_chat_input_send_${uuid(4)}`}
                content={localize('aiNative.chat.enter.send')}
                delay={1500}
                position={popoverPosition ?? PopoverPosition.top}
                disable={disabled}
              >
                <EnhanceIcon
                  wrapperClassName={styles.send_icon}
                  className={getIcon('send-solid')}
                  onClick={handleSend}
                  tabIndex={0}
                  role='button'
                  ariaLabel={localize('aiNative.chat.enter.send')}
                />
              </Popover>
            )}
          </div>
        </div>
      ),
      [focus, disabled, sendBtnClassName, internalValue, popoverPosition],
    );

    const wrapperWidth = useMemo(() => {
      if (isUndefined(width)) {
        return '100%';
      }

      return width + 'px';
    }, [width]);

    return (
      <TextArea
        ref={internalRef}
        placeholder={placeholder}
        wrapperStyle={{ height: wrapperHeight + 'px', width: wrapperWidth }}
        style={{
          height: wrapperHeight - 10 + 'px',
        }}
        value={internalValue}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onValueChange={handleInputChange}
        disabled={disabled}
        className={cls(styles.interactive_input_container, focus ? styles.active : null, className)}
        addonAfter={renderAddonAfter}
      />
    );
  },
);

InteractiveInput.displayName = 'interactiveInput';
