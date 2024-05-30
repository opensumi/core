import cls from 'classnames';
import React, { MutableRefObject, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import { IInputBaseProps, Popover, TextArea, getIcon } from '@opensumi/ide-components';
import { isUndefined, localize, uuid } from '@opensumi/ide-core-common';

import { EnhanceIcon } from '../index';

import styles from './index.module.less';

const MAX_WRAPPER_HEIGHT = 160;
const DEFAULT_HEIGHT = 32;

export interface IInteractiveInputProps extends IInputBaseProps<HTMLTextAreaElement> {
  style?: React.CSSProperties;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onHeightChange?: (height: number) => void;
  onSend?: () => void;
  width?: number;
  height?: number;
  sendBtnClassName?: string;
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
    } = props;

    const internalRef = useRef<HTMLTextAreaElement>(null);

    const [internalValue, setInternalValue] = useState(props.value || '');
    const [wrapperHeight, setWrapperHeight] = useState(height || DEFAULT_HEIGHT);
    const [focus, setFocus] = useState(false);

    useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement);

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
      if (onHeightChange) {
        onHeightChange(wrapperHeight);
      }
    }, [wrapperHeight]);

    const handleInputChange = useCallback(
      (value: string) => {
        setInternalValue(value);
        if (onValueChange) {
          onValueChange(value);
        }
      },
      [onValueChange],
    );

    const handleFocus = useCallback(
      (e) => {
        setFocus(true);
        if (onFocus) {
          onFocus(e);
        }
      },
      [onFocus],
    );

    const handleBlur = useCallback(
      (e) => {
        setFocus(false);
        if (onBlur) {
          onBlur(e);
        }
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

      if (onSend) {
        onSend();
      }
    }, [onSend, internalValue]);

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
                disable={disabled}
              >
                <EnhanceIcon
                  wrapperClassName={styles.send_icon}
                  className={getIcon('send-solid')}
                  onClick={() => handleSend()}
                />
              </Popover>
            )}
          </div>
        </div>
      ),
      [focus, disabled, props.sendBtnClassName],
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
        onKeyDown={onKeyDown}
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
