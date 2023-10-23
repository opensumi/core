import cls from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Icon, Input, Popover, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { uuid } from '@opensumi/ide-core-common';

import { InstructionEnum } from '../../common';

import * as styles from './components.module.less';
import { EnhanceIcon } from './Icon';

interface IBlockProps {
  icon: string;
  name?: string;
  onClick?: () => void;
}

const Block = ({ icon, name, onClick }: IBlockProps) => (
  <div className={styles.block} onClick={onClick}>
    <EnhanceIcon className={icon} />
    {name && <span className={styles.name}>{name}</span>}
  </div>
);

// 指令列表
const optionsList: IBlockProps[] = [
  {
    icon: getIcon('search'),
    name: InstructionEnum.aiSearchKey,
  },
  {
    icon: getIcon('code'),
    name: InstructionEnum.aiSumiKey,
  },
];

// 指令命令激活组件
const InstructionOptions = ({ onClick, bottom }) => {
  const [commonlyUsed, setCommonlyUsed] = useState<IBlockProps[]>([]);
  const [options, setOptions] = useState<IBlockProps[]>([]);

  useEffect(() => {
    setOptions(optionsList);
  }, []);

  const handleClick = useCallback(
    (name: string | undefined) => {
      if (onClick) {
        onClick(name || '');
      }
    },
    [onClick],
  );

  return (
    <div className={styles.instruction_options_container} style={{ bottom: bottom + 'px' }}>
      <div className={styles.options}>
        <ul>
          {options.map(({ icon, name }) => (
            <li key={name} onClick={() => handleClick(name)}>
              <Block icon={icon} />
              <span>{name}</span>
            </li>
          ))}
        </ul>
      </div>
      {commonlyUsed.length > 0 && (
        <div className={styles.commonly_used}>
          <span>常用指令：</span>
          {commonlyUsed.map(({ icon, name }, i) => (
            <Block key={i} icon={icon} name={name} />
          ))}
        </div>
      )}
    </div>
  );
};

export interface IChatInputProps {
  onSend: (value: string) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  enableOptions?: boolean;
  disabled?: boolean;
  sendBtnClassName?: string;
  defaultHeight?: number;
  value?: string;
  autoFocus?: boolean;
}

// 指令命令激活组件
export const ChatInput = (props: IChatInputProps) => {
  const {
    onSend,
    onValueChange,
    placeholder,
    enableOptions = false,
    disabled = false,
    defaultHeight = 40,
    autoFocus,
  } = props;
  const [value, setValue] = useState(props.value || '');
  const [isShowOptions, setIsShowOptions] = useState<boolean>(false);
  const [wrapperHeight, setWrapperHeight] = useState<number>(defaultHeight);
  const [slashWidget, setSlashWidget] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (props.value !== value) {
      setValue(props.value || '');
    }
  }, [props.value]);

  useEffect(() => {
    if (inputRef && autoFocus) {
      inputRef.current?.focus();
    }
  }, [inputRef, autoFocus, props.value]);

  useEffect(() => {
    if (enableOptions) {
      if (value.length === 1 && value.startsWith('/')) {
        setIsShowOptions(true);
      } else {
        setIsShowOptions(false);
      }
    }

    // 自适应高度
    if (inputRef && inputRef.current) {
      inputRef.current.style.height = 0 + 'px';

      const scrollHeight = inputRef.current.scrollHeight;
      inputRef.current.style.height = Math.min(scrollHeight, 140) + 'px';

      setWrapperHeight(scrollHeight + (defaultHeight - 20));
    }

    // 设置 slash widget 块
    const regex = /\/(\w+)\s/;
    const match = value.match(regex);
    if (match) {
      const keyword = match[0];
      if (optionsList.find(({ name }) => name === keyword)) {
        setSlashWidget(keyword);
      }
    } else {
      setSlashWidget('');
    }
  }, [inputRef, value, enableOptions]);

  const handleInputChange = useCallback((value: string) => {
    setValue(value);
    if (onValueChange) {
      onValueChange(value);
    }
  }, []);

  const handleSend = useCallback(() => {
    if (value.trim() && onSend) {
      setValue('');
      onSend(value);
    }
  }, [onSend, value]);

  const acquireOptionsCheck = useCallback(
    (value: string) => {
      if (value) {
        setValue(value);
        setIsShowOptions(false);

        if (inputRef && inputRef.current) {
          inputRef.current.focus();
        }
      }
    },
    [inputRef],
  );

  const optionsBottomPosition = useMemo(() => Math.min(181, Math.max(61, 21 + wrapperHeight)), [wrapperHeight]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      if (!event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    }
  };

  return (
    <div className={styles.chat_input_container}>
      {isShowOptions && <InstructionOptions onClick={acquireOptionsCheck} bottom={optionsBottomPosition} />}
      <Input
        ref={inputRef}
        placeholder={placeholder}
        wrapperStyle={{ height: wrapperHeight + 'px' }}
        value={value}
        type={'textarea'}
        onKeyDown={handleKeyDown}
        onValueChange={handleInputChange}
        disabled={disabled}
        className={styles.input_wrapper}
        addonBefore={
          slashWidget && (
            <div className={styles.slash_widget_block}>
              <span>{slashWidget}</span>
            </div>
          )
        }
        addonAfter={
          <div
            className={cls(
              styles.send_chat_btn,
              value.length && styles.active,
              disabled && styles.disabled,
              props.sendBtnClassName,
            )}
            onClick={() => handleSend()}
          >
            <Popover id={`ai_chat_input_send_${uuid(4)}`} title={'Enter 发送'} disable={disabled}>
              <Icon className={getIcon('send')} />
            </Popover>
          </div>
        }
      />
    </div>
  );
};
