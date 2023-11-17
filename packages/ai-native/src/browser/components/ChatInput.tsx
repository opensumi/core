import cls from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Icon, Input, Popover, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { uuid } from '@opensumi/ide-core-common';

import { InstructionEnum } from '../../common';

import * as styles from './components.module.less';
import { EnhanceIcon } from './Icon';

interface IBlockProps {
  icon?: string;
  name: string;
  text?: string;
  onClick?: () => void;
}

const Block = ({ icon, name, onClick, text }: IBlockProps) => (
  <div className={styles.block} onClick={onClick}>
    {icon && <EnhanceIcon className={icon} />}
    {name && <span className={styles.name}>{name}</span>}
    {text && <span className={styles.text}>{text}</span>}
  </div>
);

// 指令列表
const optionsList: IBlockProps[] = [
  {
    name: InstructionEnum.aiExplainKey,
    text: '解释代码',
  },
  {
    name: InstructionEnum.aiTestKey,
    text: '生成单测',
  },
  {
    name: InstructionEnum.aiOptimzeKey,
    text: '优化代码',
  },
  {
    name: InstructionEnum.aiSumiKey,
    text: '执行 IDE 相关命令',
  },
  {
    name: InstructionEnum.aiSearchDocKey,
    text: '搜索文档内容',
  },
  {
    name: InstructionEnum.aiSearchCodeKey,
    text: '搜索代码仓库中的内容',
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
          {options.map(({ icon, name, text }) => (
            <li key={name} onClick={() => handleClick(name)}>
              <Block icon={icon} name={name} text={text} />
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

const ThemeWidget = ({ themeBlock }) => (
  <div className={styles.theme_container}>
    <div className={styles.theme_block}>{themeBlock}</div>
  </div>
);

export interface IChatInputProps {
  onSend: (value: string) => void;
  onValueChange?: (value: string) => void;
  onExpand?: (value: boolean) => void;
  placeholder?: string;
  enableOptions?: boolean;
  disabled?: boolean;
  sendBtnClassName?: string;
  defaultHeight?: number;
  value?: string;
  autoFocus?: boolean;
  theme?: string | null;
  setTheme: (theme: string | null) => void;
}

// 指令命令激活组件
export const ChatInput = (props: IChatInputProps) => {
  const {
    onSend,
    onValueChange,
    onExpand,
    placeholder,
    enableOptions = false,
    disabled = false,
    defaultHeight = 32,
    autoFocus,
    setTheme,
    theme,
  } = props;
  const [value, setValue] = useState(props.value || '');
  const [isShowOptions, setIsShowOptions] = useState<boolean>(false);
  const [wrapperHeight, setWrapperHeight] = useState<number>(defaultHeight);
  // const [slashWidget, setSlashWidget] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [focus, setFocus] = useState(false);
  const [showExpand, setShowExpand] = useState(false);
  const [isExpand, setIsExpand] = useState(false);

  useEffect(() => {
    if (props.value !== value) {
      setValue(props.value || '');
    }
  }, [props.value]);

  useEffect(() => {
    setTheme(props.theme || '');
  }, [props.theme]);

  useEffect(() => {
    acquireOptionsCheck(props.theme || '');
  }, [props.theme]);

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
    if (inputRef && inputRef.current && !isExpand) {
      inputRef.current.style.height = 0 + 'px';
      const scrollHeight = inputRef.current.scrollHeight;
      inputRef.current.style.height = Math.min(scrollHeight, 160) + 'px';
      const wapperHeight = Math.min(scrollHeight + (defaultHeight - 20), 160);
      setWrapperHeight(wapperHeight);
      if (wapperHeight > 68) {
        setShowExpand(true);
      } else {
        setShowExpand(false);
      }
    }
  }, [inputRef, value, enableOptions]);

  const handleInputChange = useCallback((value: string) => {
    setValue(value);
    if (onValueChange) {
      onValueChange(value);
    }
  }, []);

  const handleSend = useCallback(() => {
    let preText = '';
    if (theme) {
      preText = theme;
    }

    if (value.trim() && onSend && !disabled) {
      setValue('');
      onSend(preText + value);
      isExpand ? resetStatus() : resetStatus(true);
    }
  }, [onSend, value]);

  const acquireOptionsCheck = useCallback(
    (themeValue: string) => {
      if (themeValue) {
        setIsShowOptions(false);

        // 设置 slash widget 块
        const regex = /\/\s(\w+)\s/;
        const match = themeValue.match(regex);
        if (match) {
          const keyword = match[0];
          if (optionsList.find(({ name }) => name === keyword)) {
            setTheme(keyword);
          }
        } else {
          setTheme('');
        }

        if (inputRef && inputRef.current) {
          inputRef.current.focus();
          const inputValue = inputRef.current.value;
          if (inputValue.length === 1 && inputValue.startsWith('/')) {
            setValue('');
          }
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
    } else if (event.key === 'Backspace') {
      if (inputRef.current?.selectionEnd === 0 && inputRef.current?.selectionStart === 0) {
        setTheme('');
      }
    }
  };

  const handleFocus = () => {
    setFocus(true);
  };
  const handleBlur = () => {
    setFocus(false);
  };

  const handleExpandClick = useCallback(() => {
    const expand = isExpand;
    setIsExpand(!expand);
    if (!expand) {
      const ele = document.querySelector('#ai_chat_left_container');
      // ai_chat_left_container - (padding + header_operate + border ) - theme_container - padding
      const maxHeight = ele!.clientHeight - 68 - (theme ? 32 : 0) - 16;
      setWrapperHeight(maxHeight);
    } else {
      setWrapperHeight(defaultHeight);
      setShowExpand(false);
    }
  }, [isExpand]);

  const resetStatus = (clearExpand?: boolean) => {
    setWrapperHeight(defaultHeight);
    if (clearExpand) {
      setShowExpand(false);
    }
    setIsExpand(false);
    setTheme('');
  };

  return (
    <div className={styles.chat_input_container}>
      {isShowOptions && <InstructionOptions onClick={acquireOptionsCheck} bottom={optionsBottomPosition} />}
      {theme && <ThemeWidget themeBlock={theme} />}
      {showExpand && (
        <div className={styles.expand_icon} onClick={() => handleExpandClick()}>
          <Popover id={'ai_chat_input_expand'} title={isExpand ? '收起' : '展开全屏'}>
            <Icon className={cls(isExpand ? getIcon('shrink') : getIcon('expand'))}></Icon>
          </Popover>
        </div>
      )}
      <Input
        ref={inputRef}
        placeholder={placeholder}
        wrapperStyle={{ height: wrapperHeight + 'px' }}
        style={{
          height: wrapperHeight - 16 + 'px',
          // maxHeight: wrapperHeight-16 + 'px',
          // minHeight: wrapperHeight-16 + 'px',
        }}
        value={value}
        type={'textarea'}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onValueChange={handleInputChange}
        disabled={disabled}
        className={styles.input_wrapper}
        addonAfter={
          <div className={styles.input_icon_container}>
            <div
              className={cls(
                styles.send_chat_btn,
                focus && styles.active,
                disabled && styles.disabled,
                props.sendBtnClassName,
              )}
            >
              <Popover id={`ai_chat_input_send_${uuid(4)}`} title={'Enter 发送'} disable={disabled}>
                <Icon className={cls(getIcon('send'), styles.send_icon)} onClick={() => handleSend()} />
              </Popover>
            </div>
          </div>
        }
      />
    </div>
  );
};
