import cls from 'classnames';
import React, { MutableRefObject, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import { IInputBaseProps, Popover, PopoverPosition, TextArea, getIcon } from '@opensumi/ide-components';
import { isUndefined, localize, uuid } from '@opensumi/ide-core-common';

import { EnhanceIcon } from '../index';

import styles from './index.module.less';

const MAX_WRAPPER_HEIGHT = 160;
const DEFAULT_HEIGHT = 32;

export interface IInteractiveInputProps extends IInputBaseProps<HTMLTextAreaElement> {
  style?: React.CSSProperties;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onHeightChange?: (height: number) => void;
  onSend?: (value: string) => void;
  width?: number;
  height?: number;
  sendBtnClassName?: string;
  popoverPosition?: PopoverPosition;
}

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
      disabled = false,
      className,
      height,
      width,
      sendBtnClassName,
      popoverPosition,
      autoFocus,
    } = props;

    const internalRef = useRef<HTMLTextAreaElement>(null);

    const [internalValue, setInternalValue] = useState(props.value || '');
    const [wrapperHeight, setWrapperHeight] = useState(height || DEFAULT_HEIGHT);
    const [focus, setFocus] = useState(false);

    useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement);

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

    const handleSend = useCallback(() => {
      if (disabled) {
        return;
      }

      if (!internalValue.trim()) {
        return;
      }

      onSend?.(internalValue);
    }, [onSend, internalValue, disabled]);

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
          if (event.shiftKey) {
            return;
          }

          event.preventDefault();
          handleSend();
          return;
        }

        onKeyDown?.(event);
      },
      [onKeyDown, handleSend],
    );

    const renderAddonAfter = useMemo(
      () => (
        <div className={styles.input_icon_container}>
          <div
            className={cls(styles.send_chat_btn, focus && styles.active, disabled && styles.disabled, sendBtnClassName)}
          >
            {disabled ? (
              <div className={styles.ai_loading}>
                <div className={styles.loader}></div>
                <div className={styles.loader}></div>
                <div className={styles.loader}></div>
              </div>
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
        style={{ height: wrapperHeight - 10 + 'px' }}
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
